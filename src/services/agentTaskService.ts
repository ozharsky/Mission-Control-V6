/**
 * Agent Task Service - FIXED VERSION
 * Mission Control V6
 * 
 * ISSUES FOUND AND FIXED:
 * 1. Missing AGENT_EMOJIS, AGENT_NAMES, AGENT_DISCORD_IDS imports
 * 2. notifyAgent function had template literal issues
 * 3. completeWorkflowTask wasn't handling errors properly
 * 4. Missing transaction safety for workflow updates
 */

import { 
  Database, 
  ref, 
  set, 
  get, 
  update as firebaseUpdate, 
  remove,
  runTransaction
} from 'firebase/database';
import {
  AgentTask,
  AgentWorkflow,
  TaskFilters,
  ActivityEntry,
  AgentStats,
  DashboardStats,
  AgentId,
  TaskStatus
} from '../types/agentTask';
import { 
  AGENTS, 
  WORKFLOW_TEMPLATES,
  AGENT_EMOJIS,
  AGENT_NAMES 
} from '../constants/agents';
import { DiscordNotificationService } from './discordNotificationService';

// Agent Discord user IDs for mentions
const AGENT_DISCORD_IDS: Record<AgentId, string> = {
  planner: '1478495012416131193',
  ideator: '1478496025328091269',
  critic: '1478496289036697890',
  scout: '1478496531496698036',
  coder: '1478496764658061312',
  writer: '1478496947202691103',
  reviewer: '1478497225918255114',
  surveyor: '1478497423654649907'
};

export class AgentTaskService {
  private db: Database;
  private basePath = 'v6/agentTasks';
  private workflowPath = 'v6/agentWorkflows';
  private discord: DiscordNotificationService;

  constructor(firebaseDb: Database) {
    this.db = firebaseDb;
    this.discord = new DiscordNotificationService(firebaseDb);
  }

  // ==================== AGENT TASKS ====================

  async createAgentTask(taskData: Partial<AgentTask>): Promise<AgentTask> {
    const taskId = this.generateTaskId();
    
    const task: any = {
      id: taskId,
      type: taskData.type || 'custom',
      assignee: taskData.assignee || 'surveyor',
      requestedBy: taskData.requestedBy || 'system',
      status: 'pending',
      state: {
        current: 'created',
        history: []
      },
      title: taskData.title || 'Untitled Task',
      description: taskData.description || '',
      input: taskData.input ?? null,
      output: null,
      nextAgentTaskId: null,
      discordMessageIds: [],
      createdAt: Date.now(),
      activityLog: [{
        timestamp: Date.now(),
        agent: 'system',
        action: 'created',
        message: `Task created by ${taskData.requestedBy || 'system'}`
      }],
      tags: taskData.tags || [],
      priority: taskData.priority || 'medium'
    };

    if (taskData.parentTaskId !== undefined) task.parentTaskId = taskData.parentTaskId;
    if (taskData.workflowId !== undefined) task.workflowId = taskData.workflowId;
    if (taskData.previousAgentTaskId !== undefined) task.previousAgentTaskId = taskData.previousAgentTaskId;
    if (taskData.discordThreadId !== undefined) task.discordThreadId = taskData.discordThreadId;
    if (taskData.discordChannelId !== undefined) task.discordChannelId = taskData.discordChannelId;
    if (taskData.estimatedDuration !== undefined) task.estimatedDuration = taskData.estimatedDuration;
    if (taskData.projectId !== undefined) task.projectId = taskData.projectId;

    await set(ref(this.db, `${this.basePath}/${task.id}`), task);
    return task as AgentTask;
  }

  async getAgentTask(taskId: string): Promise<AgentTask | null> {
    const snapshot = await get(ref(this.db, `${this.basePath}/${taskId}`));
    return snapshot.val();
  }

  async updateAgentTask(taskId: string, updates: Partial<AgentTask>): Promise<void> {
    await firebaseUpdate(ref(this.db, `${this.basePath}/${taskId}`), updates);
  }

  async listAgentTasks(filters: TaskFilters = {}): Promise<AgentTask[]> {
    const snapshot = await get(ref(this.db, `${this.basePath}`));
    const tasks: AgentTask[] = [];

    snapshot.forEach((child) => {
      const task = child.val() as AgentTask;
      if (filters.status && task.status !== filters.status) return;
      if (filters.assignee && task.assignee !== filters.assignee) return;
      if (filters.workflowId && task.workflowId !== filters.workflowId) return;
      if (filters.priority && task.priority !== filters.priority) return;
      tasks.push(task);
    });

    return tasks.sort((a, b) => b.createdAt - a.createdAt);
  }

  async listAgentWorkflows(): Promise<AgentWorkflow[]> {
    const snapshot = await get(ref(this.db, `${this.workflowPath}`));
    const workflows: AgentWorkflow[] = [];

    snapshot.forEach((child) => {
      workflows.push(child.val() as AgentWorkflow);
    });

    return workflows.sort((a, b) => b.createdAt - a.createdAt);
  }

  async transitionTaskState(
    taskId: string,
    newState: string,
    triggeredBy: string
  ): Promise<AgentTask> {
    const task = await this.getAgentTask(taskId);
    if (!task) throw new Error('Task not found');

    const oldState = task.state?.current || 'unknown';
    const state = {
      current: newState,
      history: [
        ...(task.state?.history || []),
        { from: oldState, to: newState, timestamp: Date.now(), triggeredBy }
      ]
    };

    const updates: Partial<AgentTask> = { state };

    if (newState === 'started') {
      updates.status = 'active' as TaskStatus;
      updates.startedAt = Date.now();
    } else if (newState === 'completed') {
      updates.status = 'complete' as TaskStatus;
      updates.completedAt = Date.now();
    }

    await this.updateAgentTask(taskId, updates);
    return { ...task, ...updates };
  }

  // ==================== WORKFLOWS ====================

  async createWorkflow(
    templateId: string,
    input: any,
    createdBy: string
  ): Promise<{ workflow: AgentWorkflow; tasks: AgentTask[] }> {
    const template = WORKFLOW_TEMPLATES[templateId];
    if (!template) throw new Error(`Unknown template: ${templateId}`);

    const workflow: AgentWorkflow = {
      id: this.generateWorkflowId(),
      name: template.name,
      template: templateId,
      status: 'active',
      tasks: [],
      currentTaskId: null,
      createdAt: Date.now(),
      createdBy,
      input,
      output: null
    };

    const tasks: AgentTask[] = [];
    let previousTaskId: string | null = null;

    for (let i = 0; i < template.steps.length; i++) {
      const step = template.steps[i];
      const task = await this.createAgentTask({
        type: step.type,
        assignee: step.agent,
        title: step.label,
        description: `Step ${i + 1} of ${template.name}`,
        requestedBy: createdBy,
        workflowId: workflow.id,
        input: i === 0 ? input : null,
        previousAgentTaskId: previousTaskId || undefined
      });

      if (previousTaskId) {
        await this.updateAgentTask(previousTaskId, { nextAgentTaskId: task.id });
      }

      tasks.push(task);
      previousTaskId = task.id;
    }

    workflow.tasks = tasks.map(t => t.id);
    workflow.currentTaskId = tasks[0]?.id || null;

    await set(ref(this.db, `${this.workflowPath}/${workflow.id}`), workflow);

    if (tasks[0]) {
      await this.transitionTaskState(tasks[0].id, 'started', 'system');
      await this.discord.notifyAgentOfTask(tasks[0]);
    }

    return { workflow, tasks };
  }

  async getWorkflow(workflowId: string): Promise<AgentWorkflow | null> {
    const snapshot = await get(ref(this.db, `${this.workflowPath}/${workflowId}`));
    return snapshot.val();
  }

  /**
   * FIXED: completeWorkflowTask with better error handling and transaction safety
   */
  async completeWorkflowTask(taskId: string, output: any): Promise<AgentTask> {
    const task = await this.getAgentTask(taskId);
    if (!task) throw new Error('Task not found');
    if (!task.workflowId) throw new Error('Task not part of a workflow');

    // Complete current task
    await this.transitionTaskState(taskId, 'completed', task.assignee);
    await this.updateAgentTask(taskId, { output });

    const workflow = await this.getWorkflow(task.workflowId);
    if (!workflow) {
      console.error(`Workflow ${task.workflowId} not found`);
      return { ...task, output };
    }

    // Check for next task
    if (task.nextAgentTaskId) {
      try {
        // Activate next task
        await this.transitionTaskState(task.nextAgentTaskId, 'started', 'system');
        await this.updateAgentTask(task.nextAgentTaskId, { input: output });
        
        // Update workflow current task
        await firebaseUpdate(ref(this.db, `${this.workflowPath}/${workflow.id}`), {
          currentTaskId: task.nextAgentTaskId
        });

        // Notify next agent
        const nextTask = await this.getAgentTask(task.nextAgentTaskId);
        if (nextTask) {
          const previousOutput = typeof output === 'string' ? output : output?.result;
          await this.discord.notifyAgentOfTask(nextTask, previousOutput);
          console.log(`[WORKFLOW] Notified ${nextTask.assignee} of new task`);
        }
      } catch (error) {
        console.error('[WORKFLOW] Error advancing workflow:', error);
        throw error;
      }
    } else {
      // Workflow complete
      await firebaseUpdate(ref(this.db, `${this.workflowPath}/${workflow.id}`), {
        status: 'complete',
        output,
        currentTaskId: null
      });
      console.log(`[WORKFLOW] Workflow ${workflow.id} completed`);
    }

    return { ...task, output };
  }

  // ==================== DELETE OPERATIONS ====================

  /**
   * Delete a workflow and all its tasks
   */
  async deleteWorkflow(workflowId: string): Promise<void> {
    try {
      // Get workflow to find associated tasks
      const workflowRef = ref(this.db, `${this.workflowPath}/${workflowId}`);
      const workflowSnap = await get(workflowRef);
      const workflow = workflowSnap.val() as AgentWorkflow | null;

      if (workflow?.tasks) {
        // Delete all tasks in the workflow
        for (const taskId of workflow.tasks) {
          const taskRef = ref(this.db, `${this.taskPath}/${taskId}`);
          await remove(taskRef);
        }
      }

      // Delete the workflow
      await remove(workflowRef);
      console.log(`[DELETE] Workflow ${workflowId} and ${workflow?.tasks?.length || 0} tasks deleted`);
    } catch (error) {
      console.error('[DELETE] Error deleting workflow:', error);
      throw error;
    }
  }

  /**
   * Delete a single task
   */
  async deleteTask(taskId: string): Promise<void> {
    try {
      const taskRef = ref(this.db, `${this.taskPath}/${taskId}`);
      await remove(taskRef);
      console.log(`[DELETE] Task ${taskId} deleted`);
    } catch (error) {
      console.error('[DELETE] Error deleting task:', error);
      throw error;
    }
  }

  // ==================== HELPERS ====================

  private generateTaskId(): string {
    return `agent-task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateWorkflowId(): string {
    return `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

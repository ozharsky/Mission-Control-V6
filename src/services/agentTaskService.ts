/**
 * Agent Task Service
 * Mission Control V6 - Firebase Operations (Modular API v9+)
 */

import { 
  Database, 
  ref, 
  set, 
  get, 
  update as firebaseUpdate, 
  remove,
  child,
  onValue
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
import { AGENTS, WORKFLOW_TEMPLATES } from '../constants/agents';
import { DiscordNotificationService } from './discordNotificationService';

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
    
    // Build task object, only including defined values
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

    // Only add optional fields if they have values
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

  async deleteAgentTask(taskId: string): Promise<void> {
    await remove(ref(this.db, `${this.basePath}/${taskId}`));
  }

  async listAgentTasks(filters: TaskFilters = {}): Promise<AgentTask[]> {
    const snapshot = await get(ref(this.db, `${this.basePath}`));
    const tasks: AgentTask[] = [];

    snapshot.forEach((child) => {
      const task = child.val() as AgentTask;

      // Apply filters
      if (filters.status && task.status !== filters.status) return;
      if (filters.assignee && task.assignee !== filters.assignee) return;
      if (filters.workflowId && task.workflowId !== filters.workflowId) return;
      if (filters.priority && task.priority !== filters.priority) return;
      if (filters.projectId && task.projectId !== filters.projectId) return;
      if (filters.tags && !filters.tags.every(tag => task.tags?.includes(tag))) return;

      tasks.push(task);
    });

    return tasks.sort((a, b) => b.createdAt - a.createdAt);
  }

  async addActivityEntry(
    taskId: string,
    agent: string,
    action: ActivityEntry['action'],
    message: string,
    data?: any
  ): Promise<void> {
    const entry: ActivityEntry = {
      timestamp: Date.now(),
      agent,
      action,
      message,
      data
    };

    const task = await this.getAgentTask(taskId);
    if (!task) throw new Error('Task not found');

    const activityLog = [...(task.activityLog || []), entry];
    await this.updateAgentTask(taskId, { activityLog });
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

    await this.addActivityEntry(
      taskId,
      triggeredBy,
      'state_change',
      `State changed from ${oldState} to ${newState}`,
      { from: oldState, to: newState }
    );

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

    // Create tasks for each step
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
        // Update previous task's next pointer
        await this.updateAgentTask(previousTaskId, { nextAgentTaskId: task.id });
      }

      tasks.push(task);
      previousTaskId = task.id;
    }

    workflow.tasks = tasks.map(t => t.id);
    workflow.currentTaskId = tasks[0]?.id || null;

    // Save workflow
    await set(ref(this.db, `${this.workflowPath}/${workflow.id}`), workflow);

    // Activate first task
    if (tasks[0]) {
      await this.transitionTaskState(tasks[0].id, 'started', 'system');
      
      // Notify first agent via Discord
      await this.discord.notifyAgentOfTask(tasks[0]);
      
      // Notify coordination channel
      await this.discord.notifyWorkflowStarted(
        workflow.name,
        tasks[0].assignee,
        input?.topic || 'New workflow'
      );
    }

    return { workflow, tasks };
  }

  async getWorkflow(workflowId: string): Promise<AgentWorkflow | null> {
    const snapshot = await get(ref(this.db, `${this.workflowPath}/${workflowId}`));
    return snapshot.val();
  }

  async updateWorkflow(workflowId: string, updates: Partial<AgentWorkflow>): Promise<void> {
    await firebaseUpdate(ref(this.db, `${this.workflowPath}/${workflowId}`), updates);
  }

  async completeWorkflowTask(taskId: string, output: any): Promise<AgentTask> {
    const task = await this.getAgentTask(taskId);
    if (!task) throw new Error('Task not found');

    // Complete current task
    await this.transitionTaskState(taskId, 'completed', task.assignee);
    await this.updateAgentTask(taskId, { output });

    const workflow = await this.getWorkflow(task.workflowId || '');
    if (!workflow) return { ...task, output };

    // Check if there's a next task
    if (task.nextAgentTaskId) {
      // Activate next task
      await this.transitionTaskState(task.nextAgentTaskId, 'started', 'system');
      await this.updateAgentTask(task.nextAgentTaskId, { input: output });
      await this.updateWorkflow(workflow.id, { currentTaskId: task.nextAgentTaskId });

      // Notify next agent
      const nextTask = await this.getAgentTask(task.nextAgentTaskId);
      if (nextTask) {
        await this.notifyAgent(nextTask.assignee, nextTask);
      }
    } else {
      // Workflow complete
      await this.updateWorkflow(workflow.id, { status: 'complete', output });
    }

    return { ...task, output };
  }

  // ==================== DISCORD INTEGRATION ====================

  async notifyAgent(agentId: AgentId, task: AgentTask): Promise<void> {
    const agentEmoji = AGENT_EMOJIS[agentId];
    const agentName = AGENT_NAMES[agentId];
    const channelId = AGENT_CHANNELS[agentId];
    
    if (!channelId) {
      console.error(`No channel configured for agent: ${agentId}`);
      return;
    }

    // Queue notification for Discord
    const notification = {
      id: `discord-notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      channelId,
      message: `<@${AGENT_DISCORD_IDS[agentId]}> ${agentEmoji} **New Task for ${agentName}**\n\n` +
        `**${task.title}**\n` +
        (task.input?.topic ? `Prompt: "${task.input.topic}"\n` : '') +
        `\nPriority: ${task.priority} | Status: ${task.status}\n` +
        `Task ID: \`${task.id}\`\n\n` +
        `Type your response to complete this task.`,
      referenceId: task.id,
      status: 'pending',
      createdAt: Date.now()
    };

    await set(ref(this.db, `v6/discordNotifications/${notification.id}`), notification);
    console.log(`[NOTIFY QUEUED] ${agentId}: ${task.title}`);
  }

  async linkDiscordThread(taskId: string, threadId: string, channelId: string): Promise<void> {
    await this.updateAgentTask(taskId, {
      discordThreadId: threadId,
      discordChannelId: channelId
    });
  }

  // ==================== STATS ====================

  async getAgentStats(agentId: AgentId, days = 7): Promise<AgentStats> {
    const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
    const tasks = await this.listAgentTasks({ assignee: agentId });

    const recentTasks = tasks.filter(t => t.createdAt >= cutoff);
    const completedTasks = recentTasks.filter(t => t.status === 'complete');

    const totalDuration = completedTasks.reduce((sum, t) => {
      if (t.startedAt && t.completedAt) {
        return sum + (t.completedAt - t.startedAt);
      }
      return sum;
    }, 0);

    return {
      agent: agentId,
      totalTasks: recentTasks.length,
      completedTasks: completedTasks.length,
      pendingTasks: recentTasks.filter(t => t.status === 'pending').length,
      activeTasks: recentTasks.filter(t => t.status === 'active').length,
      averageDuration: completedTasks.length > 0 ? totalDuration / completedTasks.length / 60000 : 0,
      lastActive: recentTasks.length > 0 ? Math.max(...recentTasks.map(t => t.updatedAt || t.createdAt)) : null
    };
  }

  async getDashboardStats(): Promise<DashboardStats> {
    const tasks = await this.listAgentTasks();

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const byAgent = Object.values(AGENTS).reduce((acc, agent) => {
      acc[agent] = tasks.filter(t => t.assignee === agent).length;
      return acc;
    }, {} as Record<AgentId, number>);

    return {
      totalTasks: tasks.length,
      activeTasks: tasks.filter(t => t.status === 'active').length,
      pendingTasks: tasks.filter(t => t.status === 'pending').length,
      completedToday: tasks.filter(t => t.status === 'complete' && (t.completedAt || 0) >= todayTimestamp).length,
      byAgent,
      byType: {} // TODO: Group by type
    };
  }

  // ==================== HELPERS ====================

  private generateTaskId(): string {
    return `agent-task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateWorkflowId(): string {
    return `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

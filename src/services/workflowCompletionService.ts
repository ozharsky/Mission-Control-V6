/**
 * Workflow Completion Service
 * Compiles agent outputs into final documents
 */

import { Database, ref, set, get } from 'firebase/database';
import type { AgentTask, AgentWorkflow, CompiledDocument, DocumentSection } from '../types/agentTask';

export class WorkflowCompletionService {
  private db: Database;
  private documentPath = 'v6/agentDocuments';
  private taskPath = 'v6/agentTasks';
  private workflowPath = 'v6/agentWorkflows';

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Compile all agent outputs from a workflow into a final document
   */
  async compileWorkflowDocument(workflowId: string): Promise<CompiledDocument | null> {
    try {
      // Get workflow
      const workflowRef = ref(this.db, `${this.workflowPath}/${workflowId}`);
      const workflowSnap = await get(workflowRef);
      const workflow = workflowSnap.val() as AgentWorkflow | null;

      if (!workflow) {
        return null;
      }

      // Get all tasks for this workflow
      const tasks: AgentTask[] = [];
      for (const taskId of workflow.tasks || []) {
        const taskRef = ref(this.db, `${this.taskPath}/${taskId}`);
        const taskSnap = await get(taskRef);
        if (taskSnap.exists()) {
          tasks.push(taskSnap.val() as AgentTask);
        }
      }

      // Sort tasks by creation time
      tasks.sort((a, b) => a.createdAt - b.createdAt);

      // Build sections from completed tasks
      const sections: DocumentSection[] = [];
      let fullContent = `# ${workflow.name}\n\n`;
      fullContent += `**Workflow ID:** ${workflowId}\n`;
      fullContent += `**Created:** ${new Date(workflow.createdAt).toLocaleString()}\n`;
      fullContent += `**Status:** ${workflow.status}\n\n`;
      fullContent += `---\n\n`;

      for (const task of tasks) {
        if (task.output?.content) {
          const section: DocumentSection = {
            agent: task.assignee,
            agentName: this.getAgentName(task.assignee),
            step: task.title,
            content: task.output.content,
            timestamp: task.completedAt || task.updatedAt
          };
          sections.push(section);

          fullContent += `## ${task.title}\n`;
          fullContent += `**Agent:** ${section.agentName}\n`;
          fullContent += `**Status:** ${task.status}\n\n`;
          fullContent += `${task.output.content}\n\n`;
          fullContent += `---\n\n`;
        }
      }

      // Create document
      const document: CompiledDocument = {
        id: `doc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        workflowId,
        name: `${workflow.name} - Final Document`,
        type: workflow.type,
        content: fullContent,
        sections,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        tags: [workflow.type, 'compiled', 'final']
      };

      // Save to Firebase
      const docRef = ref(this.db, `${this.documentPath}/${document.id}`);
      await set(docRef, document);

      return document;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get all compiled documents
   */
  async listDocuments(): Promise<CompiledDocument[]> {
    const snapshot = await get(ref(this.db, this.documentPath));
    const documents: CompiledDocument[] = [];
    snapshot.forEach((child) => {
      documents.push(child.val() as CompiledDocument);
    });
    return documents.sort((a, b) => b.createdAt - a.createdAt);
  }

  /**
   * Get a single document
   */
  async getDocument(documentId: string): Promise<CompiledDocument | null> {
    const snapshot = await get(ref(this.db, `${this.documentPath}/${documentId}`));
    return snapshot.val() as CompiledDocument | null;
  }

  /**
   * Delete a document
   */
  async deleteDocument(documentId: string): Promise<void> {
    await set(ref(this.db, `${this.documentPath}/${documentId}`), null);
  }

  private getAgentName(agentId: string): string {
    const names: Record<string, string> = {
      planner: 'Strategist',
      ideator: 'Inventor',
      critic: 'Analyst',
      scout: 'Scout',
      coder: 'Architect',
      writer: 'Wordsmith',
      reviewer: 'Editor',
      surveyor: 'Researcher'
    };
    return names[agentId] || agentId;
  }
}

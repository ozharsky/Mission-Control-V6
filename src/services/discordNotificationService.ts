/**
 * Discord Notification Service
 * Mission Control V6
 * 
 * Queues notifications in Firebase for background processing
 */

import { Database, ref, set } from 'firebase/database';
import { AgentTask, AgentId } from '../types/agentTask';
import { AGENT_NAMES, AGENT_EMOJIS } from '../constants/agents';

// Discord channel IDs for each agent
const AGENT_CHANNELS: Record<AgentId, string> = {
  planner: '1478488078870909088',      // #🎯-strategist
  ideator: '1478488081186291928',      // #💡-inventor
  critic: '1478488084386418689',       // #🔬-analyst
  scout: '1478488086672441536',        // #📡-scout
  coder: '1478488318927700091',        // #💻-architect
  writer: '1478488320454557727',       // #✍️-wordsmith
  reviewer: '1478488321914310758',     // #🔍-editor
  surveyor: '1478488543692194045'      // #📚-researcher
};

const COORDINATION_CHANNEL = '1478488567020785867'; // #🎯-agent-coordination

export class DiscordNotificationService {
  private db: Database;

  constructor(firebaseDb: Database) {
    this.db = firebaseDb;
  }

  /**
   * Queue notification for agent's Discord channel
   */
  async notifyAgentOfTask(task: AgentTask): Promise<void> {
    const channelId = AGENT_CHANNELS[task.assignee];
    if (!channelId) {
      console.error(`No channel configured for agent: ${task.assignee}`);
      return;
    }

    const agentName = AGENT_NAMES[task.assignee];
    const agentEmoji = AGENT_EMOJIS[task.assignee];
    
    // Post without mention - bot will auto-respond in its channel (requireMention: false)
    const message = `${agentEmoji} **New Task for ${agentName}**\n\n` +
      `**${task.title}**\n` +
      (task.input?.topic ? `Prompt: "${task.input.topic}"\n` : '') +
      `\nPriority: ${this.getPriorityEmoji(task.priority)} ${task.priority} | Status: ${task.status}\n` +
      `Task ID: \`${task.id}\`\n\n` +
      `Type your response to complete this task.`;

    await this.queueNotification(channelId, message, task.id);
  }

  /**
   * Queue notification to coordination channel
   */
  async notifyWorkflowStarted(workflowName: string, firstAgent: AgentId, input: any): Promise<void> {
    const topic = typeof input === 'string' ? input : input?.topic || 'New workflow';
    
    const message = `🚀 **Workflow Started: ${workflowName}**\n\n` +
      `Input: "${topic}"\n` +
      `First Agent: ${AGENT_EMOJIS[firstAgent]} ${AGENT_NAMES[firstAgent]}`;

    await this.queueNotification(COORDINATION_CHANNEL, message, `workflow-${Date.now()}`);
  }

  /**
   * Queue notification for task handoff
   */
  async notifyTaskHandoff(
    completedTask: AgentTask, 
    nextAgent: AgentId
  ): Promise<void> {
    const message = `✅ **Task Completed** → ${AGENT_EMOJIS[nextAgent]} **${AGENT_NAMES[nextAgent]}**\n\n` +
      `"${completedTask.title}" completed by ${AGENT_NAMES[completedTask.assignee]}`;

    await this.queueNotification(COORDINATION_CHANNEL, message, completedTask.id);
  }

  /**
   * Queue notification in Firebase for background worker
   */
  private async queueNotification(channelId: string, message: string, referenceId: string): Promise<void> {
    const notification = {
      id: `discord-notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      channelId,
      message,
      referenceId,
      status: 'pending',
      createdAt: Date.now()
    };

    try {
      await set(ref(this.db, `v6/discordNotifications/${notification.id}`), notification);
      console.log(`[DISCORD QUEUED → ${channelId}]: ${message.substring(0, 100)}...`);
    } catch (error) {
      console.error('Failed to queue Discord notification:', error);
      console.log(`[DISCORD FAILED → ${channelId}]: ${message}`);
    }
  }

  private getPriorityEmoji(priority: string): string {
    switch (priority) {
      case 'urgent': return '🔴';
      case 'high': return '🟠';
      case 'medium': return '🟡';
      case 'low': return '🟢';
      default: return '⚪';
    }
  }
}

export default DiscordNotificationService;

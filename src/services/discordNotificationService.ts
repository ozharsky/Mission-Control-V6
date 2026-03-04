/**
 * Discord Notification Service
 * Mission Control V6
 */

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
  private webhookUrl: string | null = null;

  constructor() {
    // Could load from env/config
    this.webhookUrl = null;
  }

  /**
   * Send task notification to agent's Discord channel
   */
  async notifyAgentOfTask(task: AgentTask): Promise<void> {
    const channelId = AGENT_CHANNELS[task.assignee];
    if (!channelId) {
      console.error(`No channel configured for agent: ${task.assignee}`);
      return;
    }

    const agentName = AGENT_NAMES[task.assignee];
    const agentEmoji = AGENT_EMOJIS[task.assignee];

    const message = {
      content: `${agentEmoji} **New Task for ${agentName}**`,
      embeds: [{
        title: task.title,
        description: task.input?.topic 
          ? `**Prompt:** "${task.input.topic}"`
          : task.description,
        color: this.getPriorityColor(task.priority),
        fields: [
          {
            name: 'Task ID',
            value: task.id,
            inline: true
          },
          {
            name: 'Priority',
            value: `${this.getPriorityEmoji(task.priority)} ${task.priority}`,
            inline: true
          },
          {
            name: 'Status',
            value: task.status,
            inline: true
          }
        ],
        footer: {
          text: `Click to view in Mission Control • ${new Date(task.createdAt).toLocaleString()}`
        }
      }]
    };

    await this.sendToChannel(channelId, message);
  }

  /**
   * Notify coordination channel of workflow start
   */
  async notifyWorkflowStarted(workflowName: string, firstAgent: AgentId, input: string): Promise<void> {
    const message = {
      content: `🚀 **Workflow Started: ${workflowName}**`,
      embeds: [{
        description: `**Input:** "${input}"`,
        color: 0x3b82f6, // Blue
        fields: [
          {
            name: 'First Agent',
            value: `${AGENT_EMOJIS[firstAgent]} ${AGENT_NAMES[firstAgent]}`,
            inline: true
          }
        ],
        timestamp: new Date().toISOString()
      }]
    };

    await this.sendToChannel(COORDINATION_CHANNEL, message);
  }

  /**
   * Notify that task was completed and handed off
   */
  async notifyTaskHandoff(
    completedTask: AgentTask, 
    nextAgent: AgentId
  ): Promise<void> {
    const message = {
      content: `✅ **Task Completed** → ${AGENT_EMOJIS[nextAgent]} **${AGENT_NAMES[nextAgent]}**`,
      embeds: [{
        title: completedTask.title,
        description: `Completed by ${AGENT_NAMES[completedTask.assignee]}`,
        color: 0x22c55e, // Green
        timestamp: new Date().toISOString()
      }]
    };

    await this.sendToChannel(COORDINATION_CHANNEL, message);
    
    // Also notify the next agent directly
    // This would require fetching the next task
  }

  /**
   * Send message to Discord channel via OpenClaw
   */
  private async sendToChannel(channelId: string, message: any): Promise<void> {
    try {
      // Use OpenClaw's message tool via the gateway
      const response = await fetch('/api/discord/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelId,
          ...message
        })
      });

      if (!response.ok) {
        console.error('Failed to send Discord notification:', await response.text());
      }
    } catch (error) {
      console.error('Discord notification error:', error);
    }
  }

  private getPriorityColor(priority: string): number {
    switch (priority) {
      case 'urgent': return 0xef4444; // Red
      case 'high': return 0xf97316;   // Orange
      case 'medium': return 0xeab308; // Yellow
      case 'low': return 0x22c55e;    // Green
      default: return 0x6b7280;       // Gray
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

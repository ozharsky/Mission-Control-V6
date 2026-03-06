/**
 * Agent Activity Logger
 * Mission Control V6
 * 
 * Logs all agent actions to Firebase for auditing, analytics, and cost tracking
 */

import { Database, ref, push, set, get, query, orderByChild, limitToLast } from 'firebase/database';

export interface ActivityLogEntry {
  id?: string;
  timestamp: number;
  agentId: string;
  agentName: string;
  action: string;
  category: 'task' | 'decision' | 'api_call' | 'file_upload' | 'notification' | 'error' | 'workflow';
  description: string;
  metadata?: {
    taskId?: string;
    projectId?: string;
    workflowId?: string;
    tokensUsed?: number;
    costEstimate?: number;
    duration?: number; // milliseconds
    success?: boolean;
    errorMessage?: string;
    [key: string]: any;
  };
  discordChannelId?: string;
  discordThreadId?: string;
}

export interface AgentMetrics {
  agentId: string;
  totalActions: number;
  actionsByCategory: Record<string, number>;
  totalTokensUsed: number;
  totalCostEstimate: number;
  averageTaskDuration: number;
  successRate: number;
  lastActive: number;
}

export interface DailyStats {
  date: string;
  totalActions: number;
  actionsByAgent: Record<string, number>;
  actionsByCategory: Record<string, number>;
  totalTokensUsed: number;
  totalCostEstimate: number;
  errors: number;
}

class AgentActivityLogger {
  private db: Database;
  private logsPath = 'v6/agentActivity/logs';
  private metricsPath = 'v6/agentActivity/metrics';
  private dailyStatsPath = 'v6/agentActivity/dailyStats';

  constructor(firebaseDb: Database) {
    this.db = firebaseDb;
  }

  /**
   * Log an agent activity
   */
  async logActivity(entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>): Promise<string> {
    const logRef = push(ref(this.db, this.logsPath));
    const logEntry: ActivityLogEntry = {
      ...entry,
      id: logRef.key!,
      timestamp: Date.now(),
    };

    await set(logRef, logEntry);
    await this.updateMetrics(entry.agentId, entry);
    await this.updateDailyStats(entry);

    return logRef.key!;
  }

  /**
   * Quick log methods for common actions
   */
  async logTaskStart(agentId: string, agentName: string, taskId: string, description: string, metadata?: any) {
    return this.logActivity({
      agentId,
      agentName,
      action: 'task_start',
      category: 'task',
      description,
      metadata: { taskId, ...metadata },
    });
  }

  async logTaskComplete(agentId: string, agentName: string, taskId: string, description: string, duration: number, metadata?: any) {
    return this.logActivity({
      agentId,
      agentName,
      action: 'task_complete',
      category: 'task',
      description,
      metadata: { taskId, duration, success: true, ...metadata },
    });
  }

  async logTaskError(agentId: string, agentName: string, taskId: string, error: string, metadata?: any) {
    return this.logActivity({
      agentId,
      agentName,
      action: 'task_error',
      category: 'error',
      description: error,
      metadata: { taskId, success: false, errorMessage: error, ...metadata },
    });
  }

  async logAPICall(agentId: string, agentName: string, apiName: string, tokensUsed: number, costEstimate: number, metadata?: any) {
    return this.logActivity({
      agentId,
      agentName,
      action: 'api_call',
      category: 'api_call',
      description: `Called ${apiName}`,
      metadata: { tokensUsed, costEstimate, apiName, ...metadata },
    });
  }

  async logDecision(agentId: string, agentName: string, decision: string, context: string, metadata?: any) {
    return this.logActivity({
      agentId,
      agentName,
      action: 'decision',
      category: 'decision',
      description: decision,
      metadata: { context, ...metadata },
    });
  }

  async logFileUpload(agentId: string, agentName: string, fileName: string, fileId: string, metadata?: any) {
    return this.logActivity({
      agentId,
      agentName,
      action: 'file_upload',
      category: 'file_upload',
      description: `Uploaded ${fileName}`,
      metadata: { fileId, fileName, ...metadata },
    });
  }

  async logNotification(agentId: string, agentName: string, channelId: string, message: string, metadata?: any) {
    return this.logActivity({
      agentId,
      agentName,
      action: 'notification_sent',
      category: 'notification',
      description: message,
      discordChannelId: channelId,
      metadata,
    });
  }

  /**
   * Update agent metrics
   */
  private async updateMetrics(agentId: string, entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) {
    const metricsRef = ref(this.db, `${this.metricsPath}/${agentId}`);
    const snapshot = await get(metricsRef);
    const current: AgentMetrics = snapshot.val() || {
      agentId,
      totalActions: 0,
      actionsByCategory: {},
      totalTokensUsed: 0,
      totalCostEstimate: 0,
      averageTaskDuration: 0,
      successRate: 100,
      lastActive: Date.now(),
    };

    current.totalActions++;
    current.actionsByCategory[entry.category] = (current.actionsByCategory[entry.category] || 0) + 1;
    current.lastActive = Date.now();

    if (entry.metadata?.tokensUsed) {
      current.totalTokensUsed += entry.metadata.tokensUsed;
    }
    if (entry.metadata?.costEstimate) {
      current.totalCostEstimate += entry.metadata.costEstimate;
    }

    // Update success rate
    if (entry.metadata?.success !== undefined) {
      const totalTasks = current.totalActions;
      const successfulTasks = Object.values(current.actionsByCategory).reduce((a, b) => a + b, 0);
      current.successRate = Math.round((successfulTasks / totalTasks) * 100);
    }

    await set(metricsRef, current);
  }

  /**
   * Update daily stats
   */
  private async updateDailyStats(entry: Omit<ActivityLogEntry, 'id' | 'timestamp'>) {
    const date = new Date().toISOString().split('T')[0];
    const statsRef = ref(this.db, `${this.dailyStatsPath}/${date}`);
    const snapshot = await get(statsRef);
    const current: DailyStats = snapshot.val() || {
      date,
      totalActions: 0,
      actionsByAgent: {},
      actionsByCategory: {},
      totalTokensUsed: 0,
      totalCostEstimate: 0,
      errors: 0,
    };

    current.totalActions++;
    current.actionsByAgent[entry.agentId] = (current.actionsByAgent[entry.agentId] || 0) + 1;
    current.actionsByCategory[entry.category] = (current.actionsByCategory[entry.category] || 0) + 1;

    if (entry.metadata?.tokensUsed) {
      current.totalTokensUsed += entry.metadata.tokensUsed;
    }
    if (entry.metadata?.costEstimate) {
      current.totalCostEstimate += entry.metadata.costEstimate;
    }
    if (entry.category === 'error' || entry.metadata?.success === false) {
      current.errors++;
    }

    await set(statsRef, current);
  }

  /**
   * Get recent activity logs
   */
  async getRecentLogs(limit: number = 50): Promise<ActivityLogEntry[]> {
    const logsQuery = query(
      ref(this.db, this.logsPath),
      orderByChild('timestamp'),
      limitToLast(limit)
    );
    const snapshot = await get(logsQuery);
    const logs = snapshot.val() || {};
    return Object.values(logs).sort((a: any, b: any) => b.timestamp - a.timestamp);
  }

  /**
   * Get agent metrics
   */
  async getAgentMetrics(agentId: string): Promise<AgentMetrics | null> {
    const snapshot = await get(ref(this.db, `${this.metricsPath}/${agentId}`));
    return snapshot.val();
  }

  /**
   * Get all agent metrics
   */
  async getAllMetrics(): Promise<AgentMetrics[]> {
    const snapshot = await get(ref(this.db, this.metricsPath));
    const metrics = snapshot.val() || {};
    return Object.values(metrics);
  }

  /**
   * Get daily stats for a date range
   */
  async getDailyStats(startDate: string, endDate: string): Promise<DailyStats[]> {
    const snapshot = await get(ref(this.db, this.dailyStatsPath));
    const allStats = snapshot.val() || {};
    return Object.values(allStats).filter((stat: any) => 
      stat.date >= startDate && stat.date <= endDate
    );
  }

  /**
   * Get today's stats
   */
  async getTodayStats(): Promise<DailyStats | null> {
    const date = new Date().toISOString().split('T')[0];
    const snapshot = await get(ref(this.db, `${this.dailyStatsPath}/${date}`));
    return snapshot.val();
  }
}

// Singleton instance
let loggerInstance: AgentActivityLogger | null = null;

export function initActivityLogger(db: Database): AgentActivityLogger {
  if (!loggerInstance) {
    loggerInstance = new AgentActivityLogger(db);
  }
  return loggerInstance;
}

export function getActivityLogger(): AgentActivityLogger | null {
  return loggerInstance;
}

export { AgentActivityLogger };
export type { ActivityLogEntry, AgentMetrics, DailyStats };

/**
 * Simple Agent Logger
 * Drop-in logging for agents without Firebase setup
 * 
 * Usage:
 *   import { logActivity } from './simpleAgentLogger';
 *   await logActivity('task_start', 'Building feature X');
 */

const API_KEY = process.env.AGENT_API_KEY || '';
const MC_URL = process.env.MC_API_URL || 'https://mission-control-v6-kappa.vercel.app/api';
const AGENT_ID = process.env.AGENT_ID || 'unknown';

interface LogEntry {
  timestamp: number;
  agentId: string;
  action: string;
  category: string;
  description: string;
  metadata?: any;
}

/**
 * Log an activity to Mission Control
 */
export async function logActivity(
  action: string,
  description: string,
  category: string = 'task',
  metadata?: any
): Promise<boolean> {
  try {
    const entry: LogEntry = {
      timestamp: Date.now(),
      agentId: AGENT_ID,
      action,
      category,
      description,
      metadata,
    };

    const response = await fetch(`${MC_URL}/log-activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(entry),
    });

    return response.ok;
  } catch (error) {
    console.error('Failed to log activity:', error);
    return false;
  }
}

/**
 * Quick log methods
 */
export const logTaskStart = (description: string, metadata?: any) =>
  logActivity('task_start', description, 'task', metadata);

export const logTaskComplete = (description: string, duration?: number, metadata?: any) =>
  logActivity('task_complete', description, 'task', { duration, success: true, ...metadata });

export const logTaskError = (description: string, error: string, metadata?: any) =>
  logActivity('task_error', description, 'error', { error, success: false, ...metadata });

export const logAPICall = (api: string, tokens: number, cost: number, metadata?: any) =>
  logActivity('api_call', `Called ${api}`, 'api_call', { tokensUsed: tokens, costEstimate: cost, ...metadata });

export const logDecision = (decision: string, context: string, metadata?: any) =>
  logActivity('decision', decision, 'decision', { context, ...metadata });

export const logFileUpload = (fileName: string, fileId: string, metadata?: any) =>
  logActivity('file_upload', `Uploaded ${fileName}`, 'file_upload', { fileId, fileName, ...metadata });

export const logNotification = (channel: string, message: string, metadata?: any) =>
  logActivity('notification', message, 'notification', { channel, ...metadata });

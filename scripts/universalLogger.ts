/**
 * Universal Agent Logger
 * Works from any context - OpenClaw, scripts, or Mission Control
 */

const DEFAULT_API_KEY = process.env.AGENT_API_KEY || '';
const DEFAULT_API_URL = process.env.MC_API_URL || 'https://mission-control-v6-kappa.vercel.app/api';

interface LogOptions {
  agentId: string;
  action: string;
  category?: 'task' | 'decision' | 'api_call' | 'file_upload' | 'notification' | 'error';
  description: string;
  metadata?: any;
  apiKey?: string;
  apiUrl?: string;
}

/**
 * Universal log function - works from anywhere
 */
export async function log(options: LogOptions): Promise<boolean> {
  const {
    agentId,
    action,
    category = 'task',
    description,
    metadata = {},
    apiKey = DEFAULT_API_KEY,
    apiUrl = DEFAULT_API_URL,
  } = options;

  try {
    const response = await fetch(`${apiUrl}/log-activity`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        timestamp: Date.now(),
        agentId,
        action,
        category,
        description,
        metadata,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Log failed:', error);
      return false;
    }

    const result = await response.json();
    console.log('✅ Logged:', result.id);
    return true;

  } catch (error) {
    console.error('Log error:', error);
    return false;
  }
}

// Quick helpers
export const logTask = (agentId: string, task: string, metadata?: any) =>
  log({ agentId, action: 'task', description: task, metadata });

export const logDecision = (agentId: string, decision: string, context?: string) =>
  log({ agentId, action: 'decision', category: 'decision', description: decision, metadata: { context } });

export const logAPICall = (agentId: string, api: string, tokens: number, cost: number) =>
  log({ agentId, action: 'api_call', category: 'api_call', description: `Called ${api}`, metadata: { tokens, cost } });

export const logError = (agentId: string, error: string) =>
  log({ agentId, action: 'error', category: 'error', description: error });

export const logFile = (agentId: string, fileName: string) =>
  log({ agentId, action: 'file_upload', category: 'file_upload', description: `Uploaded ${fileName}` });

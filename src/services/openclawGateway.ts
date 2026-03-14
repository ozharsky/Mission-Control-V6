/**
 * OpenClaw Gateway Service
 * Connects Mission Control to OpenClaw WebSocket gateway
 */

const GATEWAY_URL = import.meta.env.VITE_OPENCLAW_GATEWAY || 'ws://127.0.0.1:18789';
const GATEWAY_TOKEN = import.meta.env.VITE_OPENCLAW_TOKEN || '';

class OpenClawGatewayService {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private listeners: Map<string, ((data: any) => void)[]> = new Map();

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      this.ws = new WebSocket(`${GATEWAY_URL}?token=${GATEWAY_TOKEN}`);

      this.ws.onopen = () => {
        console.log('✅ Connected to OpenClaw gateway');
        this.emit('connected', { timestamp: Date.now() });
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit(data.type || 'message', data);
        } catch (e) {
          console.error('Failed to parse gateway message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('⚠️ OpenClaw gateway disconnected');
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('OpenClaw gateway error:', error);
      };
    } catch (e) {
      console.error('Failed to connect to gateway:', e);
      this.scheduleReconnect();
    }
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }

  // Send command to an agent
  async sendAgentCommand(agentId: string, command: string, context?: any) {
    if (this.ws?.readyState !== WebSocket.OPEN) {
      throw new Error('Gateway not connected');
    }

    this.ws.send(JSON.stringify({
      type: 'agent_command',
      agentId,
      command,
      context,
      timestamp: Date.now()
    }));
  }

  // Subscribe to events
  on(event: string, callback: (data: any) => void) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.listeners.get(event);
      if (callbacks) {
        const idx = callbacks.indexOf(callback);
        if (idx > -1) callbacks.splice(idx, 1);
      }
    };
  }

  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    callbacks?.forEach(cb => {
      try { cb(data); } catch (e) { console.error(e); }
    });
  }

  // Request agent status
  async getAgentStatus() {
    if (this.ws?.readyState !== WebSocket.OPEN) return null;

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
      
      const unsub = this.on('agent_status', (data) => {
        clearTimeout(timeout);
        unsub();
        resolve(data);
      });

      this.ws!.send(JSON.stringify({ type: 'get_agent_status' }));
    });
  }
}

export const openClawGateway = new OpenClawGatewayService();

// Hook for React components
import { useEffect, useState } from 'react';

export function useOpenClawGateway() {
  const [connected, setConnected] = useState(false);
  const [agentActivity, setAgentActivity] = useState<any[]>([]);

  useEffect(() => {
    openClawGateway.connect();

    const unsubConnected = openClawGateway.on('connected', () => setConnected(true));
    const unsubActivity = openClawGateway.on('agent_activity', (data) => {
      setAgentActivity(prev => [data, ...prev].slice(0, 50));
    });

    return () => {
      unsubConnected();
      unsubActivity();
    };
  }, []);

  return {
    connected,
    agentActivity,
    sendCommand: openClawGateway.sendAgentCommand.bind(openClawGateway)
  };
}

import { useOpenClawGateway } from '../services/openclawGateway';
import { Activity, Radio, Bot, Send } from 'lucide-react';
import { useState } from 'react';

const AGENTS = [
  { id: 'planner', name: 'Planner', color: 'text-blue-400' },
  { id: 'ideator', name: 'Ideator', color: 'text-purple-400' },
  { id: 'critic', name: 'Critic', color: 'text-red-400' },
  { id: 'scout', name: 'Scout', color: 'text-green-400' },
  { id: 'coder', name: 'Coder', color: 'text-cyan-400' },
  { id: 'writer', name: 'Writer', color: 'text-pink-400' },
  { id: 'reviewer', name: 'Reviewer', color: 'text-amber-400' },
  { id: 'surveyor', name: 'Surveyor', color: 'text-gray-400' }
];

export function OpenClawLivePanel() {
  const { connected, agentActivity, sendCommand } = useOpenClawGateway();
  const [selectedAgent, setSelectedAgent] = useState('coder');
  const [command, setCommand] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!command.trim()) return;
    setSending(true);
    try {
      await sendCommand(selectedAgent, command);
      setCommand('');
    } catch (e) {
      console.error('Failed to send command:', e);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded-xl border border-surface-hover bg-surface p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-white">OpenClaw Live</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
          <span className="text-xs text-gray-400">
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Agent Status Grid */}
      <div className="grid grid-cols-4 gap-2">
        {AGENTS.map(agent => (
          <button
            key={agent.id}
            onClick={() => setSelectedAgent(agent.id)}
            className={`p-2 rounded-lg text-center transition-all ${
              selectedAgent === agent.id
                ? 'bg-surface-hover border border-primary/50'
                : 'bg-surface-hover/50 hover:bg-surface-hover'
            }`}
          >
            <Bot className={`h-4 w-4 mx-auto mb-1 ${agent.color}`} />
            <span className="text-xs text-gray-300">{agent.name}</span>
          </button>
        ))}
      </div>

      {/* Command Input */}
      <div className="space-y-2">
        <label className="text-xs text-gray-400">
          Send command to {AGENTS.find(a => a.id === selectedAgent)?.name}
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="e.g., Check kalshi scanner status..."
            className="flex-1 bg-surface-hover border border-surface-hover rounded-lg px-3 py-2 text-sm text-white placeholder:text-gray-500"
          />
          <button
            onClick={handleSend}
            disabled={sending || !connected}
            className="flex items-center gap-1 px-3 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:bg-primary/80 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {sending ? '...' : 'Send'}
          </button>
        </div>
      </div>

      {/* Activity Feed */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Radio className="h-4 w-4 text-gray-400" />
          <span className="text-xs text-gray-400">Recent Activity</span>
        </div>
        <div className="max-h-48 overflow-y-auto space-y-1 scrollbar-hide">
          {agentActivity.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-4">No recent activity</p>
          ) : (
            agentActivity.map((activity, idx) => (
              <div
                key={idx}
                className="flex items-center gap-2 p-2 rounded bg-surface-hover/50 text-sm"
              >
                <span className="text-xs text-gray-500">
                  {new Date(activity.timestamp).toLocaleTimeString()}
                </span>
                <span className={AGENTS.find(a => a.id === activity.agent)?.color || 'text-gray-400'}>
                  {AGENTS.find(a => a.id === activity.agent)?.name || activity.agent}
                </span>
                <span className="text-gray-300 truncate">{activity.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

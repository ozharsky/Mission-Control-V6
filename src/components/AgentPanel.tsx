interface AgentPanelProps {
  agent: {
    status: string;
    currentTask: string;
    lastSeen: string;
    model: string;
  };
}

export function AgentPanel({ agent }: AgentPanelProps) {
  return (
    <div className="rounded-xl border border-surface-hover bg-surface p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">Agent Status</h2>
          <div className="mt-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Status:</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-sm font-medium ${
                agent.status === 'online' 
                  ? 'bg-success-light text-success' 
                  : 'bg-gray-800 text-gray-400'
              }`}>
                <span className={`h-1.5 w-1.5 rounded-full ${agent.status === 'online' ? 'bg-success' : 'bg-gray-500'}`} />
                {agent.status}
              </span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Current Task:</span>
              <span className="text-sm">{agent.currentTask || 'Idle'}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Model:</span>
              <span className="text-sm font-mono">{agent.model}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Last Seen:</span>
              <span className="text-sm">{new Date(agent.lastSeen).toLocaleTimeString()}</span>
            </div>
          </div>
        </div>
        
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-light">
          <span className="text-2xl">🤖</span>
        </div>
      </div>
    </div>
  );
}
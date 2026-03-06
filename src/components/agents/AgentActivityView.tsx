import { useState, useEffect } from 'react';
import { Database } from 'firebase/database';
import { Activity, TrendingUp, AlertCircle, CheckCircle, Clock, DollarSign, Bot } from 'lucide-react';
import { initActivityLogger, ActivityLogEntry, AgentMetrics, DailyStats } from '../../services/agentActivityLogger';
import { AGENT_NAMES, AGENT_EMOJIS } from '../../constants/agents';

interface AgentActivityViewProps {
  firebaseDb: Database;
}

const CATEGORY_COLORS: Record<string, string> = {
  task: 'bg-blue-500/20 text-blue-400',
  decision: 'bg-purple-500/20 text-purple-400',
  api_call: 'bg-orange-500/20 text-orange-400',
  file_upload: 'bg-green-500/20 text-green-400',
  notification: 'bg-cyan-500/20 text-cyan-400',
  error: 'bg-red-500/20 text-red-400',
  workflow: 'bg-indigo-500/20 text-indigo-400',
};

const CATEGORY_ICONS: Record<string, any> = {
  task: CheckCircle,
  decision: Activity,
  api_call: TrendingUp,
  file_upload: Activity,
  notification: Activity,
  error: AlertCircle,
  workflow: Activity,
};

export function AgentActivityView({ firebaseDb }: AgentActivityViewProps) {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [metrics, setMetrics] = useState<AgentMetrics[]>([]);
  const [todayStats, setTodayStats] = useState<DailyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string | 'all'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');

  const logger = initActivityLogger(firebaseDb);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    try {
      const [recentLogs, allMetrics, today] = await Promise.all([
        logger.getRecentLogs(100),
        logger.getAllMetrics(),
        logger.getTodayStats(),
      ]);
      setLogs(recentLogs);
      setMetrics(allMetrics);
      setTodayStats(today);
    } catch (error) {
      console.error('Failed to load activity data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (selectedAgent !== 'all' && log.agentId !== selectedAgent) return false;
    if (selectedCategory !== 'all' && log.category !== selectedCategory) return false;
    return true;
  });

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    return `${Math.round(ms / 60000)}m`;
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-surface-hover bg-surface p-6">
        <div className="flex items-center gap-2">
          <Activity className="h-5 w-5 animate-spin text-primary" />
          <span>Loading activity data...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Agent Activity</h2>
          <p className="text-sm text-gray-400">Track agent actions, decisions, and costs</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-2 rounded-lg border border-surface-hover px-4 py-2 text-sm hover:bg-surface-hover"
        >
          <Clock className="h-4 w-4" />
          Refresh
        </button>
      </div>

      {/* Today's Stats */}
      {todayStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-surface-hover bg-surface p-4">
            <div className="text-2xl font-bold text-primary">{todayStats.totalActions}</div>
            <div className="text-sm text-gray-400">Actions Today</div>
          </div>
          <div className="rounded-xl border border-surface-hover bg-surface p-4">
            <div className="text-2xl font-bold text-orange-400">{todayStats.totalTokensUsed.toLocaleString()}</div>
            <div className="text-sm text-gray-400">Tokens Used</div>
          </div>
          <div className="rounded-xl border border-surface-hover bg-surface p-4">
            <div className="text-2xl font-bold text-green-400">${todayStats.totalCostEstimate.toFixed(2)}</div>
            <div className="text-sm text-gray-400">Est. Cost</div>
          </div>
          <div className="rounded-xl border border-surface-hover bg-surface p-4">
            <div className="text-2xl font-bold text-red-400">{todayStats.errors}</div>
            <div className="text-sm text-gray-400">Errors</div>
          </div>
        </div>
      )}

      {/* Agent Metrics */}
      <div className="rounded-xl border border-surface-hover bg-surface p-6">
        <h3 className="mb-4 text-lg font-semibold">Agent Performance</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.agentId} className="rounded-lg border border-surface-hover bg-background p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">{AGENT_EMOJIS[metric.agentId as keyof typeof AGENT_EMOJIS] || '🤖'}</span>
                <span className="font-medium">{AGENT_NAMES[metric.agentId as keyof typeof AGENT_NAMES] || metric.agentId}</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Actions:</span>
                  <span>{metric.totalActions || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Success Rate:</span>
                  <span className={(metric.successRate || 0) >= 90 ? 'text-green-400' : 'text-yellow-400'}>
                    {metric.successRate || 0}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Tokens:</span>
                  <span>{Number(metric.totalTokensUsed || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Cost:</span>
                  <span>${Number(metric.totalCostEstimate || 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <select
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
          className="rounded-lg border border-surface-hover bg-surface px-4 py-2"
        >
          <option value="all">All Agents</option>
          {metrics.map((m) => (
            <option key={m.agentId} value={m.agentId}>
              {AGENT_NAMES[m.agentId as keyof typeof AGENT_NAMES] || m.agentId}
            </option>
          ))}
        </select>

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="rounded-lg border border-surface-hover bg-surface px-4 py-2"
        >
          <option value="all">All Categories</option>
          <option value="task">Tasks</option>
          <option value="decision">Decisions</option>
          <option value="api_call">API Calls</option>
          <option value="file_upload">File Uploads</option>
          <option value="notification">Notifications</option>
          <option value="error">Errors</option>
        </select>
      </div>

      {/* Activity Log */}
      <div className="rounded-xl border border-surface-hover bg-surface p-6">
        <h3 className="mb-4 text-lg font-semibold">Recent Activity ({filteredLogs.length})</h3>
        <div className="space-y-2 max-h-[600px] overflow-y-auto">
          {filteredLogs.map((log) => {
            const Icon = CATEGORY_ICONS[log.category] || Activity;
            return (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-lg border border-surface-hover bg-background p-3"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${CATEGORY_COLORS[log.category]}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{AGENT_NAMES[log.agentId as keyof typeof AGENT_NAMES] || log.agentId}</span>
                    <span className="text-xs text-gray-400">{formatTime(log.timestamp)}</span>
                    <span className={`rounded px-2 py-0.5 text-xs ${CATEGORY_COLORS[log.category]}`}>
                      {log.category}
                    </span>
                  </div>
                  <p className="text-sm text-gray-300 mt-1">{log.description}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                    {log.metadata?.duration && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDuration(log.metadata.duration)}
                      </span>
                    )}
                    {log.metadata?.tokensUsed && (
                      <span className="flex items-center gap-1">
                        <TrendingUp className="h-3 w-3" />
                        {log.metadata.tokensUsed.toLocaleString()} tokens
                      </span>
                    )}
                    {log.metadata?.costEstimate && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="h-3 w-3" />
                        ${log.metadata.costEstimate.toFixed(3)}
                      </span>
                    )}
                    {log.metadata?.success === false && (
                      <span className="text-red-400">Failed</span>
                    )}
                  </div>                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

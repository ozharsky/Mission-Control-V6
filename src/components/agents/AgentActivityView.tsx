import { useState, useEffect } from 'react';
import { Database } from 'firebase/database';
import { Activity, TrendingUp, AlertCircle, CheckCircle, Clock, DollarSign, Bot } from 'lucide-react';
import { initActivityLogger, ActivityLogEntry, AgentMetrics, DailyStats } from '../../services/agentActivityLogger';
import { AGENT_NAMES, AGENT_EMOJIS, AGENT_EMOJI_FALLBACKS } from '../../constants/agents';

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

const CATEGORY_EMOJIS: Record<string, string> = {
  task: '✅',
  decision: '🤔',
  api_call: '🔌',
  file_upload: '📎',
  notification: '🔔',
  error: '❌',
  workflow: '⚡',
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
        <h3 className="mb-4 text-lg font-semibold flex items-center gap-2">
          🤖 Agent Performance
        </h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div key={metric.agentId} className="rounded-xl border border-surface-hover bg-background p-4 hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3 mb-3">
                <span className="text-4xl">{AGENT_EMOJIS[metric.agentId as keyof typeof AGENT_EMOJIS] || AGENT_EMOJI_FALLBACKS[metric.agentId] || '🤖'}</span>
                <div className="flex-1">
                  <div className="font-semibold">{AGENT_NAMES[metric.agentId as keyof typeof AGENT_NAMES] || metric.agentId}</div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-primary">{metric.totalActions || 0}</div>
                  <div className="text-xs text-gray-400">actions</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-lg bg-surface p-2 text-center">
                  <div className="text-lg font-bold {(metric.successRate || 0) >= 90 ? 'text-green-400' : 'text-yellow-400'}">
                    {metric.successRate || 0}%
                  </div>
                  <div className="text-xs text-gray-400">Success</div>
                </div>
                <div className="rounded-lg bg-surface p-2 text-center">
                  <div className="text-lg font-bold text-orange-400">
                    {Number(metric.totalTokensUsed || 0).toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-400">Tokens</div>
                </div>
                <div className="rounded-lg bg-surface p-2 text-center">
                  <div className="text-lg font-bold text-green-400">
                    ${isNaN(Number(metric.totalCostEstimate)) ? '0.00' : Number(metric.totalCostEstimate || 0).toFixed(2)}
                  </div>
                  <div className="text-xs text-gray-400">Cost</div>
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
            const emoji = CATEGORY_EMOJIS[log.category] || '📋';
            const agentEmoji = AGENT_EMOJIS[log.agentId as keyof typeof AGENT_EMOJIS] || AGENT_EMOJI_FALLBACKS[log.agentId] || '🤖';
            return (
              <div
                key={log.id}
                className="flex items-start gap-3 rounded-xl border border-surface-hover bg-background p-4 hover:border-primary/50 transition-colors"
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg ${CATEGORY_COLORS[log.category]}`}>
                  {emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-lg">{agentEmoji}</span>
                    <span className="font-medium">{AGENT_NAMES[log.agentId as keyof typeof AGENT_NAMES] || log.agentId}</span>
                    <span className="text-xs text-gray-400">{formatTime(log.timestamp)}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[log.category]}`}>
                      {log.category.replace('_', ' ')}
                    </span>
                  </div>
                  <p className="text-sm text-gray-200 mt-1">{log.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs">
                    {log.metadata?.duration && (
                      <span className="flex items-center gap-1 text-gray-400">
                        ⏱️ {formatDuration(log.metadata.duration)}
                      </span>
                    )}
                    {log.metadata?.tokensUsed && Number(log.metadata.tokensUsed) > 0 && (
                      <span className="flex items-center gap-1 text-orange-400">
                        🔢 {Number(log.metadata.tokensUsed).toLocaleString()} tokens
                      </span>
                    )}
                    {log.metadata?.costEstimate && Number(log.metadata.costEstimate) > 0 && (
                      <span className="flex items-center gap-1 text-green-400">
                        💰 ${Number(log.metadata.costEstimate).toFixed(3)}
                      </span>
                    )}
                    {log.metadata?.success === false && (
                      <span className="text-red-400 font-medium">❌ Failed</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

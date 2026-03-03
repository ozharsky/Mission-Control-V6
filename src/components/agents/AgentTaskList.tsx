/**
 * Agent Task List Component
 * Mission Control V6
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Database } from 'firebase/database';
import { AgentTaskService } from '../../services/agentTaskService';
import { AgentTask, TaskFilters, AgentId } from '../../types/agentTask';
import { AGENT_EMOJIS, AGENT_NAMES, TASK_STATUS } from '../../constants/agents';

interface AgentTaskListProps {
  firebaseDb: Database;
  onTaskSelect?: (taskId: string) => void;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  active: 'bg-blue-100 text-blue-800',
  paused: 'bg-gray-100 text-gray-800',
  review: 'bg-purple-100 text-purple-800',
  complete: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800'
};

const priorityIcons: Record<string, string> = {
  urgent: '🔴',
  high: '🟠',
  medium: '🟡',
  low: '🟢'
};

export const AgentTaskList: React.FC<AgentTaskListProps> = ({ firebaseDb, onTaskSelect }) => {
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<TaskFilters>({});
  const [stats, setStats] = useState({ total: 0, active: 0, pending: 0 });

  const service = new AgentTaskService(firebaseDb);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await service.listAgentTasks(filters);
      setTasks(data);
      setStats({
        total: data.length,
        active: data.filter(t => t.status === 'active').length,
        pending: data.filter(t => t.status === 'pending').length
      });
      setError(null);
    } catch (err) {
      setError('Failed to load tasks');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [filters, firebaseDb]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleFilterChange = (key: keyof TaskFilters, value: string | undefined) => {
    setFilters(prev => ({ ...prev, [key]: value || undefined }));
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="p-4">
        <div className="animate-pulse">Loading agent tasks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-600">
        {error}
        <button onClick={loadTasks} className="ml-2 text-blue-600 underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="agent-task-panel p-4">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">🤖 Agent Tasks</h2>
        <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
          + New Workflow
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-4">
        <select
          className="px-3 py-2 border rounded"
          value={filters.status || ''}
          onChange={(e) => handleFilterChange('status', e.target.value)}
        >
          <option value="">All Status</option>
          {Object.values(TASK_STATUS).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select
          className="px-3 py-2 border rounded"
          value={filters.assignee || ''}
          onChange={(e) => handleFilterChange('assignee', e.target.value)}
        >
          <option value="">All Agents</option>
          {(Object.keys(AGENT_NAMES) as AgentId[]).map(id => (
            <option key={id} value={id}>
              {AGENT_EMOJIS[id]} {AGENT_NAMES[id]}
            </option>
          ))}
        </select>

        <select
          className="px-3 py-2 border rounded"
          value={filters.priority || ''}
          onChange={(e) => handleFilterChange('priority', e.target.value)}
        >
          <option value="">All Priorities</option>
          <option value="urgent">🔴 Urgent</option>
          <option value="high">🟠 High</option>
          <option value="medium">🟡 Medium</option>
          <option value="low">🟢 Low</option>
        </select>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-4 text-sm text-gray-600">
        <span>{stats.total} total</span>
        <span>{stats.active} active</span>
        <span>{stats.pending} pending</span>
      </div>

      {/* Task List */}
      <div className="space-y-2">
        {tasks.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No agent tasks yet</p>
            <button className="mt-2 text-blue-600 underline">
              Start a Workflow
            </button>
          </div>
        ) : (
          tasks.map(task => (
            <div
              key={task.id}
              className="p-4 border rounded-lg hover:shadow-md cursor-pointer transition-shadow"
              onClick={() => onTaskSelect?.(task.id)}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg" title={AGENT_NAMES[task.assignee]}>
                  {AGENT_EMOJIS[task.assignee]}
                </span>
                <span className="text-sm text-gray-500">{task.type}</span>
                <span className="ml-auto" title={`${task.priority} priority`}>
                  {priorityIcons[task.priority]}
                </span>
              </div>

              <h4 className="font-semibold mb-1">{task.title}</h4>
              <p className="text-sm text-gray-600 line-clamp-2">
                {task.description}
              </p>

              <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                <span className={`px-2 py-1 rounded ${statusColors[task.status]}`}>
                  {task.status}
                </span>
                <span>{formatDate(task.createdAt)}</span>
                {task.discordThreadId && (
                  <span title="Discord thread">💬</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default AgentTaskList;

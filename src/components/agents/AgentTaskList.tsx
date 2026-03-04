/**
 * Agent Task List Component
 * Mission Control V6
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Database, ref, onValue } from 'firebase/database';
import { AgentTaskService } from '../../services/agentTaskService';
import { AgentTask, TaskFilters, AgentId } from '../../types/agentTask';
import { AGENT_EMOJIS, AGENT_NAMES, TASK_STATUS } from '../../constants/agents';
import { NewWorkflowModal } from './NewWorkflowModal';
import { TaskDetailModal } from './TaskDetailModal';
import { Bot, Plus, Filter } from 'lucide-react';

interface AgentTaskListProps {
  firebaseDb: Database;
  onTaskSelect?: (taskId: string) => void;
}

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
  active: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  paused: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  review: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
  complete: 'bg-green-500/10 text-green-500 border-green-500/20',
  cancelled: 'bg-red-500/10 text-red-500 border-red-500/20'
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
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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
    
    // Set up real-time listener
    const tasksRef = ref(firebaseDb, 'v6/agentTasks');
    const unsubscribe = onValue(tasksRef, (snapshot) => {
      const data: AgentTask[] = [];
      snapshot.forEach((child) => {
        data.push(child.val() as AgentTask);
      });
      // Apply filters
      let filtered = data;
      if (filters.status) filtered = filtered.filter(t => t.status === filters.status);
      if (filters.assignee) filtered = filtered.filter(t => t.assignee === filters.assignee);
      if (filters.priority) filtered = filtered.filter(t => t.priority === filters.priority);
      
      setTasks(filtered.sort((a, b) => b.createdAt - a.createdAt));
      setStats({
        total: filtered.length,
        active: filtered.filter(t => t.status === 'active').length,
        pending: filtered.filter(t => t.status === 'pending').length
      });
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, [filters, firebaseDb, loadTasks]);

  const handleFilterChange = (key: keyof TaskFilters, value: string | undefined) => {
    setFilters(prev => ({ ...prev, [key]: value || undefined }));
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse text-gray-400">Loading agent tasks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-red-400">
        {error}
        <button onClick={loadTasks} className="ml-2 text-primary hover:underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Agent Tasks</h2>
            <p className="text-sm text-gray-400">Manage AI agent workflows</p>
          </div>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" />
          New Workflow
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <div className="text-2xl font-bold">{stats.total}</div>
          <div className="text-sm text-gray-400">Total Tasks</div>
        </div>
        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <div className="text-2xl font-bold text-blue-400">{stats.active}</div>
          <div className="text-sm text-gray-400">Active</div>
        </div>
        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <div className="text-2xl font-bold text-yellow-400">{stats.pending}</div>
          <div className="text-sm text-gray-400">Pending</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <div className="flex items-center gap-2 rounded-lg border border-surface-hover bg-surface px-3 py-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <select
            className="bg-transparent text-sm outline-none"
            value={filters.status || ''}
            onChange={(e) => handleFilterChange('status', e.target.value)}
          >
            <option value="">All Status</option>
            {Object.values(TASK_STATUS).map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-surface-hover bg-surface px-3 py-2">
          <select
            className="bg-transparent text-sm outline-none"
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
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-surface-hover bg-surface px-3 py-2">
          <select
            className="bg-transparent text-sm outline-none"
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
      </div>

      {/* Task List */}
      <div className="space-y-3">
        {tasks.length === 0 ? (
          <div className="rounded-xl border border-surface-hover bg-surface p-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-surface-hover mx-auto mb-4">
              <Bot className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium mb-2">No agent tasks yet</h3>
            <p className="text-gray-400 mb-4">Create a workflow to get started with AI agents</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
            >
              Start a Workflow
            </button>
          </div>
        ) : (
          tasks.map(task => (
            <div
              key={task.id}
              className="rounded-xl border border-surface-hover bg-surface p-3 sm:p-4 hover:border-primary/50 cursor-pointer transition-colors"
              onClick={() => setSelectedTaskId(task.id)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                  <span className="text-xl sm:text-2xl flex-shrink-0" title={AGENT_NAMES[task.assignee]}>
                    {AGENT_EMOJIS[task.assignee]}
                  </span>
                  <div className="min-w-0">
                    <h4 className="font-medium text-sm sm:text-base truncate">{task.title}</h4>
                    {task.input?.topic && (
                      <p className="text-xs sm:text-sm text-gray-400 line-clamp-1">
                        "{task.input.topic}"
                      </p>
                    )}
                    <p className="text-xs text-gray-500 line-clamp-1 hidden sm:block">
                      {task.description}
                    </p>
                  </div>
                </div>
                <span className="flex-shrink-0" title={`${task.priority} priority`}>
                  {priorityIcons[task.priority]}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${statusColors[task.status]}`}>
                  {task.status}
                </span>
                <span className="text-xs text-gray-400">{task.type}</span>
                <span className="text-xs text-gray-400">{formatDate(task.createdAt)}</span>
                {task.discordThreadId && (
                  <span className="text-xs text-gray-400" title="Discord thread">💬</span>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <NewWorkflowModal
        firebaseDb={firebaseDb}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onWorkflowCreated={loadTasks}
      />

      <TaskDetailModal
        firebaseDb={firebaseDb}
        taskId={selectedTaskId}
        isOpen={!!selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
      />
    </div>
  );
};

export default AgentTaskList;

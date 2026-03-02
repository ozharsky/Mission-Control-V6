import { useState } from 'react';
import { 
  Plus, CheckCircle, Clock, Circle, MoreHorizontal, Calendar, Folder, 
  ArrowRight, ArrowLeft, Trash2, Edit2, X, User, Bot 
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import type { Task } from '../types';

interface Project {
  id: string;
  name: string;
}

interface TaskBoardProps {
  tasks: {
    pending: Task[];
    inProgress: Task[];
    completed: Task[];
  };
  projects?: Project[];
}

const ASSIGNEE_COLORS: Record<string, string> = {
  'Oleg': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'KimiClaw': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
};

function TaskCard({ 
  task, 
  index, 
  projectName,
  onMove,
  onEdit,
  onDelete 
}: { 
  task: Task; 
  index: number; 
  projectName?: string;
  onMove: (direction: 'forward' | 'backward') => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [showActions, setShowActions] = useState(false);
  
  const priorityColors = {
    high: 'bg-danger/10 text-danger border-danger/30',
    medium: 'bg-warning/10 text-warning border-warning/30',
    low: 'bg-gray-800 text-gray-400 border-gray-700',
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
  const canMoveForward = task.status !== 'completed';
  const canMoveBackward = task.status !== 'pending';

  return (
    <div
      className="group relative rounded-xl border border-surface-hover bg-background p-4 transition-all duration-200 hover:border-primary hover:shadow-lg"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Header with actions */}
      <div className="mb-3 flex items-start justify-between">
        <span className="flex-1 pr-2 text-sm font-medium leading-relaxed">{task.title}</span>
        <div className="relative">
          <button 
            onClick={() => setShowActions(!showActions)}
            className="rounded p-1 text-gray-500 hover:bg-surface-hover hover:text-white"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          
          {/* Actions Dropdown */}
          {showActions && (
            <div className="absolute right-0 top-full z-10 mt-1 w-40 rounded-xl border border-surface-hover bg-surface shadow-lg">
              {canMoveBackward && (
                <button 
                  onClick={() => { onMove('backward'); setShowActions(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Move Back
                </button>
              )}
              {canMoveForward && (
                <button 
                  onClick={() => { onMove('forward'); setShowActions(false); }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover"
                >
                  <ArrowRight className="h-4 w-4" />
                  Move Forward
                </button>
              )}
              <button 
                onClick={() => { onEdit(); setShowActions(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-surface-hover"
              >
                <Edit2 className="h-4 w-4" />
                Edit
              </button>
              <button 
                onClick={() => { onDelete(); setShowActions(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-danger hover:bg-danger/10"
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {task.description && (
        <p className="mb-3 text-xs text-gray-500 line-clamp-2">{task.description}</p>
      )}

      {/* Project & Assignee */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {projectName && (
          <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1 text-xs text-primary">
            <Folder className="h-3 w-3" />
            {projectName}
          </div>
        )}
        {task.assignee && (
          <div className={`flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${ASSIGNEE_COLORS[task.assignee]}`}>
            {task.assignee === 'Oleg' ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
            {task.assignee}
          </div>
        )}
      </div>

      {task.tags && task.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span key={tag} className="rounded-full bg-surface-hover px-2 py-0.5 text-xs text-gray-400">
              #{tag}
            </span>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">
            {new Date(task.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
          {task.dueDate && (
            <span className={`text-xs flex items-center gap-1 ${isOverdue ? 'text-danger' : 'text-gray-500'}`}>
              <Calendar className="h-3 w-3" />
              {new Date(task.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
      </div>
    </div>
  );
}

export function TaskBoard({ tasks, projects = [] }: TaskBoardProps) {
  const { addTask, moveTask, deleteTask, updateTask } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as Task['priority'],
    dueDate: '',
    projectId: '',
    assignee: '' as Task['assignee'],
    tags: ''
  });

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.title.trim()) return;

    await addTask({
      title: newTask.title,
      description: newTask.description,
      priority: newTask.priority,
      status: 'pending',
      createdBy: 'user',
      createdAt: new Date().toISOString(),
      dueDate: newTask.dueDate || undefined,
      projectId: newTask.projectId || undefined,
      assignee: newTask.assignee || undefined,
      tags: newTask.tags.split(',').map(t => t.trim()).filter(Boolean),
    });

    setNewTask({ title: '', description: '', priority: 'medium', dueDate: '', projectId: '', assignee: '', tags: '' });
    setShowForm(false);
  };

  const handleEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;

    await updateTask(editingTask.id, {
      title: newTask.title,
      description: newTask.description,
      priority: newTask.priority,
      dueDate: newTask.dueDate || undefined,
      projectId: newTask.projectId || undefined,
      assignee: newTask.assignee || undefined,
      tags: newTask.tags.split(',').map(t => t.trim()).filter(Boolean),
    });

    setEditingTask(null);
    setNewTask({ title: '', description: '', priority: 'medium', dueDate: '', projectId: '', assignee: '', tags: '' });
  };

  const handleMoveTask = (task: Task, direction: 'forward' | 'backward') => {
    const statusOrder: Task['status'][] = ['pending', 'in-progress', 'completed'];
    const currentIndex = statusOrder.indexOf(task.status);
    const newIndex = direction === 'forward' ? currentIndex + 1 : currentIndex - 1;
    
    if (newIndex >= 0 && newIndex < statusOrder.length) {
      moveTask(task.id, task.status, statusOrder[newIndex]);
    }
  };

  const handleDeleteTask = (task: Task) => {
    if (confirm(`Delete task "${task.title}"?`)) {
      deleteTask(task.id, task.status);
    }
  };

  const openEditModal = (task: Task) => {
    setEditingTask(task);
    setNewTask({
      title: task.title,
      description: task.description || '',
      priority: task.priority,
      dueDate: task.dueDate || '',
      projectId: task.projectId || '',
      assignee: task.assignee || '',
      tags: task.tags?.join(', ') || '',
    });
  };

  const getProjectName = (projectId?: string) => {
    if (!projectId) return undefined;
    return projects.find(p => p.id === projectId)?.name;
  };

  const columns = [
    { id: 'pending', title: 'To Do', icon: Circle, tasks: tasks.pending, colorClass: 'warning', bgColor: 'bg-warning/5', iconBg: 'bg-warning/10', iconText: 'text-warning' },
    { id: 'inProgress', title: 'In Progress', icon: Clock, tasks: tasks.inProgress, colorClass: 'primary', bgColor: 'bg-primary/5', iconBg: 'bg-primary/10', iconText: 'text-primary' },
    { id: 'completed', title: 'Done', icon: CheckCircle, tasks: tasks.completed, colorClass: 'success', bgColor: 'bg-success/5', iconBg: 'bg-success/10', iconText: 'text-success' },
  ];

  return (
    <div className="space-y-6">
      {/* Add/Edit Task Modal */}
      {(showForm || editingTask) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-surface-hover bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">{editingTask ? 'Edit Task' : 'New Task'}</h3>
              <button 
                onClick={() => { setShowForm(false); setEditingTask(null); }}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={editingTask ? handleEditTask : handleAddTask} className="space-y-4">
              <input
                type="text"
                value={newTask.title}
                onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                placeholder="Task title"
                className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
                autoFocus
              />
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Description (optional)"
                rows={2}
                className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
              />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Task['priority'] })}
                  className="rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
                >
                  <option value="low">Low Priority</option>
                  <option value="medium">Medium Priority</option>
                  <option value="high">High Priority</option>
                </select>
                <input
                  type="date"
                  value={newTask.dueDate}
                  onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                  className="rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
                />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <select
                  value={newTask.projectId}
                  onChange={(e) => setNewTask({ ...newTask, projectId: e.target.value })}
                  className="rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
                >
                  <option value="">No Project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                <select
                  value={newTask.assignee}
                  onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value as Task['assignee'] })}
                  className="rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
                >
                  <option value="">Unassigned</option>
                  <option value="Oleg">Oleg</option>
                  <option value="KimiClaw">KimiClaw</option>
                </select>
              </div>
              <input
                type="text"
                value={newTask.tags}
                onChange={(e) => setNewTask({ ...newTask, tags: e.target.value })}
                placeholder="Tags (comma separated)"
                className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
              />
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowForm(false); setEditingTask(null); }}
                  className="flex-1 rounded-xl border border-surface-hover py-2 text-gray-400 hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary py-2 font-medium text-white hover:bg-primary-hover"
                >
                  {editingTask ? 'Save Changes' : 'Add Task'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Task Button */}
      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        <button
          onClick={() => setShowForm(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-hover py-4 text-gray-500 transition-colors hover:border-primary hover:text-primary"
        >
          <Plus className="h-5 w-5" />
          Add New Task
        </button>
      </div>

      {/* Task Columns */}
      {/* Task Columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {columns.map((column) => (
          <div key={column.id} className={`rounded-2xl border border-surface-hover ${column.bgColor}`}>
            <div className="border-b border-surface-hover/50 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${column.iconBg}`}>
                  <column.icon className={`h-4 w-4 ${column.iconText}`} />
                </div>
                <span className="font-semibold">{column.title}</span>
                <span className="ml-auto rounded-full bg-surface px-3 py-1 text-sm font-medium">
                  {column.tasks.length}
                </span>
              </div>
            </div>

            <div className="space-y-3 p-4">
              {column.tasks.map((task, index) => (
                <TaskCard 
                  key={task.id} 
                  task={task} 
                  index={index}
                  projectName={getProjectName(task.projectId)}
                  onMove={(direction) => handleMoveTask(task, direction)}
                  onEdit={() => openEditModal(task)}
                  onDelete={() => handleDeleteTask(task)}
                />
              ))}
              {column.tasks.length === 0 && (
                <div className="rounded-xl border border-dashed border-surface-hover py-8 text-center text-gray-500">
                  No tasks
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
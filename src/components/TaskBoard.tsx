import { useState } from 'react';
import { 
  Plus, CheckCircle, Clock, Circle, Calendar, Folder, 
  ArrowRight, ArrowLeft, Trash2, Edit2, X, User, Bot, Filter
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { LoadingButton } from '../components/Loading';
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
  onDelete,
  onDragStart,
  isDragging
}: { 
  task: Task; 
  index: number; 
  projectName?: string;
  onMove: (direction: 'forward' | 'backward') => void;
  onEdit: () => void;
  onDelete: () => void;
  onDragStart?: () => void;
  isDragging?: boolean;
}) {
  const priorityColors = {
    high: 'bg-danger/10 text-danger border-danger/30',
    medium: 'bg-warning/10 text-warning border-warning/30',
    low: 'bg-gray-800 text-gray-400 border-gray-700',
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';
  
  // Calculate days until due for display
  const getDueText = () => {
    if (!task.dueDate || task.status === 'completed') return null;
    const due = new Date(task.dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diff = due.getTime() - today.getTime();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    
    if (days < 0) return { text: `${Math.abs(days)}d overdue`, color: 'text-danger' };
    if (days === 0) return { text: 'Due today', color: 'text-danger' };
    if (days === 1) return { text: 'Due tomorrow', color: 'text-warning' };
    if (days <= 3) return { text: `Due in ${days}d`, color: 'text-warning' };
    return { text: `Due in ${days}d`, color: 'text-gray-500' };
  };
  
  const dueText = getDueText();
  const canMoveForward = task.status !== 'completed';
  const canMoveBackward = task.status !== 'pending';

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className={`group relative rounded-xl border border-surface-hover bg-background p-4 transition-all duration-200 hover:border-primary hover:shadow-lg ${isDragging ? 'opacity-50' : ''} cursor-move`}
      style={{ animationDelay: `${index * 50}ms` }}
    >
      {/* Header with actions - Always visible action buttons */}
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2">
          <span className="flex-1 text-sm font-medium leading-relaxed">{task.title}</span>
          
          {/* Always-visible action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <button 
              onClick={() => onEdit()}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-hover text-gray-400 hover:bg-primary/20 hover:text-primary transition-colors"
              title="Edit task"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button 
              onClick={() => onDelete()}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-hover text-gray-400 hover:bg-danger/20 hover:text-danger transition-colors"
              title="Delete task"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        
        {/* Move buttons row */}
        <div className="mt-2 flex items-center gap-2">
          {canMoveBackward && (
            <button 
              onClick={() => onMove('backward')}
              className="flex items-center gap-1 rounded-lg bg-surface-hover px-2 py-1 text-xs text-gray-400 hover:bg-surface-hover/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3 w-3" /> Move Back
            </button>
          )}
          {canMoveForward && (
            <button 
              onClick={() => onMove('forward')}
              className="flex items-center gap-1 rounded-lg bg-surface-hover px-2 py-1 text-xs text-gray-400 hover:bg-surface-hover/80 hover:text-white transition-colors"
            >
              Move Forward <ArrowRight className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Meta info */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full border px-2 py-0.5 text-xs ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
        
        {task.assignee && (
          <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${ASSIGNEE_COLORS[task.assignee] || 'bg-gray-800 text-gray-400 border-gray-700'}`}>
            {task.assignee === 'Oleg' ? <User className="h-3 w-3" /> : <Bot className="h-3 w-3" />}
            {task.assignee}
          </span>
        )}
        
        {projectName && (
          <span className="flex items-center gap-1 text-xs text-gray-500">
            <Folder className="h-3 w-3" />
            {projectName}
          </span>
        )}
      </div>

      {/* Due date */}
      {(task.dueDate || isOverdue) && (
        <div className={`mt-2 flex items-center gap-1 text-xs ${dueText?.color || 'text-gray-500'}`}>
          <Calendar className="h-3 w-3" />
          <span>{dueText?.text || new Date(task.dueDate!).toLocaleDateString()}</span>
        </div>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {task.tags.map((tag, i) => (
            <span key={i} className="rounded bg-surface-hover px-2 py-0.5 text-xs text-gray-400">
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function TaskBoard({ tasks, projects = [] }: TaskBoardProps) {
  const { addTask, moveTask, deleteTask, updateTask } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedProject, setSelectedProject] = useState<string>('all');
  const [selectedFilter, setSelectedFilter] = useState<'all' | 'urgent' | 'due-soon' | 'overdue'>('all');
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

    setIsSubmitting(true);
    try {
      // Build task object, only including fields with values
      const taskData: any = {
        title: newTask.title,
        description: newTask.description || '',
        priority: newTask.priority,
        status: 'pending',
        createdBy: 'user',
        createdAt: new Date().toISOString(),
        tags: newTask.tags.split(',').map(t => t.trim()).filter(Boolean),
      };
      
      // Only add optional fields if they have values
      if (newTask.dueDate) taskData.dueDate = newTask.dueDate;
      if (newTask.projectId) taskData.projectId = newTask.projectId;
      if (newTask.assignee) taskData.assignee = newTask.assignee;
      
      await addTask(taskData);
      setNewTask({ title: '', description: '', priority: 'medium', dueDate: '', projectId: '', assignee: '', tags: '' });
      setShowForm(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask || !editingTask.id) return;

    setIsSubmitting(true);
    try {
      // Build update object, only including fields with values
      const updates: any = {
        title: newTask.title,
        description: newTask.description || '',
        priority: newTask.priority,
        tags: newTask.tags.split(',').map(t => t.trim()).filter(Boolean),
      };
      
      // Only add optional fields if they have values
      if (newTask.dueDate) updates.dueDate = newTask.dueDate;
      if (newTask.projectId) updates.projectId = newTask.projectId;
      if (newTask.assignee) updates.assignee = newTask.assignee;
      
      await updateTask(editingTask.id, updates);
      setEditingTask(null);
      setShowForm(false);
      setNewTask({ title: '', description: '', priority: 'medium', dueDate: '', projectId: '', assignee: '', tags: '' });
    } finally {
      setIsSubmitting(false);
    }
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
    if (!task.id) {
      console.error('Cannot delete task without ID:', task);
      alert('Error: Task ID is missing. Please refresh the page.');
      return;
    }
    if (confirm(`Delete task "${task.title}"?`)) {
      deleteTask(task.id, task.status);
    }
  };

  // Drag and drop handlers
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, newStatus: Task['status']) => {
    e.preventDefault();
    if (!draggedTask || draggedTask.status === newStatus) {
      setDraggedTask(null);
      return;
    }

    moveTask(draggedTask.id, draggedTask.status, newStatus);
    setDraggedTask(null);
  };

  const openEditModal = (task: Task) => {
    if (!task.id) {
      console.error('Cannot edit task without ID:', task);
      alert('Error: Task ID is missing. Please refresh the page.');
      return;
    }
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
    setShowForm(true);
  };

  const getProjectName = (projectId?: string) => {
    if (!projectId) return undefined;
    return projects.find(p => p.id === projectId)?.name;
  };

  // Helper to calculate days until due
  const getDaysUntilDue = (dueDate?: string) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diff = due.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Filter tasks by selected project and filter type
  const getFilteredTasks = (taskList: Task[]) => {
    let filtered = taskList;

    // Filter by project
    if (selectedProject !== 'all') {
      filtered = filtered.filter(t => t.projectId === selectedProject);
    }

    // Filter by type
    switch (selectedFilter) {
      case 'urgent':
        filtered = filtered.filter(t => t.priority === 'high' && t.status !== 'completed');
        break;
      case 'due-soon':
        filtered = filtered.filter(t => {
          if (!t.dueDate || t.status === 'completed') return false;
          const days = getDaysUntilDue(t.dueDate);
          return days !== null && days <= 3 && days >= 0;
        });
        break;
      case 'overdue':
        filtered = filtered.filter(t => {
          if (!t.dueDate || t.status === 'completed') return false;
          const days = getDaysUntilDue(t.dueDate);
          return days !== null && days < 0;
        });
        break;
    }

    return filtered;
  };

  const filteredTasks = {
    pending: getFilteredTasks(tasks.pending),
    inProgress: getFilteredTasks(tasks.inProgress),
    completed: getFilteredTasks(tasks.completed),
  };

  const columns = [
    { id: 'pending', title: 'To Do', icon: Circle, tasks: filteredTasks.pending, colorClass: 'warning', bgColor: 'bg-warning/5', iconBg: 'bg-warning/10', iconText: 'text-warning' },
    { id: 'inProgress', title: 'In Progress', icon: Clock, tasks: filteredTasks.inProgress, colorClass: 'primary', bgColor: 'bg-primary/5', iconBg: 'bg-primary/10', iconText: 'text-primary' },
    { id: 'completed', title: 'Done', icon: CheckCircle, tasks: filteredTasks.completed, colorClass: 'success', bgColor: 'bg-success/5', iconBg: 'bg-success/10', iconText: 'text-success' },
  ];

  return (
    <div className="space-y-6">
      {/* Project Filter */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-sm text-gray-400">Filter:</label>
          
          {/* Project Filter */}
          <select
            value={selectedProject}
            onChange={(e) => setSelectedProject(e.target.value)}
            className="rounded-xl border border-surface-hover bg-surface px-3 py-2 text-sm text-white focus:border-primary focus:outline-none"
          >
            <option value="all">All Projects</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          
          {/* Type Filters */}
          <div className="flex flex-wrap items-center gap-1">
            {(['all', 'urgent', 'due-soon', 'overdue'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`min-h-[44px] rounded-lg px-3 py-2 text-sm capitalize ${
                  selectedFilter === filter
                    ? 'bg-primary text-white'
                    : 'border border-surface-hover text-gray-400 hover:bg-surface-hover'
                }`}
              >
                {filter === 'due-soon' ? 'Due Soon' : filter}
              </button>
            ))}
          </div>
          
          {(selectedProject !== 'all' || selectedFilter !== 'all') && (
            <button
              onClick={() => { setSelectedProject('all'); setSelectedFilter('all'); }}
              className="text-sm text-gray-400 hover:text-white"
            >
              Clear
            </button>
          )}
        </div>
        
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover"
        >
          <Plus className="h-5 w-5" />
          Add Task
        </button>
      </div>

      {/* Add/Edit Task Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-surface-hover bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">{editingTask ? 'Edit Task' : 'Add New Task'}</h3>
              <button 
                onClick={() => { setShowForm(false); setEditingTask(null); }}
                className="rounded-lg p-2 text-gray-400 hover:bg-surface-hover hover:text-white"
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
                required
              />
              <textarea
                value={newTask.description}
                onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                placeholder="Description (optional)"
                rows={3}
                className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
              />
              <div className="grid grid-cols-2 gap-3">
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
              <div className="grid grid-cols-2 gap-3">
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
                <LoadingButton
                  type="submit"
                  isLoading={isSubmitting}
                  loadingText={editingTask ? 'Saving...' : 'Adding...'}
                  className="flex-1 rounded-xl bg-primary py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {editingTask ? 'Save Changes' : 'Add Task'}
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Task Columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {columns.map((column) => {
          const columnStatus = column.id === 'inProgress' ? 'in-progress' : column.id as Task['status'];
          return (
            <div 
              key={column.id} 
              className={`rounded-2xl border border-surface-hover ${column.bgColor}`}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, columnStatus)}
            >
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

              <div className="space-y-3 p-4 min-h-[200px]">
                {column.tasks.map((task, index) => (
                  <TaskCard 
                    key={task.id} 
                    task={task} 
                    index={index}
                    projectName={getProjectName(task.projectId)}
                    onMove={(direction) => handleMoveTask(task, direction)}
                    onEdit={() => openEditModal(task)}
                    onDelete={() => handleDeleteTask(task)}
                    onDragStart={() => handleDragStart(task)}
                    isDragging={draggedTask?.id === task.id}
                  />
                ))}
                {column.tasks.length === 0 && (
                  <div className="rounded-xl border border-dashed border-surface-hover py-8 text-center text-gray-500">
                    Drop tasks here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
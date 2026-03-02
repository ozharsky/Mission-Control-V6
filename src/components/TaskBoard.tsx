import { useState } from 'react';
import { Plus, CheckCircle, Clock, Circle, MoreHorizontal, Calendar, AlignLeft, Folder } from 'lucide-react';
import { useAppStore } from '../stores/appStore';

interface Task {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
  createdBy: 'user' | 'agent';
  createdAt: string;
  tags?: string[];
  description?: string;
  dueDate?: string;
  projectId?: string;
  assignee?: string;
}

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

function TaskCard({ task, index, projectName }: { task: Task; index: number; projectName?: string }) {
  const priorityColors = {
    high: 'bg-danger/10 text-danger border-danger/30',
    medium: 'bg-warning/10 text-warning border-warning/30',
    low: 'bg-gray-800 text-gray-400 border-gray-700',
  };

  const creatorIcons = {
    user: '👤',
    agent: '🤖',
  };

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'completed';

  return (
    <div
      className="group relative rounded-xl border border-surface-hover bg-background p-4 transition-all duration-200 hover:border-primary hover:shadow-lg"
      style={{ animationDelay: `${index * 50}ms` }}
    >
      <div className="mb-3 flex items-start justify-between">
        <span className="flex-1 pr-2 text-sm font-medium leading-relaxed">{task.title}</span>
        <button className="opacity-0 transition-opacity group-hover:opacity-100">
          <MoreHorizontal className="h-4 w-4 text-gray-500 hover:text-white"></MoreHorizontal>
        </button>
      </div>

      {task.description && (
        <p className="mb-3 text-xs text-gray-500 line-clamp-2">{task.description}</p>
      )}

      {projectName && (
        <div className="mb-3 flex items-center gap-1 text-xs text-primary">
          <Folder className="h-3 w-3" />
          {projectName}
        </div>
      )}

      {task.tags && task.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {task.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-surface-hover px-2 py-0.5 text-xs text-gray-400"
            >
              #{tag}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs">{creatorIcons[task.createdBy]}</span>
          <span className="text-xs text-gray-500">
            {new Date(task.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
            })}
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
  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    priority: 'medium' as Task['priority'],
    dueDate: '',
    projectId: '',
    tags: ''
  });
  const { addTask } = useAppStore();

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
      tags: newTask.tags.split(',').map(t => t.trim()).filter(Boolean),
    });

    setNewTask({ title: '', description: '', priority: 'medium', dueDate: '', projectId: '', tags: '' });
    setShowForm(false);
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
      {/* Add Task Form */}
      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-hover py-4 text-gray-500 transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="h-5 w-5" />
            Add New Task
          </button>
        ) : (
          <form onSubmit={handleAddTask} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Add New Task</h2>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="text-gray-500 hover:text-white"
              >
                Cancel
              </button>
            </div>
            
            <input
              type="text"
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              placeholder="What needs to be done?"
              className="w-full rounded-xl border border-surface-hover bg-background px-4 py-3 text-white placeholder-gray-500 transition-colors focus:border-primary focus:outline-none"
              autoFocus
            />
            
            <textarea
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              placeholder="Description (optional)"
              rows={2}
              className="w-full rounded-xl border border-surface-hover bg-background px-4 py-3 text-white placeholder-gray-500 transition-colors focus:border-primary focus:outline-none"
            />
            
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Task['priority'] })}
                className="rounded-xl border border-surface-hover bg-background px-4 py-3 text-white focus:border-primary focus:outline-none"
              >
                <option value="low">Low Priority</option>
                <option value="medium">Medium Priority</option>
                <option value="high">High Priority</option>
              </select>
              
              <input
                type="date"
                value={newTask.dueDate}
                onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
                className="rounded-xl border border-surface-hover bg-background px-4 py-3 text-white focus:border-primary focus:outline-none"
              />
              
              <select
                value={newTask.projectId}
                onChange={(e) => setNewTask({ ...newTask, projectId: e.target.value })}
                className="rounded-xl border border-surface-hover bg-background px-4 py-3 text-white focus:border-primary focus:outline-none"
              >
                <option value="">No Project</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            
            <input
              type="text"
              value={newTask.tags}
              onChange={(e) => setNewTask({ ...newTask, tags: e.target.value })}
              placeholder="Tags (comma separated)"
              className="w-full rounded-xl border border-surface-hover bg-background px-4 py-3 text-white placeholder-gray-500 transition-colors focus:border-primary focus:outline-none"
            />
            
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-white transition-all hover:bg-primary-hover"
            >
              <Plus className="h-5 w-5" />
              Add Task
            </button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {columns.map((column) => (
          <div
            key={column.id}
            className={`rounded-2xl border border-surface-hover ${column.bgColor}`}
          >
            <div className="border-b border-surface-hover/50 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${column.iconBg}`}>
                  <column.icon className={`h-4 w-4 ${column.iconText}`}></column.icon>
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
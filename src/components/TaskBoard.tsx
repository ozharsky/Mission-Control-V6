import { useState } from 'react';
import { Plus, CheckCircle, Clock, Circle, MoreHorizontal } from 'lucide-react';
import { useAppStore } from '../stores/appStore';

interface Task {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
  createdBy: 'user' | 'agent';
  createdAt: string;
  tags?: string[];
}

interface TaskBoardProps {
  tasks: {
    pending: Task[];
    inProgress: Task[];
    completed: Task[];
  };
}

function TaskCard({ task, index }: { task: Task; index: number }) {
  const priorityColors = {
    high: 'bg-danger/10 text-danger border-danger/30',
    medium: 'bg-warning/10 text-warning border-warning/30',
    low: 'bg-gray-800 text-gray-400 border-gray-700',
  };

  const creatorIcons = {
    user: '👤',
    agent: '🤖',
  };

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
        </div>

        <span className={`rounded-full border px-2 py-0.5 text-xs font-medium ${priorityColors[task.priority]}`}>
          {task.priority}
        </span>
      </div>
    </div>
  );
}

export function TaskBoard({ tasks }: TaskBoardProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [selectedPriority, setSelectedPriority] = useState<Task['priority']>('medium');
  const { addTask } = useAppStore();

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    await addTask({
      title: newTaskTitle,
      priority: selectedPriority,
      status: 'pending',
      createdBy: 'user',
      createdAt: new Date().toISOString(),
    });

    setNewTaskTitle('');
  };

  const columns = [
    { id: 'pending', title: 'To Do', icon: Circle, tasks: tasks.pending, color: 'warning', bgColor: 'bg-warning/5' },
    { id: 'inProgress', title: 'In Progress', icon: Clock, tasks: tasks.inProgress, color: 'primary', bgColor: 'bg-primary/5' },
    { id: 'completed', title: 'Done', icon: CheckCircle, tasks: tasks.completed, color: 'success', bgColor: 'bg-success/5' },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold">Add New Task</h2>
        
        <form onSubmit={handleAddTask} className="flex flex-col gap-3 sm:flex-row">
          <input
            type="text"
            value={newTaskTitle}
            onChange={(e) => setNewTaskTitle(e.target.value)}
            placeholder="What needs to be done?"
            className="flex-1 rounded-xl border border-surface-hover bg-background px-4 py-3 text-white placeholder-gray-500 transition-colors focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
          
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value as Task['priority'])}
            className="rounded-xl border border-surface-hover bg-background px-4 py-3 text-white focus:border-primary focus:outline-none"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
          </select>
          
          <button
            type="submit"
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-white transition-all hover:bg-primary-hover hover:shadow-lg hover:shadow-primary/25"
          >
            <Plus className="h-5 w-5"></Plus>
            Add Task
          </button>
        </form>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {columns.map((column) => (
          <div
            key={column.id}
            className={`rounded-2xl border border-surface-hover ${column.bgColor}`}
          >
            <div className="border-b border-surface-hover/50 px-5 py-4">
              <div className="flex items-center gap-3">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg bg-${column.color}/10`}>
                  <column.icon className={`h-4 w-4 text-${column.color}`}></column.icon>
                </div>
                <span className="font-semibold">{column.title}</span>
                <span className="ml-auto rounded-full bg-surface px-3 py-1 text-sm font-medium">
                  {column.tasks.length}
                </span>
              </div>
            </div>

            <div className="space-y-3 p-4">
              {column.tasks.map((task, index) => (
                <TaskCard key={task.id} task={task} index={index} />
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
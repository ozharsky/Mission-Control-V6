import { useState } from 'react';
import { Plus, CheckCircle, Clock, Circle } from 'lucide-react';
import { useAppStore } from '../stores/appStore';

interface Task {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
  createdBy: 'user' | 'agent';
  createdAt: string;
}

interface TaskBoardProps {
  tasks: {
    pending: Task[];
    inProgress: Task[];
    completed: Task[];
  };
}

export function TaskBoard({ tasks }: TaskBoardProps) {
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const { addTask } = useAppStore();

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    await addTask({
      title: newTaskTitle,
      priority: 'medium',
      status: 'pending',
      createdBy: 'user',
      createdAt: new Date().toISOString(),
    });

    setNewTaskTitle('');
  };

  const columns = [
    { id: 'pending', title: 'Pending', icon: Circle, tasks: tasks.pending, color: 'warning' },
    { id: 'inProgress', title: 'In Progress', icon: Clock, tasks: tasks.inProgress, color: 'primary' },
    { id: 'completed', title: 'Completed', icon: CheckCircle, tasks: tasks.completed, color: 'success' },
  ];

  return (
    <div className="space-y-4">
      {/* Add Task */}
      <form onSubmit={handleAddTask} className="flex gap-2">
        <input
          type="text"
          value={newTaskTitle}
          onChange={(e) => setNewTaskTitle(e.target.value)}
          placeholder="Add a new task..."
          className="flex-1 rounded-lg border border-surface-hover bg-background px-4 py-2 text-white placeholder-gray-500 focus:border-primary focus:outline-none"
        />
        <button
          type="submit"
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          Add
        </button>
      </form>

      {/* Task Columns */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {columns.map((column) => (
          <div key={column.id} className="rounded-xl border border-surface-hover bg-surface">
            <div className="border-b border-surface-hover px-4 py-3">
              <div className="flex items-center gap-2">
                <column.icon className={`h-5 w-5`} />
                <span className="font-semibold">{column.title}</span>
                <span className="ml-auto rounded-full bg-surface-hover px-2 py-0.5 text-sm">
                  {column.tasks.length}
                </span>
              </div>
            </div>

            <div className="space-y-2 p-4">
              {column.tasks.map((task) => (
                <div
                  key={task.id}
                  className="rounded-lg border border-surface-hover bg-background p-3 hover:border-primary"
                >
                  <div className="flex items-start justify-between">
                    <span className="text-sm">{task.title}</span>
                    <span className={`rounded px-1.5 py-0.5 text-xs ${
                      task.priority === 'high' ? 'bg-danger-light text-danger' :
                      task.priority === 'medium' ? 'bg-warning-light text-warning' :
                      'bg-gray-800 text-gray-400'
                    }`}>
                      {task.priority}
                    </span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    Created by {task.createdBy} • {new Date(task.createdAt).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
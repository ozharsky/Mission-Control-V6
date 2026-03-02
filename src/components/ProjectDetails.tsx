import { useState } from 'react';
import { ArrowLeft, Plus, CheckCircle, Circle, Clock, Calendar } from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import type { Project } from '../types';

interface ProjectDetailsProps {
  project: Project;
  onBack: () => void;
}

export function ProjectDetails({ project, onBack }: ProjectDetailsProps) {
  const { updateProject, addProjectTask, toggleProjectTask } = useAppStore();
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showAddTask, setShowAddTask] = useState(false);

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;

    await addProjectTask(project.id, {
      title: newTaskTitle,
      completed: false,
      priority: 'medium',
    });

    setNewTaskTitle('');
    setShowAddTask(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success/10 text-success border-success/20';
      case 'completed': return 'bg-primary/10 text-primary border-primary/20';
      case 'on-hold': return 'bg-warning/10 text-warning border-warning/20';
      default: return 'bg-gray-800 text-gray-400';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-danger';
      case 'medium': return 'text-warning';
      case 'low': return 'text-gray-400';
      default: return 'text-gray-400';
    }
  };

  const completedTasks = project.tasks.filter(t => t.completed);
  const pendingTasks = project.tasks.filter(t => !t.completed);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl border border-surface-hover px-4 py-2 text-gray-400 hover:bg-surface-hover hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Projects
        </button>
      </div>

      {/* Project Header Card */}
      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{project.name}</h1>            
            <p className="mt-1 text-gray-400">{project.description}</p>
          </div>
          <span className={`rounded-full border px-4 py-1.5 text-sm font-medium ${getStatusColor(project.status)}`}>
            {project.status}
          </span>
        </div>

        {/* Progress */}
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm text-gray-400">Progress</span>
            <span className="font-medium">{project.progress}%</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface">
            <div 
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2 rounded-xl bg-surface-hover px-4 py-2">
            <CheckCircle className="h-4 w-4 text-success" />
            <span className="text-sm">{completedTasks.length} completed</span>
          </div>
          <div className="flex items-center gap-2 rounded-xl bg-surface-hover px-4 py-2">
            <Circle className="h-4 w-4 text-warning" />
            <span className="text-sm">{pendingTasks.length} pending</span>
          </div>
          {project.dueDate && (
            <div className="flex items-center gap-2 rounded-xl bg-surface-hover px-4 py-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-sm">Due {new Date(project.dueDate).toLocaleDateString()}</span>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {project.tags.map(tag => (
              <span key={tag} className="rounded-full bg-surface-hover px-3 py-1 text-xs text-gray-400">
                #{tag}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Add Task Form */}
      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        {!showAddTask ? (
          <button
            onClick={() => setShowAddTask(true)}
            className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-surface-hover py-4 text-gray-500 transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="h-5 w-5" />
            Add Task to Project
          </button>
        ) : (
          <form onSubmit={handleAddTask} className="flex gap-3">
            <input
              type="text"
              value={newTaskTitle}
              onChange={(e) => setNewTaskTitle(e.target.value)}
              placeholder="Enter task name"
              className="flex-1 rounded-xl border border-surface-hover bg-background px-4 py-3 text-white focus:border-primary focus:outline-none"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowAddTask(false)}
              className="rounded-xl border border-surface-hover px-4 py-3 text-gray-400 hover:bg-surface-hover"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              type="submit"
              className="rounded-xl bg-primary px-6 py-3 font-medium text-white hover:bg-primary-hover"
            >
              Add
            </button>
          </form>
        )}
      </div>

      {/* Tasks List */}
      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        <h2 className="mb-4 text-lg font-semibold">Tasks ({project.tasks.length})</h2>
        
        {project.tasks.length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            No tasks yet. Add one above!
          </div>
        ) : (
          <div className="space-y-2">
            {project.tasks.map((task) => (
              <div 
                key={task.id}
                className="flex items-center gap-3 rounded-xl border border-surface-hover bg-background p-4"
              >
                <button
                  onClick={() => toggleProjectTask(project.id, task.id)}
                  className={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                    task.completed 
                      ? 'border-success bg-success text-white' 
                      : 'border-gray-600 hover:border-primary'
                  }`}
                >
                  {task.completed && <CheckCircle className="h-4 w-4" />}
                </button>
                <span className={`flex-1 ${task.completed ? 'text-gray-500 line-through' : ''}`}>
                  {task.title}
                </span>                
                <span className={`text-xs ${getPriorityColor(task.priority)}`}>
                  {task.priority}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useState } from 'react';
import { ArrowLeft, Plus, CheckCircle, Circle, Clock, Calendar, Edit2, X } from 'lucide-react';
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
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: project.name,
    description: project.description,
    dueDate: project.dueDate || '',
    status: project.status,
    board: project.board || 'general',
    priority: project.priority || 'medium',
    tags: project.tags.join(', '),
  });

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

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();

    await updateProject(project.id, {
      name: editForm.name,
      description: editForm.description,
      dueDate: editForm.dueDate || undefined,
      status: editForm.status as 'backlog' | 'todo' | 'inprogress' | 'done',
      board: editForm.board as 'etsy' | 'photography' | 'wholesale' | 'general',
      priority: editForm.priority as 'low' | 'medium' | 'high',
      tags: editForm.tags.split(',').map(t => t.trim()).filter(Boolean),
    });

    setIsEditing(false);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'backlog': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      case 'todo': return 'bg-warning/10 text-warning border-warning/20';
      case 'inprogress': return 'bg-primary/10 text-primary border-primary/20';
      case 'done': return 'bg-success/10 text-success border-success/20';
      // Legacy statuses
      case 'active': return 'bg-success/10 text-success border-success/20';
      case 'completed': return 'bg-primary/10 text-primary border-primary/20';
      case 'on-hold': return 'bg-warning/10 text-warning border-warning/20';
      default: return 'bg-gray-800 text-gray-400';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high': return 'bg-danger/20 text-danger border-danger/30';
      case 'medium': return 'bg-warning/20 text-warning border-warning/30';
      case 'low': return 'bg-gray-700 text-gray-400 border-gray-600';
      default: return 'bg-gray-700 text-gray-400';
    }
  };

  const getBoardColor = (board?: string) => {
    switch (board) {
      case 'etsy': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'photography': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'wholesale': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      default: return 'bg-gray-700 text-gray-400 border-gray-600';
    }
  };

  const completedTasks = (project.tasks || []).filter(t => t.completed);
  const pendingTasks = (project.tasks || []).filter(t => !t.completed);

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
        {isEditing ? (
          /* Edit Mode */
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Edit Project</h2>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="rounded-lg p-2 text-gray-400 hover:bg-surface-hover"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400">Project Name</label>
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
                required
              />
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400">Description</label>
              <textarea
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm text-gray-400">Due Date</label>
                <input
                  type="date"
                  value={editForm.dueDate}
                  onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                  className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Status</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })}
                  className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
                >
                  <option value="backlog">Backlog</option>
                  <option value="todo">To Do</option>
                  <option value="inprogress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm text-gray-400">Board</label>
                <select
                  value={editForm.board}
                  onChange={(e) => setEditForm({ ...editForm, board: e.target.value as any })}
                  className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
                >
                  <option value="general">General</option>
                  <option value="etsy">Etsy Shop</option>
                  <option value="photography">Photography</option>
                  <option value="wholesale">Wholesale</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Priority</label>
                <select
                  value={editForm.priority}
                  onChange={(e) => setEditForm({ ...editForm, priority: e.target.value as any })}
                  className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block text-sm text-gray-400">Tags (comma separated)</label>
              <input
                type="text"
                value={editForm.tags}
                onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
                placeholder="tag1, tag2, tag3"
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 rounded-xl border border-surface-hover py-2 text-gray-400 hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-primary py-2 font-medium text-white hover:bg-primary-hover"
              >
                Save Changes
              </button>
            </div>
          </form>
        ) : (
          /* View Mode */
          <>
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold">{project.name}</h1>
                <p className="mt-1 text-gray-400">{project.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 rounded-lg border border-surface-hover px-3 py-1.5 text-sm text-gray-400 hover:bg-surface-hover hover:text-white"
                >
                  <Edit2 className="h-4 w-4" />
                  Edit
                </button>
                <div className="flex gap-2">
                  {project.board && project.board !== 'general' && (
                    <span className={`rounded-full border px-3 py-1.5 text-sm font-medium ${getBoardColor(project.board)}`}>
                      {project.board}
                    </span>
                  )}
                  <span className={`rounded-full border px-3 py-1.5 text-sm font-medium ${getStatusColor(project.status)}`}>
                    {project.status}
                  </span>
                  {project.priority && (
                    <span className={`rounded-full border px-3 py-1.5 text-sm font-medium ${getPriorityColor(project.priority)}`}>
                      {project.priority}
                    </span>
                  )}
                </div>
              </div>
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
                {(project.tags || []).map(tag => (
                  <span key={tag} className="rounded-full bg-surface-hover px-3 py-1 text-xs text-gray-400">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          </>
        )}
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
        <h2 className="mb-4 text-lg font-semibold">Tasks ({(project.tasks || []).length})</h2>

        {(project.tasks || []).length === 0 ? (
          <div className="py-8 text-center text-gray-500">
            No tasks yet. Add one above!
          </div>
        ) : (
          <div className="space-y-2">
            {(project.tasks || []).map((task) => (
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

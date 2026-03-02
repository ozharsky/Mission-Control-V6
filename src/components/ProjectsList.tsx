import { useState } from 'react';
import { useAppStore } from '../stores/appStore';
import { Plus, X, ArrowRight } from 'lucide-react';
import { ProjectDetails } from './ProjectDetails';
import type { Project, ProjectTask } from '../types';

interface ProjectsListProps {
  projects: Project[];
}

export function ProjectsList({ projects }: ProjectsListProps) {
  const { addProject } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    dueDate: '',
    tags: ''
  });

  const activeProjects = projects.filter(p => p.status === 'active');
  const completedProjects = projects.filter(p => p.status === 'completed');
  const onHoldProjects = projects.filter(p => p.status === 'on-hold');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success/10 text-success border-success/20';
      case 'completed': return 'bg-primary/10 text-primary border-primary/20';
      case 'on-hold': return 'bg-warning/10 text-warning border-warning/20';
      default: return 'bg-gray-800 text-gray-400';
    }
  };

  // Show project details if a project is selected
  if (selectedProject) {
    return <ProjectDetails project={selectedProject} onBack={() => setSelectedProject(null)} />;
  }

  const getProgressColor = (progress: number) => {
    if (progress >= 75) return 'bg-success';
    if (progress >= 50) return 'bg-primary';
    if (progress >= 25) return 'bg-warning';
    return 'bg-danger';
  };

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name.trim()) return;

    await addProject({
      name: newProject.name,
      description: newProject.description,
      status: 'active',
      progress: 0,
      tasksCompleted: 0,
      tasksTotal: 0,
      dueDate: newProject.dueDate || undefined,
      tags: newProject.tags.split(',').map(t => t.trim()).filter(Boolean),
      tasks: []
    });

    setNewProject({ name: '', description: '', dueDate: '', tags: '' });
    setShowModal(false);
  };

  return (
    <div className="space-y-6">
      {/* Add Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-surface-hover bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">New Project</h3>
              <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAddProject} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-gray-400">Project Name</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
                  placeholder="Enter project name"
                  autoFocus
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Description</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
                  placeholder="Enter description"
                  rows={3}
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Due Date</label>
                <input
                  type="date"
                  value={newProject.dueDate}
                  onChange={(e) => setNewProject({ ...newProject, dueDate: e.target.value })}
                  className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Tags (comma separated)</label>
                <input
                  type="text"
                  value={newProject.tags}
                  onChange={(e) => setNewProject({ ...newProject, tags: e.target.value })}
                  className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
                  placeholder="e.g. etsy, urgent, design"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 rounded-xl border border-surface-hover py-2 text-gray-400 hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary py-2 font-medium text-white hover:bg-primary-hover"
                >
                  Create Project
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Active Projects */}
      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Active Projects</h2>
            <p className="text-sm text-gray-400">{activeProjects.length} projects in progress</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover"
          >
            <Plus className="h-5 w-5" />
            New Project
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {activeProjects.map((project) => (
            <div
              key={project.id}
              className="group rounded-xl border border-surface-hover bg-background p-5 transition-all duration-200 hover:border-primary hover:shadow-lg"
            >
              <div className="mb-4 flex items-start justify-between">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold">{project.name}</h3>
                  <p className="mt-1 text-sm text-gray-400">{project.description}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-medium ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="mb-4">
                <div className="mb-2 flex items-center justify-between text-sm">
                  <span className="text-gray-400">Progress</span>
                  <span className="font-medium">{project.progress}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${getProgressColor(project.progress)}`}
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              {/* Task Summary */}
              <div className="mb-4 rounded-lg bg-surface/50 p-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Tasks</span>
                  <span className="font-medium">
                    <span className="text-success">{project.tasksCompleted}</span>
                    <span className="text-gray-500"> / {project.tasksTotal} completed</span>
                  </span>
                </div>
                
                {/* Mini task list */}
                {project.tasks && project.tasks.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {project.tasks.slice(0, 3).map((task) => (
                      <div key={task.id} className="flex items-center gap-2 text-xs">
                        <div className={`h-3.5 w-3.5 rounded border ${task.completed ? 'bg-success border-success' : 'border-gray-600'}`}>
                          {task.completed && <span className="flex h-full items-center justify-center text-[8px]">✓</span>}
                        </div>
                        <span className={task.completed ? 'text-gray-500 line-through' : 'text-gray-300'}>
                          {task.title}
                        </span>
                      </div>
                    ))}
                    {project.tasks.length > 3 && (
                      <div className="text-xs text-gray-500">+{project.tasks.length - 3} more tasks</div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between">
                <div className="flex flex-wrap gap-2">
                  {project.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-surface px-2.5 py-1 text-xs text-gray-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
                
                <div className="flex items-center gap-3">
                  {project.dueDate && (
                    <span className="text-xs text-gray-500">
                      Due {new Date(project.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                  <button
                    onClick={() => setSelectedProject(project)}
                    className="flex items-center gap-1 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/20"
                  >
                    View
                    <ArrowRight className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {activeProjects.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-surface-hover py-12 text-center text-gray-500">
              <div className="mb-2 text-4xl">📁</div>
              <p>No active projects</p>
              <button 
                onClick={() => setShowModal(true)}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover"
              >
                Create your first project
              </button>
            </div>
          )}
        </div>
      </div>

      {/* On Hold Projects */}
      {onHoldProjects.length > 0 && (
        <div className="rounded-2xl border border-surface-hover bg-surface p-6">
          <h2 className="mb-4 text-lg font-semibold">On Hold</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {onHoldProjects.map((project) => (
              <div
                key={project.id}
                className="rounded-lg border border-surface-hover bg-background/50 p-4 opacity-75"
              >
                <h3 className="font-medium">{project.name}</h3>
                <p className="mt-1 text-sm text-gray-500">{project.tasksCompleted}/{project.tasksTotal} tasks</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Projects */}
      {completedProjects.length > 0 && (
        <div className="rounded-2xl border border-surface-hover bg-surface p-6">
          <h2 className="mb-4 text-lg font-semibold">Completed</h2>
          <div className="space-y-2">
            {completedProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between rounded-lg border border-surface-hover bg-background/50 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-success/10">
                    <span className="text-success">✓</span>
                  </div>
                  <div>
                    <h3 className="font-medium">{project.name}</h3>
                    <p className="text-sm text-gray-500">{project.tasksTotal} tasks completed</p>
                  </div>
                </div>
                <span className="rounded-full bg-success/10 px-3 py-1 text-xs text-success">
                  Completed
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
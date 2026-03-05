import { useState, useMemo } from 'react';
import { useAppStore } from '../stores/appStore';
import { Plus, X, Filter, Calendar, CheckCircle2, Clock, Circle, MoreHorizontal, ArrowRight, Trash2, Edit2 } from 'lucide-react';
import { LoadingButton } from '../components/Loading';
import { ProjectDetails } from './ProjectDetails';
import type { Project } from '../types';

interface ProjectsListProps {
  projects: Project[];
}

type ProjectStatus = 'backlog' | 'todo' | 'inprogress' | 'done';
type ProjectBoard = 'all' | 'etsy' | 'photography' | 'wholesale' | 'general';
type ProjectFilter = 'all' | 'active' | 'completed' | 'high';

const COLUMNS: { id: ProjectStatus; title: string; icon: typeof Circle; color: string }[] = [
  { id: 'backlog', title: 'Backlog', icon: Circle, color: 'bg-gray-500/10 text-gray-400 border-gray-500/20' },
  { id: 'todo', title: 'To Do', icon: Clock, color: 'bg-warning/10 text-warning border-warning/20' },
  { id: 'inprogress', title: 'In Progress', icon: ArrowRight, color: 'bg-primary/10 text-primary border-primary/20' },
  { id: 'done', title: 'Done', icon: CheckCircle2, color: 'bg-success/10 text-success border-success/20' },
];

const BOARDS = [
  { id: 'all', label: 'All Boards' },
  { id: 'etsy', label: 'Etsy Shop' },
  { id: 'photography', label: 'Photography' },
  { id: 'wholesale', label: 'Wholesale' },
  { id: 'general', label: 'General' },
];

export function ProjectsList({ projects }: ProjectsListProps) {
  const { addProject, updateProject, deleteProject } = useAppStore();
  const [showModal, setShowModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [selectedBoard, setSelectedBoard] = useState<ProjectBoard>('all');
  const [selectedFilter, setSelectedFilter] = useState<ProjectFilter>('all');
  const [draggedProject, setDraggedProject] = useState<Project | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [newProject, setNewProject] = useState({
    name: '',
    description: '',
    dueDate: '',
    tags: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
    board: 'general' as Project['board'],
  });

  // Filter projects
  const filteredProjects = useMemo(() => {
    let filtered = projects;

    // Filter by board
    if (selectedBoard !== 'all') {
      filtered = filtered.filter(p => p.board === selectedBoard || (!p.board && selectedBoard === 'general'));
    }

    // Filter by type
    switch (selectedFilter) {
      case 'active':
        filtered = filtered.filter(p => p.status !== 'done');
        break;
      case 'completed':
        filtered = filtered.filter(p => p.status === 'done');
        break;
      case 'high':
        filtered = filtered.filter(p => p.priority === 'high' && p.status !== 'done');
        break;
    }

    return filtered;
  }, [projects, selectedBoard, selectedFilter]);

  // Group by status
  const projectsByStatus = useMemo(() => {
    const grouped: Record<ProjectStatus, Project[]> = {
      backlog: [],
      todo: [],
      inprogress: [],
      done: [],
    };
    filteredProjects.forEach(p => {
      const status = p.status as ProjectStatus;
      if (grouped[status]) {
        grouped[status].push(p);
      } else {
        grouped.backlog.push(p);
      }
    });
    return grouped;
  }, [filteredProjects]);

  const handleAddProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.name.trim()) return;

    setIsSubmitting(true);
    try {
      await addProject({
        name: newProject.name,
        description: newProject.description,
        status: 'backlog',
        progress: 0,
        tasksCompleted: 0,
        tasksTotal: 0,
        dueDate: newProject.dueDate || undefined,
        tags: newProject.tags.split(',').map(t => t.trim()).filter(Boolean),
        tasks: [],
        priority: newProject.priority,
        board: newProject.board,
      });

      setNewProject({ name: '', description: '', dueDate: '', tags: '', priority: 'medium', board: 'general' });
      setShowModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject || !newProject.name.trim()) return;

    setIsSubmitting(true);
    try {
      await updateProject(editingProject.id, {
        name: newProject.name,
        description: newProject.description,
        dueDate: newProject.dueDate || undefined,
        tags: newProject.tags.split(',').map(t => t.trim()).filter(Boolean),
        priority: newProject.priority,
        board: newProject.board,
      });

      setNewProject({ name: '', description: '', dueDate: '', tags: '', priority: 'medium', board: 'general' });
      setEditingProject(null);
      setShowModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDragStart = (project: Project) => {
    setDraggedProject(project);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, status: ProjectStatus) => {
    e.preventDefault();
    if (!draggedProject) return;

    if (draggedProject.status !== status) {
      await updateProject(draggedProject.id, {
        status,
        progress: status === 'done' ? 100 : draggedProject.progress,
      });
    }
    setDraggedProject(null);
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

  const getDaysUntilDue = (dueDate?: string) => {
    if (!dueDate) return null;
    const due = new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diff = due.getTime() - today.getTime();
    return Math.ceil(diff / (1000 * 60 * 60 * 24));
  };

  // Show project details if selected
  if (selectedProject) {
    return <ProjectDetails project={selectedProject} onBack={() => setSelectedProject(null)} />;
  }

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* Filters */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-surface-hover bg-surface p-4">
        <div className="flex flex-wrap items-center gap-4">
          {/* Board Filter */}
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={selectedBoard}
              onChange={(e) => setSelectedBoard(e.target.value as ProjectBoard)}
              className="rounded-lg border border-surface-hover bg-background px-3 py-1.5 text-sm text-white"
            >
              {BOARDS.map(b => (
                <option key={b.id} value={b.id}>{b.label}</option>
              ))}
            </select>
          </div>

          {/* Type Filter */}
          <div className="flex flex-wrap items-center gap-2">
            {(['all', 'active', 'completed', 'high'] as const).map(filter => (
              <button
                key={filter}
                onClick={() => setSelectedFilter(filter)}
                className={`min-h-[44px] rounded-lg px-3 py-1.5 text-sm capitalize ${
                  selectedFilter === filter
                    ? 'bg-primary text-white'
                    : 'border border-surface-hover text-gray-400 hover:bg-surface-hover'
                }`}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary-hover"
        >
          <Plus className="h-4 w-4" />
          New Project
        </button>
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {COLUMNS.map(column => (
          <div
            key={column.id}
            className="flex flex-col rounded-xl border border-surface-hover bg-surface/50"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, column.id)}
          >
            {/* Column Header */}
            <div className={`flex items-center justify-between border-b border-surface-hover/50 px-4 py-3 ${column.color}`}>
              <div className="flex items-center gap-2">
                <column.icon className="h-4 w-4" />
                <span className="font-medium">{column.title}</span>
              </div>
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs">
                {projectsByStatus[column.id].length}
              </span>
            </div>

            {/* Column Content */}
            <div className="flex-1 space-y-3 p-3">
              {projectsByStatus[column.id].map(project => {
                const daysUntilDue = getDaysUntilDue(project.dueDate);
                const isOverdue = daysUntilDue !== null && daysUntilDue < 0 && project.status !== 'done';

                return (
                  <div
                    key={project.id}
                    draggable
                    onDragStart={() => handleDragStart(project)}
                    className="group relative rounded-lg border border-surface-hover bg-background p-3 transition-all hover:border-primary hover:shadow-md"
                  >
                    {/* Action Buttons - Always visible on mobile, hover on desktop */}
                    <div className="absolute right-2 top-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingProject(project);
                          setNewProject({
                            name: project.name,
                            description: project.description || '',
                            dueDate: project.dueDate || '',
                            tags: project.tags?.join(', ') || '',
                            priority: project.priority || 'medium',
                            board: project.board || 'general',
                          });
                          setShowModal(true);
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-hover text-gray-400 hover:bg-primary/20 hover:text-primary"
                        title="Edit project"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete project "${project.name}"? This cannot be undone.`)) {
                            deleteProject(project.id);
                          }
                        }}
                        className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-hover text-gray-400 hover:bg-danger/20 hover:text-danger"
                        title="Delete project"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    {/* Clickable area for details */}
                    <div onClick={() => setSelectedProject(project)} className="cursor-pointer">
                      {/* Header */}
                      <div className="mb-2 flex items-start justify-between pr-16">
                        <h3 className="flex-1 pr-2 text-sm font-medium">{project.name}</h3>
                        {project.priority && (
                          <span className={`rounded-full border px-2 py-0.5 text-xs ${getPriorityColor(project.priority)}`}>
                            {project.priority}
                          </span>
                        )}
                      </div>

                      {/* Description */}
                      {project.description && (
                        <p className="mb-2 line-clamp-2 text-xs text-gray-500">{project.description}</p>
                      )}

                      {/* Board Badge */}
                      {project.board && project.board !== 'general' && (
                        <div className="mb-2">
                          <span className={`rounded-full border px-2 py-0.5 text-xs ${getBoardColor(project.board)}`}>
                            {project.board}
                          </span>
                        </div>
                      )}

                      {/* Progress */}
                      <div className="mb-2">
                        <div className="h-1.5 overflow-hidden rounded-full bg-surface">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${project.progress}%` }}
                          />
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <div className="flex items-center gap-2">
                          {project.dueDate && (
                            <span className={`flex items-center gap-1 ${isOverdue ? 'text-danger' : ''}`}>
                              <Calendar className="h-3 w-3" />
                              {isOverdue ? `${Math.abs(daysUntilDue)}d overdue` : `${daysUntilDue}d left`}
                            </span>
                          )}
                        </div>
                        <span>{project.tasksCompleted}/{project.tasksTotal} tasks</span>
                      </div>

                      {/* Tags */}
                      {(project.tags || []).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {(project.tags || []).slice(0, 2).map(tag => (
                            <span key={tag} className="rounded bg-surface-hover px-1.5 py-0.5 text-xs text-gray-400">
                              #{tag}
                            </span>
                          ))}
                          {(project.tags || []).length > 2 && (
                            <span className="text-xs text-gray-500">+{(project.tags || []).length - 2}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {projectsByStatus[column.id].length === 0 && (
                <div className="rounded-xl touch-feedback border border-dashed border-surface-hover py-8 text-center text-gray-500">
                  <Circle className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p className="text-sm">No projects</p>
                  <p className="text-xs opacity-70">Drag projects here</p>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-surface-hover bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">{editingProject ? 'Edit Project' : 'New Project'}</h3>
              <button 
                onClick={() => {
                  setShowModal(false);
                  setEditingProject(null);
                  setNewProject({ name: '', description: '', dueDate: '', tags: '', priority: 'medium', board: 'general' });
                }} 
                className="flex h-11 w-11 items-center justify-center text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={editingProject ? handleEditProject : handleAddProject} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-gray-400">Project Name</label>
                <input
                  type="text"
                  value={newProject.name}
                  onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                  className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white"
                  placeholder="Enter project name"
                  autoFocus
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Description</label>
                <textarea
                  value={newProject.description}
                  onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                  className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white"
                  placeholder="Enter description"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm text-gray-400">Board</label>
                  <select
                    value={newProject.board}
                    onChange={(e) => setNewProject({ ...newProject, board: e.target.value as Project['board'] })}
                    className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white"
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
                    value={newProject.priority}
                    onChange={(e) => setNewProject({ ...newProject, priority: e.target.value as 'low' | 'medium' | 'high' })}
                    className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Due Date</label>
                <input
                  type="date"
                  value={newProject.dueDate}
                  onChange={(e) => setNewProject({ ...newProject, dueDate: e.target.value })}
                  className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Tags (comma separated)</label>
                <input
                  type="text"
                  value={newProject.tags}
                  onChange={(e) => setNewProject({ ...newProject, tags: e.target.value })}
                  className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white"
                  placeholder="tag1, tag2, tag3"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    setEditingProject(null);
                    setNewProject({ name: '', description: '', dueDate: '', tags: '', priority: 'medium', board: 'general' });
                  }}
                  className="flex-1 rounded-xl border border-surface-hover py-2 text-gray-400 hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  isLoading={isSubmitting}
                  loadingText={editingProject ? 'Saving...' : 'Creating...'}
                  className="flex-1 rounded-xl bg-primary py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {editingProject ? 'Save Changes' : 'Create Project'}
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on-hold';
  progress: number;
  tasksCompleted: number;
  tasksTotal: number;
  dueDate?: string;
  tags: string[];
  tasks: ProjectTask[];
}

interface ProjectTask {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
}

interface ProjectsListProps {
  projects: Project[];
}

export function ProjectsList({ projects }: ProjectsListProps) {
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

  const getProgressColor = (progress: number) => {
    if (progress >= 75) return 'bg-success';
    if (progress >= 50) return 'bg-primary';
    if (progress >= 25) return 'bg-warning';
    return 'bg-danger';
  };

  return (
    <div className="space-y-6">
      {/* Active Projects */}
      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold">Active Projects</h2>
            <p className="text-sm text-gray-400">{activeProjects.length} projects in progress</p>
          </div>
          <button className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-medium text-white hover:bg-primary-hover">
            <span className="text-lg">+</span>
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
                
                {project.dueDate && (
                  <span className="text-xs text-gray-500">
                    Due {new Date(project.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                  </span>
                )}
              </div>
            </div>
          ))}

          {activeProjects.length === 0 && (
            <div className="col-span-full rounded-xl border border-dashed border-surface-hover py-12 text-center text-gray-500">
              <div className="mb-2 text-4xl">📁</div>
              <p>No active projects</p>
              <button className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-white hover:bg-primary-hover">
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
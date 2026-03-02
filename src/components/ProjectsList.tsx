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
}

interface ProjectsListProps {
  projects: Project[];
}

export function ProjectsList({ projects }: ProjectsListProps) {
  const activeProjects = projects.filter(p => p.status === 'active');
  const completedProjects = projects.filter(p => p.status === 'completed');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success-light text-success';
      case 'completed': return 'bg-primary-light text-primary';
      case 'on-hold': return 'bg-warning-light text-warning';
      default: return 'bg-gray-800 text-gray-400';
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-surface-hover bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Active Projects</h2>
          <span className="rounded-full bg-primary-light px-3 py-1 text-sm text-primary">
            {activeProjects.length} active
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {activeProjects.map((project) => (
            <div
              key={project.id}
              className="rounded-lg border border-surface-hover bg-background p-4"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <h3 className="font-semibold">{project.name}</h3>
                  <p className="text-sm text-gray-400">{project.description}</p>
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs ${getStatusColor(project.status)}`}>
                  {project.status}
                </span>
              </div>

              <div className="mb-3">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-gray-400">Progress</span>
                  <span>{project.progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">
                  {project.tasksCompleted}/{project.tasksTotal} tasks
                </span>
                {project.dueDate && (
                  <span className="text-gray-500">
                    Due: {new Date(project.dueDate).toLocaleDateString()}
                  </span>
                )}
              </div>

              {project.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {project.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-surface px-2 py-0.5 text-xs text-gray-400"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}

          {activeProjects.length === 0 && (
            <div className="col-span-full py-8 text-center text-gray-500">
              No active projects
            </div>
          )}
        </div>
      </div>

      {completedProjects.length > 0 && (
        <div className="rounded-xl border border-surface-hover bg-surface p-6">
          <h2 className="mb-4 text-lg font-semibold">Completed Projects</h2>
          
          <div className="space-y-3">
            {completedProjects.map((project) => (
              <div
                key={project.id}
                className="flex items-center justify-between rounded-lg border border-surface-hover bg-background p-4"
              >
                <div>
                  <h3 className="font-medium">{project.name}</h3>
                  <p className="text-sm text-gray-400">{project.description}</p>
                </div>
                <span className="rounded-full bg-primary-light px-2 py-0.5 text-xs text-primary">
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
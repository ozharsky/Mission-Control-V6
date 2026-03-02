interface DashboardStatsProps {
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
}

export function DashboardStats({ pendingTasks, inProgressTasks, completedTasks }: DashboardStatsProps) {
  const stats = [
    { label: 'Pending Tasks', value: pendingTasks, color: 'warning' },
    { label: 'In Progress', value: inProgressTasks, color: 'primary' },
    { label: 'Completed', value: completedTasks, color: 'success' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="rounded-xl border border-surface-hover bg-surface p-6"
        >
          <div className="text-3xl font-bold">{stat.value}</div>
          <div className="mt-1 text-sm text-gray-400">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}
import { useEffect, useState } from 'react';

interface DashboardStatsProps {
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
}

interface StatCardProps {
  label: string;
  value: number;
  icon: string;
  color: 'primary' | 'success' | 'warning' | 'danger';
  trend?: number;
}

function StatCard({ label, value, icon, color, trend }: StatCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);

  const colorClasses = {
    primary: 'from-primary/20 to-primary/5 text-primary border-primary/30',
    success: 'from-success/20 to-success/5 text-success border-success/30',
    warning: 'from-warning/20 to-warning/5 text-warning border-warning/30',
    danger: 'from-danger/20 to-danger/5 text-danger border-danger/30',
  };

  useEffect(() => {
    setIsVisible(true);
    const duration = 600;
    const steps = 30;
    const increment = value / steps;
    let current = 0;
    
    const timer = setInterval(() => {
      current += increment;
      if (current >= value) {
        setDisplayValue(value);
        clearInterval(timer);
      } else {
        setDisplayValue(Math.floor(current));
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [value]);

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-6 transition-all duration-500 hover:scale-[1.02] hover:shadow-lg ${
        colorClasses[color]
      } ${isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'}`}
    >
      <div className="relative z-10">
        <div className="mb-4 flex items-center justify-between">
          <span className="text-3xl">{icon}</span>
          {trend !== undefined && (
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              trend >= 0 ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
            }`}>
              {trend >= 0 ? '+' : ''}{trend}%
            </span>
          )}
        </div>
        
        <div className="text-4xl font-bold">{displayValue}</div>
        <div className="mt-1 text-sm font-medium opacity-80">{label}</div>
      </div>

      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/5"></div>
      <div className="absolute -bottom-8 -left-8 h-32 w-32 rounded-full bg-white/5"></div>
    </div>
  );
}

export function DashboardStats({ pendingTasks, inProgressTasks, completedTasks }: DashboardStatsProps) {
  const total = pendingTasks + inProgressTasks + completedTasks;
  const completionRate = total > 0 ? Math.round((completedTasks / total) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard
          label="Pending"
          value={pendingTasks}
          icon="⏳"
          color="warning"
        />
        <StatCard
          label="In Progress"
          value={inProgressTasks}
          icon="🔄"
          color="primary"
        />
        <StatCard
          label="Completed"
          value={completedTasks}
          icon="✅"
          color="success"
        />
        
        <StatCard
          label="Completion Rate"
          value={completionRate}
          icon="📈"
          color="primary"
          trend={12}
        />
      </div>

      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">Task Progress</h3>
          <span className="text-sm text-gray-400">{completionRate}% complete</span>
        </div>
        
        <div className="h-4 overflow-hidden rounded-full bg-surface-hover">
          <div className="flex h-full">
            <div
              className="h-full bg-warning transition-all duration-1000"
              style={{ width: `${total > 0 ? (pendingTasks / total) * 100 : 0}%` }}
            />
            <div
              className="h-full bg-primary transition-all duration-1000"
              style={{ width: `${total > 0 ? (inProgressTasks / total) * 100 : 0}%` }}
            />
            <div
              className="h-full bg-success transition-all duration-1000"
              style={{ width: `${total > 0 ? (completedTasks / total) * 100 : 0}%` }}
            />
          </div>
        </div>
        
        <div className="mt-4 flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-warning"></div>
            <span className="text-gray-400">Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-primary"></div>
            <span className="text-gray-400">In Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-success"></div>
            <span className="text-gray-400">Completed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useEffect, useState } from 'react';
import { CheckCircle2, Clock, Circle, TrendingUp, MoreHorizontal } from 'lucide-react';

interface DashboardStatsProps {
  pendingTasks: number;
  inProgressTasks: number;
  completedTasks: number;
}

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: 'primary' | 'success' | 'warning' | 'danger';
  subtext?: string;
}

function StatCard({ label, value, icon, color, subtext }: StatCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);

  const colorClasses = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    danger: 'bg-danger/10 text-danger border-danger/20',
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
      className={`relative overflow-hidden rounded-xl border border-surface-hover bg-surface p-4 transition-all duration-500 hover:border-primary/50 sm:p-5 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${colorClasses[color]}`}>
          {icon}
        </div>
        {subtext && (
          <span className="text-xs text-gray-500">{subtext}</span>
        )}
      </div>
      
      <div className="mt-3">
        <div className="text-2xl font-bold sm:text-3xl">{displayValue}</div>
        <div className="text-sm text-gray-400">{label}</div>
      </div>
    </div>
  );
}

export function DashboardStats({ pendingTasks, inProgressTasks, completedTasks }: DashboardStatsProps) {
  const total = pendingTasks + inProgressTasks + completedTasks;
  const completionRate = total > 0 ? Math.round((completedTasks / total) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Stats Grid - Mobile: 2 columns, Desktop: 4 columns */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Pending"
          value={pendingTasks}
          icon={<Circle className="h-5 w-5" />}
          color="warning"
          subtext="To do"
        />
        <StatCard
          label="In Progress"
          value={inProgressTasks}
          icon={<Clock className="h-5 w-5" />}
          color="primary"
          subtext="Active"
        />
        <StatCard
          label="Completed"
          value={completedTasks}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="success"
          subtext="Done"
        />
        <StatCard
          label="Progress"
          value={completionRate}
          icon={<TrendingUp className="h-5 w-5" />}
          color="primary"
          subtext="% done"
        />
      </div>

      {/* Progress Bar - Compact for mobile */}
      <div className="rounded-xl touch-feedback border border-surface-hover bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium">Task Distribution</h3>
          <span className="text-xs text-gray-400">{total} total</span>
        </div>
        
        {/* Stacked Progress Bar */}
        <div className="h-3 overflow-hidden rounded-full bg-surface-hover">
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
        
        {/* Legend - Horizontal scroll on mobile if needed */}
        <div className="mt-3 flex flex-wrap gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-warning"></div>
            <span className="text-gray-400">Pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-primary"></div>
            <span className="text-gray-400">In Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-success"></div>
            <span className="text-gray-400">Completed</span>
          </div>
        </div>
      </div>
    </div>
  );
}
import { useEffect, useState, useMemo } from 'react';
import { 
  CheckCircle2, Clock, Circle, TrendingUp, ArrowRight, AlertCircle,
  Briefcase, Package, DollarSign, Printer, Calendar, Zap,
  MoreHorizontal, ChevronRight
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import type { Task, Project, Job, InventoryItem } from '../types';

interface StatCardProps {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  color: 'primary' | 'success' | 'warning' | 'danger' | 'info';
  subtext?: string;
  trend?: number;
  href?: string;
  onClick?: () => void;
}

function StatCard({ label, value, icon, color, subtext, trend, href, onClick }: StatCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [displayValue, setDisplayValue] = useState(0);
  const numericValue = typeof value === 'number' ? value : 0;

  const colorClasses = {
    primary: 'bg-primary/10 text-primary border-primary/20',
    success: 'bg-success/10 text-success border-success/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    danger: 'bg-danger/10 text-danger border-danger/20',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };

  useEffect(() => {
    setIsVisible(true);
    if (typeof value === 'number') {
      const duration = 600;
      const steps = 30;
      const increment = numericValue / steps;
      let current = 0;
      
      const timer = setInterval(() => {
        current += increment;
        if (current >= numericValue) {
          setDisplayValue(numericValue);
          clearInterval(timer);
        } else {
          setDisplayValue(Math.floor(current));
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }
  }, [value, numericValue]);

  const content = (
    <div
      className={`relative overflow-hidden rounded-xl border border-surface-hover bg-surface p-4 transition-all duration-300 hover:border-primary/50 hover:shadow-lg sm:p-5 ${
        isVisible ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
      } ${href || onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${colorClasses[color]}`}>
          {icon}
        </div>
        <div className="flex flex-col items-end gap-1">
          {trend !== undefined && (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${trend >= 0 ? 'text-success' : 'text-danger'}`}>
              <TrendingUp className={`h-3 w-3 ${trend < 0 ? 'rotate-180' : ''}`} />
              {Math.abs(trend)}%
            </span>
          )}
          {(href || onClick) && <ChevronRight className="h-4 w-4 text-gray-500" />}
        </div>
      </div>
      
      <div className="mt-3">
        <div className="text-2xl font-bold sm:text-3xl">
          {typeof value === 'number' ? displayValue : value}
        </div>
        <div className="text-sm text-gray-400">{label}</div>
        {subtext && <div className="mt-1 text-xs text-gray-500">{subtext}</div>}
      </div>
    </div>
  );

  if (href) {
    return <a href={href}>{content}</a>;
  }
  if (onClick) {
    return <div onClick={onClick}>{content}</div>;
  }
  return content;
}

interface QuickActionProps {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  color?: 'primary' | 'success' | 'warning';
}

function QuickAction({ icon, label, onClick, color = 'primary' }: QuickActionProps) {
  const colorClasses = {
    primary: 'hover:bg-primary/10 hover:border-primary/30',
    success: 'hover:bg-success/10 hover:border-success/30',
    warning: 'hover:bg-warning/10 hover:border-warning/30',
  };

  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-2 rounded-xl border border-surface-hover bg-surface p-4 transition-all ${colorClasses[color]}`}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-hover">
        {icon}
      </div>
      <span className="text-xs font-medium text-gray-400">{label}</span>
    </button>
  );
}

interface ActivityItemProps {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  time: string;
  color: string;
}

function ActivityItem({ icon, title, subtitle, time, color }: ActivityItemProps) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-background p-3">
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{title}</div>
        <div className="truncate text-xs text-gray-500">{subtitle}</div>
      </div>
      <div className="shrink-0 text-xs text-gray-500">{time}</div>
    </div>
  );
}

interface DashboardViewProps {
  onNavigate: (section: string) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const { tasks, projects, jobs, inventory, printers, revenue } = useAppStore();

  // Calculate stats
  const taskStats = useMemo(() => {
    const total = tasks.pending.length + tasks.inProgress.length + tasks.completed.length;
    const completionRate = total > 0 ? Math.round((tasks.completed.length / total) * 100) : 0;
    const urgentTasks = tasks.pending.filter(t => t.priority === 'high').length;
    const dueSoon = [...tasks.pending, ...tasks.inProgress].filter(t => {
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      const today = new Date();
      const diff = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diff <= 3 && diff >= 0;
    }).length;
    
    return { total, completionRate, urgentTasks, dueSoon };
  }, [tasks]);

  const projectStats = useMemo(() => {
    const active = projects.filter(p => p.status !== 'done').length;
    const completed = projects.filter(p => p.status === 'done').length;
    const overdue = projects.filter(p => {
      if (!p.dueDate || p.status === 'done') return false;
      return new Date(p.dueDate) < new Date();
    }).length;
    return { active, completed, overdue, total: projects.length };
  }, [projects]);

  const jobStats = useMemo(() => {
    const newJobs = jobs.filter(j => j.status === 'new').length;
    const applied = jobs.filter(j => j.status === 'applied').length;
    return { total: jobs.length, new: newJobs, applied };
  }, [jobs]);

  const inventoryStats = useMemo(() => {
    const lowStock = inventory.filter(i => i.quantity <= i.minStock).length;
    const totalValue = inventory.reduce((sum, i) => sum + (i.quantity * i.unitCost), 0);
    return { lowStock, totalValue, total: inventory.length };
  }, [inventory]);

  const revenueStats = useMemo(() => {
    if (!revenue) return { total: 0, orders: 0, avgOrder: 0 };
    const data = Object.values(revenue) as Array<{ value: number; orders: number }>;
    const total = data.reduce((sum, r) => sum + (r.value || 0), 0);
    const orders = data.reduce((sum, r) => sum + (r.orders || 0), 0);
    return { total, orders, avgOrder: orders > 0 ? Math.round(total / orders) : 0 };
  }, [revenue]);

  const printerStats = useMemo(() => {
    const online = printers.filter(p => p.status === 'operational' || p.status === 'printing').length;
    const printing = printers.filter(p => p.status === 'printing').length;
    return { total: printers.length, online, printing };
  }, [printers]);

  // Get recent activity
  const recentTasks = [...tasks.pending, ...tasks.inProgress]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 3);

  const urgentTasks = tasks.pending
    .filter(t => t.priority === 'high' || (t.dueDate && new Date(t.dueDate) <= new Date(Date.now() + 24 * 60 * 60 * 1000)))
    .slice(0, 3);

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Welcome Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold sm:text-2xl">Dashboard</h1>
          <p className="text-sm text-gray-400">Overview of your business operations</p>
        </div>
        <div className="text-right">
          <div className="text-sm text-gray-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        </div>
      </div>

      {/* Quick Actions - Horizontal scroll on mobile */}
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        <QuickAction 
          icon={<Zap className="h-5 w-5 text-primary" />} 
          label="Add Task" 
          onClick={() => onNavigate('tasks')}
        />
        <QuickAction 
          icon={<Briefcase className="h-5 w-5 text-success" />} 
          label="Add Job" 
          onClick={() => onNavigate('jobs')}
          color="success"
        />
        <QuickAction 
          icon={<Package className="h-5 w-5 text-warning" />} 
          label="Add Item" 
          onClick={() => onNavigate('inventory')}
          color="warning"
        />
        <QuickAction 
          icon={<DollarSign className="h-5 w-5 text-primary" />} 
          label="Add Revenue" 
          onClick={() => onNavigate('revenue')}
        />
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          label="Tasks"
          value={taskStats.total}
          icon={<CheckCircle2 className="h-5 w-5" />}
          color="primary"
          subtext={`${taskStats.urgentTasks} urgent`}
          onClick={() => onNavigate('tasks')}
        />
        <StatCard
          label="Projects"
          value={projectStats.active}
          icon={<Briefcase className="h-5 w-5" />}
          color="info"
          subtext={`${projectStats.completed} completed`}
          onClick={() => onNavigate('projects')}
        />
        <StatCard
          label="Revenue"
          value={`$${revenueStats.total.toLocaleString()}`}
          icon={<DollarSign className="h-5 w-5" />}
          color="success"
          subtext={`${revenueStats.orders} orders`}
          onClick={() => onNavigate('revenue')}
        />
        <StatCard
          label="Printers"
          value={printerStats.online}
          icon={<Printer className="h-5 w-5" />}
          color={printerStats.printing > 0 ? 'warning' : 'success'}
          subtext={`${printerStats.printing} printing`}
          onClick={() => onNavigate('printers')}
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:gap-4">
        <StatCard
          label="Jobs"
          value={jobStats.total}
          icon={<Briefcase className="h-4 w-4" />}
          color="info"
          subtext={`${jobStats.new} new`}
          onClick={() => onNavigate('jobs')}
        />
        <StatCard
          label="Inventory"
          value={inventoryStats.total}
          icon={<Package className="h-4 w-4" />}
          color={inventoryStats.lowStock > 0 ? 'warning' : 'primary'}
          subtext={inventoryStats.lowStock > 0 ? `${inventoryStats.lowStock} low stock` : 'All good'}
          onClick={() => onNavigate('inventory')}
        />
        <StatCard
          label="Task Progress"
          value={`${taskStats.completionRate}%`}
          icon={<TrendingUp className="h-4 w-4" />}
          color="success"
          subtext="Completion rate"
        />
        <StatCard
          label="Due Soon"
          value={taskStats.dueSoon}
          icon={<Clock className="h-4 w-4" />}
          color={taskStats.dueSoon > 0 ? 'warning' : 'primary'}
          subtext="Next 3 days"
          onClick={() => onNavigate('tasks')}
        />
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
        {/* Urgent Tasks */}
        <div className="rounded-xl border border-surface-hover bg-surface p-4 lg:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-danger" />
              <h3 className="font-semibold">Urgent & Due Soon</h3>
            </div>
            <button 
              onClick={() => onNavigate('tasks')}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View All <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          
          <div className="space-y-2">
            {urgentTasks.length > 0 ? (
              urgentTasks.map(task => (
                <ActivityItem
                  key={task.id}
                  icon={<Circle className="h-4 w-4" />}
                  title={task.title}
                  subtitle={task.dueDate ? `Due ${new Date(task.dueDate).toLocaleDateString()}` : 'No due date'}
                  time={task.priority === 'high' ? 'High' : 'Due soon'}
                  color={task.priority === 'high' ? 'bg-danger/10 text-danger' : 'bg-warning/10 text-warning'}
                />
              ))
            ) : (
              <div className="rounded-lg bg-background py-8 text-center">
                <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-success/50" />
                <p className="text-sm text-gray-500">No urgent tasks</p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="rounded-xl border border-surface-hover bg-surface p-4 lg:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Recent Tasks</h3>
            </div>
            <button 
              onClick={() => onNavigate('tasks')}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View All <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          
          <div className="space-y-2">
            {recentTasks.length > 0 ? (
              recentTasks.map(task => (
                <ActivityItem
                  key={task.id}
                  icon={<Clock className="h-4 w-4" />}
                  title={task.title}
                  subtitle={task.projectId ? 'Linked to project' : 'Personal task'}
                  time={new Date(task.createdAt).toLocaleDateString()}
                  color="bg-primary/10 text-primary"
                />
              ))
            ) : (
              <div className="rounded-lg bg-background py-8 text-center">
                <Circle className="mx-auto mb-2 h-8 w-8 text-gray-600" />
                <p className="text-sm text-gray-500">No recent tasks</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Printer Status Preview */}
      {printers.length > 0 && (
        <div className="rounded-xl border border-surface-hover bg-surface p-4 lg:p-5">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">Printer Status</h3>
            </div>
            <button 
              onClick={() => onNavigate('printers')}
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View All <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {printers.slice(0, 4).map(printer => (
              <div 
                key={printer.id}
                className="rounded-lg bg-background p-3"
              >
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${
                    printer.status === 'printing' ? 'bg-primary animate-pulse' :
                    printer.status === 'operational' ? 'bg-success' : 'bg-gray-500'
                  }`} />
                  <span className="truncate text-sm font-medium">{printer.name}</span>
                </div>
                {printer.job && (
                  <div className="mt-2">
                    <div className="h-1.5 overflow-hidden rounded-full bg-surface-hover">
                      <div 
                        className="h-full bg-primary transition-all"
                        style={{ width: `${printer.job.progress || 0}%` }}
                      />
                    </div>
                    <div className="mt-1 text-xs text-gray-500">
                      {printer.job.progress || 0}% • {printer.job.name || 'Printing'}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
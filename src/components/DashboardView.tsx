import { useMemo, useState } from 'react';
import { 
  CheckCircle2, Clock, Circle, TrendingUp, AlertCircle,
  Briefcase, Package, DollarSign, Printer, Zap, Flame, Thermometer,
  ChevronRight, Sparkles, Target, Calendar, AlertTriangle, TrendingDown,
  Activity, Award, BarChart3, Plus, ChevronDown, ChevronUp
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { RevenueMiniChart } from './RevenueMiniChart';
import type { Task, Project, Job, InventoryItem, Printer } from '../types';

// AI Insights Card Component
function AIInsightsCard({ 
  tasks, 
  projects, 
  revenue, 
  printers, 
  inventory, 
  jobs,
  onNavigate 
}: { 
  tasks: { pending: Task[]; inProgress: Task[]; completed: Task[] };
  projects: Project[];
  revenue: any;
  printers: Printer[];
  inventory: InventoryItem[];
  jobs: Job[];
  onNavigate: (s: string) => void;
}) {
  const insights = useMemo(() => {
    const items: Array<{
      id: string;
      type: 'urgent' | 'warning' | 'success' | 'info';
      icon: React.ReactNode;
      title: string;
      message: string;
      action?: { label: string; section: string };
    }> = [];

    // 1. Critical: Overdue tasks
    const overdueTasks = tasks.pending.filter(t => t.dueDate && new Date(t.dueDate) < new Date());
    if (overdueTasks.length > 0) {
      items.push({
        id: 'overdue',
        type: 'urgent',
        icon: <AlertCircle className="h-4 w-4" />,
        title: `${overdueTasks.length} Overdue`,
        message: overdueTasks.slice(0, 2).map(t => t.title).join(', ') + (overdueTasks.length > 2 ? ` +${overdueTasks.length - 2}` : ''),
        action: { label: 'View', section: 'tasks' }
      });
    }

    // 2. Critical: Out of stock items
    const outOfStock = inventory.filter(i => i.quantity === 0);
    if (outOfStock.length > 0) {
      items.push({
        id: 'outofstock',
        type: 'urgent',
        icon: <Package className="h-4 w-4" />,
        title: 'Out of Stock',
        message: `${outOfStock.slice(0, 2).map(i => i.name).join(', ')}${outOfStock.length > 2 ? ` +${outOfStock.length - 2}` : ''}`,
        action: { label: 'Restock', section: 'inventory' }
      });
    }

    // 3. Warning: Low stock
    const lowStock = inventory.filter(i => i.quantity > 0 && i.quantity <= i.minStock);
    if (lowStock.length > 0 && outOfStock.length === 0) {
      items.push({
        id: 'lowstock',
        type: 'warning',
        icon: <AlertTriangle className="h-4 w-4" />,
        title: `${lowStock.length} Low Stock`,
        message: `Restock soon`,
        action: { label: 'View', section: 'inventory' }
      });
    }

    // 4. Warning: Due soon tasks
    const dueSoon = tasks.pending.filter(t => {
      if (!t.dueDate) return false;
      const days = Math.ceil((new Date(t.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      return days >= 0 && days <= 2;
    });
    if (dueSoon.length > 0 && overdueTasks.length === 0) {
      items.push({
        id: 'duesoon',
        type: 'warning',
        icon: <Clock className="h-4 w-4" />,
        title: `${dueSoon.length} Due Soon`,
        message: `Next 2 days`,
        action: { label: 'View', section: 'tasks' }
      });
    }

    // 5. Revenue insights
    if (revenue) {
      const revenueData = Object.values(revenue).filter((r: any) => r && r.month) as Array<{ value: number; orders: number; month: string }>;
      
      if (revenueData.length >= 2) {
        const sorted = revenueData.sort((a, b) => a.month.localeCompare(b.month));
        const current = sorted[sorted.length - 1];
        const last = sorted[sorted.length - 2];
        const change = ((current.value - last.value) / last.value) * 100;
        
        if (change > 20) {
          items.push({
            id: 'revenueup',
            type: 'success',
            icon: <TrendingUp className="h-4 w-4" />,
            title: 'Revenue Up!',
            message: `+${change.toFixed(0)}% this month`,
            action: { label: 'View', section: 'revenue' }
          });
        }
      }
    }

    // 6. Printer status
    if (printers.length > 0) {
      const printing = printers.filter(p => p.status === 'printing');
      if (printing.length > 0) {
        items.push({
          id: 'printing',
          type: 'info',
          icon: <Printer className="h-4 w-4" />,
          title: `${printing.length} Printing`,
          message: `In progress`,
          action: { label: 'View', section: 'printers' }
        });
      }
    }

    // 7. New jobs
    if (jobs.length > 0) {
      const newJobs = jobs.filter(j => j.status === 'new');
      if (newJobs.length > 0) {
        items.push({
          id: 'newjobs',
          type: 'info',
          icon: <Briefcase className="h-4 w-4" />,
          title: `${newJobs.length} New Jobs`,
          message: `Review now`,
          action: { label: 'View', section: 'jobs' }
        });
      }
    }

    // Default
    if (items.length === 0) {
      items.push({
        id: 'allgood',
        type: 'success',
        icon: <Sparkles className="h-4 w-4" />,
        title: 'All Good',
        message: 'Systems running smooth'
      });
    }

    return items.slice(0, 4);
  }, [tasks, projects, revenue, printers, inventory, jobs]);

  const colors = {
    urgent: 'bg-danger/10 border-danger/30 text-danger',
    warning: 'bg-warning/10 border-warning/30 text-warning',
    success: 'bg-success/10 border-success/30 text-success',
    info: 'bg-primary/10 border-primary/30 text-primary',
  };

  return (
    <div className="rounded-xl border border-surface-hover bg-surface p-3 md:p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-7 w-7 md:h-8 md:w-8 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-3.5 w-3.5 md:h-4 md:w-4 text-primary" />
        </div>
        <h3 className="font-semibold text-sm md:text-base">AI Insights</h3>
        <span className="ml-auto text-xs text-gray-500">{insights.length}</span>
      </div>

      <div className="space-y-2 md:space-y-3">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={`flex items-start gap-2 md:gap-3 rounded-lg border p-2 md:p-3 transition-all hover:shadow-md ${colors[insight.type]}`}
          >
            <div className="mt-0.5 shrink-0">{insight.icon}</div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-xs md:text-sm">{insight.title}</div>
              <div className="text-xs opacity-80 mt-0.5 truncate">{insight.message}</div>
            </div>
            {insight.action && (
              <button
                onClick={() => onNavigate(insight.action!.section)}
                className="shrink-0 text-xs font-medium underline opacity-70 hover:opacity-100"
              >
                {insight.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

interface DashboardViewProps {
  onNavigate: (section: string) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const { tasks, projects, jobs, inventory, printers, revenue } = useAppStore();
  const [printersExpanded, setPrintersExpanded] = useState(true);

  const stats = useMemo(() => {
    const activeTasks = tasks.pending.length + tasks.inProgress.length;
    const totalTasks = activeTasks + tasks.completed.length;
    const taskCompletion = totalTasks > 0 ? Math.round((tasks.completed.length / totalTasks) * 100) : 0;
    const overdueTasks = tasks.pending.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length;

    const activeProjects = projects.filter(p => p.status !== 'done').length;
    const completedProjects = projects.filter(p => p.status === 'done').length;

    const revenueData = revenue ? Object.values(revenue) as Array<{ value: number; orders: number }> : [];
    const totalRevenue = revenueData.reduce((sum, r) => sum + (r.value || 0), 0);
    const totalOrders = revenueData.reduce((sum, r) => sum + (r.orders || 0), 0);

    const onlinePrinters = printers.filter(p => p.status === 'operational' || p.status === 'printing').length;

    const lowStock = inventory.filter(i => i.quantity <= i.minStock).length;
    const inventoryValue = inventory.reduce((sum, i) => sum + (i.quantity * i.unitCost), 0);

    return {
      tasks: { active: activeTasks, total: totalTasks, completion: taskCompletion, overdue: overdueTasks },
      projects: { active: activeProjects, completed: completedProjects },
      revenue: { total: totalRevenue, orders: totalOrders },
      printers: { total: printers.length, online: onlinePrinters },
      inventory: { lowStock, value: inventoryValue, total: inventory.length },
    };
  }, [tasks, projects, revenue, printers, inventory, jobs]);

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* Header - Compact on mobile */}
      <div>
        <h1 className="text-xl md:text-2xl font-bold">Dashboard</h1>
        <p className="text-xs md:text-sm text-gray-400">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* AI Insights */}
      <AIInsightsCard 
        tasks={tasks} 
        projects={projects} 
        revenue={revenue} 
        printers={printers} 
        inventory={inventory} 
        jobs={jobs}
        onNavigate={onNavigate}
      />

      {/* Quick Actions - 2x2 Grid on mobile */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <button
          onClick={() => onNavigate('tasks')}
          className="flex items-center justify-center gap-1.5 rounded-lg ripple touch-feedback bg-primary/10 px-2 py-2.5 text-xs md:text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
          <span className="truncate">Add Task</span>
        </button>
        <button
          onClick={() => onNavigate('projects')}
          className="flex items-center justify-center gap-1.5 rounded-lg ripple touch-feedback bg-blue-500/10 px-2 py-2.5 text-xs md:text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
        >
          <Plus className="h-3.5 w-3.5 md:h-4 md:w-4" />
          <span className="truncate">Add Proj</span>
        </button>
        <button
          onClick={() => onNavigate('jobs')}
          className="flex items-center justify-center gap-1.5 rounded-lg ripple touch-feedback bg-success/10 px-2 py-2.5 text-xs md:text-sm font-medium text-success transition-colors hover:bg-success/20"
        >
          <Briefcase className="h-3.5 w-3.5 md:h-4 md:w-4" />
          <span className="truncate">Jobs</span>
        </button>
        <button
          onClick={() => onNavigate('inventory')}
          className="flex items-center justify-center gap-1.5 rounded-lg ripple touch-feedback bg-warning/10 px-2 py-2.5 text-xs md:text-sm font-medium text-warning transition-colors hover:bg-warning/20"
        >
          <Package className="h-3.5 w-3.5 md:h-4 md:w-4" />
          <span className="truncate">Inventory</span>
        </button>
      </div>

      {/* Main Stats Grid - Compact cards */}
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        {/* Tasks */}
        <button
          onClick={() => onNavigate('tasks')}
          className="rounded-xl border border-surface-hover bg-surface p-3 text-left transition-all hover:border-primary/50 card-press touch-feedback"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-primary/10">
              <Target className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            </div>
            {stats.tasks.overdue > 0 && (
              <span className="rounded-full bg-danger/10 px-1.5 py-0.5 text-xs text-danger">{stats.tasks.overdue}</span>
            )}
          </div>
          <div className="mt-2">
            <div className="text-xl md:text-2xl font-bold">{stats.tasks.active}</div>
            <div className="text-xs text-gray-400">Active Tasks</div>
          </div>
          <div className="mt-1.5 h-1 md:h-1.5 overflow-hidden rounded-full bg-surface-hover">
            <div className="h-full bg-primary transition-all" style={{ width: `${stats.tasks.completion}%` }} />
          </div>
          <div className="mt-1 text-xs text-gray-500">{stats.tasks.completion}%</div>
        </button>

        {/* Projects */}
        <button
          onClick={() => onNavigate('projects')}
          className="rounded-xl border border-surface-hover bg-surface p-3 text-left transition-all hover:border-primary/50 card-press touch-feedback"
        >
          <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-blue-500/10">
            <Briefcase className="h-4 w-4 md:h-5 md:w-5 text-blue-400" />
          </div>
          <div className="mt-2">
            <div className="text-xl md:text-2xl font-bold">{stats.projects.active}</div>
            <div className="text-xs text-gray-400">Active Proj</div>
          </div>
          <div className="mt-2 text-xs text-gray-500">{stats.projects.completed} done</div>
        </button>

        {/* Revenue */}
        <button
          onClick={() => onNavigate('revenue')}
          className="rounded-xl border border-surface-hover bg-surface p-3 text-left transition-all hover:border-primary/50 card-press touch-feedback"
        >
          <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-success/10">
            <DollarSign className="h-4 w-4 md:h-5 md:w-5 text-success" />
          </div>
          <div className="mt-2">
            <div className="text-xl md:text-2xl font-bold">${(stats.revenue.total / 1000).toFixed(1)}k</div>
            <div className="text-xs text-gray-400">Revenue</div>
          </div>
          <div className="mt-2 text-xs text-gray-500">{stats.revenue.orders} orders</div>
        </button>

        {/* Inventory */}
        <button
          onClick={() => onNavigate('inventory')}
          className="rounded-xl border border-surface-hover bg-surface p-3 text-left transition-all hover:border-primary/50 card-press touch-feedback"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-lg bg-warning/10">
              <Package className="h-4 w-4 md:h-5 md:w-5 text-warning" />
            </div>
            {stats.inventory.lowStock > 0 && (
              <span className="rounded-full bg-danger/10 px-1.5 py-0.5 text-xs text-danger">{stats.inventory.lowStock}</span>
            )}
          </div>
          <div className="mt-2">
            <div className="text-xl md:text-2xl font-bold">${(stats.inventory.value / 1000).toFixed(1)}k</div>
            <div className="text-xs text-gray-400">Inventory</div>
          </div>
          <div className="mt-2 text-xs text-gray-500">{stats.inventory.total} items</div>
        </button>
      </div>

      {/* Printers - Collapsible on mobile */}
      <div className="rounded-xl border border-surface-hover bg-surface p-3 md:p-4">
        <button 
          onClick={() => setPrintersExpanded(!printersExpanded)}
          className="w-full flex items-center justify-between touch-feedback"
        >
          <div className="flex items-center gap-2">
            <Printer className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            <span className="font-semibold text-sm md:text-base">Printers</span>
            <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs text-gray-400">
              {stats.printers.online}/{stats.printers.total}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-primary hover:underline hidden md:inline">View All</span>
            {printersExpanded ? <ChevronUp className="h-4 w-4 text-gray-400" /> : <ChevronDown className="h-4 w-4 text-gray-400" />}
          </div>
        </button>

        {printersExpanded && (
          <div className="mt-3 space-y-2">
            {printers.length > 0 ? (
              printers.slice(0, 3).map(printer => (
                <div key={printer.id} className="flex items-center gap-2 md:gap-3 rounded-lg bg-background p-2 md:p-3">
                  <div className={`h-8 w-8 md:h-10 md:w-10 shrink-0 rounded-lg flex items-center justify-center ${
                    printer.status === 'printing' ? 'bg-primary/10' :
                    printer.status === 'operational' ? 'bg-success/10' : 'bg-gray-800'
                  }`}>
                    <Printer className={`h-4 w-4 md:h-5 md:w-5 ${
                      printer.status === 'printing' ? 'text-primary' :
                      printer.status === 'operational' ? 'text-success' : 'text-gray-500'
                    }`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">{printer.name}</span>
                      <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-xs ${
                        printer.status === 'printing' ? 'bg-primary/10 text-primary' :
                        printer.status === 'operational' ? 'bg-success/10 text-success' :
                        'bg-gray-800 text-gray-500'
                      }`}>
                        {printer.status === 'printing' ? 'Printing' :
                         printer.status === 'operational' ? 'Ready' : 'Offline'}
                      </span>
                    </div>
                    {printer.job ? (
                      <div className="mt-1.5">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span className="truncate">{printer.job.name || 'Printing'}</span>
                          <span>{printer.job.progress || 0}%</span>
                        </div>
                        <div className="mt-1 h-1 md:h-1.5 overflow-hidden rounded-full bg-surface-hover">
                          <div className="h-full bg-primary transition-all" style={{ width: `${printer.job.progress || 0}%` }} />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
                        <span className="flex items-center gap-0.5">
                          <Thermometer className="h-3 w-3" />
                          {printer.temp || 0}°
                        </span>
                        <span className="flex items-center gap-0.5">
                          <Flame className="h-3 w-3" />
                          {printer.bedTemp || 0}°
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-lg bg-background py-6 text-center">
                <Printer className="mx-auto mb-2 h-6 w-6 md:h-8 md:w-8 text-gray-600" />
                <p className="text-xs md:text-sm text-gray-500">No printers</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Revenue Mini Chart */}
      <RevenueMiniChart revenue={revenue} onNavigate={onNavigate} />

      {/* Task Completion - Compact */}
      <div className="rounded-xl border border-surface-hover bg-surface p-3 md:p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 md:h-5 md:w-5 text-success" />
            <span className="font-semibold text-sm md:text-base">Tasks</span>
          </div>
          <button onClick={() => onNavigate('tasks')} className="text-xs text-primary hover:underline">View</button>
        </div>
        
        {(() => {
          const total = tasks.pending.length + tasks.inProgress.length + tasks.completed.length;
          if (total === 0) {
            return <p className="text-xs text-gray-500 text-center py-4">No tasks</p>;
          }
          const completion = ((tasks.completed.length / total) * 100).toFixed(0);
          return (
            <div>
              <div className="flex items-center justify-between text-sm mb-2">
                <span className="text-gray-400">Completion</span>
                <span className="font-medium text-success">{completion}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-hover">
                <div className="h-full bg-success transition-all" style={{ width: `${completion}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-gray-500">
                <span>Done: {tasks.completed.length}</span>
                <span>Active: {tasks.inProgress.length}</span>
                <span>Pending: {tasks.pending.length}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Inventory Status - Compact */}
      <div className="rounded-xl border border-surface-hover bg-surface p-3 md:p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 md:h-5 md:w-5 text-warning" />
            <span className="font-semibold text-sm md:text-base">Inventory</span>
          </div>
          <button onClick={() => onNavigate('inventory')} className="text-xs text-primary hover:underline">View</button>
        </div>
        
        {(() => {
          if (inventory.length === 0) {
            return <p className="text-xs text-gray-500 text-center py-4">No items</p>;
          }
          const outOfStock = inventory.filter(i => i.quantity === 0).length;
          const lowStock = inventory.filter(i => i.quantity > 0 && i.quantity <= i.minStock).length;
          const goodStock = inventory.filter(i => i.quantity > i.minStock).length;
          return (
            <div className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-success" />
                <span className="text-gray-400">Good: {goodStock}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-warning" />
                <span className="text-gray-400">Low: {lowStock}</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="h-2 w-2 rounded-full bg-danger" />
                <span className="text-gray-400">Out: {outOfStock}</span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* Recent Tasks - Compact List */}
      <div className="rounded-xl border border-surface-hover bg-surface p-3 md:p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            <span className="font-semibold text-sm md:text-base">Recent</span>
          </div>
          <button onClick={() => onNavigate('tasks')} className="text-xs text-primary hover:underline">View All</button>
        </div>

        <div className="space-y-2">
          {[...tasks.pending, ...tasks.inProgress, ...tasks.completed]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 3)
            .map(task => (
              <div key={task.id} className="flex items-center gap-2 rounded-lg bg-background p-2">
                <div className={`h-2 w-2 shrink-0 rounded-full ${
                  task.priority === 'high' ? 'bg-danger' :
                  task.priority === 'medium' ? 'bg-warning' : 'bg-gray-500'
                }`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xs md:text-sm font-medium">{task.title}</div>
                  <div className="text-xs text-gray-500">{task.status}</div>
                </div>
              </div>
            ))}
          {[...tasks.pending, ...tasks.inProgress, ...tasks.completed].length === 0 && (
            <p className="text-xs text-gray-500 text-center py-4">No tasks</p>
          )}
        </div>
      </div>
    </div>
  );
}

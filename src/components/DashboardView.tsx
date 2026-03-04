import { useMemo } from 'react';
import { 
  CheckCircle2, Clock, Circle, TrendingUp, AlertCircle,
  Briefcase, Package, DollarSign, Printer, Zap, Flame, Thermometer,
  ChevronRight, Sparkles, Target, Calendar, AlertTriangle, TrendingDown,
  Activity, Award, BarChart3, Plus
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
        icon: <AlertCircle className="h-5 w-5" />,
        title: `${overdueTasks.length} Overdue Task${overdueTasks.length > 1 ? 's' : ''}`,
        message: overdueTasks.slice(0, 2).map(t => t.title).join(', ') + (overdueTasks.length > 2 ? ` +${overdueTasks.length - 2} more` : ''),
        action: { label: 'View Tasks', section: 'tasks' }
      });
    }

    // 2. Critical: Out of stock items
    const outOfStock = inventory.filter(i => i.quantity === 0);
    if (outOfStock.length > 0) {
      items.push({
        id: 'outofstock',
        type: 'urgent',
        icon: <Package className="h-5 w-5" />,
        title: 'Out of Stock',
        message: `${outOfStock.slice(0, 2).map(i => i.name).join(', ')}${outOfStock.length > 2 ? ` +${outOfStock.length - 2} more` : ''}`,
        action: { label: 'Restock Now', section: 'inventory' }
      });
    }

    // 3. Warning: Low stock
    const lowStock = inventory.filter(i => i.quantity > 0 && i.quantity <= i.minStock);
    if (lowStock.length > 0 && outOfStock.length === 0) {
      items.push({
        id: 'lowstock',
        type: 'warning',
        icon: <AlertTriangle className="h-5 w-5" />,
        title: `${lowStock.length} Items Low on Stock`,
        message: `Consider restocking soon to avoid running out`,
        action: { label: 'View Inventory', section: 'inventory' }
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
        icon: <Clock className="h-5 w-5" />,
        title: `${dueSoon.length} Due Soon`,
        message: `Due in the next 2 days`,
        action: { label: 'View Tasks', section: 'tasks' }
      });
    }

    // 5. Revenue insights with goal tracking
    if (revenue) {
      const revenueData = Object.values(revenue).filter((r: any) => r && r.month) as Array<{ value: number; orders: number; month: string }>;
      
      if (revenueData.length >= 2) {
        const sorted = revenueData.sort((a, b) => a.month.localeCompare(b.month));
        const current = sorted[sorted.length - 1];
        const last = sorted[sorted.length - 2];
        const change = ((current.value - last.value) / last.value) * 100;
        const totalRevenue = sorted.reduce((sum, r) => sum + r.value, 0);
        const totalOrders = sorted.reduce((sum, r: any) => sum + (r.orders || 0), 0);
        const aov = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        
        const monthlyGoal = 500;
        const goalProgress = (current.value / monthlyGoal) * 100;
        const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
        const currentDay = new Date().getDate();
        const daysLeft = daysInMonth - currentDay;
        const dailyRateNeeded = (monthlyGoal - current.value) / daysLeft;
        
        if (change > 20) {
          items.push({
            id: 'revenueup',
            type: 'success',
            icon: <TrendingUp className="h-5 w-5" />,
            title: 'Revenue Surging!',
            message: `+${change.toFixed(0)}% from last month ($${current.value.toLocaleString()})`,
            action: { label: 'View Revenue', section: 'revenue' }
          });
        } else if (change < -25) {
          items.push({
            id: 'revenuedown',
            type: 'warning',
            icon: <TrendingDown className="h-5 w-5" />,
            title: 'Revenue Declining',
            message: `${change.toFixed(0)}% drop - consider marketing push`,
            action: { label: 'View Revenue', section: 'revenue' }
          });
        }
        
        if (goalProgress >= 100) {
          items.push({
            id: 'goalmet',
            type: 'success',
            icon: <Target className="h-5 w-5" />,
            title: 'Monthly Goal Crushed!',
            message: `$${current.value.toLocaleString()} of $${monthlyGoal} goal (${goalProgress.toFixed(0)}%)`,
          });
        } else if (goalProgress < 50 && daysLeft < 10) {
          items.push({
            id: 'goalbehind',
            type: 'warning',
            icon: <Target className="h-5 w-5" />,
            title: 'Behind Monthly Goal',
            message: `${goalProgress.toFixed(0)}% of $${monthlyGoal} - need $${dailyRateNeeded.toFixed(0)}/day`,
            action: { label: 'View Revenue', section: 'revenue' }
          });
        }
        
        if (aov > 40) {
          items.push({
            id: 'highaov',
            type: 'success',
            icon: <DollarSign className="h-5 w-5" />,
            title: 'Strong AOV',
            message: `$${aov.toFixed(2)} average order value across ${totalOrders} orders`,
          });
        }
      }
    }

    // 6. Printer utilization insights
    if (printers.length > 0) {
      const printing = printers.filter(p => p.status === 'printing');
      const idle = printers.filter(p => p.status === 'operational');
      const utilizationRate = (printing.length / printers.length) * 100;
      
      if (printing.length > 0) {
        const avgProgress = Math.round(printing.reduce((sum, p) => sum + (p.job?.progress || 0), 0) / printing.length);
        const totalTimeRemaining = printing.reduce((sum, p) => sum + (p.job?.timeLeft || 0), 0);
        const hoursRemaining = Math.ceil(totalTimeRemaining / 3600);
        
        items.push({
          id: 'printing',
          type: 'info',
          icon: <Printer className="h-5 w-5" />,
          title: `${printing.length} Printer${printing.length > 1 ? 's' : ''} Running`,
          message: `${avgProgress}% avg${hoursRemaining > 0 ? `, ~${hoursRemaining}h left` : ''}`,
          action: { label: 'View', section: 'printers' }
        });
      }
      
      if (utilizationRate < 25 && printers.length > 1 && idle.length > 0) {
        items.push({
          id: 'lowutilization',
          type: 'warning',
          icon: <Zap className="h-5 w-5" />,
          title: 'Low Printer Utilization',
          message: `${utilizationRate.toFixed(0)}% used - ${idle.length} idle`,
          action: { label: 'View', section: 'printers' }
        });
      }
    }

    // 7. Inventory value insight
    if (inventory.length > 0) {
      const totalValue = inventory.reduce((sum, i) => sum + (i.quantity * i.unitCost), 0);
      
      if (totalValue > 1000) {
        items.push({
          id: 'inventoryvalue',
          type: 'info',
          icon: <BarChart3 className="h-5 w-5" />,
          title: 'Inventory Value',
          message: `$${(totalValue / 1000).toFixed(1)}k in ${inventory.length} items`,
          action: { label: 'View', section: 'inventory' }
        });
      }
    }

    // 8. Project velocity insights
    if (projects.length > 0) {
      const activeProjects = projects.filter(p => p.status !== 'done');
      const nearlyDone = activeProjects.filter(p => (p.progress || 0) >= 80);
      const stalled = activeProjects.filter(p => (p.progress || 0) === 0 && p.status !== 'backlog');
      const avgProgress = activeProjects.length > 0 
        ? activeProjects.reduce((sum, p) => sum + (p.progress || 0), 0) / activeProjects.length 
        : 0;
      
      if (nearlyDone.length > 0) {
        items.push({
          id: 'nearlydone',
          type: 'success',
          icon: <CheckCircle2 className="h-5 w-5" />,
          title: `${nearlyDone.length} Almost Done`,
          message: `${nearlyDone[0].name} at ${nearlyDone[0].progress}%`,
          action: { label: 'View', section: 'projects' }
        });
      }
      
      if (stalled.length > 0) {
        items.push({
          id: 'stalled',
          type: 'warning',
          icon: <Clock className="h-5 w-5" />,
          title: `${stalled.length} Stalled`,
          message: `No progress - review priorities`,
          action: { label: 'View', section: 'projects' }
        });
      }
      
      if (avgProgress > 60 && activeProjects.length > 2) {
        items.push({
          id: 'projecthealth',
          type: 'success',
          icon: <Activity className="h-5 w-5" />,
          title: 'Projects Moving',
          message: `${avgProgress.toFixed(0)}% avg across ${activeProjects.length} active`,
        });
      }
    }

    // 9. Task velocity insight
    const totalTasks = tasks.pending.length + tasks.inProgress.length + tasks.completed.length;
    if (totalTasks > 0) {
      const recentlyCompleted = tasks.completed.filter(t => {
        const completedDate = new Date(t.completedAt || t.updatedAt || t.createdAt);
        return (Date.now() - completedDate.getTime()) < (7 * 24 * 60 * 60 * 1000);
      });
      
      if (recentlyCompleted.length >= 5) {
        items.push({
          id: 'productive',
          type: 'success',
          icon: <Award className="h-5 w-5" />,
          title: 'Productive Week!',
          message: `${recentlyCompleted.length} tasks done in 7 days`,
        });
      }
    }

    // 10. Job pipeline with high-value detection
    if (jobs.length > 0) {
      const newJobs = jobs.filter(j => j.status === 'new');
      const highValueJobs = newJobs.filter(j => {
        const salary = j.salary?.toLowerCase() || '';
        const match = salary.match(/(\d+)/);
        return match && parseInt(match[1]) >= 5;
      });
      
      if (highValueJobs.length > 0) {
        items.push({
          id: 'highvaluejobs',
          type: 'success',
          icon: <DollarSign className="h-5 w-5" />,
          title: `${highValueJobs.length} High-Value Jobs`,
          message: `$5k+ opportunities waiting`,
          action: { label: 'View', section: 'jobs' }
        });
      } else if (newJobs.length > 0) {
        items.push({
          id: 'newjobs',
          type: 'info',
          icon: <Briefcase className="h-5 w-5" />,
          title: `${newJobs.length} New Opportunity${newJobs.length > 1 ? 'ies' : ''}`,
          message: `Review and apply`,
          action: { label: 'View', section: 'jobs' }
        });
      }
    }

    // Default: All good
    if (items.length === 0) {
      items.push({
        id: 'allgood',
        type: 'success',
        icon: <Sparkles className="h-5 w-5" />,
        title: 'All Systems Go',
        message: 'Everything running smoothly!'
      });
    }

    return items.slice(0, 6);
  }, [tasks, projects, revenue, printers, inventory, jobs]);

  const colors = {
    urgent: 'bg-danger/10 border-danger/30 text-danger',
    warning: 'bg-warning/10 border-warning/30 text-warning',
    success: 'bg-success/10 border-success/30 text-success',
    info: 'bg-primary/10 border-primary/30 text-primary',
  };

  return (
    <div className="rounded-xl border border-surface-hover bg-gradient-to-br from-surface to-surface/50 p-4">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-semibold">AI Insights</h3>
        <span className="ml-auto text-xs text-gray-500">{insights.length} updates</span>
      </div>

      <div className="space-y-2">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={`flex items-start gap-3 rounded-lg border p-3 transition-all hover:shadow-md ${colors[insight.type]}`}
          >
            <div className="mt-0.5 shrink-0">{insight.icon}</div>
            <div className="min-w-0 flex-1">
              <div className="font-medium text-sm">{insight.title}</div>
              <div className="text-xs opacity-80 mt-0.5">{insight.message}</div>
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
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const { tasks, projects, jobs, inventory, printers, revenue } = useAppStore();

  const stats = useMemo(() => {
    const activeTasks = tasks.pending.length + tasks.inProgress.length;
    const totalTasks = activeTasks + tasks.completed.length;
    const taskCompletion = totalTasks > 0 ? Math.round((tasks.completed.length / totalTasks) * 100) : 0;
    const urgentTasks = tasks.pending.filter(t => t.priority === 'high').length;
    const overdueTasks = tasks.pending.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length;

    const activeProjects = projects.filter(p => p.status !== 'done').length;
    const completedProjects = projects.filter(p => p.status === 'done').length;

    const revenueData = revenue ? Object.values(revenue) as Array<{ value: number; orders: number }> : [];
    const totalRevenue = revenueData.reduce((sum, r) => sum + (r.value || 0), 0);
    const totalOrders = revenueData.reduce((sum, r) => sum + (r.orders || 0), 0);

    const onlinePrinters = printers.filter(p => p.status === 'operational' || p.status === 'printing').length;
    const printingPrinters = printers.filter(p => p.status === 'printing').length;

    const lowStock = inventory.filter(i => i.quantity <= i.minStock).length;
    const inventoryValue = inventory.reduce((sum, i) => sum + (i.quantity * i.unitCost), 0);

    const newJobs = jobs.filter(j => j.status === 'new').length;

    return {
      tasks: { active: activeTasks, total: totalTasks, completion: taskCompletion, urgent: urgentTasks, overdue: overdueTasks },
      projects: { active: activeProjects, completed: completedProjects },
      revenue: { total: totalRevenue, orders: totalOrders },
      printers: { total: printers.length, online: onlinePrinters, printing: printingPrinters },
      inventory: { lowStock, value: inventoryValue, total: inventory.length },
      jobs: { new: newJobs, total: jobs.length }
    };
  }, [tasks, projects, revenue, printers, inventory, jobs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-400">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
        </div>
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

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => onNavigate('tasks')}
          className="flex items-center gap-2 rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
        >
          <Plus className="h-4 w-4" />
          Add Task
        </button>
        <button
          onClick={() => onNavigate('projects')}
          className="flex items-center gap-2 rounded-lg bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 transition-colors hover:bg-blue-500/20"
        >
          <Plus className="h-4 w-4" />
          Add Project
        </button>
        <button
          onClick={() => onNavigate('jobs')}
          className="flex items-center gap-2 rounded-lg bg-success/10 px-4 py-2 text-sm font-medium text-success transition-colors hover:bg-success/20"
        >
          <Briefcase className="h-4 w-4" />
          View Jobs
        </button>
        <button
          onClick={() => onNavigate('inventory')}
          className="flex items-center gap-2 rounded-lg bg-warning/10 px-4 py-2 text-sm font-medium text-warning transition-colors hover:bg-warning/20"
        >
          <Package className="h-4 w-4" />
          Inventory
        </button>
      </div>

      {/* Main Stats Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        {/* Tasks */}
        <button
          onClick={() => onNavigate('tasks')}
          className="rounded-xl border border-surface-hover bg-surface p-4 text-left transition-all hover:border-primary/50 hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
              <Target className="h-5 w-5 text-primary" />
            </div>
            {stats.tasks.overdue > 0 && (
              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">{stats.tasks.overdue} overdue</span>
            )}
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold">{stats.tasks.active}</div>
            <div className="text-sm text-gray-400">Active Tasks</div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-hover">
            <div 
              className="h-full bg-primary transition-all"
              style={{ width: `${stats.tasks.completion}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-gray-500">{stats.tasks.completion}% done ({stats.tasks.total} total)</div>
        </button>

        {/* Projects */}
        <button
          onClick={() => onNavigate('projects')}
          className="rounded-xl border border-surface-hover bg-surface p-4 text-left transition-all hover:border-primary/50 hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10">
              <Briefcase className="h-5 w-5 text-blue-400" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold">{stats.projects.active}</div>
            <div className="text-sm text-gray-400">Active Projects</div>
          </div>
          <div className="mt-2 text-xs text-gray-500">{stats.projects.completed} completed</div>
        </button>

        {/* Revenue */}
        <button
          onClick={() => onNavigate('revenue')}
          className="rounded-xl border border-surface-hover bg-surface p-4 text-left transition-all hover:border-primary/50 hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold">${stats.revenue.total.toLocaleString()}</div>
            <div className="text-sm text-gray-400">Total Revenue</div>
          </div>
          <div className="mt-2 text-xs text-gray-500">{stats.revenue.orders} orders</div>
        </button>

        {/* Inventory */}
        <button
          onClick={() => onNavigate('inventory')}
          className="rounded-xl border border-surface-hover bg-surface p-4 text-left transition-all hover:border-primary/50 hover:shadow-lg"
        >
          <div className="flex items-center justify-between">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning/10">
              <Package className="h-5 w-5 text-warning" />
            </div>
            {stats.inventory.lowStock > 0 && (
              <span className="rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger">{stats.inventory.lowStock} low</span>
            )}
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold">${(stats.inventory.value / 1000).toFixed(1)}k</div>
            <div className="text-sm text-gray-400">Inventory Value</div>
          </div>
          <div className="mt-2 text-xs text-gray-500">{stats.inventory.total} items</div>
        </button>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Printers */}
        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" />
              <span className="font-semibold">Printers</span>
              <span className="rounded-full bg-surface-hover px-2 py-0.5 text-xs text-gray-400">
                {stats.printers.online}/{stats.printers.total} online
              </span>
            </div>
            <button 
              onClick={() => onNavigate('printers')}
              className="text-sm text-primary hover:underline"
            >
              View All
            </button>
          </div>

          {printers.length > 0 ? (
            <div className="space-y-3">
              {printers.slice(0, 3).map(printer => (
                <div 
                  key={printer.id}
                  className="flex items-center gap-3 rounded-lg bg-background p-3"
                >
                  <div className={`h-10 w-10 shrink-0 rounded-lg flex items-center justify-center ${
                    printer.status === 'printing' ? 'bg-primary/10' :
                    printer.status === 'operational' ? 'bg-success/10' : 'bg-gray-800'
                  }`}>
                    <Printer className={`h-5 w-5 ${
                      printer.status === 'printing' ? 'text-primary' :
                      printer.status === 'operational' ? 'text-success' : 'text-gray-500'
                    }`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-medium">{printer.name}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs ${
                        printer.status === 'printing' ? 'bg-primary/10 text-primary' :
                        printer.status === 'operational' ? 'bg-success/10 text-success' :
                        'bg-gray-800 text-gray-500'
                      }`}>
                        {printer.status === 'printing' ? 'Printing' :
                         printer.status === 'operational' ? 'Ready' : 'Offline'}
                      </span>
                    </div>
                    {printer.job ? (
                      <div className="mt-2">
                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <span className="truncate">{printer.job.name || 'Printing'}</span>
                          <span>{printer.job.progress || 0}%</span>
                        </div>
                        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-hover">
                          <div 
                            className="h-full bg-primary transition-all"
                            style={{ width: `${printer.job.progress || 0}%` }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                        <span className="flex items-center gap-1">
                          <Thermometer className="h-3 w-3" />
                          {printer.temp || 0}°C
                        </span>
                        <span className="flex items-center gap-1">
                          <Flame className="h-3 w-3" />
                          {printer.bedTemp || 0}°C
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg bg-background py-8 text-center">
              <Printer className="mx-auto mb-2 h-8 w-8 text-gray-600" />
              <p className="text-sm text-gray-500">No printers connected</p>
            </div>
          )}
        </div>

        {/* Revenue Chart */}
        <RevenueMiniChart revenue={revenue} onNavigate={onNavigate} />
      </div>

      {/* Two Column Layout - Additional Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Task Completion Chart */}
        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <span className="font-semibold">Task Completion</span>
            </div>
            <button 
              onClick={() => onNavigate('tasks')}
              className="text-sm text-primary hover:underline"
            >
              View All
            </button>
          </div>
          
          {(() => {
            const total = tasks.pending.length + tasks.inProgress.length + tasks.completed.length;
            if (total === 0) {
              return (
                <div className="rounded-lg bg-background py-8 text-center">
                  <Circle className="mx-auto mb-2 h-8 w-8 text-gray-600" />
                  <p className="text-sm text-gray-500">No tasks yet</p>
                </div>
              );
            }
            
            const data = [
              { label: 'Completed', value: tasks.completed.length, color: 'bg-success', textColor: 'text-success' },
              { label: 'In Progress', value: tasks.inProgress.length, color: 'bg-primary', textColor: 'text-primary' },
              { label: 'Pending', value: tasks.pending.length, color: 'bg-warning', textColor: 'text-warning' },
            ];
            
            return (
              <div className="space-y-3">
                {data.map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${item.color}`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{item.label}</span>
                        <span className={item.textColor}>{item.value}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-hover">
                        <div 
                          className={`h-full ${item.color}`}
                          style={{ width: `${(item.value / total) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-right">
                      {((item.value / total) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
                <div className="pt-2 border-t border-surface-hover">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Completion Rate</span>
                    <span className="font-medium text-success">
                      {((tasks.completed.length / total) * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>

        {/* Inventory Status Chart */}
        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-warning" />
              <span className="font-semibold">Inventory Status</span>
            </div>
            <button 
              onClick={() => onNavigate('inventory')}
              className="text-sm text-primary hover:underline"
            >
              View All
            </button>
          </div>
          
          {(() => {
            if (inventory.length === 0) {
              return (
                <div className="rounded-lg bg-background py-8 text-center">
                  <Package className="mx-auto mb-2 h-8 w-8 text-gray-600" />
                  <p className="text-sm text-gray-500">No inventory items</p>
                </div>
              );
            }
            
            const outOfStock = inventory.filter(i => i.quantity === 0).length;
            const lowStock = inventory.filter(i => i.quantity > 0 && i.quantity <= i.minStock).length;
            const inStock = inventory.filter(i => i.quantity > i.minStock).length;
            const total = inventory.length;
            
            const data = [
              { label: 'In Stock', value: inStock, color: 'bg-success', textColor: 'text-success' },
              { label: 'Low Stock', value: lowStock, color: 'bg-warning', textColor: 'text-warning' },
              { label: 'Out of Stock', value: outOfStock, color: 'bg-danger', textColor: 'text-danger' },
            ];
            
            return (
              <div className="space-y-3">
                {data.map((item) => (
                  <div key={item.label} className="flex items-center gap-3">
                    <div className={`h-3 w-3 rounded-full ${item.color}`} />
                    <div className="flex-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{item.label}</span>
                        <span className={item.textColor}>{item.value}</span>
                      </div>
                      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-hover">
                        <div 
                          className={`h-full ${item.color}`}
                          style={{ width: `${(item.value / total) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-xs text-gray-500 w-10 text-right">
                      {((item.value / total) * 100).toFixed(0)}%
                    </span>
                  </div>
                ))}
                <div className="pt-2 border-t border-surface-hover">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Total Items</span>
                    <span className="font-medium">{total}</span>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Recent Tasks */}
      <div className="rounded-xl border border-surface-hover bg-surface p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" />
            <span className="font-semibold">Recent Tasks</span>
          </div>
          <button 
            onClick={() => onNavigate('tasks')}
            className="flex items-center gap-1 text-sm text-primary hover:underline"
          >
            View All <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          {[...tasks.pending, ...tasks.inProgress, ...tasks.completed]
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
            .slice(0, 5)
            .map(task => (
              <div 
                key={task.id}
                className="flex items-center gap-3 rounded-lg bg-background p-3"
              >
                <div className={`h-2 w-2 shrink-0 rounded-full ${
                  task.priority === 'high' ? 'bg-danger' :
                  task.priority === 'medium' ? 'bg-warning' : 'bg-gray-500'
                }`} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{task.title}</div>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span className="capitalize">{task.status}</span>
                    {task.dueDate && (
                      <>
                        <span>•</span>
                        <span>Due {new Date(task.dueDate).toLocaleDateString()}</span>
                      </>
                    )}
                  </div>
                </div>
                {task.assignee && (
                  <span className="shrink-0 rounded-full bg-surface-hover px-2 py-0.5 text-xs text-gray-400">
                    {task.assignee}
                  </span>
                )}
              </div>
            ))}
          {[...tasks.pending, ...tasks.inProgress, ...tasks.completed].length === 0 && (
            <div className="rounded-lg bg-background py-8 text-center">
              <Circle className="mx-auto mb-2 h-8 w-8 text-gray-600" />
              <p className="text-sm text-gray-500">No tasks yet</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
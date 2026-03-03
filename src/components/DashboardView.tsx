import { useEffect, useState, useMemo } from 'react';
import { 
  CheckCircle2, Clock, Circle, TrendingUp, ArrowRight, AlertCircle,
  Briefcase, Package, DollarSign, Printer, Zap, Flame, Thermometer,
  ChevronRight, Sparkles, Target, Calendar, AlertTriangle
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import type { Task, Project, Job, InventoryItem, Printer } from '../types';

// Revenue Mini Chart Component
function RevenueMiniChart({ revenue, onNavigate }: { revenue: any; onNavigate: (s: string) => void }) {
  const data = useMemo(() => {
    if (!revenue || Object.keys(revenue).length === 0) {
      return [];
    }
    
    return Object.entries(revenue)
      .map(([month, r]: [string, any]) => ({ 
        month, 
        value: r?.value || 0,
        orders: r?.orders || 0
      }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6);
  }, [revenue]);
  
  if (data.length === 0) {
    return (
      <div className="rounded-xl border border-surface-hover bg-surface p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-success" />
            <span className="font-semibold">Revenue</span>
          </div>
          <button 
            onClick={() => onNavigate('revenue')}
            className="text-sm text-primary hover:underline"
          >
            View All
          </button>
        </div>
        <div className="rounded-lg bg-background py-12 text-center">
          <DollarSign className="mx-auto mb-3 h-12 w-12 text-gray-600" />
          <p className="text-sm text-gray-500 mb-1">No revenue data yet</p>
          <p className="text-xs text-gray-600">Add revenue in the Revenue section</p>
        </div>
      </div>
    );
  }
  
  const max = Math.max(...data.map(d => d.value), 1);
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const avg = data.length > 0 ? total / data.length : 0;
  const currentMonth = new Date().toISOString().slice(0, 7);
  const current = data.find(d => d.month === currentMonth);
  
  // Calculate trend
  const trend = data.length >= 2 ? 
    ((data[data.length - 1].value - data[data.length - 2].value) / data[data.length - 2].value) * 100 : 0;
  
  return (
    <div className="rounded-xl border border-surface-hover bg-surface p-4">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-success" />
          <span className="font-semibold">Revenue</span>
          {trend !== 0 && (
            <span className={`text-xs font-medium ${trend >= 0 ? 'text-success' : 'text-danger'}`}>
              {trend >= 0 ? '↑' : '↓'} {Math.abs(trend).toFixed(0)}%
            </span>
          )}
        </div>
        <button 
          onClick={() => onNavigate('revenue')}
          className="text-sm text-primary hover:underline"
        >
          View All
        </button>
      </div>
      
      {/* Simple Bar Chart */}
      <div className="mb-4 px-2">
        <div className="flex items-end justify-between gap-2 h-32 border-b border-surface-hover pb-2">
          {data.map((d, i) => {
            const heightPercent = Math.max((d.value / max) * 100, 5);
            const isCurrent = d.month === currentMonth;
            
            return (
              <div key={i} className="flex-1 flex flex-col items-center min-w-0">
                {/* Value label on top */}
                <div className="text-xs text-gray-400 mb-1 whitespace-nowrap">
                  ${d.value >= 1000 ? (d.value / 1000).toFixed(1) + 'k' : d.value}
                </div>
                
                {/* Bar container */}
                <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                  <div
                    className={`w-full max-w-[40px] rounded-t transition-all duration-500 ${
                      isCurrent ? 'bg-success' : 'bg-success/50'
                    }`}
                    style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                    title={`${d.month}: $${d.value.toLocaleString()} (${d.orders} orders)`}
                  />
                </div>
                
                {/* Month label */}
                <div className={`text-xs mt-2 ${isCurrent ? 'text-success font-medium' : 'text-gray-500'}`}>
                  {d.month.slice(5)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 pt-3 border-t border-surface-hover">
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">This Month</div>
          <div className="font-bold text-success">${(current?.value || 0).toLocaleString()}</div>
        </div>
        <div className="text-center border-x border-surface-hover">
          <div className="text-xs text-gray-500 mb-1">Average</div>
          <div className="font-bold">${Math.round(avg).toLocaleString()}</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-gray-500 mb-1">Total (6mo)</div>
          <div className="font-bold">${total.toLocaleString()}</div>
        </div>
      </div>
    </div>
  );
}

// AI Insight Generator
function generateAIInsights({
  tasks,
  projects,
  revenue,
  printers,
  inventory,
  jobs
}: {
  tasks: { pending: Task[]; inProgress: Task[]; completed: Task[] };
  projects: Project[];
  revenue: any;
  printers: Printer[];
  inventory: InventoryItem[];
  jobs: Job[];
}) {
  const insights: Array<{ type: 'info' | 'warning' | 'success' | 'urgent'; message: string; action?: string }> = [];

  // Task insights
  const urgentTasks = tasks.pending.filter(t => t.priority === 'high');
  const overdueTasks = tasks.pending.filter(t => t.dueDate && new Date(t.dueDate) < new Date());
  
  if (overdueTasks.length > 0) {
    insights.push({
      type: 'urgent',
      message: `You have ${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} that need${overdueTasks.length === 1 ? 's' : ''} attention.`,
      action: 'Review Tasks'
    });
  } else if (urgentTasks.length > 0) {
    insights.push({
      type: 'warning',
      message: `${urgentTasks.length} high-priority task${urgentTasks.length > 1 ? 's' : ''} waiting to be started.`,
      action: 'View Tasks'
    });
  }

  // Project insights
  const activeProjects = projects.filter(p => p.status !== 'done');
  const stalledProjects = activeProjects.filter(p => {
    if (!p.tasks || p.tasks.length === 0) return false;
    const completed = p.tasks.filter(t => t.completed).length;
    return completed === 0 && p.tasks.length > 0;
  });
  
  if (stalledProjects.length > 0) {
    insights.push({
      type: 'info',
      message: `${stalledProjects.length} project${stalledProjects.length > 1 ? 's' : ''} haven't started yet.`,
      action: 'Check Projects'
    });
  }

  // Revenue insights
  if (revenue) {
    const revenueData = Object.values(revenue) as Array<{ value: number; orders: number; month: string }>;
    const currentMonth = new Date().toISOString().slice(0, 7);
    const currentRevenue = revenueData.find(r => r.month === currentMonth);
    const lastMonthData = revenueData.filter(r => r.month < currentMonth).pop();
    
    if (currentRevenue && lastMonthData) {
      const change = ((currentRevenue.value - lastMonthData.value) / lastMonthData.value) * 100;
      if (change > 20) {
        insights.push({
          type: 'success',
          message: `Revenue is up ${change.toFixed(0)}% from last month! Great job.`,
        });
      } else if (change < -20) {
        insights.push({
          type: 'warning',
          message: `Revenue is down ${Math.abs(change).toFixed(0)}% from last month.`,
          action: 'View Revenue'
        });
      }
    }
  }

  // Printer insights
  const printingPrinters = printers.filter(p => p.status === 'printing');
  const offlinePrinters = printers.filter(p => p.status === 'offline');
  
  if (printingPrinters.length > 0) {
    insights.push({
      type: 'info',
      message: `${printingPrinters.length} printer${printingPrinters.length > 1 ? 's are' : ' is'} currently printing.`,
      action: 'View Printers'
    });
  }
  
  if (offlinePrinters.length > 0) {
    insights.push({
      type: 'warning',
      message: `${offlinePrinters.length} printer${offlinePrinters.length > 1 ? 's are' : ' is'} offline.`,
      action: 'Check Printers'
    });
  }

  // Inventory insights
  const lowStock = inventory.filter(i => i.quantity <= i.minStock);
  if (lowStock.length > 0) {
    insights.push({
      type: lowStock.length > 3 ? 'urgent' : 'warning',
      message: `${lowStock.length} item${lowStock.length > 1 ? 's are' : ' is'} running low on stock.`,
      action: 'View Inventory'
    });
  }

  // Job insights
  const newJobs = jobs.filter(j => j.status === 'new');
  if (newJobs.length > 0) {
    insights.push({
      type: 'info',
      message: `${newJobs.length} new job opportunity${newJobs.length > 1 ? 'ies' : 'y'} to review.`,
      action: 'View Jobs'
    });
  }

  // Default insight if nothing else
  if (insights.length === 0) {
    insights.push({
      type: 'success',
      message: 'All systems operational. You\'re on top of everything!',
    });
  }

  return insights.slice(0, 3); // Max 3 insights
}

interface DashboardViewProps {
  onNavigate: (section: string) => void;
}

export function DashboardView({ onNavigate }: DashboardViewProps) {
  const { tasks, projects, jobs, inventory, printers, revenue } = useAppStore();

  // Calculate all stats
  const stats = useMemo(() => {
    const totalTasks = tasks.pending.length + tasks.inProgress.length + tasks.completed.length;
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
      tasks: { total: totalTasks, completion: taskCompletion, urgent: urgentTasks, overdue: overdueTasks },
      projects: { active: activeProjects, completed: completedProjects },
      revenue: { total: totalRevenue, orders: totalOrders },
      printers: { total: printers.length, online: onlinePrinters, printing: printingPrinters },
      inventory: { lowStock, value: inventoryValue },
      jobs: { new: newJobs, total: jobs.length }
    };
  }, [tasks, projects, revenue, printers, inventory, jobs]);

  // Generate AI insights
  const insights = useMemo(() => 
    generateAIInsights({ tasks, projects, revenue, printers, inventory, jobs }),
    [tasks, projects, revenue, printers, inventory, jobs]
  );

  // Get recent items
  const recentTasks = [...tasks.pending, ...tasks.inProgress]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

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
      <div className="rounded-xl border border-surface-hover bg-gradient-to-r from-primary/5 via-surface to-surface p-4">
        <div className="mb-3 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          <span className="font-semibold">AI Insights</span>
        </div>
        <div className="space-y-2">
          {insights.map((insight, i) => (
            <div 
              key={i}
              className={`flex items-center gap-3 rounded-lg p-3 ${
                insight.type === 'urgent' ? 'bg-danger/10 border border-danger/20' :
                insight.type === 'warning' ? 'bg-warning/10 border border-warning/20' :
                insight.type === 'success' ? 'bg-success/10 border border-success/20' :
                'bg-surface-hover'
              }`}
            >
              {insight.type === 'urgent' && <AlertCircle className="h-5 w-5 shrink-0 text-danger" />}
              {insight.type === 'warning' && <AlertTriangle className="h-5 w-5 shrink-0 text-warning" />}
              {insight.type === 'success' && <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />}
              {insight.type === 'info' && <Sparkles className="h-5 w-5 shrink-0 text-primary" />}
              
              <div className="flex-1">
                <p className="text-sm">{insight.message}</p>
              </div>
              
              {insight.action && (
                <button
                  onClick={() => {
                    const section = insight.action?.toLowerCase().includes('task') ? 'tasks' :
                                   insight.action?.toLowerCase().includes('project') ? 'projects' :
                                   insight.action?.toLowerCase().includes('revenue') ? 'revenue' :
                                   insight.action?.toLowerCase().includes('printer') ? 'printers' :
                                   insight.action?.toLowerCase().includes('inventory') ? 'inventory' :
                                   insight.action?.toLowerCase().includes('job') ? 'jobs' : 'dashboard';
                    onNavigate(section);
                  }}
                  className="shrink-0 text-xs font-medium text-primary hover:underline"
                >
                  {insight.action}
                </button>
              )}
            </div>
          ))}
        </div>
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
            <div className="text-2xl font-bold">{stats.tasks.total}</div>
            <div className="text-sm text-gray-400">Tasks</div>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-hover">
            <div 
              className="h-full bg-primary transition-all"
              style={{ width: `${stats.tasks.completion}%` }}
            />
          </div>
          <div className="mt-1 text-xs text-gray-500">{stats.tasks.completion}% done</div>
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
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10"
>
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
          <div className="mt-2 text-xs text-gray-500">{inventory.length} items</div>
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
          {recentTasks.length > 0 ? (
            recentTasks.map(task => (
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
            ))
          ) : (
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
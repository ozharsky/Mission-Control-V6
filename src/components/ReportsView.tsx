import { useMemo } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, 
  Calendar, Target, BarChart3, PieChart, ArrowUpRight, ArrowDownRight,
  Printer, CheckCircle2, Clock
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart as RePieChart, Pie, Cell, LineChart, Line } from 'recharts';

interface ReportsViewProps {
  revenue: any;
  tasks: { pending: any[]; inProgress: any[]; completed: any[] };
  projects: any[];
  inventory: any[];
  printers: any[];
}

const COLORS = ['#6366f1', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];

export function ReportsView({ revenue, tasks, projects, inventory, printers }: ReportsViewProps) {
  // Revenue Analytics
  const revenueData = useMemo(() => {
    if (!revenue) return [];
    return Object.entries(revenue)
      .filter(([month, r]: [string, any]) => month && r && typeof r === 'object')
      .map(([month, r]: [string, any]) => ({ month, value: r?.value || 0, orders: r?.orders || 0 }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [revenue]);

  const revenueStats = useMemo(() => {
    if (revenueData.length === 0) return null;
    const total = revenueData.reduce((sum, d) => sum + d.value, 0);
    const avg = total / revenueData.length;
    const lastMonth = revenueData[revenueData.length - 1]?.value || 0;
    const prevMonth = revenueData[revenueData.length - 2]?.value || 0;
    const growth = prevMonth > 0 ? ((lastMonth - prevMonth) / prevMonth) * 100 : 0;
    const totalOrders = revenueData.reduce((sum, d) => sum + d.orders, 0);
    const avgOrderValue = totalOrders > 0 ? total / totalOrders : 0;
    
    return { total, avg, growth, totalOrders, avgOrderValue, months: revenueData.length };
  }, [revenueData]);

  // Task Analytics
  const taskStats = useMemo(() => {
    const total = tasks.pending.length + tasks.inProgress.length + tasks.completed.length;
    const completionRate = total > 0 ? Math.round((tasks.completed.length / total) * 100) : 0;
    const urgent = tasks.pending.filter(t => t.priority === 'high').length;
    const overdue = tasks.pending.filter(t => t.dueDate && new Date(t.dueDate) < new Date()).length;
    
    const byStatus = [
      { name: 'Pending', value: tasks.pending.length, color: COLORS[3] },
      { name: 'In Progress', value: tasks.inProgress.length, color: COLORS[0] },
      { name: 'Completed', value: tasks.completed.length, color: COLORS[1] },
    ].filter(s => s.value > 0);
    
    return { total, completionRate, urgent, overdue, byStatus };
  }, [tasks]);

  // Project Analytics
  const projectStats = useMemo(() => {
    const active = projects.filter(p => p.status !== 'done');
    const completed = projects.filter(p => p.status === 'done');
    const avgProgress = active.length > 0 
      ? Math.round(active.reduce((sum, p) => sum + (p.progress || 0), 0) / active.length)
      : 0;
    
    const byStatus = [
      { name: 'Active', value: active.length, color: COLORS[0] },
      { name: 'Completed', value: completed.length, color: COLORS[1] },
    ].filter(s => s.value > 0);
    
    return { total: projects.length, active: active.length, completed: completed.length, avgProgress, byStatus };
  }, [projects]);

  // Inventory Analytics
  const inventoryStats = useMemo(() => {
    const totalValue = inventory.reduce((sum, i) => sum + (i.quantity * i.unitCost), 0);
    const lowStock = inventory.filter(i => i.quantity <= i.minStock).length;
    const outOfStock = inventory.filter(i => i.quantity === 0).length;
    
    return { totalItems: inventory.length, totalValue, lowStock, outOfStock };
  }, [inventory]);

  // Printer Analytics
  const printerStats = useMemo(() => {
    const online = printers.filter(p => p.status === 'operational' || p.status === 'printing').length;
    const printing = printers.filter(p => p.status === 'printing').length;
    const offline = printers.filter(p => p.status === 'offline').length;
    
    return { total: printers.length, online, printing, offline };
  }, [printers]);

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reports & Analytics</h1>
          <p className="text-sm text-gray-400">Business insights and performance metrics</p>
        </div>
      </div>

      {/* Revenue Section */}
      {revenueStats && (
        <div className="rounded-2xl border border-surface-hover bg-surface p-6">
          <div className="mb-6 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
              <DollarSign className="h-5 w-5 text-success" />
            </div>
            <h2 className="text-xl font-semibold">Revenue Analytics</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              title="Total Revenue" 
              value={formatCurrency(revenueStats.total)} 
              icon={DollarSign}
              trend={revenueStats.growth}
            />
            <StatCard 
              title="Monthly Average" 
              value={formatCurrency(revenueStats.avg)} 
              icon={Calendar}
            />
            <StatCard 
              title="Total Orders" 
              value={revenueStats.totalOrders.toString()} 
              icon={ShoppingCart}
            />
            <StatCard 
              title="Avg Order Value" 
              value={formatCurrency(revenueStats.avgOrderValue)} 
              icon={Target}
            />
          </div>

          {revenueData.length > 1 && (
            <div className="mt-6 h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="month" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => v >= 1000 ? `${(v/1000).toFixed(0)}k` : v} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }}
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  />
                  <Line type="monotone" dataKey="value" stroke="#22c55e" strokeWidth={2} dot={{ fill: '#22c55e' }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Task & Project Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Task Analytics */}
        <div className="rounded-2xl border border-surface-hover bg-surface p-6">
          <div className="mb-6 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <h2 className="text-xl font-semibold">Task Analytics</h2>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{taskStats.total}</div>
              <div className="text-sm text-gray-500">Total Tasks</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-success">{taskStats.completionRate}%</div>
              <div className="text-sm text-gray-500">Completion</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-danger">{taskStats.urgent}</div>
              <div className="text-sm text-gray-500">Urgent</div>
            </div>
          </div>

          {taskStats.byStatus.length > 0 && (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <RePieChart>
                  <Pie
                    data={taskStats.byStatus}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {taskStats.byStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                </RePieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Project Analytics */}
        <div className="rounded-2xl border border-surface-hover bg-surface p-6">
          <div className="mb-6 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
              <BarChart3 className="h-5 w-5 text-warning" />
            </div>
            <h2 className="text-xl font-semibold">Project Analytics</h2>
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary">{projectStats.total}</div>
              <div className="text-sm text-gray-500">Total</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-warning">{projectStats.active}</div>
              <div className="text-sm text-gray-500">Active</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-success">{projectStats.avgProgress}%</div>
              <div className="text-sm text-gray-500">Avg Progress</div>
            </div>
          </div>

          {projectStats.byStatus.length > 0 && (
            <div className="h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectStats.byStatus} layout="vertical" margin={{ left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis dataKey="name" type="category" tick={{ fill: '#9ca3af', fontSize: 12 }} width={80} />
                  <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: '1px solid #374151', borderRadius: '8px' }} />
                  <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Inventory & Printer Section */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Inventory Summary */}
        <div className="rounded-2xl border border-surface-hover bg-surface p-6">
          <div className="mb-6 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-info/10">
              <Package className="h-5 w-5 text-info" />
            </div>
            <h2 className="text-xl font-semibold">Inventory Summary</h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-xl bg-surface-hover/50 p-4">
              <div className="text-sm text-gray-500 mb-1">Total Items</div>
              <div className="text-2xl font-bold">{inventoryStats.totalItems}</div>
            </div>
            <div className="rounded-xl bg-surface-hover/50 p-4">
              <div className="text-sm text-gray-500 mb-1">Inventory Value</div>
              <div className="text-2xl font-bold text-success">{formatCurrency(inventoryStats.totalValue)}</div>
            </div>
            <div className="rounded-xl bg-warning/10 p-4">
              <div className="text-sm text-warning mb-1">Low Stock</div>
              <div className="text-2xl font-bold text-warning">{inventoryStats.lowStock}</div>
            </div>
            <div className="rounded-xl bg-danger/10 p-4">
              <div className="text-sm text-danger mb-1">Out of Stock</div>
              <div className="text-2xl font-bold text-danger">{inventoryStats.outOfStock}</div>
            </div>
          </div>
        </div>

        {/* Printer Status */}
        <div className="rounded-2xl border border-surface-hover bg-surface p-6">
          <div className="mb-6 flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10">
              <Printer className="h-5 w-5 text-secondary" />
            </div>
            <h2 className="text-xl font-semibold">Printer Status</h2>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="text-center rounded-xl bg-success/10 p-4">
              <div className="text-3xl font-bold text-success">{printerStats.online}</div>
              <div className="text-sm text-gray-500 mt-1">Online</div>
            </div>
            <div className="text-center rounded-xl bg-primary/10 p-4">
              <div className="text-3xl font-bold text-primary">{printerStats.printing}</div>
              <div className="text-sm text-gray-500 mt-1">Printing</div>
            </div>
            <div className="text-center rounded-xl bg-gray-500/10 p-4">
              <div className="text-3xl font-bold text-gray-400">{printerStats.offline}</div>
              <div className="text-sm text-gray-500 mt-1">Offline</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({ title, value, icon: Icon, trend }: { title: string; value: string; icon: any; trend?: number }) {
  return (
    <div className="rounded-xl bg-surface-hover/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="h-4 w-4 text-gray-400" />
        <span className="text-sm text-gray-500">{title}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xl font-bold">{value}</span>
        {trend !== undefined && trend !== 0 && (
          <span className={`flex items-center text-xs ${trend >= 0 ? 'text-success' : 'text-danger'}`}>
            {trend >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {Math.abs(trend).toFixed(0)}%
          </span>
        )}
      </div>
    </div>
  );
}

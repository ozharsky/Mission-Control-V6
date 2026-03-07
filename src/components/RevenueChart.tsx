import { useState, useMemo, useRef, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Calendar, 
  BarChart3, Table, Plus, X, Upload, Download, FileText, 
  Target, Award, TrendingUp as TrendIcon, PieChart, Activity
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { setData } from '../lib/firebase';
import { parseEtsyCSV, readFile, aggregateRevenueByMonth, downloadTemplate } from '../lib/csv';

interface RevenueData {
  month: string;
  value: number;
  orders: number;
}

interface RevenueChartProps {
  data: RevenueData[];
  goal: number;
}

function StatCard({ 
  title, 
  value, 
  icon: Icon, 
  trend, 
  color,
  subtext
}: { 
  title: string; 
  value: string; 
  icon: any; 
  trend?: number; 
  color: 'success' | 'primary' | 'warning' | 'danger' | 'info';
  subtext?: string;
}) {
  const colorClasses = {
    success: 'bg-success/10 text-success border-success/20',
    primary: 'bg-primary/10 text-primary border-primary/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    danger: 'bg-danger/10 text-danger border-danger/20',
    info: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };

  return (
    <div className={`rounded-xl border border-surface-hover bg-surface p-4 ${colorClasses[color]}`}>
      <div className="flex items-start justify-between">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-white/10`}>
          <Icon className="h-5 w-5" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
            trend >= 0 ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
          }`}>
            {trend >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <p className="mt-3 text-sm opacity-80">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
      {subtext && <p className="text-xs opacity-60">{subtext}</p>}
    </div>
  );
}

// Simple line chart component
function LineChart({ data, color = 'primary' }: { data: number[]; color?: string }) {
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1 || 1)) * 100;
    const y = 100 - ((val - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color === 'primary' ? '#6366f1' : color === 'success' ? '#22c55e' : '#f59e0b'}
        strokeWidth="2"
        points={points}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function RevenueChart({ data, goal }: RevenueChartProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'table' | 'insights'>('chart');
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '12m' | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<RevenueData | null>(null);
  const [newEntry, setNewEntry] = useState({
    month: new Date().toISOString().slice(0, 7),
    value: '',
    orders: '',
  });
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);
  const [importPreview, setImportPreview] = useState<{ month: string; value: number; orders: number }[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredData = useMemo(() => {
    if (timeRange === 'all') return data;
    const months = { '3m': 3, '6m': 6, '12m': 12 };
    return data.slice(-months[timeRange]);
  }, [data, timeRange]);

  const stats = useMemo(() => {
    const total = filteredData.reduce((sum, d) => sum + d.value, 0);
    const orders = filteredData.reduce((sum, d) => sum + d.orders, 0);
    const avg = filteredData.length > 0 ? total / filteredData.length : 0;
    const max = Math.max(...filteredData.map(d => d.value), 0);
    const min = Math.min(...filteredData.map(d => d.value), Infinity);
    const avgOrderValue = orders > 0 ? total / orders : 0;
    
    // Calculate trend (compare last month to average of previous 3)
    const last3 = filteredData.slice(-4, -1);
    const avgLast3 = last3.length > 0 ? last3.reduce((s, d) => s + d.value, 0) / last3.length : 0;
    const lastMonth = filteredData[filteredData.length - 1]?.value || 0;
    const trend = avgLast3 > 0 ? Math.round(((lastMonth - avgLast3) / avgLast3) * 100) : 0;
    
    // Month-over-month growth calculation
    const momGrowth = filteredData.map((curr, idx) => {
      if (idx === 0) return { month: curr.month, growth: 0, value: curr.value };
      const prev = filteredData[idx - 1];
      const growth = prev.value > 0 ? ((curr.value - prev.value) / prev.value) * 100 : 0;
      return { month: curr.month, growth: Math.round(growth * 10) / 10, value: curr.value };
    });
    
    // Average MoM growth
    const avgMomGrowth = momGrowth.length > 1 
      ? momGrowth.slice(1).reduce((sum, m) => sum + m.growth, 0) / (momGrowth.length - 1)
      : 0;
    
    // Best growth month
    const bestGrowth = momGrowth.reduce((best, curr) => 
      curr.growth > best.growth ? curr : best, momGrowth[0] || { month: '', growth: 0 }
    );
    
    // Best month
    const bestMonth = filteredData.reduce((best, curr) => 
      curr.value > best.value ? curr : best, filteredData[0] || { month: '', value: 0 }
    );
    
    // Goal achievement
    const monthsAtGoal = filteredData.filter(d => d.value >= goal).length;
    const goalRate = filteredData.length > 0 ? (monthsAtGoal / filteredData.length) * 100 : 0;
    
    return { 
      total, orders, avg, max, min: min === Infinity ? 0 : min, 
      avgOrderValue, trend, bestMonth, monthsAtGoal, goalRate,
      momGrowth, avgMomGrowth: Math.round(avgMomGrowth * 10) / 10, bestGrowth
    };
  }, [filteredData, goal]);

  const maxValue = Math.max(...filteredData.map(d => d.value), goal * 1.1);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // ... rest of handlers (handleAddEntry, handleEditEntry, etc.) stay the same ...

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.value || !newEntry.orders) return;

    const entry = {
      month: newEntry.month,
      value: parseFloat(newEntry.value),
      orders: parseInt(newEntry.orders),
    };

    await setData(`v6/data/revenue/${entry.month}`, entry);

    setNewEntry({ month: new Date().toISOString().slice(0, 7), value: '', orders: '' });
    setShowAddModal(false);
  };

  const handleEditEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;

    await setData(`v6/data/revenue/${editingEntry.month}`, editingEntry);
    setEditingEntry(null);
  };

  const handleDeleteEntry = async (month: string) => {
    if (confirm('Delete this revenue entry?')) {
      await setData(`v6/data/revenue/${month}`, null);
    }
  };

  const openEditModal = (entry: RevenueData) => {
    setEditingEntry({ ...entry });
  };

  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = d.toISOString().slice(0, 7);
      const label = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  };

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* Import/Add Modals - same as before */}
      {(showAddModal || editingEntry) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-surface-hover bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">{editingEntry ? 'Edit Entry' : 'Add Revenue Entry'}</h3>
              <button 
                onClick={() => { setShowAddModal(false); setEditingEntry(null); }}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={editingEntry ? handleEditEntry : handleAddEntry} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-gray-400">Month</label>
                {editingEntry ? (
                  <input type="text" value={editingEntry.month} disabled className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-gray-500" />
                ) : (
                  <select
                    value={newEntry.month}
                    onChange={(e) => setNewEntry({ ...newEntry, month: e.target.value })}
                    className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white"
                  >
                    {getMonthOptions().map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Revenue ($)</label>
                <input
                  type="number"
                  step="0.01"
                  value={editingEntry ? editingEntry.value : newEntry.value}
                  onChange={(e) => editingEntry 
                    ? setEditingEntry({ ...editingEntry, value: parseFloat(e.target.value) || 0 })
                    : setNewEntry({ ...newEntry, value: e.target.value })
                  }
                  className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Orders</label>
                <input
                  type="number"
                  value={editingEntry ? editingEntry.orders : newEntry.orders}
                  onChange={(e) => editingEntry
                    ? setEditingEntry({ ...editingEntry, orders: parseInt(e.target.value) || 0 })
                    : setNewEntry({ ...newEntry, orders: e.target.value })
                  }
                  className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddModal(false); setEditingEntry(null); }} className="flex-1 min-w-0 rounded-xl border border-surface-hover py-2 text-gray-400">Cancel</button>
                <button type="submit" className="flex-1 min-w-0 rounded-xl bg-primary py-2 font-medium text-white">{editingEntry ? 'Save' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Enhanced Stats Grid */}
      <div className="grid grid-cols-2 gap-3  lg:grid-cols-3 lg:gap-4">
        <StatCard title="Total Revenue" value={formatCurrency(stats.total)} icon={DollarSign} color="success" />
        <StatCard title="Total Orders" value={stats.orders.toString()} icon={ShoppingCart} color="primary" />
        <StatCard title="Avg/Month" value={formatCurrency(stats.avg)} icon={Calendar} color="info" subtext={`Best: ${stats.bestMonth?.month || '-'}`} />
        <StatCard title="Avg Order" value={formatCurrency(stats.avgOrderValue)} icon={TrendIcon} trend={stats.trend} color="warning" />
        <StatCard 
          title="MoM Growth" 
          value={`${stats.avgMomGrowth >= 0 ? '+' : ''}${stats.avgMomGrowth}%`} 
          icon={TrendingUp} 
          trend={stats.avgMomGrowth} 
          color={stats.avgMomGrowth >= 0 ? 'success' : 'danger'}
          subtext={`Best: ${stats.bestGrowth?.month || '-'} (+${stats.bestGrowth?.growth || 0}%)`}
        />
      </div>

      {/* Goal Progress */}
      <div className="rounded-xl touch-feedback border border-surface-hover bg-surface p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <span className="font-medium">Goal Progress</span>
          </div>
          <span className="text-sm text-gray-400">{stats.monthsAtGoal}/{filteredData.length} months at goal ({stats.goalRate.toFixed(0)}%)</span>
        </div>
        <div className="h-3 overflow-hidden rounded-full bg-surface-hover">
          <div 
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${Math.min(stats.goalRate, 100)}%` }}
          />
        </div>
      </div>

      {/* Mini Charts Row */}
      {filteredData.length > 1 && (
        <div className="grid grid-cols-1 gap-4 grid-cols-1">
          <div className="rounded-xl touch-feedback border border-surface-hover bg-surface p-4">
            <div className="mb-2 flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Revenue Trend</span>
            </div>
            <div className="h-16">
              <LineChart data={filteredData.map(d => d.value)} color="primary" />
            </div>
          </div>
          
          <div className="rounded-xl touch-feedback border border-surface-hover bg-surface p-4">
            <div className="mb-2 flex items-center gap-2">
              <ShoppingCart className="h-4 w-4 text-success" />
              <span className="text-sm font-medium">Orders Trend</span>
            </div>
            <div className="h-16">
              <LineChart data={filteredData.map(d => d.orders)} color="success" />
            </div>
          </div>
          
          {/* MoM Growth Chart */}
          {stats.momGrowth.length > 1 && (
            <div className="rounded-xl touch-feedback border border-surface-hover bg-surface p-4">
              <div className="mb-2 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-info" />
                <span className="text-sm font-medium">MoM Growth %</span>
              </div>
              <div className="h-16">
                <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
                  {stats.momGrowth.slice(1).map((m, idx, arr) => {
                    const maxGrowth = Math.max(...arr.map(x => Math.abs(x.growth)), 10);
                    const x1 = (idx / (arr.length - 1 || 1)) * 100;
                    const x2 = ((idx + 1) / (arr.length - 1 || 1)) * 100;
                    const y1 = 50 - (arr[idx]?.growth / maxGrowth) * 40;
                    const y2 = 50 - (arr[idx + 1]?.growth / maxGrowth) * 40;
                    return (
                      <line
                        key={idx}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={arr[idx + 1]?.growth >= 0 ? '#22c55e' : '#ef4444'}
                        strokeWidth="2"
                      />
                    );
                  })}
                </svg>
              </div>
            </div>
          )}
          
          <div className="rounded-xl touch-feedback border border-surface-hover bg-surface p-4">
            <div className="mb-2 flex items-center gap-2">
              <Award className="h-4 w-4 text-warning" />
              <span className="text-sm font-medium">Best Month</span>
            </div>
            {stats.bestMonth && stats.bestMonth.value > 0 ? (
              <div>
                <div className="text-2xl font-bold">{formatCurrency(stats.bestMonth.value)}</div>
                <div className="text-sm text-gray-400">{stats.bestMonth.month}</div>
              </div>
            ) : (
              <div className="text-sm text-gray-500">No data yet</div>
            )}
          </div>
        </div>
      )}

      {/* Mobile Summary View */}
      {isMobile && viewMode === 'chart' && filteredData.length > 0 && (
        <div className="rounded-xl border border-surface-hover bg-surface p-4 lg:hidden">
          <h3 className="mb-3 font-semibold">Recent Months</h3>
          <div className="space-y-3">
            {filteredData.slice(-6).reverse().map((item) => {
              const isGoalMet = item.value >= goal;
              return (
                <div key={item.month} className="flex items-center justify-between rounded-lg bg-background p-3">
                  <div>
                    <div className="font-medium">{new Date(item.month + '-01').toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</div>
                    <div className="text-xs text-gray-400">{item.orders} orders</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-semibold ${isGoalMet ? 'text-success' : ''}`}>{formatCurrency(item.value)}</div>
                    <div className={`text-xs ${isGoalMet ? 'text-success' : 'text-warning'}`}>{isGoalMet ? '✓ Goal' : 'Below'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Chart Card - Hidden on mobile */}
      <div className="hidden lg:block rounded-xl touch-feedback border border-surface-hover bg-surface p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Revenue Overview</h2>
              <p className="text-sm text-gray-400">Goal: {formatCurrency(goal)}/month</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-white">
              <Plus className="h-4 w-4" /> Add
            </button>
            <button onClick={() => setShowImportModal(true)} className="flex items-center gap-2 rounded-lg border border-surface-hover px-3 py-2 text-sm">
              <Upload className="h-4 w-4" /> Import
            </button>

            <div className="flex rounded-lg border border-surface-hover">
              {(['3m', '6m', '12m', 'all'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-2 text-sm ${timeRange === range ? 'bg-primary text-white' : 'hover:bg-surface-hover'}`}
                >
                  {range === 'all' ? 'All' : range}
                </button>
              ))}
            </div>

            <div className="flex rounded-lg border border-surface-hover">
              <button onClick={() => setViewMode('chart')} className={`px-3 py-2 ${viewMode === 'chart' ? 'bg-primary text-white' : ''}`}><BarChart3 className="h-4 w-4" /></button>
              <button onClick={() => setViewMode('table')} className={`px-3 py-2 ${viewMode === 'table' ? 'bg-primary text-white' : ''}`}><Table className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        {viewMode === 'chart' ? (
          filteredData.length > 0 ? (
            <>
              {/* Mobile: Horizontal scroll with all bars visible */}
              <div className="overflow-x-auto pb-2 lg:overflow-visible">
                <div className="flex items-end gap-1 sm:gap-2 min-w-max lg:min-w-0">
                  {filteredData.map((item) => {
                    const height = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                    const isGoalMet = item.value >= goal;
                    return (
                      <div key={item.month} className="group flex flex-col items-center w-8 sm:w-10 lg:flex-1">
                        <div className="relative w-full">
                          <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-surface-hover px-2 py-1 text-xs opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                            <p className="font-semibold">{formatCurrency(item.value)}</p>
                            <p className="text-gray-500">{item.orders} orders</p>
                          </div>
                          <div className={`w-full rounded-t transition-all ${isGoalMet ? 'bg-success' : 'bg-primary'}`} style={{ height: `${Math.max(height, 4)}%`, minHeight: '4px' }} />
                        </div>
                        <div className="mt-1 text-[10px] sm:text-xs text-gray-500 whitespace-nowrap">{new Date(item.month + '-01').toLocaleDateString(undefined, { month: 'short' })}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>
          ) : (
            <div className="py-12 text-center text-gray-500">No revenue data</div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-0">
              <thead><tr className="border-b border-surface-hover text-left"><th className="pb-3 text-sm text-gray-400">Month</th><th className="pb-3 text-right text-sm text-gray-400">Revenue</th><th className="pb-3 text-right text-sm text-gray-400">Orders</th><th className="pb-3 text-center text-sm text-gray-400">Status</th><th className="pb-3 text-right text-sm text-gray-400">Actions</th></tr></thead>
              <tbody>
                {[...filteredData].reverse().map((item) => {
                  const isGoalMet = item.value >= goal;
                  return (
                    <tr key={item.month} className="border-b border-surface-hover/50">
                      <td className="py-3">{new Date(item.month + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</td>
                      <td className={`py-3 text-right font-semibold ${isGoalMet ? 'text-success' : ''}`}>{formatCurrency(item.value)}</td>
                      <td className="py-3 text-right">{item.orders}</td>
                      <td className="py-3 text-center"><span className={`rounded-full px-2 py-1 text-xs ${isGoalMet ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>{isGoalMet ? '✓ Goal' : 'Below'}</span></td>
                      <td className="py-3 text-right"><button onClick={() => openEditModal(item)} className="text-sm text-primary">Edit</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
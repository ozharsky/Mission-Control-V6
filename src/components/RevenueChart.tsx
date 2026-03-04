import { useState, useMemo, useRef } from 'react';
import { 
  TrendingUp, DollarSign, ShoppingCart, Calendar, 
  BarChart3, Table, Plus, X, Upload, Download, Target, Award, Activity
} from 'lucide-react';
import { BarChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, ReferenceLine } from 'recharts';
import { setData } from '../lib/firebase';
import { parseEtsyCSV, readFile, aggregateRevenueByMonth, downloadTemplate } from '../lib/csv';

interface RevenueData {
  month: string;  // Format: YYYY-MM
  value: number;
  orders: number;
}

interface RevenueChartProps {
  data: RevenueData[];
  goal: number;
}

function LineChart({ data, color = 'primary' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  
  const points = data.map((val, idx) => {
    const x = (idx / (data.length - 1)) * 100;
    const y = 100 - ((val - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  const strokeColor = color === 'primary' ? '#6366f1' : color === 'success' ? '#22c55e' : '#f59e0b';

  return (
    <svg viewBox="0 0 100 100" className="h-full w-full" preserveAspectRatio="none">
      <polyline fill="none" stroke={strokeColor} strokeWidth="2" points={points} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Helper to format month display
function formatMonthLabel(monthStr: string): string {
  // Handle various formats: "2025-01", "01", "2025-1"
  if (!monthStr) return '-';
  
  // If it's already YYYY-MM format
  if (/^\d{4}-\d{1,2}$/.test(monthStr)) {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  
  // If it's just MM format (old data), prepend 2025
  if (/^\d{1,2}$/.test(monthStr)) {
    const date = new Date(2025, parseInt(monthStr) - 1, 1);
    return date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  }
  
  return monthStr;
}

function formatMonthFull(monthStr: string): string {
  if (!monthStr) return '-';
  
  if (/^\d{4}-\d{1,2}$/.test(monthStr)) {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1, 1);
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  
  if (/^\d{1,2}$/.test(monthStr)) {
    const date = new Date(2025, parseInt(monthStr) - 1, 1);
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }
  
  return monthStr;
}

export function RevenueChart({ data, goal }: RevenueChartProps) {
  // Debug: log data to console
  console.log('RevenueChart data:', data);
  
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '12m' | 'all'>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<RevenueData | null>(null);
  const [importPreview, setImportPreview] = useState<RevenueData[] | null>(null);
  const [newEntry, setNewEntry] = useState({ month: new Date().toISOString().slice(0, 7), value: '', orders: '' });
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
    const avgOrderValue = orders > 0 ? total / orders : 0;
    
    const last3 = filteredData.slice(-4, -1);
    const avgLast3 = last3.length > 0 ? last3.reduce((s, d) => s + d.value, 0) / last3.length : 0;
    const lastMonth = filteredData[filteredData.length - 1]?.value || 0;
    const trend = avgLast3 > 0 ? Math.round(((lastMonth - avgLast3) / avgLast3) * 100) : 0;
    
    const bestMonth = filteredData.reduce((best, curr) => curr.value > best.value ? curr : best, filteredData[0] || { month: '', value: 0 });
    const monthsAtGoal = filteredData.filter(d => d.value >= goal).length;
    const goalRate = filteredData.length > 0 ? (monthsAtGoal / filteredData.length) * 100 : 0;
    
    return { total, orders, avg, max, avgOrderValue, trend, bestMonth, monthsAtGoal, goalRate };
  }, [filteredData, goal]);

  // Calculate max value for chart - ensure it's never 0
  const maxValue = Math.max(stats.max, goal * 1.2, 100);
  
  console.log('Chart stats:', { maxValue, dataLength: filteredData.length, maxRevenue: stats.max });

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.value || !newEntry.orders) return;
    await setData(`v6/data/revenue/${newEntry.month}`, {
      value: parseFloat(newEntry.value),
      orders: parseInt(newEntry.orders)
    });
    setNewEntry({ month: new Date().toISOString().slice(0, 7), value: '', orders: '' });
    setShowAddModal(false);
  };

  const handleEditEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEntry) return;
    await setData(`v6/data/revenue/${editingEntry.month}`, editingEntry);
    setEditingEntry(null);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFile(file);
      const orders = parseEtsyCSV(text);
      const aggregated = aggregateRevenueByMonth(orders);
      setImportPreview(aggregated);
    } catch (err) {
      alert('Failed to parse CSV: ' + (err as Error).message);
    }
  };

  const handleImport = async () => {
    if (!importPreview) return;
    for (const row of importPreview) {
      await setData(`v6/data/revenue/${row.month}`, row);
    }
    setImportPreview(null);
    setShowImportModal(false);
  };

  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = 0; i < 24; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push({ value: d.toISOString().slice(0, 7), label: d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }) });
    }
    return options;
  };

  return (
    <div className="space-y-4">
      {/* Add/Edit Modal */}
      {(showAddModal || editingEntry) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-surface-hover bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">{editingEntry ? 'Edit Entry' : 'Add Revenue Entry'}</h3>
              <button onClick={() => { setShowAddModal(false); setEditingEntry(null); }} className="flex h-11 w-11 items-center justify-center text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={editingEntry ? handleEditEntry : handleAddEntry} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-gray-400">Month</label>
                {editingEntry ? (
                  <input type="text" value={editingEntry.month} disabled className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-gray-500" />
                ) : (
                  <select value={newEntry.month} onChange={(e) => setNewEntry({ ...newEntry, month: e.target.value })} className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white">
                    {getMonthOptions().map(opt => (<option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                )}
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Revenue ($)</label>
                <input type="number" step="0.01" value={editingEntry ? editingEntry.value : newEntry.value} 
                  onChange={(e) => editingEntry ? setEditingEntry({ ...editingEntry, value: parseFloat(e.target.value) || 0 }) : setNewEntry({ ...newEntry, value: e.target.value })}
                  className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm text-gray-400">Orders</label>
                <input type="number" value={editingEntry ? editingEntry.orders : newEntry.orders}
                  onChange={(e) => editingEntry ? setEditingEntry({ ...editingEntry, orders: parseInt(e.target.value) || 0 }) : setNewEntry({ ...newEntry, orders: e.target.value })}
                  className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddModal(false); setEditingEntry(null); }} className="flex-1 rounded-xl border border-surface-hover py-2 text-gray-400">Cancel</button>
                <button type="submit" className="flex-1 rounded-xl bg-primary py-2 font-medium text-white">{editingEntry ? 'Save' : 'Add'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-surface-hover bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Import Revenue CSV</h3>
              <button onClick={() => { setShowImportModal(false); setImportPreview(null); }} className="flex h-11 w-11 items-center justify-center text-gray-400 hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            {!importPreview ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">Upload an Etsy Orders CSV file. We'll extract the revenue data by month.</p>
                <div className="flex gap-2">
                  <button onClick={() => downloadTemplate('etsy')} className="rounded-lg border border-surface-hover px-3 py-2 text-sm hover:bg-surface-hover">Download Template</button>
                </div>
                <div onClick={() => fileInputRef.current?.click()} className="cursor-pointer rounded-xl border-2 border-dashed border-surface-hover bg-background p-8 text-center hover:border-primary">
                  <Upload className="mx-auto mb-2 h-8 w-8 text-gray-500" />
                  <p className="text-sm text-gray-400">Click to select CSV file</p>
                </div>
                <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileSelect} />
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">Preview ({importPreview.length} months):</p>
                <div className="max-h-64 overflow-y-auto rounded-xl border border-surface-hover">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-hover"><tr><th className="px-4 py-2 text-left">Month</th><th className="px-4 py-2 text-right">Revenue</th><th className="px-4 py-2 text-right">Orders</th></tr></thead>
                    <tbody>
                      {importPreview.map((row) => (
                        <tr key={row.month} className="border-t border-surface-hover">
                          <td className="px-4 py-2">{row.month}</td>
                          <td className="px-4 py-2 text-right">{formatCurrency(row.value)}</td>
                          <td className="px-4 py-2 text-right">{row.orders}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setImportPreview(null)} className="flex-1 rounded-xl border border-surface-hover py-2 text-gray-400">Back</button>
                  <button onClick={handleImport} className="flex-1 rounded-xl bg-primary py-2 font-medium text-white">Import {importPreview.length} Entries</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary Dashboard - At a Glance */}
      <div className="rounded-2xl border border-surface-hover bg-gradient-to-br from-surface to-surface/50 p-6">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Revenue Overview</h2>
            <p className="text-sm text-gray-400">{filteredData.length} months tracked • Goal: {formatCurrency(goal)}/mo</p>
          </div>
          <div className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2">
            <Target className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">{stats.goalRate.toFixed(0)}% on track</span>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {/* Total Revenue */}
          <div className="rounded-xl bg-surface-hover/50 p-4">
            <div className="mb-1 flex items-center gap-2 text-sm text-gray-400">
              <DollarSign className="h-4 w-4" />
              Total Revenue
            </div>
            <div className="text-2xl font-bold text-success">{formatCurrency(stats.total)}</div>
            <div className="mt-1 text-xs text-gray-500">All time</div>
          </div>

          {/* This Month */}
          <div className="rounded-xl bg-surface-hover/50 p-4">
            <div className="mb-1 flex items-center gap-2 text-sm text-gray-400">
              <Calendar className="h-4 w-4" />
              This Month
            </div>
            <div className="text-2xl font-bold text-primary">
              {formatCurrency(filteredData[filteredData.length - 1]?.value || 0)}
            </div>
            <div className={`mt-1 text-xs ${stats.trend >= 0 ? 'text-success' : 'text-danger'}`}>
              {stats.trend >= 0 ? '↑' : '↓'} {Math.abs(stats.trend)}% vs avg
            </div>
          </div>

          {/* Total Orders */}
          <div className="rounded-xl bg-surface-hover/50 p-4">
            <div className="mb-1 flex items-center gap-2 text-sm text-gray-400">
              <ShoppingCart className="h-4 w-4" />
              Total Orders
            </div>
            <div className="text-2xl font-bold text-info">{stats.orders}</div>
            <div className="mt-1 text-xs text-gray-500">{formatCurrency(stats.avgOrderValue)} avg</div>
          </div>

          {/* Best Month */}
          <div className="rounded-xl bg-surface-hover/50 p-4">
            <div className="mb-1 flex items-center gap-2 text-sm text-gray-400">
              <Award className="h-4 w-4" />
              Best Month
            </div>
            <div className="text-2xl font-bold text-warning">{formatCurrency(stats.bestMonth?.value || 0)}</div>
            <div className="mt-1 text-xs text-gray-500">{formatMonthLabel(stats.bestMonth?.month || '')}</div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-gray-400">Goal Progress</span>
            <span className="text-gray-400">{stats.monthsAtGoal} of {filteredData.length} months hit ${goal} goal</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-surface-hover">
            <div 
              className="h-full rounded-full bg-gradient-to-r from-primary to-success transition-all duration-500" 
              style={{ width: `${Math.min(stats.goalRate, 100)}%` }} 
            />
          </div>
        </div>
      </div>

      {/* Quick Trend Charts */}
      {filteredData.length > 1 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-surface-hover bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" />
                <span className="font-medium">Revenue Trend</span>
              </div>
              <span className="text-xs text-gray-500">{filteredData.length} months</span>
            </div>
            <div className="h-24"><LineChart data={filteredData.map(d => d.value)} color="primary" /></div>
          </div>
          <div className="rounded-xl border border-surface-hover bg-surface p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="h-4 w-4 text-success" />
                <span className="font-medium">Monthly Average</span>
              </div>
              <span className="text-lg font-bold text-success">{formatCurrency(stats.avg)}</span>
            </div>
            <div className="h-24"><LineChart data={filteredData.map(d => d.value)} color="success" /></div>
          </div>
        </div>
      )}

      {/* Main Chart */}
      <div className="rounded-xl border border-surface-hover bg-surface p-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10"><BarChart3 className="h-5 w-5 text-primary" /></div>
            <div><h2 className="text-lg font-semibold">Revenue Overview</h2><p className="text-sm text-gray-400">Goal: {formatCurrency(goal)}/month</p></div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => setShowAddModal(true)} className="flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-white"><Plus className="h-4 w-4" /> Add</button>
            <button onClick={() => setShowImportModal(true)} className="flex min-h-[44px] items-center gap-2 rounded-lg border border-surface-hover px-3 py-2 text-sm"><Upload className="h-4 w-4" /> Import</button>

            <div className="flex rounded-lg border border-surface-hover">
              {(['3m', '6m', '12m', 'all'] as const).map((range) => (
                <button key={range} onClick={() => setTimeRange(range)} className={`min-h-[44px] px-3 py-2 text-sm ${timeRange === range ? 'bg-primary text-white' : 'hover:bg-surface-hover'}`}>
                  {range === 'all' ? 'All' : range}
                </button>
              ))}
            </div>

            <div className="flex rounded-lg border border-surface-hover">
              <button onClick={() => setViewMode('chart')} className={`min-h-[44px] px-3 py-2 ${viewMode === 'chart' ? 'bg-primary text-white' : ''}`}><BarChart3 className="h-4 w-4" /></button>
              <button onClick={() => setViewMode('table')} className={`min-h-[44px] px-3 py-2 ${viewMode === 'table' ? 'bg-primary text-white' : ''}`}><Table className="h-4 w-4" /></button>
            </div>
          </div>
        </div>

        {viewMode === 'chart' ? (
          filteredData.length > 0 ? (
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={filteredData.map(d => ({
                    month: formatMonthLabel(d.month),
                    fullMonth: d.month,
                    revenue: d.value,
                    orders: d.orders,
                    goal: goal
                  }))}
                  margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                  <XAxis
                    dataKey="month"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    angle={-45}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#9ca3af', fontSize: 11 }}
                    tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                  />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="rounded-lg bg-surface border border-surface-hover p-3 shadow-lg">
                            <p className="text-sm font-medium mb-1">{data.fullMonth}</p>
                            <p className="text-sm text-success">Revenue: {formatCurrency(data.revenue)}</p>
                            <p className="text-xs text-gray-500">{data.orders} orders</p>
                            <p className="text-xs text-gray-500 mt-1">Goal: {formatCurrency(data.goal)}</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <ReferenceLine
                    y={goal}
                    stroke="#f59e0b"
                    strokeDasharray="5 5"
                    label={{
                      value: `Goal: ${formatCurrency(goal)}`,
                      fill: '#f59e0b',
                      fontSize: 11,
                      position: 'right'
                    }}
                  />
                  <Bar
                    dataKey="revenue"
                    fill="#6366f1"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-12 text-center text-gray-500">No revenue data</div>
          )
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead><tr className="border-b border-surface-hover text-left"><th className="pb-3 text-sm text-gray-400">Month</th><th className="pb-3 text-right text-sm text-gray-400">Revenue</th><th className="pb-3 text-right text-sm text-gray-400">Orders</th><th className="pb-3 text-center text-sm text-gray-400">Status</th></tr></thead>
              <tbody>
                {[...filteredData].reverse().map((item) => {
                  const isGoalMet = item.value >= goal;
                  return (
                    <tr key={item.month} className="border-b border-surface-hover/50">
                      <td className="py-3">{formatMonthFull(item.month)}</td>
                      <td className={`py-3 text-right font-semibold ${isGoalMet ? 'text-success' : ''}`}>{formatCurrency(item.value)}</td>
                      <td className="py-3 text-right">{item.orders}</td>
                      <td className="py-3 text-center"><span className={`rounded-full px-2 py-1 text-xs ${isGoalMet ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}`}>{isGoalMet ? '✓ Goal' : 'Below'}</span></td>
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
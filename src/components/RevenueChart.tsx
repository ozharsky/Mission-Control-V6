import { useState, useMemo, useRef } from 'react';
import { 
  TrendingUp, TrendingDown, DollarSign, ShoppingCart, Calendar, 
  BarChart3, Table, Plus, X, Upload, Download, FileText
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
  color 
}: { 
  title: string; 
  value: string; 
  icon: any; 
  trend?: number; 
  color: 'success' | 'primary' | 'warning' | 'danger';
}) {
  const colorClasses = {
    success: 'bg-success/10 text-success border-success/20',
    primary: 'bg-primary/10 text-primary border-primary/20',
    warning: 'bg-warning/10 text-warning border-warning/20',
    danger: 'bg-danger/10 text-danger border-danger/20',
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
    </div>
  );
}

export function RevenueChart({ data, goal }: RevenueChartProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '12m' | 'all'>('6m');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<RevenueData | null>(null);
  const [newEntry, setNewEntry] = useState({
    month: new Date().toISOString().slice(0, 7), // YYYY-MM
    value: '',
    orders: '',
  });
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
    const avgOrderValue = orders > 0 ? total / orders : 0;
    
    const lastMonth = filteredData[filteredData.length - 1]?.value || 0;
    const prevMonth = filteredData[filteredData.length - 2]?.value || 0;
    const trend = prevMonth > 0 ? Math.round(((lastMonth - prevMonth) / prevMonth) * 100) : 0;
    
    return { total, orders, avg, max, avgOrderValue, trend };
  }, [filteredData]);

  const maxValue = Math.max(...filteredData.map(d => d.value), goal * 1.1);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntry.value || !newEntry.orders) return;

    const entry = {
      month: newEntry.month,
      value: parseFloat(newEntry.value),
      orders: parseInt(newEntry.orders),
    };

    // Save to Firebase
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

  // Generate month options for dropdown
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
    <div className="space-y-4 lg:space-y-6">
      {/* Add/Edit Modal */}
      {(showAddModal || editingEntry) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-surface-hover bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">
                {editingEntry ? 'Edit Entry' : 'Add Revenue Entry'}
              </h3>
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
                  <input
                    type="text"
                    value={editingEntry.month}
                    disabled
                    className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-gray-500"
                  />
                ) : (
                  <select
                    value={newEntry.month}
                    onChange={(e) => setNewEntry({ ...newEntry, month: e.target.value })}
                    className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
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
                  min="0"
                  value={editingEntry ? editingEntry.value : newEntry.value}
                  onChange={(e) => editingEntry 
                    ? setEditingEntry({ ...editingEntry, value: parseFloat(e.target.value) || 0 })
                    : setNewEntry({ ...newEntry, value: e.target.value })
                  }
                  placeholder="0.00"
                  className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
                  autoFocus
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-400">Number of Orders</label>
                <input
                  type="number"
                  min="0"
                  value={editingEntry ? editingEntry.orders : newEntry.orders}
                  onChange={(e) => editingEntry
                    ? setEditingEntry({ ...editingEntry, orders: parseInt(e.target.value) || 0 })
                    : setNewEntry({ ...newEntry, orders: e.target.value })
                  }
                  placeholder="0"
                  className="w-full rounded-xl border border-surface-hover bg-background px-4 py-2 text-white focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddModal(false); setEditingEntry(null); }}
                  className="flex-1 rounded-xl border border-surface-hover py-2 text-gray-400 hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-primary py-2 font-medium text-white hover:bg-primary-hover"
                >
                  {editingEntry ? 'Save Changes' : 'Add Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(stats.total)}
          icon={DollarSign}
          trend={stats.trend}
          color="success"
        />
        <StatCard
          title="Orders"
          value={stats.orders.toString()}
          icon={ShoppingCart}
          color="primary"
        />
        <StatCard
          title="Avg/Month"
          value={formatCurrency(stats.avg)}
          icon={Calendar}
          color="primary"
        />
        <StatCard
          title="Avg Order"
          value={formatCurrency(stats.avgOrderValue)}
          icon={TrendingUp}
          color="warning"
        />
      </div>

      {/* Main Chart Card */}
      <div className="rounded-xl border border-surface-hover bg-surface p-4 lg:p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
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
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary-hover"
            >
              <Plus className="h-4 w-4" />
              Add Entry
            </button>

            <button
              onClick={() => setShowImportModal(true)}
              className="flex items-center gap-2 rounded-lg border border-surface-hover px-4 py-2 text-sm font-medium hover:bg-surface-hover"
            >
              <Upload className="h-4 w-4" />
              Import CSV
            </button>

            <div className="flex rounded-lg border border-surface-hover">
              {(['3m', '6m', '12m', 'all'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-2 text-sm font-medium ${
                    timeRange === range
                      ? 'bg-primary text-white'
                      : 'hover:bg-surface-hover'
                  } ${range === '3m' ? 'rounded-l-lg' : ''} ${range === 'all' ? 'rounded-r-lg' : ''}`}
                >
                  {range === 'all' ? 'All' : range}
                </button>
              ))}
            </div>

            <div className="flex rounded-lg border border-surface-hover">
              <button
                onClick={() => setViewMode('chart')}
                className={`px-3 py-2 ${viewMode === 'chart' ? 'bg-primary text-white' : 'hover:bg-surface-hover'} rounded-l-lg`}
              >
                <BarChart3 className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-2 ${viewMode === 'table' ? 'bg-primary text-white' : 'hover:bg-surface-hover'} rounded-r-lg`}
              >
                <Table className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'chart' ? (
          <>
            {filteredData.length > 0 ? (
              <>
                {/* Chart */}
                <div className="flex items-end gap-2">
                  {filteredData.map((item, index) => {
                    const height = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                    const isGoalMet = item.value >= goal;

                    return (
                      <div key={item.month} className="group flex flex-1 flex-col items-center">
                        <div className="relative w-full">
                          <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-surface-hover px-3 py-2 text-xs opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                            <p className="font-semibold">{formatCurrency(item.value)}</p>
                            <p className="text-gray-500">{item.orders} orders</p>
                          </div>
                          
                          <div
                            className={`w-full rounded-t-lg transition-all duration-500 ${
                              isGoalMet ? 'bg-success' : 'bg-primary'
                            }`}
                            style={{
                              height: `${Math.max(height, 4)}%`,
                              minHeight: '4px',
                            }}
                          />
                        </div>
                        
                        <div className="mt-2 text-xs text-gray-500">
                          {new Date(item.month + '-01').toLocaleDateString(undefined, { month: 'short' })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-gray-500">
                <div className="mb-4 text-5xl">📊</div>
                <h3 className="mb-2 text-lg font-semibold">No revenue data</h3>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary-hover"
                >
                  Add First Entry
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-hover text-left">
                  <th className="pb-3 text-sm font-medium text-gray-400">Month</th>
                  <th className="pb-3 text-right text-sm font-medium text-gray-400">Revenue</th>
                  <th className="pb-3 text-right text-sm font-medium text-gray-400">Orders</th>
                  <th className="pb-3 text-center text-sm font-medium text-gray-400">Status</th>
                  <th className="pb-3 text-right text-sm font-medium text-gray-400">Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...filteredData].reverse().map((item) => {
                  const isGoalMet = item.value >= goal;

                  return (
                    <tr key={item.month} className="border-b border-surface-hover/50">
                      <td className="py-3 font-medium">
                        {new Date(item.month + '-01').toLocaleDateString(undefined, {
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className={`py-3 text-right font-semibold ${isGoalMet ? 'text-success' : ''}`}>
                        {formatCurrency(item.value)}
                      </td>
                      <td className="py-3 text-right">{item.orders}</td>
                      <td className="py-3 text-center">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-medium ${
                            isGoalMet
                              ? 'bg-success/10 text-success'
                              : 'bg-warning/10 text-warning'
                          }`}
                        >
                          {isGoalMet ? '✓ Goal' : 'Below'}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openEditModal(item)}
                            className="text-sm text-primary hover:underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteEntry(item.month)}
                            className="text-sm text-danger hover:underline"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CSV Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-surface-hover bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Import Revenue CSV</h3>
              <button 
                onClick={() => { setShowImportModal(false); setImportPreview(null); }}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {!importPreview ? (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">
                  Upload an Etsy Orders CSV or a simple revenue CSV. 
                  The file should have columns for date, revenue, and orders.
                </p>

                <div className="flex gap-2">
                  <button
                    onClick={() => downloadTemplate('etsy')}
                    className="flex items-center gap-2 rounded-lg border border-surface-hover px-3 py-2 text-sm hover:bg-surface-hover"
                  >
                    <Download className="h-4 w-4" />
                    Etsy Template
                  </button>
                  <button
                    onClick={() => downloadTemplate('revenue')}
                    className="flex items-center gap-2 rounded-lg border border-surface-hover px-3 py-2 text-sm hover:bg-surface-hover"
                  >
                    <Download className="h-4 w-4" />
                    Simple Template
                  </button>
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="cursor-pointer rounded-xl border-2 border-dashed border-surface-hover bg-background p-8 text-center transition-colors hover:border-primary"
                >
                  <Upload className="mx-auto mb-2 h-8 w-8 text-gray-500" />
                  <p className="text-sm text-gray-400">Click to select CSV file</p>
                  <p className="text-xs text-gray-600">or drag and drop</p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;

                    try {
                      const text = await readFile(file);
                      const orders = parseEtsyCSV(text);
                      const aggregated = aggregateRevenueByMonth(orders);
                      setImportPreview(aggregated);
                    } catch (err) {
                      alert('Failed to parse CSV. Please check the format.');
                    }
                  }}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-gray-400">
                  Preview of data to import ({importPreview.length} months):
                </p>

                <div className="max-h-64 overflow-y-auto rounded-xl border border-surface-hover">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-hover">
                      <tr>
                        <th className="px-4 py-2 text-left">Month</th>
                        <th className="px-4 py-2 text-right">Revenue</th>
                        <th className="px-4 py-2 text-right">Orders</th>
                      </tr>
                    </thead>
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
                  <button
                    onClick={() => setImportPreview(null)}
                    className="flex-1 rounded-xl border border-surface-hover py-2 text-gray-400 hover:bg-surface-hover"
                  >
                    Back
                  </button>
                  <button
                    onClick={async () => {
                      setIsImporting(true);
                      for (const row of importPreview) {
                        await setData(`v6/data/revenue/${row.month}`, row);
                      }
                      setIsImporting(false);
                      setShowImportModal(false);
                      setImportPreview(null);
                    }}
                    disabled={isImporting}
                    className="flex-1 rounded-xl bg-primary py-2 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                  >
                    {isImporting ? 'Importing...' : `Import ${importPreview.length} Entries`}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
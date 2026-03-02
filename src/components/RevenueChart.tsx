import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Calendar, BarChart3, Table, Download, Target } from 'lucide-react';

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
    success: 'from-success/20 to-success/5 text-success border-success/30',
    primary: 'from-primary/20 to-primary/5 text-primary border-primary/30',
    warning: 'from-warning/20 to-warning/5 text-warning border-warning/30',
    danger: 'from-danger/20 to-danger/5 text-danger border-danger/30',
  };

  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-gradient-to-br p-5 ${colorClasses[color]}`}>
      <div className="relative z-10">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10">
            <Icon className="h-5 w-5"></Icon>
          </div>
          {trend !== undefined && (
            <div className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium ${
              trend >= 0 ? 'bg-success/20 text-success' : 'bg-danger/20 text-danger'
            }`}>
              {trend >= 0 ? <TrendingUp className="h-3 w-3"></TrendingUp> : <TrendingDown className="h-3 w-3"></TrendingDown>}
              {Math.abs(trend)}%
            </div>
          )}
        </div>
        <p className="text-sm opacity-80">{title}</p>
        <p className="text-2xl font-bold">{value}</p>
      </div>
      <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/5"></div>
    </div>
  );
}

export function RevenueChart({ data, goal }: RevenueChartProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [timeRange, setTimeRange] = useState<'3m' | '6m' | '12m' | 'all'>('6m');

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
    
    // Calculate trend (compare last month to previous)
    const lastMonth = filteredData[filteredData.length - 1]?.value || 0;
    const prevMonth = filteredData[filteredData.length - 2]?.value || 0;
    const trend = prevMonth > 0 ? Math.round(((lastMonth - prevMonth) / prevMonth) * 100) : 0;
    
    // Goal progress
    const goalProgress = goal > 0 ? Math.min(Math.round((avg / goal) * 100), 100) : 0;
    
    return { total, orders, avg, max, avgOrderValue, trend, goalProgress };
  }, [filteredData, goal]);

  const maxValue = Math.max(...filteredData.map(d => d.value), goal * 1.1);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
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
      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <BarChart3 className="h-5 w-5 text-primary"></BarChart3>
            </div>
            <div>
              <h2 className="text-lg font-semibold">Revenue Overview</h2>
              <p className="text-sm text-gray-400">Track your sales performance</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Time Range */}
            <div className="flex rounded-lg border border-surface-hover">
              {(['3m', '6m', '12m', 'all'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 text-sm font-medium ${
                    timeRange === range
                      ? 'bg-primary text-white'
                      : 'hover:bg-surface-hover'
                  } ${range === '3m' ? 'rounded-l-lg' : ''} ${range === 'all' ? 'rounded-r-lg' : ''}`}
                >
                  {range === 'all' ? 'All' : range}
                </button>
              ))}
            </div>

            {/* View Toggle */}
            <div className="flex rounded-lg border border-surface-hover">
              <button
                onClick={() => setViewMode('chart')}
                className={`px-3 py-1.5 ${viewMode === 'chart' ? 'bg-primary text-white' : 'hover:bg-surface-hover'} rounded-l-lg`}
              >
                <BarChart3 className="h-4 w-4"></BarChart3>
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 ${viewMode === 'table' ? 'bg-primary text-white' : 'hover:bg-surface-hover'} rounded-r-lg`}
              >
                <Table className="h-4 w-4"></Table>
              </button>
            </div>
          </div>
        </div>

        {/* Goal Line */}
        <div className="relative mb-6">
          <div className="absolute right-0 top-0 z-10 -translate-y-2 text-xs font-medium text-primary">
            Goal: {formatCurrency(goal)}
          </div>
          <div
            className="absolute left-0 right-0 top-0 border-t-2 border-dashed border-primary/50"
            style={{ top: `${((maxValue - goal) / maxValue) * 100}%` }}
          />
        </div>

        {viewMode === 'chart' ? (
          <>
            {/* Chart */}
            <div className="flex items-end gap-3">
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
                        className={`w-full rounded-t-xl transition-all duration-500 ${
                          isGoalMet ? 'bg-success' : 'bg-primary'
                        }`}
                        style={{
                          height: `${Math.max(height, 4)}%`,
                          minHeight: '4px',
                          animationDelay: `${index * 50}ms`,
                        }}
                      />
                    </div>
                    
                    <div className="mt-3 text-xs font-medium text-gray-500">
                      {new Date(item.month + '-01').toLocaleDateString(undefined, { month: 'short' })}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-6 flex items-center justify-center gap-6">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-success"></div>
                <span className="text-sm text-gray-400">Goal Met</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-primary"></div>
                <span className="text-sm text-gray-400">Below Goal</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-0.5 w-4 border-t-2 border-dashed border-primary"></div>
                <span className="text-sm text-gray-400">Target</span>
              </div>
            </div>
          </>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-hover text-left">
                  <th className="pb-3 text-sm font-medium text-gray-400">Month</th>
                  <th className="pb-3 text-right text-sm font-medium text-gray-400">Revenue</th>
                  <th className="pb-3 text-right text-sm font-medium text-gray-400">Orders</th>
                  <th className="pb-3 text-right text-sm font-medium text-gray-400">Avg/Order</th>
                  <th className="pb-3 text-center text-sm font-medium text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...filteredData].reverse().map((item) => {
                  const isGoalMet = item.value >= goal;
                  const avgOrder = item.orders > 0 ? item.value / item.orders : 0;

                  return (
                    <tr key={item.month} className="border-b border-surface-hover/50">
                      <td className="py-3 font-medium">
                        {new Date(item.month + '-01').toLocaleDateString(undefined, {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </td>
                      <td className={`py-3 text-right font-semibold ${isGoalMet ? 'text-success' : ''}`}>
                        {formatCurrency(item.value)}
                      </td>
                      <td className="py-3 text-right">{item.orders}</td>
                      <td className="py-3 text-right text-gray-400">{formatCurrency(avgOrder)}</td>
                      <td className="py-3 text-center">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-medium ${
                            isGoalMet
                              ? 'bg-success/10 text-success'
                              : 'bg-warning/10 text-warning'
                          }`}
                        >
                          {isGoalMet ? '✓ Goal Met' : 'Below Goal'}
                        </span>
                      </td>
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
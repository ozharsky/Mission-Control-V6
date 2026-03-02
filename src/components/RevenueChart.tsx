import { useState, useMemo } from 'react';

interface RevenueData {
  month: string;
  value: number;
  orders: number;
}

interface RevenueChartProps {
  data: RevenueData[];
  goal: number;
}

export function RevenueChart({ data, goal }: RevenueChartProps) {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');
  const [timeRange, setTimeRange] = useState<'6m' | '12m' | 'all'>('6m');

  const filteredData = useMemo(() => {
    if (timeRange === 'all') return data;
    const months = timeRange === '6m' ? 6 : 12;
    return data.slice(-months);
  }, [data, timeRange]);

  const stats = useMemo(() => {
    const total = filteredData.reduce((sum, d) => sum + d.value, 0);
    const orders = filteredData.reduce((sum, d) => sum + d.orders, 0);
    const avg = filteredData.length > 0 ? total / filteredData.length : 0;
    const max = Math.max(...filteredData.map(d => d.value), 0);
    return { total, orders, avg, max };
  }, [filteredData]);

  const maxValue = Math.max(...filteredData.map(d => d.value), goal * 1.2);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <p className="text-sm text-gray-400">Total Revenue</p>
          <p className="text-xl font-bold text-success">{formatCurrency(stats.total)}</p>
        </div>
        
        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <p className="text-sm text-gray-400">Orders</p>
          <p className="text-xl font-bold">{stats.orders}</p>
        </div>
        
        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <p className="text-sm text-gray-400">Avg/Month</p>
          <p className="text-xl font-bold">{formatCurrency(stats.avg)}</p>
        </div>
        
        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <p className="text-sm text-gray-400">Best Month</p>
          <p className="text-xl font-bold text-primary">{formatCurrency(stats.max)}</p>
        </div>
      </div>

      {/* Main Chart */}
      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Revenue</h2>
            <p className="text-sm text-gray-400">Goal: {formatCurrency(goal)}/month</p>
          </div>

          <div className="flex gap-2">
            <div className="flex rounded-lg border border-surface-hover">
              {(['6m', '12m', 'all'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-3 py-1.5 text-sm ${
                    timeRange === range
                      ? 'bg-primary text-white'
                      : 'hover:bg-surface-hover'
                  } ${range === '6m' ? 'rounded-l-lg' : ''} ${range === 'all' ? 'rounded-r-lg' : ''}`}
                >
                  {range === 'all' ? 'All' : range}
                </button>
              ))}
            </div>

            <div className="flex rounded-lg border border-surface-hover">
              <button
                onClick={() => setViewMode('chart')}
                className={`px-3 py-1.5 text-sm ${
                  viewMode === 'chart' ? 'bg-primary text-white' : 'hover:bg-surface-hover'
                } rounded-l-lg`}
              >
                📊
              </button>
              <button
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 text-sm ${
                  viewMode === 'table' ? 'bg-primary text-white' : 'hover:bg-surface-hover'
                } rounded-r-lg`}
              >
                📋
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'chart' ? (
          <div className="space-y-4">
            {/* Goal Line */}
            <div className="relative">
              <div className="absolute right-0 top-0 z-10 -translate-y-1/2 text-xs text-primary">
                Goal: {formatCurrency(goal)}
              </div>
              <div
                className="absolute left-0 right-0 top-0 border-t-2 border-dashed border-primary/50"
                style={{ top: `${((maxValue - goal) / maxValue) * 100}%` }}
              />
            </div>

            {/* Bars */}
            <div className="flex items-end gap-2">
              {filteredData.map((item, index) => {
                const height = maxValue > 0 ? (item.value / maxValue) * 100 : 0;
                const isGoalMet = item.value >= goal;

                return (
                  <div key={item.month} className="group flex flex-1 flex-col items-center">
                    <div className="relative w-full">
                      <div className="absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg bg-surface-hover px-2 py-1 text-xs opacity-0 transition-opacity group-hover:opacity-100">
                        {formatCurrency(item.value)}
                        <br />
                        {item.orders} orders
                      </div>
                      
                      <div
                        className={`w-full rounded-t-lg transition-all duration-500 ${
                          isGoalMet ? 'bg-success' : 'bg-primary'
                        }`}
                        style={{
                          height: `${Math.max(height, 4)}%`,
                          minHeight: '4px',
                          animationDelay: `${index * 50}ms`,
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
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-hover text-left">
                  <th className="pb-3 text-sm font-medium text-gray-400">Month</th>
                  <th className="pb-3 text-sm font-medium text-gray-400">Revenue</th>
                  <th className="pb-3 text-sm font-medium text-gray-400">Orders</th>
                  <th className="pb-3 text-sm font-medium text-gray-400">Avg/Order</th>
                  <th className="pb-3 text-sm font-medium text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {[...filteredData].reverse().map((item) => {
                  const isGoalMet = item.value >= goal;
                  const avgOrder = item.orders > 0 ? item.value / item.orders : 0;

                  return (
                    <tr key={item.month} className="border-b border-surface-hover/50">
                      <td className="py-3">
                        {new Date(item.month + '-01').toLocaleDateString(undefined, {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </td>
                      <td className={`py-3 font-medium ${isGoalMet ? 'text-success' : ''}`}>
                        {formatCurrency(item.value)}
                      </td>
                      <td className="py-3">{item.orders}</td>
                      <td className="py-3">{formatCurrency(avgOrder)}</td>
                      <td className="py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs ${
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
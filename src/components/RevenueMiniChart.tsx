import { useMemo } from 'react';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface RevenueMiniChartProps {
  revenue: any;
  onNavigate: (s: string) => void;
}

export function RevenueMiniChart({ revenue, onNavigate }: RevenueMiniChartProps) {
  const data = useMemo(() => {
    if (!revenue || Object.keys(revenue).length === 0) {
      return [];
    }
    
    return Object.entries(revenue)
      .filter(([month, r]: [string, any]) => month && r && typeof r === 'object')
      .map(([month, r]: [string, any]) => ({ 
        month, 
        value: r?.value || 0,
        orders: r?.orders || 0
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
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
  
  const trend = data.length >= 2 ? 
    ((data[data.length - 1].value - data[data.length - 2].value) / data[data.length - 2].value) * 100 : 0;
  
  const formatValue = (val: number) => val >= 1000 ? (val / 1000).toFixed(1) + 'k' : Math.round(val);
  
  return (
    <div className="rounded-2xl border border-surface-hover bg-surface overflow-hidden">
      {/* Header with large current month value */}
      <div className="bg-gradient-to-r from-success/10 via-success/5 to-transparent p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-success/20">
                <TrendingUp className="h-4 w-4 text-success" />
              </div>
              <span className="text-sm font-medium text-gray-400">Revenue</span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold text-success">
                ${formatValue(current?.value || 0)}
              </span>
              <span className="text-sm text-gray-500">this month</span>
            </div>
            {trend !== 0 && (
              <div className={`mt-1 flex items-center gap-1 text-sm ${trend >= 0 ? 'text-success' : 'text-danger'}`}>
                {trend >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span>{Math.abs(trend).toFixed(0)}% vs last month</span>
              </div>
            )}
          </div>
          <button 
            onClick={() => onNavigate('revenue')}
            className="rounded-lg bg-surface-hover px-3 py-1.5 text-sm text-primary hover:bg-surface-hover/80 transition-colors"
          >
            View Details
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 divide-x divide-surface-hover border-t border-surface-hover">
        <div className="p-4">
          <div className="text-xs text-gray-500 mb-1">{data.length}-Month Average</div>
          <div className="text-xl font-semibold text-primary">
            ${formatValue(avg)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">per month</div>
        </div>
        <div className="p-4">
          <div className="text-xs text-gray-500 mb-1">Total Revenue</div>
          <div className="text-xl font-semibold text-warning">
            ${formatValue(total)}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{data.length} months</div>
        </div>
      </div>

      {/* Sparkline Chart */}
      <div className="px-5 pb-5 pt-2">
        <div className="flex items-end justify-between gap-1" style={{ height: '60px' }}>
          {data.slice(-6).map((d, i) => {
            const heightPercent = Math.max((d.value / max) * 100, 15);
            const isCurrent = d.month === currentMonth;
            
            return (
              <div key={i} className="flex flex-col items-center flex-1">
                <div 
                  className="w-full flex items-end justify-center relative group cursor-pointer"
                  style={{ height: '50px' }}
                >
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-2 hidden group-hover:block z-10">
                    <div className="rounded-lg bg-surface-hover px-2 py-1 text-xs whitespace-nowrap">
                      <div className="font-medium">${d.value.toLocaleString()}</div>
                      <div className="text-gray-500">{d.orders} orders</div>
                    </div>
                  </div>
                  <div
                    className={`w-full max-w-[40px] rounded-t-md transition-all duration-300 ${
                      isCurrent 
                        ? 'bg-success shadow-lg shadow-success/20' 
                        : 'bg-success/20 hover:bg-success/40'
                    }`}
                    style={{ height: `${heightPercent}%`, minHeight: '4px' }}
                  />
                </div>
                <div className={`text-[10px] mt-1.5 ${isCurrent ? 'text-success font-medium' : 'text-gray-500'}`}>
                  {d.month.slice(5)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

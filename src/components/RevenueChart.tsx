import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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
  const stats = useMemo(() => {
    const total = data.reduce((sum, d) => sum + d.value, 0);
    const avg = total / data.length || 0;
    const lastMonth = data[data.length - 1]?.value || 0;
    const previousMonth = data[data.length - 2]?.value || 0;
    const change = previousMonth > 0 
      ? ((lastMonth - previousMonth) / previousMonth) * 100 
      : 0;
    
    return { total, avg, lastMonth, change };
  }, [data]);

  return (
    <div className="rounded-xl border border-surface-hover bg-surface p-6">
      <div className="mb-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">Revenue</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div>
              <div className="text-2xl font-bold">${stats.total.toFixed(0)}</div>
              <div className="text-sm text-gray-400">Total Revenue</div>
            </div>
            <div>
              <div className="text-2xl font-bold">${stats.avg.toFixed(0)}</div>
              <div className="text-sm text-gray-400">Monthly Avg</div>
            </div>
            <div>
              <div className="text-2xl font-bold">${stats.lastMonth.toFixed(0)}</div>
              <div className="text-sm text-gray-400">This Month</div>
            </div>
            <div>
              <div className={`text-2xl font-bold ${stats.change >= 0 ? 'text-success' : 'text-danger'}`}>
                {stats.change >= 0 ? '+' : ''}{stats.change.toFixed(0)}%
              </div>
              <div className="text-sm text-gray-400">vs Last Month</div>
            </div>
          </div>
        </div>
        
        <div className="text-right">
          <div className="text-sm text-gray-400">Monthly Goal</div>
          <div className="text-xl font-bold">${goal}</div>
        </div>
      </div>
      
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis 
              dataKey="month" 
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              stroke="#6b7280"
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => `$${value}`}
            />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: '#1a1a2e', 
                border: '1px solid #252542',
                borderRadius: '8px'
              }}
              formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
            />
            
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#6366f1" 
              strokeWidth={2}
              dot={{ fill: '#6366f1', strokeWidth: 0 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { Target, TrendingUp, DollarSign, Calendar, Edit2, Check, X } from 'lucide-react';
import { setData, subscribeToData } from '../lib/firebase';
import { useAppStore } from '../stores/appStore';

interface RevenueGoalsProps {
  currentRevenue: number;
  currentOrders: number;
}

interface Goals {
  monthlyRevenue: number;
  monthlyOrders: number;
  yearlyRevenue: number;
}

export function RevenueGoals({ currentRevenue, currentOrders }: RevenueGoalsProps) {
  const [goals, setGoals] = useState<Goals>({
    monthlyRevenue: 450,
    monthlyOrders: 20,
    yearlyRevenue: 5400,
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState(goals);

  // Load goals from Firebase
  useEffect(() => {
    const unsubscribe = subscribeToData('v6/settings/goals', (data) => {
      if (data) {
        setGoals(data);
        setEditValues(data);
      }
    });
    return () => unsubscribe();
  }, []);

  const handleSave = async () => {
    await setData('v6/settings/goals', editValues);
    setIsEditing(false);
  };

  // Calculate progress
  const revenueProgress = Math.min((currentRevenue / goals.monthlyRevenue) * 100, 100);
  const ordersProgress = Math.min((currentOrders / goals.monthlyOrders) * 100, 100);
  const revenueRemaining = Math.max(goals.monthlyRevenue - currentRevenue, 0);
  const ordersRemaining = Math.max(goals.monthlyOrders - currentOrders, 0);

  // Days remaining in month
  const today = new Date();
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const daysRemaining = daysInMonth - today.getDate();

  // Projected revenue
  const dailyAvg = today.getDate() > 0 ? currentRevenue / today.getDate() : 0;
  const projectedRevenue = dailyAvg * daysInMonth;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(value);
  };

  return (
    <div className="rounded-xl touch-feedback border border-surface-hover bg-surface p-4 lg:p-6">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Target className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">Monthly Goals</h3>
            <p className="text-sm text-gray-400">{daysRemaining} days remaining</p>
          </div>
        </div>

        {isEditing ? (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="rounded-lg bg-success p-2 text-white hover:bg-success/80"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => { setIsEditing(false); setEditValues(goals); }}
              className="rounded-lg touch-feedback bg-surface-hover p-2 hover:bg-surface"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="rounded-lg border border-surface-hover p-2 hover:bg-surface-hover"
          >
            <Edit2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Revenue Goal */}
      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-400">Revenue Goal</span>
          </div>
          {isEditing ? (
            <input
              type="number"
              value={editValues.monthlyRevenue}
              onChange={(e) => setEditValues({ ...editValues, monthlyRevenue: parseInt(e.target.value) || 0 })}
              className="w-24 rounded-lg border border-surface-hover bg-background px-2 py-1 text-right text-sm"
              autoFocus
            />
          ) : (
            <span className="font-medium">{formatCurrency(goals.monthlyRevenue)}</span>
          )}
        </div>

        <div className="mb-2 h-3 overflow-hidden rounded-full bg-surface-hover">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              revenueProgress >= 100 ? 'bg-success' : 'bg-primary'
            }`}
            style={{ width: `${revenueProgress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className={revenueProgress >= 100 ? 'text-success' : 'text-gray-400'}>
            {revenueProgress.toFixed(0)}% complete
          </span>
          <span className="text-gray-500">
            {revenueRemaining > 0 ? `${formatCurrency(revenueRemaining)} to go` : 'Goal achieved! 🎉'}
          </span>
        </div>

        {projectedRevenue > 0 && revenueProgress < 100 && (
          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <TrendingUp className="h-3 w-3" />
            Projected: {formatCurrency(projectedRevenue)}
          </div>
        )}
      </div>

      {/* Orders Goal */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="text-sm text-gray-400">Orders Goal</span>
          </div>
          {isEditing ? (
            <input
              type="number"
              value={editValues.monthlyOrders}
              onChange={(e) => setEditValues({ ...editValues, monthlyOrders: parseInt(e.target.value) || 0 })}
              className="w-16 rounded-lg border border-surface-hover bg-background px-2 py-1 text-right text-sm"
            />
          ) : (
            <span className="font-medium">{goals.monthlyOrders} orders</span>
          )}
        </div>

        <div className="mb-2 h-3 overflow-hidden rounded-full bg-surface-hover">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              ordersProgress >= 100 ? 'bg-success' : 'bg-success/70'
            }`}
            style={{ width: `${ordersProgress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className={ordersProgress >= 100 ? 'text-success' : 'text-gray-400'}>
            {ordersProgress.toFixed(0)}% complete
          </span>
          <span className="text-gray-500">
            {ordersRemaining > 0 ? `${ordersRemaining} to go` : 'Target achieved! 🎉'}
          </span>
        </div>
      </div>
    </div>
  );
}
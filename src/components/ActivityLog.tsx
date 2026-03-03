import { useState, useMemo } from 'react';
import { 
  History, Clock, CheckCircle, Plus, Trash2, Edit3, 
  Briefcase, Package, DollarSign, FileText, Download, Upload,
  Filter, X, ChevronRight
} from 'lucide-react';
import { useActivityStore, ActivityType } from '../stores/activityStore';

const ACTIVITY_ICONS: Record<ActivityType, typeof History> = {
  task_created: Plus,
  task_updated: Edit3,
  task_deleted: Trash2,
  task_completed: CheckCircle,
  task_moved: ChevronRight,
  project_created: Plus,
  project_updated: Edit3,
  project_deleted: Trash2,
  job_created: Plus,
  job_updated: Edit3,
  job_deleted: Trash2,
  job_applied: Briefcase,
  inventory_created: Plus,
  inventory_updated: Edit3,
  inventory_deleted: Trash2,
  inventory_adjusted: Package,
  revenue_added: DollarSign,
  report_generated: FileText,
  data_exported: Download,
  data_imported: Upload,
};

const ACTIVITY_COLORS: Record<ActivityType, string> = {
  task_created: 'text-primary',
  task_updated: 'text-warning',
  task_deleted: 'text-danger',
  task_completed: 'text-success',
  task_moved: 'text-gray-400',
  project_created: 'text-primary',
  project_updated: 'text-warning',
  project_deleted: 'text-danger',
  job_created: 'text-primary',
  job_updated: 'text-warning',
  job_deleted: 'text-danger',
  job_applied: 'text-success',
  inventory_created: 'text-primary',
  inventory_updated: 'text-warning',
  inventory_deleted: 'text-danger',
  inventory_adjusted: 'text-warning',
  revenue_added: 'text-success',
  report_generated: 'text-primary',
  data_exported: 'text-info',
  data_imported: 'text-info',
};

interface ActivityLogProps {
  limit?: number;
  showFilters?: boolean;
}

export function ActivityLog({ limit = 50, showFilters = true }: ActivityLogProps) {
  const { activities, clearActivities } = useActivityStore();
  const [filter, setFilter] = useState<ActivityType | 'all'>('all');

  const filteredActivities = useMemo(() => {
    let result = activities;
    if (filter !== 'all') {
      result = result.filter((a) => a.type === filter);
    }
    return result.slice(0, limit);
  }, [activities, filter, limit]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  };

  const activityGroups = useMemo(() => {
    const groups: Record<string, typeof activities> = {};
    filteredActivities.forEach((activity) => {
      const date = new Date(activity.timestamp).toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(activity);
    });
    return groups;
  }, [filteredActivities]);

  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-surface-hover bg-surface p-8 text-center">
        <History className="mx-auto mb-3 h-12 w-12 text-gray-600" />
        <p className="text-gray-400">No activity yet</p>
        <p className="mt-1 text-sm text-gray-600">Activities will appear as you use Mission Control</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-gray-400" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as ActivityType | 'all')}
              className="rounded-lg border border-surface-hover bg-background px-3 py-1.5 text-sm text-white"
            >
              <option value="all">All Activities</option>
              <option value="task_created">Tasks Created</option>
              <option value="task_completed">Tasks Completed</option>
              <option value="project_created">Projects Created</option>
              <option value="job_applied">Jobs Applied</option>
              <option value="inventory_adjusted">Inventory Adjusted</option>
              <option value="revenue_added">Revenue Added</option>
            </select>
          </div>

          <button
            onClick={clearActivities}
            className="ml-auto text-sm text-danger hover:underline"
          >
            Clear History
          </button>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(activityGroups).map(([date, items]) => (
          <div key={date}>
            <div className="mb-2 flex items-center gap-2 text-sm text-gray-500">
              <Clock className="h-4 w-4" />
              {date === new Date().toLocaleDateString() ? 'Today' : date}
            </div>

            <div className="space-y-2">
              {items.map((activity) => {
                const Icon = ACTIVITY_ICONS[activity.type];
                const colorClass = ACTIVITY_COLORS[activity.type];

                return (
                  <div
                    key={activity.id}
                    className="flex items-start gap-3 rounded-lg border border-surface-hover bg-surface p-3"
                  >
                    <div className={`mt-0.5 ${colorClass}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium">{activity.title}</div>
                      {activity.description && (
                        <div className="text-xs text-gray-500">{activity.description}</div>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">{formatTime(activity.timestamp)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

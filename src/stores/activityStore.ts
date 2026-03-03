import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ActivityType = 
  | 'task_created' | 'task_updated' | 'task_deleted' | 'task_completed' | 'task_moved'
  | 'project_created' | 'project_updated' | 'project_deleted'
  | 'job_created' | 'job_updated' | 'job_deleted' | 'job_applied'
  | 'inventory_created' | 'inventory_updated' | 'inventory_deleted' | 'inventory_adjusted'
  | 'revenue_added' | 'report_generated' | 'data_exported' | 'data_imported';

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description?: string;
  entityId?: string;
  entityType?: 'task' | 'project' | 'job' | 'inventory' | 'revenue' | 'report';
  timestamp: string;
  user?: string;
}

interface ActivityState {
  activities: Activity[];
  addActivity: (activity: Omit<Activity, 'id' | 'timestamp'>) => void;
  getRecentActivities: (limit?: number) => Activity[];
  getActivitiesByType: (type: ActivityType) => Activity[];
  getActivitiesByEntity: (entityType: string, entityId: string) => Activity[];
  clearActivities: () => void;
}

const MAX_ACTIVITIES = 500; // Keep last 500 activities

export const useActivityStore = create<ActivityState>()(
  persist(
    (set, get) => ({
      activities: [],

      addActivity: (activity) => {
        const newActivity: Activity = {
          ...activity,
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date().toISOString(),
        };

        set((state) => ({
          activities: [newActivity, ...state.activities].slice(0, MAX_ACTIVITIES),
        }));
      },

      getRecentActivities: (limit = 50) => {
        return get().activities.slice(0, limit);
      },

      getActivitiesByType: (type) => {
        return get().activities.filter((a) => a.type === type);
      },

      getActivitiesByEntity: (entityType, entityId) => {
        return get().activities.filter(
          (a) => a.entityType === entityType && a.entityId === entityId
        );
      },

      clearActivities: () => set({ activities: [] }),
    }),
    {
      name: 'mc-activities',
    }
  )
);

// Helper to log activities from components
export function logActivity(
  type: ActivityType,
  title: string,
  details?: {
    description?: string;
    entityId?: string;
    entityType?: 'task' | 'project' | 'job' | 'inventory' | 'revenue' | 'report';
    user?: string;
  }
) {
  useActivityStore.getState().addActivity({
    type,
    title,
    ...details,
  });
}
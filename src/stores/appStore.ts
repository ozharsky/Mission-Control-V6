import { create } from 'zustand';
import { subscribeToData, updateData, setData, pushData } from '../lib/firebase';
import type { Task, Project, ProjectTask, Notification, AgentState, Job, InventoryItem, InventoryTransaction, Report, ReportSchedule } from '../types';
import { cleanForFirebase } from '../types';
import { useToastStore } from '../components/Toast';

// Store unsubscribe functions for cleanup
let unsubscribers: (() => void)[] = [];

interface AppState {
  agent: AgentState | null;
  tasks: {
    pending: Task[];
    inProgress: Task[];
    completed: Task[];
  };
  notifications: Notification[];
  unreadCount: number;
  printers: any[];
  revenue: any;
  priorities: any[];
  projects: Project[];
  jobs: Job[];
  inventory: InventoryItem[];
  reports: Report[];
  reportSchedules: ReportSchedule[];
  _lastPrinterUpdate?: number;
  _isSubscribed: boolean;

  setAgent: (agent: AgentState) => void;
  setPrinters: (printers: any[]) => void;
  addTask: (task: Omit<Task, 'id'>) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  moveTask: (id: string, fromStatus: Task['status'], toStatus: Task['status']) => Promise<void>;
  deleteTask: (id: string, status: Task['status']) => Promise<void>;
  addProject: (project: Omit<Project, 'id'>) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  addProjectTask: (projectId: string, task: Omit<ProjectTask, 'id'>) => Promise<void>;
  toggleProjectTask: (projectId: string, taskId: string) => Promise<void>;
  addJob: (job: Omit<Job, 'id' | 'addedAt'>) => Promise<void>;
  updateJob: (id: string, updates: Partial<Job>) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'totalSold'>) => Promise<void>;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  addInventoryTransaction: (transaction: Omit<InventoryTransaction, 'id'>) => Promise<void>;
  generateReport: (config: any) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  addReportSchedule: (schedule: Omit<ReportSchedule, 'id'>) => Promise<void>;
  updateReportSchedule: (id: string, updates: Partial<ReportSchedule>) => Promise<void>;
  deleteReportSchedule: (id: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  initSubscriptions: () => void;
  cleanupSubscriptions: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  agent: null,
  tasks: { pending: [], inProgress: [], completed: [] },
  notifications: [],
  unreadCount: 0,
  printers: [],
  revenue: null,
  priorities: [],
  projects: [],
  jobs: [],
  inventory: [],
  reports: [],
  reportSchedules: [],
  _lastPrinterUpdate: 0,
  _isSubscribed: false,

  setAgent: (agent) => {
    set({ agent });
    setData('v6/agent', agent);
  },

  setPrinters: (printers) => {
    set({ printers, _lastPrinterUpdate: Date.now() });
  },

  addTask: async (task) => {
    try {
      const cleanTask = cleanForFirebase(task);
      await pushData('v6/tasks/pending', cleanTask);
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Task added',
        message: `"${task.title}" has been added to your tasks`,
        duration: 3000,
      });
    } catch (error) {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Failed to add task',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration: 5000,
      });
      throw error;
    }
  },

  updateTask: async (id, updates) => {
    if (!id) {
      console.error('updateTask: id is required');
      return;
    }
    const { tasks } = get();
    let path = '';

    if (tasks.pending?.find(t => t.id === id)) path = 'v6/tasks/pending/' + id;
    else if (tasks.inProgress?.find(t => t.id === id)) path = 'v6/tasks/inProgress/' + id;
    else if (tasks.completed?.find(t => t.id === id)) path = 'v6/tasks/completed/' + id;

    if (path && id) {
      await updateData(path, updates);
    } else {
      console.error('Task not found for update:', id);
    }
  },

  moveTask: async (id, fromStatus, toStatus) => {
    if (!id) {
      console.error('moveTask: id is required');
      return;
    }
    const { tasks } = get();

    // Find the task
    let task: Task | undefined;
    let fromPath = '';

    if (fromStatus === 'pending') {
      task = tasks.pending?.find(t => t.id === id);
      fromPath = 'v6/tasks/pending/' + id;
    } else if (fromStatus === 'in-progress') {
      task = tasks.inProgress?.find(t => t.id === id);
      fromPath = 'v6/tasks/inProgress/' + id;
    } else if (fromStatus === 'completed') {
      task = tasks.completed?.find(t => t.id === id);
      fromPath = 'v6/tasks/completed/' + id;
    }

    if (!task) {
      console.error('Task not found for move:', id);
      return;
    }

    // Delete from old location
    await setData(fromPath, null);

    // Add to new location with updated status - preserve the ID!
    const updatedTask = { ...task, status: toStatus };
    const toPath = toStatus === 'pending' ? `v6/tasks/pending/${id}` :
                   toStatus === 'in-progress' ? `v6/tasks/inProgress/${id}` :
                   `v6/tasks/completed/${id}`;

    await setData(toPath, updatedTask);
  },

  deleteTask: async (id, status) => {
    if (!id) {
      console.error('deleteTask: id is required');
      return;
    }
    try {
      const path = status === 'pending' ? `v6/tasks/pending/${id}` :
                   status === 'in-progress' ? `v6/tasks/inProgress/${id}` :
                   `v6/tasks/completed/${id}`;
      await setData(path, null);
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Task deleted',
        duration: 3000,
      });
    } catch (error) {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Failed to delete task',
        duration: 5000,
      });
      throw error;
    }
  },

  addProject: async (project) => {
    if (!project?.name) {
      console.error('addProject: project name is required');
      return;
    }
    try {
      await pushData('v6/data/projects', project);
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Project created',
        message: `"${project.name}" has been created`,
        duration: 3000,
      });
    } catch (error) {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Failed to create project',
        duration: 5000,
      });
      throw error;
    }
  },

  updateProject: async (id, updates) => {
    if (!id) {
      console.error('updateProject: id is required');
      return;
    }
    await updateData(`v6/data/projects/${id}`, updates);
  },

  addProjectTask: async (projectId, task) => {
    if (!projectId) {
      console.error('addProjectTask: projectId is required');
      return;
    }
    if (!task?.title) {
      console.error('addProjectTask: task title is required');
      return;
    }
    const { projects } = get();
    const project = projects?.find(p => p.id === projectId);
    if (project) {
      const newTask = { ...task, id: Date.now().toString() };
      const updatedTasks = [...(project.tasks || []), newTask];
      await updateData(`v6/data/projects/${projectId}`, {
        tasks: updatedTasks,
        tasksTotal: updatedTasks.length,
      });
    } else {
      console.error('Project not found:', projectId);
    }
  },

  toggleProjectTask: async (projectId, taskId) => {
    if (!projectId || !taskId) {
      console.error('toggleProjectTask: projectId and taskId are required');
      return;
    }
    const { projects } = get();
    const project = projects?.find(p => p.id === projectId);
    if (project?.tasks) {
      const updatedTasks = project.tasks.map(t =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      );
      const completedCount = updatedTasks.filter(t => t.completed).length;
      const progress = updatedTasks.length > 0 ? Math.round((completedCount / updatedTasks.length) * 100) : 0;

      await updateData(`v6/data/projects/${projectId}`, {
        tasks: updatedTasks,
        tasksCompleted: completedCount,
        progress,
        status: progress === 100 ? 'completed' : project.status,
      });
    } else {
      console.error('Project or tasks not found:', projectId);
    }
  },

  markNotificationRead: async (id) => {
    if (!id) {
      console.error('markNotificationRead: id is required');
      return;
    }
    await updateData(`v6/notifications/${id}`, { read: true });
  },

  initSubscriptions: () => {
    const { _isSubscribed } = get();
    
    // Prevent double subscription
    if (_isSubscribed) {
      console.log('Subscriptions already initialized');
      return;
    }

    // Clean up any existing subscriptions first
    get().cleanupSubscriptions();

    const newUnsubscribers: (() => void)[] = [];

    newUnsubscribers.push(
      subscribeToData('v6/agent', (data) => {
        if (data) set({ agent: data });
      })
    );

    newUnsubscribers.push(
      subscribeToData('v6/tasks', (data) => {
        if (data) {
          set({
            tasks: {
              pending: data.pending ? Object.values(data.pending) : [],
              inProgress: data.inProgress ? Object.values(data.inProgress) : [],
              completed: data.completed ? Object.values(data.completed) : [],
            }
          });
        }
      })
    );

    newUnsubscribers.push(
      subscribeToData('v6/notifications', (data) => {
        if (data) {
          const notifications = Object.values(data) as Notification[];
          set({
            notifications,
            unreadCount: notifications.filter(n => n && !n.read).length,
          });
        }
      })
    );

    newUnsubscribers.push(
      subscribeToData('v6/data/printers', (data) => {
        if (data) {
          const printers = Object.values(data).filter(p => p != null);
          set({ printers, _lastPrinterUpdate: Date.now() });
        }
      })
    );

    newUnsubscribers.push(
      subscribeToData('v6/data/revenue', (data) => {
        if (data) set({ revenue: data });
      })
    );

    newUnsubscribers.push(
      subscribeToData('v6/data/priorities', (data) => {
        if (data) {
          const priorities = Object.values(data).filter(p => p != null);
          set({ priorities });
        }
      })
    );

    newUnsubscribers.push(
      subscribeToData('v6/data/projects', (data) => {
        if (data) {
          const projects = Object.entries(data)
            .filter(([_, project]) => project != null)
            .map(([id, project]: [string, any]) => ({
              id,
              ...project,
              tasks: project.tasks || [],
            }));
          set({ projects });
        }
      })
    );

    newUnsubscribers.push(
      subscribeToData('v6/jobs', (data) => {
        if (data) {
          const jobs = Object.entries(data)
            .filter(([_, job]) => job != null)
            .map(([id, job]: [string, any]) => ({
              id,
              ...job,
            }));
          set({ jobs });
        }
      })
    );

    newUnsubscribers.push(
      subscribeToData('v6/inventory', (data) => {
        if (data) {
          const inventory = Object.entries(data)
            .filter(([_, item]) => item != null)
            .map(([id, item]: [string, any]) => ({
              id,
              ...item,
            }));
          set({ inventory });
        }
      })
    );

    newUnsubscribers.push(
      subscribeToData('v6/reports', (data) => {
        if (data) {
          const reports = Object.entries(data)
            .filter(([_, report]) => report != null)
            .map(([id, report]: [string, any]) => ({
              id,
              ...report,
            }));
          set({ reports });
        }
      })
    );

    newUnsubscribers.push(
      subscribeToData('v6/reportSchedules', (data) => {
        if (data) {
          const reportSchedules = Object.entries(data)
            .filter(([_, schedule]) => schedule != null)
            .map(([id, schedule]: [string, any]) => ({
              id,
              ...schedule,
            }));
          set({ reportSchedules });
        }
      })
    );

    // Store unsubscribers
    unsubscribers = newUnsubscribers;
    set({ _isSubscribed: true });
    console.log('Firebase subscriptions initialized');
  },

  cleanupSubscriptions: () => {
    unsubscribers.forEach(unsub => {
      try {
        unsub();
      } catch (e) {
        console.error('Error unsubscribing:', e);
      }
    });
    unsubscribers = [];
    set({ _isSubscribed: false });
    console.log('Firebase subscriptions cleaned up');
  },

  addJob: async (job) => {
    if (!job?.title) {
      console.error('addJob: job title is required');
      return;
    }
    try {
      const jobWithMeta = {
        ...job,
        addedAt: new Date().toISOString(),
      };
      await pushData('v6/jobs', jobWithMeta);
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Job added',
        message: `"${job.title}" has been added to your jobs`,
        duration: 3000,
      });
    } catch (error) {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Failed to add job',
        duration: 5000,
      });
      throw error;
    }
  },

  updateJob: async (id, updates) => {
    if (!id) {
      console.error('updateJob: id is required');
      return;
    }
    await updateData(`v6/jobs/${id}`, updates);
  },

  deleteJob: async (id) => {
    if (!id) {
      console.error('deleteJob: id is required');
      return;
    }
    try {
      await setData(`v6/jobs/${id}`, null);
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Job deleted',
        duration: 3000,
      });
    } catch (error) {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Failed to delete job',
        duration: 5000,
      });
      throw error;
    }
  },

  addInventoryItem: async (item) => {
    if (!item?.name) {
      console.error('addInventoryItem: item name is required');
      return;
    }
    try {
      const itemWithMeta = {
        ...item,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        totalSold: 0,
      };
      await pushData('v6/inventory', itemWithMeta);
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Item added',
        message: `"${item.name}" added to inventory`,
        duration: 3000,
      });
    } catch (error) {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Failed to add item',
        duration: 5000,
      });
      throw error;
    }
  },

  updateInventoryItem: async (id, updates) => {
    if (!id) {
      console.error('updateInventoryItem: id is required');
      return;
    }
    await updateData(`v6/inventory/${id}`, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  deleteInventoryItem: async (id) => {
    if (!id) {
      console.error('deleteInventoryItem: id is required');
      return;
    }
    try {
      await setData(`v6/inventory/${id}`, null);
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Item deleted',
        duration: 3000,
      });
    } catch (error) {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Failed to delete item',
        duration: 5000,
      });
      throw error;
    }
  },

  addInventoryTransaction: async (transaction) => {
    if (!transaction?.itemId) {
      console.error('addInventoryTransaction: itemId is required');
      return;
    }
    await pushData('v6/inventory/transactions', transaction);
  },

  generateReport: async (config) => {
    if (!config?.sections || !Array.isArray(config.sections)) {
      console.error('generateReport: config.sections array is required');
      return;
    }
    // Get current state from get() provided by Zustand
    const state = get();
    
    // Calculate summary stats with null safety
    const summary = {
      revenue: {
        total: state.revenue ? Object.values(state.revenue).reduce((sum: number, r: any) => sum + (r?.value || 0), 0) : 0,
        previousPeriod: 0,
        change: 0,
        orders: state.revenue ? Object.values(state.revenue).reduce((sum: number, r: any) => sum + (r?.orders || 0), 0) : 0,
      },
      tasks: {
        completed: state.tasks?.completed?.length || 0,
        created: (state.tasks?.pending?.length || 0) + (state.tasks?.inProgress?.length || 0) + (state.tasks?.completed?.length || 0),
        pending: (state.tasks?.pending?.length || 0) + (state.tasks?.inProgress?.length || 0),
      },
      projects: {
        completed: state.projects?.filter(p => p?.status === 'done').length || 0,
        active: state.projects?.filter(p => p?.status !== 'done').length || 0,
        new: 0,
      },
      inventory: {
        lowStock: state.inventory?.filter(i => i && i.quantity <= i.minStock).length || 0,
        totalValue: state.inventory?.reduce((sum, i) => sum + ((i?.quantity || 0) * (i?.unitCost || 0)), 0) || 0,
      },
    };

    const report = {
      ...config,
      status: 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      summary,
      sections: config.sections.map((section: string) => ({
        id: section,
        title: section.charAt(0).toUpperCase() + section.slice(1),
        type: section,
        data: {},
        insights: [],
      })),
    };

    await pushData('v6/reports', report);
  },

  deleteReport: async (id) => {
    if (!id) {
      console.error('deleteReport: id is required');
      return;
    }
    await setData(`v6/reports/${id}`, null);
  },

  addReportSchedule: async (schedule) => {
    if (!schedule) {
      console.error('addReportSchedule: schedule is required');
      return;
    }
    await pushData('v6/reportSchedules', schedule);
  },

  updateReportSchedule: async (id, updates) => {
    if (!id) {
      console.error('updateReportSchedule: id is required');
      return;
    }
    await updateData(`v6/reportSchedules/${id}`, updates);
  },

  deleteReportSchedule: async (id) => {
    if (!id) {
      console.error('deleteReportSchedule: id is required');
      return;
    }
    await setData(`v6/reportSchedules/${id}`, null);
  },
}));
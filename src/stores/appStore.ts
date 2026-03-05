import { create } from 'zustand';
import { subscribeToData, updateData, setData, pushData } from '../lib/firebase';
import type { Task, Project, ProjectTask, Notification, Job, InventoryItem, InventoryTransaction, Report, ReportSchedule, CalendarEvent } from '../types';
import { cleanForFirebase } from '../types';
import { useToastStore } from '../components/Toast';
import { logActivity } from './activityStore';

// Store unsubscribe functions for cleanup
let unsubscribers: (() => void)[] = [];

interface AppState {
  tasks: {
    pending: Task[];
    inProgress: Task[];
    completed: Task[];
  };
  notifications: Notification[];
  unreadCount: number;
  printers: Printer[];
  revenue: Revenue;
  priorities: Priority[];
  projects: Project[];
  jobs: Job[];
  inventory: InventoryItem[];
  reports: Report[];
  reportSchedules: ReportSchedule[];
  calendarEvents: CalendarEvent[];
  _lastPrinterUpdate?: number;
  _isSubscribed: boolean;

  setPrinters: (printers: Printer[]) => void;
  addTask: (task: Omit<Task, 'id'>) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  moveTask: (id: string, fromStatus: Task['status'], toStatus: Task['status']) => Promise<void>;
  deleteTask: (id: string, status: Task['status']) => Promise<void>;
  addProject: (project: Omit<Project, 'id'>) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addProjectTask: (projectId: string, task: Omit<ProjectTask, 'id'>) => Promise<void>;
  toggleProjectTask: (projectId: string, taskId: string) => Promise<void>;
  addJob: (job: Omit<Job, 'id' | 'addedAt'>) => Promise<void>;
  updateJob: (id: string, updates: Partial<Job>) => Promise<void>;
  deleteJob: (id: string) => Promise<void>;
  addInventoryItem: (item: Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'totalSold'>) => Promise<void>;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => Promise<void>;
  deleteInventoryItem: (id: string) => Promise<void>;
  addInventoryTransaction: (transaction: Omit<InventoryTransaction, 'id'>) => Promise<void>;
  generateReport: (config: ReportConfig) => Promise<void>;
  deleteReport: (id: string) => Promise<void>;
  addReportSchedule: (schedule: Omit<ReportSchedule, 'id'>) => Promise<void>;
  updateReportSchedule: (id: string, updates: Partial<ReportSchedule>) => Promise<void>;
  deleteReportSchedule: (id: string) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  initSubscriptions: () => void;
  cleanupSubscriptions: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
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
  calendarEvents: [],
  _lastPrinterUpdate: 0,
  _isSubscribed: false,

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
      logActivity('task_created', `Task created: ${task.title}`, {
        entityId: task.title,
        entityType: 'task',
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
    }
  },

  moveTask: async (id, fromStatus, toStatus) => {
    if (!id) {
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
      logActivity('project_created', `Project created: ${project.name}`, {
        entityId: project.name,
        entityType: 'project',
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
      return;
    }
    await updateData(`v6/data/projects/${id}`, updates);
  },

  deleteProject: async (id) => {
    if (!id) {
      return;
    }
    try {
      await setData(`v6/data/projects/${id}`, null);
      useToastStore.getState().addToast({
        type: 'success',
        title: 'Project deleted',
        duration: 3000,
      });
    } catch (error) {
      useToastStore.getState().addToast({
        type: 'error',
        title: 'Failed to delete project',
        duration: 5000,
      });
      throw error;
    }
  },

  addProjectTask: async (projectId, task) => {
    if (!projectId) {
      return;
    }
    if (!task?.title) {
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
    }
  },

  toggleProjectTask: async (projectId, taskId) => {
    if (!projectId || !taskId) {
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
    }
  },

  markNotificationRead: async (id) => {
    if (!id) {
      return;
    }
    await updateData(`v6/notifications/${id}`, { read: true });
  },

  initSubscriptions: () => {
    const { _isSubscribed } = get();
    
    // Prevent double subscription
    if (_isSubscribed) {
      return;
    }

    // Clean up any existing subscriptions first
    get().cleanupSubscriptions();

    const newUnsubscribers: (() => void)[] = [];

    newUnsubscribers.push(
      subscribeToData('v6/tasks', (data) => {
        if (data) {
          // Preserve Firebase keys as task IDs
          const processTasks = (taskData: any) => {
            if (!taskData) return [];
            return Object.entries(taskData).map(([id, task]: [string, any]) => ({
              id,
              ...task,
            }));
          };
          
          set({
            tasks: {
              pending: processTasks(data.pending),
              inProgress: processTasks(data.inProgress),
              completed: processTasks(data.completed),
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

    // Subscribe to calendar events
    newUnsubscribers.push(
      subscribeToData('v6/calendar/events', (data) => {
        if (data) {
          const calendarEvents = Object.entries(data)
            .filter(([_, event]) => event != null)
            .map(([id, event]: [string, any]) => ({
              id,
              ...event,
            }));
          set({ calendarEvents });
        } else {
          set({ calendarEvents: [] });
        }
      })
    );

    // Store unsubscribers
    unsubscribers = newUnsubscribers;
    set({ _isSubscribed: true });
  },

  cleanupSubscriptions: () => {
    unsubscribers.forEach(unsub => {
      try {
        unsub();
      } catch (e) {
      }
    });
    unsubscribers = [];
    set({ _isSubscribed: false });
  },

  addJob: async (job) => {
    if (!job?.title) {
      return;
    }
    try {
      const jobWithMeta = {
        ...job,
        requirements: job.requirements || [],
        tags: job.tags || [],
        notes: job.notes || '',
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
      return;
    }
    await updateData(`v6/jobs/${id}`, updates);
  },

  deleteJob: async (id) => {
    if (!id) {
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
      return;
    }
    await updateData(`v6/inventory/${id}`, {
      ...updates,
      updatedAt: new Date().toISOString(),
    });
  },

  deleteInventoryItem: async (id) => {
    if (!id) {
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
      return;
    }
    await pushData('v6/inventory/transactions', transaction);
  },

  generateReport: async (config) => {
    if (!config?.sections || !Array.isArray(config.sections)) {
      return;
    }
    // Get current state from get() provided by Zustand
    const state = get();
    
    // Calculate date range for filtering
    const now = new Date();
    const startDate = config.dateRange?.start ? new Date(config.dateRange.start) : new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endDate = config.dateRange?.end ? new Date(config.dateRange.end) : now;
    
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

    // Generate detailed sections
    const sections = config.sections.map((section: string) => {
      const baseSection = {
        id: section,
        title: section.charAt(0).toUpperCase() + section.slice(1),
        type: section,
        data: {},
        insights: [] as string[],
      };

      switch (section) {
        case 'revenue':
          const revenueData = state.revenue ? Object.entries(state.revenue)
            .filter(([month]: [string, any]) => {
              const date = new Date(month + '-01');
              return date >= startDate && date <= endDate;
            })
            .map(([month, r]: [string, any]) => ({
              month,
              value: r?.value || 0,
              orders: r?.orders || 0,
            }))
            .sort((a, b) => a.month.localeCompare(b.month)) : [];
          
          const totalRevenue = revenueData.reduce((sum, r) => sum + r.value, 0);
          const totalOrders = revenueData.reduce((sum, r) => sum + r.orders, 0);
          const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
          
          baseSection.data = {
            monthlyData: revenueData,
            totalRevenue,
            totalOrders,
            avgOrderValue,
          };
          baseSection.insights = [
            totalRevenue > 0 ? `Total revenue: $${totalRevenue.toLocaleString()}` : 'No revenue data for this period',
            totalOrders > 0 ? `${totalOrders} orders with $${avgOrderValue.toFixed(2)} average order value` : 'No orders recorded',
            revenueData.length > 1 ? `Trending across ${revenueData.length} months` : 'Need more data for trend analysis',
          ];
          break;

        case 'tasks':
          const allTasks = [
            ...(state.tasks?.pending || []),
            ...(state.tasks?.inProgress || []),
            ...(state.tasks?.completed || []),
          ].filter(t => {
            if (!t.createdAt) return true;
            const date = new Date(t.createdAt);
            return date >= startDate && date <= endDate;
          });
          
          const completedTasks = allTasks.filter(t => t.status === 'completed');
          const highPriorityTasks = allTasks.filter(t => t.priority === 'high');
          const overdueTasks = allTasks.filter(t => {
            if (!t.dueDate || t.status === 'completed') return false;
            return new Date(t.dueDate) < now;
          });
          
          baseSection.data = {
            total: allTasks.length,
            completed: completedTasks.length,
            pending: allTasks.filter(t => t.status === 'pending').length,
            inProgress: allTasks.filter(t => t.status === 'in-progress').length,
            highPriority: highPriorityTasks.length,
            overdue: overdueTasks.length,
            completionRate: allTasks.length > 0 ? (completedTasks.length / allTasks.length) * 100 : 0,
            recentTasks: allTasks.slice(0, 10),
          };
          baseSection.insights = [
            `${completedTasks.length} of ${allTasks.length} tasks completed (${baseSection.data.completionRate.toFixed(0)}%)`,
            overdueTasks.length > 0 ? `${overdueTasks.length} overdue tasks need attention` : 'No overdue tasks',
            highPriorityTasks.length > 0 ? `${highPriorityTasks.length} high priority tasks` : 'No high priority tasks',
          ];
          break;

        case 'projects':
          const activeProjects = state.projects?.filter(p => p?.status !== 'done') || [];
          const completedProjects = state.projects?.filter(p => p?.status === 'done') || [];
          const highProgressProjects = activeProjects.filter(p => (p.progress || 0) >= 75);
          
          baseSection.data = {
            total: state.projects?.length || 0,
            active: activeProjects.length,
            completed: completedProjects.length,
            highProgress: highProgressProjects.length,
            byBoard: {
              etsy: state.projects?.filter(p => p.board === 'etsy').length || 0,
              photography: state.projects?.filter(p => p.board === 'photography').length || 0,
              wholesale: state.projects?.filter(p => p.board === 'wholesale').length || 0,
              general: state.projects?.filter(p => p.board === 'general' || !p.board).length || 0,
            },
            recentProjects: state.projects?.slice(0, 5) || [],
          };
          baseSection.insights = [
            `${activeProjects.length} active projects, ${completedProjects.length} completed`,
            highProgressProjects.length > 0 ? `${highProgressProjects.length} projects near completion (75%+)` : 'No projects near completion',
            activeProjects.length > 0 ? `Average progress: ${(activeProjects.reduce((sum, p) => sum + (p.progress || 0), 0) / activeProjects.length).toFixed(0)}%` : 'No active projects',
          ];
          break;

        case 'inventory':
          const inventoryItems = state.inventory || [];
          const outOfStock = inventoryItems.filter(i => i.quantity === 0);
          const lowStock = inventoryItems.filter(i => i.quantity > 0 && i.quantity <= i.minStock);
          const inStock = inventoryItems.filter(i => i.quantity > i.minStock);
          
          const byCategory = {
            product: inventoryItems.filter(i => i.category === 'product').length,
            material: inventoryItems.filter(i => i.category === 'material').length,
            tool: inventoryItems.filter(i => i.category === 'tool').length,
            supply: inventoryItems.filter(i => i.category === 'supply').length,
          };
          
          baseSection.data = {
            total: inventoryItems.length,
            inStock: inStock.length,
            lowStock: lowStock.length,
            outOfStock: outOfStock.length,
            byCategory,
            totalValue: inventoryItems.reduce((sum, i) => sum + (i.quantity * i.unitCost), 0),
            lowStockItems: lowStock.slice(0, 5),
          };
          baseSection.insights = [
            `${inStock.length} items well stocked, ${lowStock.length} low, ${outOfStock.length} out of stock`,
            `Total inventory value: $${baseSection.data.totalValue.toLocaleString()}`,
            lowStock.length > 0 ? `${lowStock.length} items need restocking` : 'All items adequately stocked',
          ];
          break;

        case 'jobs':
          const jobs = state.jobs || [];
          const newJobs = jobs.filter(j => j.status === 'new');
          const appliedJobs = jobs.filter(j => j.status === 'applied');
          const highValueJobs = jobs.filter(j => {
            const salary = j.salary?.toLowerCase() || '';
            const match = salary.match(/(\d+)/);
            return match && parseInt(match[1]) >= 5;
          });
          
          baseSection.data = {
            total: jobs.length,
            new: newJobs.length,
            applied: appliedJobs.length,
            highValue: highValueJobs.length,
            byType: {
              freelance: jobs.filter(j => j.type === 'freelance').length,
              partTime: jobs.filter(j => j.type === 'part-time').length,
              fullTime: jobs.filter(j => j.type === 'full-time').length,
            },
            recentJobs: jobs.slice(0, 5),
          };
          baseSection.insights = [
            `${newJobs.length} new opportunities to review`,
            `${appliedJobs.length} applications pending`,
            highValueJobs.length > 0 ? `${highValueJobs.length} high-value opportunities ($5k+)` : 'No high-value opportunities',
          ];
          break;

        default:
          baseSection.data = {};
          baseSection.insights = ['No data available for this section'];
      }

      return baseSection;
    });

    const report = {
      ...config,
      status: 'completed',
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      summary,
      sections,
    };

    await pushData('v6/reports', report);
  },

  deleteReport: async (id) => {
    if (!id) {
      return;
    }
    await setData(`v6/reports/${id}`, null);
  },

  addReportSchedule: async (schedule) => {
    if (!schedule) {
      return;
    }
    await pushData('v6/reportSchedules', schedule);
  },

  updateReportSchedule: async (id, updates) => {
    if (!id) {
      return;
    }
    await updateData(`v6/reportSchedules/${id}`, updates);
  },

  deleteReportSchedule: async (id) => {
    if (!id) {
      return;
    }
    await setData(`v6/reportSchedules/${id}`, null);
  },

  // Calendar Events
  addCalendarEvent: async (event) => {
    const eventWithMeta = {
      ...event,
      createdAt: new Date().toISOString(),
    };
    const id = await pushData('v6/calendar/events', eventWithMeta);
    return id;
  },

  updateCalendarEvent: async (id, updates) => {
    if (!id) return;
    await updateData(`v6/calendar/events/${id}`, updates);
  },

  deleteCalendarEvent: async (id) => {
    if (!id) return;
    await setData(`v6/calendar/events/${id}`, null);
  },
}));
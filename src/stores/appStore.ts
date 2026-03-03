import { create } from 'zustand';
import { subscribeToData, updateData, setData, pushData } from '../lib/firebase';
import type { Task, Project, ProjectTask, Notification, AgentState, Job } from '../types';
import { cleanForFirebase } from '../types';

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
  _lastPrinterUpdate?: number;

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
  markNotificationRead: (id: string) => Promise<void>;
  initSubscriptions: () => void;
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
  _lastPrinterUpdate: 0,

  setAgent: (agent) => {
    set({ agent });
    setData('v6/agent', agent);
  },

  setPrinters: (printers) => {
    set({ printers, _lastPrinterUpdate: Date.now() });
  },

  addTask: async (task) => {
    const cleanTask = cleanForFirebase(task);
    await pushData('v6/tasks/pending', cleanTask);
  },

  updateTask: async (id, updates) => {
    const { tasks } = get();
    let path = '';

    if (tasks.pending.find(t => t.id === id)) path = 'v6/tasks/pending/' + id;
    else if (tasks.inProgress.find(t => t.id === id)) path = 'v6/tasks/inProgress/' + id;
    else if (tasks.completed.find(t => t.id === id)) path = 'v6/tasks/completed/' + id;

    if (path && id) {
      await updateData(path, updates);
    } else {
      console.error('Task not found for update:', id);
    }
  },

  moveTask: async (id, fromStatus, toStatus) => {
    const { tasks } = get();

    // Find the task
    let task: Task | undefined;
    let fromPath = '';

    if (fromStatus === 'pending') {
      task = tasks.pending.find(t => t.id === id);
      fromPath = 'v6/tasks/pending/' + id;
    } else if (fromStatus === 'in-progress') {
      task = tasks.inProgress.find(t => t.id === id);
      fromPath = 'v6/tasks/inProgress/' + id;
    } else if (fromStatus === 'completed') {
      task = tasks.completed.find(t => t.id === id);
      fromPath = 'v6/tasks/completed/' + id;
    }

    if (!task) return;

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
    const path = status === 'pending' ? `v6/tasks/pending/${id}` :
                 status === 'in-progress' ? `v6/tasks/inProgress/${id}` :
                 `v6/tasks/completed/${id}`;
    await setData(path, null);
  },

  addProject: async (project) => {
    await pushData('v6/data/projects', project);
  },

  updateProject: async (id, updates) => {
    await updateData(`v6/data/projects/${id}`, updates);
  },

  addProjectTask: async (projectId, task) => {
    const { projects } = get();
    const project = projects.find(p => p.id === projectId);
    if (project) {
      const newTask = { ...task, id: Date.now().toString() };
      const updatedTasks = [...project.tasks, newTask];
      await updateData(`v6/data/projects/${projectId}`, {
        tasks: updatedTasks,
        tasksTotal: updatedTasks.length,
      });
    }
  },

  toggleProjectTask: async (projectId, taskId) => {
    const { projects } = get();
    const project = projects.find(p => p.id === projectId);
    if (project) {
      const updatedTasks = project.tasks.map(t =>
        t.id === taskId ? { ...t, completed: !t.completed } : t
      );
      const completedCount = updatedTasks.filter(t => t.completed).length;
      const progress = Math.round((completedCount / updatedTasks.length) * 100);

      await updateData(`v6/data/projects/${projectId}`, {
        tasks: updatedTasks,
        tasksCompleted: completedCount,
        progress,
        status: progress === 100 ? 'completed' : project.status,
      });
    }
  },

  markNotificationRead: async (id) => {
    await updateData(`v6/notifications/${id}`, { read: true });
  },

  initSubscriptions: () => {
    subscribeToData('v6/agent', (data) => {
      if (data) set({ agent: data });
    });

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
    });

    subscribeToData('v6/notifications', (data) => {
      if (data) {
        const notifications = Object.values(data) as Notification[];
        set({
          notifications,
          unreadCount: notifications.filter(n => !n.read).length
        });
      }
    });

    subscribeToData('v6/data/projects', (data) => {
      if (data) set({ projects: Object.values(data) });
    });

    subscribeToData('data/printers', (data) => {
      // Skip Firebase printer data if SimplyPrint API is configured
      const simplyPrintKey = localStorage.getItem('simplyprint_api_key');
      if (simplyPrintKey) {
        return; // Use live SimplyPrint data instead
      }

      // Also skip if we recently got live data (within last 5 seconds)
      const { _lastPrinterUpdate } = get();
      if (_lastPrinterUpdate && Date.now() - _lastPrinterUpdate < 5000) {
        return;
      }

      if (data) {
        // Transform printer data to match component expectations
        const printersList = Object.values(data).map((printer: any) => {
          // Extract temps from SimplyPrint API format
          const temps = printer.temps || printer.temperature || {};
          const current = temps.current || {};
          const target = temps.target || {};

          // Handle tool array or single value
          const toolTemp = Array.isArray(current.tool) ? current.tool[0] : current.tool;
          const targetToolTemp = Array.isArray(target.tool) ? target.tool[0] : target.tool;

          return {
            ...printer,
            temp: toolTemp ?? printer.temp ?? 0,
            targetTemp: targetToolTemp ?? printer.targetTemp ?? 0,
            bedTemp: current.bed ?? printer.bedTemp ?? 0,
            targetBedTemp: target.bed ?? printer.targetBedTemp ?? 0,
          };
        });
        set({ printers: printersList });
      }
    });

    subscribeToData('v6/data/revenue', (data) => {
      if (data) set({ revenue: data });
    });

    subscribeToData('data/priorities', (data) => {
      if (data) set({ priorities: Object.values(data) });
    });

    subscribeToData('v6/jobs', (data) => {
      if (data) set({ jobs: Object.values(data) });
    });
  },

  addJob: async (job) => {
    const jobWithMeta = {
      ...job,
      addedAt: new Date().toISOString(),
    };
    await pushData('v6/jobs', jobWithMeta);
  },

  updateJob: async (id, updates) => {
    await updateData(`v6/jobs/${id}`, updates);
  },

  deleteJob: async (id) => {
    await setData(`v6/jobs/${id}`, null);
  },
}));
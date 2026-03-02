import { create } from 'zustand';
import { subscribeToData, updateData, setData, pushData } from '../lib/firebase';

interface AgentState {
  status: 'online' | 'offline' | 'busy';
  currentTask: string;
  lastSeen: string;
  model: string;
}

interface Task {
  id: string;
  title: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
  createdBy: 'user' | 'agent';
  createdAt: string;
  projectId?: string;
}

interface ProjectTask {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
}

interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'on-hold';
  progress: number;
  tasksCompleted: number;
  tasksTotal: number;
  dueDate?: string;
  tags: string[];
  tasks: ProjectTask[];
}

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

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
  
  setAgent: (agent: AgentState) => void;
  setPrinters: (printers: any[]) => void;
  addTask: (task: Omit<Task, 'id'>) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  addProject: (project: Omit<Project, 'id'>) => Promise<void>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  addProjectTask: (projectId: string, task: Omit<ProjectTask, 'id'>) => Promise<void>;
  toggleProjectTask: (projectId: string, taskId: string) => Promise<void>;
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
  
  setAgent: (agent) => {
    set({ agent });
    setData('v6/agent', agent);
  },
  
  setPrinters: (printers) => {
    set({ printers });
  },
  
  addTask: async (task) => {
    await pushData('v6/tasks/pending', task);
  },
  
  updateTask: async (id, updates) => {
    const { tasks } = get();
    let path = '';
    
    if (tasks.pending.find(t => t.id === id)) path = 'v6/tasks/pending/' + id;
    else if (tasks.inProgress.find(t => t.id === id)) path = 'v6/tasks/inProgress/' + id;
    else if (tasks.completed.find(t => t.id === id)) path = 'v6/tasks/completed/' + id;
    
    if (path) {
      await updateData(path, updates);
    }
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
      // Only use Firebase data if we don't have live SimplyPrint data
      const { printers } = get();
      if (data && printers.length === 0) {
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
    
    subscribeToData('data/revenueHistory', (data) => {
      if (data) set({ revenue: data });
    });
    
    subscribeToData('data/priorities', (data) => {
      if (data) set({ priorities: Object.values(data) });
    });
  }
}));
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
  // Agent
  agent: AgentState | null;
  
  // Tasks
  tasks: {
    pending: Task[];
    inProgress: Task[];
    completed: Task[];
  };
  
  // Notifications
  notifications: Notification[];
  unreadCount: number;
  
  // Data
  printers: any[];
  revenue: any;
  priorities: any[];
  projects: any[];
  
  // Actions
  setAgent: (agent: AgentState) => void;
  addTask: (task: Omit<Task, 'id'>) => Promise<void>;
  updateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  markNotificationRead: (id: string) => Promise<void>;
  
  // Firebase subscriptions
  initSubscriptions: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  // Initial state
  agent: null,
  tasks: { pending: [], inProgress: [], completed: [] },
  notifications: [],
  unreadCount: 0,
  printers: [],
  revenue: null,
  priorities: [],
  projects: [],
  
  // Actions
  setAgent: (agent) => {
    set({ agent });
    setData('v6/agent', agent);
  },
  
  addTask: async (task) => {
    await pushData('v6/tasks/pending', task);
  },
  
  updateTask: async (id, updates) => {
    // Find which list the task is in
    const { tasks } = get();
    let path = '';
    
    if (tasks.pending.find(t => t.id === id)) path = 'v6/tasks/pending/' + id;
    else if (tasks.inProgress.find(t => t.id === id)) path = 'v6/tasks/inProgress/' + id;
    else if (tasks.completed.find(t => t.id === id)) path = 'v6/tasks/completed/' + id;
    
    if (path) {
      await updateData(path, updates);
    }
  },
  
  markNotificationRead: async (id) => {
    await updateData(`v6/notifications/${id}`, { read: true });
  },
  
  // Initialize Firebase subscriptions
  initSubscriptions: () => {
    // Subscribe to agent status
    subscribeToData('v6/agent', (data) => {
      if (data) set({ agent: data });
    });
    
    // Subscribe to tasks
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
    
    // Subscribe to notifications
    subscribeToData('v6/notifications', (data) => {
      if (data) {
        const notifications = Object.values(data) as Notification[];
        set({
          notifications,
          unreadCount: notifications.filter(n => !n.read).length
        });
      }
    });
    
    // Subscribe to V5 data (for migration/parity)
    subscribeToData('data/printers', (data) => {
      if (data) set({ printers: Object.values(data) });
    });
    
    subscribeToData('data/revenueHistory', (data) => {
      if (data) set({ revenue: data });
    });
    
    subscribeToData('data/priorities', (data) => {
      if (data) set({ priorities: Object.values(data) });
    });
    
    subscribeToData('data/projects', (data) => {
      if (data) set({ projects: Object.values(data) });
    });
  }
}));
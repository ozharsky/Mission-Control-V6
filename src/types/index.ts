// Shared types for Mission Control V6
// These match the Firebase database structure

export * from './jobs';
export * from './inventory';
export * from './reports';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high';
  status: 'pending' | 'in-progress' | 'completed';
  createdBy: 'user' | 'agent';
  createdAt: string;
  dueDate?: string;
  projectId?: string;
  assignee?: 'Oleg' | 'KimiClaw';
  tags?: string[];
}

export interface ProjectTask {
  id: string;
  title: string;
  completed: boolean;
  priority: 'low' | 'medium' | 'high';
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'backlog' | 'todo' | 'inprogress' | 'done';
  progress: number;
  tasksCompleted: number;
  tasksTotal: number;
  dueDate?: string;
  tags: string[];
  tasks: ProjectTask[];
  priority?: 'low' | 'medium' | 'high';
  board?: 'etsy' | 'photography' | 'wholesale' | 'general';
  assignee?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

export interface Printer {
  id: string;
  name: string;
  status: 'operational' | 'printing' | 'idle' | 'error' | 'offline';
  temp: number;
  targetTemp: number;
  bedTemp: number;
  targetBedTemp: number;
  job?: {
    name: string;
    progress: number;
    timeLeft?: number;
    layer?: string;
  };
  error?: string;
  lastSeen?: string;
}

// Helper to clean undefined values before Firebase save
export function cleanForFirebase<T extends Record<string, any>>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([_, v]) => v !== undefined && v !== null)
  ) as Partial<T>;
}
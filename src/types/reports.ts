// Report types for Mission Control V6

export type ReportType = 'weekly' | 'monthly' | 'quarterly' | 'custom';
export type ReportStatus = 'pending' | 'generating' | 'completed' | 'error';

export interface Report {
  id: string;
  title: string;
  type: ReportType;
  status: ReportStatus;
  dateRange: {
    start: string;
    end: string;
  };
  createdAt: string;
  completedAt?: string;
  summary: ReportSummary;
  sections: ReportSection[];
  sentTo?: string[];
}

export interface ReportSummary {
  revenue: {
    total: number;
    previousPeriod: number;
    change: number;
    orders: number;
  };
  tasks: {
    completed: number;
    created: number;
    pending: number;
  };
  projects: {
    completed: number;
    active: number;
    new: number;
  };
  inventory: {
    lowStock: number;
    totalValue: number;
  };
}

export interface ReportSection {
  id: string;
  title: string;
  type: 'revenue' | 'tasks' | 'projects' | 'inventory' | 'jobs' | 'text';
  data: unknown;
  insights: string[];
}

export interface ReportSchedule {
  id: string;
  name: string;
  type: ReportType;
  enabled: boolean;
  dayOfWeek?: number; // 0-6 for weekly
  dayOfMonth?: number; // 1-31 for monthly
  recipients: string[];
  sections: string[]; // Which sections to include
}

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  weekly: 'Weekly Report',
  monthly: 'Monthly Report',
  quarterly: 'Quarterly Report',
  custom: 'Custom Report',
};

export const WEEKDAYS = [
  'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'
];export interface ReportConfig { type: ReportType; dateRange: { start: string; end: string; }; sections?: string[]; }

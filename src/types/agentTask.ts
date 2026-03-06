/**
 * Agent Task System Types
 * Mission Control V6
 */

export type AgentTaskType = 
  | 'research' 
  | 'ideation' 
  | 'analysis' 
  | 'writing' 
  | 'coding' 
  | 'review' 
  | 'planning' 
  | 'custom';

export type AgentId = 
  | 'planner'      // Strategist
  | 'ideator'      // Inventor
  | 'critic'       // Analyst
  | 'scout'        // Scout
  | 'coder'        // Architect
  | 'writer'       // Wordsmith
  | 'reviewer'     // Editor
  | 'surveyor'     // Researcher
  | 'kimiclaw';    // KimiClaw

export type TaskStatus = 
  | 'pending' 
  | 'active' 
  | 'paused' 
  | 'review' 
  | 'complete' 
  | 'cancelled';

export type Priority = 'low' | 'medium' | 'high' | 'urgent';

export interface ActivityEntry {
  timestamp: number;
  agent: string;
  action: 'created' | 'started' | 'updated' | 'handoff' | 'completed' | 'error' | 'state_change';
  message: string;
  data?: any;
}

export interface WorkflowState {
  current: string;
  history: StateTransition[];
}

export interface StateTransition {
  from: string;
  to: string;
  timestamp: number;
  triggeredBy: string;
}

export interface AgentTask {
  id: string;
  type: AgentTaskType;
  assignee: AgentId;
  requestedBy: string;
  status: TaskStatus;
  state: WorkflowState;
  title: string;
  description: string;
  input: any;
  output: any;
  parentTaskId?: string;
  workflowId?: string;
  previousAgentTaskId?: string;
  nextAgentTaskId?: string;
  discordThreadId?: string;
  discordChannelId?: string;
  discordMessageIds: string[];
  createdAt: number;
  startedAt?: number;
  completedAt?: number;
  estimatedDuration?: number;
  activityLog: ActivityEntry[];
  tags: string[];
  priority: Priority;
  projectId?: string;
}

export interface AgentWorkflow {
  id: string;
  name: string;
  template: string;
  status: 'active' | 'complete' | 'cancelled';
  tasks: string[];
  currentTaskId: string | null;
  createdAt: number;
  createdBy: string;
  discordThreadId?: string;
  input: any;
  output: any;
}

export interface WorkflowStep {
  agent: AgentId;
  type: AgentTaskType;
  label: string;
}

export interface WorkflowTemplate {
  name: string;
  steps: WorkflowStep[];
}

export interface AgentStats {
  agent: AgentId;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  activeTasks: number;
  averageDuration: number;
  lastActive: number | null;
}

export interface DashboardStats {
  totalTasks: number;
  activeTasks: number;
  pendingTasks: number;
  completedToday: number;
  byAgent: Record<AgentId, number>;
  byType: Record<AgentTaskType, number>;
}

export interface TaskFilters {
  status?: TaskStatus;
  assignee?: AgentId;
  workflowId?: string;
  tags?: string[];
  priority?: Priority;
  projectId?: string;
}

// Document compilation types (moved from workflowCompletionService to avoid circular deps)
export interface CompiledDocument {
  id: string;
  workflowId: string;
  name: string;
  type: string;
  content: string;
  sections: DocumentSection[];
  createdAt: number;
  updatedAt: number;
  tags: string[];
}

export interface DocumentSection {
  agent: string;
  agentName: string;
  step: string;
  content: string;
  timestamp: number;
}

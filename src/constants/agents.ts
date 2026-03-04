/**
 * Agent Task Constants
 * Mission Control V6
 */

import { AgentId, AgentTaskType, WorkflowTemplate } from '../types/agentTask';

export const AGENTS: Record<string, AgentId> = {
  PLANNER: 'planner',
  IDEATOR: 'ideator',
  CRITIC: 'critic',
  SCOUT: 'scout',
  CODER: 'coder',
  WRITER: 'writer',
  REVIEWER: 'reviewer',
  SURVEYOR: 'surveyor'
};

export const AGENT_EMOJIS: Record<AgentId, string> = {
  planner: '🎯',
  ideator: '💡',
  critic: '🔬',
  scout: '📡',
  coder: '💻',
  writer: '✍️',
  reviewer: '🔍',
  surveyor: '📚'
};

export const AGENT_NAMES: Record<AgentId, string> = {
  planner: 'Strategist',
  ideator: 'Inventor',
  critic: 'Analyst',
  scout: 'Scout',
  coder: 'Architect',
  writer: 'Wordsmith',
  reviewer: 'Editor',
  surveyor: 'Researcher'
};

export const AGENT_TASK_TYPES: Record<string, AgentTaskType> = {
  RESEARCH: 'research',
  IDEATION: 'ideation',
  ANALYSIS: 'analysis',
  WRITING: 'writing',
  CODING: 'coding',
  REVIEW: 'review',
  PLANNING: 'planning',
  CUSTOM: 'custom'
};

export const TASK_STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  PAUSED: 'paused',
  REVIEW: 'review',
  COMPLETE: 'complete',
  CANCELLED: 'cancelled'
} as const;

export const PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent'
} as const;

export const WORKFLOW_TEMPLATES: Record<string, WorkflowTemplate> = {
  'product-research': {
    name: 'Product Research Pipeline',
    steps: [
      { agent: 'surveyor', type: 'research', label: 'Market Research' },
      { agent: 'ideator', type: 'ideation', label: 'Generate Ideas' },
      { agent: 'critic', type: 'analysis', label: 'Feasibility Check' },
      { agent: 'planner', type: 'planning', label: 'Create Strategy' },
      { agent: 'architect', type: 'compilation', label: 'Compile & Save Report' }
    ]
  },

  'create-listing': {
    name: 'Etsy Listing Creation',
    steps: [
      { agent: 'ideator', type: 'ideation', label: 'Product Concept' },
      { agent: 'writer', type: 'writing', label: 'Write Description' },
      { agent: 'reviewer', type: 'review', label: 'Edit & Polish' },
      { agent: 'planner', type: 'planning', label: 'Final Approval' },
      { agent: 'architect', type: 'compilation', label: 'Save to Files' }
    ]
  },

  'market-analysis': {
    name: 'Competitor Analysis',
    steps: [
      { agent: 'scout', type: 'research', label: 'Find Competitors' },
      { agent: 'surveyor', type: 'research', label: 'Deep Research' },
      { agent: 'critic', type: 'analysis', label: 'SWOT Analysis' }
    ]
  },

  'content-creation': {
    name: 'Content Creation',
    steps: [
      { agent: 'ideator', type: 'ideation', label: 'Topic Ideas' },
      { agent: 'surveyor', type: 'research', label: 'Research' },
      { agent: 'writer', type: 'writing', label: 'Draft Content' },
      { agent: 'reviewer', type: 'review', label: 'Review' }
    ]
  },

  'technical-implementation': {
    name: 'Technical Implementation',
    steps: [
      { agent: 'planner', type: 'planning', label: 'Technical Design' },
      { agent: 'coder', type: 'coding', label: 'Implementation' },
      { agent: 'critic', type: 'review', label: 'Code Review' },
      { agent: 'coder', type: 'coding', label: 'Fix & Deploy' }
    ]
  }
};

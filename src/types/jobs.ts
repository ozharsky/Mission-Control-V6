// Job types and interfaces for Mission Control V6

export interface Job {
  id: string;
  title: string;
  company: string;
  location: string;
  type: 'full-time' | 'part-time' | 'contract' | 'freelance' | 'gig';
  status: 'new' | 'applied' | 'interview' | 'offer' | 'rejected' | 'archived';
  source: string;
  url?: string;
  description: string;
  requirements: string[];
  salary?: string;
  datePosted: string;
  dateApplied?: string;
  notes: string;
  priority: 'low' | 'medium' | 'high';
  tags: string[];
  contactName?: string;
  contactEmail?: string;
  addedBy: 'user' | 'agent';
  addedAt: string;
  bookmarked?: boolean;
}

export interface JobFilters {
  status?: Job['status'] | 'all';
  type?: Job['type'] | 'all';
  priority?: Job['priority'] | 'all';
  source?: string | 'all';
  search?: string;
}

export const JOB_TYPE_LABELS: Record<Job['type'], string> = {
  'full-time': 'Full Time',
  'part-time': 'Part Time',
  'contract': 'Contract',
  'freelance': 'Freelance',
  'gig': 'Gig',
};

export const JOB_STATUS_LABELS: Record<Job['status'], string> = {
  'new': 'New',
  'applied': 'Applied',
  'interview': 'Interview',
  'offer': 'Offer',
  'rejected': 'Rejected',
  'archived': 'Archived',
};

export const JOB_STATUS_COLORS: Record<Job['status'], string> = {
  'new': 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  'applied': 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  'interview': 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  'offer': 'bg-green-500/20 text-green-400 border-green-500/30',
  'rejected': 'bg-red-500/20 text-red-400 border-red-500/30',
  'archived': 'bg-gray-700 text-gray-400 border-gray-600',
};

export const JOB_TYPE_COLORS: Record<Job['type'], string> = {
  'full-time': 'bg-indigo-500/20 text-indigo-400',
  'part-time': 'bg-cyan-500/20 text-cyan-400',
  'contract': 'bg-orange-500/20 text-orange-400',
  'freelance': 'bg-pink-500/20 text-pink-400',
  'gig': 'bg-teal-500/20 text-teal-400',
};
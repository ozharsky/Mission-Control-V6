import { useState, useMemo } from 'react';
import { 
  Briefcase, Plus, Search, Filter, ExternalLink, Calendar, 
  MapPin, DollarSign, Clock, Tag, MoreHorizontal, Edit2, 
  Trash2, Archive, CheckCircle, X, ChevronDown, ChevronUp,
  User, Bot, Mail, Building2
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { LoadingButton } from '../components/Loading';
import type { Job } from '../types/jobs';
import { 
  JOB_TYPE_LABELS, 
  JOB_STATUS_LABELS, 
  JOB_STATUS_COLORS, 
  JOB_TYPE_COLORS 
} from '../types/jobs';

// Pre-loaded jobs found by agent
const FOUND_JOBS: Omit<Job, 'id' | 'addedAt'>[] = [
  {
    title: 'Event Photographer - Freelance',
    company: 'Shootday',
    location: 'Seattle, WA',
    type: 'freelance',
    status: 'new',
    source: 'theCreativeloft.com',
    url: 'https://photography.thecreativeloft.com/photography/jobs/seattle-event-photograph',
    description: 'Looking for freelance photographers to work on a variety of events including corporate functions, product launches, and social gatherings. Must have excellent knowledge of equipment and ability to capture high-quality photos of participants during events.',
    requirements: ['Own photography equipment', 'Event photography experience', 'Professional portfolio', 'Reliable transportation'],
    salary: '$17-42/hr',
    datePosted: '2025-01-09',
    priority: 'high',
    tags: ['event', 'freelance', 'corporate', 'seattle'],
    notes: 'Found by KimiClaw - Good fit for Oleg, matches event photography experience. Flexible freelance work.',
    contactName: '',
    contactEmail: '',
    addedBy: 'agent',
  },
  {
    title: 'Part-Time Event Photographer',
    company: 'Local Events Company',
    location: 'Seattle-Tacoma, WA',
    type: 'part-time',
    status: 'new',
    source: 'theCreativeloft.com',
    url: 'https://photography.thecreativeloft.com/photography/Photographer/jobs/in/seattle-tacoma/',
    description: 'Seeking part-time photographers to work events in the Seattle-Tacoma area. Looking for talented photographers passionate about their work, eager to hone their skills and embrace creative expression.',
    requirements: ['Photography portfolio', 'Weekend availability', 'Professional demeanor', 'Quick photo editing'],
    salary: '$25-35/hr',
    datePosted: '2025-02-15',
    priority: 'medium',
    tags: ['event', 'part-time', 'seattle', 'tacoma'],
    notes: 'Found by KimiClaw - Part-time opportunity with local events company. Good for building portfolio.',
    contactName: '',
    contactEmail: '',
    addedBy: 'agent',
  },
  {
    title: 'Event Photographer',
    company: 'Twine / Shootday',
    location: 'Seattle, Washington',
    type: 'freelance',
    status: 'new',
    source: 'Twine.net',
    url: 'https://www.twine.net/projects/b8s910-shootday-event-photographer-in-seattle-washington-photographer-in-seattle-united-states-job',
    description: 'Twine Jobs is looking for an Event Photographer in Seattle. Work on various events and build your portfolio with professional clients.',
    requirements: ['Event photography experience', 'Professional camera gear', 'Editing software', 'Reliable transportation'],
    salary: '$200-500 per event',
    datePosted: '2025-02-20',
    priority: 'high',
    tags: ['event', 'freelance', 'twine', 'seattle'],
    notes: 'Found by KimiClaw - Direct client through Twine. Good per-event pay rate.',
    contactName: '',
    contactEmail: '',
    addedBy: 'agent',
  },
];

interface JobsViewProps {
  jobs: Job[];
}

type SortField = 'datePosted' | 'dateApplied' | 'priority' | 'company';
type SortDirection = 'asc' | 'desc';

export function JobsView({ jobs }: JobsViewProps) {
  const { addJob, updateJob, deleteJob } = useAppStore();
  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<Job['status'] | 'all'>('all');
  const [filterType, setFilterType] = useState<Job['type'] | 'all'>('all');
  const [filterPriority, setFilterPriority] = useState<Job['priority'] | 'all'>('all');
  const [sortField, setSortField] = useState<SortField>('datePosted');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<Partial<Job>>({
    title: '',
    company: '',
    location: '',
    type: 'freelance',
    status: 'new',
    source: '',
    url: '',
    description: '',
    requirements: [],
    salary: '',
    priority: 'medium',
    tags: [],
    notes: '',
    contactName: '',
    contactEmail: '',
  });

  // Filter and sort jobs
  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(job => 
        job.title?.toLowerCase().includes(query) ||
        job.company?.toLowerCase().includes(query) ||
        job.description?.toLowerCase().includes(query) ||
        (job.tags || []).some(tag => tag?.toLowerCase().includes(query))
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      result = result.filter(job => job.status === filterStatus);
    }

    // Type filter
    if (filterType !== 'all') {
      result = result.filter(job => job.type === filterType);
    }

    // Priority filter
    if (filterPriority !== 'all') {
      result = result.filter(job => job.priority === filterPriority);
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'datePosted':
          comparison = new Date(a.datePosted).getTime() - new Date(b.datePosted).getTime();
          break;
        case 'dateApplied':
          const aDate = a.dateApplied ? new Date(a.dateApplied).getTime() : 0;
          const bDate = b.dateApplied ? new Date(b.dateApplied).getTime() : 0;
          comparison = aDate - bDate;
          break;
        case 'priority':
          const priorityOrder = { high: 3, medium: 2, low: 1 };
          comparison = priorityOrder[a.priority] - priorityOrder[b.priority];
          break;
        case 'company':
          comparison = a.company.localeCompare(b.company);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [jobs, searchQuery, filterStatus, filterType, filterPriority, sortField, sortDirection]);

  // Stats
  const stats = useMemo(() => {
    return {
      total: jobs.length,
      new: jobs.filter(j => j.status === 'new').length,
      applied: jobs.filter(j => j.status === 'applied').length,
      interview: jobs.filter(j => j.status === 'interview').length,
      offer: jobs.filter(j => j.status === 'offer').length,
    };
  }, [jobs]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.company) return;

    const jobData: Omit<Job, 'id' | 'addedAt'> = {
      title: formData.title,
      company: formData.company,
      location: formData.location || 'Remote',
      type: formData.type || 'freelance',
      status: formData.status || 'new',
      source: formData.source || '',
      url: formData.url,
      description: formData.description || '',
      requirements: formData.requirements || [],
      salary: formData.salary,
      datePosted: formData.datePosted || new Date().toISOString().split('T')[0],
      notes: formData.notes || '',
      priority: formData.priority || 'medium',
      tags: formData.tags || [],
      contactName: formData.contactName,
      contactEmail: formData.contactEmail,
      addedBy: 'user',
    };

    setIsSubmitting(true);
    try {
      const jobData: Omit<Job, 'id' | 'addedAt'> = {
        title: formData.title,
        company: formData.company,
        location: formData.location || 'Remote',
        type: formData.type || 'freelance',
        status: formData.status || 'new',
        source: formData.source || '',
        url: formData.url,
        description: formData.description || '',
        requirements: formData.requirements || [],
        salary: formData.salary,
        datePosted: formData.datePosted || new Date().toISOString().split('T')[0],
        notes: formData.notes || '',
        priority: formData.priority || 'medium',
        tags: formData.tags || [],
        contactName: formData.contactName,
        contactEmail: formData.contactEmail,
        addedBy: 'user',
      };

      if (editingJob) {
        await updateJob(editingJob.id, jobData);
      } else {
        await addJob(jobData);
      }

      resetForm();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleImportFoundJobs = async () => {
    if (!confirm('Import 3 photography jobs found by KimiClaw?')) return;
    
    for (const job of FOUND_JOBS) {
      await addJob(job);
    }
    alert('Jobs imported! They should appear in your list.');
  };

  const resetForm = () => {
    setFormData({
      title: '',
      company: '',
      location: '',
      type: 'freelance',
      status: 'new',
      source: '',
      url: '',
      description: '',
      requirements: [],
      salary: '',
      priority: 'medium',
      tags: [],
      notes: '',
      contactName: '',
      contactEmail: '',
    });
    setEditingJob(null);
    setShowForm(false);
  };

  const openEdit = (job: Job) => {
    setEditingJob(job);
    setFormData(job);
    setShowForm(true);
  };

  const handleStatusChange = async (job: Job, newStatus: Job['status']) => {
    await updateJob(job.id, {
      ...job,
      status: newStatus,
      dateApplied: newStatus === 'applied' && !job.dateApplied 
        ? new Date().toISOString().split('T')[0] 
        : job.dateApplied,
    });
  };

  const getPriorityColor = (priority: Job['priority']) => {
    switch (priority) {
      case 'high': return 'bg-danger/20 text-danger border-danger/30';
      case 'medium': return 'bg-warning/20 text-warning border-warning/30';
      case 'low': return 'bg-gray-700 text-gray-400 border-gray-600';
    }
  };

  return (
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* Header Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {[
          { label: 'Total', value: stats.total, color: 'bg-primary/10 text-primary' },
          { label: 'New', value: stats.new, color: 'bg-blue-500/10 text-blue-400' },
          { label: 'Applied', value: stats.applied, color: 'bg-yellow-500/10 text-yellow-400' },
          { label: 'Interview', value: stats.interview, color: 'bg-purple-500/10 text-purple-400' },
          { label: 'Offers', value: stats.offer, color: 'bg-green-500/10 text-green-400' },
        ].map(stat => (
          <div key={stat.label} className={`rounded-xl border border-surface-hover p-4 ${stat.color}`}>
            <div className="text-2xl font-bold">{stat.value}</div>
            <div className="text-sm opacity-80">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Search and Filters */}
      <div className="rounded-xl border border-surface-hover bg-surface p-4">
        <div className="flex flex-col sm:flex-row flex-wrap items-stretch sm:items-center gap-3">
          <div className="flex-1 min-w-0 w-full min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search jobs..."
                className="w-full rounded-lg border border-surface-hover bg-background pl-10 pr-4 py-2 text-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex min-h-[44px] items-center gap-2 rounded-lg px-4 py-2 shrink-0 ${showFilters ? 'bg-primary text-white' : 'border border-surface-hover text-gray-400'}`}
            >
              <Filter className="h-4 w-4" />
              Filters
            </button>

            <button
              onClick={() => setShowForm(true)}
              className="flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white shrink-0"
            >
              <Plus className="h-4 w-4" />
              Add Job
            </button>

            {jobs.length === 0 && (
              <button
                onClick={handleImportFoundJobs}
                className="flex min-h-[44px] items-center gap-2 rounded-lg border border-primary px-4 py-2 text-primary hover:bg-primary hover:text-white shrink-0"
              >
                <Bot className="h-4 w-4" />
                Import Found Jobs
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-surface-hover pt-4">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as Job['status'] | 'all')}
              className="rounded-lg border border-surface-hover bg-background px-3 py-2 text-white"
            >
              <option value="all">All Status</option>
              {Object.entries(JOB_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as Job['type'] | 'all')}
              className="rounded-lg border border-surface-hover bg-background px-3 py-2 text-white"
            >
              <option value="all">All Types</option>
              {Object.entries(JOB_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value as Job['priority'] | 'all')}
              className="rounded-lg border border-surface-hover bg-background px-3 py-2 text-white"
            >
              <option value="all">All Priorities</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>

            <select
              value={`${sortField}-${sortDirection}`}
              onChange={(e) => {
                const [field, dir] = e.target.value.split('-');
                setSortField(field as SortField);
                setSortDirection(dir as SortDirection);
              }}
              className="rounded-lg border border-surface-hover bg-background px-3 py-2 text-white"
            >
              <option value="datePosted-desc">Newest First</option>
              <option value="datePosted-asc">Oldest First</option>
              <option value="priority-desc">Highest Priority</option>
              <option value="company-asc">Company A-Z</option>
            </select>

            {(filterStatus !== 'all' || filterType !== 'all' || filterPriority !== 'all' || searchQuery) && (
              <button
                onClick={() => {
                  setFilterStatus('all');
                  setFilterType('all');
                  setFilterPriority('all');
                  setSearchQuery('');
                }}
                className="text-sm text-gray-400 hover:text-white"
              >
                Clear all
              </button>
            )}
          </div>
        )}
      </div>

      {/* Jobs List */}
      <div className="space-y-4 max-w-full overflow-x-hidden">
        {filteredJobs.length === 0 ? (
          <div className="rounded-xl border border-surface-hover bg-surface p-12 text-center">
            <Briefcase className="mx-auto mb-4 h-12 w-12 text-gray-500" />
            <p className="text-gray-400">No jobs found</p>
            <p className="text-sm text-gray-500">Add a job or adjust your filters</p>
          </div>
        ) : (
          filteredJobs.map(job => {
            const isExpanded = expandedJob === job.id;
            return (
              <div
                key={job.id}
                className="rounded-xl border border-surface-hover bg-surface overflow-hidden"
              >
                {/* Job Header */}
                <div
                  onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                  className="cursor-pointer p-4 hover:bg-surface-hover/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold">{job.title}</h3>
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${JOB_STATUS_COLORS[job.status]}`}>
                          {JOB_STATUS_LABELS[job.status]}
                        </span>
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${getPriorityColor(job.priority)}`}>
                          {job.priority}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-400">
                        <span className="flex items-center gap-1">
                          <Building2 className="h-4 w-4" />
                          {job.company}
                        </span>
                        <span className="flex items-center gap-1">
                          <MapPin className="h-4 w-4" />
                          {job.location}
                        </span>
                        <span className={`rounded px-2 py-0.5 text-xs ${JOB_TYPE_COLORS[job.type]}`}>
                          {JOB_TYPE_LABELS[job.type]}
                        </span>
                        {job.salary && (
                          <span className="flex items-center gap-1">
                            <DollarSign className="h-4 w-4" />
                            {job.salary}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {job.url && (
                        <a
                          href={job.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="rounded-lg p-2 text-gray-400 hover:bg-surface-hover hover:text-white"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); openEdit(job); }}
                        className="rounded-lg p-2 text-gray-400 hover:bg-surface-hover hover:text-white"
                      >
                        <Edit2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteJob(job.id); }}
                        className="rounded-lg p-2 text-gray-400 hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="border-t border-surface-hover p-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4 max-w-full overflow-x-hidden">
                        <div>
                          <h4 className="text-sm font-medium text-gray-400 mb-2">Description</h4>
                          <p className="text-sm truncate min-w-0">{job.description || 'No description'}</p>
                        </div>

                        {(job.requirements || []).length > 0 && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-400 mb-2">Requirements</h4>
                            <ul className="list-disc list-inside text-sm space-y-1">
                              {job.requirements.map((req, i) => (
                                <li key={i}>{req}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {job.notes && (
                          <div>
                            <h4 className="text-sm font-medium text-gray-400 mb-2">Notes</h4>
                            <p className="text-sm truncate min-w-0">{job.notes}</p>
                          </div>
                        )}
                      </div>

                      <div className="space-y-4 max-w-full overflow-x-hidden">
                        <div className="flex items-center gap-2 text-sm">
                          <Calendar className="h-4 w-4 text-gray-400" />
                          <span>Posted: {new Date(job.datePosted).toLocaleDateString()}</span>
                        </div>

                        {job.dateApplied && (
                          <div className="flex items-center gap-2 text-sm">
                            <CheckCircle className="h-4 w-4 text-success" />
                            <span>Applied: {new Date(job.dateApplied).toLocaleDateString()}</span>
                          </div>
                        )}

                        {job.contactName && (
                          <div className="flex items-center gap-2 text-sm">
                            <User className="h-4 w-4 text-gray-400" />
                            <span>Contact: {job.contactName}</span>
                          </div>
                        )}

                        {job.contactEmail && (
                          <div className="flex items-center gap-2 text-sm">
                            <Mail className="h-4 w-4 text-gray-400" />
                            <a href={`mailto:${job.contactEmail}`} className="text-primary hover:underline">{job.contactEmail}</a>
                          </div>
                        )}

                        {job.source && (
                          <div className="flex items-center gap-2 text-sm">
                            <Tag className="h-4 w-4 text-gray-400" />
                            <span>Source: {job.source}</span>
                          </div>
                        )}

                        {(job.tags || []).length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {job.tags.map(tag => (
                              <span key={tag} className="rounded-full bg-surface-hover px-2 py-1 text-xs text-gray-400">
                                #{tag}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          {job.addedBy === 'agent' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                          <span>Added by {job.addedBy} on {new Date(job.addedAt).toLocaleDateString()}</span>
                        </div>

                        {/* Status Actions */}
                        <div className="pt-4 border-t border-surface-hover">
                          <h4 className="text-sm font-medium text-gray-400 mb-2">Update Status</h4>
                          <div className="flex flex-wrap gap-2">
                            {(['new', 'applied', 'interview', 'offer', 'rejected', 'archived'] as const).map(status => (
                              <button
                                key={status}
                                onClick={() => handleStatusChange(job, status)}
                                className={`rounded-lg px-3 py-1.5 text-sm ${
                                  job.status === status
                                    ? JOB_STATUS_COLORS[status]
                                    : 'border border-surface-hover text-gray-400 hover:bg-surface-hover'
                                }`}
                              >
                                {JOB_STATUS_LABELS[status]}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add/Edit Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-surface-hover bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">{editingJob ? 'Edit Job' : 'Add Job'}</h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm text-gray-400">Job Title *</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">Company *</label>
                  <input
                    type="text"
                    value={formData.company}
                    onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                    required
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">Location</label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    placeholder="Remote, City, etc."
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">Type</label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as Job['type'] })}
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                  >
                    {Object.entries(JOB_TYPE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as Job['status'] })}
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                  >
                    {Object.entries(JOB_STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">Priority</label>
                  <select
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: e.target.value as Job['priority'] })}
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">Salary/Rate</label>
                  <input
                    type="text"
                    value={formData.salary}
                    onChange={(e) => setFormData({ ...formData, salary: e.target.value })}
                    placeholder="$50k-$70k or $50/hr"
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm text-gray-400">Date Posted</label>
                  <input
                    type="date"
                    value={formData.datePosted}
                    onChange={(e) => setFormData({ ...formData, datePosted: e.target.value })}
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm text-gray-400">Job URL</label>
                  <input
                    type="url"
                    value={formData.url}
                    onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm text-gray-400">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={3}
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="mb-1 block text-sm text-gray-400">Notes</label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Your thoughts, follow-up actions, etc."
                    rows={2}
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={resetForm}
                  className="flex-1 min-w-0 rounded-lg border border-surface-hover py-2 text-gray-400 hover:bg-surface-hover"
                >
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  isLoading={isSubmitting}
                  loadingText={editingJob ? 'Saving...' : 'Adding...'}
                  className="flex-1 min-w-0 rounded-lg bg-primary py-2 font-medium text-white disabled:opacity-50"
                >
                  {editingJob ? 'Save Changes' : 'Add Job'}
                </LoadingButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
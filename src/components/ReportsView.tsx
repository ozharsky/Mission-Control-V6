import { useState, useMemo } from 'react';
import { 
  FileText, Plus, Calendar, TrendingUp, CheckCircle, 
  Package, DollarSign, Briefcase, Clock, Download, 
  Mail, Settings, ChevronRight, BarChart3, PieChart,
  X, RefreshCw, Send, Trash2, Edit2
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import type { Report, ReportSchedule, ReportType } from '../types/reports';
import { REPORT_TYPE_LABELS, WEEKDAYS } from '../types/reports';

interface ReportsViewProps {
  reports: Report[];
}

export function ReportsView({ reports }: ReportsViewProps) {
  const { generateReport, deleteReport, addReportSchedule, updateReportSchedule, deleteReportSchedule, reportSchedules } = useAppStore();
  const [activeTab, setActiveTab] = useState<'reports' | 'schedules' | 'generate'>('reports');
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  // Generate form state
  const [generateForm, setGenerateForm] = useState({
    title: '',
    type: 'weekly' as ReportType,
    startDate: '',
    endDate: '',
    sections: ['revenue', 'tasks', 'projects', 'inventory'],
  });

  // Schedule form state
  const [scheduleForm, setScheduleForm] = useState<Partial<ReportSchedule>>({
    name: '',
    type: 'weekly',
    enabled: true,
    dayOfWeek: 1, // Monday
    dayOfMonth: 1,
    recipients: [],
    sections: ['revenue', 'tasks', 'projects', 'inventory'],
  });

  const [newRecipient, setNewRecipient] = useState('');

  // Use reportSchedules from store
  const schedules = reportSchedules || [];

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    await generateReport({
      title: generateForm.title || `${REPORT_TYPE_LABELS[generateForm.type]} - ${new Date().toLocaleDateString()}`,
      type: generateForm.type,
      dateRange: {
        start: generateForm.startDate,
        end: generateForm.endDate,
      },
      sections: generateForm.sections,
    });
    setShowGenerateModal(false);
    setActiveTab('reports');
  };

  const handleCreateSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduleForm.name) return;
    
    await addReportSchedule({
      name: scheduleForm.name,
      type: scheduleForm.type as ReportType,
      enabled: scheduleForm.enabled ?? true,
      dayOfWeek: scheduleForm.dayOfWeek,
      dayOfMonth: scheduleForm.dayOfMonth,
      recipients: scheduleForm.recipients || [],
      sections: scheduleForm.sections || [],
    });
    setShowScheduleModal(false);
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

  const formatDate = (dateStr: string) => 
    new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">Reports</h2>
              <p className="text-sm text-gray-400">{reports.length} generated • {schedules.length} scheduled</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setActiveTab('reports')}
              className={`min-h-[44px] rounded-lg px-4 py-2 ${activeTab === 'reports' ? 'bg-primary text-white' : 'border border-surface-hover text-gray-400'}`}
            >
              Reports
            </button>
            <button
              onClick={() => setActiveTab('schedules')}
              className={`min-h-[44px] rounded-lg px-4 py-2 ${activeTab === 'schedules' ? 'bg-primary text-white' : 'border border-surface-hover text-gray-400'}`}
            >
              Schedules
            </button>
            <button
              onClick={() => setShowGenerateModal(true)}
              className="flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white"
            >
              <Plus className="h-4 w-4" />
              Generate
            </button>
          </div>
        </div>
      </div>

      {/* Reports List */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          {reports.length === 0 ? (
            <div className="rounded-xl border border-surface-hover bg-surface p-12 text-center">
              <FileText className="mx-auto mb-4 h-12 w-12 text-gray-500" />
              <p className="text-gray-400">No reports yet</p>
              <p className="text-sm text-gray-500">Generate your first report to see insights</p>
              <button
                onClick={() => setShowGenerateModal(true)}
                className="mt-4 rounded-lg bg-primary px-4 py-2 text-white"
              >
                Generate Report
              </button>
            </div>
          ) : (
            reports.map(report => (
              <div
                key={report.id}
                onClick={() => setSelectedReport(report)}
                className="cursor-pointer rounded-xl border border-surface-hover bg-surface p-4 transition-all hover:border-primary"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">{report.title}</h3>
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                        {REPORT_TYPE_LABELS[report.type]}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400">
                      {formatDate(report.dateRange.start)} - {formatDate(report.dateRange.end)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => { e.stopPropagation(); }}
                      className="flex h-11 w-11 items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-surface-hover"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteReport(report.id); }}
                      className="flex h-11 w-11 items-center justify-center rounded-lg p-2 text-gray-400 hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <ChevronRight className="h-5 w-5 text-gray-400" />
                  </div>
                </div>

                {/* Summary Stats */}
                {report.summary && (
                  <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
                    <div className="rounded-lg bg-surface-hover p-3">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <DollarSign className="h-3 w-3" /> Revenue
                      </div>
                      <div className="text-lg font-semibold">{formatCurrency(report.summary.revenue.total)}</div>
                    </div>
                    <div className="rounded-lg bg-surface-hover p-3">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <CheckCircle className="h-3 w-3" /> Tasks Done
                      </div>
                      <div className="text-lg font-semibold">{report.summary.tasks.completed}</div>
                    </div>
                    <div className="rounded-lg bg-surface-hover p-3">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Briefcase className="h-3 w-3" /> Projects
                      </div>
                      <div className="text-lg font-semibold">{report.summary.projects.completed}</div>
                    </div>
                    <div className="rounded-lg bg-surface-hover p-3">
                      <div className="flex items-center gap-1 text-xs text-gray-400">
                        <Package className="h-3 w-3" /> Low Stock
                      </div>
                      <div className="text-lg font-semibold">{report.summary.inventory.lowStock}</div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Schedules Tab */}
      {activeTab === 'schedules' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => setShowScheduleModal(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-white"
            >
              <Plus className="h-4 w-4" />
              Add Schedule
            </button>
          </div>

          {schedules.length === 0 ? (
            <div className="rounded-xl border border-surface-hover bg-surface p-12 text-center">
              <Clock className="mx-auto mb-4 h-12 w-12 text-gray-500" />
              <p className="text-gray-400">No scheduled reports</p>
              <p className="text-sm text-gray-500">Set up automatic report generation</p>
            </div>
          ) : (
            schedules.map(schedule => (
              <div key={schedule.id} className="rounded-xl border border-surface-hover bg-surface p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{schedule.name}</h3>
                    <p className="text-sm text-gray-400">
                      {REPORT_TYPE_LABELS[schedule.type]} • 
                      {schedule.type === 'weekly' ? WEEKDAYS[schedule.dayOfWeek || 0] 
                        : `Day ${schedule.dayOfMonth} of month`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-1 text-xs ${schedule.enabled ? 'bg-success/20 text-success' : 'bg-gray-700 text-gray-400'}`}>
                      {schedule.enabled ? 'Active' : 'Paused'}
                    </span>
                    <button className="rounded-lg p-2 text-gray-400 hover:bg-surface-hover">
                      <Edit2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Generate Modal */}
      {showGenerateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-surface-hover bg-surface p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold">Generate Report</h3>
              <button onClick={() => setShowGenerateModal(false)} className="text-gray-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm text-gray-400">Report Title</label>
                <input
                  type="text"
                  value={generateForm.title}
                  onChange={(e) => setGenerateForm({ ...generateForm, title: e.target.value })}
                  placeholder={`${REPORT_TYPE_LABELS[generateForm.type]} - ${new Date().toLocaleDateString()}`}
                  className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm text-gray-400">Report Type</label>
                <select
                  value={generateForm.type}
                  onChange={(e) => setGenerateForm({ ...generateForm, type: e.target.value as ReportType })}
                  className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                >
                  {Object.entries(REPORT_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm text-gray-400">Start Date</label>
                  <input
                    type="date"
                    value={generateForm.startDate}
                    onChange={(e) => setGenerateForm({ ...generateForm, startDate: e.target.value })}
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm text-gray-400">End Date</label>
                  <input
                    type="date"
                    value={generateForm.endDate}
                    onChange={(e) => setGenerateForm({ ...generateForm, endDate: e.target.value })}
                    className="w-full rounded-lg border border-surface-hover bg-background px-4 py-2 text-white"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm text-gray-400">Include Sections</label>
                <div className="flex flex-wrap gap-2">
                  {['revenue', 'tasks', 'projects', 'inventory', 'jobs'].map(section => (
                    <button
                      key={section}
                      type="button"
                      onClick={() => {
                        const sections = generateForm.sections.includes(section)
                          ? generateForm.sections.filter(s => s !== section)
                          : [...generateForm.sections, section];
                        setGenerateForm({ ...generateForm, sections });
                      }}
                      className={`rounded-lg px-3 py-2 text-sm capitalize ${
                        generateForm.sections.includes(section)
                          ? 'bg-primary text-white'
                          : 'border border-surface-hover text-gray-400'
                      }`}
                    >
                      {section}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowGenerateModal(false)}
                  className="flex-1 rounded-lg border border-surface-hover py-2 text-gray-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 rounded-lg bg-primary py-2 font-medium text-white"
                >
                  Generate Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Report Detail Modal */}
      {selectedReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-surface-hover bg-surface p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold">{selectedReport.title}</h3>
                <p className="text-sm text-gray-400">
                  {formatDate(selectedReport.dateRange?.start)} - {formatDate(selectedReport.dateRange?.end)}
                </p>
              </div>
              <button 
                onClick={() => setSelectedReport(null)}
                className="rounded-lg p-2 text-gray-400 hover:bg-surface-hover"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Summary */}
            {selectedReport.summary && (
              <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
                <div className="rounded-lg bg-surface-hover p-3">
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <DollarSign className="h-3 w-3" /> Revenue
                  </div>
                  <div className="text-lg font-semibold">{formatCurrency(selectedReport.summary.revenue?.total || 0)}</div>
                </div>
                <div className="rounded-lg bg-surface-hover p-3">
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <CheckCircle className="h-3 w-3" /> Tasks Done
                  </div>
                  <div className="text-lg font-semibold">{selectedReport.summary.tasks?.completed || 0}</div>
                </div>
                <div className="rounded-lg bg-surface-hover p-3">
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Briefcase className="h-3 w-3" /> Projects
                  </div>
                  <div className="text-lg font-semibold">{selectedReport.summary.projects?.completed || 0}</div>
                </div>
                <div className="rounded-lg bg-surface-hover p-3">
                  <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Package className="h-3 w-3" /> Low Stock
                  </div>
                  <div className="text-lg font-semibold">{selectedReport.summary.inventory?.lowStock || 0}</div>
                </div>
              </div>
            )}

            {/* Sections */}
            <div className="space-y-6">
              {selectedReport.sections?.map((section: any) => (
                <div key={section.id} className="rounded-xl border border-surface-hover bg-background p-4">
                  <h4 className="mb-3 font-semibold capitalize">{section.title}</h4>
                  
                  {/* Insights */}
                  {section.insights?.length > 0 && (
                    <div className="mb-4 space-y-1">
                      {section.insights.map((insight: string, idx: number) => (
                        <div key={idx} className="flex items-start gap-2 text-sm text-gray-400">
                          <div className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
                          {insight}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Section-specific data display */}
                  {section.type === 'revenue' && section.data?.monthlyData?.length > 0 && (
                    <div className="mt-4">
                      <div className="text-sm text-gray-500 mb-2">Monthly Revenue</div>
                      <div className="space-y-2">
                        {section.data.monthlyData.slice(-6).map((item: any) => (
                          <div key={item.month} className="flex items-center justify-between text-sm">
                            <span className="text-gray-400">{item.month}</span>
                            <span className="font-medium">${item.value?.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {section.type === 'tasks' && (
                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                      <div className="rounded-lg bg-surface-hover p-2">
                        <div className="text-lg font-semibold text-success">{section.data?.completed || 0}</div>
                        <div className="text-xs text-gray-500">Completed</div>
                      </div>
                      <div className="rounded-lg bg-surface-hover p-2">
                        <div className="text-lg font-semibold text-primary">{section.data?.inProgress || 0}</div>
                        <div className="text-xs text-gray-500">In Progress</div>
                      </div>
                      <div className="rounded-lg bg-surface-hover p-2">
                        <div className="text-lg font-semibold text-warning">{section.data?.pending || 0}</div>
                        <div className="text-xs text-gray-500">Pending</div>
                      </div>
                    </div>
                  )}

                  {section.type === 'inventory' && (
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-gray-400">Total Value</span>
                        <span className="font-medium">${section.data?.totalValue?.toLocaleString()}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-xs">
                        <div className="rounded bg-success/10 p-2 text-success">
                          {section.data?.inStock || 0} In Stock
                        </div>
                        <div className="rounded bg-warning/10 p-2 text-warning">
                          {section.data?.lowStock || 0} Low
                        </div>
                        <div className="rounded bg-danger/10 p-2 text-danger">
                          {section.data?.outOfStock || 0} Out
                        </div>
                      </div>
                    </div>
                  )}

                  {section.type === 'jobs' && (
                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-surface-hover p-2 text-center">
                        <div className="text-lg font-semibold">{section.data?.new || 0}</div>
                        <div className="text-xs text-gray-500">New Opportunities</div>
                      </div>
                      <div className="rounded-lg bg-surface-hover p-2 text-center">
                        <div className="text-lg font-semibold">{section.data?.applied || 0}</div>
                        <div className="text-xs text-gray-500">Applied</div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setSelectedReport(null)}
                className="flex-1 rounded-lg border border-surface-hover py-2 text-gray-400"
              >
                Close
              </button>
              <button
                onClick={() => {
                  // Export report as JSON
                  const dataStr = JSON.stringify(selectedReport, null, 2);
                  const blob = new Blob([dataStr], { type: 'application/json' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `report-${selectedReport.title?.replace(/\s+/g, '-').toLowerCase()}.json`;
                  a.click();
                }}
                className="flex-1 rounded-lg bg-primary py-2 font-medium text-white"
              >
                Export Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
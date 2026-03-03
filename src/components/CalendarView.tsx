import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Clock, Printer, Briefcase, AlertCircle, Filter, CheckCircle, Folder } from 'lucide-react';
import type { Project, Task } from '../types';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  type: 'print' | 'meeting' | 'deadline' | 'delivery' | 'maintenance' | 'project' | 'task';
  description?: string;
  projectId?: string;
  status?: string;
}

interface CalendarViewProps {
  events?: CalendarEvent[];
  projects?: Project[];
  tasks?: {
    pending: Task[];
    inProgress: Task[];
    completed: Task[];
  };
}

const EVENT_COLORS = {
  print: { bg: 'bg-blue-500', light: 'bg-blue-500/10', text: 'text-blue-400', icon: Printer },
  meeting: { bg: 'bg-purple-500', light: 'bg-purple-500/10', text: 'text-purple-400', icon: Briefcase },
  deadline: { bg: 'bg-red-500', light: 'bg-red-500/10', text: 'text-red-400', icon: AlertCircle },
  delivery: { bg: 'bg-green-500', light: 'bg-green-500/10', text: 'text-green-400', icon: Clock },
  maintenance: { bg: 'bg-orange-500', light: 'bg-orange-500/10', text: 'text-orange-400', icon: AlertCircle },
  project: { bg: 'bg-indigo-500', light: 'bg-indigo-500/10', text: 'text-indigo-400', icon: Folder },
  task: { bg: 'bg-cyan-500', light: 'bg-cyan-500/10', text: 'text-cyan-400', icon: CheckCircle },
};

export function CalendarView({ events = [], projects = [], tasks }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [filter, setFilter] = useState<string | 'all'>('all');

  // Generate events from projects and tasks
  const allEvents = useMemo(() => {
    const generatedEvents: CalendarEvent[] = [...events];

    // Add project due dates
    projects.forEach(project => {
      if (project.dueDate) {
        generatedEvents.push({
          id: `project-${project.id}`,
          title: project.name,
          date: project.dueDate,
          type: 'project',
          description: `Project due: ${project.description?.slice(0, 50)}...`,
          projectId: project.id,
          status: project.status,
        });
      }
    });

    // Add task due dates
    if (tasks) {
      const allTasks = [...tasks.pending, ...tasks.inProgress, ...tasks.completed];
      allTasks.forEach(task => {
        if (task.dueDate) {
          generatedEvents.push({
            id: `task-${task.id}`,
            title: task.title,
            date: task.dueDate,
            type: 'task',
            description: `Task due - Priority: ${task.priority}`,
            projectId: task.projectId,
            status: task.status,
          });
        }
      });
    }

    return generatedEvents;
  }, [events, projects, tasks]);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();
  const startingDay = firstDayOfMonth.getDay();

  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(year, month + direction, 1));
    setSelectedDate(null);
  };

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today);
  };

  const getEventsForDay = (day: number) => {
    const dateStr = new Date(year, month, day).toISOString().split('T')[0];
    let dayEvents = allEvents.filter(e => e.date.startsWith(dateStr));
    if (filter !== 'all') {
      dayEvents = dayEvents.filter(e => e.type === filter);
    }
    return dayEvents;
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && 
           today.getMonth() === month && 
           today.getFullYear() === year;
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return selectedDate.getDate() === day && 
           selectedDate.getMonth() === month && 
           selectedDate.getFullYear() === year;
  };

  const selectedDateEvents = selectedDate ? getEventsForDay(selectedDate.getDate()) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <CalendarIcon className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{monthName}</h2>
              <p className="text-sm text-gray-400">{allEvents.length} events this month</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => navigateMonth(-1)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-surface-hover hover:bg-surface-hover"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            
            <button
              onClick={goToToday}
              className="min-h-[44px] rounded-xl border border-surface-hover px-4 py-2 text-sm font-medium hover:bg-surface-hover"
            >
              Today
            </button>
            
            <button
              onClick={() => navigateMonth(1)}
              className="flex h-11 w-11 items-center justify-center rounded-xl border border-surface-hover hover:bg-surface-hover"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          
          <button
            onClick={() => setFilter('all')}
            className={`min-h-[44px] rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === 'all' ? 'bg-primary text-white' : 'bg-surface-hover text-gray-400 hover:text-white'
            }`}
          >
            All
          </button>
          
          {Object.entries(EVENT_COLORS).map(([type, colors]) => {
            const Icon = colors.icon;
            return (
              <button
                key={type}
                onClick={() => setFilter(type)}
                className={`flex min-h-[44px] items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
                  filter === type ? colors.light + ' ' + colors.text : 'bg-surface-hover text-gray-400 hover:text-white'
                }`}
              >
                <div className={`h-2 w-2 rounded-full ${colors.bg}`} />
                <span className="capitalize">{type}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Calendar Grid */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-surface-hover bg-surface p-6">
            {/* Day Headers */}
            <div className="mb-4 grid grid-cols-7 gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="p-2 text-center text-sm font-medium text-gray-400">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar Days */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: startingDay }).map((_, i) => (
                <div key={`empty-${i}`} className="min-h-[100px] p-1" />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayEvents = getEventsForDay(day);
                const hasEvents = dayEvents.length > 0;

                return (
                  <button
                    key={day}
                    onClick={() => setSelectedDate(new Date(year, month, day))}
                    className={`min-h-[100px] rounded-xl border p-2 text-left transition-all ${
                      isSelected(day)
                        ? 'border-primary bg-primary/10'
                        : isToday(day)
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-surface-hover bg-background hover:border-surface'
                    }`}
                  >
                    <div className={`mb-1 text-sm font-medium ${
                      isToday(day) ? 'text-primary' : 'text-gray-400'
                    }`}>
                      {day}
                    </div>
                    
                    <div className="space-y-1">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className={`truncate rounded px-1.5 py-0.5 text-xs text-white ${EVENT_COLORS[event.type].bg}`}
                          title={event.title}
                        >
                          {event.time && <span className="opacity-75">{event.time} </span>}
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-xs text-gray-500">+{dayEvents.length - 3} more</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Selected Day Events */}
        <div>
          <div className="rounded-2xl border border-surface-hover bg-surface p-6">
            <h3 className="mb-4 text-lg font-semibold">
              {selectedDate 
                ? selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
                : 'Select a date'}
            </h3>

            {selectedDate ? (
              <div className="space-y-3">
                {selectedDateEvents.length > 0 ? (
                  selectedDateEvents.map((event) => {
                    const Icon = EVENT_COLORS[event.type].icon;
                    return (
                      <div
                        key={event.id}
                        className="rounded-xl border border-surface-hover bg-background p-4 transition-colors hover:border-primary"
                      >
                        <div className="mb-2 flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${EVENT_COLORS[event.type].light}`}>
                              <Icon className={`h-4 w-4 ${EVENT_COLORS[event.type].text}`} />
                            </div>
                            <span className={`text-xs font-medium uppercase ${EVENT_COLORS[event.type].text}`}>
                              {event.type}
                            </span>
                          </div>
                          {event.time && <span className="text-sm text-gray-500">{event.time}</span>}
                        </div>
                        
                        <h4 className="mb-1 font-semibold">{event.title}</h4>
                        
                        {event.description && (
                          <p className="text-sm text-gray-400">{event.description}</p>
                        )}
                        
                        {event.status && (
                          <span className="mt-2 inline-block rounded-full bg-surface-hover px-2 py-0.5 text-xs text-gray-400">
                            {event.status}
                          </span>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="py-8 text-center text-gray-500">
                    <div className="mb-2 text-4xl">📅</div>
                    <p>No events for this day</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-12 text-center text-gray-500">
                <div className="mb-2 text-4xl">👆</div>
                <p>Click on a date to view events</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
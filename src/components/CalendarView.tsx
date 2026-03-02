import { useState } from 'react';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'print' | 'meeting' | 'deadline' | 'other';
  description?: string;
}

interface CalendarViewProps {
  events: CalendarEvent[];
}

export function CalendarView({ events }: CalendarViewProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('month');

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = firstDay.getDay();
    
    return { daysInMonth, startingDay };
  };

  const getEventColor = (type: string) => {
    switch (type) {
      case 'print': return 'bg-blue-500';
      case 'meeting': return 'bg-purple-500';
      case 'deadline': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const { daysInMonth, startingDay } = getDaysInMonth(currentDate);
  const monthName = currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const navigateMonth = (direction: number) => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + direction, 1));
  };

  const getEventsForDay = (day: number) => {
    const dateStr = new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toISOString().split('T')[0];
    return events.filter(e => e.date.startsWith(dateStr));
  };

  return (
    <div className="rounded-xl border border-surface-hover bg-surface p-6">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-semibold">{monthName}</h2>
          <div className="flex gap-1">
            <button
              onClick={() => navigateMonth(-1)}
              className="rounded-lg border border-surface-hover px-3 py-1 hover:bg-surface-hover"
            >
              ←
            </button>
            <button
              onClick={() => setCurrentDate(new Date())}
              className="rounded-lg border border-surface-hover px-3 py-1 hover:bg-surface-hover"
            >
              Today
            </button>
            <button
              onClick={() => navigateMonth(1)}
              className="rounded-lg border border-surface-hover px-3 py-1 hover:bg-surface-hover"
            >
              →
            </button>
          </div>
        </div>

        <div className="flex gap-2">
          {(['month', 'week', 'day'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded-lg px-3 py-1 capitalize ${
                viewMode === mode
                  ? 'bg-primary text-white'
                  : 'border border-surface-hover hover:bg-surface-hover'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="p-2 text-center text-sm font-medium text-gray-400">
            {day}
          </div>
        ))}

        {Array.from({ length: startingDay }).map((_, i) => (
          <div key={`empty-${i}`} className="min-h-[80px] p-1"></div>
        ))}

        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1;
          const dayEvents = getEventsForDay(day);
          const isToday = new Date().toDateString() === new Date(currentDate.getFullYear(), currentDate.getMonth(), day).toDateString();

          return (
            <div
              key={day}
              className={`min-h-[80px] rounded-lg border p-1 ${
                isToday ? 'border-primary bg-primary-light' : 'border-surface-hover bg-background'
              }`}
            >
              <div className={`mb-1 text-sm ${isToday ? 'font-bold text-primary' : 'text-gray-400'}`}>
                {day}
              </div>
              
              <div className="space-y-1">
                {dayEvents.slice(0, 3).map((event) => (
                  <div
                    key={event.id}
                    className={`truncate rounded px-1 py-0.5 text-xs text-white ${getEventColor(event.type)}`}
                    title={event.title}
                  >
                    {event.title}
                  </div>
                ))}
                {dayEvents.length > 3 && (
                  <div className="text-xs text-gray-500">+{dayEvents.length - 3} more</div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-blue-500"></div>
          <span className="text-sm text-gray-400">Print Job</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-purple-500"></div>
          <span className="text-sm text-gray-400">Meeting</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-red-500"></div>
          <span className="text-sm text-gray-400">Deadline</span>
        </div>
      </div>
    </div>
  );
}
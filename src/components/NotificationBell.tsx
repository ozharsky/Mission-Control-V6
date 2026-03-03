import { Bell } from 'lucide-react';

interface Notification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
}

interface NotificationBellProps {
  count: number;
  notifications: Notification[];
}

export function NotificationBell({ count, notifications }: NotificationBellProps) {
  return (
    <div className="relative">
      <button className="relative flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg hover:bg-surface-hover">
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-danger text-xs font-medium">
            {count}
          </span>
        )}
      </button>
    </div>
  );
}
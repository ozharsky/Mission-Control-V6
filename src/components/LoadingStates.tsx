import { useState, useEffect } from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-center">
        <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-primary" />
        <p className="text-gray-400">{message}</p>
      </div>
    </div>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-center">
        <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-warning" />
        <p className="mb-4 text-gray-400">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="min-h-[44px] min-w-[44px] rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary-hover"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon: Icon = Inbox, title, message, action }: EmptyStateProps) {
  return (
    <div className="flex h-64 items-center justify-center rounded-xl border border-surface-hover bg-surface">
      <div className="text-center">
        <Icon className="mx-auto mb-4 h-10 w-10 text-gray-400" />
        <h3 className="mb-2 text-lg font-semibold">{title}</h3>
        <p className="mb-4 text-gray-400">{message}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="min-h-[44px] min-w-[44px] rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary-hover"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
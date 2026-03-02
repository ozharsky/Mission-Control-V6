import { useState, useEffect } from 'react';

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className="flex h-64 items-center justify-center">
      <div className="text-center">
        <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
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
        <div className="mb-4 text-4xl">⚠️</div>
        <p className="mb-4 text-gray-400">{message}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary-hover"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  icon?: string;
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon = '📭', title, message, action }: EmptyStateProps) {
  return (
    <div className="flex h-64 items-center justify-center rounded-xl border border-surface-hover bg-surface">
      <div className="text-center">
        <div className="mb-4 text-4xl">{icon}</div>
        <h3 className="mb-2 text-lg font-semibold">{title}</h3>
        <p className="mb-4 text-gray-400">{message}</p>
        {action && (
          <button
            onClick={action.onClick}
            className="rounded-lg bg-primary px-4 py-2 text-white hover:bg-primary-hover"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  );
}
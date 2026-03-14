import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-8 w-8',
  };

  return (
    <Loader2 className={`animate-spin ${sizes[size]} ${className}`} />
  );
}

interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading: boolean;
  children: React.ReactNode;
  loadingText?: string;
}

export function LoadingButton({ 
  isLoading, 
  children, 
  loadingText,
  disabled,
  ...props 
}: LoadingButtonProps) {
  return (
    <button
      disabled={isLoading || disabled}
      className={`flex items-center justify-center gap-2 ${props.className || ''} ${isLoading ? 'opacity-70' : ''}`}
      {...props}
    >
      {isLoading && <Spinner size="sm" />}
      {isLoading && loadingText ? loadingText : children}
    </button>
  );
}

// Skeleton loader for cards
export function SkeletonCard() {
  return (
    <div className="animate-pulse rounded-xl border border-surface-hover bg-surface p-4">
      <div className="flex items-start justify-between">
        <div className="h-10 w-10 rounded-lg bg-surface-hover"></div>
        <div className="h-4 w-16 rounded bg-surface-hover"></div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-8 w-24 rounded bg-surface-hover"></div>
        <div className="h-4 w-32 rounded bg-surface-hover"></div>
      </div>
    </div>
  );
}

// Skeleton loader for stat cards (with icon, value, label)
export function SkeletonStatCard() {
  return (
    <div className="animate-pulse rounded-xl border border-surface-hover bg-surface p-4">
      <div className="flex items-start justify-between">
        <div className="h-10 w-10 rounded-xl bg-surface-hover"></div>
        <div className="h-4 w-12 rounded bg-surface-hover"></div>
      </div>
      <div className="mt-3 space-y-2">
        <div className="h-8 w-28 rounded bg-surface-hover"></div>
        <div className="h-3 w-20 rounded bg-surface-hover"></div>
      </div>
    </div>
  );
}

// Skeleton loader for charts
export function SkeletonChart() {
  return (
    <div className="animate-pulse rounded-xl border border-surface-hover bg-surface p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="h-5 w-32 rounded bg-surface-hover"></div>
        <div className="h-4 w-20 rounded bg-surface-hover"></div>
      </div>
      <div className="h-48 rounded-lg bg-surface-hover"></div>
    </div>
  );
}

// Skeleton loader for tables
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3">
      {/* Header */}
      <div className="flex gap-4 rounded-lg bg-surface-hover p-3">
        <div className="h-4 w-1/4 rounded bg-surface"></div>
        <div className="h-4 w-1/4 rounded bg-surface"></div>
        <div className="h-4 w-1/4 rounded bg-surface"></div>
        <div className="h-4 w-1/4 rounded bg-surface"></div>
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 rounded-lg border border-surface-hover bg-surface p-3">
          <div className="h-4 w-1/4 rounded bg-surface-hover"></div>
          <div className="h-4 w-1/4 rounded bg-surface-hover"></div>
          <div className="h-4 w-1/4 rounded bg-surface-hover"></div>
          <div className="h-4 w-1/4 rounded bg-surface-hover"></div>
        </div>
      ))}
    </div>
  );
}

// Skeleton loader for lists
export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-surface-hover bg-surface p-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 rounded-lg bg-surface-hover"></div>
            <div className="flex-1 space-y-2">
              <div className="h-4 w-3/4 rounded bg-surface-hover"></div>
              <div className="h-3 w-1/2 rounded bg-surface-hover"></div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

// Skeleton loader for dashboard widgets
export function SkeletonWidget() {
  return (
    <div className="animate-pulse rounded-xl border border-surface-hover bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-5 w-5 rounded bg-surface-hover"></div>
        <div className="h-4 w-24 rounded bg-surface-hover"></div>
      </div>
      <div className="space-y-2">
        <div className="h-6 w-full rounded bg-surface-hover"></div>
        <div className="h-6 w-3/4 rounded bg-surface-hover"></div>
        <div className="h-6 w-1/2 rounded bg-surface-hover"></div>
      </div>
    </div>
  );
}

// Full page loading state
export function SkeletonPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="animate-pulse flex items-center justify-between">
        <div className="h-8 w-48 rounded bg-surface-hover"></div>
        <div className="h-10 w-32 rounded bg-surface-hover"></div>
      </div>
      
      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
        <SkeletonStatCard />
      </div>
      
      {/* Main content */}
      <SkeletonChart />
      
      {/* List */}
      <SkeletonList count={5} />
    </div>
  );
}
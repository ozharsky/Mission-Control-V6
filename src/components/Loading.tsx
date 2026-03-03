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
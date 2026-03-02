import { useState, useEffect } from 'react';
import { RefreshCw, Zap, Moon, AlertCircle, CheckCircle, Layers, Flame, Clock, MoreHorizontal, Settings, Power } from 'lucide-react';

interface PrinterJob {
  name: string;
  progress: number;
  timeLeft?: number;
  layer?: string;
}

interface Printer {
  id: string;
  name: string;
  status: 'operational' | 'printing' | 'idle' | 'error' | 'offline';
  temp?: number;
  targetTemp?: number;
  bedTemp?: number;
  targetBedTemp?: number;
  job?: PrinterJob;
  error?: string;
  lastSeen?: string;
}

interface PrinterStatusProps {
  printers: Printer[];
  onRefresh?: () => void;
  lastUpdate?: number;
}

// Printer images mapping - served from public folder
// For GitHub Pages, images are at /Mission-Control-V6/images/
const BASE_PATH = window.location.pathname.includes('Mission-Control-V6') ? '/Mission-Control-V6' : '';

const PRINTER_IMAGES: Record<string, string> = {
  'P2S': `${BASE_PATH}/images/p2s.png`,
  'P1S': `${BASE_PATH}/images/p1s.png`,
  'Centauri Carbon': `${BASE_PATH}/images/centauri-carbon.png`,
  'A1 Mini': `${BASE_PATH}/images/a1-mini.png`,
  'X1 Carbon': `${BASE_PATH}/images/x1-carbon.png`,
};

const PRINTER_PLACEHOLDER = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjIwMCIgaGVpZ2h0PSIyMDAiIGZpbGw9IiMxYTFhMjUiLz48cGF0aCBkPSJNNTAgMTUwTDEwMCA1MEwxNTAgMTUwSDUwWiIgc3Ryb2tlPSIjMzMzIiBzdHJva2Utd2lkdGg9IjIiIGZpbGw9Im5vbmUiLz48cmVjdCB4PSI3NSIgeT0iMTAwIiB3aWR0aD0iNTAiIGhlaWdodD0iNjAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSIxMDAiIHk9IjE4MCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0iIzY0NzQ4YiIgZm9udC1zaXplPSIxNCI+UHJpbnRlcjwvdGV4dD48L3N2Zz4=';

function formatTimeAgo(timestamp?: number): string {
  if (!timestamp) return 'Never';
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatDuration(seconds?: number): string {
  if (!seconds) return '';
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

function truncateFilename(filename?: string, maxLength = 25): string {
  if (!filename) return '';
  if (filename.length <= maxLength) return filename;
  return filename.substring(0, maxLength - 3) + '...';
}

function StatusBadge({ status }: { status: string }) {
  const configs: Record<string, { bg: string; text: string; label: string; icon: string }> = {
    operational: { bg: 'bg-success/10', text: 'text-success', label: 'Online', icon: '🟢' },
    printing: { bg: 'bg-primary/10', text: 'text-primary', label: 'Printing', icon: '🖨️' },
    idle: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Idle', icon: '💤' },
    error: { bg: 'bg-danger/10', text: 'text-danger', label: 'Error', icon: '🔴' },
    offline: { bg: 'bg-gray-800', text: 'text-gray-500', label: 'Offline', icon: '⚫' },
  };

  const config = configs[status] || configs.offline;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.bg} ${config.text}`}>
      <span>{config.icon}</span>
      {config.label}
    </span>
  );
}

function PrinterCard({ printer, index }: { printer: Printer; index: number }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const isPrinting = printer.status === 'printing';
  const hasJob = printer.job?.name;
  const timeLeft = printer.job?.timeLeft ? formatDuration(printer.job.timeLeft) : null;
  const imageUrl = PRINTER_IMAGES[printer.name] || PRINTER_PLACEHOLDER;

  return (
    <div
      className="group relative overflow-hidden rounded-2xl border border-surface-hover bg-surface transition-all duration-300 hover:border-primary hover:shadow-xl hover:shadow-primary/10"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Status indicator line */}
      <div className={`absolute left-0 top-0 h-full w-1 ${
        printer.status === 'printing' ? 'bg-primary' :
        printer.status === 'operational' || printer.status === 'idle' ? 'bg-success' :
        printer.status === 'error' ? 'bg-danger' : 'bg-gray-600'
      }`}></div>

      <div className="p-5">
        {/* Header */}
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">{printer.name}</h3>
            <p className="text-xs text-gray-500">{printer.id}</p>
          </div>
          <StatusBadge status={printer.status} />
        </div>

        {/* Printer Image */}
        <div className="mb-4 flex justify-center">
          <div className="relative h-40 w-40">
            {!imageLoaded && !imageError && (
              <div className="flex h-full w-full items-center justify-center rounded-xl bg-surface">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
              </div>
            )}
            <img
              src={imageError ? PRINTER_PLACEHOLDER : imageUrl}
              alt={printer.name}
              className={`h-full w-full rounded-xl object-contain transition-opacity duration-300 ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </div>
        </div>

        {/* Temperatures */}
        <div className="mb-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-surface-hover p-3">
            <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
              <Flame className="h-3.5 w-3.5"></Flame>
              Nozzle
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold">{printer.temp || 0}°C</span>
              {printer.targetTemp > 0 && (
                <span className="text-xs text-gray-500">/ {printer.targetTemp}°C</span>
              )}
            </div>
          </div>

          <div className="rounded-xl bg-surface-hover p-3">
            <div className="mb-1 flex items-center gap-2 text-xs text-gray-400">
              <Layers className="h-3.5 w-3.5"></Layers>
              Bed
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-bold">{printer.bedTemp || 0}°C</span>
              {printer.targetBedTemp > 0 && (
                <span className="text-xs text-gray-500">/ {printer.targetBedTemp}°C</span>
              )}
            </div>
          </div>
        </div>

        {/* Job Progress */}
        {isPrinting && hasJob ? (
          <div className="mb-4 rounded-xl bg-surface-hover p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="max-w-[150px] truncate text-sm font-medium">
                {truncateFilename(printer.job?.name)}
              </span>
              {timeLeft && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="h-3 w-3"></Clock>
                  {timeLeft}
                </span>
              )}
            </div>

            <div className="mb-2 flex items-center gap-3">
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-surface">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${printer.job?.progress || 0}%` }}
                />
              </div>
              <span className="text-sm font-bold">{printer.job?.progress || 0}%</span>
            </div>

            {printer.job?.layer && (
              <p className="text-xs text-gray-500">{printer.job.layer}</p>
            )}
          </div>
        ) : printer.error ? (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-danger/10 p-3 text-danger">
            <AlertCircle className="h-4 w-4"></AlertCircle>
            <span className="text-sm">{printer.error}</span>
          </div>
        ) : (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-success/10 p-3 text-success">
            <CheckCircle className="h-4 w-4"></CheckCircle>
            <span className="text-sm">Ready to print</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-surface-hover py-2.5 text-sm font-medium transition-colors hover:bg-surface-hover">
            <Settings className="h-4 w-4"></Settings>
            Details
          </button>
          
          {printer.status === 'offline' || printer.status === 'error' ? (
            <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-success py-2.5 text-sm font-medium text-white transition-colors hover:bg-success/80">
              <Power className="h-4 w-4"></Power>
              Connect
            </button>
          ) : (
            <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover">
              <Zap className="h-4 w-4"></Zap>
              Print
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function PrinterStatus({ printers, onRefresh, lastUpdate }: PrinterStatusProps) {
  const [filter, setFilter] = useState<'all' | 'printing' | 'idle' | 'error'>('all');

  const onlineCount = printers.filter(p => 
    p.status === 'operational' || p.status === 'printing' || p.status === 'idle'
  ).length;
  const printingCount = printers.filter(p => p.status === 'printing').length;
  const errorCount = printers.filter(p => p.status === 'error' || p.status === 'offline').length;

  const filteredPrinters = filter === 'all' 
    ? printers 
    : printers.filter(p => p.status === filter);

  const filters = [
    { id: 'all', label: 'All', icon: Layers, count: printers.length },
    { id: 'printing', label: 'Printing', icon: Zap, count: printingCount },
    { id: 'idle', label: 'Idle', icon: Moon, count: printers.filter(p => p.status === 'idle').length },
    { id: 'error', label: 'Error', icon: AlertCircle, count: errorCount },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Printers</h1>
            <p className="text-sm text-gray-400">{onlineCount}/{printers.length} online</p>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdate && (
              <span className="text-sm text-gray-500">
                Updated {formatTimeAgo(lastUpdate)}
              </span>
            )}
            <button
              onClick={onRefresh}
              className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 font-medium text-white transition-all hover:bg-primary-hover hover:shadow-lg"
            >
              <RefreshCw className="h-4 w-4"></RefreshCw>
              Refresh
            </button>
          </div>
        </div>

        {/* Status Summary */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {errorCount > 0 ? (
            <div className="flex items-center gap-2 rounded-xl bg-danger/10 p-3 text-danger">
              <AlertCircle className="h-5 w-5"></AlertCircle>
              <span className="font-medium">{errorCount} issue{errorCount > 1 ? 's' : ''}</span>
            </div>
          ) : printingCount > 0 ? (
            <div className="flex items-center gap-2 rounded-xl bg-primary/10 p-3 text-primary">
              <Zap className="h-5 w-5"></Zap>
              <span className="font-medium">{printingCount} printing</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-xl bg-success/10 p-3 text-success">
              <CheckCircle className="h-5 w-5"></CheckCircle>
              <span className="font-medium">All online</span>
            </div>
          )}

          <div className="flex items-center justify-between rounded-xl bg-surface-hover p-3">
            <span className="text-sm text-gray-400">Online</span>
            <span className="text-lg font-bold">{onlineCount}</span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-surface-hover p-3">
            <span className="text-sm text-gray-400">Printing</span>
            <span className="text-lg font-bold">{printingCount}</span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-surface-hover p-3">
            <span className="text-sm text-gray-400">Total</span>
            <span className="text-lg font-bold">{printers.length}</span>
          </div>
        </div>
      </div>

      {/* Filter Buttons */}
      <div className="flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id as typeof filter)}
            className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              filter === f.id
                ? 'bg-primary text-white shadow-lg shadow-primary/25'
                : 'border border-surface-hover bg-surface hover:bg-surface-hover'
            }`}
          >
            <f.icon className="h-4 w-4"></f.icon>
            {f.label}
            <span className={`rounded-full px-2 py-0.5 text-xs ${
              filter === f.id ? 'bg-white/20' : 'bg-surface-hover'
            }`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Printer Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        {filteredPrinters.map((printer, index) => (
          <PrinterCard key={printer.id} printer={printer} index={index} />
        ))}
      </div>

      {filteredPrinters.length === 0 && (
        <div className="rounded-2xl border border-dashed border-surface-hover py-16 text-center">
          <div className="mb-4 text-6xl">🖨️</div>
          <h3 className="mb-2 text-xl font-semibold">No printers found</h3>
          <p className="text-gray-500">{filter === 'all' ? 'Add your first printer to get started' : 'Try a different filter'}</p>
        </div>
      )}
    </div>
  );
}
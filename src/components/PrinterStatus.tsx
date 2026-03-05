import { useState, useEffect } from 'react';
import { RefreshCw, Zap, Moon, AlertCircle, CheckCircle, Layers, Flame, Clock, MoreHorizontal, Settings, Power, Pause, Play, Square, Circle, Printer, AlertTriangle } from 'lucide-react';
import { getSimplyPrint } from '../lib/simplyprint';
import type { SimplyPrintPrinter } from '../lib/simplyprint';

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
  const configs: Record<string, { bg: string; text: string; label: string; icon: React.ReactNode }> = {
    operational: { bg: 'bg-success/10', text: 'text-success', label: 'Online', icon: <CheckCircle className="h-4 w-4" /> },
    printing: { bg: 'bg-primary/10', text: 'text-primary', label: 'Printing', icon: <Printer className="h-4 w-4" /> },
    idle: { bg: 'bg-blue-500/10', text: 'text-blue-400', label: 'Idle', icon: <Moon className="h-4 w-4" /> },
    error: { bg: 'bg-danger/10', text: 'text-danger', label: 'Error', icon: <AlertTriangle className="h-4 w-4" /> },
    offline: { bg: 'bg-gray-800', text: 'text-gray-500', label: 'Offline', icon: <Circle className="h-3 w-3" /> },
  };

  const config = configs[status] || configs.offline;

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${config.bg} ${config.text}`}>
      {config.icon}
      {config.label}
    </span>
  );
}

function PrinterCard({ printer, index }: { printer: Printer; index: number }) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isControlling, setIsControlling] = useState(false);
  const isPrinting = printer.status === 'printing';
  const hasJob = printer.job?.name;
  const timeLeft = printer.job?.timeLeft ? formatDuration(printer.job.timeLeft) : null;
  const imageUrl = PRINTER_IMAGES[printer.name] || PRINTER_PLACEHOLDER;

  const handlePause = async () => {
    setIsControlling(true);
    const api = getSimplyPrint();
    if (api) {
      await api.pausePrint(printer.id);
    }
    setIsControlling(false);
  };

  const handleResume = async () => {
    setIsControlling(true);
    const api = getSimplyPrint();
    if (api) {
      await api.startPrint(printer.id, '');
    }
    setIsControlling(false);
  };

  const handleCancel = async () => {
    setIsControlling(true);
    const api = getSimplyPrint();
    if (api) {
      await api.cancelPrint(printer.id);
    }
    setIsControlling(false);
  };

  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-surface-hover bg-surface transition-all duration-300 hover:border-primary sm:rounded-2xl"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      {/* Status indicator line */}
      <div className={`absolute left-0 top-0 h-full w-0.5 sm:w-1 ${
        printer.status === 'printing' ? 'bg-primary' :
        printer.status === 'operational' || printer.status === 'idle' ? 'bg-success' :
        printer.status === 'error' ? 'bg-danger' : 'bg-gray-600'
      }`}></div>

      <div className="p-2 sm:p-5">
        {/* Header - Mobile: compact */}
        <div className="mb-2 flex items-start justify-between sm:mb-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xs font-semibold sm:text-lg">{printer.name}</h3>
            <p className="hidden text-xs text-gray-500 sm:block">{printer.id}</p>
          </div>
          <div className="hidden sm:block">
            <StatusBadge status={printer.status} />
          </div>
          {/* Mobile: simple status dot */}
          <div className={`h-2 w-2 rounded-full sm:hidden ${
            printer.status === 'printing' ? 'bg-primary' :
            printer.status === 'operational' || printer.status === 'idle' ? 'bg-success' :
            printer.status === 'error' ? 'bg-danger' : 'bg-gray-600'
          }`}></div>
        </div>

        {/* Printer Image - Mobile: smaller */}
        <div className="mb-2 flex justify-center sm:mb-4">
          <div className="relative h-16 w-16 sm:h-40 sm:w-40">
            {!imageLoaded && !imageError && (
              <div className="flex h-full w-full items-center justify-center rounded-lg bg-surface sm:rounded-xl">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent sm:h-8 sm:w-8"></div>
              </div>
            )}
            <img
              src={imageError ? PRINTER_PLACEHOLDER : imageUrl}
              alt={printer.name}
              className={`h-full w-full rounded-lg object-contain transition-opacity duration-300 sm:rounded-xl ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => setImageError(true)}
            />
          </div>
        </div>

        {/* Temperatures - Mobile: single row, smaller text */}
        <div className="mb-2 grid grid-cols-2 gap-1 sm:mb-4 sm:gap-3">
          <div className="rounded-lg touch-feedback bg-surface-hover p-1.5 sm:rounded-xl sm:p-3">
            <div className="mb-0.5 flex items-center gap-1 text-[10px] text-gray-400 sm:mb-1 sm:gap-2 sm:text-xs">
              <Flame className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5"></Flame>
              <span className="hidden sm:inline">Nozzle</span>
            </div>
            <div className="flex items-baseline gap-0.5 sm:gap-1">
              <span className="text-sm font-bold sm:text-xl">{printer.temp || 0}°</span>
              {printer.targetTemp > 0 && (
                <span className="text-[10px] text-gray-500 sm:text-xs">/{printer.targetTemp}°</span>
              )}
            </div>
          </div>

          <div className="rounded-lg touch-feedback bg-surface-hover p-1.5 sm:rounded-xl sm:p-3">
            <div className="mb-0.5 flex items-center gap-1 text-[10px] text-gray-400 sm:mb-1 sm:gap-2 sm:text-xs">
              <Layers className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5"></Layers>
              <span className="hidden sm:inline">Bed</span>
            </div>
            <div className="flex items-baseline gap-0.5 sm:gap-1">
              <span className="text-sm font-bold sm:text-xl">{printer.bedTemp || 0}°</span>
              {printer.targetBedTemp > 0 && (
                <span className="text-[10px] text-gray-500 sm:text-xs">/{printer.targetBedTemp}°</span>
              )}
            </div>
          </div>
        </div>

        {/* Job Progress - Mobile: compact */}
        {isPrinting && hasJob ? (
          <div className="mb-2 rounded-lg bg-surface-hover p-2 sm:mb-4 sm:rounded-xl sm:p-4">
            <div className="mb-1 flex items-center justify-between sm:mb-2">
              <span className="max-w-[80px] truncate text-[10px] font-medium sm:max-w-[150px] sm:text-sm">
                {truncateFilename(printer.job?.name)}
              </span>
              {timeLeft && (
                <span className="flex items-center gap-1 text-[10px] text-gray-400 sm:text-xs">
                  <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3"></Clock>
                  {timeLeft}
                </span>
              )}
            </div>

            <div className="mb-1 flex items-center gap-2 sm:mb-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface sm:h-2.5">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${printer.job?.progress || 0}%` }}
                />
              </div>
              <span className="text-xs font-bold sm:text-sm">{printer.job?.progress || 0}%</span>
            </div>

            {printer.job?.layer && (
              <p className="hidden text-xs text-gray-500 sm:block">{printer.job.layer}</p>
            )}
          </div>
        ) : printer.error ? (
          <div className="mb-2 flex items-center gap-1 rounded-lg bg-danger/10 p-2 text-[10px] text-danger sm:mb-4 sm:gap-2 sm:rounded-xl sm:p-3 sm:text-sm">
            <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4"></AlertCircle>
            <span className="truncate">{printer.error}</span>
          </div>
        ) : (
          <div className="mb-2 flex items-center gap-1 rounded-lg bg-success/10 p-2 text-[10px] text-success sm:mb-4 sm:gap-2 sm:rounded-xl sm:p-3 sm:text-sm">
            <CheckCircle className="h-3 w-3 sm:h-4 sm:w-4"></CheckCircle>
            <span>Ready</span>
          </div>
        )}

        {/* Actions - Mobile: icon only */}
        <div className="flex gap-1 sm:gap-2">
          {isPrinting ? (
            <>
              <button 
                onClick={handlePause}
                disabled={isControlling}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-warning/30 bg-warning/10 py-1.5 text-[10px] font-medium text-warning transition-colors hover:bg-warning/20 disabled:opacity-50 sm:rounded-xl sm:py-2.5 sm:text-sm"
              >
                <Pause className="h-3 w-3 sm:h-4 sm:w-4"></Pause>
                <span className="hidden sm:inline">Pause</span>
              </button>
              <button 
                onClick={handleCancel}
                disabled={isControlling}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-danger/30 bg-danger/10 py-1.5 text-[10px] font-medium text-danger transition-colors hover:bg-danger/20 disabled:opacity-50 sm:rounded-xl sm:py-2.5 sm:text-sm"
              >
                <Square className="h-3 w-3 sm:h-4 sm:w-4"></Square>
                <span className="hidden sm:inline">Stop</span>
              </button>
            </>
          ) : printer.status === 'idle' || printer.status === 'operational' ? (
            <>
              <button className="flex flex-1 items-center justify-center gap-1 rounded-lg border border-surface-hover py-1.5 text-[10px] font-medium transition-colors hover:bg-surface-hover sm:rounded-xl sm:py-2.5 sm:text-sm">
                <Settings className="h-3 w-3 sm:h-4 sm:w-4"></Settings>
                <span className="hidden sm:inline">Details</span>
              </button>
              <button className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-medium text-white transition-colors hover:bg-primary-hover">
                <Zap className="h-4 w-4"></Zap>
                Print
              </button>
            </>
          ) : (
            <button className="flex w-full items-center justify-center gap-2 rounded-xl bg-success py-2.5 text-sm font-medium text-white transition-colors hover:bg-success/80">
              <Power className="h-4 w-4"></Power>
              Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export function PrinterStatus({ printers: initialPrinters, onRefresh, lastUpdate }: PrinterStatusProps) {
  const [filter, setFilter] = useState<'all' | 'printing' | 'idle' | 'error'>('all');
  const [printers, setPrinters] = useState<Printer[]>(initialPrinters);
  const [isLoading, setIsLoading] = useState(false);
  const [useSimplyPrint, setUseSimplyPrint] = useState(false);

  // Check if SimplyPrint is configured
  useEffect(() => {
    const apiKey = localStorage.getItem('simplyprint_api_key');
    setUseSimplyPrint(!!apiKey);
    if (apiKey) {
      fetchSimplyPrintPrinters();
    }
  }, []);

  // Sync with prop changes from parent
  useEffect(() => {
    setPrinters(initialPrinters);
  }, [initialPrinters]);

  const fetchSimplyPrintPrinters = async () => {
    setIsLoading(true);
    const api = getSimplyPrint();
    if (api) {
      const spPrinters = await api.getPrinters();
      // The proxy already returns data in the correct flat format
      const convertedPrinters: Printer[] = spPrinters.map((sp: any) => ({
        id: sp.id?.toString(),
        name: sp.name,
        status: sp.status,
        temp: sp.temp || 0,
        targetTemp: sp.targetTemp || 0,
        bedTemp: sp.bedTemp || 0,
        targetBedTemp: sp.targetBedTemp || 0,
        job: sp.job ? {
          name: sp.job.file || sp.job.name,
          progress: sp.job.percentage || sp.progress || 0,
          timeLeft: sp.job.time,
          layer: sp.job.layer,
        } : undefined,
        lastSeen: sp.lastSeen || new Date().toISOString(),
      }));
      setPrinters(convertedPrinters);
    }
    setIsLoading(false);
  };

  const handleRefresh = () => {
    if (useSimplyPrint) {
      fetchSimplyPrintPrinters();
    } else if (onRefresh) {
      onRefresh();
    }
  };

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
    <div className="space-y-4 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold">Printers</h1>
            <p className="text-sm text-gray-400">{onlineCount}/{printers.length} online</p>
          </div>

          <div className="flex items-center gap-3">
            {lastUpdate && !useSimplyPrint && (
              <span className="text-sm text-gray-500">
                Updated {formatTimeAgo(lastUpdate)}
              </span>
            )}
            {useSimplyPrint && (
              <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                SimplyPrint
              </span>
            )}
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="flex min-h-[44px] items-center gap-2 rounded-xl bg-primary px-4 py-2 font-medium text-white transition-all hover:bg-primary-hover hover:shadow-lg disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}></RefreshCw>
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
            className={`flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-all ${
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

      {/* Printer Grid - Mobile: 1 column, Tablet: 2 columns, Desktop: 3 columns */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filteredPrinters.map((printer, index) => (
          <PrinterCard key={printer.id} printer={printer} index={index} />
        ))}
      </div>

      {filteredPrinters.length === 0 && (
        <div className="rounded-2xl border border-dashed border-surface-hover py-16 text-center">
          <Printer className="mx-auto mb-4 h-16 w-16 text-gray-600" />
          <h3 className="mb-2 text-xl font-semibold">No printers found</h3>
          <p className="text-gray-500">{filter === 'all' ? 'Add your first printer to get started' : 'Try a different filter'}</p>
        </div>
      )}
    </div>
  );
}
import { useState } from 'react';

interface Printer {
  id: string;
  name: string;
  status: 'online' | 'offline' | 'printing' | 'error';
  progress: number;
  currentJob?: string;
  temperature?: {
    bed: number;
    nozzle: number;
  };
  timeRemaining?: number;
}

interface PrinterStatusProps {
  printers: Printer[];
}

function PrinterCard({ printer, index }: { printer: Printer; index: number }) {
  const [expanded, setExpanded] = useState(false);

  const statusConfig = {
    online: { 
      color: 'bg-success', 
      text: 'text-success', 
      bg: 'bg-success/10', 
      label: 'Online', 
      icon: '🟢' 
    },
    offline: { 
      color: 'bg-gray-500', 
      text: 'text-gray-500', 
      bg: 'bg-gray-800', 
      label: 'Offline', 
      icon: '⚫' 
    },
    printing: { 
      color: 'bg-primary', 
      text: 'text-primary', 
      bg: 'bg-primary/10', 
      label: 'Printing', 
      icon: '🖨️' 
    },
    error: { 
      color: 'bg-danger', 
      text: 'text-danger', 
      bg: 'bg-danger/10', 
      label: 'Error', 
      icon: '🔴' 
    },
  };

  const config = statusConfig[printer.status] || statusConfig.offline;

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  return (
    <div
      className="group rounded-xl border border-surface-hover bg-background p-5 transition-all duration-200 hover:border-primary hover:shadow-lg"
      style={{ animationDelay: `${index * 100}ms` }}
    >
      <div className="mb-4 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${config.bg}`}>
            <span className="text-xl">🖨️</span>
          </div>
          <div>
            <h3 className="font-semibold">{printer.name}</h3>
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${config.color}`}></span>
              <span className={`text-sm ${config.text}`}>{config.label}</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setExpanded(!expanded)}
          className="rounded-lg p-1 opacity-0 transition-opacity hover:bg-surface group-hover:opacity-100"
        >
          {expanded ? '▼' : '▶'}
        </button>
      </div>

      {/* Progress */}
      {printer.status === 'printing' && (
        <div className="mb-4">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-gray-400">{printer.currentJob || 'Printing...'}</span>
            <span className="font-medium">{printer.progress}%</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${printer.progress}%` }}
            />
          </div>
          {printer.timeRemaining && (
            <p className="mt-2 text-xs text-gray-500">⏱️ {formatTime(printer.timeRemaining)} remaining</p>
          )}
        </div>
      )}

      {/* Temperature */}
      {expanded && printer.temperature && (
        <div className="mt-4 grid grid-cols-2 gap-3 rounded-lg bg-surface/50 p-3">
          <div>
            <p className="text-xs text-gray-500">Nozzle</p>
            <p className="text-lg font-semibold">{printer.temperature.nozzle}°C</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Bed</p>
            <p className="text-lg font-semibold">{printer.temperature.bed}°C</p>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="mt-4 flex gap-2">
        {printer.status === 'online' && (
          <button className="flex-1 rounded-lg border border-surface-hover py-2 text-sm font-medium transition-colors hover:bg-surface-hover">
            Start Print
          </button>
        )}
        {printer.status === 'printing' && (
          <>
            <button className="flex-1 rounded-lg border border-warning/30 bg-warning/10 py-2 text-sm font-medium text-warning transition-colors hover:bg-warning/20">
              Pause
            </button>
            <button className="flex-1 rounded-lg border border-danger/30 bg-danger/10 py-2 text-sm font-medium text-danger transition-colors hover:bg-danger/20">
              Cancel
            </button>
          </>
        )}
        {printer.status === 'error' && (
          <button className="flex-1 rounded-lg bg-danger py-2 text-sm font-medium text-white transition-colors hover:bg-danger/80">
            Check Error
          </button>
        )}
      </div>
    </div>
  );
}

export function PrinterStatus({ printers }: PrinterStatusProps) {
  const onlineCount = printers.filter(p => p.status === 'online' || p.status === 'printing').length;
  const printingCount = printers.filter(p => p.status === 'printing').length;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
              <span className="text-xl">🟢</span>
            </div>
            <div>
              <p className="text-2xl font-bold">{onlineCount}</p>
              <p className="text-sm text-gray-400">Online</p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-surface-hover bg-surface p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <span className="text-xl">🖨️</span>
            </div>
            <div>
              <p className="text-2xl font-bold">{printingCount}</p>
              <p className="text-sm text-gray-400">Printing</p>
            </div>
          </div>
        </div>
      </div>

      {/* Printer Grid */}
      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Printers</h2>
          <span className="text-sm text-gray-400">{printers.length} total</span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {printers.map((printer, index) => (
            <PrinterCard key={printer.id} printer={printer} index={index} />
          ))}
        </div>

        {printers.length === 0 && (
          <div className="rounded-xl border border-dashed border-surface-hover py-12 text-center text-gray-500">
            <div className="mb-2 text-4xl">🖨️</div>
            <p>No printers configured</p>
          </div>
        )}
      </div>
    </div>
  );
}
import { useState, useEffect } from 'react';
import { RefreshCw, Zap, Moon, AlertCircle, CheckCircle, Layers, Flame, Clock, Circle, Printer, AlertTriangle } from 'lucide-react';
import { getSimplyPrint } from '../lib/simplyprint';
import type { SimplyPrintPrinter } from '../lib/simplyprint';

interface PrinterJob {
  name: string;
  progress: number;
  timeLeft?: number;
  layer?: string;
}

// Extended Printer interface with more fields
interface Printer {
  id: string;
  name: string;
  status: 'operational' | 'printing' | 'idle' | 'error' | 'offline';
  temp?: number;
  targetTemp?: number;
  bedTemp?: number;
  targetBedTemp?: number;
  chamberTemp?: number;
  job?: PrinterJob;
  error?: string;
  lastSeen?: string;
  printSpeed?: number;
  fanSpeed?: number;
  material?: string;
  printProfile?: string;
  nozzleSize?: string;
  layerHeight?: number;
  infill?: number;
  printTime?: number;
  totalTime?: number;
  zHeight?: number;
  fileName?: string;
}

interface PrinterStatusProps {
  printers: Printer[];
  onRefresh?: () => void;
  lastUpdate?: number;
}

// Printer images mapping - served from public folder
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
  const isPrinting = printer.status === 'printing';
  const hasJob = printer.job?.name;
  const timeLeft = printer.job?.timeLeft ? formatDuration(printer.job.timeLeft) : null;
  const elapsedTime = printer.printTime ? formatDuration(printer.printTime) : null;
  const totalTime = printer.totalTime ? formatDuration(printer.totalTime) : null;
  const imageUrl = PRINTER_IMAGES[printer.name] || PRINTER_PLACEHOLDER;

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
        {/* Header */}
        <div className="mb-2 flex items-start justify-between sm:mb-4">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xs font-semibold sm:text-lg">{printer.name}</h3>
            <p className="text-[10px] text-gray-500 sm:text-xs">{printer.id}</p>
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

        {/* Printer Image */}
        <div className="mb-2 flex justify-center sm:mb-4">
          <div className="relative h-16 w-16 sm:h-32 sm:w-32">
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

        {/* Temperatures Grid - 3 columns */}
        <div className="mb-2 grid grid-cols-3 gap-1 sm:mb-4 sm:gap-3">
          <div className="rounded-lg touch-feedback bg-surface-hover p-1.5 sm:rounded-xl sm:p-3">
            <div className="mb-0.5 flex items-center gap-1 text-[10px] text-gray-400 sm:mb-1 sm:gap-2 sm:text-xs">
              <Flame className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5"></Flame>
              <span className="hidden sm:inline">Nozzle</span>
              <span className="sm:hidden">Noz</span>
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

          <div className="rounded-lg touch-feedback bg-surface-hover p-1.5 sm:rounded-xl sm:p-3">
            <div className="mb-0.5 flex items-center gap-1 text-[10px] text-gray-400 sm:mb-1 sm:gap-2 sm:text-xs">
              <Zap className="h-2.5 w-2.5 sm:h-3.5 sm:w-3.5"></Zap>
              <span className="hidden sm:inline">Chamber</span>
              <span className="sm:hidden">Chm</span>
            </div>
            <div className="flex items-baseline gap-0.5 sm:gap-1">
              <span className="text-sm font-bold sm:text-xl">{printer.chamberTemp || 0}°</span>
            </div>
          </div>
        </div>

        {/* Job Progress */}
        {isPrinting && hasJob ? (
          <div className="mb-2 rounded-lg bg-surface-hover p-2 sm:mb-4 sm:rounded-xl sm:p-4">
            {/* File Name */}
            <div className="mb-1 flex items-center justify-between sm:mb-2">
              <span className="max-w-[100px] truncate text-[10px] font-medium sm:max-w-[180px] sm:text-sm" title={printer.job?.name}>
                {truncateFilename(printer.job?.name, 20)}
              </span>
              {timeLeft && (
                <span className="flex items-center gap-1 text-[10px] text-gray-400 sm:text-xs">
                  <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3"></Clock>
                  {timeLeft} left
                </span>
              )}
            </div>

            {/* Progress Bar */}
            <div className="mb-2 flex items-center gap-2">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface sm:h-2.5">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${printer.job?.progress || 0}%` }}
                />
              </div>
              <span className="text-xs font-bold sm:text-sm">{printer.job?.progress || 0}%</span>
            </div>

            {/* Time Info */}
            <div className="grid grid-cols-2 gap-2 text-[10px] text-gray-500 sm:text-xs">
              {elapsedTime && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3"></Clock>
                  <span>Elapsed: {elapsedTime}</span>
                </div>
              )}
              {totalTime && (
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3"></Clock>
                  <span>Total: {totalTime}</span>
                </div>
              )}
            </div>

            {/* Layer Info - More prominent */}
            {printer.job?.layer && (
              <div className="mt-2 flex items-center justify-between rounded bg-surface p-1.5 sm:p-2">
                <span className="text-[10px] text-gray-400 sm:text-xs">Layer</span>
                <span className="text-xs font-semibold sm:text-sm">{printer.job.layer}</span>
              </div>
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
            <span>Ready for next job</span>
          </div>
        )}

        {/* Print Settings Info - Only show when printing */}
        {isPrinting && (
          <div className="mb-2 grid grid-cols-3 gap-1 rounded-lg bg-surface-hover p-2 sm:mb-4 sm:gap-2 sm:rounded-xl sm:p-3">
            <div className="text-center">
              <div className="text-[10px] text-gray-400 sm:text-xs">Speed</div>
              <div className="text-xs font-semibold sm:text-sm">{printer.printSpeed || 0}mm/s</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-400 sm:text-xs">Fan</div>
              <div className="text-xs font-semibold sm:text-sm">{printer.fanSpeed || 0}%</div>
            </div>
            <div className="text-center">
              <div className="text-[10px] text-gray-400 sm:text-xs">Z-Height</div>
              <div className="text-xs font-semibold sm:text-sm">{printer.zHeight?.toFixed(1) || 0}mm</div>
            </div>
          </div>
        )}

        {/* Print Info Section - Material & Profile */}
        {(printer.material || printer.printProfile || printer.nozzleSize) && (
          <div className="mb-2 rounded-lg bg-surface-hover p-2 sm:mb-4 sm:rounded-xl sm:p-3">
            <div className="mb-2 flex items-center gap-1 text-[10px] text-gray-400 sm:text-xs">
              <Layers className="h-3 w-3 sm:h-4 sm:w-4"></Layers>
              <span>Print Settings</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {printer.material && (
                <div className="rounded bg-surface p-1.5 text-center sm:p-2">
                  <div className="text-[10px] text-gray-400 sm:text-xs">Material</div>
                  <div className="text-xs font-semibold sm:text-sm">{printer.material}</div>
                </div>
              )}
              {printer.printProfile && (
                <div className="rounded bg-surface p-1.5 text-center sm:p-2">
                  <div className="text-[10px] text-gray-400 sm:text-xs">Profile</div>
                  <div className="text-xs font-semibold sm:text-sm">{printer.printProfile}</div>
                </div>
              )}
              {printer.nozzleSize && (
                <div className="rounded bg-surface p-1.5 text-center sm:p-2">
                  <div className="text-[10px] text-gray-400 sm:text-xs">Nozzle</div>
                  <div className="text-xs font-semibold sm:text-sm">{printer.nozzleSize}</div>
                </div>
              )}
              {printer.layerHeight && (
                <div className="rounded bg-surface p-1.5 text-center sm:p-2">
                  <div className="text-[10px] text-gray-400 sm:text-xs">Layer Ht</div>
                  <div className="text-xs font-semibold sm:text-sm">{printer.layerHeight}mm</div>
                </div>
              )}
              {printer.infill && (
                <div className="rounded bg-surface p-1.5 text-center sm:p-2">
                  <div className="text-[10px] text-gray-400 sm:text-xs">Infill</div>
                  <div className="text-xs font-semibold sm:text-sm">{printer.infill}%</div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Last Seen */}
        <div className="flex items-center justify-between text-[10px] text-gray-500 sm:text-xs">
          <span>Last seen: {formatTimeAgo(printer.lastSeen ? Date.parse(printer.lastSeen) : undefined)}</span>
          {printer.fileName && !isPrinting && (
            <span className="truncate max-w-[100px]" title={printer.fileName}>
              {truncateFilename(printer.fileName, 15)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function PrinterStatus({ printers: initialPrinters, onRefresh, lastUpdate: initialLastUpdate }: PrinterStatusProps) {
  const [printers, setPrinters] = useState<Printer[]>(initialPrinters);
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<number | undefined>(initialLastUpdate);
  const [error, setError] = useState<string | null>(null);

  // Fetch live data from SimplyPrint API
  const fetchLivePrinters = async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setError(null);
    try {
      const api = getSimplyPrint();
      if (api) {
        const livePrinters = await api.getPrinters();
        console.log('SimplyPrint API response:', livePrinters);
        
        // If API returns empty, fallback to Firebase
        if (!livePrinters || livePrinters.length === 0) {
          console.log('API returned empty, using Firebase data');
          setPrinters(initialPrinters);
          setLastUpdate(Date.now());
          if (showLoading) setLoading(false);
          return;
        }
        
        // Map SimplyPrint data to our Printer interface
        const mappedPrinters: Printer[] = livePrinters.map((sp: any) => {
          // Debug temperature fields
          console.log('Printer temps raw:', {
            name: sp.name,
            temperature: sp.temperature,
            nozzle_temp: sp.nozzle_temp,
            tool0: sp.tool0,
            bed_temp: sp.bed_temp,
            bed: sp.bed,
            chamber_temp: sp.chamber_temp,
            temps: sp.temps,
          });
          
          // Try multiple possible temperature field names
          const nozzleTemp = sp.temperature?.nozzle 
            ?? sp.temperature?.tool0 
            ?? sp.nozzle_temp 
            ?? sp.tool0?.actual 
            ?? sp.tool0?.temperature 
            ?? sp.temps?.tool0?.actual 
            ?? sp.temps?.tool0?.temp 
            ?? 0;
            
          const targetNozzleTemp = sp.temperature?.targetNozzle 
            ?? sp.temperature?.tool0Target 
            ?? sp.target_nozzle_temp 
            ?? sp.tool0?.target 
            ?? sp.temps?.tool0?.target 
            ?? 0;
            
          const bedTemp = sp.temperature?.bed 
            ?? sp.temperature?.bedActual 
            ?? sp.bed_temp 
            ?? sp.bed?.actual 
            ?? sp.bed?.temperature 
            ?? sp.temps?.bed?.actual 
            ?? sp.temps?.bed?.temp 
            ?? 0;
            
          const targetBedTemp = sp.temperature?.targetBed 
            ?? sp.temperature?.bedTarget 
            ?? sp.target_bed_temp 
            ?? sp.bed?.target 
            ?? sp.temps?.bed?.target 
            ?? 0;
            
          const chamberTemp = sp.chamber_temp 
            ?? sp.temperature?.chamber 
            ?? sp.temperature?.chamberActual 
            ?? sp.chamber?.actual 
            ?? sp.chamber?.temperature 
            ?? sp.temps?.chamber?.actual 
            ?? sp.temps?.chamber?.temp;
          
          return {
            id: sp.id || sp.printer_id,
            name: sp.name || sp.printer_name,
            status: sp.status || 'offline',
            temp: nozzleTemp,
            targetTemp: targetNozzleTemp,
            bedTemp: bedTemp,
            targetBedTemp: targetBedTemp,
            chamberTemp: chamberTemp,
            job: sp.currentJob || sp.job ? {
              name: sp.currentJob?.name || sp.job?.name || sp.job_name,
              progress: sp.progress || sp.currentJob?.progress || sp.job?.progress || 0,
              timeLeft: sp.currentJob?.timeLeft || sp.job?.timeLeft || sp.time_remaining,
              layer: sp.currentJob?.layer || sp.job?.layer || sp.layer_info,
            } : undefined,
            printSpeed: sp.print_speed || sp.speed,
            fanSpeed: sp.fan_speed || sp.fan,
            material: sp.material || sp.filament_type || sp.filament,
            printProfile: sp.print_profile || sp.profile,
            nozzleSize: sp.nozzle_size,
            layerHeight: sp.layer_height,
            infill: sp.infill_percentage || sp.infill,
            printTime: sp.print_time || sp.elapsed_time,
            totalTime: sp.total_time || sp.estimated_time,
            zHeight: sp.z_height || sp.current_z,
            fileName: sp.file_name || sp.filename,
            lastSeen: sp.last_seen || sp.lastSeen,
            error: sp.error_message || sp.error,
          };
        });
        
        setPrinters(mappedPrinters);
        setLastUpdate(Date.now());
      } else {
        // API not initialized - use Firebase data
        setError('SimplyPrint not connected');
        setPrinters(initialPrinters);
      }
    } catch (err) {
      console.error('Failed to fetch printers:', err);
      setError('Failed to fetch live data - using cached');
      setPrinters(initialPrinters);
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Fetch on mount
  useEffect(() => {
    fetchLivePrinters(true);
    // Auto-refresh every 30 seconds (no loading spinner)
    const interval = setInterval(() => fetchLivePrinters(false), 30000);
    return () => clearInterval(interval);
  }, []);

  // Update when initialPrinters changes (from Firebase)
  useEffect(() => {
    if (!loading) {
      setPrinters(initialPrinters);
    }
  }, [initialPrinters]);

  const handleRefresh = async () => {
    await fetchLivePrinters();
    if (onRefresh) {
      await onRefresh();
    }
  };

  return (
    <div className="space-y-4">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold sm:text-2xl">Printers</h2>
          <p className="text-xs text-gray-400 sm:text-sm">
            {printers.filter(p => p.status === 'printing').length} printing, {printers.filter(p => p.status === 'operational' || p.status === 'idle').length} ready
          </p>
        </div>
        <div className="flex items-center gap-2">
          {error && (
            <span className="text-xs text-danger">{error}</span>
          )}
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg border border-surface-hover bg-surface px-3 py-2 text-sm hover:bg-surface-hover disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Printer Grid */}
      {printers.length === 0 ? (
        <div className="rounded-xl border border-surface-hover bg-surface p-8 text-center">
          <Printer className="mx-auto mb-4 h-12 w-12 text-gray-600" />
          <p className="text-gray-400">No printers connected</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {printers.map((printer, index) => (
            <PrinterCard key={printer.id} printer={printer} index={index} />
          ))}
        </div>
      )}

      {/* Last update time */}
      {lastUpdate && (
        <p className="text-center text-xs text-gray-500">
          Last updated: {formatTimeAgo(lastUpdate)}
        </p>
      )}
    </div>
  );
}

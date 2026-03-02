interface Printer {
  id: string;
  name: string;
  status: 'operational' | 'printing' | 'error' | 'offline';
  temp: {
    nozzle: number;
    bed: number;
  };
  progress?: number;
  jobName?: string;
  timeRemaining?: string;
  ams?: boolean;
  filaments?: Array<{
    color: string;
    type: string;
    left: number;
  }>;
}

interface PrinterStatusProps {
  printers: Printer[];
}

export function PrinterStatus({ printers }: PrinterStatusProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'bg-success';
      case 'printing': return 'bg-primary';
      case 'error': return 'bg-danger';
      case 'offline': return 'bg-gray-600';
      default: return 'bg-gray-600';
    }
  };

  return (
    <div className="rounded-xl border border-surface-hover bg-surface p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Printers</h2>
        <span className="text-sm text-gray-400">{printers.length} connected</span>
      </div>
      
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {printers.map((printer) => (
          <div
            key={printer.id}
            className="rounded-lg border border-surface-hover bg-background p-4"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-medium">{printer.name}</h3>
                <div className="mt-1 flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${getStatusColor(printer.status)}`} />
                  <span className="text-sm capitalize text-gray-400">{printer.status}</span>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-bold">{printer.temp.nozzle}°</div>
                <div className="text-xs text-gray-500">Nozzle</div>
              </div>
            </div>
            
            {printer.status === 'printing' && printer.progress !== undefined && (
              <div className="mt-4">
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-gray-400">{printer.jobName}</span>
                  <span>{printer.progress}%</span>
                </div>
                <div className="h-2 rounded-full bg-surface">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${printer.progress}%` }}
                  />
                </div>
                {printer.timeRemaining && (
                  <p className="mt-1 text-xs text-gray-500">{printer.timeRemaining} remaining</p>
                )}
              </div>
            )}
            
            {printer.ams && printer.filaments && (
              <div className="mt-4 flex gap-2">
                {printer.filaments.map((filament, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col items-center"
                    title={`${filament.color} ${filament.type} (${filament.left}%)`}
                  >
                    <div
                      className="h-8 w-8 rounded-full border-2 border-surface"
                      style={{ backgroundColor: filament.color.toLowerCase() }}
                    />
                    <span className="mt-1 text-xs text-gray-500">{filament.left}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
        
        {printers.length === 0 && (
          <div className="col-span-full py-8 text-center text-gray-500">
            No printers connected
          </div>
        )}
      </div>
    </div>
  );
}
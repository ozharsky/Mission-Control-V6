import { useState } from 'react';
import { 
  Database, Upload, Download, AlertCircle, CheckCircle2, 
  ArrowRight, RefreshCw, FileJson, FileSpreadsheet 
} from 'lucide-react';
import { setData, getData } from '../lib/firebase';
import { migrateV5ToV6 } from '../lib/migrateV5';
import { exportToCSV, exportToJSON } from '../lib/csv';

interface DataMigrationProps {
  onClose?: () => void;
}

export function DataMigration({ onClose }: DataMigrationProps) {
  const [activeTab, setActiveTab] = useState<'migrate' | 'export' | 'import'>('migrate');
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [migrationResult, setMigrationResult] = useState<any>(null);
  const [v5Data, setV5Data] = useState('');

  const handleMigrate = async () => {
    setIsMigrating(true);
    try {
      // Parse V5 data from textarea
      const data = JSON.parse(v5Data);
      const result = await migrateV5ToV6(data);
      setMigrationResult(result);
      setMigrationStatus('success');
    } catch (err) {
      console.error('Migration failed:', err);
      setMigrationStatus('error');
    }
    setIsMigrating(false);
  };

  const handleExport = async (format: 'json' | 'csv') => {
    try {
      // Fetch all V6 data including jobs, inventory, reports
      const [tasks, projects, revenue, files, jobs, inventory, reports, reportSchedules] = await Promise.all([
        getData('v6/tasks'),
        getData('v6/data/projects'),
        getData('v6/data/revenue'),
        getData('v6/files'),
        getData('v6/jobs'),
        getData('v6/inventory'),
        getData('v6/reports'),
        getData('v6/reportSchedules'),
      ]);

      const data = {
        tasks,
        projects,
        revenue,
        files,
        jobs,
        inventory,
        reports,
        reportSchedules,
        exportedAt: new Date().toISOString(),
        version: 'v6',
      };

      if (format === 'json') {
        exportToJSON(data, `mission-control-backup-${new Date().toISOString().slice(0, 10)}.json`);
      } else {
        // Export each data type as separate CSV
        if (revenue) {
          const revenueArray = Object.entries(revenue).map(([month, val]: [string, any]) => ({
            month,
            revenue: val.value,
            orders: val.orders,
          }));
          exportToCSV(revenueArray, `revenue-${new Date().toISOString().slice(0, 10)}.csv`);
        }
        
        // Export inventory
        if (inventory) {
          const inventoryArray = Object.entries(inventory).map(([id, item]: [string, any]) => ({
            id,
            ...item,
          }));
          exportToCSV(inventoryArray, `inventory-${new Date().toISOString().slice(0, 10)}.csv`);
        }
        
        // Export jobs
        if (jobs) {
          const jobsArray = Object.entries(jobs).map(([id, job]: [string, any]) => ({
            id,
            ...job,
          }));
          exportToCSV(jobsArray, `jobs-${new Date().toISOString().slice(0, 10)}.csv`);
        }
      }
    } catch (err) {
      alert('Export failed: ' + (err as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="flex gap-2 border-b border-surface-hover">
        {[
          { id: 'migrate', label: 'Migrate V5', icon: Database },
          { id: 'export', label: 'Export', icon: Download },
          { id: 'import', label: 'Import', icon: Upload },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Migrate Tab */}
      {activeTab === 'migrate' && (
        <div className="space-y-4">
          <div className="rounded-xl touch-feedback border border-surface-hover bg-surface p-6">
            <h3 className="mb-4 text-lg font-semibold">Migrate from V5</h3>
            
            <p className="mb-4 text-sm text-gray-400">
              Paste your V5 data JSON below to migrate projects, priorities, and tasks to V6.
              You can export V5 data from the browser console or Firebase.
            </p>

            {migrationStatus === 'success' ? (
              <div className="rounded-xl bg-success/10 p-4 text-success">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Migration Complete!</span>
                </div>                
                {migrationResult && (
                  <div className="mt-2 text-sm">
                    <p>Projects: {migrationResult.projects?.length || 0}</p>
                    <p>Priorities: {migrationResult.priorities?.length || 0}</p>
                  </div>
                )}
              </div>
            ) : migrationStatus === 'error' ? (
              <div className="rounded-xl bg-danger/10 p-4 text-danger">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-medium">Migration Failed</span>
                </div>
                <p className="mt-2 text-sm">Check the console for details.</p>
              </div>
            ) : (
              <>
                <textarea
                  value={v5Data}
                  onChange={(e) => setV5Data(e.target.value)}
                  placeholder="Paste V5 JSON data here..."
                  rows={10}
                  className="w-full rounded-xl border border-surface-hover bg-background px-4 py-3 text-white placeholder-gray-500 focus:border-primary focus:outline-none"
                />

                <button
                  onClick={handleMigrate}
                  disabled={!v5Data.trim() || isMigrating}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-white hover:bg-primary-hover disabled:opacity-50"
                >
                  {isMigrating ? (
                    <>
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      Migrating...
                    </>
                  ) : (
                    <>
                      <ArrowRight className="h-5 w-5" />
                      Start Migration
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="space-y-4">
          <div className="rounded-xl touch-feedback border border-surface-hover bg-surface p-6">
            <h3 className="mb-4 text-lg font-semibold">Export Data</h3>
            
            <p className="mb-4 text-sm text-gray-400">
              Download your Mission Control data for backup or analysis.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <button
                onClick={() => handleExport('json')}
                className="flex items-center gap-4 rounded-xl border border-surface-hover bg-background p-4 transition-colors hover:border-primary"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <FileJson className="h-6 w-6 text-primary" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Export as JSON</div>
                  <div className="text-sm text-gray-500">Full backup</div>
                </div>
              </button>

              <button
                onClick={() => handleExport('csv')}
                className="flex items-center gap-4 rounded-xl border border-surface-hover bg-background p-4 transition-colors hover:border-primary"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
                  <FileSpreadsheet className="h-6 w-6 text-success" />
                </div>
                <div className="text-left">
                  <div className="font-medium">Export as CSV</div>
                  <div className="text-sm text-gray-500">Spreadsheet format</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="space-y-4">
          <div className="rounded-xl touch-feedback border border-surface-hover bg-surface p-6">
            <h3 className="mb-4 text-lg font-semibold">Import Data</h3>
            
            <p className="mb-4 text-sm text-gray-400">
              Import data from a previous backup. This will merge with existing data.
            </p>

            <div
              className="cursor-pointer rounded-xl border-2 border-dashed border-surface-hover bg-background p-8 text-center transition-colors hover:border-primary"
            >
              <Upload className="mx-auto mb-2 h-8 w-8 text-gray-500" />
              <p className="text-sm text-gray-400">Click to select JSON backup file</p>
              <p className="text-xs text-gray-600">Or drag and drop</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

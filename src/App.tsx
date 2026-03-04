import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from './stores/appStore';
import { initTheme } from './stores/themeStore';
import { initSimplyPrint, getSimplyPrint } from './lib/simplyprint';
import { db } from './lib/firebase';
import { Navigation } from './components/Navigation';
import { TaskBoard } from './components/TaskBoard';
import { NotificationBell } from './components/NotificationBell';
import { DashboardView } from './components/DashboardView';
import { PrinterStatus } from './components/PrinterStatus';
import { RevenueChart } from './components/RevenueChart';
import { RevenueGoals } from './components/RevenueGoals';
import { ProjectsList } from './components/ProjectsList';
import { CalendarView } from './components/CalendarView';
import { FileManager } from './components/FileManager';
import { SettingsPage } from './components/SettingsPage';
import { ThemeToggleSimple } from './components/ThemeToggle';
import { JobsView } from './components/JobsView';
import { InventoryView } from './components/InventoryView';
import { ReportsView } from './components/ReportsView';
import { AgentTaskList } from './components/agents/AgentTaskList';
import { AgentDocuments } from './components/agents/AgentDocuments';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/Toast';
import { SkeletonCard, SkeletonList } from './components/Loading';

function App() {
  const {
    initSubscriptions,
    tasks,
    notifications,
    unreadCount,
    printers,
    revenue,
    projects,
    jobs,
    inventory,
    reports,
    setPrinters
  } = useAppStore();

  const [activeSection, setActiveSection] = useState('dashboard');
  const [activeAgentTab, setActiveAgentTab] = useState<'tasks' | 'documents'>('tasks');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initSubscriptions();
    initTheme();

    // Simulate initial loading for skeleton display
    const timer = setTimeout(() => setIsLoading(false), 800);

    // Initialize SimplyPrint on app load if API key exists
    const apiKey = localStorage.getItem('simplyprint_api_key');
    const proxyUrl = localStorage.getItem('simplyprint_proxy_url');
    if (apiKey) {
      initSimplyPrint(apiKey, proxyUrl || undefined);

      // Fetch printers immediately
      const fetchPrinters = async () => {
        const api = getSimplyPrint();
        if (api) {
          const printerList = await api.getPrinters();
          console.log('Raw printer data:', printerList);

          // The proxy already returns data in the correct format
          const transformed = printerList.map((printer: any) => {
            return {
              id: printer.id?.toString(),
              name: printer.name || 'Unknown Printer',
              status: printer.status || 'offline',
              temp: printer.temp || 0,
              targetTemp: printer.targetTemp || 0,
              bedTemp: printer.bedTemp || 0,
              targetBedTemp: printer.targetBedTemp || 0,
              job: printer.job ? {
                name: printer.job.file || printer.job.name,
                progress: printer.job.percentage || printer.progress || 0,
                timeLeft: printer.job.time,
                layer: printer.job.layer
              } : undefined,
              lastSeen: new Date().toISOString()
            };
          });
          setPrinters(transformed);
        }
      };

      fetchPrinters();
    }

    return () => clearTimeout(timer);
  }, [initSubscriptions, setPrinters]);

  // Handle both V5 array format and V6 object format
  // V5: [{month: "2025-01", value: 100, orders: 5}, ...]
  // V6: {"2025-01": {value: 100, orders: 5}, ...}
  const revenueData = useMemo(() => {
    if (!revenue) return [];
    
    // If it's an array (V5 format), use it directly
    if (Array.isArray(revenue)) {
      return revenue.sort((a, b) => a.month.localeCompare(b.month));
    }
    
    // If it's an object with numeric keys (0, 1, 2...), convert to YYYY-MM format
    // These represent sequential months starting from Jan 2025
    return Object.entries(revenue).map(([month, data]: [string, any]) => {
      let formattedMonth = month;
      // Check if key is numeric (0, 1, 2...)
      if (/^\d+$/.test(month)) {
        const monthNum = parseInt(month);
        // Month 0 = Jan 2025, 1 = Feb 2025, ..., 11 = Dec 2025, 12 = Jan 2026
        const year = 2025 + Math.floor(monthNum / 12);
        const monthInYear = (monthNum % 12) + 1;
        formattedMonth = `${year}-${String(monthInYear).padStart(2, '0')}`;
      }
      return {
        month: formattedMonth,
        value: data.value || 0,
        orders: data.orders || 0
      };
    }).sort((a, b) => a.month.localeCompare(b.month));
  }, [revenue]);

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return isLoading ? (
          <div className="space-y-4 lg:space-y-6">
            {/* Skeleton Stats */}
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
            
            {/* Skeleton Content */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
              <div className="h-64 rounded-xl border border-surface-hover bg-surface p-4">
                <div className="mb-4 h-6 w-32 rounded bg-surface-hover animate-pulse"></div>
                <div className="space-y-3">
                  <div className="h-16 rounded-lg bg-surface-hover animate-pulse"></div>
                  <div className="h-16 rounded-lg bg-surface-hover animate-pulse"></div>
                  <div className="h-16 rounded-lg bg-surface-hover animate-pulse"></div>
                </div>
              </div>
              <div className="h-64 rounded-xl border border-surface-hover bg-surface p-4">
                <div className="mb-4 h-6 w-32 rounded bg-surface-hover animate-pulse"></div>
                <div className="flex items-end justify-between h-40 px-4">
                  {[...Array(6)].map((_, i) => (
                    <div 
                      key={i} 
                      className="w-8 bg-surface-hover animate-pulse rounded-t"
                      style={{ height: `${Math.random() * 60 + 20}%` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <DashboardView onNavigate={setActiveSection} />
        );

      case 'printers':
        return <PrinterStatus printers={printers} />;

      case 'revenue':
        return (
          <div className="space-y-4 lg:space-y-6">
            <RevenueChart data={revenueData} goal={450} />
            <RevenueGoals 
              currentRevenue={revenueData[revenueData.length - 1]?.value || 0}
              currentOrders={revenueData[revenueData.length - 1]?.orders || 0}
            />
          </div>
        );

      case 'projects':
        return <ProjectsList projects={projects} />;

      case 'tasks':
        return <TaskBoard tasks={tasks} projects={projects.map(p => ({ id: p.id, name: p.name }))} />;

      case 'agents':
        return db ? (
          <div className="space-y-4">
            {/* Agent Tabs */}
            <div className="flex gap-4 border-b border-surface-hover">
              <button
                onClick={() => setActiveAgentTab('tasks')}
                className={`pb-2 text-sm font-medium transition-colors ${
                  activeAgentTab === 'tasks'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Tasks
              </button>
              <button
                onClick={() => setActiveAgentTab('documents')}
                className={`pb-2 text-sm font-medium transition-colors ${
                  activeAgentTab === 'documents'
                    ? 'text-primary border-b-2 border-primary'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Documents
              </button>
            </div>
            
            {activeAgentTab === 'tasks' ? (
              <AgentTaskList firebaseDb={db} onTaskSelect={(id) => console.log('Selected:', id)} />
            ) : (
              <AgentDocuments firebaseDb={db} />
            )}
          </div>
        ) : (
          <div>Firebase not configured</div>
        );

      case 'jobs':
        return <JobsView jobs={jobs} />;

      case 'inventory':
        return <InventoryView items={inventory} />;

      case 'reports':
        return <ReportsView revenue={revenue} tasks={tasks} projects={projects} inventory={inventory} printers={printers} />;

      case 'calendar':
        return <CalendarView events={[]} projects={projects} tasks={tasks} />;

      case 'files':
        return <FileManager />;

      case 'settings':
        return <SettingsPage />;

      default:
        return <div>Section not found</div>;
    }
  };

  return (
    <ErrorBoundary>
      <div className="flex min-h-screen bg-background text-white">
        <Navigation activeSection={activeSection} onSectionChange={setActiveSection} />

        <div className="flex-1 pt-14 lg:ml-0 lg:pt-0">
          {/* Header - hidden on mobile, shown on desktop */}
          <header className="sticky top-14 z-10 border-b border-surface-hover bg-surface/80 px-4 py-3 backdrop-blur lg:top-0 lg:px-6 lg:py-4 hidden lg:block">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
                  🚀
                </div>
                <div>
                  <h1 className="text-xl font-bold">Mission Control</h1>
                  <p className="text-sm text-gray-400">V6</p>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <ThemeToggleSimple />
                <NotificationBell count={unreadCount} notifications={notifications} />
              </div>
            </div>
          </header>

          <main className="p-4 pb-28 lg:p-6 lg:pb-6">
            <div className="mx-auto max-w-7xl">
              {renderSection()}
            </div>
          </main>
        </div>
      </div>
      <ToastContainer />
    </ErrorBoundary>
  );
}

export default App;
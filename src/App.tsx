import { useEffect, useState } from 'react';
import { useAppStore } from './stores/appStore';
import { initTheme } from './stores/themeStore';
import { initSimplyPrint, getSimplyPrint } from './lib/simplyprint';
import { Navigation } from './components/Navigation';
import { AgentPanel } from './components/AgentPanel';
import { TaskBoard } from './components/TaskBoard';
import { NotificationBell } from './components/NotificationBell';
import { DashboardStats } from './components/DashboardStats';
import { PrinterStatus } from './components/PrinterStatus';
import { RevenueChart } from './components/RevenueChart';
import { RevenueGoals } from './components/RevenueGoals';
import { ProjectsList } from './components/ProjectsList';
import { CalendarView } from './components/CalendarView';
import { FileManager } from './components/FileManager';
import { SettingsPage } from './components/SettingsPage';
import { ThemeToggleSimple } from './components/ThemeToggle';

function App() {
  const {
    initSubscriptions,
    agent,
    tasks,
    notifications,
    unreadCount,
    printers,
    revenue,
    projects,
    setPrinters
  } = useAppStore();

  const [activeSection, setActiveSection] = useState('dashboard');

  useEffect(() => {
    initSubscriptions();
    initTheme();

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
    
    // If it's an object with numeric keys, convert to YYYY-MM format
    return Object.entries(revenue).map(([month, data]: [string, any]) => {
      let formattedMonth = month;
      // Check if key is numeric (0, 1, 2...)
      if (/^\d+$/.test(month)) {
        const monthNum = parseInt(month);
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
        return (
          <div className="space-y-4 lg:space-y-6">
            <DashboardStats 
              pendingTasks={tasks.pending.length}
              inProgressTasks={tasks.inProgress.length}
              completedTasks={tasks.completed.length}
            />
            
            {/* Mobile: Stack vertically, Desktop: Side by side */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
              <PrinterStatus printers={printers} />
              <RevenueChart data={revenueData} goal={450} />
            </div>
            
            {/* Quick Tasks Preview */}
            <div className="rounded-xl border border-surface-hover bg-surface p-4 lg:p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">Recent Tasks</h3>
                <button 
                  onClick={() => setActiveSection('tasks')}
                  className="text-sm text-primary hover:underline"
                >
                  View All
                </button>
              </div>
              
              <div className="space-y-2">
                {tasks.pending.slice(0, 3).map(task => (
                  <div 
                    key={task.id}
                    className="flex items-center gap-3 rounded-lg bg-background p-3"
                  >
                    <div className={`h-2 w-2 rounded-full ${
                      task.priority === 'high' ? 'bg-danger' :
                      task.priority === 'medium' ? 'bg-warning' : 'bg-gray-500'
                    }`} />
                    <span className="flex-1 text-sm truncate">{task.title}</span>
                    {task.assignee && (
                      <span className="text-xs text-gray-500">{task.assignee}</span>
                    )}
                  </div>
                ))}
                {tasks.pending.length === 0 && (
                  <div className="py-4 text-center text-sm text-gray-500">
                    No pending tasks
                  </div>
                )}
              </div>
            </div>
          </div>
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

      case 'calendar':
        return <CalendarView events={[]} />;

      case 'files':
        return <FileManager />;

      case 'agent':
        return <AgentPanel />;

      case 'settings':
        return <SettingsPage />;

      default:
        return <div>Section not found</div>;
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-white">
      <Navigation activeSection={activeSection} onSectionChange={setActiveSection} />

      <div className="flex-1 pt-14 lg:ml-0 lg:pt-0">
        <header className="sticky top-14 z-10 border-b border-surface-hover bg-surface/80 px-4 py-3 backdrop-blur lg:top-0 lg:px-6 lg:py-4">
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
              <div className="hidden items-center gap-2 sm:flex">
                <div className={`h-2 w-2 rounded-full ${agent?.status === 'online' ? 'bg-success' : 'bg-gray-500'}`} />
                <span className="text-sm text-gray-400">
                  {agent?.status === 'online' ? 'Agent Online' : 'Agent Offline'}
                </span>
              </div>
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
  );
}

export default App;
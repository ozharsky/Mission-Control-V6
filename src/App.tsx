import { useEffect, useState } from 'react';
import { useAppStore } from './stores/appStore';
import { Navigation } from './components/Navigation';
import { AgentPanel } from './components/AgentPanel';
import { TaskBoard } from './components/TaskBoard';
import { NotificationBell } from './components/NotificationBell';
import { DashboardStats } from './components/DashboardStats';
import { PrinterStatus } from './components/PrinterStatus';
import { RevenueChart } from './components/RevenueChart';
import { ProjectsList } from './components/ProjectsList';
import { CalendarView } from './components/CalendarView';
import { FileManager } from './components/FileManager';
import { SettingsPage } from './components/SettingsPage';

function App() {
  const { 
    initSubscriptions, 
    agent, 
    tasks, 
    notifications, 
    unreadCount, 
    printers, 
    revenue,
    projects 
  } = useAppStore();
  
  const [activeSection, setActiveSection] = useState('dashboard');

  useEffect(() => {
    initSubscriptions();
  }, []);

  const revenueData = revenue ? Object.entries(revenue).map(([month, data]: [string, any]) => ({
    month,
    value: data.value || 0,
    orders: data.orders || 0
  })) : [];

  const renderSection = () => {
    switch (activeSection) {
      case 'dashboard':
        return (
          <div className="space-y-6">
            {agent && <AgentPanel agent={agent} />}
            <DashboardStats 
              pendingTasks={tasks.pending.length}
              inProgressTasks={tasks.inProgress.length}
              completedTasks={tasks.completed.length}
            />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              <PrinterStatus printers={printers} />
              <RevenueChart data={revenueData} goal={450} />
            </div>
            <TaskBoard tasks={tasks} />
          </div>
        );
      
      case 'printers':
        return <PrinterStatus printers={printers} />;
      
      case 'revenue':
        return <RevenueChart data={revenueData} goal={450} />;
      
      case 'projects':
        return <ProjectsList projects={projects} />;
      
      case 'tasks':
        return <TaskBoard tasks={tasks} />;
      
      case 'calendar':
        return <CalendarView events={[]} />;
      
      case 'files':
        return <FileManager />;
      
      case 'settings':
        return <SettingsPage />;
      
      default:
        return <div>Section not found</div>;
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-white">
      <Navigation activeSection={activeSection} onSectionChange={setActiveSection} />
      
      <div className="flex-1 lg:ml-0">
        <header className="sticky top-0 z-10 border-b border-surface-hover bg-surface/80 px-6 py-4 backdrop-blur">
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

        <main className="p-6 pb-24 lg:pb-6">
          <div className="mx-auto max-w-7xl">
            {renderSection()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
import { useEffect } from 'react';
import { useAppStore } from './stores/appStore';
import { AgentPanel } from './components/AgentPanel';
import { TaskBoard } from './components/TaskBoard';
import { NotificationBell } from './components/NotificationBell';
import { DashboardStats } from './components/DashboardStats';

function App() {
  const { initSubscriptions, agent, tasks, notifications, unreadCount } = useAppStore();

  useEffect(() => {
    initSubscriptions();
  }, []);

  return (
    <div className="min-h-screen bg-background text-white">
      {/* Header */}
      <header className="border-b border-surface-hover bg-surface px-6 py-4">
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
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${agent?.status === 'online' ? 'bg-success' : 'bg-gray-500'}`} />
              <span className="text-sm text-gray-400">
                {agent?.status === 'online' ? 'Agent Online' : 'Agent Offline'}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Agent Status */}
          {agent && <AgentPanel agent={agent} />}
          
          {/* Stats */}
          <DashboardStats 
            pendingTasks={tasks.pending.length}
            inProgressTasks={tasks.inProgress.length}
            completedTasks={tasks.completed.length}
          />
          
          {/* Task Board */}
          <TaskBoard tasks={tasks} />
        </div>
      </main>
    </div>
  );
}

export default App;
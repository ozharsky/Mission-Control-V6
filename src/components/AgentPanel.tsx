import { useState, useEffect, useRef } from 'react';
import { 
  Bot, User, MessageSquare, CheckCircle, Clock, AlertCircle, 
  Activity, Cpu, Database, RefreshCw, Settings, Terminal,
  ChevronRight, Send, Plus, Circle
} from 'lucide-react';
import { useAppStore } from '../stores/appStore';
import { setData, subscribeToData } from '../lib/firebase';

interface AgentMessage {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: string;
  type?: 'task' | 'question' | 'status' | 'error';
}

interface AgentTask {
  id: string;
  title: string;
  status: 'pending' | 'in-progress' | 'completed' | 'error';
  priority: 'low' | 'medium' | 'high';
  createdAt: string;
  completedAt?: string;
  result?: string;
}

interface AgentMetrics {
  tasksCompleted: number;
  tasksInProgress: number;
  uptime: number;
  lastActivity: string;
  model: string;
  version: string;
}

// Agent Command Types
interface AgentCommand {
  type: 'task' | 'query' | 'status' | 'settings';
  payload: any;
}

export function AgentPanel() {
  const { agent, tasks, addTask } = useAppStore();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [metrics, setMetrics] = useState<AgentMetrics>({
    tasksCompleted: 0,
    tasksInProgress: 0,
    uptime: 0,
    lastActivity: new Date().toISOString(),
    model: 'kimi-coding/k2p5',
    version: '1.0.0'
  });
  const [activeTab, setActiveTab] = useState<'chat' | 'tasks' | 'metrics' | 'logs'>('chat');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load messages from Firebase on mount
  useEffect(() => {
    // Subscribe to agent messages
    const unsubscribe = subscribeToData('v6/agent/messages', (data) => {
      if (data) {
        const msgArray = Object.values(data) as AgentMessage[];
        setMessages(msgArray.sort((a, b) => 
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        ));
      }
    });

    // Subscribe to agent tasks
    const unsubscribeTasks = subscribeToData('v6/agent/tasks', (data) => {
      if (data) {
        const taskArray = Object.values(data) as AgentTask[];
        setAgentTasks(taskArray);
      }
    });

    return () => {
      unsubscribe();
      unsubscribeTasks();
    };
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!inputMessage.trim()) return;

    const messageId = Date.now().toString();
    const userMsg: AgentMessage = {
      id: messageId,
      role: 'user',
      content: inputMessage,
      timestamp: new Date().toISOString(),
      type: 'question',
    };

    // Save message to Firebase
    await setData(`v6/agent/messages/${messageId}`, userMsg);
    
    // Create a request for the agent to pick up
    await setData('v6/agent/requests/latest', {
      message: inputMessage,
      timestamp: Date.now(),
      status: 'pending',
      messageId: messageId,
      source: 'mission-control-v6'
    });

    setInputMessage('');
  };

  const createAgentTask = async (title: string, priority: AgentTask['priority'] = 'medium') => {
    const task: AgentTask = {
      id: Date.now().toString(),
      title,
      status: 'pending',
      priority,
      createdAt: new Date().toISOString(),
    };

    setAgentTasks(prev => [...prev, task]);

    // Also create as regular task
    await addTask({
      title: `[Agent] ${title}`,
      priority,
      status: 'pending',
      createdBy: 'agent',
      createdAt: new Date().toISOString(),
      tags: ['agent-task'],
    });

    // Notify agent
    await setData('v6/agent/tasks', {
      id: task.id,
      title: task.title,
      priority: task.priority,
      status: 'pending',
      timestamp: Date.now(),
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <Activity className="h-5 w-5 text-success" />;
      case 'busy': return <Cpu className="h-5 w-5 text-warning animate-pulse" />;
      case 'offline': return <AlertCircle className="h-5 w-5 text-gray-500" />;
      default: return <Activity className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Agent Status Card */}
      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
              <Bot className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">KimiClaw</h1>
              <div className="flex items-center gap-2">
                {getStatusIcon(agent?.status || 'offline')}
                <span className="text-sm text-gray-400 capitalize">
                  {agent?.status || 'Offline'}
                </span>
                <span className="text-gray-600">•</span>
                <span className="text-sm text-gray-500">{metrics.model}</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              onClick={() => createAgentTask('Check system status', 'low')}
              className="flex items-center gap-2 rounded-xl border border-surface-hover px-4 py-2 text-sm hover:bg-surface-hover"
            >
              <RefreshCw className="h-4 w-4" />
              Health Check
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className="flex items-center gap-2 rounded-xl border border-surface-hover px-4 py-2 text-sm hover:bg-surface-hover"
            >
              <Settings className="h-4 w-4" />
              Configure
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className="rounded-xl bg-surface-hover p-4">
            <div className="text-2xl font-bold text-success">{metrics.tasksCompleted}</div>
            <div className="text-xs text-gray-500">Tasks Completed</div>
          </div>
          <div className="rounded-xl bg-surface-hover p-4">
            <div className="text-2xl font-bold text-primary">{metrics.tasksInProgress}</div>
            <div className="text-xs text-gray-500">In Progress</div>
          </div>
          <div className="rounded-xl bg-surface-hover p-4">
            <div className="text-2xl font-bold">{Math.floor(metrics.uptime / 60)}m</div>
            <div className="text-xs text-gray-500">Uptime</div>
          </div>
          <div className="rounded-xl bg-surface-hover p-4">
            <div className="text-2xl font-bold">{messages.length}</div>
            <div className="text-xs text-gray-500">Messages</div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-surface-hover">
        {[
          { id: 'chat', label: 'Chat', icon: MessageSquare },
          { id: 'tasks', label: 'Agent Tasks', icon: CheckCircle },
          { id: 'metrics', label: 'Metrics', icon: Activity },
          { id: 'logs', label: 'Logs', icon: Terminal },
        ].map(tab => (
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

      {/* Tab Content */}
      <div className="rounded-2xl border border-surface-hover bg-surface p-6">
        {activeTab === 'chat' && (
          <div className="space-y-4">
            {/* Messages */}
            <div className="h-96 space-y-4 overflow-y-auto rounded-xl bg-background p-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-gray-500">
                  <Bot className="mb-2 h-12 w-12 opacity-50" />
                  <p>Start a conversation with KimiClaw</p>
                  <p className="text-sm">Ask me to analyze data, create tasks, or help with decisions</p>
                </div>
              ) : (
                <>
                  {messages.map(msg => (
                    <div
                      key={msg.id}
                      className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
                    >
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${
                        msg.role === 'user' ? 'bg-blue-500/20' : 'bg-primary/20'
                      }`}>
                        {msg.role === 'user' ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
                      </div>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                        msg.role === 'user' 
                          ? 'bg-primary text-white' 
                          : 'bg-surface-hover'
                      }`}>
                        <p>{msg.content}</p>
                        <span className="text-xs opacity-50">
                          {new Date(msg.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>

            {/* Input */}
            <div className="flex gap-3">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Ask KimiClaw to do something..."
                className="flex-1 rounded-xl border border-surface-hover bg-background px-4 py-3 text-white placeholder-gray-500 focus:border-primary focus:outline-none"
              />
              <button
                onClick={sendMessage}
                className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-white hover:bg-primary-hover"
              >
                <Send className="h-4 w-4" />
                Send
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex flex-wrap gap-2">
              {[
                'Analyze revenue trends',
                'Check printer status',
                'Review overdue tasks',
                'Generate weekly report',
                'Optimize etsy listings',
              ].map(action => (
                <button
                  key={action}
                  onClick={() => {
                    setInputMessage(action);
                    createAgentTask(action, 'medium');
                  }}
                  className="rounded-full border border-surface-hover px-3 py-1 text-xs text-gray-400 hover:border-primary hover:text-primary"
                >
                  {action}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-3">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-semibold">Agent Task Queue</h3>
              <button
                onClick={() => createAgentTask('New analysis task')}
                className="flex items-center gap-2 rounded-lg bg-primary px-3 py-1.5 text-sm text-white"
              >
                <Plus className="h-4 w-4" />
                Add Task
              </button>
            </div>

            {agentTasks.map(task => (
              <div
                key={task.id}
                className="flex items-center gap-4 rounded-xl border border-surface-hover bg-background p-4"
              >
                {task.status === 'completed' && <CheckCircle className="h-5 w-5 text-success" />}
                {task.status === 'in-progress' && <Clock className="h-5 w-5 text-warning animate-spin" />}
                {task.status === 'pending' && <Circle className="h-5 w-5 text-gray-500" />}
                {task.status === 'error' && <AlertCircle className="h-5 w-5 text-danger" />}
                
                <div className="flex-1">
                  <p className="font-medium">{task.title}</p>
                  <p className="text-xs text-gray-500">
                    {task.status} • {task.priority} priority
                  </p>
                </div>

                {task.result && (
                  <button className="text-primary hover:underline">
                    View Result
                  </button>
                )}
              </div>
            ))}

            {agentTasks.length === 0 && (
              <div className="py-8 text-center text-gray-500">
                No agent tasks yet. Create one from chat or quick actions.
              </div>
            )}
          </div>
        )}

        {activeTab === 'metrics' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-xl bg-surface-hover p-4">
                <label className="text-sm text-gray-500">Model</label>
                <p className="text-lg font-medium">{metrics.model}</p>
              </div>
              <div className="rounded-xl bg-surface-hover p-4">
                <label className="text-sm text-gray-500">Version</label>
                <p className="text-lg font-medium">{metrics.version}</p>
              </div>
              <div className="rounded-xl bg-surface-hover p-4">
                <label className="text-sm text-gray-500">Last Activity</label>
                <p className="text-lg font-medium">
                  {new Date(metrics.lastActivity).toLocaleTimeString()}
                </p>
              </div>
              <div className="rounded-xl bg-surface-hover p-4">
                <label className="text-sm text-gray-500">Response Time</label>
                <p className="text-lg font-medium">~&lt;2s</p>
              </div>
            </div>

            <div className="rounded-xl bg-surface-hover p-4">
              <h4 className="mb-3 font-medium">Capabilities</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {[
                  '✅ Task management',
                  '✅ Data analysis',
                  '✅ Printer monitoring',
                  '✅ Revenue tracking',
                  '✅ File management',
                  '✅ Project planning',
                  '✅ Calendar events',
                  '✅ Notifications',
                ].map(cap => (
                  <div key={cap} className="text-gray-400">{cap}</div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'logs' && (
          <div className="font-mono text-sm">
            <div className="mb-2 text-gray-500">[2026-03-03 05:25:00] Agent initialized</div>
            <div className="mb-2 text-gray-500">[2026-03-03 05:25:01] Connected to Firebase</div>
            <div className="mb-2 text-gray-500">[2026-03-03 05:25:02] Loaded 3 printers from SimplyPrint</div>
            <div className="mb-2 text-success">[2026-03-03 05:25:05] Ready for commands</div>
          </div>
        )}
      </div>
    </div>
  );
}
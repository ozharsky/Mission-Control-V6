import { useState, useEffect } from 'react';
import {
  Menu, X, LayoutDashboard, Printer, CircleDollarSign,
  FolderKanban, CheckSquare, Briefcase, Package, BarChart3,
  Calendar, Paperclip, Settings, Rocket, Bot, Sun, Moon, Bell,
  TrendingUp
} from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';
import { useAppStore } from '../stores/appStore';

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'printers', label: 'Printers', icon: Printer },
  { id: 'revenue', label: 'Revenue', icon: CircleDollarSign },
  { id: 'trades', label: 'Kalshi Trading', icon: TrendingUp },
  { id: 'projects', label: 'Projects', icon: FolderKanban },
  { id: 'tasks', label: 'Tasks', icon: CheckSquare },
  { id: 'agents', label: 'Agent Tasks', icon: Bot },
  { id: 'jobs', label: 'Jobs', icon: Briefcase },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'files', label: 'Files', icon: Paperclip },
  { id: 'settings', label: 'Settings', icon: Settings },
];

// Primary items for bottom nav (most used)
const primaryNavItems = ['dashboard', 'tasks', 'agents', 'projects', 'settings'];

export function Navigation({ activeSection, onSectionChange }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { theme, toggleTheme } = useThemeStore();
  const { notifications } = useAppStore();
  
  const unreadCount = notifications.filter(n => !n.read).length;

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close menu when section changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [activeSection]);

  const primaryItems = navItems.filter(item => primaryNavItems.includes(item.id));
  const secondaryItems = navItems.filter(item => !primaryNavItems.includes(item.id));

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden w-64 flex-col border-r border-surface-hover bg-surface lg:flex">
        <nav className="flex-1 p-4">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => onSectionChange(item.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors min-h-[44px] ${
                      activeSection === item.id
                        ? 'bg-primary text-white'
                        : 'text-gray-400 hover:bg-surface-hover hover:text-white'
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>
      </aside>

      {/* Mobile Header */}
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b border-surface-hover bg-surface px-4 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Rocket className="h-5 w-5 text-white" />
          </div>
          <div>
            <span className="font-bold">Mission Control</span>
            <span className="text-xs text-gray-400 ml-1">V6</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-hover hover:text-white"
            aria-label="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          
          {/* Notification Bell */}
          <button
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-hover hover:text-white relative"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
          
          {/* Menu Button */}
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-hover hover:text-white min-h-[44px] min-w-[44px]"
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <>
          <div 
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          />
          <nav className="fixed left-0 right-0 top-14 z-50 border-b border-surface-hover bg-surface p-4 lg:hidden">
            <div className="mb-2 text-xs font-medium uppercase text-gray-500">Menu</div>
            <ul className="space-y-1">
              {secondaryItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.id}>
                    <button
                      onClick={() => onSectionChange(item.id)}
                      className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors min-h-[44px] ${
                        activeSection === item.id
                          ? 'bg-primary text-white'
                          : 'text-gray-400 hover:bg-surface-hover hover:text-white'
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                      <span>{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
        </>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-surface-hover bg-surface pb-safe lg:hidden">
        <div className="flex items-center justify-around">
          {primaryItems.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={`flex flex-1 flex-col items-center gap-1 py-3 transition-colors min-h-[64px] justify-center ${
                  activeSection === item.id
                    ? 'text-primary'
                    : 'text-gray-400'
                }`}
              >
                <Icon className="h-6 w-6" />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
}

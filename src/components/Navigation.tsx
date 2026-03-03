import { useState, useEffect } from 'react';
import { Menu, X, ChevronLeft, ChevronRight } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

interface NavigationProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: '📊' },
  { id: 'printers', label: 'Printers', icon: '🖨️' },
  { id: 'revenue', label: 'Revenue', icon: '💰' },
  { id: 'projects', label: 'Projects', icon: '📁' },
  { id: 'tasks', label: 'Tasks', icon: '✅' },
  { id: 'jobs', label: 'Jobs', icon: '💼' },
  { id: 'inventory', label: 'Inventory', icon: '📦' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'files', label: 'Files', icon: '📎' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

// Primary items for bottom nav (most used)
const primaryNavItems = ['dashboard', 'tasks', 'projects', 'inventory', 'settings'];

export function Navigation({ activeSection, onSectionChange }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

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
            {navItems.map((item) => (
              <li key={item.id}>
                <button
                  onClick={() => onSectionChange(item.id)}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
                    activeSection === item.id
                      ? 'bg-primary text-white'
                      : 'text-gray-400 hover:bg-surface-hover hover:text-white'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      {/* Mobile Header */}
      <header className="fixed left-0 right-0 top-0 z-50 flex h-14 items-center justify-between border-b border-surface-hover bg-surface px-4 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <span className="text-lg">🚀</span>
          </div>
          <span className="font-bold">Mission Control</span>
        </div>
        
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-gray-400 hover:bg-surface-hover hover:text-white"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
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
              {secondaryItems.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => onSectionChange(item.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left transition-colors ${
                      activeSection === item.id
                        ? 'bg-primary text-white'
                        : 'text-gray-400 hover:bg-surface-hover hover:text-white'
                    }`}
                  >
                    <span className="text-xl">{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </>
      )}

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-surface-hover bg-surface pb-safe lg:hidden">
        <div className="flex items-center justify-around">
          {primaryItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`flex flex-1 flex-col items-center gap-1 py-3 transition-colors min-h-[64px] justify-center ${
                activeSection === item.id
                  ? 'text-primary'
                  : 'text-gray-400'
              }`}
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}

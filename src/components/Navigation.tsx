import { useState } from 'react';

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
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'files', label: 'Files', icon: '📎' },
  { id: 'agent', label: 'Agent', icon: '🤖' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

export function Navigation({ activeSection, onSectionChange }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

      {/* Mobile Bottom Nav */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-surface-hover bg-surface lg:hidden">
        <div className="flex items-center justify-around p-2">
          {navItems.slice(0, 5).map((item) => (
            <button
              key={item.id}
              onClick={() => onSectionChange(item.id)}
              className={`flex flex-col items-center gap-1 rounded-lg p-2 ${
                activeSection === item.id
                  ? 'text-primary'
                  : 'text-gray-400'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-xs">{item.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </>
  );
}
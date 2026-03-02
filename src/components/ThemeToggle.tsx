import { Sun, Moon, Monitor } from 'lucide-react';
import { useThemeStore, Theme } from '../stores/themeStore';

const themes: { id: Theme; label: string; icon: typeof Sun }[] = [
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'dark', label: 'Dark', icon: Moon },
  { id: 'system', label: 'System', icon: Monitor },
];

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  return (
    <div className="flex items-center gap-2 rounded-xl border border-surface-hover bg-surface p-1">
      {themes.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setTheme(id)}
          className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
            theme === id
              ? 'bg-primary text-white shadow-lg'
              : 'text-gray-400 hover:text-white hover:bg-surface-hover'
          }`}
          title={label}
        >
          <Icon className="h-4 w-4"></Icon>
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}

export function ThemeToggleSimple() {
  const { theme, toggleTheme } = useThemeStore();

  return (
    <button
      onClick={toggleTheme}
      className="flex h-10 w-10 items-center justify-center rounded-xl border border-surface-hover bg-surface text-gray-400 transition-all hover:text-white hover:bg-surface-hover"
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {theme === 'dark' ? (
        <Sun className="h-5 w-5"></Sun>
      ) : (
        <Moon className="h-5 w-5"></Moon>
      )}
    </button>
  );
}
import { create } from 'zustand';

export type ThemeName = 'slate' | 'emerald' | 'indigo' | 'rose' | 'amber' | 'cyan' | 'purple';

export interface ThemeOption {
  id: ThemeName;
  name: string;
  isDark: boolean;
  color: string;
  badgeClass: string;
  description: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: 'emerald',
    name: 'Emerald Green (HTTPeek)',
    isDark: false,
    color: '#059669',
    badgeClass: 'bg-emerald-500',
    description: 'Crisp, high-contrast light theme with signature HTTPeek emerald accents',
  },
  {
    id: 'slate',
    name: 'Obsidian Dark (Cyberpunk)',
    isDark: true,
    color: '#0f172a',
    badgeClass: 'bg-slate-800',
    description: 'Deep midnight dark theme designed for low-light developer workflows',
  },
  {
    id: 'indigo',
    name: 'Deep Indigo',
    isDark: false,
    color: '#4f46e5',
    badgeClass: 'bg-indigo-600',
    description: 'Modern indigo palette with elegant oceanic gradients and accents',
  },
  {
    id: 'rose',
    name: 'Crimson Rose',
    isDark: false,
    color: '#e11d48',
    badgeClass: 'bg-rose-600',
    description: 'Vibrant crimson theme with high-visibility status indicators',
  },
  {
    id: 'amber',
    name: 'Solar Amber',
    isDark: false,
    color: '#d97706',
    badgeClass: 'bg-amber-500',
    description: 'Warm solar amber accents with high readability',
  },
  {
    id: 'cyan',
    name: 'Cyber Cyan',
    isDark: false,
    color: '#0891b2',
    badgeClass: 'bg-cyan-600',
    description: 'Cool cyan theme inspired by futuristic debugging terminals',
  },
];

interface ThemeStore {
  theme: ThemeName;
  isDark: boolean;
  monacoTheme: 'vs' | 'vs-dark';
  setTheme: (theme: ThemeName) => void;
  toggleDarkMode: () => void;
}

const applyThemeToDOM = (theme: ThemeName) => {
  if (typeof document === 'undefined') return;

  document.documentElement.setAttribute('data-theme', theme);
  const isDark = theme === 'slate';

  if (isDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
};

const getInitialTheme = (): ThemeName => {
  if (typeof localStorage !== 'undefined') {
    const saved = localStorage.getItem('httpeek_theme') as ThemeName;
    if (saved && THEME_OPTIONS.some((t) => t.id === saved)) {
      return saved;
    }
  }
  return 'emerald';
};

export const useThemeStore = create<ThemeStore>((set, get) => {
  const initialTheme = getInitialTheme();
  applyThemeToDOM(initialTheme);

  return {
    theme: initialTheme,
    isDark: initialTheme === 'slate',
    monacoTheme: initialTheme === 'slate' ? 'vs-dark' : 'vs',

    setTheme: (theme: ThemeName) => {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('httpeek_theme', theme);
      }
      applyThemeToDOM(theme);
      const isDark = theme === 'slate';
      set({
        theme,
        isDark,
        monacoTheme: isDark ? 'vs-dark' : 'vs',
      });
    },

    toggleDarkMode: () => {
      const current = get().theme;
      const nextTheme = current === 'slate' ? 'emerald' : 'slate';
      get().setTheme(nextTheme);
    },
  };
});

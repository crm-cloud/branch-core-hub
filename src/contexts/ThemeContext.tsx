import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeId = 'default' | 'emerald' | 'rose' | 'amber' | 'slate' | 'ocean';

interface ThemeDefinition {
  id: ThemeId;
  name: string;
  preview: string; // CSS color for preview swatch
  vars: Record<string, string>;
}

const THEMES: ThemeDefinition[] = [
  {
    id: 'default',
    name: 'Indigo',
    preview: 'hsl(222 47% 11%)',
    vars: {
      '--primary': '222 47% 11%',
      '--primary-foreground': '210 40% 98%',
      '--accent': '24 95% 53%',
      '--accent-foreground': '0 0% 100%',
      '--ring': '24 95% 53%',
      '--sidebar-background': '222 47% 11%',
      '--sidebar-primary': '24 95% 53%',
      '--sidebar-accent': '222 47% 18%',
      '--sidebar-border': '222 47% 18%',
      '--sidebar-ring': '24 95% 53%',
    },
  },
  {
    id: 'emerald',
    name: 'Emerald',
    preview: 'hsl(160 84% 39%)',
    vars: {
      '--primary': '160 84% 39%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '160 84% 39%',
      '--accent-foreground': '0 0% 100%',
      '--ring': '160 84% 39%',
      '--sidebar-background': '160 50% 12%',
      '--sidebar-primary': '160 84% 45%',
      '--sidebar-accent': '160 40% 18%',
      '--sidebar-border': '160 40% 18%',
      '--sidebar-ring': '160 84% 45%',
    },
  },
  {
    id: 'rose',
    name: 'Rose',
    preview: 'hsl(346 77% 50%)',
    vars: {
      '--primary': '346 77% 50%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '346 77% 50%',
      '--accent-foreground': '0 0% 100%',
      '--ring': '346 77% 50%',
      '--sidebar-background': '346 30% 12%',
      '--sidebar-primary': '346 77% 55%',
      '--sidebar-accent': '346 25% 18%',
      '--sidebar-border': '346 25% 18%',
      '--sidebar-ring': '346 77% 55%',
    },
  },
  {
    id: 'amber',
    name: 'Amber',
    preview: 'hsl(38 92% 50%)',
    vars: {
      '--primary': '38 92% 50%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '38 92% 50%',
      '--accent-foreground': '0 0% 100%',
      '--ring': '38 92% 50%',
      '--sidebar-background': '38 30% 10%',
      '--sidebar-primary': '38 92% 55%',
      '--sidebar-accent': '38 25% 16%',
      '--sidebar-border': '38 25% 16%',
      '--sidebar-ring': '38 92% 55%',
    },
  },
  {
    id: 'slate',
    name: 'Slate',
    preview: 'hsl(215 20% 40%)',
    vars: {
      '--primary': '215 20% 40%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '215 20% 40%',
      '--accent-foreground': '0 0% 100%',
      '--ring': '215 20% 40%',
      '--sidebar-background': '215 20% 10%',
      '--sidebar-primary': '215 20% 50%',
      '--sidebar-accent': '215 18% 16%',
      '--sidebar-border': '215 18% 16%',
      '--sidebar-ring': '215 20% 50%',
    },
  },
  {
    id: 'ocean',
    name: 'Ocean',
    preview: 'hsl(199 89% 48%)',
    vars: {
      '--primary': '199 89% 48%',
      '--primary-foreground': '0 0% 100%',
      '--accent': '199 89% 48%',
      '--accent-foreground': '0 0% 100%',
      '--ring': '199 89% 48%',
      '--sidebar-background': '199 40% 10%',
      '--sidebar-primary': '199 89% 52%',
      '--sidebar-accent': '199 30% 16%',
      '--sidebar-border': '199 30% 16%',
      '--sidebar-ring': '199 89% 52%',
    },
  },
];

interface ThemeContextValue {
  currentTheme: ThemeId;
  setTheme: (id: ThemeId) => void;
  themes: ThemeDefinition[];
}

const ThemeContext = createContext<ThemeContextValue>({
  currentTheme: 'default',
  setTheme: () => {},
  themes: THEMES,
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => {
    return (localStorage.getItem('incline-theme') as ThemeId) || 'default';
  });

  useEffect(() => {
    const theme = THEMES.find((t) => t.id === currentTheme);
    if (!theme) return;

    const root = document.documentElement;
    Object.entries(theme.vars).forEach(([key, value]) => {
      root.style.setProperty(key, value);
    });

    localStorage.setItem('incline-theme', currentTheme);
  }, [currentTheme]);

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme: setCurrentTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

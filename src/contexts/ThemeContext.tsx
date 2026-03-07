import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type ThemeId = 'default' | 'emerald' | 'rose' | 'amber' | 'slate' | 'ocean';
export type SidebarMode = 'light' | 'dark';

interface ThemeDefinition {
  id: ThemeId;
  name: string;
  preview: string;
  vars: Record<string, string>;
  lightSidebarVars: Record<string, string>;
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
      '--sidebar-foreground': '210 40% 98%',
      '--sidebar-primary': '24 95% 53%',
      '--sidebar-primary-foreground': '0 0% 100%',
      '--sidebar-accent': '222 47% 18%',
      '--sidebar-accent-foreground': '210 40% 98%',
      '--sidebar-border': '222 47% 18%',
      '--sidebar-ring': '24 95% 53%',
    },
    lightSidebarVars: {
      '--sidebar-background': '0 0% 100%',
      '--sidebar-foreground': '222 47% 11%',
      '--sidebar-primary': '222 47% 11%',
      '--sidebar-primary-foreground': '0 0% 100%',
      '--sidebar-accent': '210 20% 96%',
      '--sidebar-accent-foreground': '222 47% 11%',
      '--sidebar-border': '214 32% 91%',
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
      '--sidebar-foreground': '0 0% 95%',
      '--sidebar-primary': '160 84% 45%',
      '--sidebar-primary-foreground': '0 0% 100%',
      '--sidebar-accent': '160 40% 18%',
      '--sidebar-accent-foreground': '0 0% 95%',
      '--sidebar-border': '160 40% 18%',
      '--sidebar-ring': '160 84% 45%',
    },
    lightSidebarVars: {
      '--sidebar-background': '0 0% 100%',
      '--sidebar-foreground': '160 50% 12%',
      '--sidebar-primary': '160 84% 39%',
      '--sidebar-primary-foreground': '0 0% 100%',
      '--sidebar-accent': '160 20% 96%',
      '--sidebar-accent-foreground': '160 50% 12%',
      '--sidebar-border': '160 20% 90%',
      '--sidebar-ring': '160 84% 39%',
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
      '--sidebar-foreground': '0 0% 95%',
      '--sidebar-primary': '346 77% 55%',
      '--sidebar-primary-foreground': '0 0% 100%',
      '--sidebar-accent': '346 25% 18%',
      '--sidebar-accent-foreground': '0 0% 95%',
      '--sidebar-border': '346 25% 18%',
      '--sidebar-ring': '346 77% 55%',
    },
    lightSidebarVars: {
      '--sidebar-background': '0 0% 100%',
      '--sidebar-foreground': '346 30% 12%',
      '--sidebar-primary': '346 77% 50%',
      '--sidebar-primary-foreground': '0 0% 100%',
      '--sidebar-accent': '346 15% 96%',
      '--sidebar-accent-foreground': '346 30% 12%',
      '--sidebar-border': '346 15% 90%',
      '--sidebar-ring': '346 77% 50%',
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
      '--sidebar-foreground': '0 0% 95%',
      '--sidebar-primary': '38 92% 55%',
      '--sidebar-primary-foreground': '0 0% 100%',
      '--sidebar-accent': '38 25% 16%',
      '--sidebar-accent-foreground': '0 0% 95%',
      '--sidebar-border': '38 25% 16%',
      '--sidebar-ring': '38 92% 55%',
    },
    lightSidebarVars: {
      '--sidebar-background': '0 0% 100%',
      '--sidebar-foreground': '38 30% 10%',
      '--sidebar-primary': '38 92% 50%',
      '--sidebar-primary-foreground': '0 0% 100%',
      '--sidebar-accent': '38 20% 96%',
      '--sidebar-accent-foreground': '38 30% 10%',
      '--sidebar-border': '38 20% 90%',
      '--sidebar-ring': '38 92% 50%',
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
      '--sidebar-foreground': '0 0% 95%',
      '--sidebar-primary': '215 20% 50%',
      '--sidebar-primary-foreground': '0 0% 100%',
      '--sidebar-accent': '215 18% 16%',
      '--sidebar-accent-foreground': '0 0% 95%',
      '--sidebar-border': '215 18% 16%',
      '--sidebar-ring': '215 20% 50%',
    },
    lightSidebarVars: {
      '--sidebar-background': '0 0% 100%',
      '--sidebar-foreground': '215 20% 10%',
      '--sidebar-primary': '215 20% 40%',
      '--sidebar-primary-foreground': '0 0% 100%',
      '--sidebar-accent': '215 10% 96%',
      '--sidebar-accent-foreground': '215 20% 10%',
      '--sidebar-border': '215 10% 90%',
      '--sidebar-ring': '215 20% 40%',
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
      '--sidebar-foreground': '0 0% 95%',
      '--sidebar-primary': '199 89% 52%',
      '--sidebar-primary-foreground': '0 0% 100%',
      '--sidebar-accent': '199 30% 16%',
      '--sidebar-accent-foreground': '0 0% 95%',
      '--sidebar-border': '199 30% 16%',
      '--sidebar-ring': '199 89% 52%',
    },
    lightSidebarVars: {
      '--sidebar-background': '0 0% 100%',
      '--sidebar-foreground': '199 40% 10%',
      '--sidebar-primary': '199 89% 48%',
      '--sidebar-primary-foreground': '0 0% 100%',
      '--sidebar-accent': '199 15% 96%',
      '--sidebar-accent-foreground': '199 40% 10%',
      '--sidebar-border': '199 15% 90%',
      '--sidebar-ring': '199 89% 48%',
    },
  },
];

interface ThemeContextValue {
  currentTheme: ThemeId;
  setTheme: (id: ThemeId) => void;
  themes: ThemeDefinition[];
  sidebarMode: SidebarMode;
  setSidebarMode: (mode: SidebarMode) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  currentTheme: 'default',
  setTheme: () => {},
  themes: THEMES,
  sidebarMode: 'dark',
  setSidebarMode: () => {},
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<ThemeId>(() => {
    return (localStorage.getItem('incline-theme') as ThemeId) || 'default';
  });
  const [sidebarMode, setSidebarModeState] = useState<SidebarMode>(() => {
    return (localStorage.getItem('incline-sidebar-mode') as SidebarMode) || 'dark';
  });

  useEffect(() => {
    const theme = THEMES.find((t) => t.id === currentTheme);
    if (!theme) return;

    const root = document.documentElement;
    
    // Apply non-sidebar vars
    Object.entries(theme.vars).forEach(([key, value]) => {
      if (!key.startsWith('--sidebar-')) {
        root.style.setProperty(key, value);
      }
    });

    // Apply sidebar vars based on mode
    const sidebarVars = sidebarMode === 'light' ? theme.lightSidebarVars : theme.vars;
    Object.entries(sidebarVars).forEach(([key, value]) => {
      if (key.startsWith('--sidebar-')) {
        root.style.setProperty(key, value);
      }
    });

    localStorage.setItem('incline-theme', currentTheme);
    localStorage.setItem('incline-sidebar-mode', sidebarMode);
  }, [currentTheme, sidebarMode]);

  const setSidebarMode = (mode: SidebarMode) => {
    setSidebarModeState(mode);
  };

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme: setCurrentTheme, themes: THEMES, sidebarMode, setSidebarMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);

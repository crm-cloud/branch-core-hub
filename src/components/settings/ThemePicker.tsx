import { useTheme, ThemeId } from '@/contexts/ThemeContext';
import { Check } from 'lucide-react';

export function ThemePicker() {
  const { currentTheme, setTheme, themes } = useTheme();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">App Theme</h3>
        <p className="text-sm text-muted-foreground">Choose a color theme for the dashboard</p>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
        {themes.map((theme) => (
          <button
            key={theme.id}
            onClick={() => setTheme(theme.id as ThemeId)}
            className={`relative flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all ${
              currentTheme === theme.id
                ? 'border-primary shadow-lg scale-105'
                : 'border-border hover:border-primary/40 hover:shadow-md'
            }`}
          >
            <div
              className="w-10 h-10 rounded-full shadow-inner"
              style={{ backgroundColor: theme.preview }}
            />
            {currentTheme === theme.id && (
              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                <Check className="h-3 w-3 text-primary-foreground" />
              </div>
            )}
            <span className="text-xs font-medium">{theme.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

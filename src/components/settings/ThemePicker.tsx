import { useTheme, ThemeId } from '@/contexts/ThemeContext';
import { Check, Sun, Moon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';

export function ThemePicker() {
  const { currentTheme, setTheme, themes, sidebarMode, setSidebarMode } = useTheme();

  return (
    <div className="space-y-6">
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

      <div className="border-t pt-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label className="text-sm font-semibold flex items-center gap-2">
              {sidebarMode === 'light' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              Sidebar Style
            </Label>
            <p className="text-xs text-muted-foreground">
              {sidebarMode === 'light' ? 'Light, clean sidebar' : 'Dark, immersive sidebar'}
            </p>
          </div>
          <Switch
            checked={sidebarMode === 'light'}
            onCheckedChange={(checked) => setSidebarMode(checked ? 'light' : 'dark')}
          />
        </div>
      </div>
    </div>
  );
}

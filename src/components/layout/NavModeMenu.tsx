import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LayoutGrid, PanelLeft, PanelLeftClose, Check, PanelTop } from 'lucide-react';
import { getNavMode, setNavMode, subscribeNavMode, type NavMode } from '@/lib/navPreferences';

const OPTIONS: Array<{ id: NavMode; label: string; description: string; icon: React.ComponentType<{ className?: string }> }> = [
  { id: 'vertical', label: 'Vertical', description: 'Full sidebar with sections', icon: PanelLeft },
  { id: 'collapsed', label: 'Collapsed', description: 'Icon-only sidebar', icon: PanelLeftClose },
  { id: 'hybrid', label: 'Horizontal', description: 'Top menu, no sidebar', icon: PanelTop },
];

export function NavModeMenu() {
  const [mode, setMode] = useState<NavMode>(getNavMode);

  useEffect(() => subscribeNavMode(setMode), []);

  return (
    <TooltipProvider delayDuration={200}>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Navigation layout"
                data-testid="button-nav-mode"
                className="h-9 w-9"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Navigation layout</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel>Navigation layout</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {OPTIONS.map((opt) => {
            const Active = mode === opt.id;
            const Icon = opt.icon;
            return (
              <DropdownMenuItem
                key={opt.id}
                onClick={() => setNavMode(opt.id)}
                className="flex items-start gap-3 py-2.5 cursor-pointer"
              >
                <Icon className="h-4 w-4 mt-0.5 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium leading-tight">{opt.label}</div>
                  <div className="text-xs text-muted-foreground leading-snug">{opt.description}</div>
                </div>
                {Active && <Check className="h-4 w-4 text-primary mt-0.5" />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}

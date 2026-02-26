import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { getMenuForRole } from '@/config/menu';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { cn } from '@/lib/utils';
import { Menu, LogOut } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

function useOrgBranding() {
  return useQuery({
    queryKey: ['org-branding'],
    queryFn: async () => {
      const { data } = await supabase
        .from('organization_settings')
        .select('logo_url, name')
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

function BrandLogo({ className }: { className?: string }) {
  const { data: org } = useOrgBranding();
  
  if (org?.logo_url) {
    return <img src={org.logo_url} alt={org.name || 'Logo'} className={cn("max-h-8 object-contain", className)} />;
  }
  
  return (
    <span className="text-sidebar-primary text-2xl font-bold">
      {org?.name || 'Incline'}
    </span>
  );
}

export function AppSidebar() {
  const { signOut, roles } = useAuth();
  const location = useLocation();

  const menuSections = getMenuForRole(roles);

  return (
    <aside className="hidden lg:flex w-64 flex-col bg-sidebar border-r border-sidebar-border">
      <div className="p-6 border-b border-sidebar-border">
        <h1 className="text-2xl font-bold text-sidebar-foreground">
          <BrandLogo />
        </h1>
      </div>

      <ScrollArea className="flex-1 py-4">
        <nav className="px-3 space-y-6">
          {menuSections.map((section) => (
            <div key={section.title}>
              <p className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                {section.title}
              </p>
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        to={item.href}
                        className={cn(
                          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                          isActive
                            ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                            : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </ScrollArea>

      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          onClick={signOut}
          className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4 mr-3" />
          Sign Out
        </Button>
      </div>
    </aside>
  );
}

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const { signOut, roles } = useAuth();
  const location = useLocation();

  const menuSections = getMenuForRole(roles);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden">
          <Menu className="h-5 w-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0 bg-sidebar">
        <div className="p-6 border-b border-sidebar-border">
          <h1 className="text-2xl font-bold text-sidebar-foreground">
            <BrandLogo />
          </h1>
        </div>

        <ScrollArea className="h-[calc(100vh-180px)] py-4">
          <nav className="px-3 space-y-6">
            {menuSections.map((section) => (
              <div key={section.title}>
                <p className="px-3 mb-2 text-xs font-semibold text-sidebar-foreground/50 uppercase tracking-wider">
                  {section.title}
                </p>
                <ul className="space-y-1">
                  {section.items.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <li key={item.href}>
                        <Link
                          to={item.href}
                          onClick={() => setOpen(false)}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                            isActive
                              ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                              : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
                          )}
                        >
                          <item.icon className="h-4 w-4" />
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </nav>
        </ScrollArea>

        <div className="p-4 border-t border-sidebar-border">
          <Button
            variant="ghost"
            onClick={() => { signOut(); setOpen(false); }}
            className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="h-4 w-4 mr-3" />
            Sign Out
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

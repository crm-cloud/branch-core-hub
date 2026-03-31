import { ReactNode, useState, useCallback } from 'react';
import { AppSidebar, MobileNav } from './AppSidebar';
import { AppHeader } from './AppHeader';
import { useAuth } from '@/contexts/AuthContext';
import { useBranchContext } from '@/contexts/BranchContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { SessionTimeoutWarning } from '@/components/auth/SessionTimeoutWarning';
import { AlertTriangle, RefreshCw, Building2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const SIDEBAR_COLLAPSED_KEY = 'sidebar-collapsed';

function getInitialCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  } catch {
    return false;
  }
}

interface AppLayoutProps {
  children: ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { profile } = useAuth();
  const { branchStatus, retryBranchFetch, currentBranchName } = useBranchContext();
  const [collapsed, setCollapsed] = useState<boolean>(getInitialCollapsed);

  const handleToggleCollapse = useCallback(() => {
    setCollapsed(prev => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
      } catch {
      }
      return next;
    });
  }, []);

  const { data: org } = useQuery({
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

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const renderContent = () => {
    if (branchStatus === 'loading') {
      return (
        <div className="space-y-6 p-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
            <Skeleton className="h-28 rounded-xl" />
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-64 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        </div>
      );
    }

    if (branchStatus === 'no_branch_assigned') {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-warning/10 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-warning" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">No Branch Assigned</h2>
              <p className="text-muted-foreground mt-2">
                Your account hasn't been assigned to a branch yet. Please contact your administrator to get branch access.
              </p>
            </div>
            <Button variant="outline" onClick={retryBranchFetch} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      );
    }

    if (branchStatus === 'error') {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md text-center space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-foreground">Unable to Load Branch Data</h2>
              <p className="text-muted-foreground mt-2">
                There was an error loading your branch information. Please try again.
              </p>
            </div>
            <Button onClick={retryBranchFetch} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Retry
            </Button>
          </div>
        </div>
      );
    }

    return (
      <main className="flex-1 overflow-auto overflow-x-hidden p-6">
        {children}
      </main>
    );
  };

  return (
    <div className="min-h-screen flex bg-background">
      <AppSidebar collapsed={collapsed} onToggleCollapse={handleToggleCollapse} />
      
      <div className="flex-1 flex flex-col min-w-0">
        {/* Desktop header */}
        <AppHeader />
        
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between p-4 border-b border-border bg-card">
          <MobileNav />
          <h1 className="text-xl font-bold">
            {org?.logo_url ? (
              <img src={org.logo_url} alt={org.name || 'Logo'} className="max-h-7 object-contain" />
            ) : (
              <span className="text-accent">{org?.name || 'Incline'}</span>
            )}
          </h1>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Avatar className="h-8 w-8">
              <AvatarImage src={profile?.avatar_url ?? undefined} />
              <AvatarFallback className="bg-accent text-accent-foreground text-xs">
                {getInitials(profile?.full_name)}
              </AvatarFallback>
            </Avatar>
          </div>
        </header>

        {/* Main content with branch status handling */}
        {renderContent()}
      </div>

      {/* Session timeout warning */}
      <SessionTimeoutWarning />
    </div>
  );
}

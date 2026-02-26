import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useBranchContext } from '@/contexts/BranchContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BranchSelector } from '@/components/dashboard/BranchSelector';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Settings, 
  User, 
  LogOut, 
  Moon, 
  Sun
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { GlobalSearch } from '@/components/search/GlobalSearch';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export function AppHeader() {
  const { profile, signOut, roles, user, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));

  const { selectedBranch, setSelectedBranch, branches, showSelector, showAllOption } = useBranchContext();

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const toggleTheme = () => {
    document.documentElement.classList.toggle('dark');
    setIsDark(!isDark);
  };

  const primaryRole = roles[0];
  const primaryRoleString = typeof primaryRole === 'string' ? primaryRole : primaryRole?.role || 'user';
  const isMember = roles.some(r => (typeof r === 'string' ? r : r?.role) === 'member');

  // Fetch member code if user is a member
  const { data: memberCode } = useQuery({
    queryKey: ['user-member-code', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('members')
        .select('member_code')
        .eq('user_id', user.id)
        .single();
      return data?.member_code;
    },
    enabled: !!user?.id && isMember,
  });

  return (
    <>
      <header className="hidden lg:flex h-16 items-center justify-between px-6 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-40">
        {/* Single Search - GlobalSearch component */}
        <div className="flex-1 max-w-md">
          <GlobalSearch />
        </div>

      {/* Right Side Actions */}
      <div className="flex items-center gap-2">
        {/* Global Branch Selector - RBAC controlled */}
        {showSelector && branches.length > 0 && (
          <BranchSelector
            branches={branches}
            selectedBranch={selectedBranch}
            onBranchChange={setSelectedBranch}
            showAllOption={showAllOption}
          />
        )}

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="rounded-full hover:bg-muted"
        >
          {isDark ? (
            <Sun className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
          ) : (
            <Moon className="h-5 w-5 text-muted-foreground hover:text-foreground transition-colors" />
          )}
        </Button>

        {/* Notifications */}
        <NotificationBell />

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-10 w-10 rounded-full">
              <Avatar className="h-10 w-10 border-2 border-transparent hover:border-accent transition-colors">
                <AvatarImage src={profile?.avatar_url ?? undefined} />
                <AvatarFallback className="bg-accent text-accent-foreground font-semibold">
                  {getInitials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium leading-none">{profile?.full_name || 'User'}</p>
                  <Badge variant="outline" className="text-xs capitalize">
                    {primaryRoleString}
                  </Badge>
                </div>
                {memberCode && (
                  <p className="text-xs font-mono text-primary font-semibold">{memberCode}</p>
                )}
                <p className="text-xs leading-none text-muted-foreground">{profile?.email}</p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
              <User className="mr-2 h-4 w-4" />
              <span>Profile</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')} className="cursor-pointer">
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={signOut} className="cursor-pointer text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    </>
  );
}

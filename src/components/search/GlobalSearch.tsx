import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  UserCheck, 
  Dumbbell, 
  Calendar,
  Search,
  FileText,
  Building2,
  LayoutDashboard,
  Settings,
  CreditCard,
  Lock,
  ShoppingCart,
  BarChart3,
  UserPlus,
  Receipt,
  Megaphone,
  ClipboardList,
  Package,
  Star,
  Zap,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface SearchResult {
  id: string;
  type: 'member' | 'trainer' | 'employee' | 'invoice' | 'class' | 'lead';
  title: string;
  subtitle?: string;
  badge?: string;
}

interface GlobalSearchProps {
  className?: string;
}

const POPULAR_SEARCHES = [
  { label: 'Dashboard', icon: LayoutDashboard, href: '/dashboard' },
  { label: 'Analytics', icon: BarChart3, href: '/analytics' },
  { label: 'Members', icon: Users, href: '/members' },
  { label: 'Plans', icon: CreditCard, href: '/plans' },
];

const APPS_PAGES = [
  { label: 'Invoices', icon: Receipt, href: '/invoices' },
  { label: 'Trainers', icon: Dumbbell, href: '/trainers' },
  { label: 'Classes', icon: Calendar, href: '/classes' },
  { label: 'Settings', icon: Settings, href: '/settings' },
  { label: 'Leads', icon: UserPlus, href: '/leads' },
  { label: 'PT Sessions', icon: Package, href: '/pt-sessions' },
  { label: 'Attendance', icon: ClipboardList, href: '/attendance' },
  { label: 'Lockers', icon: Lock, href: '/lockers' },
  { label: 'POS', icon: ShoppingCart, href: '/pos' },
  { label: 'Announcements', icon: Megaphone, href: '/announcements' },
  { label: 'Feedback', icon: Star, href: '/feedback' },
  { label: 'Equipment', icon: Zap, href: '/equipment' },
];

const ALL_PAGES = [...POPULAR_SEARCHES, ...APPS_PAGES];

export function GlobalSearch({ className }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    document.addEventListener('keydown', down);
    return () => document.removeEventListener('keydown', down);
  }, []);

  // Search function
  const performSearch = useCallback(async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    setIsSearching(true);
    const searchResults: SearchResult[] = [];

    try {
      // Search members
      const { data: members } = await supabase
        .from('members')
        .select('id, member_code, status, profiles:user_id(full_name, email, phone)')
        .or(`member_code.ilike.%${searchQuery}%`)
        .limit(5);

      const { data: membersByProfile } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, members!members_user_id_profiles_fkey(id, member_code, status)')
        .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(10);

      const memberIds = new Set<string>();
      members?.forEach((m: any) => {
        if (!memberIds.has(m.id)) {
          memberIds.add(m.id);
          searchResults.push({
            id: m.id, type: 'member',
            title: m.profiles?.full_name || m.member_code,
            subtitle: m.profiles?.email || m.profiles?.phone,
            badge: m.status,
          });
        }
      });

      membersByProfile?.forEach((p: any) => {
        if (p.members && p.members.length > 0) {
          p.members.forEach((m: any) => {
            if (!memberIds.has(m.id)) {
              memberIds.add(m.id);
              searchResults.push({
                id: m.id, type: 'member',
                title: p.full_name || m.member_code,
                subtitle: p.email || p.phone,
                badge: m.status,
              });
            }
          });
        }
      });

      // Search trainers
      const { data: trainersByProfile } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, trainers!trainers_user_id_fkey(id, trainer_code, is_active)')
        .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(10);

      trainersByProfile?.forEach((p: any) => {
        if (p.trainers && p.trainers.length > 0) {
          p.trainers.forEach((t: any) => {
            searchResults.push({
              id: t.id, type: 'trainer',
              title: p.full_name || t.trainer_code,
              subtitle: p.email || p.phone,
              badge: t.is_active ? 'active' : 'inactive',
            });
          });
        }
      });

      // Search invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select('id, invoice_number, status, total_amount')
        .ilike('invoice_number', `%${searchQuery}%`)
        .limit(5);

      invoices?.forEach((inv: any) => {
        searchResults.push({
          id: inv.id, type: 'invoice',
          title: inv.invoice_number,
          subtitle: `₹${inv.total_amount}`,
          badge: inv.status,
        });
      });

      // Search leads
      const { data: leads } = await supabase
        .from('leads')
        .select('id, full_name, phone, email, status')
        .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(5);

      leads?.forEach((lead: any) => {
        searchResults.push({
          id: lead.id, type: 'lead',
          title: lead.full_name,
          subtitle: lead.email || lead.phone,
          badge: lead.status,
        });
      });

    } catch (error) {
      console.error('Search error:', error);
    }

    setResults(searchResults);
    setIsSearching(false);
  }, []);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      performSearch(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const handleSelect = (result: SearchResult) => {
    setOpen(false);
    setQuery('');
    
    switch (result.type) {
      case 'member': navigate(`/members?highlight=${result.id}`); break;
      case 'trainer': navigate(`/trainers?highlight=${result.id}`); break;
      case 'employee': navigate(`/employees?highlight=${result.id}`); break;
      case 'invoice': navigate(`/invoices?highlight=${result.id}`); break;
      case 'class': navigate(`/classes?highlight=${result.id}`); break;
      case 'lead': navigate(`/leads?highlight=${result.id}`); break;
    }
  };

  const handlePageNav = (href: string) => {
    setOpen(false);
    setQuery('');
    navigate(href);
  };

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'member': return Users;
      case 'trainer': return Dumbbell;
      case 'employee': return UserCheck;
      case 'invoice': return FileText;
      case 'class': return Calendar;
      case 'lead': return Building2;
    }
  };

  const groupedResults = {
    member: results.filter(r => r.type === 'member'),
    trainer: results.filter(r => r.type === 'trainer'),
    invoice: results.filter(r => r.type === 'invoice'),
    lead: results.filter(r => r.type === 'lead'),
  };

  const hasResults = results.length > 0;
  const hasQuery = query.length >= 2;

  // Filter pages by query
  const filteredPages = query.length > 0
    ? ALL_PAGES.filter(a => a.label.toLowerCase().includes(query.toLowerCase()))
    : [];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          "flex items-center gap-2 h-9 w-full max-w-sm rounded-lg border border-input bg-background px-3 py-1 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          className
        )}
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search...</span>
        <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput 
          placeholder="Search members, trainers, invoices..." 
          value={query}
          onValueChange={setQuery}
        />
        <CommandList className="max-h-[400px]">
          {hasQuery && !hasResults && filteredPages.length === 0 && (
            <CommandEmpty>
              {isSearching ? 'Searching...' : 'No results found.'}
            </CommandEmpty>
          )}

          {/* Default view: Two-column categories when no query */}
          {!hasQuery && (
            <div className="grid grid-cols-2 gap-0">
              <div className="border-r border-border">
                <div className="px-3 py-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Popular Searches</p>
                </div>
                {POPULAR_SEARCHES.map((item) => (
                  <button
                    key={item.href}
                    onClick={() => handlePageNav(item.href)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-sm hover:bg-accent transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                      <item.icon className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
              <div>
                <div className="px-3 py-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Apps & Pages</p>
                </div>
                {APPS_PAGES.slice(0, 6).map((item) => (
                  <button
                    key={item.href}
                    onClick={() => handlePageNav(item.href)}
                    className="flex items-center gap-3 w-full px-3 py-2.5 text-sm hover:bg-accent transition-colors cursor-pointer"
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-muted">
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <span className="font-medium">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Filtered page results when typing */}
          {hasQuery && filteredPages.length > 0 && !hasResults && (
            <CommandGroup heading="Pages">
              {filteredPages.map((item) => (
                <CommandItem
                  key={item.href}
                  onSelect={() => handlePageNav(item.href)}
                  className="flex items-center gap-3 cursor-pointer"
                >
                  <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted">
                    <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  <span>{item.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {/* DB Search Results */}
          {groupedResults.member.length > 0 && (
            <CommandGroup heading="Members">
              {groupedResults.member.map((result) => {
                const Icon = getIcon(result.type);
                return (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{result.title}</div>
                      {result.subtitle && <div className="text-sm text-muted-foreground truncate">{result.subtitle}</div>}
                    </div>
                    {result.badge && <Badge variant="outline" className="text-xs capitalize shrink-0">{result.badge}</Badge>}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {groupedResults.trainer.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Trainers">
                {groupedResults.trainer.map((result) => (
                  <CommandItem key={`trainer-${result.id}`} onSelect={() => handleSelect(result)} className="flex items-center gap-3 cursor-pointer">
                    <Dumbbell className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{result.title}</div>
                      {result.subtitle && <div className="text-sm text-muted-foreground truncate">{result.subtitle}</div>}
                    </div>
                    {result.badge && <Badge variant="outline" className="text-xs capitalize shrink-0">{result.badge}</Badge>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {groupedResults.invoice.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Invoices">
                {groupedResults.invoice.map((result) => (
                  <CommandItem key={`invoice-${result.id}`} onSelect={() => handleSelect(result)} className="flex items-center gap-3 cursor-pointer">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{result.title}</div>
                      {result.subtitle && <div className="text-sm text-muted-foreground truncate">{result.subtitle}</div>}
                    </div>
                    {result.badge && <Badge variant="outline" className="text-xs capitalize shrink-0">{result.badge}</Badge>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {groupedResults.lead.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Leads">
                {groupedResults.lead.map((result) => (
                  <CommandItem key={`lead-${result.id}`} onSelect={() => handleSelect(result)} className="flex items-center gap-3 cursor-pointer">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{result.title}</div>
                      {result.subtitle && <div className="text-sm text-muted-foreground truncate">{result.subtitle}</div>}
                    </div>
                    {result.badge && <Badge variant="outline" className="text-xs capitalize shrink-0">{result.badge}</Badge>}
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
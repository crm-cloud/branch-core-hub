import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { supabase } from '@/integrations/supabase/client';
import { 
  Users, 
  UserCheck, 
  Dumbbell, 
  Calendar,
  Search,
  FileText,
  Building2,
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

export function GlobalSearch({ className }: GlobalSearchProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(true);
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

      // Also search by profile fields
      const { data: membersByProfile } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, members!members_user_id_profiles_fkey(id, member_code, status)')
        .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(10);

      // Combine member results
      const memberIds = new Set<string>();
      members?.forEach((m: any) => {
        if (!memberIds.has(m.id)) {
          memberIds.add(m.id);
          searchResults.push({
            id: m.id,
            type: 'member',
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
                id: m.id,
                type: 'member',
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

      const trainerIds = new Set<string>();
      trainersByProfile?.forEach((p: any) => {
        if (p.trainers && p.trainers.length > 0) {
          p.trainers.forEach((t: any) => {
            if (!trainerIds.has(t.id)) {
              trainerIds.add(t.id);
              searchResults.push({
                id: t.id,
                type: 'trainer',
                title: p.full_name || t.trainer_code,
                subtitle: p.email || p.phone,
                badge: t.is_active ? 'active' : 'inactive',
              });
            }
          });
        }
      });

      // Search employees
      const { data: employeesByProfile } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, employees!employees_user_id_fkey(id, employee_code, is_active, department)')
        .or(`full_name.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%,phone.ilike.%${searchQuery}%`)
        .limit(10);

      employeesByProfile?.forEach((p: any) => {
        if (p.employees && p.employees.length > 0) {
          p.employees.forEach((e: any) => {
            searchResults.push({
              id: e.id,
              type: 'employee',
              title: p.full_name || e.employee_code,
              subtitle: e.department || p.email,
              badge: e.is_active ? 'active' : 'inactive',
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
          id: inv.id,
          type: 'invoice',
          title: inv.invoice_number,
          subtitle: `₹${inv.total_amount}`,
          badge: inv.status,
        });
      });

      // Search classes
      const { data: classes } = await supabase
        .from('classes')
        .select('id, name, class_type, is_active')
        .ilike('name', `%${searchQuery}%`)
        .limit(5);

      classes?.forEach((cls: any) => {
        searchResults.push({
          id: cls.id,
          type: 'class',
          title: cls.name,
          subtitle: cls.class_type,
          badge: cls.is_active ? 'active' : 'inactive',
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
          id: lead.id,
          type: 'lead',
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
      case 'member':
        navigate(`/members?highlight=${result.id}`);
        break;
      case 'trainer':
        navigate(`/trainers?highlight=${result.id}`);
        break;
      case 'employee':
        navigate(`/employees?highlight=${result.id}`);
        break;
      case 'invoice':
        navigate(`/invoices?highlight=${result.id}`);
        break;
      case 'class':
        navigate(`/classes?highlight=${result.id}`);
        break;
      case 'lead':
        navigate(`/leads?highlight=${result.id}`);
        break;
    }
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
    employee: results.filter(r => r.type === 'employee'),
    invoice: results.filter(r => r.type === 'invoice'),
    class: results.filter(r => r.type === 'class'),
    lead: results.filter(r => r.type === 'lead'),
  };

  const renderGroup = (items: SearchResult[], heading: string, showSeparator = false) => {
    if (items.length === 0) return null;
    
    return (
      <>
        {showSeparator && <CommandSeparator />}
        <CommandGroup heading={heading}>
          {items.map((result) => {
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
                  {result.subtitle && (
                    <div className="text-sm text-muted-foreground truncate">{result.subtitle}</div>
                  )}
                </div>
                {result.badge && (
                  <Badge variant="outline" className="text-xs capitalize shrink-0">
                    {result.badge}
                  </Badge>
                )}
              </CommandItem>
            );
          })}
        </CommandGroup>
      </>
    );
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 h-9 w-full max-w-sm rounded-md border border-input bg-background px-3 py-1 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            className
          )}
        >
          <Search className="h-4 w-4" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="pointer-events-none hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
            <span className="text-xs">⌘</span>K
          </kbd>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="start" sideOffset={8}>
        <Command shouldFilter={false}>
          <CommandInput 
            ref={inputRef}
            placeholder="Search members, trainers, invoices..." 
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[300px]">
            <CommandEmpty>
              {isSearching ? 'Searching...' : query.length < 2 ? 'Type at least 2 characters to search' : 'No results found.'}
            </CommandEmpty>

            {renderGroup(groupedResults.member, 'Members')}
            {renderGroup(groupedResults.trainer, 'Trainers', groupedResults.member.length > 0)}
            {renderGroup(groupedResults.employee, 'Employees', groupedResults.member.length > 0 || groupedResults.trainer.length > 0)}
            {renderGroup(groupedResults.invoice, 'Invoices', groupedResults.member.length > 0 || groupedResults.trainer.length > 0 || groupedResults.employee.length > 0)}
            {renderGroup(groupedResults.class, 'Classes', results.some(r => ['member', 'trainer', 'employee', 'invoice'].includes(r.type)))}
            {renderGroup(groupedResults.lead, 'Leads', results.some(r => ['member', 'trainer', 'employee', 'invoice', 'class'].includes(r.type)))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

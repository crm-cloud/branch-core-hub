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
  CreditCard, 
  Calendar,
  Search,
  FileText,
  Building2,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface SearchResult {
  id: string;
  type: 'member' | 'trainer' | 'employee' | 'invoice' | 'class' | 'lead';
  title: string;
  subtitle?: string;
  badge?: string;
}

export function GlobalSearch() {
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
        setOpen((open) => !open);
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
      const { data: trainers } = await supabase
        .from('trainers')
        .select('id, trainer_code, is_active, profiles:user_id(full_name, email, phone)')
        .limit(5);

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

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput 
        placeholder="Search members, trainers, invoices..." 
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {isSearching ? 'Searching...' : query.length < 2 ? 'Type at least 2 characters to search' : 'No results found.'}
        </CommandEmpty>

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
                  <div className="flex-1">
                    <div className="font-medium">{result.title}</div>
                    {result.subtitle && (
                      <div className="text-sm text-muted-foreground">{result.subtitle}</div>
                    )}
                  </div>
                  {result.badge && (
                    <Badge variant="outline" className="text-xs capitalize">
                      {result.badge}
                    </Badge>
                  )}
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}

        {groupedResults.trainer.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Trainers">
              {groupedResults.trainer.map((result) => {
                const Icon = getIcon(result.type);
                return (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium">{result.title}</div>
                      {result.subtitle && (
                        <div className="text-sm text-muted-foreground">{result.subtitle}</div>
                      )}
                    </div>
                    {result.badge && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {result.badge}
                      </Badge>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {groupedResults.employee.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Employees">
              {groupedResults.employee.map((result) => {
                const Icon = getIcon(result.type);
                return (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium">{result.title}</div>
                      {result.subtitle && (
                        <div className="text-sm text-muted-foreground">{result.subtitle}</div>
                      )}
                    </div>
                    {result.badge && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {result.badge}
                      </Badge>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {groupedResults.invoice.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Invoices">
              {groupedResults.invoice.map((result) => {
                const Icon = getIcon(result.type);
                return (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium">{result.title}</div>
                      {result.subtitle && (
                        <div className="text-sm text-muted-foreground">{result.subtitle}</div>
                      )}
                    </div>
                    {result.badge && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {result.badge}
                      </Badge>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {groupedResults.class.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Classes">
              {groupedResults.class.map((result) => {
                const Icon = getIcon(result.type);
                return (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium">{result.title}</div>
                      {result.subtitle && (
                        <div className="text-sm text-muted-foreground">{result.subtitle}</div>
                      )}
                    </div>
                    {result.badge && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {result.badge}
                      </Badge>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}

        {groupedResults.lead.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Leads">
              {groupedResults.lead.map((result) => {
                const Icon = getIcon(result.type);
                return (
                  <CommandItem
                    key={`${result.type}-${result.id}`}
                    onSelect={() => handleSelect(result)}
                    className="flex items-center gap-3 cursor-pointer"
                  >
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1">
                      <div className="font-medium">{result.title}</div>
                      {result.subtitle && (
                        <div className="text-sm text-muted-foreground">{result.subtitle}</div>
                      )}
                    </div>
                    {result.badge && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {result.badge}
                      </Badge>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

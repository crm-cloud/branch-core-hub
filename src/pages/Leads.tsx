import { useState, useMemo, useEffect, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, LayoutGrid, List, Calendar, Download, Target } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { exportToCSV } from '@/lib/csvExport';
import { leadService, type LeadFilters } from '@/services/leadService';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { useBranchContext } from '@/contexts/BranchContext';

// Components
import { AddLeadDrawer } from '@/components/leads/AddLeadDrawer';
import { FollowupDrawer } from '@/components/leads/FollowupDrawer';
import { ConvertMemberDrawer } from '@/components/leads/ConvertMemberDrawer';
import { LeadDashboard } from '@/components/leads/LeadDashboard';
import { LeadKanban } from '@/components/leads/LeadKanban';
import { LeadList } from '@/components/leads/LeadList';
import { LeadFilterBar, STATUS_CONFIG } from '@/components/leads/LeadFilters';
import { LeadProfileDrawer } from '@/components/leads/LeadProfileDrawer';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { CardHeader, CardTitle } from '@/components/ui/card';

export default function LeadsPage() {
  const { user } = useAuth();
  const { effectiveBranchId } = useBranchContext();

  // UI State
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showFollowupDrawer, setShowFollowupDrawer] = useState(false);
  const [showConvertDrawer, setShowConvertDrawer] = useState(false);
  const [showProfileDrawer, setShowProfileDrawer] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'calendar'>('kanban');
  const [page, setPage] = useState(0);
  const [calendarMonth, setCalendarMonth] = useState(new Date());

  // Filters
  const [filters, setFilters] = useState<LeadFilters>({});
  const [statusFilter, setStatusFilter] = useState<string[]>(['new', 'contacted', 'qualified', 'negotiation']);
  const [temperatureFilter, setTemperatureFilter] = useState<string[]>([]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'n' || e.key === 'N') { e.preventDefault(); setShowAddDrawer(true); }
      if (e.key === 'k' || e.key === 'K') { e.preventDefault(); setViewMode('kanban'); }
      if (e.key === 'l' || e.key === 'L') { e.preventDefault(); setViewMode('list'); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Data
  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads', effectiveBranchId],
    queryFn: () => leadService.fetchLeads(effectiveBranchId || undefined),
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ['lead-stats', effectiveBranchId],
    queryFn: () => leadService.getLeadStats(effectiveBranchId || undefined),
    enabled: !!user,
  });

  // Derived
  const sources = useMemo(() => {
    const s = new Set(leads.map((l: any) => l.source).filter(Boolean));
    return Array.from(s) as string[];
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead: any) => {
      const matchesSearch = !filters.search ||
        lead.full_name?.toLowerCase().includes(filters.search.toLowerCase()) ||
        lead.phone?.includes(filters.search) ||
        lead.email?.toLowerCase().includes(filters.search.toLowerCase());
      const matchesSource = !filters.source || filters.source === 'all' || lead.source === filters.source;
      const matchesStatus = statusFilter.length === 0 || statusFilter.includes(lead.status);
      const matchesTemp = temperatureFilter.length === 0 || temperatureFilter.includes(lead.temperature);
      const matchesOwner = !filters.ownerId || (filters.ownerId === 'unassigned' ? !lead.owner_id : lead.owner_id === filters.ownerId);
      return matchesSearch && matchesSource && matchesStatus && matchesTemp && matchesOwner;
    });
  }, [leads, filters, statusFilter, temperatureFilter]);

  // Actions
  const openProfile = useCallback((lead: any) => { setSelectedLead(lead); setShowProfileDrawer(true); }, []);
  const openFollowup = useCallback((lead: any) => { setSelectedLead(lead); setShowFollowupDrawer(true); }, []);
  const openConvert = useCallback((lead: any) => { setSelectedLead(lead); setShowConvertDrawer(true); }, []);

  // Calendar helpers
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const getLeadsForDay = (day: Date) => filteredLeads.filter((l: any) => isSameDay(new Date(l.created_at), day));

  return (
    <AppLayout>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                <Target className="h-6 w-6" />
              </div>
              Lead Management
            </h1>
            <p className="text-muted-foreground mt-1">Track, nurture, and convert leads into members</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-xl p-1">
              <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('kanban')} className="rounded-lg" title="Kanban (K)">
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="rounded-lg" title="List (L)">
                <List className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'calendar' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('calendar')} className="rounded-lg">
                <Calendar className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={() => setShowAddDrawer(true)} className="gap-2 rounded-xl shadow-lg shadow-primary/20" title="Add Lead (N)">
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5 rounded-xl" onClick={() => {
              const rows = filteredLeads.map((l: any) => ({
                Name: l.full_name || '',
                Phone: l.phone || '',
                Email: l.email || '',
                Source: l.source || 'Direct',
                Status: l.status || '',
                Temperature: l.temperature || '',
                Score: l.score || 0,
                'Created At': l.created_at ? format(new Date(l.created_at), 'yyyy-MM-dd') : '',
                Notes: l.notes || '',
                'UTM Source': l.utm_source || '',
                'UTM Campaign': l.utm_campaign || '',
              }));
              exportToCSV(rows, 'leads');
            }}>
              <Download className="h-4 w-4" /> Export
            </Button>
          </div>
        </div>

        {/* Dashboard Stats */}
        {stats && <LeadDashboard stats={stats} />}

        {/* Filters */}
        <Card className="rounded-2xl border-border/50 shadow-lg shadow-primary/5">
          <CardContent className="pt-5 pb-4">
            <LeadFilterBar
              filters={filters}
              onFiltersChange={(f) => { setFilters(f); setPage(0); }}
              sources={sources}
              statusFilter={statusFilter}
              onStatusFilterChange={(s) => { setStatusFilter(s); setPage(0); }}
              temperatureFilter={temperatureFilter}
              onTemperatureFilterChange={(t) => { setTemperatureFilter(t); setPage(0); }}
            />
          </CardContent>
        </Card>

        {/* Views */}
        {viewMode === 'kanban' && (
          <LeadKanban
            leads={filteredLeads}
            onSelectLead={openProfile}
            onFollowup={openFollowup}
            onConvert={openConvert}
          />
        )}

        {viewMode === 'list' && (
          <LeadList
            leads={filteredLeads}
            isLoading={isLoading}
            page={page}
            onPageChange={setPage}
            onSelectLead={openProfile}
            onFollowup={openFollowup}
            onConvert={openConvert}
          />
        )}

        {viewMode === 'calendar' && (
          <Card className="rounded-2xl border-border/50 shadow-lg">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>{format(calendarMonth, 'MMMM yyyy')}</CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="icon" onClick={() => setCalendarMonth(d => subMonths(d, 1))} className="rounded-xl">
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCalendarMonth(new Date())} className="rounded-xl">Today</Button>
                  <Button variant="outline" size="icon" onClick={() => setCalendarMonth(d => addMonths(d, 1))} className="rounded-xl">
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-7 gap-px bg-border rounded-xl overflow-hidden">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                  <div key={d} className="bg-muted p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
                ))}
                {calendarDays.map((day, idx) => {
                  const dayLeads = getLeadsForDay(day);
                  const isCurrentMonth = isSameMonth(day, calendarMonth);
                  const isToday = isSameDay(day, new Date());
                  return (
                    <div key={idx} className={`bg-card p-2 min-h-[80px] ${!isCurrentMonth ? 'opacity-40' : ''} ${isToday ? 'ring-2 ring-primary ring-inset' : ''}`}>
                      <p className={`text-xs font-medium mb-1 ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                        {format(day, 'd')}
                      </p>
                      {dayLeads.slice(0, 3).map((lead: any) => (
                        <div
                          key={lead.id}
                          className={`text-xs px-1.5 py-0.5 rounded mb-0.5 truncate cursor-pointer ${STATUS_CONFIG[lead.status]?.color || 'bg-muted'}`}
                          onClick={() => openProfile(lead)}
                        >
                          {lead.full_name}
                        </div>
                      ))}
                      {dayLeads.length > 3 && (
                        <p className="text-xs text-muted-foreground">+{dayLeads.length - 3} more</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Drawers */}
      <LeadProfileDrawer
        open={showProfileDrawer}
        onOpenChange={setShowProfileDrawer}
        lead={selectedLead}
        onFollowup={openFollowup}
        onConvert={openConvert}
      />
      <AddLeadDrawer open={showAddDrawer} onOpenChange={setShowAddDrawer} defaultBranchId={effectiveBranchId || ''} />
      <FollowupDrawer open={showFollowupDrawer} onOpenChange={setShowFollowupDrawer} lead={selectedLead} />
      <ConvertMemberDrawer open={showConvertDrawer} onOpenChange={setShowConvertDrawer} lead={selectedLead} />
    </AppLayout>
  );
}

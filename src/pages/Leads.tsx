import { useState, useMemo } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, UserPlus, Phone, Mail, MessageSquare, Calendar, ArrowRight, History, 
  Search, LayoutGrid, List, ChevronLeft, ChevronRight, Filter, X, Users, TrendingUp, Target
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadService } from '@/services/leadService';
import { communicationService } from '@/services/communicationService';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek } from 'date-fns';
import { AddLeadDrawer } from '@/components/leads/AddLeadDrawer';
import { FollowupDrawer } from '@/components/leads/FollowupDrawer';
import { ConvertMemberDrawer } from '@/components/leads/ConvertMemberDrawer';
import { useBranchContext } from '@/contexts/BranchContext';

const LEAD_STATUSES = ['new', 'contacted', 'qualified', 'negotiation', 'converted', 'lost'] as const;
const PAGE_SIZE = 50;

const STATUS_CONFIG: Record<string, { color: string; label: string }> = {
  new: { color: 'bg-sky-500/10 text-sky-600 border-sky-200', label: 'New' },
  contacted: { color: 'bg-amber-500/10 text-amber-600 border-amber-200', label: 'Contacted' },
  qualified: { color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200', label: 'Qualified' },
  negotiation: { color: 'bg-violet-500/10 text-violet-600 border-violet-200', label: 'Negotiation' },
  converted: { color: 'bg-primary/10 text-primary border-primary/20', label: 'Converted' },
  lost: { color: 'bg-muted text-muted-foreground border-border', label: 'Lost' },
};

export default function LeadsPage() {
  const { user } = useAuth();
  const { effectiveBranchId } = useBranchContext();
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showFollowupDrawer, setShowFollowupDrawer] = useState(false);
  const [showConvertDrawer, setShowConvertDrawer] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [viewMode, setViewMode] = useState<'kanban' | 'list' | 'calendar'>('kanban');
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [page, setPage] = useState(0);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => leadService.fetchLeads(),
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ['lead-stats'],
    queryFn: () => leadService.getLeadStats(),
    enabled: !!user,
  });

  const { data: followups = [] } = useQuery({
    queryKey: ['followups', selectedLead?.id],
    queryFn: () => selectedLead ? leadService.fetchFollowups(selectedLead.id) : [],
    enabled: !!selectedLead,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: any }) =>
      leadService.updateLeadStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  // Unique sources
  const sources = useMemo(() => {
    const s = new Set(leads.map((l: any) => l.source || 'Direct'));
    return ['all', ...Array.from(s)];
  }, [leads]);

  // Filtered leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead: any) => {
      const matchesSearch = !searchQuery || 
        lead.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        lead.phone?.includes(searchQuery) ||
        lead.email?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSource = sourceFilter === 'all' || (lead.source || 'Direct') === sourceFilter;
      return matchesSearch && matchesSource;
    });
  }, [leads, searchQuery, sourceFilter]);

  // Paginated leads for list view
  const paginatedLeads = filteredLeads.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filteredLeads.length / PAGE_SIZE);

  const handleWhatsApp = (phone: string, name: string) => {
    communicationService.sendWhatsApp(phone, `Hi ${name}, thanks for your interest in Incline Fitness!`);
  };

  const openFollowup = (lead: any) => { setSelectedLead(lead); setShowFollowupDrawer(true); };
  const openConvert = (lead: any) => { setSelectedLead(lead); setShowConvertDrawer(true); };
  const openHistory = (lead: any) => { setSelectedLead(lead); setShowHistoryDrawer(true); };

  // Calendar helpers
  const monthStart = startOfMonth(calendarMonth);
  const monthEnd = endOfMonth(calendarMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getLeadsForDay = (day: Date) => {
    return filteredLeads.filter((lead: any) => {
      const created = new Date(lead.created_at);
      return isSameDay(created, day);
    });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white">
                <Target className="h-6 w-6" />
              </div>
              Lead Management
            </h1>
            <p className="text-muted-foreground mt-1">Track, nurture, and convert leads into members</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex bg-muted rounded-xl p-1">
              <Button variant={viewMode === 'kanban' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('kanban')} className="rounded-lg">
                <LayoutGrid className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'list' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('list')} className="rounded-lg">
                <List className="h-4 w-4" />
              </Button>
              <Button variant={viewMode === 'calendar' ? 'default' : 'ghost'} size="sm" onClick={() => setViewMode('calendar')} className="rounded-lg">
                <Calendar className="h-4 w-4" />
              </Button>
            </div>
            <Button onClick={() => setShowAddDrawer(true)} className="gap-2 rounded-xl shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" />
              Add Lead
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-6">
          {[
            { label: 'Total', value: stats?.total || 0, icon: Users, gradient: true },
            { label: 'New', value: stats?.new || 0, icon: UserPlus },
            { label: 'Contacted', value: stats?.contacted || 0, icon: Phone },
            { label: 'Qualified', value: (stats as any)?.qualified || (stats as any)?.interested || 0, icon: Target },
            { label: 'Converted', value: stats?.converted || 0, icon: TrendingUp },
            { label: 'Lost', value: stats?.lost || 0, icon: X },
          ].map((stat) => (
            <Card key={stat.label} className={stat.gradient ? 'bg-gradient-to-br from-violet-600 to-indigo-600 text-white border-0 shadow-lg shadow-indigo-500/20 rounded-2xl' : 'rounded-2xl border-border/50 shadow-lg shadow-slate-200/50'}>
              <CardContent className="pt-5 pb-4">
                <stat.icon className={`h-4 w-4 mb-2 ${stat.gradient ? 'opacity-80' : 'text-muted-foreground'}`} />
                <div className={`text-2xl font-bold ${stat.gradient ? '' : 'text-foreground'}`}>{stat.value}</div>
                <p className={`text-xs mt-0.5 ${stat.gradient ? 'opacity-80' : 'text-muted-foreground'}`}>{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <Card className="rounded-2xl border-border/50 shadow-lg shadow-slate-200/50">
          <CardContent className="pt-5 pb-4">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by name, phone, email..." value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setPage(0); }} className="pl-10 rounded-xl" />
              </div>
              <Select value={sourceFilter} onValueChange={(v) => { setSourceFilter(v); setPage(0); }}>
                <SelectTrigger className="w-[150px] rounded-xl">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sources.map(s => (
                    <SelectItem key={s} value={s}>{s === 'all' ? 'All Sources' : s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Kanban View */}
        {viewMode === 'kanban' && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {LEAD_STATUSES.map(status => {
              const statusLeads = filteredLeads.filter((l: any) => l.status === status);
              const cfg = STATUS_CONFIG[status];
              return (
                <div key={status} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Badge className={`${cfg.color} rounded-full px-3`}>{cfg.label}</Badge>
                    <span className="text-sm font-bold text-muted-foreground">{statusLeads.length}</span>
                  </div>
                  <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                    {statusLeads.map((lead: any) => (
                      <Card key={lead.id} className="rounded-xl border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => openHistory(lead)}>
                        <CardContent className="p-3 space-y-2">
                          <p className="font-semibold text-sm truncate">{lead.full_name}</p>
                          <p className="text-xs text-muted-foreground truncate">{lead.phone || lead.email}</p>
                          <div className="flex items-center justify-between">
                            <Badge variant="outline" className="text-xs">{lead.source || 'Direct'}</Badge>
                            <span className="text-xs text-muted-foreground">{format(new Date(lead.created_at), 'dd MMM')}</span>
                          </div>
                          <div className="flex items-center gap-1 pt-1">
                            {lead.phone && (
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); handleWhatsApp(lead.phone, lead.full_name); }}>
                                <MessageSquare className="h-3 w-3 text-emerald-500" />
                              </Button>
                            )}
                            {lead.phone && (
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); window.open(`tel:${lead.phone}`); }}>
                                <Phone className="h-3 w-3 text-sky-500" />
                              </Button>
                            )}
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openFollowup(lead); }}>
                              <Calendar className="h-3 w-3" />
                            </Button>
                            {lead.status !== 'converted' && (
                              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openConvert(lead); }}>
                                <ArrowRight className="h-3 w-3 text-primary" />
                              </Button>
                            )}
                          </div>
                          {/* Status change */}
                          <Select value={lead.status} onValueChange={(s) => { updateStatusMutation.mutate({ id: lead.id, status: s }); }}>
                            <SelectTrigger className="h-7 text-xs rounded-lg mt-1">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {LEAD_STATUSES.map(s => (
                                <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </CardContent>
                      </Card>
                    ))}
                    {statusLeads.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No leads</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <Card className="rounded-2xl border-border/50 shadow-lg">
            <CardHeader><CardTitle>All Leads ({filteredLeads.length})</CardTitle></CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                </div>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Source</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedLeads.map((lead: any) => (
                        <TableRow key={lead.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openHistory(lead)}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                                <UserPlus className="h-5 w-5 text-primary" />
                              </div>
                              <div className="font-medium">{lead.full_name}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{lead.phone}</div>
                            <div className="text-sm text-muted-foreground">{lead.email}</div>
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Select value={lead.status} onValueChange={(status) => updateStatusMutation.mutate({ id: lead.id, status })}>
                              <SelectTrigger className="w-32">
                                <Badge className={STATUS_CONFIG[lead.status]?.color || 'bg-muted'}>{STATUS_CONFIG[lead.status]?.label || lead.status}</Badge>
                              </SelectTrigger>
                              <SelectContent>
                                {LEAD_STATUSES.map(s => (
                                  <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell><Badge variant="outline">{lead.source || 'Direct'}</Badge></TableCell>
                          <TableCell>{format(new Date(lead.created_at), 'MMM dd, yyyy')}</TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              {lead.phone && (
                                <Button size="icon" variant="ghost" onClick={() => handleWhatsApp(lead.phone, lead.full_name)}>
                                  <MessageSquare className="h-4 w-4 text-emerald-500" />
                                </Button>
                              )}
                              <Button size="icon" variant="ghost" onClick={() => window.open(`tel:${lead.phone}`)}>
                                <Phone className="h-4 w-4 text-sky-500" />
                              </Button>
                              <Button size="icon" variant="ghost" onClick={() => openFollowup(lead)}>
                                <Calendar className="h-4 w-4" />
                              </Button>
                              {lead.status !== 'converted' && (
                                <Button size="sm" variant="outline" onClick={() => openConvert(lead)} className="rounded-lg">
                                  <ArrowRight className="h-4 w-4 mr-1" /> Convert
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {paginatedLeads.length === 0 && (
                        <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No leads found</TableCell></TableRow>
                      )}
                    </TableBody>
                  </Table>
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between pt-4">
                      <p className="text-sm text-muted-foreground">Page {page + 1} of {totalPages} ({filteredLeads.length} leads)</p>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>
                          <ChevronLeft className="h-4 w-4" /> Prev
                        </Button>
                        <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>
                          Next <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* Calendar View */}
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
                        <div key={lead.id} className={`text-xs px-1.5 py-0.5 rounded mb-0.5 truncate cursor-pointer ${STATUS_CONFIG[lead.status]?.color || 'bg-muted'}`}
                          onClick={() => openHistory(lead)}>
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

      {/* Followup History Drawer */}
      <Sheet open={showHistoryDrawer} onOpenChange={setShowHistoryDrawer}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Follow-up History: {selectedLead?.full_name}</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {followups.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No follow-ups recorded yet.</p>
            ) : (
              <div className="space-y-4">
                {followups.map((f: any) => (
                  <div key={f.id} className="border-l-2 border-primary pl-4 py-2">
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(f.followup_date), 'MMM dd, yyyy HH:mm')}
                    </p>
                    <p className="font-medium">{f.outcome || 'No outcome recorded'}</p>
                    <p className="text-sm">{f.notes}</p>
                    {f.next_followup_date && (
                      <p className="text-sm text-primary">Next: {format(new Date(f.next_followup_date), 'MMM dd, yyyy')}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AddLeadDrawer open={showAddDrawer} onOpenChange={setShowAddDrawer} defaultBranchId={effectiveBranchId || ''} />
      <FollowupDrawer open={showFollowupDrawer} onOpenChange={setShowFollowupDrawer} lead={selectedLead} />
      <ConvertMemberDrawer open={showConvertDrawer} onOpenChange={setShowConvertDrawer} lead={selectedLead} />
    </AppLayout>
  );
}

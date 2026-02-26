import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StatCard } from '@/components/ui/stat-card';
import { ClipboardList, Search, Download, ChevronDown, ChevronRight, Activity, Database, AlertCircle, Copy, Filter, RefreshCw, Plus, Pencil, Trash2, ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, formatDistanceToNow, subDays, isToday, isYesterday } from 'date-fns';

export default function AuditLogsPage() {
  const [filters, setFilters] = useState({
    action: 'all',
    table: 'all',
    search: '',
    dateFrom: format(subDays(new Date(), 7), 'yyyy-MM-dd'),
    dateTo: format(new Date(), 'yyyy-MM-dd'),
  });
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 25;

  const { data: logsResult, isLoading, refetch } = useQuery({
    queryKey: ['audit-logs', filters, currentPage],
    queryFn: async () => {
      let query = supabase
        .from('audit_logs')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .gte('created_at', `${filters.dateFrom}T00:00:00`)
        .lte('created_at', `${filters.dateTo}T23:59:59`);

      if (filters.action !== 'all') query = query.eq('action', filters.action);
      if (filters.table !== 'all') query = query.eq('table_name', filters.table);
      if (filters.search) {
        query = query.or(`record_id.ilike.%${filters.search}%,table_name.ilike.%${filters.search}%,actor_name.ilike.%${filters.search}%`);
      }
      query = query.range((currentPage - 1) * pageSize, currentPage * pageSize - 1);

      const { data, error, count } = await query;
      if (error) throw error;
      return { data: data || [], count: count || 0 } as { data: any[]; count: number };
    },
  });

  const { data: tableNames = [] } = useQuery({
    queryKey: ['audit-log-tables'],
    queryFn: async () => {
      const { data } = await supabase.from('audit_logs').select('table_name').limit(100);
      return [...new Set(data?.map(d => d.table_name) || [])].sort();
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['audit-log-stats'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { count: totalCount } = await supabase.from('audit_logs').select('*', { count: 'exact', head: true });
      const { count: todayCount } = await supabase.from('audit_logs').select('*', { count: 'exact', head: true }).gte('created_at', `${today}T00:00:00`);
      const { data: mostActiveTable } = await supabase.from('audit_logs').select('table_name').order('created_at', { ascending: false }).limit(100);
      const tableCounts: Record<string, number> = {};
      mostActiveTable?.forEach(log => { tableCounts[log.table_name] = (tableCounts[log.table_name] || 0) + 1; });
      const topTable = Object.entries(tableCounts).sort((a, b) => b[1] - a[1])[0];
      return { total: totalCount || 0, today: todayCount || 0, mostActiveTable: topTable?.[0] || 'N/A' };
    },
  });

  const getActionStyle = (action: string) => {
    switch (action) {
      case 'INSERT': return { bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20', icon: Plus, label: 'Created' };
      case 'UPDATE': return { bg: 'bg-blue-500/10 text-blue-600 border-blue-500/20', icon: Pencil, label: 'Updated' };
      case 'DELETE': return { bg: 'bg-red-500/10 text-red-600 border-red-500/20', icon: Trash2, label: 'Deleted' };
      default: return { bg: 'bg-muted text-muted-foreground', icon: Activity, label: action };
    }
  };

  const formatTableName = (name: string) => name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const getChangedFieldsCount = (oldData: any, newData: any) => {
    if (!oldData || !newData) return 0;
    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    let count = 0;
    allKeys.forEach(key => {
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) count++;
    });
    return count;
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) newExpanded.delete(id); else newExpanded.add(id);
    setExpandedRows(newExpanded);
  };

  const logs = logsResult || { data: [], count: 0 };
  const totalPages = Math.ceil((logs.count || 0) / pageSize);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const exportToCSV = () => {
    const headers = ['Time', 'Action', 'Table', 'Actor', 'Description', 'Record ID'];
    const rows = logs.data.map((log: any) => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.action, log.table_name, log.actor_name || 'System',
      log.action_description || '', log.record_id || '',
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    toast.success('Exported to CSV');
  };

  const renderDataDiff = (oldData: any, newData: any) => {
    if (!oldData && !newData) return <p className="text-sm text-muted-foreground">No data changes recorded</p>;
    const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
    const changes: { key: string; old: any; new: any }[] = [];
    allKeys.forEach(key => {
      const oldVal = oldData?.[key];
      const newVal = newData?.[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) changes.push({ key, old: oldVal, new: newVal });
    });
    if (changes.length === 0) return <p className="text-sm text-muted-foreground">No field changes detected</p>;
    return (
      <div className="space-y-1.5">
        {changes.map(({ key, old, new: newVal }) => (
          <div key={key} className="flex items-start gap-2 text-sm">
            <span className="font-medium text-foreground min-w-[120px] shrink-0">{key}</span>
            <div className="flex items-center gap-1.5 flex-wrap min-w-0">
              <span className="px-2 py-0.5 rounded bg-red-500/10 text-red-600 font-mono text-xs truncate max-w-[200px]">
                {old !== undefined ? JSON.stringify(old) : '—'}
              </span>
              <ArrowRight className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 font-mono text-xs truncate max-w-[200px]">
                {newVal !== undefined ? JSON.stringify(newVal) : '—'}
              </span>
            </div>
          </div>
        ))}
      </div>
    );
  };

  // Group logs by date
  const groupedLogs: { label: string; date: string; logs: any[] }[] = [];
  const dateMap = new Map<string, any[]>();
  logs.data.forEach((log: any) => {
    const dateKey = format(new Date(log.created_at), 'yyyy-MM-dd');
    if (!dateMap.has(dateKey)) dateMap.set(dateKey, []);
    dateMap.get(dateKey)!.push(log);
  });
  dateMap.forEach((dateLogs, dateKey) => {
    const d = new Date(dateKey);
    const label = isToday(d) ? 'Today' : isYesterday(d) ? 'Yesterday' : format(d, 'EEEE, MMM d, yyyy');
    groupedLogs.push({ label, date: dateKey, logs: dateLogs });
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard title="Total Logs" value={stats?.total || 0} icon={Database} variant="default" />
          <StatCard title="Today's Activity" value={stats?.today || 0} icon={Activity} variant="info" />
          <StatCard title="Most Active" value={stats?.mostActiveTable ? formatTableName(stats.mostActiveTable) : 'N/A'} icon={ClipboardList} variant="accent" />
          <StatCard title="Page" value={`${currentPage} / ${totalPages || 1}`} icon={AlertCircle} variant="warning" />
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}><Download className="h-4 w-4 mr-2" />Export</Button>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2"><Filter className="h-4 w-4" /><CardTitle className="text-base">Filters</CardTitle></div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Actor, table, record..." value={filters.search} onChange={(e) => setFilters({ ...filters, search: e.target.value })} className="pl-9" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={filters.action} onValueChange={(v) => setFilters({ ...filters, action: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="INSERT">Created</SelectItem>
                    <SelectItem value="UPDATE">Updated</SelectItem>
                    <SelectItem value="DELETE">Deleted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Table</Label>
                <Select value={filters.table} onValueChange={(v) => setFilters({ ...filters, table: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tables</SelectItem>
                    {tableNames.map((t) => (<SelectItem key={t} value={t}>{formatTableName(t)}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>From</Label>
                <Input type="date" value={filters.dateFrom} onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>To</Label>
                <Input type="date" value={filters.dateTo} onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity Timeline ({logs.count || 0} records)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : logs.data.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No audit logs found</p>
              </div>
            ) : (
              <div className="space-y-6">
                {groupedLogs.map(group => (
                  <div key={group.date}>
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-sm font-semibold text-foreground">{group.label}</h3>
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground">{group.logs.length} events</span>
                    </div>
                    <div className="relative pl-6 space-y-0">
                      {/* Timeline connector */}
                      <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />

                      {group.logs.map((log: any) => {
                        const style = getActionStyle(log.action);
                        const ActionIcon = style.icon;
                        const actorDisplay = log.actor_name || (log.user_id ? 'Staff' : 'System');
                        const changedCount = log.action === 'UPDATE' ? getChangedFieldsCount(log.old_data, log.new_data) : 0;

                        return (
                          <Collapsible key={log.id} open={expandedRows.has(log.id)}>
                            <div className="relative">
                              {/* Timeline dot */}
                              <div className={`absolute -left-6 top-4 h-[22px] w-[22px] rounded-full border-2 border-background flex items-center justify-center ${
                                log.action === 'INSERT' ? 'bg-emerald-500' : log.action === 'DELETE' ? 'bg-red-500' : 'bg-blue-500'
                              }`}>
                                <ActionIcon className="h-3 w-3 text-white" />
                              </div>

                              <CollapsibleTrigger asChild>
                                <div
                                  className="ml-2 border rounded-lg mb-2 cursor-pointer hover:bg-muted/50 transition-colors"
                                  onClick={() => toggleRow(log.id)}
                                >
                                  <div className="flex items-start justify-between p-3 gap-3">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap mb-1">
                                        <span className="font-semibold text-sm text-foreground">{actorDisplay}</span>
                                        <span className="text-sm text-muted-foreground">{style.label.toLowerCase()}</span>
                                        <Badge variant="outline" className="text-xs font-normal px-1.5 py-0">{formatTableName(log.table_name)}</Badge>
                                        {changedCount > 0 && (
                                          <span className="text-xs text-muted-foreground">({changedCount} field{changedCount !== 1 ? 's' : ''})</span>
                                        )}
                                      </div>
                                      {log.action_description && (
                                        <p className="text-xs text-muted-foreground truncate">{log.action_description}</p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                      <span className="text-xs text-muted-foreground whitespace-nowrap" title={format(new Date(log.created_at), 'PPpp')}>
                                        {format(new Date(log.created_at), 'h:mm a')}
                                      </span>
                                      {expandedRows.has(log.id) ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <div className="ml-2 mb-2 border border-t-0 rounded-b-lg -mt-2 px-4 pb-4 pt-3 bg-muted/30">
                                  <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                      <h4 className="font-medium text-sm mb-2">Details</h4>
                                      <dl className="space-y-1.5 text-sm">
                                        <div className="flex justify-between">
                                          <dt className="text-muted-foreground">Table</dt>
                                          <dd>{formatTableName(log.table_name)}</dd>
                                        </div>
                                        <div className="flex justify-between">
                                          <dt className="text-muted-foreground">Record ID</dt>
                                          <dd className="font-mono flex items-center gap-1 text-xs">
                                            {log.record_id?.substring(0, 8) || '—'}
                                            {log.record_id && (
                                              <Button size="icon" variant="ghost" className="h-5 w-5" onClick={(e) => { e.stopPropagation(); copyToClipboard(log.record_id); }}>
                                                <Copy className="h-3 w-3" />
                                              </Button>
                                            )}
                                          </dd>
                                        </div>
                                        <div className="flex justify-between">
                                          <dt className="text-muted-foreground">Actor</dt>
                                          <dd>{actorDisplay}</dd>
                                        </div>
                                        <div className="flex justify-between">
                                          <dt className="text-muted-foreground">Time</dt>
                                          <dd>{format(new Date(log.created_at), 'PPpp')}</dd>
                                        </div>
                                        {log.ip_address && (
                                          <div className="flex justify-between">
                                            <dt className="text-muted-foreground">IP</dt>
                                            <dd className="font-mono text-xs">{log.ip_address}</dd>
                                          </div>
                                        )}
                                      </dl>
                                    </div>
                                    <div>
                                      <h4 className="font-medium text-sm mb-2">
                                        {log.action === 'UPDATE' ? 'Changes' : log.action === 'INSERT' ? 'New Data' : 'Deleted Data'}
                                      </h4>
                                      {log.action === 'UPDATE' ? renderDataDiff(log.old_data, log.new_data)
                                        : log.action === 'INSERT' ? (
                                          <pre className="text-xs font-mono bg-muted/50 p-2 rounded max-h-48 overflow-auto whitespace-pre-wrap">
                                            {JSON.stringify(log.new_data, null, 2)}
                                          </pre>
                                        ) : (
                                          <pre className="text-xs font-mono bg-muted/50 p-2 rounded max-h-48 overflow-auto whitespace-pre-wrap">
                                            {JSON.stringify(log.old_data, null, 2)}
                                          </pre>
                                        )}
                                    </div>
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </div>
                          </Collapsible>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * pageSize) + 1} – {Math.min(currentPage * pageSize, logs.count || 0)} of {logs.count || 0}
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
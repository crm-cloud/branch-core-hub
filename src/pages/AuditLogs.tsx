import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { StatCard } from '@/components/ui/stat-card';
import { ClipboardList, Search, Download, ChevronDown, ChevronRight, Activity, Database, AlertCircle, Copy, Filter, RefreshCw } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, formatDistanceToNow, subDays } from 'date-fns';

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

      if (filters.action !== 'all') {
        query = query.eq('action', filters.action);
      }
      if (filters.table !== 'all') {
        query = query.eq('table_name', filters.table);
      }
      if (filters.search) {
        query = query.or(`record_id.ilike.%${filters.search}%,table_name.ilike.%${filters.search}%`);
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
      const { data } = await supabase
        .from('audit_logs')
        .select('table_name')
        .limit(100);
      const unique = [...new Set(data?.map(d => d.table_name) || [])];
      return unique.sort();
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['audit-log-stats'],
    queryFn: async () => {
      const today = format(new Date(), 'yyyy-MM-dd');
      const { count: totalCount } = await supabase.from('audit_logs').select('*', { count: 'exact', head: true });
      const { count: todayCount } = await supabase
        .from('audit_logs')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00`);
      const { data: mostActiveTable } = await supabase
        .from('audit_logs')
        .select('table_name')
        .order('created_at', { ascending: false })
        .limit(100);
      
      const tableCounts: Record<string, number> = {};
      mostActiveTable?.forEach(log => {
        tableCounts[log.table_name] = (tableCounts[log.table_name] || 0) + 1;
      });
      const topTable = Object.entries(tableCounts).sort((a, b) => b[1] - a[1])[0];

      return {
        total: totalCount || 0,
        today: todayCount || 0,
        mostActiveTable: topTable?.[0] || 'N/A',
      };
    },
  });

  const getActionColor = (action: string) => {
    const colors: Record<string, string> = {
      INSERT: 'bg-success/10 text-success border-success/20',
      UPDATE: 'bg-info/10 text-info border-info/20',
      DELETE: 'bg-destructive/10 text-destructive border-destructive/20',
    };
    return colors[action] || 'bg-muted text-muted-foreground';
  };

  const getActionIcon = (action: string) => {
    switch (action) {
      case 'INSERT': return '+';
      case 'UPDATE': return '~';
      case 'DELETE': return '−';
      default: return '?';
    }
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedRows(newExpanded);
  };

  const logs = logsResult || { data: [], count: 0 };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const exportToCSV = () => {
    const headers = ['Time', 'Action', 'Table', 'Record ID', 'IP Address', 'User Agent'];
    const rows = logs.data.map((log: any) => [
      format(new Date(log.created_at), 'yyyy-MM-dd HH:mm:ss'),
      log.action,
      log.table_name,
      log.record_id || '',
      log.ip_address || '',
      log.user_agent || '',
    ]);
    
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    toast.success('Exported to CSV');
  };

  const renderDataDiff = (oldData: any, newData: any) => {
    if (!oldData && !newData) return <p className="text-muted-foreground text-sm">No data changes recorded</p>;

    const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})]);
    const changes: { key: string; old: any; new: any }[] = [];

    allKeys.forEach(key => {
      const oldVal = oldData?.[key];
      const newVal = newData?.[key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({ key, old: oldVal, new: newVal });
      }
    });

    if (changes.length === 0) {
      return <p className="text-muted-foreground text-sm">No field changes detected</p>;
    }

    return (
      <div className="space-y-2">
        {changes.map(({ key, old, new: newVal }) => (
          <div key={key} className="grid grid-cols-3 gap-2 text-sm font-mono">
            <div className="font-medium text-foreground">{key}</div>
            <div className="bg-destructive/10 text-destructive px-2 py-1 rounded truncate">
              {old !== undefined ? JSON.stringify(old) : '—'}
            </div>
            <div className="bg-success/10 text-success px-2 py-1 rounded truncate">
              {newVal !== undefined ? JSON.stringify(newVal) : '—'}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const totalPages = Math.ceil((logs.count || 0) / pageSize);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Stats Row */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard
            title="Total Logs"
            value={stats?.total || 0}
            icon={Database}
            variant="default"
          />
          <StatCard
            title="Today's Activity"
            value={stats?.today || 0}
            icon={Activity}
            variant="info"
          />
          <StatCard
            title="Most Active Table"
            value={stats?.mostActiveTable || 'N/A'}
            icon={ClipboardList}
            variant="accent"
          />
          <StatCard
            title="Current Page"
            value={`${currentPage} / ${totalPages || 1}`}
            icon={AlertCircle}
            variant="warning"
          />
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Audit Logs</h1>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportToCSV}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <CardTitle className="text-base">Filters</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-5">
              <div className="space-y-2">
                <Label>Search</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Record ID or table..."
                    value={filters.search}
                    onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Action</Label>
                <Select value={filters.action} onValueChange={(v) => setFilters({ ...filters, action: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="INSERT">INSERT</SelectItem>
                    <SelectItem value="UPDATE">UPDATE</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Table</Label>
                <Select value={filters.table} onValueChange={(v) => setFilters({ ...filters, table: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Tables</SelectItem>
                    {tableNames.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Logs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Activity Log ({logs.count || 0} records)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : logs.data.length === 0 ? (
              <div className="text-center py-12">
                <ClipboardList className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-muted-foreground">No audit logs found matching your criteria</p>
              </div>
            ) : (
              <div className="space-y-2">
                {logs.data.map((log: any) => (
                  <Collapsible key={log.id} open={expandedRows.has(log.id)}>
                    <div className="border rounded-lg">
                      <CollapsibleTrigger asChild>
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => toggleRow(log.id)}
                        >
                          <div className="flex items-center gap-4">
                            {expandedRows.has(log.id) ? (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 text-muted-foreground" />
                            )}
                            <Badge className={`${getActionColor(log.action)} font-mono text-xs px-2`}>
                              {getActionIcon(log.action)} {log.action}
                            </Badge>
                            <span className="font-mono text-sm font-medium">{log.table_name}</span>
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-muted-foreground font-mono">
                                {log.record_id?.substring(0, 8) || '—'}
                              </span>
                              {log.record_id && (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-5 w-5"
                                  onClick={(e) => { e.stopPropagation(); copyToClipboard(log.record_id); }}
                                >
                                  <Copy className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            {log.ip_address && (
                              <span className="hidden md:inline font-mono text-xs">{log.ip_address}</span>
                            )}
                            <span title={format(new Date(log.created_at), 'PPpp')}>
                              {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 pt-2 border-t bg-muted/30">
                          <div className="grid gap-4 md:grid-cols-2">
                            <div>
                              <h4 className="font-medium text-sm mb-2">Details</h4>
                              <dl className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <dt className="text-muted-foreground">Full Record ID:</dt>
                                  <dd className="font-mono">{log.record_id || '—'}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt className="text-muted-foreground">IP Address:</dt>
                                  <dd className="font-mono">{log.ip_address || '—'}</dd>
                                </div>
                                <div className="flex justify-between">
                                  <dt className="text-muted-foreground">Time:</dt>
                                  <dd>{format(new Date(log.created_at), 'PPpp')}</dd>
                                </div>
                                {log.user_agent && (
                                  <div className="flex flex-col">
                                    <dt className="text-muted-foreground">User Agent:</dt>
                                    <dd className="text-xs truncate">{log.user_agent}</dd>
                                  </div>
                                )}
                              </dl>
                            </div>
                            <div>
                              <h4 className="font-medium text-sm mb-2">Data Changes</h4>
                              <div className="grid grid-cols-3 gap-2 text-xs font-medium text-muted-foreground mb-2">
                                <span>Field</span>
                                <span>Old Value</span>
                                <span>New Value</span>
                              </div>
                              {renderDataDiff(log.old_data, log.new_data)}
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <p className="text-sm text-muted-foreground">
                  Showing {((currentPage - 1) * pageSize) + 1} - {Math.min(currentPage * pageSize, logs.count || 0)} of {logs.count || 0}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

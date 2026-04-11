import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import {
  Activity, ToggleLeft, FlaskConical, ChevronDown, ChevronRight,
  Phone, Clock, RefreshCw, Play, Loader2, ExternalLink, AlertTriangle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// Tool definitions matching the edge function
const AI_TOOLS = [
  { name: 'get_membership_status', description: 'Check membership status, plan, expiry, and pending dues' },
  { name: 'get_benefit_balance', description: 'Get remaining benefit credits (sauna, ice bath, classes)' },
  { name: 'get_available_slots', description: 'List available facility booking slots' },
  { name: 'book_facility_slot', description: 'Book a specific facility slot for a member' },
  { name: 'cancel_facility_booking', description: 'Cancel an existing facility booking' },
  { name: 'get_pt_balance', description: 'Get personal training session balance' },
  { name: 'transfer_to_human', description: 'Transfer conversation to human staff' },
];

export function AIAgentControlCenter() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [testTool, setTestTool] = useState('');
  const [testArgs, setTestArgs] = useState('{}');
  const [testResult, setTestResult] = useState<any>(null);
  const [testRunning, setTestRunning] = useState(false);

  // ─── Section A: Activity Feed ────────────────────────────────────────────────
  const { data: toolLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['ai-tool-logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_tool_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    refetchInterval: 10000,
  });

  // ─── Section B: Tool Config ──────────────────────────────────────────────────
  const { data: orgSettings, isLoading: configLoading } = useQuery({
    queryKey: ['ai-tool-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_settings')
        .select('id, ai_tool_config')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const toolConfig = (orgSettings?.ai_tool_config as Record<string, boolean>) || {};

  const toggleTool = useMutation({
    mutationFn: async ({ toolName, enabled }: { toolName: string; enabled: boolean }) => {
      const newConfig = { ...toolConfig, [toolName]: enabled };
      if (!orgSettings?.id) throw new Error('Organization settings not found');
      const { error } = await supabase
        .from('organization_settings')
        .update({ ai_tool_config: newConfig })
        .eq('id', orgSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-tool-config'] });
      toast.success('Tool config updated');
    },
    onError: () => toast.error('Failed to update tool config'),
  });

  // ─── Section C: Manual Test Lab ──────────────────────────────────────────────
  const handleTestExecute = async () => {
    if (!testTool) { toast.error('Select a tool first'); return; }
    try {
      JSON.parse(testArgs);
    } catch {
      toast.error('Invalid JSON arguments');
      return;
    }
    setTestRunning(true);
    setTestResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('test-ai-tool', {
        body: { tool_name: testTool, arguments: JSON.parse(testArgs) },
      });
      if (error) throw error;
      setTestResult(data);
    } catch (e: any) {
      setTestResult({ error: e.message || 'Execution failed' });
    } finally {
      setTestRunning(false);
    }
  };

  // ─── Stats ───────────────────────────────────────────────────────────────────
  const totalCalls = toolLogs?.length || 0;
  const errorCalls = toolLogs?.filter(l => l.status === 'error').length || 0;
  const successRate = totalCalls > 0 ? Math.round(((totalCalls - errorCalls) / totalCalls) * 100) : 100;
  const avgDuration = totalCalls > 0
    ? Math.round((toolLogs?.reduce((s, l) => s + (l.execution_time_ms || 0), 0) || 0) / totalCalls)
    : 0;

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="rounded-xl shadow-lg shadow-slate-200/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-emerald-50 text-emerald-600 p-2.5 rounded-full"><Activity className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{totalCalls}</p>
              <p className="text-xs text-muted-foreground">Tool Calls (Last 50)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-lg shadow-slate-200/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-indigo-50 text-indigo-600 p-2.5 rounded-full"><Activity className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{successRate}%</p>
              <p className="text-xs text-muted-foreground">Success Rate</p>
            </div>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-lg shadow-slate-200/50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="bg-amber-50 text-amber-600 p-2.5 rounded-full"><Clock className="h-5 w-5" /></div>
            <div>
              <p className="text-2xl font-bold text-foreground">{avgDuration}ms</p>
              <p className="text-xs text-muted-foreground">Avg Duration</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Section A: Live Activity Feed */}
      <Card className="rounded-xl shadow-lg shadow-slate-200/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Live Activity Feed
              </CardTitle>
              <CardDescription>Real-time AI tool execution log (auto-refreshes every 10s)</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['ai-tool-logs'] })}
              className="gap-1.5 rounded-lg"
            >
              <RefreshCw className="h-3.5 w-3.5" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : !toolLogs || toolLogs.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No tool executions yet. Activity will appear here when the AI agent uses tools.</p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[40px]" />
                    <TableHead>Time</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Tool</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {toolLogs.map((log: any) => (
                    <Collapsible key={log.id} open={expandedRow === log.id} onOpenChange={(open) => setExpandedRow(open ? log.id : null)} asChild>
                      <>
                        <CollapsibleTrigger asChild>
                          <TableRow className="cursor-pointer">
                            <TableCell>
                              {expandedRow === log.id ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(log.created_at), 'MMM dd, HH:mm:ss')}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{log.phone_number || '—'}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="font-mono text-xs">{log.tool_name}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge className={log.status === 'success'
                                ? 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30 hover:bg-emerald-500/20'
                                : 'bg-red-500/15 text-red-700 border-red-500/30 hover:bg-red-500/20'
                              }>
                                {log.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{log.execution_time_ms}ms</TableCell>
                            <TableCell>
                              {log.status === 'error' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="gap-1 text-xs h-7 text-amber-600 hover:text-amber-700"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/whatsapp-chat?phone=${encodeURIComponent(log.phone_number || '')}`);
                                  }}
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  Handle Manually
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        </CollapsibleTrigger>
                        <CollapsibleContent asChild>
                          <TableRow className="bg-muted/30 hover:bg-muted/30">
                            <TableCell colSpan={7} className="p-4">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">Arguments</p>
                                  <pre className="text-xs bg-background rounded-lg p-3 overflow-auto max-h-40 border">
                                    {JSON.stringify(log.arguments, null, 2)}
                                  </pre>
                                </div>
                                <div>
                                  <p className="text-xs font-semibold text-muted-foreground mb-1">Result</p>
                                  <pre className={`text-xs rounded-lg p-3 overflow-auto max-h-40 border ${log.status === 'error' ? 'bg-red-50 border-red-200' : 'bg-background'}`}>
                                    {JSON.stringify(log.result, null, 2)}
                                  </pre>
                                  {log.error_message && (
                                    <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                                      <AlertTriangle className="h-3 w-3" /> {log.error_message}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section B: Tool Toggle Panel */}
      <Card className="rounded-xl shadow-lg shadow-slate-200/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <ToggleLeft className="h-5 w-5 text-primary" />
            Tool Toggle Panel
          </CardTitle>
          <CardDescription>Enable or disable specific AI tools. Disabled tools will not be available to the AI agent.</CardDescription>
        </CardHeader>
        <CardContent>
          {configLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : (
            <div className="space-y-1">
              {AI_TOOLS.map((tool) => {
                const isEnabled = toolConfig[tool.name] !== false;
                return (
                  <div
                    key={tool.name}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm font-medium text-foreground">{tool.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{tool.description}</p>
                    </div>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) => toggleTool.mutate({ toolName: tool.name, enabled: checked })}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section C: Manual Test Lab */}
      <Card className="rounded-xl shadow-lg shadow-slate-200/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <FlaskConical className="h-5 w-5 text-primary" />
            Manual Test Lab
          </CardTitle>
          <CardDescription>Test AI tool functions directly with custom arguments.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Tool</label>
              <Select value={testTool} onValueChange={setTestTool}>
                <SelectTrigger className="rounded-lg">
                  <SelectValue placeholder="Choose a tool..." />
                </SelectTrigger>
                <SelectContent>
                  {AI_TOOLS.map((t) => (
                    <SelectItem key={t.name} value={t.name}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Arguments (JSON)</label>
              <Textarea
                value={testArgs}
                onChange={(e) => setTestArgs(e.target.value)}
                placeholder='{"key": "value"}'
                className="font-mono text-xs rounded-lg min-h-[80px]"
              />
            </div>
          </div>
          <Button
            onClick={handleTestExecute}
            disabled={testRunning || !testTool}
            className="gap-2 rounded-lg"
          >
            {testRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Execute
          </Button>
          {testResult && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-muted-foreground mb-1">Result</p>
              <pre className={`text-xs rounded-lg p-4 overflow-auto max-h-60 border ${testResult.error ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-200'}`}>
                {JSON.stringify(testResult, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

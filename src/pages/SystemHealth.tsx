import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, AlertTriangle, CheckCircle, Copy, Sparkles, Clock, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface ErrorLog {
  id: string;
  user_id: string | null;
  error_message: string;
  stack_trace: string | null;
  component_name: string | null;
  route: string | null;
  browser_info: string | null;
  status: string;
  resolved_at: string | null;
  resolved_by: string | null;
  created_at: string;
}

export default function SystemHealth() {
  const [selectedError, setSelectedError] = useState<ErrorLog | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState('');
  const [tab, setTab] = useState('all');
  const queryClient = useQueryClient();

  const { data: errors = [], isLoading } = useQuery({
    queryKey: ['error-logs', tab],
    queryFn: async () => {
      let query = (supabase.from('error_logs') as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (tab === 'open') query = query.eq('status', 'open');
      if (tab === 'resolved') query = query.eq('status', 'resolved');

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ErrorLog[];
    },
  });

  const resolveError = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase.from('error_logs') as any)
        .update({ status: 'resolved', resolved_at: new Date().toISOString(), resolved_by: user?.id })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['error-logs'] });
      toast.success('Error marked as resolved');
      setDrawerOpen(false);
    },
  });

  const openErrors = errors.filter((e: ErrorLog) => e.status === 'open');
  const resolvedErrors = errors.filter((e: ErrorLog) => e.status === 'resolved');
  const todayErrors = errors.filter((e: ErrorLog) => {
    const today = new Date().toDateString();
    return new Date(e.created_at).toDateString() === today;
  });

  const handleViewError = (err: ErrorLog) => {
    setSelectedError(err);
    setGeneratedPrompt('');
    setDrawerOpen(true);
  };

  const generatePrompt = (err: ErrorLog) => {
    const prompt = `I have an error in my React application. The component crashed at route: ${err.route || 'unknown'}. The error message is: ${err.error_message}. Here is the stack trace: ${err.stack_trace || 'N/A'}. Please audit the relevant components and provide the code to fix this issue.`;
    setGeneratedPrompt(prompt);
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedPrompt);
    toast.success('Prompt copied to clipboard');
  };

  const stats = [
    { label: 'Total Errors', value: errors.length, icon: Activity, color: 'text-primary' },
    { label: 'Open', value: openErrors.length, icon: AlertTriangle, color: 'text-destructive' },
    { label: 'Resolved', value: resolvedErrors.length, icon: CheckCircle, color: 'text-primary' },
    { label: 'Today', value: todayErrors.length, icon: Clock, color: 'text-accent-foreground' },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">System Health</h1>
          <p className="text-muted-foreground text-sm">Monitor frontend errors and generate AI fix prompts.</p>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((s) => (
            <Card key={s.label}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`p-2 rounded-lg bg-muted ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Error Table */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Error Logs</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="mb-4">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="open">Open</TabsTrigger>
                <TabsTrigger value="resolved">Resolved</TabsTrigger>
              </TabsList>

              <TabsContent value={tab}>
                {isLoading ? (
                  <p className="text-muted-foreground text-sm py-8 text-center">Loading...</p>
                ) : errors.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-primary mx-auto mb-3" />
                    <p className="text-muted-foreground">No errors found. System is healthy!</p>
                  </div>
                ) : (
                  <div className="overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Time</TableHead>
                          <TableHead>Route</TableHead>
                          <TableHead>Error Message</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {errors.map((err: ErrorLog) => (
                          <TableRow key={err.id}>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(err.created_at), 'MMM d, HH:mm')}
                            </TableCell>
                            <TableCell className="font-mono text-xs">{err.route || '—'}</TableCell>
                            <TableCell className="max-w-[300px] truncate text-sm">{err.error_message}</TableCell>
                            <TableCell>
                              <Badge variant={err.status === 'open' ? 'destructive' : 'secondary'}>
                                {err.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <Button size="sm" variant="ghost" onClick={() => handleViewError(err)}>
                                <Eye className="h-4 w-4 mr-1" /> View
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Detail Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Error Details
            </SheetTitle>
          </SheetHeader>

          {selectedError && (
            <div className="space-y-4 mt-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Error Message</p>
                <p className="text-sm text-foreground bg-muted p-3 rounded-md">{selectedError.error_message}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Route</p>
                  <p className="text-sm font-mono">{selectedError.route || '—'}</p>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Status</p>
                  <Badge variant={selectedError.status === 'open' ? 'destructive' : 'secondary'}>
                    {selectedError.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Time</p>
                  <p className="text-sm">{format(new Date(selectedError.created_at), 'PPpp')}</p>
                </div>
              </div>

              {selectedError.component_name && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Component Stack</p>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-32 whitespace-pre-wrap">
                    {selectedError.component_name}
                  </pre>
                </div>
              )}

              {selectedError.stack_trace && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Stack Trace</p>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-auto max-h-48 whitespace-pre-wrap">
                    {selectedError.stack_trace}
                  </pre>
                </div>
              )}

              {selectedError.browser_info && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1">Browser</p>
                  <p className="text-xs text-muted-foreground break-all">{selectedError.browser_info}</p>
                </div>
              )}

              <div className="flex gap-2 pt-2">
                {selectedError.status === 'open' && (
                  <Button
                    variant="outline"
                    onClick={() => resolveError.mutate(selectedError.id)}
                    disabled={resolveError.isPending}
                  >
                    <CheckCircle className="h-4 w-4 mr-1" /> Mark Resolved
                  </Button>
                )}
                <Button onClick={() => generatePrompt(selectedError)}>
                  <Sparkles className="h-4 w-4 mr-1" /> Generate AI Fix Prompt
                </Button>
              </div>

              {generatedPrompt && (
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-medium text-muted-foreground">AI Fix Prompt</p>
                  <Textarea
                    value={generatedPrompt}
                    readOnly
                    className="min-h-[120px] text-sm font-mono"
                  />
                  <Button variant="outline" size="sm" onClick={copyToClipboard}>
                    <Copy className="h-4 w-4 mr-1" /> Copy to Clipboard
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}

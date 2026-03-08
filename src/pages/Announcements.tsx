import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plus, Megaphone, MessageSquare, Mail, Phone, Send, Trash2, FileText, Copy, Radio, Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communicationService } from '@/services/communicationService';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { AddAnnouncementDrawer } from '@/components/announcements/AddAnnouncementDrawer';
import { BroadcastDrawer } from '@/components/announcements/BroadcastDrawer';
import { useBranchContext } from '@/contexts/BranchContext';
import { supabase } from '@/integrations/supabase/client';

export default function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const { effectiveBranchId: defaultBranchId = '' } = useBranchContext();
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showBroadcastDrawer, setShowBroadcastDrawer] = useState(false);
  const [broadcastType, setBroadcastType] = useState<'sms' | 'email' | 'whatsapp'>('whatsapp');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('announcements');

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => communicationService.fetchAnnouncements(),
  });

  const { data: commLogs = [], isLoading: logsLoading } = useQuery({
    queryKey: ['communication-logs'],
    queryFn: () => communicationService.fetchCommunicationLogs(),
    refetchInterval: 10000,
  });

  const { data: dbTemplates = [] } = useQuery({
    queryKey: ['db-templates'],
    queryFn: () => communicationService.fetchTemplates(),
  });

  // Realtime subscription for communication logs
  useEffect(() => {
    const channel = supabase
      .channel('comm-logs-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'communication_logs' }, () => {
        queryClient.invalidateQueries({ queryKey: ['communication-logs'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => communicationService.deleteAnnouncement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Announcement deleted');
    },
  });

  const handleTemplateSelect = (type: 'sms' | 'email' | 'whatsapp', content: string) => {
    setBroadcastType(type);
    setBroadcastMessage(content);
    setTemplateSheetOpen(false);
    setShowBroadcastDrawer(true);
  };

  const sentCount = commLogs.filter((l: any) => l.status === 'sent').length;
  const failedCount = commLogs.filter((l: any) => l.status === 'failed').length;
  const whatsappCount = commLogs.filter((l: any) => l.type === 'whatsapp').length;
  const smsCount = commLogs.filter((l: any) => l.type === 'sms').length;
  const emailCount = commLogs.filter((l: any) => l.type === 'email').length;

  const getChannelIcon = (type: string) => {
    switch (type) {
      case 'whatsapp': return <MessageSquare className="h-4 w-4 text-emerald-500" />;
      case 'sms': return <Phone className="h-4 w-4 text-sky-500" />;
      case 'email': return <Mail className="h-4 w-4 text-amber-500" />;
      default: return <Send className="h-4 w-4" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent': return <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 gap-1"><CheckCircle className="h-3 w-3" />Sent</Badge>;
      case 'failed': return <Badge className="bg-destructive/10 text-destructive border-destructive/30 gap-1"><AlertCircle className="h-3 w-3" />Failed</Badge>;
      case 'pending': return <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
      default: return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
                <Radio className="h-6 w-6" />
              </div>
              Communication Hub
            </h1>
            <p className="text-muted-foreground mt-1">Manage announcements, broadcasts, and view communication logs in real-time</p>
          </div>
          <div className="flex gap-2">
            <Sheet open={templateSheetOpen} onOpenChange={setTemplateSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" className="gap-2 rounded-xl"><FileText className="h-4 w-4" />Templates</Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[500px] sm:max-w-[500px]">
                <SheetHeader><SheetTitle>Message Templates</SheetTitle></SheetHeader>
                <div className="mt-6 space-y-4">
                  <Tabs defaultValue="whatsapp">
                    <TabsList className="w-full rounded-xl">
                      <TabsTrigger value="whatsapp" className="flex-1 rounded-lg gap-1"><MessageSquare className="h-3.5 w-3.5" />WhatsApp</TabsTrigger>
                      <TabsTrigger value="sms" className="flex-1 rounded-lg gap-1"><Phone className="h-3.5 w-3.5" />SMS</TabsTrigger>
                      <TabsTrigger value="email" className="flex-1 rounded-lg gap-1"><Mail className="h-3.5 w-3.5" />Email</TabsTrigger>
                    </TabsList>
                    {(['whatsapp', 'sms', 'email'] as const).map((type) => {
                      const allTemplates = (dbTemplates || [])
                        .filter((t: any) => t.type === type && t.is_active !== false)
                        .map((t: any) => ({ id: t.id, name: t.name, content: t.content, category: t.type, isDb: true }));
                      return (
                        <TabsContent key={type} value={type} className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto">
                          {allTemplates.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-8">No templates for this channel</p>
                          ) : allTemplates.map((template) => (
                            <Card key={template.id} className="cursor-pointer hover:border-primary/50 transition-colors rounded-xl" onClick={() => handleTemplateSelect(type, template.content)}>
                              <CardHeader className="pb-2">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-sm font-medium">{template.name}</CardTitle>
                                  <Badge variant="outline" className="text-xs capitalize rounded-full">{template.category}</Badge>
                                </div>
                              </CardHeader>
                              <CardContent>
                                <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{template.content.slice(0, 150)}...</p>
                                <Button variant="ghost" size="sm" className="mt-2 w-full rounded-lg" onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(template.content);
                                  toast.success('Template copied');
                                }}>
                                  <Copy className="h-3 w-3 mr-1" />Copy
                                </Button>
                              </CardContent>
                            </Card>
                          ))}
                        </TabsContent>
                      );
                    })}
                  </Tabs>
                </div>
              </SheetContent>
            </Sheet>
            <Button variant="outline" onClick={() => setShowBroadcastDrawer(true)} className="gap-2 rounded-xl">
              <Send className="h-4 w-4" />Broadcast
            </Button>
            <Button onClick={() => setShowAddDrawer(true)} className="gap-2 rounded-xl shadow-lg shadow-primary/20">
              <Plus className="h-4 w-4" />New Announcement
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
          <Card className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground border-0 shadow-lg shadow-primary/20 rounded-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-16 h-16 bg-white/10 rounded-full -translate-y-4 translate-x-4" />
            <CardContent className="pt-5 pb-4 relative z-10">
              <Megaphone className="h-4 w-4 opacity-80 mb-1.5" />
              <div className="text-2xl font-bold">{announcements.length}</div>
              <p className="text-xs opacity-80">Announcements</p>
            </CardContent>
          </Card>
          <Card className="bg-card border border-border/50 shadow-lg shadow-primary/5 rounded-2xl">
            <CardContent className="pt-5 pb-4">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 w-fit mb-1.5"><CheckCircle className="h-4 w-4 text-emerald-600" /></div>
              <div className="text-2xl font-bold text-foreground">{sentCount}</div>
              <p className="text-xs text-muted-foreground">Messages Sent</p>
            </CardContent>
          </Card>
          <Card className="bg-card border border-border/50 shadow-lg shadow-primary/5 rounded-2xl">
            <CardContent className="pt-5 pb-4">
              <div className="p-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 w-fit mb-1.5"><MessageSquare className="h-4 w-4 text-emerald-500" /></div>
              <div className="text-2xl font-bold text-foreground">{whatsappCount}</div>
              <p className="text-xs text-muted-foreground">WhatsApp</p>
            </CardContent>
          </Card>
          <Card className="bg-card border border-border/50 shadow-lg shadow-slate-200/50 rounded-2xl">
            <CardContent className="pt-5 pb-4">
              <div className="p-1.5 rounded-lg bg-sky-50 dark:bg-sky-500/10 w-fit mb-1.5"><Phone className="h-4 w-4 text-sky-500" /></div>
              <div className="text-2xl font-bold text-foreground">{smsCount}</div>
              <p className="text-xs text-muted-foreground">SMS</p>
            </CardContent>
          </Card>
          <Card className="bg-card border border-border/50 shadow-lg shadow-slate-200/50 rounded-2xl">
            <CardContent className="pt-5 pb-4">
              <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10 w-fit mb-1.5"><Mail className="h-4 w-4 text-amber-500" /></div>
              <div className="text-2xl font-bold text-foreground">{emailCount}</div>
              <p className="text-xs text-muted-foreground">Email</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/50 rounded-xl">
            <TabsTrigger value="announcements" className="rounded-lg gap-2"><Megaphone className="h-3.5 w-3.5" />Announcements ({announcements.length})</TabsTrigger>
            <TabsTrigger value="logs" className="rounded-lg gap-2">
              <RefreshCw className="h-3.5 w-3.5" />
              Live Logs ({commLogs.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="announcements" className="mt-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
            ) : announcements.length === 0 ? (
              <Card className="rounded-2xl shadow-lg">
                <CardContent className="py-16 text-center">
                  <div className="mx-auto w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-4">
                    <Megaphone className="h-8 w-8 text-primary/50" />
                  </div>
                  <h3 className="font-semibold text-lg mb-1">No Announcements</h3>
                  <p className="text-sm text-muted-foreground mb-4">Create your first announcement to notify members</p>
                  <Button onClick={() => setShowAddDrawer(true)} className="gap-2 rounded-xl"><Plus className="h-4 w-4" />New Announcement</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {announcements.map((announcement: any) => (
                  <Card key={announcement.id} className="rounded-2xl border-border/50 shadow-lg hover:shadow-xl transition-shadow">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-4 flex-1">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center flex-shrink-0">
                            <Megaphone className="h-5 w-5 text-primary" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-bold text-foreground">{announcement.title}</h3>
                            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">{announcement.content}</p>
                            <div className="flex items-center gap-2 mt-3">
                              <Badge variant="outline" className="rounded-full text-xs">{announcement.target_audience || 'All'}</Badge>
                              <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(announcement.created_at), { addSuffix: true })}</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <Badge className={`rounded-full ${announcement.is_active ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30' : 'bg-muted text-muted-foreground'}`}>
                            {announcement.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          <Button size="icon" variant="ghost" className="rounded-xl" onClick={() => deleteMutation.mutate(announcement.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs" className="mt-4">
            <Card className="rounded-2xl border-border/50 shadow-lg">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Real-time Communication Logs
                  </CardTitle>
                  {failedCount > 0 && (
                    <Badge variant="destructive" className="rounded-full">{failedCount} failed</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {commLogs.length === 0 ? (
                  <div className="text-center py-12">
                    <Send className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
                    <p className="text-muted-foreground">No communication logs yet</p>
                  </div>
                ) : (
                  <ScrollArea className="max-h-[500px]">
                    <div className="space-y-2">
                      {commLogs.map((log: any) => (
                        <div key={log.id} className="flex items-center gap-4 p-3 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div className="p-2 rounded-lg bg-card border border-border/50">
                            {getChannelIcon(log.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm text-foreground truncate">{log.recipient}</span>
                              <Badge variant="outline" className="text-[10px] capitalize rounded-full">{log.type}</Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {log.subject ? `${log.subject} — ` : ''}{log.content}
                            </p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            {getStatusBadge(log.status)}
                            <p className="text-[10px] text-muted-foreground mt-1">
                              {format(new Date(log.created_at), 'MMM dd, HH:mm')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AddAnnouncementDrawer open={showAddDrawer} onOpenChange={setShowAddDrawer} />
      <BroadcastDrawer
        open={showBroadcastDrawer}
        onOpenChange={setShowBroadcastDrawer}
        branchId={defaultBranchId}
        initialType={broadcastType}
        initialMessage={broadcastMessage}
      />
    </AppLayout>
  );
}

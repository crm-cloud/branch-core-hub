import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/ui/stat-card';
import { Plus, Megaphone, MessageSquare, Mail, Phone, Send, Trash2, Edit, FileText, Copy } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communicationService } from '@/services/communicationService';
import { messageTemplates, getTemplatesByType } from '@/data/messageTemplates';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AddAnnouncementDrawer } from '@/components/announcements/AddAnnouncementDrawer';
import { BroadcastDrawer } from '@/components/announcements/BroadcastDrawer';

export default function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showBroadcastDrawer, setShowBroadcastDrawer] = useState(false);
  const [broadcastType, setBroadcastType] = useState<'sms' | 'email' | 'whatsapp'>('whatsapp');
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => communicationService.fetchAnnouncements(),
  });

  const { data: commLogs = [] } = useQuery({
    queryKey: ['communication-logs'],
    queryFn: () => communicationService.fetchCommunicationLogs(),
  });

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

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Stats Row */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard
            title="Total Announcements"
            value={announcements.length}
            icon={Megaphone}
            variant="default"
          />
          <StatCard
            title="Active"
            value={announcements.filter((a: any) => a.is_active).length}
            icon={Megaphone}
            variant="success"
          />
          <StatCard
            title="Messages Sent"
            value={commLogs.length}
            icon={Send}
            variant="info"
          />
          <StatCard
            title="Templates"
            value={messageTemplates.length}
            icon={FileText}
            variant="accent"
          />
        </div>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Communication Hub</h1>
          <div className="flex gap-2">
            {/* Templates Sheet */}
            <Sheet open={templateSheetOpen} onOpenChange={setTemplateSheetOpen}>
              <SheetTrigger asChild>
                <Button variant="outline">
                  <FileText className="mr-2 h-4 w-4" />
                  Templates
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-[500px] sm:max-w-[500px]">
                <SheetHeader>
                  <SheetTitle>Message Templates</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <Tabs defaultValue="whatsapp">
                    <TabsList className="w-full">
                      <TabsTrigger value="whatsapp" className="flex-1">
                        <MessageSquare className="h-4 w-4 mr-1" />
                        WhatsApp
                      </TabsTrigger>
                      <TabsTrigger value="sms" className="flex-1">
                        <Phone className="h-4 w-4 mr-1" />
                        SMS
                      </TabsTrigger>
                      <TabsTrigger value="email" className="flex-1">
                        <Mail className="h-4 w-4 mr-1" />
                        Email
                      </TabsTrigger>
                    </TabsList>

                    {(['whatsapp', 'sms', 'email'] as const).map((type) => (
                      <TabsContent key={type} value={type} className="mt-4 space-y-3 max-h-[60vh] overflow-y-auto">
                        {getTemplatesByType(type).map((template) => (
                          <Card
                            key={template.id}
                            className="cursor-pointer hover:border-accent transition-colors"
                            onClick={() => handleTemplateSelect(type, template.content)}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-center justify-between">
                                <CardTitle className="text-sm font-medium">{template.name}</CardTitle>
                                <Badge variant="outline" className="text-xs capitalize">{template.category}</Badge>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                                {template.content.slice(0, 150)}...
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="mt-2 w-full"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigator.clipboard.writeText(template.content);
                                  toast.success('Template copied to clipboard');
                                }}
                              >
                                <Copy className="h-3 w-3 mr-1" />
                                Copy
                              </Button>
                            </CardContent>
                          </Card>
                        ))}
                      </TabsContent>
                    ))}
                  </Tabs>
                </div>
              </SheetContent>
            </Sheet>

            <Button variant="outline" onClick={() => setShowBroadcastDrawer(true)}>
              <Send className="mr-2 h-4 w-4" />
              Broadcast
            </Button>

            <Button onClick={() => setShowAddDrawer(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New Announcement
            </Button>
          </div>
        </div>

        <Tabs defaultValue="announcements" className="space-y-4">
          <TabsList>
            <TabsTrigger value="announcements">Announcements</TabsTrigger>
            <TabsTrigger value="logs">Communication Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="announcements" className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : announcements.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Megaphone className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No announcements yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {announcements.map((announcement: any) => (
                  <Card key={announcement.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                            <Megaphone className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{announcement.title}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(announcement.created_at), 'MMM dd, yyyy HH:mm')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={announcement.is_active ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'}>
                            {announcement.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                          {announcement.priority > 0 && (
                            <Badge variant="secondary">Priority {announcement.priority}</Badge>
                          )}
                          <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(announcement.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm whitespace-pre-wrap">{announcement.content}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <Badge variant="outline">{announcement.target_audience || 'All'}</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            {commLogs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Send className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">No communication logs yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {commLogs.map((log: any) => (
                  <Card key={log.id}>
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {log.type === 'whatsapp' && <MessageSquare className="h-5 w-5 text-success" />}
                          {log.type === 'sms' && <Phone className="h-5 w-5 text-info" />}
                          {log.type === 'email' && <Mail className="h-5 w-5 text-warning" />}
                          <div>
                            <p className="font-medium">{log.recipient}</p>
                            <p className="text-sm text-muted-foreground line-clamp-1">{log.content}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={log.status === 'sent' ? 'default' : 'secondary'}>{log.status}</Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(log.created_at), 'MMM dd, HH:mm')}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      <AddAnnouncementDrawer open={showAddDrawer} onOpenChange={setShowAddDrawer} />
      <BroadcastDrawer
        open={showBroadcastDrawer}
        onOpenChange={setShowBroadcastDrawer}
        initialType={broadcastType}
        initialMessage={broadcastMessage}
      />
    </AppLayout>
  );
}

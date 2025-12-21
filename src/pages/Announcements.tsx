import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/ui/stat-card';
import { Plus, Megaphone, MessageSquare, Mail, Phone, Send, Trash2, Edit, FileText, Copy } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { communicationService } from '@/services/communicationService';
import { messageTemplates, getTemplatesByType, type MessageTemplate } from '@/data/messageTemplates';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function AnnouncementsPage() {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<any>(null);
  const [showBroadcastDialog, setShowBroadcastDialog] = useState(false);
  
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    target_audience: 'all',
    priority: 0,
    is_active: true,
  });
  
  const [selectedTemplate, setSelectedTemplate] = useState<MessageTemplate | null>(null);
  const [templateSheetOpen, setTemplateSheetOpen] = useState(false);
  
  const [broadcastData, setBroadcastData] = useState({
    type: 'whatsapp' as 'sms' | 'email' | 'whatsapp',
    message: '',
    audience: 'all',
  });

  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => communicationService.fetchAnnouncements(),
  });
  
  const { data: commLogs = [] } = useQuery({
    queryKey: ['communication-logs'],
    queryFn: () => communicationService.fetchCommunicationLogs(),
  });

  const createMutation = useMutation({
    mutationFn: () => communicationService.createAnnouncement(formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setShowAddDialog(false);
      setFormData({ title: '', content: '', target_audience: 'all', priority: 0, is_active: true });
      toast.success('Announcement created');
    },
    onError: () => toast.error('Failed to create announcement'),
  });

  const updateMutation = useMutation({
    mutationFn: () => communicationService.updateAnnouncement(editingAnnouncement.id, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      setEditingAnnouncement(null);
      toast.success('Announcement updated');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => communicationService.deleteAnnouncement(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['announcements'] });
      toast.success('Announcement deleted');
    },
  });

  const handleEdit = (announcement: any) => {
    setEditingAnnouncement(announcement);
    setFormData({
      title: announcement.title,
      content: announcement.content,
      target_audience: announcement.target_audience || 'all',
      priority: announcement.priority || 0,
      is_active: announcement.is_active ?? true,
    });
  };

  const handleBroadcast = () => {
    // This would send to all members - for now just log
    toast.success(`Broadcast initiated via ${broadcastData.type}`);
    setShowBroadcastDialog(false);
    setBroadcastData({ type: 'whatsapp' as const, message: '', audience: 'all' });
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
                            onClick={() => {
                              setBroadcastData({ ...broadcastData, type, message: template.content });
                              setTemplateSheetOpen(false);
                              setShowBroadcastDialog(true);
                            }}
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

            <Dialog open={showBroadcastDialog} onOpenChange={setShowBroadcastDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Send className="mr-2 h-4 w-4" />
                  Broadcast
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Broadcast Message</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Channel</Label>
                    <Select value={broadcastData.type} onValueChange={(v: 'sms' | 'email' | 'whatsapp') => setBroadcastData({ ...broadcastData, type: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="whatsapp">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-success" />
                            WhatsApp
                          </div>
                        </SelectItem>
                        <SelectItem value="sms">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-info" />
                            SMS
                          </div>
                        </SelectItem>
                        <SelectItem value="email">
                          <div className="flex items-center gap-2">
                            <Mail className="h-4 w-4 text-warning" />
                            Email
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Audience</Label>
                    <Select value={broadcastData.audience} onValueChange={(v) => setBroadcastData({ ...broadcastData, audience: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Members</SelectItem>
                        <SelectItem value="active">Active Members Only</SelectItem>
                        <SelectItem value="expiring">Expiring Soon</SelectItem>
                        <SelectItem value="expired">Expired Members</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Message</Label>
                    <Textarea
                      value={broadcastData.message}
                      onChange={(e) => setBroadcastData({ ...broadcastData, message: e.target.value })}
                      placeholder="Enter your message..."
                      rows={4}
                    />
                  </div>
                  <Button onClick={handleBroadcast} className="w-full">
                    <Send className="mr-2 h-4 w-4" />
                    Send Broadcast
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            
            <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  New Announcement
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Announcement</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>Title *</Label>
                    <Input
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Announcement title"
                    />
                  </div>
                  <div>
                    <Label>Content *</Label>
                    <Textarea
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="Announcement content..."
                      rows={4}
                    />
                  </div>
                  <div>
                    <Label>Target Audience</Label>
                    <Select value={formData.target_audience} onValueChange={(v) => setFormData({ ...formData, target_audience: v })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Members</SelectItem>
                        <SelectItem value="active">Active Members</SelectItem>
                        <SelectItem value="staff">Staff Only</SelectItem>
                        <SelectItem value="trainers">Trainers Only</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Priority (0-10)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <Label>Active</Label>
                    <Switch
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                  </div>
                  <Button 
                    onClick={() => createMutation.mutate()} 
                    className="w-full"
                    disabled={!formData.title || !formData.content}
                  >
                    Create Announcement
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
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
                          <Button size="icon" variant="ghost" onClick={() => handleEdit(announcement)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(announcement.id)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{announcement.content}</p>
                      {announcement.target_audience && (
                        <Badge variant="outline" className="mt-2">
                          Target: {announcement.target_audience}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="logs">
            <Card>
              <CardHeader>
                <CardTitle>Recent Communications</CardTitle>
              </CardHeader>
              <CardContent>
                {commLogs.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No communication logs yet</p>
                ) : (
                  <div className="space-y-4">
                    {commLogs.map((log: any) => (
                      <div key={log.id} className="flex items-center gap-4 p-4 border rounded-lg">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          {log.type === 'whatsapp' && <MessageSquare className="h-5 w-5 text-success" />}
                          {log.type === 'email' && <Mail className="h-5 w-5 text-warning" />}
                          {log.type === 'sms' && <Phone className="h-5 w-5 text-info" />}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{log.recipient}</p>
                          <p className="text-sm text-muted-foreground">{log.subject || log.content?.slice(0, 50)}</p>
                        </div>
                        <div className="text-right">
                          <Badge className={log.status === 'sent' ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'}>
                            {log.status}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {format(new Date(log.created_at), 'MMM dd, HH:mm')}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Announcement Dialog */}
        <Dialog open={!!editingAnnouncement} onOpenChange={(open) => !open && setEditingAnnouncement(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Announcement</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Title *</Label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                />
              </div>
              <div>
                <Label>Content *</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
              <Button onClick={() => updateMutation.mutate()} className="w-full">
                Update Announcement
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

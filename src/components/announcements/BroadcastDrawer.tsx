import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Phone, Mail, Send, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface BroadcastDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType?: 'sms' | 'email' | 'whatsapp';
  initialMessage?: string;
}

export function BroadcastDrawer({ open, onOpenChange, initialType = 'whatsapp', initialMessage = '' }: BroadcastDrawerProps) {
  const [broadcastData, setBroadcastData] = useState({
    type: initialType,
    message: initialMessage,
    audience: 'all',
    templateId: '',
  });

  // Fetch saved templates from database
  const { data: savedTemplates = [] } = useQuery({
    queryKey: ['broadcast-templates', broadcastData.type],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('id, name, content, subject')
        .eq('type', broadcastData.type)
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const handleTemplateSelect = (templateId: string) => {
    const template = savedTemplates.find((t: any) => t.id === templateId);
    if (template) {
      setBroadcastData({
        ...broadcastData,
        templateId,
        message: template.content,
      });
    }
  };

  const handleBroadcast = () => {
    if (!broadcastData.message.trim()) {
      toast.error('Please enter a message');
      return;
    }
    toast.success(`Broadcast initiated via ${broadcastData.type}`);
    onOpenChange(false);
    setBroadcastData({ type: 'whatsapp', message: '', audience: 'all', templateId: '' });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Broadcast Message</SheetTitle>
          <SheetDescription>Send a message to multiple members at once</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Channel</Label>
            <Select value={broadcastData.type} onValueChange={(v: 'sms' | 'email' | 'whatsapp') => setBroadcastData({ ...broadcastData, type: v, templateId: '', message: '' })}>
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

          <div className="space-y-2">
            <Label>Use Template (Optional)</Label>
            <Select value={broadcastData.templateId} onValueChange={handleTemplateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Select a saved template..." />
              </SelectTrigger>
              <SelectContent>
                {savedTemplates.length === 0 ? (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    No templates found for {broadcastData.type}
                  </div>
                ) : (
                  savedTemplates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        {t.name}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Manage templates in Settings → Templates
            </p>
          </div>

          <div className="space-y-2">
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

          <div className="space-y-2">
            <Label>Message *</Label>
            <Textarea
              value={broadcastData.message}
              onChange={(e) => setBroadcastData({ ...broadcastData, message: e.target.value })}
              placeholder="Enter your message..."
              rows={6}
            />
            <p className="text-xs text-muted-foreground">
              Use variables like {'{{member_name}}'}, {'{{days_left}}'}, {'{{plan_name}}'}
            </p>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleBroadcast} disabled={!broadcastData.message.trim()}>
            <Send className="mr-2 h-4 w-4" />
            Send Broadcast
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

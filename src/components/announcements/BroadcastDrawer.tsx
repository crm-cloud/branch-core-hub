import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, Phone, Mail, Send } from 'lucide-react';
import { toast } from 'sonner';

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
  });

  const handleBroadcast = () => {
    if (!broadcastData.message.trim()) {
      toast.error('Please enter a message');
      return;
    }
    toast.success(`Broadcast initiated via ${broadcastData.type}`);
    onOpenChange(false);
    setBroadcastData({ type: 'whatsapp', message: '', audience: 'all' });
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

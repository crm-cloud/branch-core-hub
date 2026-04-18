import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhoneInput } from '@/components/ui/PhoneInput';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPhone?: string | null;
  branchId?: string | null;
  memberId?: string | null;
  message: string;
  title?: string;
}

export function WhatsAppShareDialog({
  open,
  onOpenChange,
  defaultPhone,
  branchId,
  memberId,
  message,
  title = 'Share via WhatsApp',
}: Props) {
  const [phone, setPhone] = useState('');
  const [content, setContent] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (open) {
      setPhone(defaultPhone || '');
      setContent(message);
    }
  }, [open, defaultPhone, message]);

  const send = async () => {
    if (!phone.trim()) {
      toast.error('Please enter a phone number');
      return;
    }
    if (!branchId) {
      toast.error('Missing branch context — cannot send WhatsApp message');
      return;
    }
    setSending(true);
    try {
      const { data: msg, error: insertErr } = await supabase
        .from('whatsapp_messages')
        .insert({
          branch_id: branchId,
          phone_number: phone.trim(),
          content,
          message_type: 'text',
          direction: 'outbound',
          status: 'pending',
          member_id: memberId || null,
        } as never)
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      const { error: sendErr } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          message_id: (msg as { id: string }).id,
          phone_number: phone.trim(),
          content,
          branch_id: branchId,
        },
      });
      if (sendErr) throw sendErr;
      toast.success('WhatsApp message sent');
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      const errMsg = e instanceof Error ? e.message : 'Failed to send WhatsApp message';
      toast.error(errMsg);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            We'll send this message through your gym's WhatsApp channel.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label htmlFor="wa-phone">Recipient phone</Label>
            <PhoneInput
              id="wa-phone"
              value={phone}
              onChange={(v) => setPhone(v)}
            />
          </div>
          <div>
            <Label htmlFor="wa-msg">Message</Label>
            <Textarea
              id="wa-msg"
              rows={10}
              value={content}
              onChange={(e) => setContent(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={send} disabled={sending || !content.trim()}>
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending…
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" /> Send
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

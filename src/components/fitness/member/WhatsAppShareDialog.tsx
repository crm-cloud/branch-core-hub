import { useEffect, useState } from 'react';
import {
  ResponsiveSheet,
  ResponsiveSheetHeader,
  ResponsiveSheetTitle,
  ResponsiveSheetDescription,
  ResponsiveSheetFooter,
} from '@/components/ui/ResponsiveSheet';
import { Button } from '@/components/ui/button';
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
      const cleaned = (defaultPhone || '').replace(/\D/g, '').replace(/^91/, '').slice(-10);
      setPhone(cleaned);
      setContent(message);
    }
  }, [open, defaultPhone, message]);

  const send = async () => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) {
      toast.error('Please enter a valid 10-digit phone number');
      return;
    }
    if (!branchId) {
      toast.error('Missing branch context — cannot send WhatsApp message');
      return;
    }
    const fullPhone = `+91${digits}`;
    setSending(true);
    try {
      const { data: msg, error: insertErr } = await supabase
        .from('whatsapp_messages')
        .insert({
          branch_id: branchId,
          phone_number: fullPhone,
          content,
          message_type: 'text',
          direction: 'outbound',
          status: 'pending',
          member_id: memberId || null,
        } as never)
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      const { data: sendData, error: sendErr } = await supabase.functions.invoke('send-whatsapp', {
        body: {
          message_id: (msg as { id: string }).id,
          phone_number: fullPhone,
          content,
          branch_id: branchId,
        },
      });
      if (sendErr) throw sendErr;
      if (sendData && typeof sendData === 'object' && 'error' in sendData && sendData.error) {
        throw new Error(String((sendData as { error: unknown }).error));
      }
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
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} width="lg">
      <ResponsiveSheetHeader className="px-0 sm:px-0">
        <ResponsiveSheetTitle>{title}</ResponsiveSheetTitle>
        <ResponsiveSheetDescription>
          We'll send this message through your gym's WhatsApp channel.
        </ResponsiveSheetDescription>
      </ResponsiveSheetHeader>
      <div className="space-y-3 mt-4">
        <div>
          <Label htmlFor="wa-phone">Recipient phone</Label>
          <PhoneInput id="wa-phone" value={phone} onChange={(v) => setPhone(v)} />
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
      <ResponsiveSheetFooter>
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
      </ResponsiveSheetFooter>
    </ResponsiveSheet>
  );
}

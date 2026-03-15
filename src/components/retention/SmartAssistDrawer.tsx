import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { communicationService } from '@/services/communicationService';
import { MessageSquare, Clock, CheckCircle2, UserX, Send, Target } from 'lucide-react';
import { format } from 'date-fns';

interface SmartAssistDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: {
    member_id: string;
    full_name: string;
    phone?: string;
    email?: string;
    days_absent: number;
    last_visit?: string;
  } | null;
  branchId?: string;
}

const MANUAL_TEMPLATES = [
  {
    id: 'freeze',
    label: 'Offer a Freeze',
    message: 'Hi {member_name}, we understand life gets busy! Did you know you can freeze your membership and resume when you\'re ready? No penalties — just reach out and we\'ll help. 🧊',
  },
  {
    id: 'free_pt',
    label: 'Free PT Session',
    message: 'Hi {member_name}, we\'d love to help you get back on track! Here\'s a complimentary personal training session — just for you. Book anytime this week! 🏋️',
  },
  {
    id: 'personal',
    label: 'Personal Check-in',
    message: 'Hi {member_name}, just checking in! We noticed you haven\'t been around. Everything okay? We\'re here to help with anything you need. See you soon! 😊',
  },
];

const RESOLUTIONS = [
  'Left Message',
  'Frozen Account',
  'Returning Tomorrow',
  'Not Interested',
  'Cancelled',
];

export function SmartAssistDrawer({ open, onOpenChange, member, branchId }: SmartAssistDrawerProps) {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState('personal');
  const [resolution, setResolution] = useState<string>('');
  const [sending, setSending] = useState(false);

  // Fetch nudge history for this member
  const { data: nudgeHistory = [] } = useQuery({
    queryKey: ['nudge-history', member?.member_id],
    enabled: !!member?.member_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('retention_nudge_logs')
        .select('*, retention_templates(stage_name, stage_level)')
        .eq('member_id', member!.member_id)
        .order('sent_at', { ascending: false })
        .limit(10);
      if (error) throw error;
      return data || [];
    },
  });

  const handleSendWhatsApp = async () => {
    if (!member?.phone) {
      toast({ title: 'No phone number', description: 'This member has no phone on file.', variant: 'destructive' });
      return;
    }
    const tmpl = MANUAL_TEMPLATES.find(t => t.id === selectedTemplate);
    if (!tmpl) return;

    const message = tmpl.message.replace(/{member_name}/g, member.full_name || 'there');
    setSending(true);
    try {
      await communicationService.sendWhatsApp(member.phone, message, {
        branchId,
        memberId: member.member_id,
      });

      // Log nudge
      if (branchId) {
        await supabase.from('retention_nudge_logs').insert({
          member_id: member.member_id,
          branch_id: branchId,
          stage_level: 0, // manual
          channel: 'whatsapp',
          status: 'sent',
        });
      }
      toast({ title: 'Message sent', description: 'WhatsApp opened with the message.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setSending(false);
    }
  };

  const handleResolve = async () => {
    if (!resolution || !member?.member_id) return;
    try {
      // Find unresolved nudge logs and resolve them
      const { data: unresolvedLogs } = await supabase
        .from('retention_nudge_logs')
        .select('id')
        .eq('member_id', member.member_id)
        .is('resolved_at', null);

      if (unresolvedLogs && unresolvedLogs.length > 0) {
        await supabase
          .from('retention_nudge_logs')
          .update({ resolved_at: new Date().toISOString(), resolution })
          .eq('member_id', member.member_id)
          .is('resolved_at', null);
      } else {
        // Create a resolution-only log
        if (branchId) {
          await supabase.from('retention_nudge_logs').insert({
            member_id: member.member_id,
            branch_id: branchId,
            stage_level: 0,
            channel: 'manual',
            status: 'sent',
            resolved_at: new Date().toISOString(),
            resolution,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['nudge-history', member.member_id] });
      queryClient.invalidateQueries({ queryKey: ['inactive-members'] });
      toast({ title: 'Resolved', description: `Marked as "${resolution}".` });
      onOpenChange(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }
  };

  const initials = member?.full_name
    ?.split(' ')
    .map(n => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() || '??';

  const automatedNudgesSent = nudgeHistory.filter((n: any) => n.stage_level > 0).length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Smart Assist
          </SheetTitle>
        </SheetHeader>

        {member && (
          <div className="space-y-5 mt-4">
            {/* Context Header */}
            <div className="flex items-center gap-4 p-4 bg-destructive/5 rounded-xl border border-destructive/10">
              <Avatar className="h-14 w-14">
                <AvatarFallback className="bg-destructive/10 text-destructive text-lg font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lg truncate">{member.full_name}</p>
                <p className="text-sm text-muted-foreground">{member.phone || 'No phone'}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="destructive" className="text-xs">
                    <UserX className="h-3 w-3 mr-1" />
                    {member.days_absent}d absent
                  </Badge>
                  {automatedNudgesSent > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      Nudges: {automatedNudgesSent}/3
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            {/* Nudge History Timeline */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                <Clock className="h-4 w-4" /> Nudge History
              </Label>
              {nudgeHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">No nudges sent yet.</p>
              ) : (
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {nudgeHistory.map((nudge: any) => (
                    <div key={nudge.id} className="flex items-center gap-3 p-2.5 bg-muted/50 rounded-lg text-sm">
                      <div className={`h-2 w-2 rounded-full shrink-0 ${nudge.resolved_at ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">
                          {nudge.stage_level > 0
                            ? `Stage ${nudge.stage_level}: ${(nudge as any).retention_templates?.stage_name || 'Auto'}`
                            : 'Manual'}
                        </span>
                        <span className="text-muted-foreground ml-1.5">
                          via {nudge.channel}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(nudge.sent_at), 'dd MMM')}
                      </span>
                      {nudge.resolved_at && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Separator />

            {/* Smart Messaging */}
            <div>
              <Label className="text-sm font-semibold flex items-center gap-1.5 mb-3">
                <MessageSquare className="h-4 w-4" /> Send Manual Motivation
              </Label>
              <RadioGroup value={selectedTemplate} onValueChange={setSelectedTemplate} className="space-y-2">
                {MANUAL_TEMPLATES.map(tmpl => (
                  <div key={tmpl.id} className={`flex items-start gap-3 p-3 rounded-xl border transition-colors cursor-pointer ${selectedTemplate === tmpl.id ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'}`}>
                    <RadioGroupItem value={tmpl.id} id={tmpl.id} className="mt-0.5" />
                    <label htmlFor={tmpl.id} className="cursor-pointer flex-1">
                      <p className="font-medium text-sm">{tmpl.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {tmpl.message.replace(/{member_name}/g, member.full_name || 'Member')}
                      </p>
                    </label>
                  </div>
                ))}
              </RadioGroup>

              <Button
                className="w-full mt-3 bg-emerald-600 hover:bg-emerald-700 text-white"
                disabled={sending || !member.phone}
                onClick={handleSendWhatsApp}
              >
                <Send className="h-4 w-4 mr-2" />
                Send WhatsApp Message
              </Button>
            </div>

            <Separator />

            {/* Resolution */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Log Outcome</Label>
              <Select value={resolution} onValueChange={setResolution}>
                <SelectTrigger>
                  <SelectValue placeholder="Select outcome..." />
                </SelectTrigger>
                <SelectContent>
                  {RESOLUTIONS.map(r => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                className="w-full mt-3"
                variant="outline"
                disabled={!resolution}
                onClick={handleResolve}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Resolve & Close
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

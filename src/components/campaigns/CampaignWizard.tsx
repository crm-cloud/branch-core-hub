import { useState, useEffect } from 'react';
import {
  ResponsiveSheet,
  ResponsiveSheetHeader,
  ResponsiveSheetTitle,
  ResponsiveSheetDescription,
} from '@/components/ui/ResponsiveSheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, MessageSquare, Mail, Send, Save, Loader2, Megaphone, Clock, Paperclip, ImageIcon, FileText, Film, X } from 'lucide-react';
import { toast } from 'sonner';
import { uploadAttachment } from '@/utils/uploadAttachment';
import { AudienceBuilder } from './AudienceBuilder';
import {
  type AudienceFilter,
  type CampaignChannel,
  type CampaignTriggerType,
  createCampaign,
  sendCampaignNow,
} from '@/services/campaignService';
import { useQueryClient } from '@tanstack/react-query';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
}

const VARIABLES = ['{{member_name}}', '{{member_code}}', '{{first_name}}', '{{branch_name}}'];

export function CampaignWizard({ open, onOpenChange, branchId }: Props) {
  const qc = useQueryClient();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState<CampaignChannel>('whatsapp');
  const [filter, setFilter] = useState<AudienceFilter>({ status: 'active' });

  // Auto-prefill from a saved segment (set by Contact Book → Segments → Send)
  useEffect(() => {
    const segId = sessionStorage.getItem('campaign_prefill_segment');
    const segName = sessionStorage.getItem('campaign_prefill_segment_name');
    if (segId) {
      setFilter({ audience_kind: 'segment', segment_id: segId });
      if (segName) setName(`Segment: ${segName}`);
      sessionStorage.removeItem('campaign_prefill_segment');
      sessionStorage.removeItem('campaign_prefill_segment_name');
    }
  }, []);
  const [resolvedMemberIds, setResolvedMemberIds] = useState<string[]>([]);
  const [message, setMessage] = useState('');
  const [subject, setSubject] = useState('');
  const [trigger, setTrigger] = useState<CampaignTriggerType>('send_now');
  const [scheduledAt, setScheduledAt] = useState<string>(''); // datetime-local value
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setStep(1); setName(''); setChannel('whatsapp');
    setFilter({ status: 'active' }); setResolvedMemberIds([]);
    setMessage(''); setSubject(''); setTrigger('send_now'); setScheduledAt('');
  };

  const close = () => { reset(); onOpenChange(false); };

  const insertVar = (v: string) => setMessage((m) => `${m}${v}`);

  const handleSubmit = async () => {
    if (!name.trim()) { toast.error('Campaign name required'); return; }
    if (!message.trim()) { toast.error('Message required'); return; }
    if (resolvedMemberIds.length === 0) { toast.error('Audience is empty'); return; }
    if (trigger === 'scheduled' && !scheduledAt) { toast.error('Pick a date and time'); return; }
    if (trigger === 'scheduled' && new Date(scheduledAt).getTime() <= Date.now()) {
      toast.error('Scheduled time must be in the future'); return;
    }

    setSubmitting(true);
    try {
      const campaign = await createCampaign({
        branch_id: branchId,
        name: name.trim(),
        channel,
        audience_filter: filter,
        message: message.trim(),
        subject: channel === 'email' ? subject.trim() || null : null,
        trigger_type: trigger,
        scheduled_at: trigger === 'scheduled' ? new Date(scheduledAt).toISOString() : null,
        status:
          trigger === 'send_now' ? 'sending' :
          trigger === 'scheduled' ? 'scheduled' : 'draft',
      });

      if (trigger === 'send_now') {
        // If a richer audience kind is selected, route through the unified resolver so
        // members + leads + contacts can all be reached in one broadcast.
        const useResolver = filter.audience_kind && filter.audience_kind !== 'members';
        const audience = useResolver
          ? { recipients: await (await import('@/services/campaignService')).resolveCampaignAudience(branchId, filter) }
          : { memberIds: resolvedMemberIds };
        const result = await sendCampaignNow(campaign, audience);
        toast.success(`Campaign sent — ${result.sent} delivered, ${result.failed} failed`);
      } else if (trigger === 'scheduled') {
        toast.success(`Campaign scheduled for ${new Date(scheduledAt).toLocaleString()}`);
      } else {
        toast.success('Campaign saved as automated rule');
      }
      qc.invalidateQueries({ queryKey: ['campaigns', branchId] });
      close();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to create campaign');
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels = ['Audience', 'Message', 'Trigger'];

  return (
    <ResponsiveSheet open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <ResponsiveSheetHeader>
        <ResponsiveSheetTitle className="flex items-center gap-2">
          <Megaphone className="h-5 w-5 text-violet-600" /> Create Marketing Campaign
        </ResponsiveSheetTitle>
        <ResponsiveSheetDescription>Reach the right members with the right message</ResponsiveSheetDescription>
      </ResponsiveSheetHeader>

      <div className="px-1 pb-2">
        {/* Stepper */}
        <div className="flex items-center justify-between mb-6">
          {stepLabels.map((label, i) => (
            <div key={label} className="flex-1 flex items-center">
              <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold ${
                step > i + 1 ? 'bg-emerald-500 text-white' : step === i + 1 ? 'bg-violet-600 text-white' : 'bg-muted text-muted-foreground'
              }`}>{i + 1}</div>
              <span className={`ml-2 text-sm ${step === i + 1 ? 'font-semibold' : 'text-muted-foreground'}`}>{label}</span>
              {i < stepLabels.length - 1 && <div className="flex-1 h-px bg-border mx-3" />}
            </div>
          ))}
        </div>

        {/* Step content */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Campaign name</Label>
              <Input className="rounded-xl" placeholder="e.g. New Year membership push" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <AudienceBuilder branchId={branchId} value={filter} onChange={setFilter} onResolved={setResolvedMemberIds} />
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Channel</Label>
              <div className="flex gap-2">
                {([
                  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'emerald' },
                  { id: 'email', label: 'Email', icon: Mail, color: 'blue' },
                  { id: 'sms', label: 'SMS', icon: MessageSquare, color: 'amber' },
                ] as const).map((c) => (
                  <button key={c.id} type="button" onClick={() => setChannel(c.id as CampaignChannel)}
                    className={`flex-1 rounded-xl p-3 border-2 transition-all ${
                      channel === c.id ? `border-${c.color}-500 bg-${c.color}-50 dark:bg-${c.color}-500/10` : 'border-border bg-card'
                    }`}>
                    <c.icon className={`h-5 w-5 mx-auto ${channel === c.id ? `text-${c.color}-600` : 'text-muted-foreground'}`} />
                    <p className={`text-xs mt-1 font-medium ${channel === c.id ? 'text-foreground' : 'text-muted-foreground'}`}>{c.label}</p>
                  </button>
                ))}
              </div>
            </div>

            {channel === 'email' && (
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Subject</Label>
                <Input className="rounded-xl" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Email subject" />
              </div>
            )}

            <div>
              <Label className="text-xs uppercase tracking-wider text-muted-foreground mb-2 block">Message</Label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {VARIABLES.map((v) => (
                  <button key={v} type="button" onClick={() => insertVar(v)}>
                    <Badge variant="outline" className="cursor-pointer hover:bg-accent rounded-full font-mono text-[10px]">{v}</Badge>
                  </button>
                ))}
              </div>
              <Textarea
                className="rounded-xl min-h-[160px]"
                placeholder={`Hi {{first_name}}, your gym at {{branch_name}} has a special offer for you…`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1.5">{message.length} chars · {resolvedMemberIds.length} recipients</p>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-4">
            {([
              { id: 'send_now', label: 'Send Now', desc: 'Dispatch the message to all matched members immediately.', icon: Send, color: 'violet' },
              { id: 'scheduled', label: 'Schedule for Later', desc: 'Pick a date and time. Sent automatically by our background worker.', icon: Clock, color: 'amber' },
              { id: 'automated', label: 'Save as Automated Rule', desc: 'Save the campaign so it runs on a schedule or trigger later.', icon: Save, color: 'blue' },
            ] as const).map((t) => (
              <button key={t.id} type="button" onClick={() => setTrigger(t.id as CampaignTriggerType)}
                className={`w-full text-left rounded-2xl p-4 border-2 transition-all ${
                  trigger === t.id ? `border-${t.color}-500 bg-${t.color}-50 dark:bg-${t.color}-500/10 shadow-md shadow-${t.color}-200/40` : 'border-border bg-card'
                }`}>
                <div className="flex items-start gap-3">
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center ${trigger === t.id ? `bg-${t.color}-600 text-white` : 'bg-muted text-muted-foreground'}`}>
                    <t.icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-foreground">{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.desc}</p>
                  </div>
                </div>
              </button>
            ))}

            {trigger === 'scheduled' && (
              <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-4 space-y-2">
                <Label className="text-xs uppercase tracking-wider text-amber-800 font-semibold">Send at (Asia/Kolkata)</Label>
                <Input
                  type="datetime-local"
                  className="rounded-xl bg-white"
                  value={scheduledAt}
                  min={new Date(Date.now() + 60_000).toISOString().slice(0, 16)}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
                <p className="text-[11px] text-amber-700">A background worker checks every minute and sends the campaign at the chosen time.</p>
              </div>
            )}

            <div className="rounded-2xl bg-muted/40 p-4 mt-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2 font-medium">Summary</p>
              <div className="text-sm space-y-1">
                <div><span className="text-muted-foreground">Name:</span> <span className="font-medium">{name || '—'}</span></div>
                <div><span className="text-muted-foreground">Channel:</span> <span className="font-medium">{channel.toUpperCase()}</span></div>
                <div><span className="text-muted-foreground">Recipients:</span> <span className="font-medium">{resolvedMemberIds.length}</span></div>
              </div>
            </div>
          </div>
        )}

        {/* Footer nav */}
        <div className="flex items-center justify-between mt-6 pt-4 border-t">
          {step > 1 ? (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="rounded-xl">
              <ChevronLeft className="h-4 w-4" /> Back
            </Button>
          ) : <div />}
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting} className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> :
                trigger === 'send_now' ? <><Send className="h-4 w-4" /> Send Campaign</> :
                trigger === 'scheduled' ? <><Clock className="h-4 w-4" /> Schedule Campaign</> :
                <><Save className="h-4 w-4" /> Save Rule</>}
            </Button>
          )}
        </div>
      </div>
    </ResponsiveSheet>
  );
}

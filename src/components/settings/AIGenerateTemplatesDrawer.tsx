import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranchContext } from '@/contexts/BranchContext';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const CANDIDATE_EVENTS: Array<{ event: string; label: string; hint?: string }> = [
  { event: 'member_created', label: 'Welcome — New Member' },
  { event: 'payment_received', label: 'Payment Receipt' },
  { event: 'payment_due', label: 'Payment Due Reminder' },
  { event: 'class_booked', label: 'Class Booking Confirmation' },
  { event: 'facility_booked', label: 'Facility Slot Confirmed' },
  { event: 'pt_session_booked', label: 'PT Session Confirmed' },
  { event: 'membership_expiring_7d', label: 'Expiring in 7 Days' },
  { event: 'membership_expiring_1d', label: 'Expiring Tomorrow' },
  { event: 'membership_expired', label: 'Membership Expired' },
  { event: 'missed_workout_3d', label: 'Missed Workout Nudge', hint: 'Re-engagement, marketing tone' },
  { event: 'birthday', label: 'Birthday Wish', hint: 'Marketing, warm greeting' },
  { event: 'freeze_confirmed', label: 'Membership Frozen' },
  { event: 'unfreeze_confirmed', label: 'Membership Unfrozen' },
  { event: 'lead_created', label: 'Lead — Internal Alert', hint: 'For staff WhatsApp' },
  { event: 'scan_ready', label: 'Body Scan Report Ready', hint: 'Document attachment' },
  { event: 'class_promo', label: 'New Class Promo', hint: 'Marketing with image header' },
  { event: 'gym_closure_update', label: 'Gym Closure Notice' },
  { event: 'referral_reward', label: 'Referral Reward Earned' },
  { event: 'offer_announcement', label: 'Special Offer / Discount', hint: 'Marketing with image header' },
];

interface Proposal {
  event: string;
  name: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  language: string;
  body_text: string;
  variables: string[];
  header_type?: 'none' | 'image' | 'document' | 'video';
  header_sample_url?: string;
  rationale?: string;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function AIGenerateTemplatesDrawer({ open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const { selectedBranch } = useBranchContext();
  const [step, setStep] = useState<'pick' | 'review'>('pick');
  const [picked, setPicked] = useState<Set<string>>(new Set(CANDIDATE_EVENTS.slice(0, 5).map((e) => e.event)));
  const [generating, setGenerating] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [submitting, setSubmitting] = useState<string | null>(null);

  const { data: existing = [] } = useQuery({
    queryKey: ['ai-templates-existing', selectedBranch],
    queryFn: async () => {
      const q = supabase.from('templates').select('name, content').eq('type', 'whatsapp');
      const { data } = selectedBranch && selectedBranch !== 'all' ? await q.eq('branch_id', selectedBranch) : await q;
      return (data || []).map((t: any) => ({ name: t.name, body: t.content || '' }));
    },
    enabled: open,
  });

  const branchId = selectedBranch && selectedBranch !== 'all' ? selectedBranch : null;

  const generate = async () => {
    if (!branchId) { toast.error('Select a specific branch first'); return; }
    if (picked.size === 0) { toast.error('Pick at least one event'); return; }
    setGenerating(true);
    try {
      const events = CANDIDATE_EVENTS.filter((e) => picked.has(e.event));
      const { data, error } = await supabase.functions.invoke('ai-generate-whatsapp-templates', {
        body: { branch_id: branchId, events, existing },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const list: Proposal[] = data?.templates || [];
      if (list.length === 0) throw new Error('AI returned no proposals');
      setProposals(list);
      setStep('review');
      toast.success(`Generated ${list.length} template proposals`);
    } catch (e: any) {
      toast.error(e.message || 'Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const updateProposal = (i: number, patch: Partial<Proposal>) => {
    setProposals((arr) => arr.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };

  const submitOne = async (p: Proposal) => {
    if (!branchId) return;
    setSubmitting(p.name);
    try {
      // 1) create local CRM template row
      const { data: localRow, error: localErr } = await supabase
        .from('templates')
        .insert({
          branch_id: branchId,
          type: 'whatsapp',
          name: p.name,
          trigger_event: p.event,
          content: p.body_text,
          variables: p.variables,
          is_active: true,
          header_type: p.header_type && p.header_type !== 'none' ? p.header_type : null,
          header_media_url: p.header_sample_url || null,
        } as any)
        .select('id')
        .single();
      if (localErr) throw localErr;

      // 2) submit to Meta
      const { data, error } = await supabase.functions.invoke('manage-whatsapp-templates', {
        body: {
          action: 'create',
          branch_id: branchId,
          template_data: {
            name: p.name,
            category: p.category,
            language: p.language || 'en',
            body_text: p.body_text,
            local_template_id: localRow!.id,
            variables: p.variables,
            header_type: p.header_type && p.header_type !== 'none' ? p.header_type : undefined,
            header_sample_url: p.header_sample_url,
          },
        },
      });
      if (error) throw error;
      if (data?.success === false) throw new Error(data.meta_error?.user_msg || data.error || 'Meta rejected');
      toast.success(`Submitted "${p.name}" — Meta status: ${data.status}`);
      qc.invalidateQueries({ queryKey: ['communication-templates'] });
      qc.invalidateQueries({ queryKey: ['whatsapp-templates-health'] });
      setProposals((arr) => arr.filter((x) => x.name !== p.name));
    } catch (e: any) {
      toast.error(`${p.name}: ${e.message}`);
    } finally {
      setSubmitting(null);
    }
  };

  const submitAll = async () => {
    for (const p of proposals.slice()) {
      // eslint-disable-next-line no-await-in-loop
      await submitOne(p);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            AI Template Generator
          </SheetTitle>
          <SheetDescription>
            {step === 'pick'
              ? 'Pick the events you want clean, Meta-compliant templates for. The AI will avoid duplicates of what you already have.'
              : 'Review and edit each proposal, then submit to Meta individually or in bulk.'}
          </SheetDescription>
        </SheetHeader>

        {step === 'pick' && (
          <div className="py-4 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {CANDIDATE_EVENTS.map((e) => (
                <label key={e.event} className="flex items-start gap-2 p-3 rounded-lg border hover:bg-muted/40 cursor-pointer">
                  <Checkbox
                    checked={picked.has(e.event)}
                    onCheckedChange={(v) => {
                      const next = new Set(picked);
                      if (v) next.add(e.event); else next.delete(e.event);
                      setPicked(next);
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{e.label}</p>
                    <p className="text-xs text-muted-foreground font-mono">{e.event}</p>
                    {e.hint && <p className="text-xs text-muted-foreground mt-0.5">{e.hint}</p>}
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="py-4 space-y-4">
            {proposals.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                All proposals submitted.
              </div>
            )}
            {proposals.map((p, i) => (
              <div key={`${p.event}-${i}`} className="rounded-xl border p-3 space-y-2 bg-card">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      value={p.name}
                      onChange={(e) => updateProposal(i, { name: e.target.value })}
                      className="h-8 w-56 font-mono text-xs"
                    />
                    <Badge variant="outline" className="text-[10px]">{p.category}</Badge>
                    <Badge variant="outline" className="text-[10px]">{p.language}</Badge>
                    {p.header_type && p.header_type !== 'none' && (
                      <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-600">
                        {p.header_type} header
                      </Badge>
                    )}
                  </div>
                  <Button size="sm" onClick={() => submitOne(p)} disabled={submitting === p.name}>
                    {submitting === p.name ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">Event: {p.event}</p>
                <Textarea
                  value={p.body_text}
                  onChange={(e) => updateProposal(i, { body_text: e.target.value })}
                  rows={4}
                  className="text-sm"
                />
                {p.rationale && (
                  <p className="text-xs text-muted-foreground italic">{p.rationale}</p>
                )}
                <div className="flex flex-wrap gap-1">
                  {p.variables.map((v) => (
                    <Badge key={v} variant="secondary" className="text-[10px] font-mono">{`{{${v}}}`}</Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <SheetFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Close</Button>
          {step === 'pick' ? (
            <Button onClick={generate} disabled={generating || picked.size === 0}>
              {generating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</> : <><Sparkles className="h-4 w-4 mr-2" /> Generate {picked.size}</>}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep('pick')}>
                <AlertCircle className="h-4 w-4 mr-1" /> Re-pick
              </Button>
              <Button onClick={submitAll} disabled={proposals.length === 0 || !!submitting}>
                <Send className="h-4 w-4 mr-2" /> Submit All to Meta
              </Button>
            </>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

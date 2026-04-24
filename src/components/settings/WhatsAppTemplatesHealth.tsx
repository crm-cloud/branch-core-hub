import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranchContext } from '@/contexts/BranchContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle2, AlertCircle, ShieldX, ShieldAlert } from 'lucide-react';

const SYSTEM_EVENTS = [
  { value: 'member_created', label: 'New Member Created' },
  { value: 'payment_received', label: 'Payment Received' },
  { value: 'class_booked', label: 'Class Booked' },
  { value: 'facility_booked', label: 'Facility Booked' },
  { value: 'pt_session_booked', label: 'PT Session Booked' },
  { value: 'membership_expiring_7d', label: 'Membership Expiring (7d)' },
  { value: 'membership_expiring_1d', label: 'Membership Expiring (1d)' },
  { value: 'membership_expired', label: 'Membership Expired' },
  { value: 'missed_workout_3d', label: 'Missed Workout (3d)' },
  { value: 'birthday', label: 'Birthday Wish' },
  { value: 'freeze_confirmed', label: 'Membership Frozen' },
  { value: 'unfreeze_confirmed', label: 'Membership Unfrozen' },
  { value: 'lead_created', label: 'New Lead (Admin Alert)' },
];

interface TriggerWithTemplate {
  event_name: string;
  is_active: boolean;
  template_id: string | null;
  templates: {
    name: string;
    is_active: boolean;
    meta_template_status: string | null;
  } | null;
}

type RowState = 'ok' | 'rejected' | 'pending' | 'inactive' | 'no-template' | 'not-mapped';

function statusFor(t: TriggerWithTemplate | undefined): RowState {
  if (!t) return 'not-mapped';
  if (!t.template_id || !t.templates) return 'no-template';
  if (!t.is_active || !t.templates.is_active) return 'inactive';
  const meta = (t.templates.meta_template_status || '').toUpperCase();
  if (meta === 'REJECTED') return 'rejected';
  if (meta && meta !== 'APPROVED') return 'pending';
  return 'ok';
}

const STATE_META: Record<RowState, { label: string; icon: any; cls: string }> = {
  ok: { label: 'Ready', icon: CheckCircle2, cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  pending: { label: 'Template Pending Approval', icon: ShieldAlert, cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  rejected: { label: 'Template Rejected', icon: ShieldX, cls: 'bg-destructive/10 text-destructive border-destructive/20' },
  inactive: { label: 'Trigger Inactive', icon: AlertCircle, cls: 'bg-muted text-muted-foreground' },
  'no-template': { label: 'No Template', icon: AlertCircle, cls: 'bg-destructive/10 text-destructive border-destructive/20' },
  'not-mapped': { label: 'Not Mapped', icon: AlertCircle, cls: 'bg-muted text-muted-foreground' },
};

export function WhatsAppTemplatesHealth() {
  const { effectiveBranchId } = useBranchContext();

  const { data: triggers = [], isLoading } = useQuery<TriggerWithTemplate[]>({
    queryKey: ['whatsapp-triggers-health', effectiveBranchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_triggers')
        .select('event_name, is_active, template_id, templates(name, is_active, meta_template_status)')
        .eq('branch_id', effectiveBranchId!);
      if (error) throw error;
      return (data || []) as unknown as TriggerWithTemplate[];
    },
    enabled: !!effectiveBranchId,
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  const triggerByEvent = new Map(triggers.map(t => [t.event_name, t]));
  const rows = SYSTEM_EVENTS.map(e => {
    const t = triggerByEvent.get(e.value);
    return { event: e, trigger: t, state: statusFor(t) };
  });
  const summary = rows.reduce((acc, r) => { acc[r.state] = (acc[r.state] || 0) + 1; return acc; }, {} as Record<RowState, number>);
  const missing = (summary['no-template'] || 0) + (summary['not-mapped'] || 0) + (summary['rejected'] || 0);

  return (
    <Card className="rounded-xl shadow-lg shadow-muted/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheckIcon />
          Templates Health
        </CardTitle>
        <CardDescription>
          {missing > 0
            ? `${missing} event(s) cannot send — fix templates or mappings below.`
            : 'All system events are mapped to active, approved templates.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        {rows.map(({ event, trigger, state }) => {
          const meta = STATE_META[state];
          const Icon = meta.icon;
          return (
            <div key={event.value} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{event.label}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {trigger?.templates?.name
                    ? `→ ${trigger.templates.name}`
                    : 'No template configured'}
                  {trigger?.templates?.meta_template_status && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide">
                      Meta: {trigger.templates.meta_template_status}
                    </span>
                  )}
                </p>
              </div>
              <Badge variant="outline" className={`${meta.cls} gap-1 shrink-0`}>
                <Icon className="h-3 w-3" /> {meta.label}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function ShieldCheckIcon() {
  return <CheckCircle2 className="h-5 w-5 text-primary" />;
}

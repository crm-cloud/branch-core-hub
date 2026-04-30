import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranchContext } from '@/contexts/BranchContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { CheckCircle2, AlertCircle, ShieldX, ShieldAlert, ArrowRight, Megaphone, Zap } from 'lucide-react';

const SYSTEM_EVENTS = [
  { value: 'member_created', label: 'New Member Created', kind: 'system' as const },
  { value: 'payment_received', label: 'Payment Received', kind: 'system' as const },
  { value: 'class_booked', label: 'Class Booked', kind: 'system' as const },
  { value: 'facility_booked', label: 'Facility Booked', kind: 'system' as const },
  { value: 'pt_session_booked', label: 'PT Session Booked', kind: 'system' as const },
  { value: 'membership_expiring_7d', label: 'Membership Expiring (7d)', kind: 'system' as const },
  { value: 'membership_expiring_1d', label: 'Membership Expiring (1d)', kind: 'system' as const },
  { value: 'membership_expired', label: 'Membership Expired', kind: 'system' as const },
  { value: 'missed_workout_3d', label: 'Missed Workout (3d)', kind: 'system' as const },
  { value: 'birthday', label: 'Birthday Wish', kind: 'system' as const },
  { value: 'freeze_confirmed', label: 'Membership Frozen', kind: 'system' as const },
  { value: 'unfreeze_confirmed', label: 'Membership Unfrozen', kind: 'system' as const },
  { value: 'lead_created', label: 'New Lead (Admin Alert)', kind: 'system' as const },
];

type RowState = 'ok' | 'rejected' | 'pending' | 'inactive' | 'no-template' | 'not-mapped';

interface RowData {
  key: string;
  label: string;
  kind: 'system' | 'campaign';
  templateName?: string | null;
  metaStatus?: string | null;
  triggerActive?: boolean;
  templateActive?: boolean;
  state: RowState;
}

const STATE_META: Record<RowState, { label: string; icon: any; cls: string }> = {
  ok: { label: 'Ready', icon: CheckCircle2, cls: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
  pending: { label: 'Pending Approval', icon: ShieldAlert, cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
  rejected: { label: 'Rejected', icon: ShieldX, cls: 'bg-destructive/10 text-destructive border-destructive/20' },
  inactive: { label: 'Inactive', icon: AlertCircle, cls: 'bg-muted text-muted-foreground' },
  'no-template': { label: 'No Template', icon: AlertCircle, cls: 'bg-destructive/10 text-destructive border-destructive/20' },
  'not-mapped': { label: 'Not Mapped', icon: AlertCircle, cls: 'bg-muted text-muted-foreground' },
};

function deriveState(opts: { templateId?: string | null; templateActive?: boolean; triggerActive?: boolean; metaStatus?: string | null; isCampaign?: boolean }): RowState {
  if (!opts.isCampaign && !opts.templateId) return 'not-mapped';
  if (opts.templateId === undefined || opts.templateId === null) return 'no-template';
  if (opts.triggerActive === false || opts.templateActive === false) return 'inactive';
  const meta = (opts.metaStatus || '').toUpperCase();
  if (meta === 'REJECTED') return 'rejected';
  if (meta && meta !== 'APPROVED') return 'pending';
  return 'ok';
}

export function WhatsAppTemplatesHealth({ onFixClick }: { onFixClick?: (eventName: string) => void } = {}) {
  const { effectiveBranchId } = useBranchContext();

  const { data, isLoading } = useQuery({
    queryKey: ['whatsapp-templates-health', effectiveBranchId],
    queryFn: async () => {
      const [triggersRes, templatesRes] = await Promise.all([
        supabase
          .from('whatsapp_triggers')
          .select('event_name, is_active, template_id, templates(id, name, is_active, meta_template_status, meta_template_name)')
          .eq('branch_id', effectiveBranchId!),
        supabase
          .from('templates')
          .select('id, name, type, trigger_event, is_active, meta_template_status, meta_template_name')
          .eq('branch_id', effectiveBranchId!)
          .eq('type', 'whatsapp'),
      ]);
      if (triggersRes.error) throw triggersRes.error;
      if (templatesRes.error) throw templatesRes.error;
      return { triggers: triggersRes.data || [], templates: templatesRes.data || [] };
    },
    enabled: !!effectiveBranchId,
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full rounded-xl" />;
  }

  const triggers = (data?.triggers || []) as any[];
  const templates = (data?.templates || []) as any[];
  const triggerByEvent = new Map(triggers.map((t) => [t.event_name, t]));
  const mappedTemplateIds = new Set(triggers.map((t) => t.template_id).filter(Boolean));

  const systemRows: RowData[] = SYSTEM_EVENTS.map((e) => {
    const t = triggerByEvent.get(e.value) as any;
    const tpl = t?.templates;
    return {
      key: `sys:${e.value}`,
      label: e.label,
      kind: 'system',
      templateName: tpl?.name || null,
      metaStatus: tpl?.meta_template_status || null,
      triggerActive: t?.is_active,
      templateActive: tpl?.is_active,
      state: !t
        ? 'not-mapped'
        : !t.template_id || !tpl
        ? 'no-template'
        : deriveState({ templateId: t.template_id, templateActive: tpl.is_active, triggerActive: t.is_active, metaStatus: tpl.meta_template_status }),
    };
  });

  // Campaign / unmapped templates: every WhatsApp template not bound to a system trigger
  const campaignRows: RowData[] = templates
    .filter((tpl) => !mappedTemplateIds.has(tpl.id))
    .map((tpl) => ({
      key: `tpl:${tpl.id}`,
      label: tpl.name,
      kind: 'campaign',
      templateName: tpl.meta_template_name || tpl.name,
      metaStatus: tpl.meta_template_status,
      triggerActive: true,
      templateActive: tpl.is_active,
      state: deriveState({
        templateId: tpl.id,
        templateActive: tpl.is_active,
        triggerActive: true,
        metaStatus: tpl.meta_template_status,
        isCampaign: true,
      }),
    }));

  const rows = [...systemRows, ...campaignRows];
  const summary = rows.reduce(
    (acc, r) => {
      acc[r.state] = (acc[r.state] || 0) + 1;
      return acc;
    },
    {} as Record<RowState, number>,
  );

  const approved = summary.ok || 0;
  const pending = summary.pending || 0;
  const rejected = summary.rejected || 0;
  const missing = (summary['no-template'] || 0) + (summary['not-mapped'] || 0);

  return (
    <Card className="rounded-xl shadow-lg shadow-muted/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          Templates Health
        </CardTitle>
        <CardDescription className="flex flex-wrap gap-2 mt-2">
          <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
            <CheckCircle2 className="h-3 w-3 mr-1" /> {approved} Approved
          </Badge>
          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
            <ShieldAlert className="h-3 w-3 mr-1" /> {pending} Pending
          </Badge>
          <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">
            <ShieldX className="h-3 w-3 mr-1" /> {rejected} Rejected
          </Badge>
          <Badge variant="outline" className="bg-muted text-muted-foreground">
            <AlertCircle className="h-3 w-3 mr-1" /> {missing} Missing
          </Badge>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            <Zap className="h-3.5 w-3.5" /> System Events ({systemRows.length})
          </div>
          <div className="space-y-2">
            {systemRows.map((r) => (
              <HealthRow key={r.key} row={r} onFixClick={onFixClick} />
            ))}
          </div>
        </div>
        {campaignRows.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-2 mt-4 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Megaphone className="h-3.5 w-3.5" /> Marketing & Campaigns ({campaignRows.length})
            </div>
            <div className="space-y-2">
              {campaignRows.map((r) => (
                <HealthRow key={r.key} row={r} onFixClick={onFixClick} />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function HealthRow({ row, onFixClick }: { row: RowData; onFixClick?: (e: string) => void }) {
  const meta = STATE_META[row.state];
  const Icon = meta.icon;
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm truncate">{row.label}</p>
        <p className="text-xs text-muted-foreground truncate">
          {row.templateName ? `→ ${row.templateName}` : 'No template configured'}
          {row.metaStatus && (
            <span className="ml-2 text-[10px] uppercase tracking-wide">Meta: {row.metaStatus}</span>
          )}
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="outline" className={`${meta.cls} gap-1`}>
          <Icon className="h-3 w-3" /> {meta.label}
        </Badge>
        {onFixClick && row.state !== 'ok' && row.kind === 'system' && (
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs gap-1" onClick={() => onFixClick(row.key.replace('sys:', ''))}>
            Map <ArrowRight className="h-3 w-3" />
          </Button>
        )}
      </div>
    </div>
  );
}

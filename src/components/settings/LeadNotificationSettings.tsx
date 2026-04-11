import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useBranchContext } from '@/contexts/BranchContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bell, MessageSquare, Phone, Save, Users, UserCheck, Info, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export function LeadNotificationSettings() {
  const { selectedBranch } = useBranchContext();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const branchId = selectedBranch !== 'all' ? selectedBranch : null;

  const { data: rules, isLoading } = useQuery({
    queryKey: ['lead-notification-rules', branchId],
    queryFn: async () => {
      if (branchId) {
        const { data } = await supabase
          .from('lead_notification_rules')
          .select('*')
          .eq('branch_id', branchId)
          .maybeSingle();
        if (data) return data;
      }
      const { data } = await supabase
        .from('lead_notification_rules')
        .select('*')
        .is('branch_id', null)
        .maybeSingle();
      return data;
    },
  });

  const [form, setForm] = useState({
    sms_to_lead: false,
    whatsapp_to_lead: false,
    sms_to_admins: false,
    whatsapp_to_admins: false,
    sms_to_managers: false,
    whatsapp_to_managers: false,
    lead_welcome_sms: 'Hi {{lead_name}}, thank you for your interest in {{branch_name}}! We will contact you shortly.',
    lead_welcome_whatsapp: 'Hi {{lead_name}}, welcome to {{branch_name}}! 🏋️ Our team will reach out to you soon.',
    team_alert_sms: 'New lead: {{lead_name}} ({{lead_phone}}) from {{lead_source}} at {{branch_name}}',
    team_alert_whatsapp: '🔔 New Lead Alert\nName: {{lead_name}}\nPhone: {{lead_phone}}\nSource: {{lead_source}}\nBranch: {{branch_name}}',
  });

  useEffect(() => {
    if (rules) {
      setForm({
        sms_to_lead: rules.sms_to_lead ?? false,
        whatsapp_to_lead: rules.whatsapp_to_lead ?? false,
        sms_to_admins: rules.sms_to_admins ?? false,
        whatsapp_to_admins: rules.whatsapp_to_admins ?? false,
        sms_to_managers: rules.sms_to_managers ?? false,
        whatsapp_to_managers: rules.whatsapp_to_managers ?? false,
        lead_welcome_sms: rules.lead_welcome_sms || form.lead_welcome_sms,
        lead_welcome_whatsapp: rules.lead_welcome_whatsapp || form.lead_welcome_whatsapp,
        team_alert_sms: rules.team_alert_sms || form.team_alert_sms,
        team_alert_whatsapp: rules.team_alert_whatsapp || form.team_alert_whatsapp,
      });
    }
  }, [rules]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        ...form,
        branch_id: branchId || null,
      };

      if (rules?.id) {
        const isMatchingBranch = rules.branch_id === branchId;
        if (isMatchingBranch || (!branchId && !rules.branch_id)) {
          const { error } = await supabase
            .from('lead_notification_rules')
            .update(payload)
            .eq('id', rules.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('lead_notification_rules')
            .upsert(payload, { onConflict: 'branch_id' });
          if (error) throw error;
        }
      } else {
        const { error } = await supabase
          .from('lead_notification_rules')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Lead notification settings saved');
      queryClient.invalidateQueries({ queryKey: ['lead-notification-rules'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save'),
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader><Skeleton className="h-6 w-48" /></CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 w-full" />)}
        </CardContent>
      </Card>
    );
  }

  const toggleField = (field: keyof typeof form) => {
    setForm(prev => ({ ...prev, [field]: !prev[field] }));
  };

  const enabledCount = [
    form.sms_to_lead, form.whatsapp_to_lead,
    form.sms_to_admins, form.whatsapp_to_admins,
    form.sms_to_managers, form.whatsapp_to_managers,
  ].filter(Boolean).length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Lead Notification Rules
            {enabledCount > 0 && (
              <Badge variant="default" className="ml-2">{enabledCount} active</Badge>
            )}
          </CardTitle>
          <CardDescription>
            Configure automated SMS and WhatsApp notifications when a new lead is captured.
            {branchId ? ' Settings apply to the selected branch.' : ' These are global default settings.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info banners */}
          <div className="p-3 rounded-lg bg-primary/5 border border-primary/10 flex gap-2">
            <Info className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Notifications require an active SMS or WhatsApp provider configured in the Integrations tab.
              Notification failures will never block lead creation.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-indigo-500/5 border border-indigo-500/10 flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-indigo-600 flex-shrink-0" />
            <p className="text-xs text-muted-foreground">
              Message templates for lead notifications can be managed in{' '}
              <button
                onClick={() => navigate('/settings?tab=templates')}
                className="text-primary font-medium hover:underline"
              >
                Settings → Templates
              </button>
              {' '}(look for "Lead Welcome" and "Team Alert" trigger types).
            </p>
          </div>

          {/* Channel toggles */}
          <div className="space-y-4">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <UserCheck className="h-4 w-4" />
              Notify the Lead
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm">SMS to Lead</Label>
                </div>
                <Switch checked={form.sms_to_lead} onCheckedChange={() => toggleField('sms_to_lead')} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  <Label className="text-sm">WhatsApp to Lead</Label>
                </div>
                <Switch checked={form.whatsapp_to_lead} onCheckedChange={() => toggleField('whatsapp_to_lead')} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Notify Admins (Owners & Admins)
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm">SMS to Admins</Label>
                </div>
                <Switch checked={form.sms_to_admins} onCheckedChange={() => toggleField('sms_to_admins')} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  <Label className="text-sm">WhatsApp to Admins</Label>
                </div>
                <Switch checked={form.whatsapp_to_admins} onCheckedChange={() => toggleField('whatsapp_to_admins')} />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <Users className="h-4 w-4" />
              Notify Branch Managers
            </h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm">SMS to Managers</Label>
                </div>
                <Switch checked={form.sms_to_managers} onCheckedChange={() => toggleField('sms_to_managers')} />
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-green-600" />
                  <Label className="text-sm">WhatsApp to Managers</Label>
                </div>
                <Switch checked={form.whatsapp_to_managers} onCheckedChange={() => toggleField('whatsapp_to_managers')} />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Button
        className="w-full"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
      >
        <Save className="h-4 w-4 mr-2" />
        {saveMutation.isPending ? 'Saving...' : 'Save Notification Settings'}
      </Button>
    </div>
  );
}

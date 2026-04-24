import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, ShieldCheck, Zap, BadgeCheck } from 'lucide-react';
import { TemplateManager } from './TemplateManager';
import { WhatsAppAutomations } from './WhatsAppAutomations';
import { WhatsAppTemplatesHealth } from './WhatsAppTemplatesHealth';
import { MetaTemplatesPanel } from './MetaTemplatesPanel';

/** Prefill payload sent from Health → CRM editor when user clicks "Map". */
export interface TemplatePrefill {
  name: string;
  trigger: string;
  content: string;
  type?: 'whatsapp' | 'sms' | 'email';
}

/** Map system event → sensible default template prefill. */
const EVENT_PREFILLS: Record<string, TemplatePrefill> = {
  member_created: {
    name: 'Welcome New Member',
    trigger: 'welcome',
    content: 'Hi {{member_name}}, welcome to {{branch_name}}! Your member code is {{member_code}}. We\'re excited to have you on board.',
  },
  payment_received: {
    name: 'Payment Received',
    trigger: 'payment_received',
    content: 'Hi {{member_name}}, we\'ve received your payment of ₹{{amount}} for invoice {{invoice_number}}. Thank you!',
  },
  class_booked: {
    name: 'Class Booked Confirmation',
    trigger: 'class_reminder',
    content: 'Hi {{member_name}}, your booking for {{class_name}} on {{date}} at {{time}} is confirmed. See you there!',
  },
  facility_booked: {
    name: 'Facility Booked Confirmation',
    trigger: 'custom',
    content: 'Hi {{member_name}}, your facility slot on {{date}} at {{time}} is confirmed.',
  },
  pt_session_booked: {
    name: 'PT Session Booked',
    trigger: 'pt_session',
    content: 'Hi {{member_name}}, your PT session with {{trainer_name}} on {{date}} at {{time}} is confirmed.',
  },
  membership_expiring_7d: {
    name: 'Membership Expiring in 7 Days',
    trigger: 'expiry_reminder',
    content: 'Hi {{member_name}}, your {{plan_name}} membership ends on {{end_date}} ({{days_left}} days left). Renew today to stay active.',
  },
  membership_expiring_1d: {
    name: 'Membership Expiring Tomorrow',
    trigger: 'expiry_reminder',
    content: 'Hi {{member_name}}, your {{plan_name}} membership ends tomorrow ({{end_date}}). Renew now to avoid interruption.',
  },
  membership_expired: {
    name: 'Membership Expired',
    trigger: 'expiry_reminder',
    content: 'Hi {{member_name}}, your {{plan_name}} membership has expired. Reach out to renew and resume your journey.',
  },
  missed_workout_3d: {
    name: 'Missed Workout Nudge',
    trigger: 'custom',
    content: 'Hi {{member_name}}, we\'ve missed you at {{branch_name}}! Drop in today and keep your streak alive.',
  },
  birthday: {
    name: 'Birthday Wish',
    trigger: 'birthday',
    content: 'Happy birthday, {{member_name}}! 🎉 Wishing you a strong, healthy year from all of us at {{branch_name}}.',
  },
  freeze_confirmed: {
    name: 'Membership Frozen',
    trigger: 'custom',
    content: 'Hi {{member_name}}, your membership has been frozen as requested. We\'ll see you when you\'re back!',
  },
  unfreeze_confirmed: {
    name: 'Membership Unfrozen',
    trigger: 'custom',
    content: 'Hi {{member_name}}, your membership is active again. Welcome back to {{branch_name}}!',
  },
  lead_created: {
    name: 'New Lead Admin Alert',
    trigger: 'team_alert',
    content: 'New lead captured: {{member_name}} ({{phone}}). Source: {{source}}. Follow up promptly.',
  },
};

/**
 * Unified WhatsApp Templates Manager — surfaces the four related panels
 * (CRM templates, Meta-approved catalog, event automations, health audit)
 * under a single tabbed surface. Self-contained so it can be mounted from
 * Settings → Templates Manager.
 */
export function WhatsAppTemplatesHub() {
  const [tab, setTab] = useState<string>('crm');
  const [prefill, setPrefill] = useState<TemplatePrefill | null>(null);

  const handleMap = (eventName: string) => {
    const p = EVENT_PREFILLS[eventName] || {
      name: eventName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      trigger: 'custom',
      content: '',
      type: 'whatsapp',
    };
    setPrefill({ ...p, type: 'whatsapp' });
    setTab('crm');
  };

  return (
    <Card className="rounded-2xl shadow-lg shadow-muted/20 border-primary/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          WhatsApp Templates
        </CardTitle>
        <CardDescription>
          Author CRM templates, sync the Meta-approved catalog, map them to system events, and audit which events can actually send.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={tab} onValueChange={setTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 mb-6">
            <TabsTrigger value="crm" className="gap-1.5">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">CRM</span> Templates
            </TabsTrigger>
            <TabsTrigger value="meta" className="gap-1.5">
              <BadgeCheck className="h-4 w-4" />
              Meta Approved
            </TabsTrigger>
            <TabsTrigger value="automations" className="gap-1.5">
              <Zap className="h-4 w-4" />
              <span className="hidden sm:inline">Event</span> Mapping
            </TabsTrigger>
            <TabsTrigger value="health" className="gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Health
            </TabsTrigger>
          </TabsList>

          <TabsContent value="crm" className="mt-0">
            <TemplateManager
              prefill={prefill ?? undefined}
              onPrefillConsumed={() => setPrefill(null)}
            />
          </TabsContent>

          <TabsContent value="meta" className="mt-0">
            <MetaTemplatesPanel />
          </TabsContent>

          <TabsContent value="automations" className="mt-0">
            <WhatsAppAutomations />
          </TabsContent>

          <TabsContent value="health" className="mt-0">
            <WhatsAppTemplatesHealth onFixClick={handleMap} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

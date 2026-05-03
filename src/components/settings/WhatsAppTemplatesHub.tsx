import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { MessageSquare, Sparkles } from 'lucide-react';
import { TemplateManager } from './TemplateManager';
import { WhatsAppAutomations } from './WhatsAppAutomations';
import { WhatsAppTemplatesHealth } from './WhatsAppTemplatesHealth';
import { MetaTemplatesPanel } from './MetaTemplatesPanel';
import { AIGenerateTemplatesDrawer } from './AIGenerateTemplatesDrawer';

export interface TemplatePrefill {
  name: string;
  trigger: string;
  content: string;
  type?: 'whatsapp' | 'sms' | 'email';
  eventName?: string;
}

const EVENT_PREFILLS: Record<string, TemplatePrefill> = {
  member_created: { name: 'Welcome New Member', trigger: 'welcome', content: 'Hi {{member_name}}, welcome to {{branch_name}}! Your member code is {{member_code}}.' },
  payment_received: { name: 'Payment Received', trigger: 'payment_received', content: 'Hi {{member_name}}, we\'ve received your payment of ₹{{amount}} for invoice {{invoice_number}}. Thank you!' },
  membership_expiring_7d: { name: 'Membership Expiring in 7 Days', trigger: 'expiry_reminder', content: 'Hi {{member_name}}, your {{plan_name}} ends on {{end_date}}. Renew today.' },
  birthday: { name: 'Birthday Wish', trigger: 'birthday', content: 'Happy birthday, {{member_name}}! Wishing you a strong year from {{branch_name}}.' },
};

/**
 * Unified WhatsApp Templates surface — one scrollable page (no inner tabs).
 * Toolbar: Sync from Meta + AI Generate. Below: Health audit, CRM template
 * manager (with embedded Meta-approved table), and event-mapping automations.
 */
export function WhatsAppTemplatesHub() {
  const [prefill, setPrefill] = useState<TemplatePrefill | null>(null);
  const [aiOpen, setAiOpen] = useState(false);

  const handleMap = (eventName: string) => {
    const p = EVENT_PREFILLS[eventName] || {
      name: eventName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      trigger: 'custom',
      content: '',
      type: 'whatsapp',
    };
    setPrefill({ ...p, type: 'whatsapp', eventName });
  };

  return (
    <Card className="rounded-2xl shadow-lg shadow-muted/20 border-primary/10">
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            WhatsApp Templates
          </CardTitle>
          <CardDescription>
            Author CRM templates, sync the Meta-approved catalog, map them to system events, and audit which events can actually send — all in one place.
          </CardDescription>
        </div>
        <Button onClick={() => setAiOpen(true)} className="gap-2 shrink-0">
          <Sparkles className="h-4 w-4" />
          AI Generate Templates
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 1. Health audit strip — what events are missing/rejected */}
        <WhatsAppTemplatesHealth onFixClick={handleMap} />

        {/* 2. Meta-approved catalog with sync button */}
        <MetaTemplatesPanel />

        {/* 3. CRM template editor (create/edit/submit) */}
        <TemplateManager
          prefill={prefill ?? undefined}
          onPrefillConsumed={() => setPrefill(null)}
        />

        {/* 4. Event → template mappings */}
        <WhatsAppAutomations />
      </CardContent>

      <AIGenerateTemplatesDrawer open={aiOpen} onOpenChange={setAiOpen} />
    </Card>
  );
}

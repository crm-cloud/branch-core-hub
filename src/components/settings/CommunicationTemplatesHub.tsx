import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { MessageSquare, Mail, Phone, Sparkles, Bot, Workflow, PhoneForwarded, FileText, HeartPulse, BadgeCheck } from 'lucide-react';
import { TemplateManager } from './TemplateManager';
import { WhatsAppAutomations } from './WhatsAppAutomations';
import { WhatsAppTemplatesHealth } from './WhatsAppTemplatesHealth';
import { MetaTemplatesPanel } from './MetaTemplatesPanel';
import { WhatsAppAISettings } from './WhatsAppAISettings';
import { WhatsAppRoutingSettings } from './WhatsAppRoutingSettings';
import { AIGenerateTemplatesDrawer } from './AIGenerateTemplatesDrawer';

type Channel = 'whatsapp' | 'sms' | 'email';

interface TemplatePrefill {
  name: string;
  trigger: string;
  content: string;
  type?: Channel;
  eventName?: string;
}

const EVENT_PREFILLS: Record<string, TemplatePrefill> = {
  member_created: { name: 'Welcome New Member', trigger: 'welcome', content: 'Hi {{member_name}}, welcome to {{branch_name}}! Your member code is {{member_code}}.' },
  payment_received: { name: 'Payment Received', trigger: 'payment_received', content: "Hi {{member_name}}, we've received your payment of ₹{{amount}} for invoice {{invoice_number}}. Thank you!" },
  membership_expiring_7d: { name: 'Membership Expiring in 7 Days', trigger: 'expiry_reminder', content: 'Hi {{member_name}}, your {{plan_name}} ends on {{end_date}}. Renew today.' },
  birthday: { name: 'Birthday Wish', trigger: 'birthday', content: 'Happy birthday, {{member_name}}! Wishing you a strong year from {{branch_name}}.' },
};

const CHANNEL_HEAD: Record<Channel, { label: string; icon: any; gradient: string; description: string }> = {
  whatsapp: { label: 'WhatsApp', icon: MessageSquare, gradient: 'from-emerald-500 to-teal-500', description: 'Author CRM templates, sync the Meta-approved catalog, map them to system events, and audit deliverability — all in one place.' },
  sms: { label: 'SMS', icon: Phone, gradient: 'from-sky-500 to-blue-500', description: 'Manage transactional and promotional SMS templates with DLT-friendly limits and AI-assisted drafting.' },
  email: { label: 'Email', icon: Mail, gradient: 'from-amber-500 to-orange-500', description: 'Design transactional and marketing emails with subject, HTML body, attachments and AI generation.' },
};

function ChannelHero({ channel, onAi }: { channel: Channel; onAi: () => void }) {
  const meta = CHANNEL_HEAD[channel];
  const Icon = meta.icon;
  return (
    <div className={`rounded-2xl p-5 bg-gradient-to-r ${meta.gradient} text-white shadow-lg flex items-start justify-between gap-4`}>
      <div className="flex items-start gap-3">
        <div className="rounded-xl bg-white/15 p-2.5"><Icon className="h-6 w-6" /></div>
        <div>
          <h3 className="text-lg font-bold">{meta.label} Templates</h3>
          <p className="text-sm text-white/80 max-w-2xl">{meta.description}</p>
        </div>
      </div>
      <Button variant="secondary" onClick={onAi} className="gap-2 shrink-0 bg-white/95 text-slate-900 hover:bg-white">
        <Sparkles className="h-4 w-4 text-violet-600" /> AI Generate
      </Button>
    </div>
  );
}

export function CommunicationTemplatesHub() {
  const [tab, setTab] = useState<Channel | 'ai'>('whatsapp');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiChannel, setAiChannel] = useState<Channel | undefined>(undefined);
  const [prefill, setPrefill] = useState<TemplatePrefill | null>(null);

  const openAi = (c?: Channel) => { setAiChannel(c); setAiOpen(true); };

  const handleMap = (eventName: string) => {
    const p = EVENT_PREFILLS[eventName] || {
      name: eventName.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      trigger: 'custom',
      content: '',
      type: 'whatsapp' as Channel,
    };
    setPrefill({ ...p, type: 'whatsapp', eventName });
  };

  return (
    <>
      <Tabs value={tab} onValueChange={(v) => setTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-4 max-w-2xl">
          <TabsTrigger value="whatsapp" className="gap-2"><MessageSquare className="h-4 w-4" /> WhatsApp</TabsTrigger>
          <TabsTrigger value="sms" className="gap-2"><Phone className="h-4 w-4" /> SMS</TabsTrigger>
          <TabsTrigger value="email" className="gap-2"><Mail className="h-4 w-4" /> Email</TabsTrigger>
          <TabsTrigger value="ai" className="gap-2"><Sparkles className="h-4 w-4" /> AI Studio</TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="mt-4 space-y-5">
          <ChannelHero channel="whatsapp" onAi={() => openAi('whatsapp')} />

          <Card className="rounded-2xl shadow-lg shadow-slate-200/40 border-primary/10">
            <CardContent className="pt-6 space-y-6">
              <WhatsAppTemplatesHealth onFixClick={handleMap} />
              <MetaTemplatesPanel />
              <TemplateManager
                filterType="whatsapp"
                hideHeader
                prefill={prefill ?? undefined}
                onPrefillConsumed={() => setPrefill(null)}
              />
              <WhatsAppAutomations />
            </CardContent>
          </Card>

          <Card className="rounded-2xl shadow-lg shadow-slate-200/40 border-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <SettingsIcon className="h-4 w-4 text-primary" /> WhatsApp Settings
              </CardTitle>
              <CardDescription>AI agent, automations and number routing — scoped to the selected branch.</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                <AccordionItem value="ai">
                  <AccordionTrigger><span className="flex items-center gap-2"><Bot className="h-4 w-4" /> AI Agent</span></AccordionTrigger>
                  <AccordionContent><WhatsAppAISettings /></AccordionContent>
                </AccordionItem>
                <AccordionItem value="routing">
                  <AccordionTrigger><span className="flex items-center gap-2"><PhoneForwarded className="h-4 w-4" /> Number Routing</span></AccordionTrigger>
                  <AccordionContent><WhatsAppRoutingSettings /></AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sms" className="mt-4 space-y-5">
          <ChannelHero channel="sms" onAi={() => openAi('sms')} />
          <Card className="rounded-2xl shadow-lg shadow-slate-200/40 border-primary/10">
            <CardContent className="pt-6">
              <TemplateManager filterType="sms" hideHeader />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="mt-4 space-y-5">
          <ChannelHero channel="email" onAi={() => openAi('email')} />
          <Card className="rounded-2xl shadow-lg shadow-slate-200/40 border-primary/10">
            <CardContent className="pt-6">
              <TemplateManager filterType="email" hideHeader />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-4 space-y-5">
          <Card className="rounded-2xl shadow-lg shadow-slate-200/40 border-violet-500/20 bg-gradient-to-br from-violet-50 to-white">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-violet-600" /> AI Template Studio</CardTitle>
              <CardDescription>
                Generate brand-safe, deduplicated templates for any channel. Pick events, review proposals,
                and save individually or in bulk. WhatsApp proposals are also submitted to Meta automatically.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 sm:grid-cols-3">
              {(['whatsapp', 'sms', 'email'] as Channel[]).map((c) => {
                const M = CHANNEL_HEAD[c];
                const I = M.icon;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => openAi(c)}
                    className={`group rounded-2xl bg-gradient-to-br ${M.gradient} p-5 text-white text-left shadow-md hover:shadow-xl transition-all`}
                  >
                    <div className="flex items-center gap-2"><I className="h-5 w-5" /><span className="font-semibold">{M.label}</span></div>
                    <p className="mt-2 text-xs text-white/85">Generate {M.label} templates with AI</p>
                    <div className="mt-3 inline-flex items-center gap-1 text-xs bg-white/15 rounded-full px-2.5 py-1">
                      <Sparkles className="h-3 w-3" /> Open generator
                    </div>
                  </button>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AIGenerateTemplatesDrawer open={aiOpen} onOpenChange={setAiOpen} channel={aiChannel} />
    </>
  );
}

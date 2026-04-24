import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MessageSquare, ShieldCheck, Zap, BadgeCheck } from 'lucide-react';
import { TemplateManager } from './TemplateManager';
import { WhatsAppAutomations } from './WhatsAppAutomations';
import { WhatsAppTemplatesHealth } from './WhatsAppTemplatesHealth';

interface Props {
  metaTemplatesPanel: React.ReactNode;
}

/**
 * Unified WhatsApp Templates hub — surfaces the four related panels
 * (CRM templates, Meta-approved catalog, event automations, health audit)
 * under a single tabbed surface inside Settings → Integrations.
 */
export function WhatsAppTemplatesHub({ metaTemplatesPanel }: Props) {
  const [tab, setTab] = useState<string>('crm');

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
            <TemplateManager />
          </TabsContent>

          <TabsContent value="meta" className="mt-0">
            {metaTemplatesPanel}
          </TabsContent>

          <TabsContent value="automations" className="mt-0">
            <WhatsAppAutomations />
          </TabsContent>

          <TabsContent value="health" className="mt-0">
            <WhatsAppTemplatesHealth onFixClick={() => setTab('automations')} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

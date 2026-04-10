import { useState, useEffect } from 'react';
import { LeadNotificationSettings } from '@/components/settings/LeadNotificationSettings';
import { WhatsAppAISettings } from '@/components/settings/WhatsAppAISettings';
import { AIFlowBuilderSettings } from '@/components/settings/AIFlowBuilderSettings';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getProviderSchema, getProviderDisplayName, getWebhookInfoForProvider, getDefaultConfigForProvider, type ProviderFieldDef } from '@/config/providerSchemas';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { StatCard } from '@/components/ui/stat-card';
import { useBranchContext } from '@/contexts/BranchContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  CreditCard, MessageSquare, Mail, Phone,
  Settings, CheckCircle, XCircle, Save, Globe, Webhook, Copy, ExternalLink,
  RefreshCw, ChevronDown, ChevronRight, Clock, PauseCircle, Send
} from 'lucide-react';

type IntegrationType = 'payment_gateway' | 'sms' | 'email' | 'whatsapp' | 'google_business';

const GOOGLE_PROVIDERS = [
  { id: 'google_business', name: 'Google Business Profile', description: 'Sync reviews to Google Maps' },
];

const PAYMENT_PROVIDERS = [
  { id: 'razorpay', name: 'Razorpay' },
  { id: 'phonepe', name: 'PhonePe' },
  { id: 'ccavenue', name: 'CCAvenue' },
  { id: 'payu', name: 'PayU' },
];

const PAYMENT_PROVIDER_LOGOS: Record<string, { src: string; alt: string }> = {
  razorpay: { src: '/assets/payment-logos/razorpay.svg', alt: 'Razorpay logo' },
  phonepe: { src: '/assets/payment-logos/phonepe.svg', alt: 'PhonePe logo' },
  ccavenue: { src: '/assets/payment-logos/ccavenue.svg', alt: 'CCAvenue logo' },
  payu: { src: '/assets/payment-logos/payu.svg', alt: 'PayU logo' },
};

function PaymentProviderLogo({ providerId }: { providerId: string }) {
  const logo = PAYMENT_PROVIDER_LOGOS[providerId];
  return (
    <div className="h-12 w-12 rounded-2xl border border-border bg-card flex items-center justify-center p-1">
      {logo ? (
        <img src={logo.src} alt={logo.alt} className="h-full w-full object-contain" />
      ) : (
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {providerId.slice(0, 2).toUpperCase()}
        </span>
      )}
    </div>
  );
}

const SMS_PROVIDERS = [
  { id: 'msg91', name: 'MSG91', description: 'Indian SMS with DLT support' },
  { id: 'roundsms', name: 'RoundSMS', description: 'Indian SMS with HTTP API' },
  { id: 'twilio', name: 'Twilio', description: 'Global SMS provider' },
];

// RoundSMS defaults and labels now live in providerSchemas.ts

const EMAIL_PROVIDERS = [
  { id: 'smtp', name: 'Custom SMTP', description: 'Use your own SMTP server' },
  { id: 'sendgrid', name: 'SendGrid', description: 'Email API service' },
  { id: 'ses', name: 'Amazon SES', description: 'AWS email service' },
  { id: 'mailgun', name: 'Mailgun', description: 'Developer email platform' },
];

const WHATSAPP_PROVIDERS = [
  { id: 'meta_cloud', name: 'Meta Cloud API', description: 'Direct WhatsApp Cloud API' },
  { id: 'wati', name: 'WATI', description: 'Official WhatsApp API' },
  { id: 'aisensy', name: 'AiSensy', description: 'WhatsApp marketing platform' },
];

const SUPABASE_FUNCTION_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1`;
const PAYMENT_WEBHOOK_URL = `${SUPABASE_FUNCTION_BASE}/payment-webhook`;
const WHATSAPP_WEBHOOK_URL = `${SUPABASE_FUNCTION_BASE}/whatsapp-webhook`;

export function IntegrationSettings() {
  const { selectedBranch, branchFilter } = useBranchContext();
  const [configSheet, setConfigSheet] = useState<{
    open: boolean;
    type: IntegrationType;
    provider: string;
    existing?: any;
  }>({ open: false, type: 'payment_gateway', provider: '' });
  const queryClient = useQueryClient();

  const { data: integrations = [] } = useQuery({
    queryKey: ['integrations', selectedBranch],
    queryFn: async () => {
      // Fetch global integrations (branch_id IS NULL) + branch-specific ones
      let query = supabase
        .from('integration_settings')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedBranch !== 'all') {
        // Get global settings (null branch_id) OR branch-specific ones
        query = query.or(`branch_id.is.null,branch_id.eq.${selectedBranch}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const getIntegrationsByType = (type: IntegrationType) => 
    integrations.filter((i: any) => i.integration_type === type);

  const activePaymentGateways = getIntegrationsByType('payment_gateway').filter((i: any) => i.is_active).length;
  const activeSmsProviders = getIntegrationsByType('sms').filter((i: any) => i.is_active).length;
  const activeEmailProviders = getIntegrationsByType('email').filter((i: any) => i.is_active).length;
  const activeWhatsApp = getIntegrationsByType('whatsapp').filter((i: any) => i.is_active).length;

  const openConfig = (type: IntegrationType, provider: string) => {
    const existing = integrations.find(
      (i: any) => i.integration_type === type && i.provider === provider
    );
    setConfigSheet({ open: true, type, provider, existing });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Integrations</h2>
          <p className="text-sm text-muted-foreground">Configure payment gateways, SMS, email and WhatsApp</p>
        </div>
      </div>

      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        <StatCard
          title="Payment Gateways"
          value={activePaymentGateways}
          icon={CreditCard}
          variant={activePaymentGateways > 0 ? 'success' : 'default'}
        />
        <StatCard
          title="SMS Providers"
          value={activeSmsProviders}
          icon={Phone}
          variant={activeSmsProviders > 0 ? 'success' : 'default'}
        />
        <StatCard
          title="Email Providers"
          value={activeEmailProviders}
          icon={Mail}
          variant={activeEmailProviders > 0 ? 'success' : 'default'}
        />
        <StatCard
          title="WhatsApp"
          value={activeWhatsApp}
          icon={MessageSquare}
          variant={activeWhatsApp > 0 ? 'success' : 'default'}
        />
        <StatCard
          title="Google Business"
          value={getIntegrationsByType('google_business').filter((i: any) => i.is_active).length}
          icon={Globe}
          variant={getIntegrationsByType('google_business').filter((i: any) => i.is_active).length > 0 ? 'success' : 'default'}
        />
      </div>

      <Tabs defaultValue="payment" className="space-y-4">
        <TabsList className="grid grid-cols-6 w-full max-w-4xl">
          <TabsTrigger value="payment">Payment</TabsTrigger>
          <TabsTrigger value="sms">SMS</TabsTrigger>
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="google">Google</TabsTrigger>
          <TabsTrigger value="leads">Lead Capture</TabsTrigger>
        </TabsList>

        <TabsContent value="payment" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Gateways
              </CardTitle>
              <CardDescription>
                Configure payment gateways with webhook support
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Webhook URL Info Box */}
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 space-y-2">
                <div className="flex items-center gap-2">
                  <Webhook className="h-4 w-4 text-primary" />
                  <h4 className="font-semibold text-sm">Payment Webhook URL</h4>
                </div>
                <p className="text-xs text-muted-foreground">Paste this URL in your payment gateway's webhook settings to receive real-time payment confirmations.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                    {PAYMENT_WEBHOOK_URL}
                  </code>
                  <Button variant="outline" size="sm" onClick={() => {
                    navigator.clipboard.writeText(PAYMENT_WEBHOOK_URL);
                    toast.success('Webhook URL copied!');
                  }}>
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {PAYMENT_PROVIDERS.map((provider) => {
                  const config = getIntegrationsByType('payment_gateway').find(
                    (i: any) => i.provider === provider.id
                  );
                  return (
                    <Card key={provider.id} className="relative">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <PaymentProviderLogo providerId={provider.id} />
                            <div>
                              <h3 className="font-semibold">{provider.name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {config?.is_active ? 'Active' : 'Not configured'}
                              </p>
                            </div>
                          </div>
                          <Badge variant={config?.is_active ? 'default' : 'secondary'}>
                            {config?.is_active ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                            {config?.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <Button 
                          className="w-full mt-4" 
                          variant={config?.is_active ? 'outline' : 'default'}
                          onClick={() => openConfig('payment_gateway', provider.id)}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          {config ? 'Configure' : 'Setup'}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sms" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                SMS Providers
              </CardTitle>
              <CardDescription>
                Configure SMS providers with DLT registration
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <strong>⚠️ DLT Registration Required:</strong> For Indian SMS providers (RoundSMS, MSG91, Fast2SMS), DLT registration is mandatory for transactional SMS. You'll need your DLT Principal Entity ID, registered Sender ID, and pre-approved DLT Template IDs.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {SMS_PROVIDERS.map((provider) => {
                  const config = getIntegrationsByType('sms').find(
                    (i: any) => i.provider === provider.id
                  );
                  return (
                    <Card key={provider.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{provider.name}</h3>
                            <p className="text-sm text-muted-foreground">{provider.description}</p>
                          </div>
                          <Badge variant={config?.is_active ? 'default' : 'secondary'}>
                            {config?.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <Button 
                          className="w-full mt-4" 
                          variant="outline"
                          onClick={() => openConfig('sms', provider.id)}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Providers
              </CardTitle>
              <CardDescription>
                Configure email sending with custom SMTP or API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {EMAIL_PROVIDERS.map((provider) => {
                  const config = getIntegrationsByType('email').find(
                    (i: any) => i.provider === provider.id
                  );
                  return (
                    <Card key={provider.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{provider.name}</h3>
                            <p className="text-sm text-muted-foreground">{provider.description}</p>
                          </div>
                          <Badge variant={config?.is_active ? 'default' : 'secondary'}>
                            {config?.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <Button 
                          className="w-full mt-4" 
                          variant="outline"
                          onClick={() => openConfig('email', provider.id)}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                WhatsApp Business API
              </CardTitle>
              <CardDescription>
                Configure WhatsApp for chat and messaging
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {WHATSAPP_PROVIDERS.map((provider) => {
                  const config = getIntegrationsByType('whatsapp').find(
                    (i: any) => i.provider === provider.id
                  );
                  return (
                    <Card key={provider.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="font-semibold">{provider.name}</h3>
                            <p className="text-sm text-muted-foreground">{provider.description}</p>
                          </div>
                          <Badge variant={config?.is_active ? 'default' : 'secondary'}>
                            {config?.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <Button 
                          className="w-full mt-4" 
                          variant="outline"
                          onClick={() => openConfig('whatsapp', provider.id)}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          Configure
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* AI Auto-Reply Settings */}
          <WhatsAppAISettings />

          {/* Meta Approved Templates Panel */}
          <MetaTemplatesPanel
            integrations={integrations}
            selectedBranch={selectedBranch}
          />

          {/* WhatsApp Business API Setup Guide — Collapsible */}
          <Collapsible>
            <Card className="border-primary/20">
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors rounded-t-xl">
                  <CardTitle className="flex items-center justify-between text-base">
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-5 w-5 text-primary" />
                      WhatsApp Business API — Setup Guide
                    </div>
                    <ChevronRight className="h-4 w-4 transition-transform duration-200 [[data-state=open]_&]:rotate-90" />
                  </CardTitle>
                  <CardDescription>
                    Follow these steps to connect your WhatsApp Business API for sending and receiving messages.
                  </CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-5">
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">1</div>
                      <div>
                        <h4 className="font-semibold text-sm">Create a Meta Business Account</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Go to <span className="font-mono text-primary">business.facebook.com</span> and create or verify your business account.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">2</div>
                      <div>
                        <h4 className="font-semibold text-sm">Set Up WhatsApp in Meta Developer Portal</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Visit <span className="font-mono text-primary">developers.facebook.com</span> → Create App → Select "Business" type → Add "WhatsApp" product.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">3</div>
                      <div>
                        <h4 className="font-semibold text-sm">Generate a Permanent Access Token</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          In your Meta App Dashboard → WhatsApp → API Setup → Generate a permanent token. Copy the <strong>Phone Number ID</strong> and <strong>Business Account ID</strong>.
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">4</div>
                      <div>
                        <h4 className="font-semibold text-sm">Configure the Provider Above</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">Click "Configure" on Meta Cloud API above and enter your credentials.</p>
                        <ul className="text-xs text-muted-foreground mt-1 list-disc list-inside space-y-0.5">
                          <li><strong>Phone Number ID</strong> — from Meta API Setup page</li>
                          <li><strong>Business Account ID</strong> — from Meta Business Settings</li>
                          <li><strong>Access Token</strong> — the permanent token you generated</li>
                          <li><strong>Webhook Verify Token</strong> — any secret string you choose</li>
                        </ul>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">5</div>
                      <div>
                        <h4 className="font-semibold text-sm">Register the Webhook in Meta</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">In Meta Developer Portal → Your App → WhatsApp → Configuration → Webhook:</p>
                        <div className="mt-2 space-y-2">
                          <div>
                            <Label className="text-xs font-medium">Callback URL</Label>
                            <div className="flex items-center gap-2 mt-1">
                              <Input readOnly value={WHATSAPP_WEBHOOK_URL} className="font-mono text-xs h-8" />
                              <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => { navigator.clipboard.writeText(WHATSAPP_WEBHOOK_URL); toast.success('Webhook URL copied!'); }}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            <strong>Verify Token:</strong> Use the same token you entered above. Subscribe to <strong>messages</strong> and <strong>message_template_status_update</strong> fields.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">6</div>
                      <div>
                        <h4 className="font-semibold text-sm">Send a Test Message</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Go to <strong>WhatsApp Chat</strong> from the sidebar, select a contact, type a message and hit send.
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      <strong>Note:</strong> Meta requires your business to be verified and WhatsApp message templates to be approved before sending to non-opted-in users.
                    </p>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </TabsContent>

        <TabsContent value="google" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Globe className="h-5 w-5" />
                Google Business Profile
              </CardTitle>
              <CardDescription>
                Sync approved reviews to your Google Maps listing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {GOOGLE_PROVIDERS.map((provider) => {
                  const config = getIntegrationsByType('google_business').find(
                    (i: any) => i.provider === provider.id
                  );
                  return (
                    <Card key={provider.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Globe className="h-8 w-8 text-blue-500" />
                            <div>
                              <h3 className="font-semibold">{provider.name}</h3>
                              <p className="text-sm text-muted-foreground">{provider.description}</p>
                            </div>
                          </div>
                          <Badge variant={config?.is_active ? 'default' : 'secondary'}>
                            {config?.is_active ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                            {config?.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                        <div className="mt-4 p-3 bg-muted/50 rounded-md">
                          <p className="text-sm text-muted-foreground">
                            Configure Google Business Profile API to automatically sync approved reviews from the Feedback page to your Google Maps listing.
                          </p>
                        </div>
                        <Button 
                          className="w-full mt-4" 
                          variant={config?.is_active ? 'outline' : 'default'}
                          onClick={() => openConfig('google_business', provider.id)}
                        >
                          <Settings className="h-4 w-4 mr-2" />
                          {config ? 'Configure' : 'Setup'}
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Google Business Setup Guide — Collapsible */}
          <Collapsible>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer select-none hover:bg-muted/30 transition-colors rounded-t-xl">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Setup Guide</span>
                    <ChevronRight className="h-4 w-4 transition-transform duration-200 [[data-state=open]_&]:rotate-90" />
                  </CardTitle>
                  <CardDescription>How to connect Google Business Profile for review syncing</CardDescription>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-5">
                  <div className="space-y-4">
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">1</div>
                      <div>
                        <h4 className="font-semibold text-sm">Enable Google Business Profile API</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">Go to <span className="font-mono text-primary">console.cloud.google.com</span> → APIs & Services → Enable "Google My Business API".</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">2</div>
                      <div>
                        <h4 className="font-semibold text-sm">Create OAuth Credentials</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">In Google Cloud Console → Credentials → Create OAuth 2.0 Client ID.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">3</div>
                      <div>
                        <h4 className="font-semibold text-sm">Get Your Account & Location IDs</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">Use the API Explorer to find your <strong>Account ID</strong> and <strong>Location ID</strong>.</p>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">4</div>
                      <div>
                        <h4 className="font-semibold text-sm">Configure Above & Test</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">Click "Setup" above and enter your credentials.</p>
                      </div>
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <p className="text-xs text-amber-700 dark:text-amber-400">
                      <strong>Note:</strong> Your Google Business listing must be verified before reviews can be synced.
                    </p>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        </TabsContent>
        <TabsContent value="leads" className="space-y-4">
          <LeadCaptureTab />
        </TabsContent>
      </Tabs>

      <IntegrationConfigSheet 
        {...configSheet} 
        onOpenChange={(open) => setConfigSheet({ ...configSheet, open })}
        branchId={branchFilter}
      />
    </div>
  );
}

function IntegrationConfigSheet({ 
  open, 
  onOpenChange, 
  type, 
  provider, 
  existing,
  branchId
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: IntegrationType;
  provider: string;
  existing?: any;
  branchId?: string;
}) {
  const [isActive, setIsActive] = useState(existing?.is_active || false);
  const [config, setConfig] = useState<Record<string, string>>(existing?.config || {});
  const [credentials, setCredentials] = useState<Record<string, string>>(existing?.credentials || {});
  const queryClient = useQueryClient();
  const isRoundSms = type === 'sms' && provider === 'roundsms';

  const generateRandomSecret = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  };

  const copyToClipboard = (value: string, message: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(value).then(() => toast.success(message));
      return;
    }
    toast.success(message);
  };

  const handleGenerateVerifyToken = () => {
    const token = generateRandomSecret();
    setConfig((prev) => ({ ...prev, webhook_verify_token: token }));
    copyToClipboard(token, 'Webhook verify token copied');
  };

  const handleGenerateApiKey = () => {
    const token = generateRandomSecret();
    setCredentials((prev) => ({ ...prev, api_key: token }));
    copyToClipboard(token, 'API key copied');
  };

  // Sync state when existing prop changes (e.g., opening sheet for different provider)
  useEffect(() => {
    setIsActive(existing?.is_active || false);
    setConfig({
      ...getDefaultConfigForProvider(type, provider),
      ...(existing?.config || {}),
    });
    setCredentials(existing?.credentials || {});
  }, [existing, open, type, provider]);

  // Only google_business is branch-specific; all others are global
  const isBranchSpecific = type === 'google_business';

  const saveConfig = useMutation({
    mutationFn: async () => {
      if (isBranchSpecific && !branchId) {
        throw new Error('Please select a specific branch for Google Business settings');
      }

      const payload = {
        branch_id: isBranchSpecific ? branchId! : null,
        integration_type: type,
        provider,
        is_active: isActive,
        config,
        credentials,
      };

      if (existing?.id) {
        const { error } = await supabase
          .from('integration_settings')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('integration_settings')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Configuration saved');
      queryClient.invalidateQueries({ queryKey: ['integrations'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save');
    },
  });

  const schema = getProviderSchema(type, provider);
  const configFields = schema.filter(f => f.section === 'config');
  const credentialFields = schema.filter(f => f.section === 'credentials');
  const webhookInfo = getWebhookInfoForProvider(type, provider);
  const displayName = getProviderDisplayName(type, provider);

  const renderField = (field: ProviderFieldDef, values: Record<string, string>, setter: (v: Record<string, string>) => void) => {
    if (field.type === 'select' && field.options) {
      return (
        <div key={field.key} className="space-y-2">
          <Label>{field.label}</Label>
          <Select
            value={values[field.key] || field.options[0]?.value || ''}
            onValueChange={(v) => setter({ ...values, [field.key]: v })}
          >
            <SelectTrigger><SelectValue placeholder={`Select ${field.label}`} /></SelectTrigger>
            <SelectContent>
              {field.options.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    // Special: webhook_verify_token gets Generate & Copy button
    if (field.key === 'webhook_verify_token') {
      return (
        <div key={field.key} className="space-y-2">
          <Label>{field.label}</Label>
          <div className="flex gap-2">
            <Input
              className="flex-1"
              value={values[field.key] || ''}
              onChange={(e) => setter({ ...values, [field.key]: e.target.value })}
              placeholder={field.placeholder}
            />
            <Button size="sm" variant="outline" className="whitespace-nowrap" onClick={handleGenerateVerifyToken}>
              <Copy className="h-3.5 w-3.5 mr-1" /> Generate & Copy
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div key={field.key} className="space-y-2">
        <Label>{field.label}</Label>
        <Input
          type={field.type === 'password' ? 'password' : 'text'}
          value={values[field.key] || ''}
          onChange={(e) => setter({ ...values, [field.key]: e.target.value })}
          placeholder={field.placeholder}
        />
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Configure {displayName}</SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {!isBranchSpecific && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-xs text-muted-foreground">
                <strong>Global Setting</strong> — This integration applies across all branches.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <Label>Enable Integration</Label>
              <p className="text-sm text-muted-foreground">Activate this integration</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Webhook URL box */}
          {webhookInfo && (
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 space-y-2">
              <div className="flex items-center gap-2">
                <Webhook className="h-4 w-4 text-primary" />
                <h4 className="font-semibold text-sm">{webhookInfo.label}</h4>
              </div>
              {webhookInfo.description && (
                <p className="text-xs text-muted-foreground">{webhookInfo.description}</p>
              )}
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs bg-muted px-3 py-2 rounded font-mono break-all">
                  {webhookInfo.url}
                </code>
                <Button variant="outline" size="sm" onClick={() => {
                  navigator.clipboard.writeText(webhookInfo.url);
                  toast.success(`${webhookInfo.label} copied!`);
                }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}

          {/* RoundSMS hint */}
          {type === 'sms' && provider === 'roundsms' && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
              <p className="text-xs text-muted-foreground">
                Use mobile numbers without country code (no 91). Allowed values: <strong>priority</strong> = ndnd/dnd, <strong>stype</strong> = normal/flash/unicode.
              </p>
            </div>
          )}

          {configFields.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-semibold">Configuration</h4>
              {configFields.map(f => renderField(f, config, setConfig))}
            </div>
          )}

          {credentialFields.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-semibold">Credentials</h4>
              {credentialFields.map(f => renderField(f, credentials, setCredentials))}
            </div>
          )}

          {schema.length === 0 && (
            <div className="p-4 text-center text-sm text-muted-foreground">
              No configuration schema available for this provider. Contact support.
            </div>
          )}

          <Button
            className="w-full"
            onClick={() => saveConfig.mutate()}
            disabled={saveConfig.isPending}
          >
            <Save className="h-4 w-4 mr-2" />
            {saveConfig.isPending ? 'Saving...' : 'Save Configuration'}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface MetaApiTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language?: string;
  rejected_reason?: string;
}

function MetaTemplatesPanel({
  integrations,
  selectedBranch,
}: {
  integrations: any[];
  selectedBranch: string;
}) {
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  // Live results from Meta API after a sync — shown in the table with category
  const [metaApiTemplates, setMetaApiTemplates] = useState<MetaApiTemplate[] | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  const { data: localTemplates = [], isLoading: loadingLocal } = useQuery({
    queryKey: ['communication-templates', 'whatsapp-meta'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('id, name, type, meta_template_name, meta_template_status, meta_rejection_reason')
        .eq('type', 'whatsapp')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const hasWhatsAppConfig = integrations.some(
    (i: any) => i.integration_type === 'whatsapp' && i.is_active
  );

  const handleSync = async () => {
    const branch = selectedBranch !== 'all' ? selectedBranch : null;
    if (!branch) {
      toast.error('Please select a specific branch to sync Meta templates');
      return;
    }
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-whatsapp-templates', {
        body: { action: 'list', branch_id: branch },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const templates: MetaApiTemplate[] = data?.templates || [];
      setMetaApiTemplates(templates);
      setLastSynced(new Date().toLocaleTimeString());
      toast.success(`Synced ${templates.length} template(s) from Meta`);
      queryClient.invalidateQueries({ queryKey: ['communication-templates'] });
      queryClient.invalidateQueries({ queryKey: ['communication-templates', 'whatsapp-meta'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync templates from Meta');
    } finally {
      setIsSyncing(false);
    }
  };

  const statusConfig: Record<string, { label: string; icon: any; className: string }> = {
    APPROVED: { label: 'Approved', icon: CheckCircle, className: 'bg-green-100 text-green-700 border-green-200' },
    PENDING: { label: 'Pending', icon: Clock, className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
    REJECTED: { label: 'Rejected', icon: XCircle, className: 'bg-red-100 text-red-700 border-red-200' },
    PAUSED: { label: 'Paused', icon: PauseCircle, className: 'bg-gray-100 text-gray-600 border-gray-200' },
    DISABLED: { label: 'Disabled', icon: PauseCircle, className: 'bg-gray-100 text-gray-600 border-gray-200' },
  };

  // Local templates that have been submitted to Meta (have meta_template_name set)
  const submittedLocal = localTemplates.filter((t: any) => t.meta_template_name);

  // Decide what rows to render:
  // After sync → show full Meta API list (includes category, live status)
  // Before sync → show locally-submitted templates (from DB) as a fallback
  const useMetaList = metaApiTemplates !== null;
  const totalCount = useMetaList ? metaApiTemplates.length : submittedLocal.length;

  return (
    <Card>
      <CardHeader
        className="pb-3 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-green-600" />
            Meta Approved Templates
            {totalCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {totalCount}
              </Badge>
            )}
          </div>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {!hasWhatsAppConfig && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-xs text-amber-700">
                Configure a WhatsApp integration above before syncing or submitting templates to Meta.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {useMetaList
                ? `${metaApiTemplates.length} templates registered with Meta.${lastSynced ? ` Last synced: ${lastSynced}.` : ''}`
                : 'Click "Sync from Meta" to see all templates registered with your WABA.'}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={isSyncing || !hasWhatsAppConfig}
              data-testid="btn-sync-meta-templates"
              className="flex-shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
              {isSyncing ? 'Syncing…' : 'Sync from Meta'}
            </Button>
          </div>

          {/* After sync: show full Meta API list with category */}
          {useMetaList && (
            metaApiTemplates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Send className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No templates found in your WABA.</p>
                <p className="text-xs mt-1">Submit a template using the "Submit to Meta" button in Communication Templates.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {metaApiTemplates.map((mt) => {
                  const cfg = statusConfig[mt.status];
                  const Icon = cfg?.icon;
                  return (
                    <div
                      key={mt.id}
                      className="flex items-start justify-between p-3 rounded-lg border bg-card"
                      data-testid={`meta-template-row-${mt.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{mt.name}</p>
                          {cfg && Icon && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
                              <Icon className="h-3 w-3" />
                              {cfg.label}
                            </span>
                          )}
                          <Badge variant="outline" className="text-xs rounded-full capitalize">
                            {mt.category?.toLowerCase().replace('_', ' ')}
                          </Badge>
                          {mt.language && (
                            <span className="text-xs text-muted-foreground font-mono">{mt.language}</span>
                          )}
                        </div>
                        {mt.status === 'REJECTED' && mt.rejected_reason && (
                          <p className="text-xs text-red-600 mt-1">
                            <strong>Reason:</strong> {mt.rejected_reason}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Before sync: show locally-submitted templates as fallback */}
          {!useMetaList && (
            loadingLocal ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : submittedLocal.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Send className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No templates submitted to Meta yet.</p>
                <p className="text-xs mt-1">
                  Go to <strong>Communication Templates</strong> and click "Submit to Meta" on any WhatsApp template.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {submittedLocal.map((t: any) => {
                  const cfg = t.meta_template_status ? statusConfig[t.meta_template_status] : null;
                  const Icon = cfg?.icon;
                  return (
                    <div
                      key={t.id}
                      className="flex items-start p-3 rounded-lg border bg-card"
                      data-testid={`local-meta-template-row-${t.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{t.name}</p>
                          {cfg && Icon && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
                              <Icon className="h-3 w-3" />
                              {cfg.label}
                            </span>
                          )}
                        </div>
                        {t.meta_template_name && (
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{t.meta_template_name}</p>
                        )}
                        {t.meta_template_status === 'REJECTED' && t.meta_rejection_reason && (
                          <p className="text-xs text-red-600 mt-1">
                            <strong>Reason:</strong> {t.meta_rejection_reason}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          <p className="text-xs text-muted-foreground">
            Sync to refresh live statuses. Template deletion must be done in Meta Business Manager.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

function LeadCaptureTab() {
  const { data: orgSettings, isLoading } = useQuery({
    queryKey: ['org-settings-webhook'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_settings')
        .select('id, webhook_slug')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const queryClient = useQueryClient();

  const regenerateSlug = useMutation({
    mutationFn: async () => {
      if (!orgSettings?.id) throw new Error('No organization settings found');
      const newSlug = crypto.randomUUID();
      const { error } = await supabase
        .from('organization_settings')
        .update({ webhook_slug: newSlug })
        .eq('id', orgSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-settings-webhook'] });
      toast.success('Webhook slug regenerated');
    },
    onError: () => toast.error('Failed to regenerate slug'),
  });

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/webhook-lead-capture`;
  const slugUrl = orgSettings?.webhook_slug ? `${baseUrl}?slug=${orgSettings.webhook_slug}` : baseUrl;

  return (
    <div className="space-y-6">
      {/* Lead Notification Rules */}
      <LeadNotificationSettings />

      {/* Webhook Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Webhook className="h-5 w-5" />
            External Lead Capture Webhook
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Receive leads from Instagram, Facebook, Zapier, Make, or any external source — no manual secret headers needed.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Simplified Slug-Based URL */}
          <div className="space-y-2">
            <Label className="font-semibold flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              Plug & Play Webhook URL
            </Label>
            <div className="flex items-center gap-2">
              <Input readOnly value={slugUrl} className="font-mono text-xs" />
              <Button
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard.writeText(slugUrl);
                  toast.success('Webhook URL copied!');
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              This URL includes your unique authentication slug — no extra headers required. Just paste it into Zapier, Make, or Meta Lead Ads.
            </p>
            <Button variant="outline" size="sm" onClick={() => regenerateSlug.mutate()} disabled={regenerateSlug.isPending || isLoading}>
              {regenerateSlug.isPending ? 'Regenerating...' : 'Regenerate Slug'}
            </Button>
          </div>

          {/* Payload Format */}
          <div className="space-y-2">
            <Label className="font-semibold">JSON Payload Format</Label>
            <div className="p-3 bg-muted/50 rounded-lg font-mono text-xs whitespace-pre overflow-x-auto">
{`{
  "full_name": "John Doe",
  "phone": "+919876543210",
  "email": "john@example.com",
  "source": "instagram",
  "notes": "Interested in premium plan"
}`}
            </div>
          </div>

          {/* Supported Sources */}
          <div className="space-y-2">
            <Label className="font-semibold">Supported Source Values</Label>
            <div className="flex flex-wrap gap-2">
              {['walk_in', 'phone', 'website', 'referral', 'instagram', 'facebook', 'google', 'api', 'zapier'].map(src => (
                <Badge key={src} variant="outline" className="rounded-full capitalize">{src}</Badge>
              ))}
            </div>
          </div>

          {/* Integration Guides */}
          <div className="space-y-3">
            <Label className="font-semibold">Quick Setup Guides</Label>
            <div className="grid gap-3 md:grid-cols-3">
              <Card className="border-border/50">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">📘</span>
                    <h4 className="font-semibold text-sm">Facebook Lead Ads</h4>
                  </div>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Go to Facebook Business Suite → Leads Center</li>
                    <li>Create a new CRM integration</li>
                    <li>Select "Custom Webhook" and paste the URL above</li>
                    <li>Map fields: name → full_name, phone → phone</li>
                  </ol>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">📸</span>
                    <h4 className="font-semibold text-sm">Instagram Lead Ads</h4>
                  </div>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Instagram Lead Ads use the same Meta platform</li>
                    <li>Set source to "instagram" in your Zapier/Make flow</li>
                    <li>Same webhook URL and format applies</li>
                  </ol>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="pt-4 pb-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">⚡</span>
                    <h4 className="font-semibold text-sm">Zapier / Make</h4>
                  </div>
                  <ol className="text-xs text-muted-foreground space-y-1 list-decimal list-inside">
                    <li>Create a Zap/Scenario with your trigger</li>
                    <li>Add "Webhooks by Zapier" → POST action</li>
                    <li>Paste the webhook URL above (includes auth)</li>
                    <li>Map fields to the JSON format above</li>
                  </ol>
                </CardContent>
              </Card>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

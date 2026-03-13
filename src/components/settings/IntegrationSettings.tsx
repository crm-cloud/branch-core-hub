import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  Settings, CheckCircle, XCircle, Save, Globe, Webhook, Copy, ExternalLink
} from 'lucide-react';

type IntegrationType = 'payment_gateway' | 'sms' | 'email' | 'whatsapp' | 'google_business';

const GOOGLE_PROVIDERS = [
  { id: 'google_business', name: 'Google Business Profile', description: 'Sync reviews to Google Maps' },
];

const PAYMENT_PROVIDERS = [
  { id: 'razorpay', name: 'Razorpay', logo: '🔵' },
  { id: 'phonepe', name: 'PhonePe', logo: '💜' },
  { id: 'ccavenue', name: 'CCAvenue', logo: '🟢' },
  { id: 'payu', name: 'PayU', logo: '🟡' },
];

const SMS_PROVIDERS = [
  { id: 'msg91', name: 'MSG91', description: 'Indian SMS with DLT support' },
  { id: 'gupshup', name: 'Gupshup', description: 'Enterprise SMS platform' },
  { id: 'twilio', name: 'Twilio', description: 'Global SMS provider' },
  { id: 'custom', name: 'Custom API', description: 'Your own SMS API' },
];

const EMAIL_PROVIDERS = [
  { id: 'smtp', name: 'Custom SMTP', description: 'Use your own SMTP server' },
  { id: 'sendgrid', name: 'SendGrid', description: 'Email API service' },
  { id: 'ses', name: 'Amazon SES', description: 'AWS email service' },
  { id: 'mailgun', name: 'Mailgun', description: 'Developer email platform' },
];

const WHATSAPP_PROVIDERS = [
  { id: 'wati', name: 'WATI', description: 'Official WhatsApp API' },
  { id: 'interakt', name: 'Interakt', description: 'WhatsApp Business API' },
  { id: 'gupshup', name: 'Gupshup', description: 'WhatsApp messaging' },
  { id: 'custom', name: 'Custom API', description: 'Your own WhatsApp API' },
];

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
      let query = supabase
        .from('integration_settings')
        .select('*')
        .order('created_at', { ascending: false });

      if (selectedBranch !== 'all') {
        query = query.eq('branch_id', selectedBranch);
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
            <CardContent>
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
                            <span className="text-2xl">{provider.logo}</span>
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
            <CardContent>
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
            <CardContent>
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

          {/* WhatsApp Business API Setup Guide */}
          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <ExternalLink className="h-5 w-5 text-primary" />
                WhatsApp Business API — Setup Guide
              </CardTitle>
              <CardDescription>
                Follow these steps to connect your WhatsApp Business API for sending and receiving messages.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-4">
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">1</div>
                  <div>
                    <h4 className="font-semibold text-sm">Create a Meta Business Account</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Go to <span className="font-mono text-primary">business.facebook.com</span> and create or verify your business account. You'll need a valid business email and phone number.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">2</div>
                  <div>
                    <h4 className="font-semibold text-sm">Set Up WhatsApp in Meta Developer Portal</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Visit <span className="font-mono text-primary">developers.facebook.com</span> → Create App → Select "Business" type → Add "WhatsApp" product. This gives you access to the Cloud API.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">3</div>
                  <div>
                    <h4 className="font-semibold text-sm">Generate a Permanent Access Token</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      In your Meta App Dashboard → WhatsApp → API Setup → Generate a permanent token (System User token from Business Settings). Copy the <strong>Phone Number ID</strong> and <strong>Business Account ID</strong> as well.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary font-bold flex items-center justify-center text-sm">4</div>
                  <div>
                    <h4 className="font-semibold text-sm">Configure the Provider Above</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Click "Configure" on WATI or Custom API above and enter:
                    </p>
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
                    <h4 className="font-semibold text-sm">Send a Test Message</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Go to <strong>WhatsApp Chat</strong> from the sidebar, select a contact, type a message and hit send. If configured correctly, the message status will update from "pending" to "sent".
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  <strong>Note:</strong> Meta requires your business to be verified and WhatsApp message templates to be approved before sending to non-opted-in users. Test messages work immediately with the test phone number provided in your Meta App Dashboard.
                </p>
              </div>
            </CardContent>
          </Card>
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

  // Sync state when existing prop changes (e.g., opening sheet for different provider)
  useEffect(() => {
    setIsActive(existing?.is_active || false);
    setConfig(existing?.config || {});
    setCredentials(existing?.credentials || {});
  }, [existing, open]);

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

  const getConfigFields = () => {
    if (type === 'payment_gateway') {
      return {
        config: ['webhook_url'],
        credentials: ['key_id', 'key_secret', 'merchant_id'],
      };
    }
    if (type === 'sms') {
      return {
        config: ['sender_id', 'dlt_entity_id', 'dlt_template_id', 'api_url'],
        credentials: ['api_key', 'auth_token'],
      };
    }
    if (type === 'email') {
      if (provider === 'smtp') {
        return {
          config: ['host', 'port', 'from_email', 'from_name'],
          credentials: ['username', 'password'],
        };
      }
      return {
        config: ['from_email', 'from_name'],
        credentials: ['api_key'],
      };
    }
    if (type === 'whatsapp') {
      return {
        config: ['phone_number_id', 'business_account_id', 'webhook_verify_token'],
        credentials: ['access_token', 'api_key'],
      };
    }
    if (type === 'google_business') {
      return {
        config: ['account_id', 'location_id', 'auto_sync_approved'],
        credentials: ['api_key', 'client_id', 'client_secret'],
      };
    }
    return { config: [], credentials: [] };
  };

  const fields = getConfigFields();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="capitalize">
            Configure {provider.replace('_', ' ')}
          </SheetTitle>
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

          {fields.config.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-semibold">Configuration</h4>
              {fields.config.map((field) => (
                <div key={field} className="space-y-2">
                  <Label className="capitalize">{field.replace(/_/g, ' ')}</Label>
                  <Input
                    value={config[field] || ''}
                    onChange={(e) => setConfig({ ...config, [field]: e.target.value })}
                    placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                  />
                </div>
              ))}
            </div>
          )}

          {fields.credentials.length > 0 && (
            <div className="space-y-4">
              <h4 className="font-semibold">Credentials</h4>
              {fields.credentials.map((field) => (
                <div key={field} className="space-y-2">
                  <Label className="capitalize">{field.replace(/_/g, ' ')}</Label>
                  <Input
                    type="password"
                    value={credentials[field] || ''}
                    onChange={(e) => setCredentials({ ...credentials, [field]: e.target.value })}
                    placeholder={`Enter ${field.replace(/_/g, ' ')}`}
                  />
                </div>
              ))}
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
  );
}

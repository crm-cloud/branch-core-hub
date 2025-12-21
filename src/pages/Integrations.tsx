import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
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
import { BranchSelector } from '@/components/dashboard/BranchSelector';
import { useBranches } from '@/hooks/useBranches';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  CreditCard, MessageSquare, Mail, Phone, Webhook, 
  Settings, CheckCircle, XCircle, Plus, Save
} from 'lucide-react';

type IntegrationType = 'payment_gateway' | 'sms' | 'email' | 'whatsapp';

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

export default function IntegrationsPage() {
  const [selectedBranch, setSelectedBranch] = useState<string>('all');
  const [configSheet, setConfigSheet] = useState<{
    open: boolean;
    type: IntegrationType;
    provider: string;
    existing?: any;
  }>({ open: false, type: 'payment_gateway', provider: '' });
  
  const { data: branches = [] } = useBranches();
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
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">Integrations</h1>
          <BranchSelector
            branches={branches}
            selectedBranch={selectedBranch}
            onBranchChange={setSelectedBranch}
            showAllOption={true}
          />
        </div>

        {/* Stats */}
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
        </div>

        <Tabs defaultValue="payment" className="space-y-4">
          <TabsList className="grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="payment">Payment</TabsTrigger>
            <TabsTrigger value="sms">SMS</TabsTrigger>
            <TabsTrigger value="email">Email</TabsTrigger>
            <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          </TabsList>

          {/* Payment Gateways */}
          <TabsContent value="payment" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Gateways
                </CardTitle>
                <CardDescription>
                  Configure payment gateways with webhook support for automatic payment reconciliation
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

          {/* SMS Providers */}
          <TabsContent value="sms" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Phone className="h-5 w-5" />
                  SMS Providers
                </CardTitle>
                <CardDescription>
                  Configure SMS providers with DLT registration for India
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

          {/* Email Providers */}
          <TabsContent value="email" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  Email Providers
                </CardTitle>
                <CardDescription>
                  Configure email sending with custom SMTP or API providers
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

          {/* WhatsApp */}
          <TabsContent value="whatsapp" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="h-5 w-5" />
                  WhatsApp Business API
                </CardTitle>
                <CardDescription>
                  Configure WhatsApp for chat and automated messaging
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
          </TabsContent>
        </Tabs>

        {/* Configuration Sheet */}
        <IntegrationConfigSheet 
          {...configSheet} 
          onOpenChange={(open) => setConfigSheet({ ...configSheet, open })}
          branchId={selectedBranch !== 'all' ? selectedBranch : undefined}
        />
      </div>
    </AppLayout>
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

  const saveConfig = useMutation({
    mutationFn: async () => {
      if (!branchId) {
        throw new Error('Please select a specific branch');
      }

      const payload = {
        branch_id: branchId,
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
    return { config: [], credentials: [] };
  };

  const fields = getConfigFields();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="capitalize">
            Configure {provider.replace(/_/g, ' ')}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="flex items-center justify-between">
            <Label>Enable Integration</Label>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {fields.config.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium">Configuration</h3>
              {fields.config.map((field) => (
                <div key={field} className="space-y-2">
                  <Label className="capitalize">{field.replace(/_/g, ' ')}</Label>
                  <Input
                    value={config[field] || ''}
                    onChange={(e) => setConfig({ ...config, [field]: e.target.value })}
                    placeholder={field === 'webhook_url' ? 'Auto-generated after save' : ''}
                  />
                </div>
              ))}
            </div>
          )}

          {fields.credentials.length > 0 && (
            <div className="space-y-4">
              <h3 className="font-medium">Credentials</h3>
              {fields.credentials.map((field) => (
                <div key={field} className="space-y-2">
                  <Label className="capitalize">{field.replace(/_/g, ' ')}</Label>
                  <Input
                    type="password"
                    value={credentials[field] || ''}
                    onChange={(e) => setCredentials({ ...credentials, [field]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          )}

          {type === 'payment_gateway' && (
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm">
                  <Webhook className="h-4 w-4" />
                  <span>Webhook URL will be generated after saving</span>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="flex gap-3 pt-4">
            <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              className="flex-1" 
              onClick={() => saveConfig.mutate()}
              disabled={saveConfig.isPending}
            >
              <Save className="h-4 w-4 mr-2" />
              {saveConfig.isPending ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Building2, Plug, Bell, Shield, Globe, Settings as SettingsIcon, Gift, Sparkles } from 'lucide-react';
import { OrganizationSettings } from '@/components/settings/OrganizationSettings';
import { BranchSettings } from '@/components/settings/BranchSettings';
import { IntegrationSettings } from '@/components/settings/IntegrationSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { SecuritySettings } from '@/components/settings/SecuritySettings';
import { WebsiteSettings } from '@/components/settings/WebsiteSettings';
import { ReferralSettings } from '@/components/settings/ReferralSettings';
import { BenefitSettingsComponent } from '@/components/settings/BenefitSettingsComponent';

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'organization';

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <SettingsIcon className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your organization settings</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="grid w-full grid-cols-8 h-auto p-1">
            <TabsTrigger value="organization" className="flex items-center gap-2 py-2">
              <SettingsIcon className="h-4 w-4" />
              <span className="hidden sm:inline">Organization</span>
            </TabsTrigger>
            <TabsTrigger value="branches" className="flex items-center gap-2 py-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Branches</span>
            </TabsTrigger>
            <TabsTrigger value="benefits" className="flex items-center gap-2 py-2">
              <Sparkles className="h-4 w-4" />
              <span className="hidden sm:inline">Benefits</span>
            </TabsTrigger>
            <TabsTrigger value="referrals" className="flex items-center gap-2 py-2">
              <Gift className="h-4 w-4" />
              <span className="hidden sm:inline">Referrals</span>
            </TabsTrigger>
            <TabsTrigger value="integrations" className="flex items-center gap-2 py-2">
              <Plug className="h-4 w-4" />
              <span className="hidden sm:inline">Integrations</span>
            </TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2 py-2">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Notifications</span>
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2 py-2">
              <Shield className="h-4 w-4" />
              <span className="hidden sm:inline">Security</span>
            </TabsTrigger>
            <TabsTrigger value="website" className="flex items-center gap-2 py-2">
              <Globe className="h-4 w-4" />
              <span className="hidden sm:inline">Website</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="organization"><OrganizationSettings /></TabsContent>
          <TabsContent value="branches"><BranchSettings /></TabsContent>
          <TabsContent value="benefits"><BenefitSettingsComponent /></TabsContent>
          <TabsContent value="referrals"><ReferralSettings /></TabsContent>
          <TabsContent value="integrations"><IntegrationSettings /></TabsContent>
          <TabsContent value="notifications"><NotificationSettings /></TabsContent>
          <TabsContent value="security"><SecuritySettings /></TabsContent>
          <TabsContent value="website"><WebsiteSettings /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';
import { Building2, Plug, Bell, Shield, Globe, Settings as SettingsIcon, Gift, Sparkles, MessageSquare, Receipt, FileBox } from 'lucide-react';
import { OrganizationSettings } from '@/components/settings/OrganizationSettings';
import { BranchSettings } from '@/components/settings/BranchSettings';
import { IntegrationSettings } from '@/components/settings/IntegrationSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { SecuritySettings } from '@/components/settings/SecuritySettings';
import { WebsiteSettings } from '@/components/settings/WebsiteSettings';
import { ReferralSettings } from '@/components/settings/ReferralSettings';
import { BenefitSettingsComponent } from '@/components/settings/BenefitSettingsComponent';
import { TemplateManager } from '@/components/settings/TemplateManager';
import { ExpenseCategoryManager } from '@/components/settings/ExpenseCategoryManager';
import { PlanBenefitTemplates } from '@/components/settings/PlanBenefitTemplates';

const SETTINGS_MENU = [
  { value: 'organization', label: 'Organization', icon: SettingsIcon },
  { value: 'branches', label: 'Branches', icon: Building2 },
  { value: 'benefits', label: 'Benefits', icon: Sparkles },
  { value: 'referrals', label: 'Referrals', icon: Gift },
  { value: 'templates', label: 'Templates', icon: MessageSquare },
  { value: 'plan-templates', label: 'Plan & Benefit Templates', icon: FileBox },
  { value: 'expenses', label: 'Expenses', icon: Receipt },
  { value: 'integrations', label: 'Integrations', icon: Plug },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'security', label: 'Security', icon: Shield },
  { value: 'website', label: 'Website', icon: Globe },
];

const SETTINGS_CONTENT: Record<string, React.ReactNode> = {
  organization: <OrganizationSettings />,
  branches: <BranchSettings />,
  benefits: <BenefitSettingsComponent />,
  referrals: <ReferralSettings />,
  templates: <TemplateManager />,
  'plan-templates': <PlanBenefitTemplates />,
  expenses: <ExpenseCategoryManager />,
  integrations: <IntegrationSettings />,
  notifications: <NotificationSettings />,
  security: <SecuritySettings />,
  website: <WebsiteSettings />,
};

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

        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar Navigation */}
          <nav className="w-full md:w-60 shrink-0">
            <div className="flex md:flex-col gap-1 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
              {SETTINGS_MENU.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.value;
                return (
                  <button
                    key={item.value}
                    onClick={() => handleTabChange(item.value)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors whitespace-nowrap',
                      'hover:bg-muted/80',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </nav>

          {/* Content Area */}
          <div className="flex-1 min-w-0">
            {SETTINGS_CONTENT[activeTab] || <OrganizationSettings />}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
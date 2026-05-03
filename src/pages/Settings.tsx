import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { cn } from '@/lib/utils';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { getNavMode, subscribeNavMode, type NavMode } from '@/lib/navPreferences';
import { Building2, Plug, Bell, Shield, Globe, Settings as SettingsIcon, Gift, Sparkles, MessageSquare, Receipt, FileBox, Palette, Megaphone, Bot, IndianRupee, Database, ScanLine, Phone } from 'lucide-react';
import { WhatsAppRoutingSettings } from '@/components/settings/WhatsAppRoutingSettings';
import { HowbodySettings } from '@/components/settings/HowbodySettings';
import { BackupRestore } from '@/components/settings/BackupRestore';
import { OrganizationSettings } from '@/components/settings/OrganizationSettings';
import { BranchSettings } from '@/components/settings/BranchSettings';
import { IntegrationSettings } from '@/components/settings/IntegrationSettings';
import { NotificationSettings } from '@/components/settings/NotificationSettings';
import { SecuritySettings } from '@/components/settings/SecuritySettings';
import { WebsiteSettings } from '@/components/settings/WebsiteSettings';
import { ReferralSettings } from '@/components/settings/ReferralSettings';
import { BenefitSettingsComponent } from '@/components/settings/BenefitSettingsComponent';
import { CommunicationTemplatesHub } from '@/components/settings/CommunicationTemplatesHub';
import { FinanceCategoryManager } from '@/components/settings/FinanceCategoryManager';
import { PlanBenefitTemplates } from '@/components/settings/PlanBenefitTemplates';
import { ThemePicker } from '@/components/settings/ThemePicker';
import { RetentionCampaignManager } from '@/components/settings/RetentionCampaignManager';
import { AIAgentControlCenter } from '@/components/settings/AIAgentControlCenter';
import { TaxGstSettings } from '@/components/settings/TaxGstSettings';

const SETTINGS_MENU = [
  { value: 'ai-agent', label: 'AI Agent', icon: Bot },
  { value: 'appearance', label: 'Appearance', icon: Palette },
  { value: 'backup', label: 'Backup & Restore', icon: Database },
  { value: 'benefits', label: 'Benefits', icon: Sparkles },
  { value: 'howbody', label: 'Body Scanner', icon: ScanLine },
  { value: 'branches', label: 'Branches', icon: Building2 },
  { value: 'finance-categories', label: 'Finance Categories', icon: Receipt },
  { value: 'integrations', label: 'Integrations', icon: Plug },
  { value: 'retention', label: 'Marketing & Retention', icon: Megaphone },
  { value: 'notifications', label: 'Notifications', icon: Bell },
  { value: 'organization', label: 'Organization', icon: SettingsIcon },
  { value: 'plan-templates', label: 'Plan & Benefit Templates', icon: FileBox },
  { value: 'referrals', label: 'Referrals', icon: Gift },
  { value: 'security', label: 'Security', icon: Shield },
  { value: 'tax-gst', label: 'Tax & GST', icon: IndianRupee },
  { value: 'templates', label: 'Communication Templates', icon: MessageSquare },
  { value: 'website', label: 'Website', icon: Globe },
];

const SETTINGS_CONTENT: Record<string, React.ReactNode> = {
  organization: <OrganizationSettings />,
  branches: <BranchSettings />,
  appearance: <ThemePicker />,
  'ai-agent': <AIAgentControlCenter />,
  benefits: <BenefitSettingsComponent />,
  referrals: <ReferralSettings />,
  templates: <CommunicationTemplatesHub />,
  'plan-templates': <PlanBenefitTemplates />,
  'finance-categories': <FinanceCategoryManager />,
  'tax-gst': <TaxGstSettings />,
  retention: <RetentionCampaignManager />,
  integrations: <IntegrationSettings />,
  notifications: <NotificationSettings />,
  security: <SecuritySettings />,
  website: <WebsiteSettings />,
  backup: <BackupRestore />,
  howbody: <HowbodySettings />,
};

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') || 'organization';
  const [navMode, setNavModeState] = useState<NavMode>(getNavMode);

  useEffect(() => subscribeNavMode(setNavModeState), []);

  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value });
  };

  const isHorizontalStacked = navMode === 'horizontal-stacked';

  const Header = (
    <div className="flex items-center gap-3">
      <SettingsIcon className="h-8 w-8 text-primary" />
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your organization settings</p>
      </div>
    </div>
  );

  const content = SETTINGS_CONTENT[activeTab] || <OrganizationSettings />;

  if (isHorizontalStacked) {
    return (
      <AppLayout>
        <div className="space-y-6">
          {/* Horizontal sub-nav matching TopModulesBar style */}
          <div className="rounded-2xl bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70 shadow-sm">
            <ScrollArea className="w-full">
              <nav className="flex items-center gap-1 px-2 py-2 lg:justify-center">
                {SETTINGS_MENU.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => handleTabChange(item.value)}
                      className={cn(
                        'relative inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium transition-all duration-200 whitespace-nowrap',
                        isActive
                          ? 'bg-primary/10 text-primary shadow-[0_6px_20px_-10px_hsl(var(--primary)/0.55)]'
                          : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.label}</span>
                      {isActive && (
                        <span className="pointer-events-none absolute left-3 right-3 -bottom-[7px] h-[2px] rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </nav>
              <ScrollBar orientation="horizontal" className="invisible" />
            </ScrollArea>
          </div>

          {Header}

          <div className="min-w-0">{content}</div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {Header}

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
          <div className="flex-1 min-w-0">{content}</div>
        </div>
      </div>
    </AppLayout>
  );
}
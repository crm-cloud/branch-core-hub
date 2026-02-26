import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useBranchContext } from '@/contexts/BranchContext';
import { 
  FileBox, 
  Crown, 
  Sparkles,
  Loader2,
  CheckCircle2,
  Download,
} from 'lucide-react';

interface PlanTemplate {
  key: string;
  name: string;
  description: string;
  duration_days: number;
  price: number;
  category: 'plan';
}

interface BenefitTemplate {
  key: string;
  name: string;
  code: string;
  description: string;
  category: 'benefit';
  is_bookable: boolean;
}

const PLAN_TEMPLATES: PlanTemplate[] = [
  { key: 'basic-monthly', name: 'Basic Monthly', description: 'Gym access only — 30 days', duration_days: 30, price: 1500, category: 'plan' },
  { key: 'standard-monthly', name: 'Standard Monthly', description: 'Gym + Group Classes — 30 days', duration_days: 30, price: 2500, category: 'plan' },
  { key: 'premium-monthly', name: 'Premium Monthly', description: 'Full access with all amenities — 30 days', duration_days: 30, price: 4000, category: 'plan' },
  { key: 'quarterly', name: 'Quarterly Plan', description: 'Full access — 90 days with 10% discount', duration_days: 90, price: 10800, category: 'plan' },
  { key: 'half-yearly', name: 'Half Yearly Plan', description: 'Full access — 180 days with 15% discount', duration_days: 180, price: 20400, category: 'plan' },
  { key: 'annual', name: 'Annual Plan', description: 'Full access — 365 days with 25% discount', duration_days: 365, price: 36000, category: 'plan' },
  { key: 'day-pass', name: 'Day Pass', description: 'Single day gym access', duration_days: 1, price: 200, category: 'plan' },
  { key: 'student', name: 'Student Plan', description: 'Discounted monthly plan for students', duration_days: 30, price: 1000, category: 'plan' },
];

const BENEFIT_TEMPLATES: BenefitTemplate[] = [
  { key: 'gym-access', name: 'Gym Access', code: 'gym_access', description: 'Full gym floor access', category: 'benefit', is_bookable: false },
  { key: 'pool-access', name: 'Swimming Pool', code: 'pool_access', description: 'Pool access with lane booking', category: 'benefit', is_bookable: true },
  { key: 'steam-room', name: 'Steam Room', code: 'steam_room', description: 'Steam and sauna facility', category: 'benefit', is_bookable: true },
  { key: 'group-classes', name: 'Group Classes', code: 'group_classes', description: 'All group fitness classes', category: 'benefit', is_bookable: true },
  { key: 'personal-training', name: 'Personal Training', code: 'personal_training', description: '1-on-1 trainer sessions', category: 'benefit', is_bookable: true },
  { key: 'locker', name: 'Locker', code: 'locker', description: 'Personal locker assignment', category: 'benefit', is_bookable: false },
  { key: 'towel-service', name: 'Towel Service', code: 'towel_service', description: 'Fresh towel each visit', category: 'benefit', is_bookable: false },
  { key: 'nutrition-consult', name: 'Nutrition Consultation', code: 'nutrition_consult', description: 'Diet plan consultations', category: 'benefit', is_bookable: true },
  { key: 'body-composition', name: 'Body Composition Analysis', code: 'body_composition', description: 'InBody / body scan sessions', category: 'benefit', is_bookable: true },
  { key: 'parking', name: 'Parking', code: 'parking', description: 'Dedicated parking spot', category: 'benefit', is_bookable: false },
];

type TemplateItem = PlanTemplate | BenefitTemplate;

export function PlanBenefitTemplates() {
  const queryClient = useQueryClient();
  const { effectiveBranchId } = useBranchContext();
  const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
  const [selectedBenefits, setSelectedBenefits] = useState<string[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importedKeys, setImportedKeys] = useState<string[]>([]);

  const togglePlan = (key: string) => {
    setSelectedPlans(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const toggleBenefit = (key: string) => {
    setSelectedBenefits(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]);
  };

  const handleImport = async () => {
    if (!effectiveBranchId) {
      toast.error('Please select a branch first');
      return;
    }
    if (selectedPlans.length === 0 && selectedBenefits.length === 0) {
      toast.error('Please select at least one template to import');
      return;
    }

    setIsImporting(true);
    const newlyImported: string[] = [];

    try {
      // Import benefit types
      for (const key of selectedBenefits) {
        const template = BENEFIT_TEMPLATES.find(b => b.key === key);
        if (!template) continue;

        const { error } = await supabase.from('benefit_types').insert({
          branch_id: effectiveBranchId,
          name: template.name,
          code: template.code,
          description: template.description,
          is_bookable: template.is_bookable,
          is_active: true,
        });

        if (error) {
          if (error.code === '23505') {
            // Duplicate — skip silently
            continue;
          }
          throw error;
        }
        newlyImported.push(key);
      }

      // Import plans
      for (const key of selectedPlans) {
        const template = PLAN_TEMPLATES.find(p => p.key === key);
        if (!template) continue;

        const { error } = await supabase.from('membership_plans').insert({
          branch_id: effectiveBranchId,
          name: template.name,
          description: template.description,
          duration_days: template.duration_days,
          price: template.price,
          is_active: true,
        });

        if (error) {
          if (error.code === '23505') continue;
          throw error;
        }
        newlyImported.push(key);
      }

      setImportedKeys(prev => [...prev, ...newlyImported]);
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      queryClient.invalidateQueries({ queryKey: ['benefit-types'] });
      toast.success(`Imported ${newlyImported.length} templates successfully`);
      setSelectedPlans([]);
      setSelectedBenefits([]);
    } catch (error: any) {
      console.error('Import error:', error);
      toast.error(error.message || 'Failed to import templates');
    } finally {
      setIsImporting(false);
    }
  };

  const totalSelected = selectedPlans.length + selectedBenefits.length;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileBox className="h-5 w-5" />
            Pre-built Templates
          </CardTitle>
          <CardDescription>
            Select and import ready-made membership plans and benefit types into your branch. Duplicates are automatically skipped.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Plans Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Crown className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Membership Plans</h3>
              <Badge variant="secondary" className="ml-auto text-xs">{selectedPlans.length} selected</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {PLAN_TEMPLATES.map((template) => {
                const isSelected = selectedPlans.includes(template.key);
                const isImported = importedKeys.includes(template.key);
                return (
                  <label
                    key={template.key}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      isImported
                        ? 'bg-success/5 border-success/30 opacity-70'
                        : isSelected 
                          ? 'bg-primary/5 border-primary/30' 
                          : 'bg-muted/30 border-border hover:bg-muted/50'
                    }`}
                  >
                    {isImported ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" />
                    ) : (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => togglePlan(template.key)}
                        className="mt-0.5"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{template.name}</p>
                        <Badge variant="outline" className="text-xs">₹{template.price.toLocaleString()}</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">{template.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Benefits Section */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold">Benefit Types</h3>
              <Badge variant="secondary" className="ml-auto text-xs">{selectedBenefits.length} selected</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {BENEFIT_TEMPLATES.map((template) => {
                const isSelected = selectedBenefits.includes(template.key);
                const isImported = importedKeys.includes(template.key);
                return (
                  <label
                    key={template.key}
                    className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                      isImported
                        ? 'bg-success/5 border-success/30 opacity-70'
                        : isSelected 
                          ? 'bg-primary/5 border-primary/30' 
                          : 'bg-muted/30 border-border hover:bg-muted/50'
                    }`}
                  >
                    {isImported ? (
                      <CheckCircle2 className="h-4 w-4 mt-0.5 text-success shrink-0" />
                    ) : (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleBenefit(template.key)}
                        className="mt-0.5"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{template.name}</p>
                        {template.is_bookable && <Badge variant="outline" className="text-xs">Bookable</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground">{template.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Import Button */}
          <Button
            onClick={handleImport}
            disabled={isImporting || totalSelected === 0}
            size="lg"
            className="w-full"
          >
            {isImporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Import Selected ({totalSelected} templates)
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
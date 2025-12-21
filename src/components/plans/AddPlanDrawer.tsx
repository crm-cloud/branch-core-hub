import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface AddPlanDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId?: string;
}

const BENEFIT_OPTIONS = [
  { id: 'gym_access', label: 'Gym Access', icon: '🏋️' },
  { id: 'pool_access', label: 'Pool Access', icon: '🏊' },
  { id: 'steam_sauna', label: 'Steam & Sauna', icon: '🧖' },
  { id: 'group_classes', label: 'Group Classes', icon: '👥' },
  { id: 'personal_training', label: 'Personal Training Sessions', icon: '💪' },
  { id: 'locker', label: 'Locker Facility', icon: '🔐' },
  { id: 'parking', label: 'Free Parking', icon: '🅿️' },
  { id: 'towel_service', label: 'Towel Service', icon: '🧴' },
  { id: 'nutrition_consult', label: 'Nutrition Consultation', icon: '🥗' },
  { id: 'body_composition', label: 'Body Composition Analysis', icon: '📊' },
  { id: 'guest_passes', label: 'Guest Passes', icon: '🎫' },
  { id: 'smoothie_bar', label: 'Smoothie Bar Discount', icon: '🥤' },
];

type BenefitConfig = {
  enabled: boolean;
  frequency: 'unlimited' | 'daily' | 'weekly' | 'monthly' | 'total';
  limit: number;
};

export function AddPlanDrawer({ open, onOpenChange, branchId }: AddPlanDrawerProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: 0,
    discounted_price: '',
    duration_days: 30,
    admission_fee: 0,
    max_freeze_days: 0,
    is_transferable: false,
    is_active: true,
  });

  const [benefits, setBenefits] = useState<Record<string, BenefitConfig>>(
    Object.fromEntries(BENEFIT_OPTIONS.map(b => [b.id, { enabled: false, frequency: 'unlimited' as const, limit: 0 }]))
  );

  const toggleBenefit = (id: string) => {
    setBenefits(prev => ({
      ...prev,
      [id]: { ...prev[id], enabled: !prev[id].enabled }
    }));
  };

  const updateBenefitConfig = (id: string, field: 'frequency' | 'limit', value: any) => {
    setBenefits(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price) {
      toast.error('Please fill in required fields');
      return;
    }

    setIsSubmitting(true);
    try {
      // Create the plan
      const { data: planData, error: planError } = await supabase.from('membership_plans').insert({
        name: formData.name,
        description: formData.description || null,
        price: formData.price,
        discounted_price: formData.discounted_price ? Number(formData.discounted_price) : null,
        duration_days: formData.duration_days,
        admission_fee: formData.admission_fee || null,
        max_freeze_days: formData.max_freeze_days || null,
        is_transferable: formData.is_transferable,
        is_active: formData.is_active,
        branch_id: branchId || null,
      }).select().single();

      if (planError) throw planError;

      // Create the benefits
      const enabledBenefits = Object.entries(benefits)
        .filter(([_, config]) => config.enabled)
        .map(([benefitType, config]) => ({
          plan_id: planData.id,
          benefit_type: benefitType as any,
          frequency: config.frequency,
          limit_count: config.frequency === 'unlimited' ? null : config.limit,
          is_active: true,
        }));

      if (enabledBenefits.length > 0) {
        const { error: benefitsError } = await supabase
          .from('plan_benefits')
          .insert(enabledBenefits);
        
        if (benefitsError) throw benefitsError;
      }

      toast.success('Plan created successfully');
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      onOpenChange(false);
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        price: 0,
        discounted_price: '',
        duration_days: 30,
        admission_fee: 0,
        max_freeze_days: 0,
        is_transferable: false,
        is_active: true,
      });
      setBenefits(Object.fromEntries(BENEFIT_OPTIONS.map(b => [b.id, { enabled: false, frequency: 'unlimited' as const, limit: 0 }])));
    } catch (error: any) {
      console.error('Error creating plan:', error);
      toast.error(error.message || 'Failed to create plan');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add Membership Plan</SheetTitle>
          <SheetDescription>Create a new membership plan with benefits</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Plan Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Monthly Basic, Annual Premium, etc."
            />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Plan description..."
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Price (₹) *</Label>
              <Input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Discounted Price (₹)</Label>
              <Input
                type="number"
                value={formData.discounted_price}
                onChange={(e) => setFormData({ ...formData, discounted_price: e.target.value })}
                placeholder="Optional"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Duration (days) *</Label>
              <Input
                type="number"
                value={formData.duration_days}
                onChange={(e) => setFormData({ ...formData, duration_days: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Admission Fee (₹)</Label>
              <Input
                type="number"
                value={formData.admission_fee}
                onChange={(e) => setFormData({ ...formData, admission_fee: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Max Freeze Days</Label>
            <Input
              type="number"
              value={formData.max_freeze_days}
              onChange={(e) => setFormData({ ...formData, max_freeze_days: Number(e.target.value) })}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <Label>Transferable</Label>
              <p className="text-xs text-muted-foreground">Allow membership transfer</p>
            </div>
            <Switch
              checked={formData.is_transferable}
              onCheckedChange={(checked) => setFormData({ ...formData, is_transferable: checked })}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <Label>Active</Label>
              <p className="text-xs text-muted-foreground">Show plan in purchase options</p>
            </div>
            <Switch
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <Separator className="my-4" />

          <div className="space-y-4">
            <div>
              <Label className="text-base font-semibold">Plan Benefits</Label>
              <p className="text-sm text-muted-foreground">Select the benefits included in this plan</p>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {BENEFIT_OPTIONS.map((benefit) => (
                <div key={benefit.id} className="border rounded-lg p-3">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      id={benefit.id}
                      checked={benefits[benefit.id].enabled}
                      onCheckedChange={() => toggleBenefit(benefit.id)}
                    />
                    <label htmlFor={benefit.id} className="flex-1 cursor-pointer">
                      <span className="mr-2">{benefit.icon}</span>
                      {benefit.label}
                    </label>
                  </div>
                  
                  {benefits[benefit.id].enabled && (
                    <div className="mt-3 ml-6 grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Frequency</Label>
                        <Select
                          value={benefits[benefit.id].frequency}
                          onValueChange={(v) => updateBenefitConfig(benefit.id, 'frequency', v)}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="unlimited">Unlimited</SelectItem>
                            <SelectItem value="daily">Per Day</SelectItem>
                            <SelectItem value="weekly">Per Week</SelectItem>
                            <SelectItem value="monthly">Per Month</SelectItem>
                            <SelectItem value="total">Total (Plan Duration)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {benefits[benefit.id].frequency !== 'unlimited' && (
                        <div>
                          <Label className="text-xs">Limit</Label>
                          <Input
                            type="number"
                            className="h-8"
                            value={benefits[benefit.id].limit}
                            onChange={(e) => updateBenefitConfig(benefit.id, 'limit', Number(e.target.value))}
                            min={1}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creating...' : 'Create Plan'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

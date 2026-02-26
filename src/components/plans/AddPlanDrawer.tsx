import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useBenefitTypes } from '@/hooks/useBenefitTypes';
import { toast } from 'sonner';
import { Loader2, ExternalLink, Plus, X, Infinity } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getBenefitIcon } from '@/lib/benefitIcons';
import { safeBenefitEnum } from '@/lib/benefitEnums';

interface AddPlanDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId?: string;
}

type SelectedBenefit = {
  benefitTypeId: string;
  code: string;
  name: string;
  icon: string;
  isUnlimited: boolean;
  limit: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'per_membership';
};

export function AddPlanDrawer({ open, onOpenChange, branchId }: AddPlanDrawerProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();

  const { data: dbBenefitTypes = [], isLoading: isLoadingBenefits } = useBenefitTypes(branchId);
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
    is_visible_to_members: true,
    includes_free_locker: false,
    free_locker_size: 'medium',
  });

  const [selectedBenefits, setSelectedBenefits] = useState<SelectedBenefit[]>([]);

  const availableBenefits = dbBenefitTypes.filter(
    bt => !selectedBenefits.some(sb => sb.benefitTypeId === bt.id)
  );

  const addBenefit = (benefitTypeId: string) => {
    const bt = dbBenefitTypes.find(b => b.id === benefitTypeId);
    if (!bt) return;
    setSelectedBenefits(prev => [...prev, {
      benefitTypeId: bt.id,
      code: bt.code,
      name: bt.name,
      icon: bt.icon || 'Sparkles',
      isUnlimited: true,
      limit: 1,
      frequency: 'per_membership',
    }]);
  };

  const removeBenefit = (benefitTypeId: string) => {
    setSelectedBenefits(prev => prev.filter(b => b.benefitTypeId !== benefitTypeId));
  };

  const updateBenefit = (benefitTypeId: string, updates: Partial<SelectedBenefit>) => {
    setSelectedBenefits(prev => prev.map(b => 
      b.benefitTypeId === benefitTypeId ? { ...b, ...updates } : b
    ));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price) {
      toast.error('Please fill in required fields');
      return;
    }

    setIsSubmitting(true);
    try {
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
        is_visible_to_members: formData.is_visible_to_members,
        branch_id: branchId || null,
        includes_free_locker: formData.includes_free_locker,
        free_locker_size: formData.includes_free_locker ? formData.free_locker_size : null,
      }).select().single();

      if (planError) throw planError;

      const benefitsToInsert = selectedBenefits.map(b => ({
        plan_id: planData.id,
        benefit_type: safeBenefitEnum(b.code) as any,
        benefit_type_id: b.benefitTypeId,
        frequency: (b.isUnlimited ? 'unlimited' : b.frequency) as any,
        limit_count: b.isUnlimited ? null : b.limit,
      }));

      if (benefitsToInsert.length > 0) {
        const { error: benefitsError } = await supabase
          .from('plan_benefits')
          .insert(benefitsToInsert);
        if (benefitsError) throw benefitsError;
      }

      toast.success('Plan created successfully');
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      onOpenChange(false);
      
      setFormData({
        name: '', description: '', price: 0, discounted_price: '', duration_days: 30,
        admission_fee: 0, max_freeze_days: 0, is_transferable: false, is_active: true,
        is_visible_to_members: true, includes_free_locker: false, free_locker_size: 'medium',
      });
      setSelectedBenefits([]);
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

          <div className="flex items-center justify-between py-2">
            <div>
              <Label>Visible to Members</Label>
              <p className="text-xs text-muted-foreground">Show on member dashboard for self-purchase</p>
            </div>
            <Switch
              checked={formData.is_visible_to_members ?? true}
              onCheckedChange={(checked) => setFormData({ ...formData, is_visible_to_members: checked })}
            />
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <Label>Includes Free Locker</Label>
              <p className="text-xs text-muted-foreground">Auto-assigns a physical locker on purchase. For session tracking, add the Locker benefit above.</p>
            </div>
            <Switch
              checked={formData.includes_free_locker}
              onCheckedChange={(checked) => setFormData({ ...formData, includes_free_locker: checked })}
            />
          </div>

          {formData.includes_free_locker && (
            <div className="space-y-2 ml-4 p-3 border rounded-lg bg-muted/30">
              <Label>Locker Size</Label>
              <Select
                value={formData.free_locker_size}
                onValueChange={(v) => setFormData({ ...formData, free_locker_size: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="small">Small</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="large">Large</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ===== PLAN BENEFITS ===== */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-semibold">Plan Benefits</Label>
                <p className="text-sm text-muted-foreground">Add benefits with quantity for the membership duration</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  onOpenChange(false);
                  navigate('/settings?tab=benefits');
                }}
              >
                <ExternalLink className="h-3.5 w-3.5 mr-1" />
                Manage Types
              </Button>
            </div>

            {isLoadingBenefits ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : dbBenefitTypes.length === 0 ? (
              <div className="text-center py-6 border rounded-lg bg-muted/30">
                <p className="text-muted-foreground mb-3">No benefit types created yet</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    navigate('/settings?tab=benefits');
                  }}
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Create Benefit Types in Settings
                </Button>
              </div>
            ) : (
              <>
                {/* Add Benefit Dropdown */}
                {availableBenefits.length > 0 && (
                  <Select onValueChange={(v) => addBenefit(v)}>
                    <SelectTrigger className="w-full">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Plus className="h-4 w-4" />
                        <span>Add a benefit...</span>
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {availableBenefits.map(bt => {
                        const IconComp = getBenefitIcon(bt.code);
                        return (
                          <SelectItem key={bt.id} value={bt.id}>
                            <div className="flex items-center gap-2">
                              <IconComp className="h-4 w-4" />
                              {bt.name}
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                )}

                {/* Selected Benefits List */}
                <div className="space-y-2 max-h-[280px] overflow-y-auto">
                  {selectedBenefits.map(benefit => {
                    const IconComp = getBenefitIcon(benefit.code);
                    return (
                      <div key={benefit.benefitTypeId} className="border rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 font-medium">
                            <IconComp className="h-4 w-4 text-primary" />
                            {benefit.name}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => removeBenefit(benefit.benefitTypeId)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-2">
                          <Select
                            value={benefit.isUnlimited ? 'unlimited' : 'limited'}
                            onValueChange={(v) => updateBenefit(benefit.benefitTypeId, { isUnlimited: v === 'unlimited' })}
                          >
                            <SelectTrigger className="h-8 w-[130px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="unlimited">
                                <div className="flex items-center gap-1">
                                  <Infinity className="h-3.5 w-3.5" /> Unlimited
                                </div>
                              </SelectItem>
                              <SelectItem value="limited">Limited</SelectItem>
                            </SelectContent>
                          </Select>

                          {!benefit.isUnlimited && (
                            <>
                              <Input
                                type="number"
                                className="h-8 w-[70px]"
                                value={benefit.limit}
                                onChange={(e) => updateBenefit(benefit.benefitTypeId, { limit: Number(e.target.value) || 1 })}
                                min={1}
                              />
                              <Select
                                value={benefit.frequency}
                                onValueChange={(v) => updateBenefit(benefit.benefitTypeId, { frequency: v as any })}
                              >
                                <SelectTrigger className="h-8 flex-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="per_membership">Entire Membership</SelectItem>
                                  <SelectItem value="daily">Per Day</SelectItem>
                                  <SelectItem value="weekly">Per Week</SelectItem>
                                  <SelectItem value="monthly">Per Month</SelectItem>
                                </SelectContent>
                              </Select>
                            </>
                          )}
                        </div>

                        {!benefit.isUnlimited && benefit.frequency === 'per_membership' && (
                          <p className="text-xs text-muted-foreground">
                            Total: {benefit.limit} session(s) for entire membership ({formData.duration_days} days)
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {selectedBenefits.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-2">
                    No benefits added yet. Use the dropdown above to add benefits.
                  </p>
                )}
              </>
            )}
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

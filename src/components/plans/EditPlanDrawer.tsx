import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useUpdatePlan } from '@/hooks/usePlans';
import { useBenefitTypes, useCreateBenefitType } from '@/hooks/useBenefitTypes';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Loader2 } from 'lucide-react';
import { safeBenefitEnum } from '@/lib/benefitEnums';
import type { MembershipPlanWithBenefits } from '@/types/membership';

interface EditPlanDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: MembershipPlanWithBenefits | null;
  branchId?: string;
}

type BenefitConfig = {
  enabled: boolean;
  frequency: 'unlimited' | 'daily' | 'weekly' | 'monthly' | 'per_membership';
  limit: number;
  benefitTypeId?: string;
};

export function EditPlanDrawer({ open, onOpenChange, plan, branchId }: EditPlanDrawerProps) {
  const updatePlan = useUpdatePlan();
  const queryClient = useQueryClient();
  const [isSaving, setIsSaving] = useState(false);
  const [addBenefitDialogOpen, setAddBenefitDialogOpen] = useState(false);
  const [newBenefitName, setNewBenefitName] = useState('');
  const [newBenefitCode, setNewBenefitCode] = useState('');
  const [newBenefitIcon, setNewBenefitIcon] = useState('🎁');

  // Fetch dynamic benefit types from database (fully database-driven, no static fallback)
  const { data: dbBenefitTypes = [], isLoading: isLoadingBenefits } = useBenefitTypes(plan?.branch_id || branchId || undefined);
  const createBenefitType = useCreateBenefitType();

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

  // Use database benefit types only (fully dynamic)
  const benefitOptions: Array<{ id: string; label: string; icon: string; code: string; benefitTypeId?: string }> = 
    dbBenefitTypes.map(bt => ({
      id: bt.code,
      label: bt.name,
      icon: bt.icon || '🎁',
      code: bt.code,
      benefitTypeId: bt.id
    }));

  const [benefits, setBenefits] = useState<Record<string, BenefitConfig>>({});

  // Initialize form data when plan changes
  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name || '',
        description: plan.description || '',
        price: plan.price || 0,
        discounted_price: plan.discounted_price?.toString() || '',
        duration_days: plan.duration_days || 30,
        admission_fee: plan.admission_fee || 0,
        max_freeze_days: plan.max_freeze_days || 0,
        is_transferable: plan.is_transferable || false,
        is_active: plan.is_active ?? true,
        is_visible_to_members: (plan as any).is_visible_to_members ?? true,
        includes_free_locker: (plan as any).includes_free_locker ?? false,
        free_locker_size: (plan as any).free_locker_size || 'medium',
      });
    }
  }, [plan]);

  // Initialize benefits when benefit options or plan changes
  useEffect(() => {
    if (plan && benefitOptions.length > 0) {
      const benefitMap: Record<string, BenefitConfig> = {};
      
      // Initialize all benefits as disabled
      benefitOptions.forEach(b => {
        benefitMap[b.id] = { 
          enabled: false, 
          frequency: 'unlimited' as const, 
          limit: 0,
          benefitTypeId: b.benefitTypeId
        };
      });
      
      // Enable benefits that are in the plan
      if (plan.plan_benefits) {
        plan.plan_benefits.forEach((benefit: any) => {
          const benefitKey = benefit.benefit_type;
          if (benefitMap[benefitKey]) {
            benefitMap[benefitKey] = {
              enabled: true,
              frequency: benefit.frequency || 'unlimited',
              limit: benefit.limit_count || 0,
              benefitTypeId: benefit.benefit_type_id || undefined
            };
          } else {
            // Handle benefits that exist in plan but not in current options
            benefitMap[benefitKey] = {
              enabled: true,
              frequency: benefit.frequency || 'unlimited',
              limit: benefit.limit_count || 0,
              benefitTypeId: benefit.benefit_type_id || undefined
            };
          }
        });
      }
      
      setBenefits(benefitMap);
    }
  }, [plan, dbBenefitTypes]);

  const toggleBenefit = (id: string) => {
    setBenefits(prev => ({
      ...prev,
      [id]: { ...prev[id], enabled: !prev[id]?.enabled }
    }));
  };

  const updateBenefitConfig = (id: string, field: 'frequency' | 'limit', value: any) => {
    setBenefits(prev => ({
      ...prev,
      [id]: { ...prev[id], [field]: value }
    }));
  };

  const handleAddBenefitType = async () => {
    if (!newBenefitName.trim() || !newBenefitCode.trim()) {
      toast.error('Please fill in name and code');
      return;
    }

    if (!plan?.branch_id) {
      toast.error('Branch not available');
      return;
    }

    try {
      await createBenefitType.mutateAsync({
        name: newBenefitName.trim(),
        code: newBenefitCode.trim().toLowerCase().replace(/\s+/g, '_'),
        icon: newBenefitIcon,
        branch_id: plan.branch_id,
        is_bookable: false,
      });

      toast.success('Benefit type added');
      setAddBenefitDialogOpen(false);
      setNewBenefitName('');
      setNewBenefitCode('');
      setNewBenefitIcon('🎁');
    } catch (error: any) {
      toast.error(error.message || 'Failed to add benefit type');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plan || !formData.name || !formData.price) {
      toast.error('Please fill in required fields');
      return;
    }

    setIsSaving(true);
    try {
      // Update the plan
      await updatePlan.mutateAsync({
        planId: plan.id,
        data: {
          name: formData.name,
          description: formData.description || undefined,
          price: formData.price,
          discounted_price: formData.discounted_price ? Number(formData.discounted_price) : undefined,
          duration_days: formData.duration_days,
          admission_fee: formData.admission_fee || undefined,
          max_freeze_days: formData.max_freeze_days || undefined,
          is_transferable: formData.is_transferable,
          is_active: formData.is_active,
          includes_free_locker: formData.includes_free_locker,
          free_locker_size: formData.includes_free_locker ? formData.free_locker_size : null,
        },
      });

      // Delete existing benefits and re-insert
      await supabase.from('plan_benefits').delete().eq('plan_id', plan.id);

      const enabledBenefits = Object.entries(benefits)
        .filter(([_, config]) => config.enabled)
        .map(([benefitType, config]) => ({
          plan_id: plan.id,
          benefit_type: safeBenefitEnum(benefitType) as any,
          benefit_type_id: config.benefitTypeId || null,
          frequency: config.frequency as any,
          limit_count: config.frequency === 'unlimited' ? null : config.limit,
        }));

      if (enabledBenefits.length > 0) {
        const { error: benefitsError } = await supabase
          .from('plan_benefits')
          .insert(enabledBenefits);
        
        if (benefitsError) throw benefitsError;
      }

      toast.success('Plan updated successfully');
      queryClient.invalidateQueries({ queryKey: ['plans'] });
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error updating plan:', error);
      toast.error(error.message || 'Failed to update plan');
    } finally {
      setIsSaving(false);
    }
  };

  // Get all benefits to display (from options + any existing in plan not in options)
  const allBenefitsToShow: Array<{ id: string; label: string; icon: string; code: string; benefitTypeId?: string }> = [...benefitOptions];
  if (plan?.plan_benefits) {
    plan.plan_benefits.forEach((pb: any) => {
      if (!allBenefitsToShow.find(b => b.id === pb.benefit_type)) {
        allBenefitsToShow.push({
          id: pb.benefit_type,
          label: pb.benefit_type.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
          icon: '🎁',
          code: pb.benefit_type,
          benefitTypeId: pb.benefit_type_id || undefined
        });
      }
    });
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Membership Plan</SheetTitle>
            <SheetDescription>Update plan details and benefits</SheetDescription>
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
                checked={formData.is_visible_to_members}
                onCheckedChange={(checked) => setFormData({ ...formData, is_visible_to_members: checked })}
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div>
                <Label>Includes Free Locker</Label>
                <p className="text-xs text-muted-foreground">Member gets a complimentary locker</p>
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

            <Separator className="my-4" />

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-semibold">Plan Benefits</Label>
                  <p className="text-sm text-muted-foreground">
                    Select benefits and set as <span className="font-medium text-primary">Unlimited</span> or <span className="font-medium text-primary">Limited</span> (e.g., Sauna = 3/month)
                  </p>
                </div>
                {plan?.branch_id && (
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setAddBenefitDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Custom
                  </Button>
                )}
              </div>

              {isLoadingBenefits ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              ) : allBenefitsToShow.length === 0 ? (
                <div className="text-center py-8 border rounded-lg bg-muted/30">
                  <p className="text-muted-foreground mb-3">No benefit types created yet</p>
                  <Button 
                    type="button" 
                    variant="outline" 
                    size="sm"
                    onClick={() => setAddBenefitDialogOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Your First Benefit Type
                  </Button>
                </div>
              ) : (
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {allBenefitsToShow.map((benefit) => (
                    <div key={benefit.id} className="border rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          id={`edit-${benefit.id}`}
                          checked={benefits[benefit.id]?.enabled || false}
                          onCheckedChange={() => toggleBenefit(benefit.id)}
                        />
                        <label htmlFor={`edit-${benefit.id}`} className="flex-1 cursor-pointer">
                          <span className="mr-2">{benefit.icon}</span>
                          {benefit.label}
                        </label>
                      </div>
                      
                      {benefits[benefit.id]?.enabled && (
                        <div className="mt-3 ml-6 space-y-2">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                id={`edit-${benefit.id}-unlimited`}
                                name={`edit-${benefit.id}-type`}
                                checked={benefits[benefit.id]?.frequency === 'unlimited'}
                                onChange={() => updateBenefitConfig(benefit.id, 'frequency', 'unlimited')}
                                className="h-4 w-4 text-primary"
                              />
                              <label htmlFor={`edit-${benefit.id}-unlimited`} className="text-sm font-medium cursor-pointer">
                                ♾️ Unlimited
                              </label>
                            </div>
                            <div className="flex items-center gap-2">
                              <input
                                type="radio"
                                id={`edit-${benefit.id}-limited`}
                                name={`edit-${benefit.id}-type`}
                                checked={benefits[benefit.id]?.frequency !== 'unlimited'}
                                onChange={() => updateBenefitConfig(benefit.id, 'frequency', 'monthly')}
                                className="h-4 w-4 text-primary"
                              />
                              <label htmlFor={`edit-${benefit.id}-limited`} className="text-sm font-medium cursor-pointer">
                                🔢 Limited
                              </label>
                            </div>
                          </div>
                          
                          {benefits[benefit.id]?.frequency !== 'unlimited' && (
                            <div className="grid grid-cols-2 gap-2 p-2 bg-muted/50 rounded-md">
                              <div>
                                <Label className="text-xs text-muted-foreground">How many times?</Label>
                                <Input
                                  type="number"
                                  className="h-8"
                                  value={benefits[benefit.id]?.limit || 1}
                                  onChange={(e) => updateBenefitConfig(benefit.id, 'limit', Number(e.target.value))}
                                  min={1}
                                  placeholder="e.g., 3"
                                />
                              </div>
                              <div>
                                <Label className="text-xs text-muted-foreground">Per period</Label>
                                <Select
                                  value={benefits[benefit.id]?.frequency || 'monthly'}
                                  onValueChange={(v) => updateBenefitConfig(benefit.id, 'frequency', v)}
                                >
                                  <SelectTrigger className="h-8">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="daily">Day</SelectItem>
                                    <SelectItem value="weekly">Week</SelectItem>
                                    <SelectItem value="monthly">Month</SelectItem>
                                    <SelectItem value="per_membership">Total Pool (Full Duration)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <p className="col-span-2 text-xs text-muted-foreground">
                                {benefits[benefit.id]?.frequency === 'per_membership' 
                                  ? `Total: ${benefits[benefit.id]?.limit || 1} session(s) for entire membership (${formData.duration_days} days)`
                                  : `Example: ${benefits[benefit.id]?.limit || 1} time(s) per ${benefits[benefit.id]?.frequency === 'daily' ? 'day' : benefits[benefit.id]?.frequency === 'weekly' ? 'week' : 'month'}`
                                }
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving || updatePlan.isPending}>
                {isSaving || updatePlan.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      {/* Add Benefit Type Dialog */}
      <Dialog open={addBenefitDialogOpen} onOpenChange={setAddBenefitDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add Custom Benefit Type</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Benefit Name *</Label>
              <Input
                value={newBenefitName}
                onChange={(e) => {
                  setNewBenefitName(e.target.value);
                  setNewBenefitCode(e.target.value.toLowerCase().replace(/\s+/g, '_'));
                }}
                placeholder="e.g., Ice Bath, Cryotherapy"
              />
            </div>
            <div className="space-y-2">
              <Label>Code *</Label>
              <Input
                value={newBenefitCode}
                onChange={(e) => setNewBenefitCode(e.target.value)}
                placeholder="e.g., ice_bath"
              />
              <p className="text-xs text-muted-foreground">Unique identifier (lowercase, underscores)</p>
            </div>
            <div className="space-y-2">
              <Label>Icon (Emoji)</Label>
              <Input
                value={newBenefitIcon}
                onChange={(e) => setNewBenefitIcon(e.target.value)}
                placeholder="🎁"
                className="w-20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddBenefitDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddBenefitType} disabled={createBenefitType.isPending}>
              {createBenefitType.isPending ? 'Adding...' : 'Add Benefit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

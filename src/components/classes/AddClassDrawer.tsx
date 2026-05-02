import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { useCreateClass } from '@/hooks/useClasses';
import { useTrainers } from '@/hooks/useTrainers';
import { useBenefitTypes } from '@/hooks/useBenefitTypes';
import { Gift, IndianRupee, Sparkles } from 'lucide-react';

interface AddClassDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
}

type ChargingMode = 'free' | 'benefit' | 'paid';

export function AddClassDrawer({ open, onOpenChange, branchId }: AddClassDrawerProps) {
  const createClass = useCreateClass();
  const { data: trainers } = useTrainers(branchId);
  const { data: benefitTypes = [] } = useBenefitTypes(branchId);

  const [mode, setMode] = useState<ChargingMode>('free');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    capacity: 20,
    duration_minutes: 60,
    scheduled_at: '',
    trainer_id: '',
    class_type: '',
    benefit_type_id: '',
    requires_benefit: true,
    price: 0,
    gst_rate: 18,
    is_gst_inclusive: true,
  });

  const reset = () => {
    setMode('free');
    setFormData({
      name: '', description: '', capacity: 20, duration_minutes: 60,
      scheduled_at: '', trainer_id: '', class_type: '', benefit_type_id: '',
      requires_benefit: true, price: 0, gst_rate: 18, is_gst_inclusive: true,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.scheduled_at || !branchId) {
      toast.error('Please fill in required fields');
      return;
    }
    if (mode === 'benefit' && !formData.benefit_type_id) {
      toast.error('Select which benefit unlocks this class');
      return;
    }
    if (mode === 'paid' && (!formData.price || formData.price <= 0)) {
      toast.error('Enter a workshop price greater than 0');
      return;
    }

    try {
      await createClass.mutateAsync({
        name: formData.name,
        description: formData.description,
        capacity: formData.capacity,
        duration_minutes: formData.duration_minutes,
        class_type: formData.class_type,
        branch_id: branchId,
        trainer_id: formData.trainer_id || null,
        scheduled_at: new Date(formData.scheduled_at).toISOString(),
        benefit_type_id: mode === 'benefit' ? formData.benefit_type_id : null,
        requires_benefit: mode === 'benefit' ? formData.requires_benefit : false,
        is_paid: mode === 'paid',
        price: mode === 'paid' ? formData.price : 0,
        gst_rate: mode === 'paid' ? formData.gst_rate : 0,
        is_gst_inclusive: mode === 'paid' ? formData.is_gst_inclusive : true,
      } as any);
      toast.success('Class created successfully');
      onOpenChange(false);
      reset();
    } catch (error) {
      toast.error('Failed to create class');
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create New Class</SheetTitle>
          <SheetDescription>Schedule a new group class or paid workshop</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Class Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Yoga, HIIT, Spin, etc."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Class Type</Label>
              <Select
                value={formData.class_type}
                onValueChange={(value) => setFormData({ ...formData, class_type: value })}
              >
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yoga">Yoga</SelectItem>
                  <SelectItem value="hiit">HIIT</SelectItem>
                  <SelectItem value="spin">Spin</SelectItem>
                  <SelectItem value="strength">Strength</SelectItem>
                  <SelectItem value="cardio">Cardio</SelectItem>
                  <SelectItem value="dance">Dance</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Capacity *</Label>
              <Input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) || 20 })}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Date & Time *</Label>
              <Input
                type="datetime-local"
                value={formData.scheduled_at}
                onChange={(e) => setFormData({ ...formData, scheduled_at: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Duration (minutes)</Label>
              <Input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) || 60 })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Trainer</Label>
            <Select
              value={formData.trainer_id || 'none'}
              onValueChange={(value) => setFormData({ ...formData, trainer_id: value === 'none' ? '' : value })}
            >
              <SelectTrigger><SelectValue placeholder="Select trainer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No trainer</SelectItem>
                {trainers?.map((trainer: any) => (
                  <SelectItem key={trainer.id} value={trainer.id}>
                    {trainer.profile_name || trainer.profile_email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Charging mode */}
          <div className="space-y-2 rounded-xl border p-4 bg-muted/30">
            <Label className="text-sm font-semibold">How is this class charged?</Label>
            <RadioGroup value={mode} onValueChange={(v) => setMode(v as ChargingMode)} className="space-y-2 pt-1">
              <label className="flex items-start gap-2 cursor-pointer">
                <RadioGroupItem value="free" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium"><Sparkles className="h-3.5 w-3.5" /> Free for everyone</div>
                  <p className="text-xs text-muted-foreground">Any active member can book — no quota, no charge.</p>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <RadioGroupItem value="benefit" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium"><Gift className="h-3.5 w-3.5" /> Included in plan benefit</div>
                  <p className="text-xs text-muted-foreground">Booking consumes a member's monthly/weekly quota.</p>
                </div>
              </label>
              <label className="flex items-start gap-2 cursor-pointer">
                <RadioGroupItem value="paid" className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-sm font-medium"><IndianRupee className="h-3.5 w-3.5" /> Paid workshop</div>
                  <p className="text-xs text-muted-foreground">Auto-creates an invoice on booking.</p>
                </div>
              </label>
            </RadioGroup>
          </div>

          {mode === 'benefit' && (
            <div className="space-y-3 rounded-xl border p-4">
              <div className="space-y-2">
                <Label>Linked Benefit *</Label>
                <Select value={formData.benefit_type_id} onValueChange={(v) => setFormData({ ...formData, benefit_type_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Select a benefit" /></SelectTrigger>
                  <SelectContent>
                    {benefitTypes.map((bt: any) => (
                      <SelectItem key={bt.id} value={bt.id}>{bt.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Block members without this benefit</Label>
                  <p className="text-xs text-muted-foreground">If off, members without the benefit can still book for free.</p>
                </div>
                <Switch checked={formData.requires_benefit} onCheckedChange={(v) => setFormData({ ...formData, requires_benefit: v })} />
              </div>
            </div>
          )}

          {mode === 'paid' && (
            <div className="space-y-3 rounded-xl border p-4">
              <div className="space-y-2">
                <Label>Workshop Price (₹) *</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.price}
                  onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>GST Rate (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.gst_rate}
                    onChange={(e) => setFormData({ ...formData, gst_rate: Number(e.target.value) })}
                  />
                </div>
                <div className="flex items-end pb-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Switch
                      checked={formData.is_gst_inclusive}
                      onCheckedChange={(v) => setFormData({ ...formData, is_gst_inclusive: v })}
                    />
                    Price includes GST
                  </label>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Class description..."
              rows={3}
            />
          </div>

          <SheetFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={createClass.isPending}>
              {createClass.isPending ? 'Creating...' : 'Create Class'}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

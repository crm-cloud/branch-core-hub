import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Loader2, Package } from 'lucide-react';
import { toast } from 'sonner';

interface BenefitPackageRow {
  id: string;
  branch_id: string;
  name: string;
  description: string | null;
  benefit_type_id: string | null;
  quantity: number;
  price: number;
  validity_days: number;
  is_active: boolean;
  display_order: number;
  hsn_code?: string | null;
  tax_rate?: number | null;
  tax_inclusive?: boolean | null;
  gst_category?: 'goods' | 'services' | null;
}

const GST_RATES = [0, 5, 12, 18, 28];

interface AddBenefitPackageDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId?: string;
  initial?: BenefitPackageRow | null;
}

export function AddBenefitPackageDrawer({ open, onOpenChange, branchId, initial }: AddBenefitPackageDrawerProps) {
  const queryClient = useQueryClient();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [benefitTypeId, setBenefitTypeId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(5);
  const [price, setPrice] = useState<number>(0);
  const [validityDays, setValidityDays] = useState<number>(30);
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState<number>(0);
  const [hsnCode, setHsnCode] = useState<string>('');
  const [taxRate, setTaxRate] = useState<number>(18);
  const [taxInclusive, setTaxInclusive] = useState<boolean>(true);
  const [gstCategory, setGstCategory] = useState<'goods' | 'services'>('services');

  const { data: benefitTypes = [] } = useQuery({
    queryKey: ['benefit-types-for-package', branchId],
    enabled: !!branchId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('benefit_types')
        .select('id, name, code, category')
        .eq('branch_id', branchId!)
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
  });

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name || '');
      setDescription(initial.description || '');
      setBenefitTypeId(initial.benefit_type_id || '');
      setQuantity(initial.quantity || 5);
      setPrice(Number(initial.price) || 0);
      setValidityDays(initial.validity_days || 30);
      setIsActive(initial.is_active);
      setDisplayOrder(initial.display_order || 0);
    } else {
      setName('');
      setDescription('');
      setBenefitTypeId('');
      setQuantity(5);
      setPrice(0);
      setValidityDays(30);
      setIsActive(true);
      setDisplayOrder(0);
    }
  }, [open, initial]);

  const save = useMutation({
    mutationFn: async () => {
      if (!branchId) throw new Error('Select a branch first');
      if (!name.trim()) throw new Error('Name is required');
      if (!benefitTypeId) throw new Error('Pick a benefit type');
      if (price < 0) throw new Error('Price cannot be negative');

      // Resolve benefit_type enum from selected type code (best-effort, defaults to 'recovery_session')
      const selected = benefitTypes.find((b: any) => b.id === benefitTypeId) as any;
      const enumValue = selected?.code || 'recovery_session';

      const payload = {
        branch_id: branchId,
        name: name.trim(),
        description: description.trim() || null,
        benefit_type: enumValue as any,
        benefit_type_id: benefitTypeId,
        quantity,
        price,
        validity_days: validityDays,
        is_active: isActive,
        display_order: displayOrder,
      };

      if (initial?.id) {
        const { error } = await supabase.from('benefit_packages').update(payload).eq('id', initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('benefit_packages').insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(initial ? 'Add-on package updated' : 'Add-on package created');
      queryClient.invalidateQueries({ queryKey: ['benefit-packages-admin'] });
      queryClient.invalidateQueries({ queryKey: ['addon-benefit-packages'] });
      onOpenChange(false);
    },
    onError: (err: any) => toast.error(err.message || 'Save failed'),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {initial ? 'Edit Add-On Package' : 'New Add-On Package'}
          </SheetTitle>
          <SheetDescription>
            Define a benefit credit pack members can purchase from the dashboard.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 mt-6">
          <div className="space-y-2">
            <Label>Package Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. 5 × Sauna Sessions" />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Optional short description" />
          </div>

          <div className="space-y-2">
            <Label>Benefit Type</Label>
            <Select value={benefitTypeId} onValueChange={setBenefitTypeId}>
              <SelectTrigger><SelectValue placeholder="Select a benefit" /></SelectTrigger>
              <SelectContent>
                {benefitTypes.map((b: any) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Credits / Sessions</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value || '0', 10))} />
            </div>
            <div className="space-y-2">
              <Label>Price (₹)</Label>
              <Input type="number" min={0} value={price} onChange={(e) => setPrice(parseFloat(e.target.value || '0'))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Validity (days)</Label>
              <Input type="number" min={1} value={validityDays} onChange={(e) => setValidityDays(parseInt(e.target.value || '0', 10))} />
            </div>
            <div className="space-y-2">
              <Label>Display Order</Label>
              <Input type="number" min={0} value={displayOrder} onChange={(e) => setDisplayOrder(parseInt(e.target.value || '0', 10))} />
            </div>
          </div>

          <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/30 px-4 py-3">
            <div>
              <p className="text-sm font-medium">Active</p>
              <p className="text-xs text-muted-foreground">Members can buy this package when active.</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {initial ? 'Save Changes' : 'Create Package'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

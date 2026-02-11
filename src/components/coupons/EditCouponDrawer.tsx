import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface EditCouponDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  branches: { id: string; name: string }[];
  coupon: any | null;
}

export function EditCouponDrawer({ open, onOpenChange, onSuccess, branches, coupon }: EditCouponDrawerProps) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    code: '',
    description: '',
    discount_type: 'percentage',
    discount_value: '',
    min_purchase: '',
    max_uses: '',
    valid_from: '',
    valid_until: '',
    branch_id: '',
    is_active: true,
  });

  useEffect(() => {
    if (coupon) {
      setForm({
        code: coupon.code || '',
        description: (coupon as any).description || '',
        discount_type: coupon.discount_type || 'percentage',
        discount_value: String(coupon.discount_value || ''),
        min_purchase: coupon.min_purchase ? String(coupon.min_purchase) : '',
        max_uses: coupon.max_uses ? String(coupon.max_uses) : '',
        valid_from: coupon.valid_from || '',
        valid_until: coupon.valid_until || '',
        branch_id: coupon.branch_id || '',
        is_active: coupon.is_active ?? true,
      });
    }
  }, [coupon]);

  const handleSubmit = async () => {
    if (!coupon) return;
    if (!form.discount_value || Number(form.discount_value) <= 0) { toast.error('Discount value is required'); return; }

    setSaving(true);
    try {
      const { error } = await supabase.from('discount_codes').update({
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_purchase: form.min_purchase ? Number(form.min_purchase) : null,
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        branch_id: form.branch_id || null,
        is_active: form.is_active,
      } as any).eq('id', coupon.id);

      if (error) throw error;
      toast.success('Coupon updated');
      onSuccess();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || 'Failed to update coupon');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Coupon</SheetTitle>
          <SheetDescription>Update coupon details</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Coupon Code</Label>
            <Input value={form.code} disabled className="font-mono bg-muted" />
          </div>

          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Discount Type</Label>
              <Select value={form.discount_type} onValueChange={v => setForm(f => ({ ...f, discount_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage (%)</SelectItem>
                  <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Value</Label>
              <Input type="number" value={form.discount_value} onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Min Purchase (₹)</Label>
              <Input type="number" value={form.min_purchase} onChange={e => setForm(f => ({ ...f, min_purchase: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Max Uses</Label>
              <Input type="number" value={form.max_uses} onChange={e => setForm(f => ({ ...f, max_uses: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valid From</Label>
              <Input type="date" value={form.valid_from} onChange={e => setForm(f => ({ ...f, valid_from: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Valid Until</Label>
              <Input type="date" value={form.valid_until} onChange={e => setForm(f => ({ ...f, valid_until: e.target.value }))} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Branch</Label>
            <Select value={form.branch_id || 'all'} onValueChange={v => setForm(f => ({ ...f, branch_id: v === 'all' ? '' : v }))}>
              <SelectTrigger><SelectValue placeholder="All branches" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Branches</SelectItem>
                {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label>Active</Label>
            <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : 'Save Changes'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

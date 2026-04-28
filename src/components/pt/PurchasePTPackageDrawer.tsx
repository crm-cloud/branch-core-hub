import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Dumbbell, Check } from 'lucide-react';
import { toast } from 'sonner';

interface PurchasePTPackageDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  branchId: string;
}

export function PurchasePTPackageDrawer({
  open, onOpenChange, memberId, branchId,
}: PurchasePTPackageDrawerProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);

  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['pt-packages-active', branchId],
    enabled: open && !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pt_packages')
        .select('id, name, description, total_sessions, price, validity_days, session_type')
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .order('price', { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const purchase = useMutation({
    mutationFn: async (packageId: string) => {
      const { data, error } = await supabase.rpc('purchase_pt_package', {
        p_member_id: memberId,
        p_package_id: packageId,
        p_branch_id: branchId,
        p_payment_source: 'payment_link',
      });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (data: any) => {
      const invoiceId = data?.invoice_id;
      toast.success('PT package order created. Redirecting to payment…');
      queryClient.invalidateQueries({ queryKey: ['my-pt-sessions'] });
      onOpenChange(false);
      if (invoiceId) {
        navigate(`/member/pay?invoice=${invoiceId}`);
      }
    },
    onError: (e: any) => {
      toast.error(e?.message || 'Could not start checkout');
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" /> Purchase PT Package
          </SheetTitle>
          <SheetDescription>
            Choose a package and continue to secure online payment.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 py-4">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : packages.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No PT packages available right now. Please contact the front desk.
              </CardContent>
            </Card>
          ) : (
            packages.map((pkg: any) => {
              const isSel = selected === pkg.id;
              return (
                <Card
                  key={pkg.id}
                  onClick={() => setSelected(pkg.id)}
                  className={`cursor-pointer transition-all ${
                    isSel ? 'ring-2 ring-primary shadow-md shadow-primary/10' : 'hover:shadow-md'
                  }`}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold">{pkg.name}</h4>
                          {isSel && <Check className="h-4 w-4 text-primary" />}
                        </div>
                        {pkg.description && (
                          <p className="text-xs text-muted-foreground mt-1">{pkg.description}</p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          <Badge variant="secondary" className="text-xs">
                            {pkg.total_sessions} sessions
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            Valid {pkg.validity_days} days
                          </Badge>
                          {pkg.session_type && (
                            <Badge variant="outline" className="text-xs capitalize">
                              {pkg.session_type}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold">₹{Number(pkg.price).toLocaleString('en-IN')}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!selected || purchase.isPending}
            onClick={() => selected && purchase.mutate(selected)}
          >
            {purchase.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Processing…</>
            ) : 'Continue to Payment'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

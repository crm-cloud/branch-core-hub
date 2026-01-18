import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { usePTPackages, usePurchasePTPackage } from '@/hooks/usePTPackages';
import { useTrainers } from '@/hooks/useTrainers';
import { toast } from 'sonner';
import { Dumbbell, Calendar, IndianRupee, FileText, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useQueryClient } from '@tanstack/react-query';

interface PurchasePTDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
  branchId: string;
}

export function PurchasePTDrawer({ open, onOpenChange, memberId, memberName, branchId }: PurchasePTDrawerProps) {
  const { data: packages = [] } = usePTPackages(branchId);
  const { data: trainers = [] } = useTrainers(branchId, true);
  const purchasePT = usePurchasePTPackage();
  const queryClient = useQueryClient();

  const [selectedPackage, setSelectedPackage] = useState<string>('');
  const [selectedTrainer, setSelectedTrainer] = useState<string>('');
  const [purchaseResult, setPurchaseResult] = useState<{ success: boolean; invoiceId?: string } | null>(null);

  const activePackages = packages.filter(p => p.is_active);
  const activeTrainers = trainers.filter(t => t.is_active);

  const selectedPkg = activePackages.find(p => p.id === selectedPackage);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedPackage || !selectedTrainer) {
      toast.error('Please select a package and trainer');
      return;
    }

    if (!selectedPkg) return;

    try {
      await purchasePT.mutateAsync({
        memberId,
        packageId: selectedPackage,
        trainerId: selectedTrainer,
        branchId,
        pricePaid: selectedPkg.price,
      });

      // Invalidate related queries for finance tracking
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['finance-income'] });

      setPurchaseResult({ success: true });
      toast.success('PT Package purchased successfully! Invoice created.');
    } catch (error: any) {
      console.error('Error purchasing PT package:', error);
      toast.error(error.message || 'Failed to purchase PT package');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setSelectedPackage('');
    setSelectedTrainer('');
    setPurchaseResult(null);
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Purchase PT Package</SheetTitle>
          <SheetDescription>Add a personal training package for {memberName}</SheetDescription>
        </SheetHeader>

        {purchaseResult?.success ? (
          <div className="py-12 space-y-6 text-center">
            <div className="h-16 w-16 rounded-full bg-success/10 flex items-center justify-center mx-auto">
              <CheckCircle className="h-8 w-8 text-success" />
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">Purchase Complete!</h3>
              <p className="text-sm text-muted-foreground mb-4">
                PT package has been assigned to {memberName}
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                <span>Invoice has been created automatically</span>
              </div>
            </div>
            <Button onClick={handleClose} className="w-full">
              Done
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="space-y-2">
              <Label>Select Package *</Label>
              <Select value={selectedPackage} onValueChange={setSelectedPackage}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a PT package" />
                </SelectTrigger>
                <SelectContent>
                  {activePackages.map((pkg) => (
                    <SelectItem key={pkg.id} value={pkg.id}>
                      <div className="flex items-center gap-2">
                        <span>{pkg.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {pkg.total_sessions} sessions
                        </Badge>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedPkg && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <h4 className="font-medium">{selectedPkg.name}</h4>
                {selectedPkg.description && (
                  <p className="text-sm text-muted-foreground">{selectedPkg.description}</p>
                )}
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <Dumbbell className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedPkg.total_sessions} sessions</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedPkg.validity_days} days validity</span>
                  </div>
                </div>
                <div className="flex items-baseline gap-2">
                  <IndianRupee className="h-4 w-4" />
                  <span className="text-lg font-bold">
                    {selectedPkg.price.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Assign Trainer *</Label>
              <Select value={selectedTrainer} onValueChange={setSelectedTrainer}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a trainer" />
                </SelectTrigger>
                <SelectContent>
                  {activeTrainers.map((trainer) => (
                    <SelectItem key={trainer.id} value={trainer.id}>
                      <div className="flex items-center gap-2">
                        <span>{trainer.profile_name || trainer.profile_email}</span>
                        {trainer.specializations && trainer.specializations.length > 0 && (
                          <span className="text-xs text-muted-foreground">
                            ({trainer.specializations.slice(0, 2).join(', ')})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <SheetFooter className="pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={purchasePT.isPending || !selectedPackage || !selectedTrainer}>
                {purchasePT.isPending ? 'Processing...' : 'Purchase Package'}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

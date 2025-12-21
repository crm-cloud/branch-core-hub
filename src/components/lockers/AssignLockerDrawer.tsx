import { useState } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { lockerService } from '@/services/lockerService';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Receipt } from 'lucide-react';

interface AssignLockerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locker: any;
  branchId: string;
}

export function AssignLockerDrawer({ open, onOpenChange, locker, branchId }: AssignLockerDrawerProps) {
  const queryClient = useQueryClient();
  const [memberSearch, setMemberSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [assignMonths, setAssignMonths] = useState(1);
  const [isAssigning, setIsAssigning] = useState(false);

  const handleMemberSearch = async () => {
    if (!memberSearch.trim() || !branchId) return;
    const { data } = await supabase
      .from('members')
      .select(`
        id,
        member_code,
        user_id,
        profiles:user_id (full_name)
      `)
      .eq('branch_id', branchId)
      .or(`member_code.ilike.%${memberSearch}%`)
      .limit(10);
    setSearchResults(data || []);
  };

  const handleAssignLocker = async () => {
    if (!selectedMember || !locker || !branchId) return;
    
    setIsAssigning(true);
    try {
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + assignMonths * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const feeAmount = (locker.monthly_fee || 0) * assignMonths;

      // Assign locker
      await lockerService.assignLocker({
        locker_id: locker.id,
        member_id: selectedMember.id,
        start_date: startDate,
        end_date: endDate,
        fee_amount: feeAmount,
      });

      // Create invoice if fee > 0
      if (feeAmount > 0) {
        await lockerService.createLockerInvoice(
          selectedMember.id,
          branchId,
          locker.id,
          locker.locker_number,
          feeAmount,
          assignMonths
        );
        toast.success(`Locker assigned and invoice of ₹${feeAmount} created`);
      } else {
        toast.success('Locker assigned (free)');
      }

      queryClient.invalidateQueries({ queryKey: ['lockers'] });
      onOpenChange(false);
      resetForm();
    } catch (error) {
      toast.error('Failed to assign locker');
    } finally {
      setIsAssigning(false);
    }
  };

  const resetForm = () => {
    setSelectedMember(null);
    setSearchResults([]);
    setMemberSearch('');
    setAssignMonths(1);
  };

  if (!locker) return null;

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Assign Locker {locker.locker_number}</SheetTitle>
          <SheetDescription>
            Assign this locker to a member
            {locker.monthly_fee > 0 && ` (₹${locker.monthly_fee}/month)`}
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Member Search */}
          <div className="space-y-2">
            <Label>Search Member</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Enter member code or name"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleMemberSearch()}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" onClick={handleMemberSearch}>Search</Button>
            </div>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Search Results</Label>
              {searchResults.map((member) => (
                <div
                  key={member.id}
                  onClick={() => setSelectedMember(member)}
                  className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                    selectedMember?.id === member.id ? 'border-accent bg-accent/10' : 'hover:bg-muted/50'
                  }`}
                >
                  <p className="font-medium">{member.profiles?.full_name || 'Unknown'}</p>
                  <p className="text-sm text-muted-foreground">{member.member_code}</p>
                </div>
              ))}
            </div>
          )}

          {/* Selected Member */}
          {selectedMember && (
            <div className="p-4 rounded-lg bg-accent/10 border border-accent/30">
              <p className="font-medium">Selected: {selectedMember.profiles?.full_name}</p>
              <p className="text-sm text-muted-foreground">{selectedMember.member_code}</p>
            </div>
          )}

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duration</Label>
            <Select value={String(assignMonths)} onValueChange={(v) => setAssignMonths(Number(v))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 3, 6, 12].map((m) => (
                  <SelectItem key={m} value={String(m)}>{m} Month{m > 1 ? 's' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Total Amount */}
          {locker.monthly_fee > 0 && (
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Amount:</span>
                <span className="text-xl font-bold">₹{locker.monthly_fee * assignMonths}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                <Receipt className="w-3 h-3 inline mr-1" />
                An invoice will be generated automatically
              </p>
            </div>
          )}
        </div>

        <SheetFooter className="pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button 
            onClick={handleAssignLocker}  
            disabled={!selectedMember || isAssigning}
          >
            {isAssigning ? 'Assigning...' : 'Assign Locker'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
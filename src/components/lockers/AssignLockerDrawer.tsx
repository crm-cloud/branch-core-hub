import { useState, useEffect } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { lockerService } from '@/services/lockerService';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { Search, Receipt, Gift, CheckCircle, CreditCard } from 'lucide-react';

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
  const [isSearching, setIsSearching] = useState(false);
  const [memberHasFreeLocker, setMemberHasFreeLocker] = useState(false);
  const [checkingPlan, setCheckingPlan] = useState(false);

  const handleMemberSearch = async () => {
    if (!memberSearch.trim() || !branchId) return;
    
    setIsSearching(true);
    try {
      // Search by member_code first
      const { data: membersByCode } = await supabase
        .from('members')
        .select(`
          id,
          member_code,
          user_id,
          profiles:user_id (full_name, email, phone)
        `)
        .eq('branch_id', branchId)
        .ilike('member_code', `%${memberSearch}%`)
        .limit(10);

      // Search by profile name, email, or phone
      const { data: membersByProfile } = await supabase
        .from('members')
        .select(`
          id,
          member_code,
          user_id,
          profiles:user_id (full_name, email, phone)
        `)
        .eq('branch_id', branchId)
        .not('user_id', 'is', null)
        .limit(50);

      // Filter members whose profile matches the search
      const searchLower = memberSearch.toLowerCase();
      const filteredByProfile = (membersByProfile || []).filter((m) => {
        const profile = m.profiles as any;
        if (!profile) return false;
        return (
          (profile.full_name && profile.full_name.toLowerCase().includes(searchLower)) ||
          (profile.email && profile.email.toLowerCase().includes(searchLower)) ||
          (profile.phone && profile.phone.includes(memberSearch))
        );
      });

      // Combine and deduplicate results
      const allResults = [...(membersByCode || []), ...filteredByProfile];
      const uniqueResults = allResults.filter(
        (member, index, self) => index === self.findIndex((m) => m.id === member.id)
      ).slice(0, 10);

      setSearchResults(uniqueResults);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search members');
    } finally {
      setIsSearching(false);
    }
  };

  // Check if selected member's plan includes free locker
  useEffect(() => {
    async function checkMemberPlan() {
      if (!selectedMember) {
        setMemberHasFreeLocker(false);
        return;
      }
      
      setCheckingPlan(true);
      try {
        // Get active membership with plan
        const { data: membership } = await supabase
          .from('memberships')
          .select(`
            id,
            membership_plans!inner(
              includes_free_locker,
              free_locker_size
            )
          `)
          .eq('member_id', selectedMember.id)
          .eq('status', 'active')
          .gte('end_date', new Date().toISOString().split('T')[0])
          .order('end_date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (membership) {
          const plan = membership.membership_plans as any;
          const hasFreeLocker = plan?.includes_free_locker === true;
          
          // If plan includes locker and locker size matches (or any size), grant free
          if (hasFreeLocker) {
            const planSize = plan?.free_locker_size;
            const lockerSize = locker?.size?.toLowerCase();
            // Free if no size specified in plan OR sizes match
            setMemberHasFreeLocker(!planSize || !lockerSize || planSize === lockerSize);
          } else {
            setMemberHasFreeLocker(false);
          }
        } else {
          setMemberHasFreeLocker(false);
        }
      } catch (error) {
        console.error('Error checking member plan:', error);
        setMemberHasFreeLocker(false);
      } finally {
        setCheckingPlan(false);
      }
    }
    
    checkMemberPlan();
  }, [selectedMember, locker]);

  const handleAssignLocker = async () => {
    if (!selectedMember || !locker || !branchId) return;
    
    setIsAssigning(true);
    try {
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + assignMonths * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      // If member's plan includes free locker, set fee to 0
      const feeAmount = memberHasFreeLocker ? 0 : (locker.monthly_fee || 0) * assignMonths;

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
      } else if (memberHasFreeLocker) {
        toast.success('Locker assigned (included in membership plan)');
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
    setMemberHasFreeLocker(false);
  };

  if (!locker) return null;

  const isFreeLocker = !locker.monthly_fee || locker.monthly_fee === 0;
  const effectivelyFree = isFreeLocker || memberHasFreeLocker;
  const totalAmount = effectivelyFree ? 0 : (locker.monthly_fee || 0) * assignMonths;

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Assign Locker {locker.locker_number}</SheetTitle>
          <SheetDescription>
            {isFreeLocker ? (
              <span className="flex items-center gap-2 text-success">
                <Gift className="w-4 h-4" />
                Free Locker - No charges apply
              </span>
            ) : (
              `Assign this locker to a member (₹${locker.monthly_fee}/month)`
            )}
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
                  placeholder="Name, code, phone, or email"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleMemberSearch()}
                  className="pl-10"
                />
              </div>
              <Button variant="outline" onClick={handleMemberSearch} disabled={isSearching}>
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Search by name, member code, phone number, or email
            </p>
          </div>

          {/* Search Results */}
          {searchResults.length > 0 && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Search Results ({searchResults.length})</Label>
              <div className="max-h-48 overflow-y-auto space-y-2">
                {searchResults.map((member) => {
                  const profile = member.profiles as any;
                  return (
                    <div
                      key={member.id}
                      onClick={() => setSelectedMember(member)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedMember?.id === member.id ? 'border-accent bg-accent/10' : 'hover:bg-muted/50'
                      }`}
                    >
                      <p className="font-medium">{profile?.full_name || 'Unknown'}</p>
                      <div className="flex gap-2 text-sm text-muted-foreground">
                        <span>{member.member_code}</span>
                        {profile?.phone && <span>• {profile.phone}</span>}
                      </div>
                      {profile?.email && (
                        <p className="text-xs text-muted-foreground">{profile.email}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No Results Message */}
          {memberSearch && searchResults.length === 0 && !isSearching && (
            <div className="p-4 rounded-lg bg-muted text-center">
              <p className="text-sm text-muted-foreground">No members found matching "{memberSearch}"</p>
            </div>
          )}

          {/* Selected Member */}
          {selectedMember && (
            <div className="p-4 rounded-lg bg-accent/10 border border-accent/30">
              <p className="font-medium">Selected: {(selectedMember.profiles as any)?.full_name}</p>
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

          {/* Total Amount or Free Assignment Message */}
          {isFreeLocker ? (
            <div className="p-4 rounded-lg bg-success/10 border border-success/30">
              <div className="flex items-center gap-3">
                <CheckCircle className="w-5 h-5 text-success" />
                <div>
                  <p className="font-medium text-success">Free Assignment</p>
                  <p className="text-sm text-muted-foreground">
                    No invoice will be generated for this locker
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-muted">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Total Amount:</span>
                <span className="text-xl font-bold">₹{totalAmount.toLocaleString()}</span>
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

import { useState } from 'react';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerFooter } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Search, User, Loader2, CheckCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { searchMembersForAssignment, assignPlanToMember } from '@/services/fitnessService';
import { toast } from 'sonner';
import { format, addWeeks } from 'date-fns';

interface AssignPlanDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: {
    name: string;
    type: 'workout' | 'diet';
    description?: string;
    content: any;
  } | null;
  branchId?: string;
}

export function AssignPlanDrawer({ open, onOpenChange, plan, branchId }: AssignPlanDrawerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<{ id: string; member_code: string; full_name: string } | null>(null);
  const [validUntil, setValidUntil] = useState(format(addWeeks(new Date(), 4), 'yyyy-MM-dd'));
  const queryClient = useQueryClient();

  const { data: searchResults = [], isLoading: isSearching } = useQuery({
    queryKey: ['member-search-assign', searchQuery],
    queryFn: () => searchMembersForAssignment(searchQuery, branchId),
    enabled: searchQuery.length >= 2,
  });

  const assignMutation = useMutation({
    mutationFn: assignPlanToMember,
    onSuccess: () => {
      toast.success('Plan assigned successfully!');
      queryClient.invalidateQueries({ queryKey: ['member-fitness-plans'] });
      onOpenChange(false);
      setSelectedMember(null);
      setSearchQuery('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to assign plan');
    },
  });

  const handleAssign = () => {
    if (!selectedMember || !plan) return;

    assignMutation.mutate({
      member_id: selectedMember.id,
      plan_name: plan.name,
      plan_type: plan.type,
      description: plan.description,
      plan_data: plan.content,
      is_custom: true,
      valid_until: validUntil,
      branch_id: branchId,
    });
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>Assign Plan to Member</DrawerTitle>
        </DrawerHeader>
        
        <div className="px-4 py-2 space-y-4">
          {plan && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex items-center gap-2">
                <Badge>{plan.type}</Badge>
                <span className="font-medium">{plan.name}</span>
              </div>
              {plan.description && (
                <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
              )}
            </div>
          )}

          {/* Member Search */}
          <div className="space-y-2">
            <Label>Search Member</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, or code..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Search Results */}
            {searchQuery.length >= 2 && (
              <div className="border rounded-md max-h-40 overflow-y-auto">
                {isSearching ? (
                  <div className="p-3 text-center text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="p-3 text-center text-muted-foreground">No members found</div>
                ) : (
                  searchResults.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => {
                        setSelectedMember(member);
                        setSearchQuery('');
                      }}
                      className="w-full px-3 py-2 text-left hover:bg-muted flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{member.full_name}</span>
                      </div>
                      <Badge variant="outline">{member.member_code}</Badge>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Selected Member */}
          {selectedMember && (
            <div className="p-3 bg-accent/10 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-success" />
                <div>
                  <p className="font-medium">{selectedMember.full_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedMember.member_code}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelectedMember(null)}>
                Change
              </Button>
            </div>
          )}

          {/* Valid Until */}
          <div className="space-y-2">
            <Label>Valid Until</Label>
            <Input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </div>
        </div>

        <DrawerFooter>
          <Button
            onClick={handleAssign}
            disabled={!selectedMember || assignMutation.isPending}
            className="w-full"
          >
            {assignMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Assigning...
              </>
            ) : (
              'Assign Plan'
            )}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

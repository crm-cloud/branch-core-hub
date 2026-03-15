import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Gift, Calendar, Heart } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { addDays, parseISO, format } from 'date-fns';

interface CompGiftDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName?: string;
  membershipId?: string;
  branchId: string;
}

export function CompGiftDrawer({ open, onOpenChange, memberId, memberName, membershipId, branchId }: CompGiftDrawerProps) {
  const queryClient = useQueryClient();
  const [days, setDays] = useState('');
  const [reason, setReason] = useState('');
  const [compSessions, setCompSessions] = useState('1');
  const [compBenefitTypeId, setCompBenefitTypeId] = useState('');
  const [compReason, setCompReason] = useState('');

  const { data: benefitTypes = [] } = useQuery({
    queryKey: ['benefit-types-for-comp', branchId],
    enabled: open && !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('benefit_types')
        .select('id, name, code')
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data || [];
    },
  });

  const extendMutation = useMutation({
    mutationFn: async () => {
      if (!membershipId) throw new Error('No active membership');
      const daysNum = parseInt(days);
      if (!daysNum || daysNum <= 0) throw new Error('Enter valid days');

      const { data: ms } = await supabase
        .from('memberships')
        .select('end_date')
        .eq('id', membershipId)
        .single();

      if (!ms) throw new Error('Membership not found');

      const newEnd = format(addDays(parseISO(ms.end_date), daysNum), 'yyyy-MM-dd');
      const { error } = await supabase
        .from('memberships')
        .update({ end_date: newEnd })
        .eq('id', membershipId);
      if (error) throw error;

      // Log to membership_free_days if table exists
      const { data: { user } } = await supabase.auth.getUser();
      try {
        await (supabase.from('membership_free_days') as any).insert({
          membership_id: membershipId,
          days_added: daysNum,
          reason: reason || 'Comp extension',
          added_by: user?.id,
        });
      } catch { /* ignore if table doesn't exist */ }
    },
    onSuccess: () => {
      toast.success(`Extended membership by ${days} days`);
      queryClient.invalidateQueries({ queryKey: ['member-details'] });
      queryClient.invalidateQueries({ queryKey: ['member-memberships'] });
      setDays('');
      setReason('');
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const compMutation = useMutation({
    mutationFn: async () => {
      if (!compBenefitTypeId) throw new Error('Select a benefit type');
      const sessions = parseInt(compSessions);
      if (!sessions || sessions <= 0) throw new Error('Enter valid sessions');

      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await (supabase.from('member_comps') as any).insert({
        member_id: memberId,
        membership_id: membershipId || null,
        benefit_type_id: compBenefitTypeId,
        comp_sessions: sessions,
        used_sessions: 0,
        reason: compReason || 'Complimentary sessions',
        granted_by: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`Granted ${compSessions} comp session(s)`);
      queryClient.invalidateQueries({ queryKey: ['member-comps'] });
      setCompSessions('1');
      setCompBenefitTypeId('');
      setCompReason('');
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Comp / Gift — {memberName}
          </SheetTitle>
          <SheetDescription>
            Grant complimentary days or benefit sessions as a hospitality gesture
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="extend" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="extend" className="gap-1.5">
              <Calendar className="h-3.5 w-3.5" /> Extend Days
            </TabsTrigger>
            <TabsTrigger value="comp" className="gap-1.5">
              <Heart className="h-3.5 w-3.5" /> Comp Sessions
            </TabsTrigger>
          </TabsList>

          <TabsContent value="extend" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Extra Days *</Label>
              <Input type="number" min="1" value={days} onChange={e => setDays(e.target.value)} placeholder="e.g. 7" />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Service recovery, loyalty gesture" />
            </div>
            <SheetFooter>
              <Button onClick={() => extendMutation.mutate()} disabled={extendMutation.isPending || !membershipId}>
                {extendMutation.isPending ? 'Extending...' : 'Extend Membership'}
              </Button>
            </SheetFooter>
          </TabsContent>

          <TabsContent value="comp" className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Benefit Type *</Label>
              <Select value={compBenefitTypeId} onValueChange={setCompBenefitTypeId}>
                <SelectTrigger><SelectValue placeholder="Select benefit" /></SelectTrigger>
                <SelectContent>
                  {benefitTypes.map((bt: any) => (
                    <SelectItem key={bt.id} value={bt.id}>{bt.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Number of Free Sessions *</Label>
              <Input type="number" min="1" value={compSessions} onChange={e => setCompSessions(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Reason</Label>
              <Textarea value={compReason} onChange={e => setCompReason(e.target.value)} placeholder="e.g. Birthday gift, complaint resolution" />
            </div>
            <SheetFooter>
              <Button onClick={() => compMutation.mutate()} disabled={compMutation.isPending}>
                {compMutation.isPending ? 'Granting...' : 'Grant Comp Sessions'}
              </Button>
            </SheetFooter>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

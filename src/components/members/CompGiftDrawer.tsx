import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Gift, Calendar, Heart, Clock, ArrowRight, Sparkles } from 'lucide-react';
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

  // Fetch current membership details
  const { data: currentMembership } = useQuery({
    queryKey: ['comp-membership-details', membershipId],
    enabled: open && !!membershipId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('id, start_date, end_date, status, membership_plans(name)')
        .eq('id', membershipId!)
        .single();
      if (error) throw error;
      return data;
    },
  });

  // Fetch plan benefits with usage
  const { data: planBenefits = [] } = useQuery({
    queryKey: ['comp-plan-benefits', currentMembership?.id],
    enabled: open && !!currentMembership,
    queryFn: async () => {
      const ms = currentMembership as any;
      // Get plan_id from membership
      const { data: membership } = await supabase
        .from('memberships')
        .select('plan_id')
        .eq('id', ms.id)
        .single();
      if (!membership) return [];

      const { data: benefits } = await supabase
        .from('plan_benefits')
        .select('*, benefit_types:benefit_type_id(id, name, code)')
        .eq('plan_id', membership.plan_id);

      // Get usage
      const { data: usage } = await supabase
        .from('benefit_usage')
        .select('benefit_type_id, usage_count')
        .eq('membership_id', ms.id);

      const usageMap: Record<string, number> = {};
      (usage || []).forEach((u: any) => {
        if (u.benefit_type_id) usageMap[u.benefit_type_id] = (usageMap[u.benefit_type_id] || 0) + (u.usage_count || 1);
      });

      return (benefits || []).map((b: any) => ({
        ...b,
        used: b.benefit_type_id ? (usageMap[b.benefit_type_id] || 0) : 0,
        remaining: b.frequency === 'unlimited' ? null : Math.max(0, (b.limit_count || 0) - (b.benefit_type_id ? (usageMap[b.benefit_type_id] || 0) : 0)),
      }));
    },
  });

  // Fetch existing comps
  const { data: existingComps = [] } = useQuery({
    queryKey: ['member-comps', memberId],
    enabled: open && !!memberId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('member_comps')
        .select('*, benefit_types:benefit_type_id(name)')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false });
      if (error) return [];
      return data || [];
    },
  });

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

  const newExpiryPreview = currentMembership && days
    ? format(addDays(parseISO(currentMembership.end_date), parseInt(days) || 0), 'dd MMM yyyy')
    : null;

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
      queryClient.invalidateQueries({ queryKey: ['active-membership'] });
      queryClient.invalidateQueries({ queryKey: ['comp-membership-details'] });
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
      const { error } = await (supabase as any).from('member_comps').insert({
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

  const activeComps = existingComps.filter((c: any) => c.used_sessions < c.comp_sessions);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            Comp / Gift — {memberName}
          </SheetTitle>
          <SheetDescription>
            Grant complimentary days or benefit sessions as a hospitality gesture
          </SheetDescription>
        </SheetHeader>

        {/* Current Status Overview */}
        {currentMembership && (
          <Card className="mt-4 border-primary/20 bg-primary/5">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-xs text-muted-foreground">Current Plan</p>
                  <p className="font-semibold text-sm">{(currentMembership as any).membership_plans?.name}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Expires</p>
                  <p className="font-semibold text-sm">{format(parseISO(currentMembership.end_date), 'dd MMM yyyy')}</p>
                </div>
              </div>

              {/* Plan Benefits Summary */}
              {planBenefits.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <p className="text-xs font-medium text-muted-foreground mb-2">PLAN BENEFITS</p>
                  <div className="space-y-1.5">
                    {planBenefits.map((b: any, idx: number) => (
                      <div key={idx} className="flex items-center justify-between text-xs">
                        <span className="font-medium">{b.benefit_types?.name || b.benefit_type}</span>
                        {b.frequency === 'unlimited' ? (
                          <Badge variant="secondary" className="text-[10px] h-5">∞ Unlimited</Badge>
                        ) : (
                          <span className={`${b.remaining === 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                            {b.used}/{b.limit_count} used
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Existing Comps */}
              {activeComps.length > 0 && (
                <>
                  <Separator className="my-3" />
                  <p className="text-xs font-medium text-muted-foreground mb-2">ACTIVE COMPS</p>
                  <div className="space-y-1.5">
                    {activeComps.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3 text-amber-500" />
                          <span className="font-medium">{c.benefit_types?.name || 'Benefit'}</span>
                        </div>
                        <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 text-[10px] h-5">
                          {c.comp_sessions - c.used_sessions} remaining
                        </Badge>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        )}

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

            {newExpiryPreview && (
              <Card className="border-success/30 bg-success/5">
                <CardContent className="pt-3 pb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span>{format(parseISO(currentMembership!.end_date), 'dd MMM yyyy')}</span>
                    <ArrowRight className="h-4 w-4 text-success" />
                    <span className="font-bold text-success">{newExpiryPreview}</span>
                  </div>
                </CardContent>
              </Card>
            )}

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

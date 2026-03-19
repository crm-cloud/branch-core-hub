import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePlans } from '@/hooks/usePlans';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AddPlanDrawer } from '@/components/plans/AddPlanDrawer';
import { EditPlanDrawer } from '@/components/plans/EditPlanDrawer';
import { Plus, Clock, Users, Snowflake, ArrowRightLeft, Edit2, Crown, TrendingUp, Star, IndianRupee, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MembershipPlanWithBenefits } from '@/types/membership';
import { useBranchContext } from '@/contexts/BranchContext';
import { format } from 'date-fns';

const gradientBorderColors = [
  'border-l-violet-600',
  'border-l-emerald-600',
  'border-l-amber-500',
  'border-l-rose-500',
  'border-l-sky-500',
  'border-l-fuchsia-500',
];

interface PlanRowProps {
  plan: MembershipPlanWithBenefits;
  index: number;
  isPopular: boolean;
  memberCount: number;
  formatPrice: (price: number) => string;
  getDurationLabel: (days: number) => string;
  onEdit: (plan: MembershipPlanWithBenefits) => void;
  onMemberCountClick: (planId: string, planName: string) => void;
}

function PlanRow({ plan, index, isPopular, memberCount, formatPrice, getDurationLabel, onEdit, onMemberCountClick }: PlanRowProps) {
  const borderColor = gradientBorderColors[index % gradientBorderColors.length];

  return (
    <TableRow
      data-testid={`row-plan-${plan.id}`}
      className={`border-l-4 ${plan.is_active ? borderColor : 'border-l-muted'} ${!plan.is_active ? 'opacity-60' : ''} hover:bg-muted/40 transition-colors`}
    >
      {/* Name + badges */}
      <TableCell className="py-3 pl-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-sm text-foreground">{plan.name}</span>
          {isPopular && (
            <Badge className="bg-amber-500 text-white border-0 gap-1 text-[11px] px-1.5 py-0" data-testid={`badge-popular-${plan.id}`}>
              <Star className="h-2.5 w-2.5 fill-current" />
              Popular
            </Badge>
          )}
          {!plan.is_active && (
            <Badge variant="secondary" className="text-[11px] px-1.5 py-0" data-testid={`badge-inactive-${plan.id}`}>Inactive</Badge>
          )}
        </div>
      </TableCell>

      {/* Price */}
      <TableCell className="py-3">
        <div className="flex items-baseline gap-1.5 flex-wrap">
          <span className="font-bold text-sm text-foreground">
            {formatPrice(plan.discounted_price ?? plan.price)}
          </span>
          {plan.discounted_price && (
            <>
              <span className="text-xs text-muted-foreground line-through">{formatPrice(plan.price)}</span>
              <Badge variant="destructive" className="text-[10px] px-1 py-0">
                {Math.round(((plan.price - plan.discounted_price) / plan.price) * 100)}% OFF
              </Badge>
            </>
          )}
        </div>
      </TableCell>

      {/* Duration */}
      <TableCell className="py-3">
        <span className="flex items-center gap-1 text-sm text-muted-foreground whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          {getDurationLabel(plan.duration_days)}
        </span>
      </TableCell>

      {/* Members */}
      <TableCell className="py-3">
        <button
          data-testid={`btn-members-${plan.id}`}
          onClick={() => onMemberCountClick(plan.id, plan.name)}
          className={`flex items-center gap-1 text-sm font-medium transition-colors ${
            memberCount > 0
              ? 'text-primary hover:text-primary/70 cursor-pointer'
              : 'text-muted-foreground cursor-default'
          }`}
        >
          <Users className="h-3.5 w-3.5 shrink-0" />
          {memberCount}
        </button>
      </TableCell>

      {/* Feature badges */}
      <TableCell className="py-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {plan.max_freeze_days && plan.max_freeze_days > 0 && (
            <Badge variant="outline" className="text-[11px] gap-1 rounded-full px-1.5 py-0" data-testid={`badge-freeze-${plan.id}`}>
              <Snowflake className="h-2.5 w-2.5" />
              {plan.max_freeze_days}d
            </Badge>
          )}
          {plan.is_transferable && (
            <Badge variant="outline" className="text-[11px] gap-1 rounded-full px-1.5 py-0" data-testid={`badge-transfer-${plan.id}`}>
              <ArrowRightLeft className="h-2.5 w-2.5" />
              Transfer
            </Badge>
          )}
          {!plan.max_freeze_days && !plan.is_transferable && (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      </TableCell>

      {/* Edit */}
      <TableCell className="py-3 pr-4 text-right">
        <Button
          data-testid={`btn-edit-plan-${plan.id}`}
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={() => onEdit(plan)}
        >
          <Edit2 className="h-3.5 w-3.5" />
          Edit
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function PlansPage() {
  const { effectiveBranchId, branchFilter } = useBranchContext();
  const { data: plans, isLoading } = usePlans(branchFilter, true);
  const defaultBranchId = effectiveBranchId || '';
  const [addPlanOpen, setAddPlanOpen] = useState(false);
  const [editPlanOpen, setEditPlanOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlanWithBenefits | null>(null);
  const [memberListPlanId, setMemberListPlanId] = useState<string | null>(null);
  const [memberListPlanName, setMemberListPlanName] = useState('');

  const { data: memberCounts = {} } = useQuery({
    queryKey: ['plan-member-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('plan_id')
        .eq('status', 'active');
      if (error) throw error;
      const counts: Record<string, number> = {};
      data?.forEach(m => { counts[m.plan_id] = (counts[m.plan_id] || 0) + 1; });
      return counts;
    },
  });

  const { data: planMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['plan-members', memberListPlanId],
    queryFn: async () => {
      if (!memberListPlanId) return [];
      const { data, error } = await supabase
        .from('memberships')
        .select('id, start_date, end_date, member_id, members!inner(id, member_code, user_id)')
        .eq('plan_id', memberListPlanId)
        .eq('status', 'active');
      if (error) throw error;

      const userIds = data?.map((m: any) => m.members?.user_id).filter(Boolean) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, email, phone, avatar_url')
        .in('id', userIds);

      const profileMap: Record<string, any> = {};
      profiles?.forEach(p => { profileMap[p.id] = p; });

      return data?.map((m: any) => ({
        ...m,
        profile: profileMap[m.members?.user_id] || {},
        member_code: m.members?.member_code,
      })) || [];
    },
    enabled: !!memberListPlanId,
  });

  const formatPrice = (price: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);

  const getDurationLabel = (days: number) => {
    if (days === 1) return '1 Day';
    if (days === 7) return '1 Week';
    if (days === 30) return '1 Month';
    if (days === 90) return '3 Months';
    if (days === 180) return '6 Months';
    if (days === 365) return '1 Year';
    return `${days} Days`;
  };

  const handleEditPlan = (plan: MembershipPlanWithBenefits) => {
    setSelectedPlan(plan);
    setEditPlanOpen(true);
  };

  const handleMemberCountClick = (planId: string, planName: string) => {
    if ((memberCounts[planId] || 0) > 0) {
      setMemberListPlanId(planId);
      setMemberListPlanName(planName);
    }
  };

  const activePlans = plans?.filter(p => p.is_active) || [];
  const inactivePlans = plans?.filter(p => !p.is_active) || [];
  const totalMembers = Object.values(memberCounts).reduce((a, b) => a + b, 0);
  const mostPopularPlan = plans?.reduce((max, plan) =>
    (memberCounts[plan.id] || 0) > (memberCounts[max?.id || ''] || 0) ? plan : max,
    plans?.[0]
  );
  const avgPrice = plans?.length
    ? Math.round(plans.reduce((sum, p) => sum + p.price, 0) / plans.length)
    : 0;

  const rowProps = {
    formatPrice,
    getDurationLabel,
    onEdit: handleEditPlan,
    onMemberCountClick: handleMemberCountClick,
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                <Crown className="h-6 w-6" />
              </div>
              Membership Plans
            </h1>
            <p className="text-muted-foreground mt-1">Design, manage, and optimize your membership tiers</p>
          </div>
          <Button
            data-testid="btn-create-plan"
            onClick={() => setAddPlanOpen(true)}
            className="gap-2 h-11 rounded-xl shadow-lg shadow-primary/20"
          >
            <Plus className="h-4 w-4" />
            Create Plan
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-violet-600 to-indigo-600 text-white border-0 shadow-lg shadow-indigo-500/20 rounded-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="pt-6 pb-5 relative z-10">
              <Crown className="h-5 w-5 opacity-80 mb-2" />
              <div className="text-3xl font-bold" data-testid="stat-active-plans">{activePlans.length}</div>
              <p className="text-sm opacity-80 mt-0.5">Active Plans</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white border-0 shadow-lg shadow-emerald-500/20 rounded-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="pt-6 pb-5 relative z-10">
              <Users className="h-5 w-5 opacity-80 mb-2" />
              <div className="text-3xl font-bold" data-testid="stat-total-members">{totalMembers}</div>
              <p className="text-sm opacity-80 mt-0.5">Active Members</p>
            </CardContent>
          </Card>
          <Card className="bg-card border border-border/50 shadow-lg shadow-slate-200/50 rounded-2xl">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-amber-50 dark:bg-amber-500/10">
                  <TrendingUp className="h-4 w-4 text-amber-600" />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground truncate" data-testid="stat-popular-plan">{mostPopularPlan?.name || 'N/A'}</div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {mostPopularPlan ? `${memberCounts[mostPopularPlan.id] || 0} members` : 'Most Popular'}
              </p>
            </CardContent>
          </Card>
          <Card className="bg-card border border-border/50 shadow-lg shadow-slate-200/50 rounded-2xl">
            <CardContent className="pt-6 pb-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <IndianRupee className="h-4 w-4 text-primary" />
                </div>
              </div>
              <div className="text-2xl font-bold text-foreground" data-testid="stat-avg-price">{formatPrice(avgPrice)}</div>
              <p className="text-sm text-muted-foreground mt-0.5">Avg Plan Price</p>
            </CardContent>
          </Card>
        </div>

        {/* Plans Table */}
        {isLoading ? (
          <Card className="rounded-2xl shadow-lg">
            <CardContent className="p-0">
              <div className="p-4 space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-12 w-full rounded-lg" />
                ))}
              </div>
            </CardContent>
          </Card>
        ) : plans?.length === 0 ? (
          <Card className="rounded-2xl shadow-lg">
            <CardContent className="py-20 text-center">
              <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-6">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Plans Yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Create your first membership plan to start selling memberships</p>
              <Button onClick={() => setAddPlanOpen(true)} className="gap-2 rounded-xl" data-testid="btn-create-first-plan">
                <Plus className="h-4 w-4" />
                Create Your First Plan
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="rounded-2xl shadow-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="pl-4 py-2.5 text-xs font-semibold uppercase tracking-wider">Plan</TableHead>
                  <TableHead className="py-2.5 text-xs font-semibold uppercase tracking-wider">Price</TableHead>
                  <TableHead className="py-2.5 text-xs font-semibold uppercase tracking-wider">Duration</TableHead>
                  <TableHead className="py-2.5 text-xs font-semibold uppercase tracking-wider">Members</TableHead>
                  <TableHead className="py-2.5 text-xs font-semibold uppercase tracking-wider">Features</TableHead>
                  <TableHead className="pr-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activePlans.map((plan, index) => (
                  <PlanRow
                    key={plan.id}
                    plan={plan}
                    index={index}
                    isPopular={mostPopularPlan?.id === plan.id && (memberCounts[plan.id] || 0) > 0}
                    memberCount={memberCounts[plan.id] || 0}
                    {...rowProps}
                  />
                ))}
                {inactivePlans.length > 0 && (
                  <>
                    <TableRow className="hover:bg-transparent">
                      <TableCell colSpan={6} className="py-2 px-4">
                        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                          <div className="h-px flex-1 bg-border" />
                          Inactive Plans
                          <div className="h-px flex-1 bg-border" />
                        </div>
                      </TableCell>
                    </TableRow>
                    {inactivePlans.map((plan, index) => (
                      <PlanRow
                        key={plan.id}
                        plan={plan}
                        index={activePlans.length + index}
                        isPopular={false}
                        memberCount={memberCounts[plan.id] || 0}
                        {...rowProps}
                      />
                    ))}
                  </>
                )}
              </TableBody>
            </Table>
          </Card>
        )}

        <AddPlanDrawer open={addPlanOpen} onOpenChange={setAddPlanOpen} branchId={defaultBranchId} />
        <EditPlanDrawer
          open={editPlanOpen}
          onOpenChange={setEditPlanOpen}
          plan={selectedPlan}
          branchId={defaultBranchId}
        />

        {/* Member List Drawer */}
        <Sheet open={!!memberListPlanId} onOpenChange={(open) => { if (!open) setMemberListPlanId(null); }}>
          <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                {memberListPlanName} — Active Members
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              {membersLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                </div>
              ) : planMembers.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No active members on this plan</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Expires</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {planMembers.map((m: any) => (
                      <TableRow key={m.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={m.profile?.avatar_url} />
                              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {(m.profile?.full_name || '?')[0]}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium text-sm">{m.profile?.full_name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{m.profile?.phone || m.profile?.email || ''}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-mono">{m.member_code}</TableCell>
                        <TableCell className="text-sm">{m.end_date ? format(new Date(m.end_date), 'MMM dd, yyyy') : '—'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </AppLayout>
  );
}

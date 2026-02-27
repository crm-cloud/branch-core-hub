import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePlans } from '@/hooks/usePlans';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { AddPlanDrawer } from '@/components/plans/AddPlanDrawer';
import { EditPlanDrawer } from '@/components/plans/EditPlanDrawer';
import { Plus, Check, Clock, Users, Snowflake, ArrowRightLeft, Edit2, Crown, TrendingUp, Calendar, Star, IndianRupee, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MembershipPlanWithBenefits } from '@/types/membership';
import { useBranchContext } from '@/contexts/BranchContext';

export default function PlansPage() {
  const { effectiveBranchId, branchFilter } = useBranchContext();
  const { data: plans, isLoading } = usePlans(branchFilter, true);
  const defaultBranchId = effectiveBranchId || '';
  const [addPlanOpen, setAddPlanOpen] = useState(false);
  const [editPlanOpen, setEditPlanOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlanWithBenefits | null>(null);

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

  const formatPrice = (price: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);

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

  const activePlans = plans?.filter(p => p.is_active) || [];
  const totalMembers = Object.values(memberCounts).reduce((a, b) => a + b, 0);
  const mostPopularPlan = plans?.reduce((max, plan) => 
    (memberCounts[plan.id] || 0) > (memberCounts[max?.id || ''] || 0) ? plan : max
  , plans?.[0]);
  const avgPrice = plans?.length 
    ? Math.round(plans.reduce((sum, p) => sum + p.price, 0) / plans.length) 
    : 0;

  // Gradient palette for plan cards
  const gradients = [
    'from-violet-600 to-indigo-600',
    'from-emerald-600 to-teal-600',
    'from-amber-500 to-orange-600',
    'from-rose-500 to-pink-600',
    'from-sky-500 to-cyan-600',
    'from-fuchsia-500 to-purple-600',
  ];

  return (
    <AppLayout>
      <div className="p-6 space-y-8">
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
          <Button onClick={() => setAddPlanOpen(true)} className="gap-2 h-11 rounded-xl shadow-lg shadow-primary/20">
            <Plus className="h-4 w-4" />
            Create Plan
          </Button>
        </div>

        {/* Stats Row - Hero Style */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-violet-600 to-indigo-600 text-white border-0 shadow-lg shadow-indigo-500/20 rounded-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="pt-6 pb-5 relative z-10">
              <Crown className="h-5 w-5 opacity-80 mb-2" />
              <div className="text-3xl font-bold">{activePlans.length}</div>
              <p className="text-sm opacity-80 mt-0.5">Active Plans</p>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-emerald-600 to-teal-600 text-white border-0 shadow-lg shadow-emerald-500/20 rounded-2xl overflow-hidden relative">
            <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
            <CardContent className="pt-6 pb-5 relative z-10">
              <Users className="h-5 w-5 opacity-80 mb-2" />
              <div className="text-3xl font-bold">{totalMembers}</div>
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
              <div className="text-2xl font-bold text-foreground truncate">{mostPopularPlan?.name || 'N/A'}</div>
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
              <div className="text-2xl font-bold text-foreground">{formatPrice(avgPrice)}</div>
              <p className="text-sm text-muted-foreground mt-0.5">Avg Plan Price</p>
            </CardContent>
          </Card>
        </div>

        {/* Plans Grid */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="rounded-2xl">
                <CardContent className="p-6">
                  <Skeleton className="h-6 w-32 mb-2" />
                  <Skeleton className="h-4 w-48 mb-4" />
                  <Skeleton className="h-10 w-24 mb-4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : plans?.length === 0 ? (
          <Card className="rounded-2xl shadow-lg">
            <CardContent className="py-20 text-center">
              <div className="mx-auto w-20 h-20 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center mb-6">
                <Sparkles className="h-10 w-10 text-primary" />
              </div>
              <h3 className="text-xl font-semibold mb-2">No Plans Yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">Create your first membership plan to start selling memberships</p>
              <Button onClick={() => setAddPlanOpen(true)} className="gap-2 rounded-xl">
                <Plus className="h-4 w-4" />
                Create Your First Plan
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans?.map((plan, index) => {
              const memberCount = memberCounts[plan.id] || 0;
              const isPopular = mostPopularPlan?.id === plan.id && memberCount > 0;
              const gradient = gradients[index % gradients.length];
              
              return (
                <Card 
                  key={plan.id} 
                  className={`group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 rounded-2xl border-border/50 shadow-lg ${!plan.is_active ? 'opacity-50' : ''}`}
                >
                  {/* Top gradient bar */}
                  <div className={`h-1.5 bg-gradient-to-r ${plan.is_active ? gradient : 'from-muted to-muted'}`} />

                  {/* Popular badge */}
                  {isPopular && (
                    <div className="absolute top-4 right-4 z-10">
                      <Badge className="bg-amber-500 text-white border-0 gap-1 shadow-md">
                        <Star className="h-3 w-3 fill-current" />
                        Popular
                      </Badge>
                    </div>
                  )}
                  
                  <CardContent className="p-6 space-y-5">
                    {/* Title & Status */}
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-foreground tracking-tight">
                          {plan.name}
                        </h3>
                        {!plan.is_active && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {plan.description || 'No description'}
                      </p>
                    </div>

                    {/* Price Display */}
                    <div className="py-3 px-4 rounded-xl bg-muted/50 border border-border/30">
                      <div className="flex items-baseline gap-2">
                        {plan.discounted_price ? (
                          <>
                            <span className="text-3xl font-extrabold text-foreground">
                              {formatPrice(plan.discounted_price)}
                            </span>
                            <span className="text-base text-muted-foreground line-through">
                              {formatPrice(plan.price)}
                            </span>
                            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                              {Math.round(((plan.price - plan.discounted_price) / plan.price) * 100)}% OFF
                            </Badge>
                          </>
                        ) : (
                          <span className="text-3xl font-extrabold text-foreground">{formatPrice(plan.price)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {getDurationLabel(plan.duration_days)}
                        </span>
                        {plan.admission_fee && plan.admission_fee > 0 && (
                          <span className="text-xs">+ {formatPrice(plan.admission_fee)} joining</span>
                        )}
                      </div>
                    </div>

                    {/* Member Count */}
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${
                        memberCount > 0 
                          ? 'bg-primary/10 text-primary' 
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        <Users className="h-3.5 w-3.5" />
                        {memberCount} {memberCount === 1 ? 'member' : 'members'}
                      </div>
                    </div>

                    {/* Benefits */}
                    {plan.plan_benefits && plan.plan_benefits.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Included Benefits</p>
                        <div className="space-y-1.5">
                          {plan.plan_benefits.slice(0, 5).map((benefit) => (
                            <div key={benefit.id} className="flex items-center gap-2.5 text-sm">
                              <div className="w-5 h-5 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                                <Check className="h-3 w-3 text-success" />
                              </div>
                              <span className="text-foreground">{benefit.benefit_types?.name || benefit.benefit_type}</span>
                              {benefit.limit_count && benefit.frequency !== 'unlimited' && (
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {benefit.limit_count}/{benefit.frequency === 'daily' ? 'day' : benefit.frequency === 'weekly' ? 'week' : benefit.frequency === 'monthly' ? 'mo' : 'total'}
                                </span>
                              )}
                            </div>
                          ))}
                          {plan.plan_benefits.length > 5 && (
                            <p className="text-xs text-primary font-medium pl-7">
                              +{plan.plan_benefits.length - 5} more benefits
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Feature Badges */}
                    <div className="flex flex-wrap gap-1.5">
                      {plan.max_freeze_days && plan.max_freeze_days > 0 && (
                        <Badge variant="outline" className="text-xs gap-1 rounded-full">
                          <Snowflake className="h-3 w-3" />
                          {plan.max_freeze_days}d freeze
                        </Badge>
                      )}
                      {plan.is_transferable && (
                        <Badge variant="outline" className="text-xs gap-1 rounded-full">
                          <ArrowRightLeft className="h-3 w-3" />
                          Transferable
                        </Badge>
                      )}
                    </div>

                    {/* Edit Button */}
                    <Button 
                      variant="outline" 
                      className="w-full rounded-xl gap-2 border-border/50 hover:bg-muted/50"
                      onClick={() => handleEditPlan(plan)}
                    >
                      <Edit2 className="h-4 w-4" />
                      Edit Plan
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <AddPlanDrawer open={addPlanOpen} onOpenChange={setAddPlanOpen} branchId={defaultBranchId} />
        <EditPlanDrawer 
          open={editPlanOpen} 
          onOpenChange={setEditPlanOpen} 
          plan={selectedPlan}
          branchId={defaultBranchId}
        />
      </div>
    </AppLayout>
  );
}

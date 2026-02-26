import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePlans } from '@/hooks/usePlans';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { StatCard } from '@/components/ui/stat-card';
import { AddPlanDrawer } from '@/components/plans/AddPlanDrawer';
import { EditPlanDrawer } from '@/components/plans/EditPlanDrawer';
import { Plus, Check, Clock, Users, Snowflake, ArrowRightLeft, Edit2, Crown, TrendingUp, Calendar } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { MembershipPlanWithBenefits } from '@/types/membership';
import { useBranches } from '@/hooks/useBranches';
import { useBranchContext } from '@/contexts/BranchContext';

export default function PlansPage() {
  const { effectiveBranchId, branchFilter } = useBranchContext();
  const { data: plans, isLoading } = usePlans(branchFilter, true);
  const defaultBranchId = effectiveBranchId || '';
  const [addPlanOpen, setAddPlanOpen] = useState(false);
  const [editPlanOpen, setEditPlanOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MembershipPlanWithBenefits | null>(null);

  // Fetch member counts per plan
  const { data: memberCounts = {} } = useQuery({
    queryKey: ['plan-member-counts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('memberships')
        .select('plan_id')
        .eq('status', 'active');
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data?.forEach(m => {
        counts[m.plan_id] = (counts[m.plan_id] || 0) + 1;
      });
      return counts;
    },
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(price);
  };

  const getBenefitLabel = (type: string) => {
    const labels: Record<string, string> = {
      gym_access: 'Gym Access',
      pool_access: 'Pool Access',
      steam_sauna: 'Steam & Sauna',
      group_classes: 'Group Classes',
      personal_training: 'Personal Training',
      locker: 'Locker',
      parking: 'Parking',
      towel_service: 'Towel Service',
      nutrition_consult: 'Nutrition Consult',
      body_composition: 'Body Composition',
    };
    return labels[type] || type;
  };

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

  // Stats
  const activePlans = plans?.filter(p => p.is_active) || [];
  const totalMembers = Object.values(memberCounts).reduce((a, b) => a + b, 0);
  const mostPopularPlan = plans?.reduce((max, plan) => 
    (memberCounts[plan.id] || 0) > (memberCounts[max?.id || ''] || 0) ? plan : max
  , plans?.[0]);
  const avgDuration = plans?.length 
    ? Math.round(plans.reduce((sum, p) => sum + p.duration_days, 0) / plans.length) 
    : 0;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Membership Plans</h1>
            <p className="text-muted-foreground">Manage your gym membership plans and benefits</p>
          </div>
          <Button onClick={() => setAddPlanOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Plan
          </Button>
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard
            title="Total Plans"
            value={`${activePlans.length}/${plans?.length || 0}`}
            description="Active / Total"
            icon={Crown}
            variant="default"
          />
          <StatCard
            title="Active Members"
            value={totalMembers}
            icon={Users}
            variant="success"
          />
          <StatCard
            title="Most Popular"
            value={mostPopularPlan?.name || 'N/A'}
            description={mostPopularPlan ? `${memberCounts[mostPopularPlan.id] || 0} members` : ''}
            icon={TrendingUp}
            variant="default"
          />
          <StatCard
            title="Avg Duration"
            value={getDurationLabel(avgDuration)}
            icon={Calendar}
            variant="default"
          />
        </div>

        {/* Plans Grid */}
        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
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
          <Card>
            <CardContent className="py-16 text-center">
              <Crown className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
              <h3 className="text-lg font-medium mb-2">No Plans Yet</h3>
              <p className="text-muted-foreground mb-4">Create your first membership plan to get started</p>
              <Button onClick={() => setAddPlanOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Create Plan
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans?.map((plan) => {
              const memberCount = memberCounts[plan.id] || 0;
              
              return (
                <Card 
                  key={plan.id} 
                  className={`group relative overflow-hidden transition-all hover:shadow-lg ${!plan.is_active ? 'opacity-60' : ''}`}
                >
                  {/* Gradient Header */}
                  <div className={`h-2 ${plan.is_active ? 'bg-gradient-to-r from-primary to-primary/60' : 'bg-muted'}`} />
                  
                  <CardContent className="p-6 space-y-4">
                    {/* Title & Status */}
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-semibold flex items-center gap-2">
                          {plan.name}
                          {!plan.is_active && (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </h3>
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {plan.description || 'No description'}
                        </p>
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleEditPlan(plan)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Price Display */}
                    <div className="py-2">
                      <div className="flex items-baseline gap-2">
                        {plan.discounted_price ? (
                          <>
                            <span className="text-3xl font-bold text-primary">
                              {formatPrice(plan.discounted_price)}
                            </span>
                            <span className="text-lg text-muted-foreground line-through">
                              {formatPrice(plan.price)}
                            </span>
                          </>
                        ) : (
                          <span className="text-3xl font-bold">{formatPrice(plan.price)}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {getDurationLabel(plan.duration_days)}
                        </span>
                        {plan.admission_fee && plan.admission_fee > 0 && (
                          <span>+ {formatPrice(plan.admission_fee)} admission</span>
                        )}
                      </div>
                    </div>

                    {/* Member Count Badge */}
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={memberCount > 0 ? "default" : "secondary"} 
                        className="gap-1"
                      >
                        <Users className="h-3 w-3" />
                        {memberCount} {memberCount === 1 ? 'member' : 'members'}
                      </Badge>
                    </div>

                    {/* Benefits */}
                    {plan.plan_benefits && plan.plan_benefits.length > 0 && (
                      <div className="pt-2 border-t">
                        <p className="text-xs font-medium text-muted-foreground mb-2">BENEFITS</p>
                        <div className="space-y-1.5">
                          {plan.plan_benefits.slice(0, 4).map((benefit) => (
                            <div key={benefit.id} className="flex items-center gap-2 text-sm">
                              <Check className="h-3.5 w-3.5 text-primary" />
                              <span>{benefit.benefit_types?.name || getBenefitLabel(benefit.benefit_type)}</span>
                            </div>
                          ))}
                          {plan.plan_benefits.length > 4 && (
                            <p className="text-xs text-muted-foreground">
                              +{plan.plan_benefits.length - 4} more benefits
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Feature Badges */}
                    <div className="flex flex-wrap gap-1.5 pt-2">
                      {plan.max_freeze_days && plan.max_freeze_days > 0 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Snowflake className="h-3 w-3" />
                          {plan.max_freeze_days}d freeze
                        </Badge>
                      )}
                      {plan.is_transferable && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <ArrowRightLeft className="h-3 w-3" />
                          Transferable
                        </Badge>
                      )}
                    </div>

                    {/* Edit Button */}
                    <Button 
                      variant="outline" 
                      className="w-full mt-2"
                      onClick={() => handleEditPlan(plan)}
                    >
                      <Edit2 className="h-4 w-4 mr-2" />
                      Edit Plan
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Drawers */}
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

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { usePlans } from '@/hooks/usePlans';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Check, Clock, Dumbbell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function PlansPage() {
  const { data: plans, isLoading } = usePlans(undefined, true);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(price);
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

  return (
    <AppLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Membership Plans</h1>
            <p className="text-muted-foreground">Manage your gym membership plans and benefits</p>
          </div>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Add Plan
          </Button>
        </div>

        {isLoading ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardHeader>
                  <Skeleton className="h-6 w-32" />
                  <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="h-8 w-24 mb-4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4 mt-2" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {plans?.map((plan) => (
              <Card key={plan.id} className={!plan.is_active ? 'opacity-60' : ''}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {plan.name}
                        {!plan.is_active && (
                          <Badge variant="secondary">Inactive</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>{plan.description || 'No description'}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-baseline gap-2">
                      {plan.discounted_price ? (
                        <>
                          <span className="text-2xl font-bold text-accent">
                            {formatPrice(plan.discounted_price)}
                          </span>
                          <span className="text-muted-foreground line-through">
                            {formatPrice(plan.price)}
                          </span>
                        </>
                      ) : (
                        <span className="text-2xl font-bold">{formatPrice(plan.price)}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {plan.duration_days} days
                      </span>
                      {plan.admission_fee && plan.admission_fee > 0 && (
                        <span>+ {formatPrice(plan.admission_fee)} admission</span>
                      )}
                    </div>
                  </div>

                  {plan.plan_benefits && plan.plan_benefits.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Benefits</p>
                      <div className="flex flex-wrap gap-1">
                        {plan.plan_benefits.map((benefit) => (
                          <Badge key={benefit.id} variant="outline" className="text-xs">
                            <Check className="h-3 w-3 mr-1" />
                            {getBenefitLabel(benefit.benefit_type)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-2">
                    {plan.max_freeze_days && plan.max_freeze_days > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        Max {plan.max_freeze_days} freeze days
                      </Badge>
                    )}
                    {plan.is_transferable && (
                      <Badge variant="secondary" className="text-xs">Transferable</Badge>
                    )}
                  </div>

                  <Button variant="outline" className="w-full">
                    Edit Plan
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMemberData } from '@/hooks/useMemberData';
import { MeasurementProgressView } from '@/components/members/MeasurementProgressView';
import { TrendingUp, Activity, UtensilsCrossed, AlertCircle, Loader2, Scale, Ruler } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

export default function MyProgress() {
  const { member, measurements, isLoading: memberLoading } = useMemberData();

  // Fetch workout plans
  const { data: workoutPlans = [] } = useQuery({
    queryKey: ['my-workout-plans', member?.id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_fitness_plans')
        .select('*')
        .eq('member_id', member!.id)
        .eq('plan_type', 'workout')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch diet plans
  const { data: dietPlans = [] } = useQuery({
    queryKey: ['my-diet-plans', member?.id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diet_plans')
        .select('*')
        .eq('member_id', member!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  if (memberLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </AppLayout>
    );
  }

  if (!member) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <AlertCircle className="h-12 w-12 text-warning" />
          <h2 className="text-xl font-semibold">No Member Profile Found</h2>
        </div>
      </AppLayout>
    );
  }

  const latestMeasurement = measurements[0];
  const previousMeasurement = measurements[1];

  const getChange = (current: number | null, previous: number | null) => {
    if (!current || !previous) return null;
    return current - previous;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Progress</h1>
          <p className="text-muted-foreground">Track your fitness journey</p>
        </div>

        <Tabs defaultValue="measurements">
          <TabsList>
            <TabsTrigger value="measurements" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Measurements
            </TabsTrigger>
            <TabsTrigger value="workout" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Workout Plan
            </TabsTrigger>
            <TabsTrigger value="diet" className="flex items-center gap-2">
              <UtensilsCrossed className="h-4 w-4" />
              Diet Plan
            </TabsTrigger>
          </TabsList>

          <TabsContent value="measurements" className="space-y-6">
            {/* Current Stats */}
            {latestMeasurement && (
              <div className="grid gap-4 md:grid-cols-4">
                <Card className="border-border/50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Scale className="h-8 w-8 text-accent" />
                      <div>
                        <p className="text-sm text-muted-foreground">Weight</p>
                        <p className="text-2xl font-bold">{latestMeasurement.weight_kg || '-'} kg</p>
                        {previousMeasurement && (
                          <p className={`text-sm ${getChange(latestMeasurement.weight_kg, previousMeasurement.weight_kg)! < 0 ? 'text-success' : 'text-destructive'}`}>
                            {getChange(latestMeasurement.weight_kg, previousMeasurement.weight_kg)?.toFixed(1)} kg
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Ruler className="h-8 w-8 text-accent" />
                      <div>
                        <p className="text-sm text-muted-foreground">Height</p>
                        <p className="text-2xl font-bold">{latestMeasurement.height_cm || '-'} cm</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-8 w-8 text-accent" />
                      <div>
                        <p className="text-sm text-muted-foreground">Body Fat</p>
                        <p className="text-2xl font-bold">{latestMeasurement.body_fat_percentage || '-'}%</p>
                        {previousMeasurement && (
                          <p className={`text-sm ${getChange(latestMeasurement.body_fat_percentage, previousMeasurement.body_fat_percentage)! < 0 ? 'text-success' : 'text-destructive'}`}>
                            {getChange(latestMeasurement.body_fat_percentage, previousMeasurement.body_fat_percentage)?.toFixed(1)}%
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/50">
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <Activity className="h-8 w-8 text-accent" />
                      <div>
                        <p className="text-sm text-muted-foreground">Last Updated</p>
                        <p className="text-lg font-bold">{format(new Date(latestMeasurement.recorded_at), 'dd MMM')}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Progress Chart */}
            <MeasurementProgressView memberId={member.id} />
          </TabsContent>

          <TabsContent value="workout" className="space-y-4">
            {workoutPlans.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No workout plan assigned yet</p>
                  <p className="text-sm text-muted-foreground">Ask your trainer to create a workout plan for you</p>
                </CardContent>
              </Card>
            ) : (
              workoutPlans.map((plan: any) => (
                <Card key={plan.id} className="border-border/50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{plan.plan_name}</CardTitle>
                      {plan.valid_until && (
                        <span className="text-sm text-muted-foreground">
                          Valid until {format(new Date(plan.valid_until), 'dd MMM yyyy')}
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {plan.description && (
                      <p className="text-muted-foreground mb-4">{plan.description}</p>
                    )}
                    {plan.plan_data && (
                      <div className="space-y-4">
                        {Object.entries(plan.plan_data as Record<string, any>).map(([day, exercises]: [string, any]) => (
                          <div key={day} className="p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-semibold capitalize mb-2">{day}</h4>
                            {Array.isArray(exercises) && (
                              <ul className="space-y-1 text-sm">
                                {exercises.map((ex: any, i: number) => (
                                  <li key={i} className="text-muted-foreground">
                                    {typeof ex === 'string' ? ex : `${ex.name} - ${ex.sets}x${ex.reps}`}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="diet" className="space-y-4">
            {dietPlans.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <UtensilsCrossed className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No diet plan assigned yet</p>
                  <p className="text-sm text-muted-foreground">Ask your trainer to create a diet plan for you</p>
                </CardContent>
              </Card>
            ) : (
              dietPlans.map((plan: any) => (
                <Card key={plan.id} className="border-border/50">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{plan.name}</CardTitle>
                      {plan.calories_target && (
                        <span className="text-sm text-accent font-semibold">
                          {plan.calories_target} cal/day
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {plan.description && (
                      <p className="text-muted-foreground mb-4">{plan.description}</p>
                    )}
                    {plan.plan_data && (
                      <div className="space-y-4">
                        {Object.entries(plan.plan_data as Record<string, any>).map(([meal, items]: [string, any]) => (
                          <div key={meal} className="p-4 bg-muted/50 rounded-lg">
                            <h4 className="font-semibold capitalize mb-2">{meal}</h4>
                            {Array.isArray(items) && (
                              <ul className="space-y-1 text-sm text-muted-foreground">
                                {items.map((item: string, i: number) => (
                                  <li key={i}>• {item}</li>
                                ))}
                              </ul>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

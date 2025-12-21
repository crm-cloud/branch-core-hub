import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Dumbbell, Apple, Calendar, CheckCircle2, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

export default function MemberPlansPage() {
  const { user } = useAuth();

  // Get member ID from user
  const { data: member } = useQuery({
    queryKey: ['my-member', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('members')
        .select('id, member_code')
        .eq('user_id', user.id)
        .single();
      if (error) return null;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch fitness plans for the member
  const { data: fitnessPlans = [], isLoading } = useQuery({
    queryKey: ['member-fitness-plans', member?.id],
    queryFn: async () => {
      // Get personal plans
      let query = supabase
        .from('member_fitness_plans')
        .select('*')
        .order('created_at', { ascending: false });

      if (member?.id) {
        query = query.or(`member_id.eq.${member.id},and(is_public.eq.true,member_id.is.null)`);
      } else {
        query = query.eq('is_public', true).is('member_id', null);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
    enabled: true,
  });

  // Fetch diet plans from diet_plans table
  const { data: dietPlans = [] } = useQuery({
    queryKey: ['member-diet-plans', member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      const { data, error } = await supabase
        .from('diet_plans')
        .select('*')
        .eq('member_id', member.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!member?.id,
  });

  // Fetch workout plans from workout_plans table
  const { data: workoutPlans = [] } = useQuery({
    queryKey: ['member-workout-plans', member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      const { data, error } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('member_id', member.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!member?.id,
  });

  const allWorkoutPlans = [
    ...fitnessPlans.filter(p => p.plan_type === 'workout'),
    ...workoutPlans,
  ];

  const allDietPlans = [
    ...fitnessPlans.filter(p => p.plan_type === 'diet'),
    ...dietPlans,
  ];

  const renderPlanCard = (plan: any, type: 'workout' | 'diet') => {
    const planData = plan.plan_data || plan.workout_data || plan.meal_plan || {};
    const isCustom = plan.is_custom || false;
    const isAI = plan.is_ai_generated || false;

    return (
      <Card key={plan.id} className="group hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              {type === 'workout' ? (
                <div className="p-2 rounded-lg bg-primary/10">
                  <Dumbbell className="h-5 w-5 text-primary" />
                </div>
              ) : (
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Apple className="h-5 w-5 text-green-500" />
                </div>
              )}
              <div>
                <CardTitle className="text-base">{plan.plan_name || plan.name}</CardTitle>
                <CardDescription className="text-xs">
                  {plan.description || 'No description'}
                </CardDescription>
              </div>
            </div>
            <div className="flex gap-1">
              {isAI && (
                <Badge variant="secondary" className="gap-1 text-xs">
                  <Sparkles className="h-3 w-3" />
                  AI
                </Badge>
              )}
              {isCustom && <Badge variant="outline" className="text-xs">Custom</Badge>}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Validity dates */}
          {(plan.valid_from || plan.start_date) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {format(new Date(plan.valid_from || plan.start_date), 'MMM d')}
                {(plan.valid_until || plan.end_date) && (
                  <> - {format(new Date(plan.valid_until || plan.end_date), 'MMM d, yyyy')}</>
                )}
              </span>
            </div>
          )}

          {/* Plan content preview */}
          {type === 'workout' && planData && (
            <div className="space-y-2">
              {(planData.days || planData.exercises) && (
                <div className="text-sm">
                  <span className="font-medium">
                    {planData.days?.length || planData.exercises?.length || 0} workout days
                  </span>
                </div>
              )}
            </div>
          )}

          {type === 'diet' && planData && (
            <div className="space-y-2">
              {(plan.calories_target || planData.calories) && (
                <div className="text-sm">
                  <span className="font-medium">
                    Target: {plan.calories_target || planData.calories} calories/day
                  </span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">My Fitness Plans</h1>
            <p className="text-muted-foreground">
              View your personalized workout and diet plans
            </p>
          </div>
        </div>

        <Tabs defaultValue="workout" className="space-y-4">
          <TabsList>
            <TabsTrigger value="workout" className="gap-2">
              <Dumbbell className="h-4 w-4" />
              Workout Plans ({allWorkoutPlans.length})
            </TabsTrigger>
            <TabsTrigger value="diet" className="gap-2">
              <Apple className="h-4 w-4" />
              Diet Plans ({allDietPlans.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workout">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : allWorkoutPlans.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {allWorkoutPlans.map((plan) => renderPlanCard(plan, 'workout'))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Dumbbell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">No Workout Plans</h3>
                  <p className="text-muted-foreground">
                    Your trainer will assign workout plans that will appear here
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="diet">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : allDietPlans.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {allDietPlans.map((plan) => renderPlanCard(plan, 'diet'))}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Apple className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                  <h3 className="text-lg font-medium mb-2">No Diet Plans</h3>
                  <p className="text-muted-foreground">
                    Your trainer will assign diet plans that will appear here
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

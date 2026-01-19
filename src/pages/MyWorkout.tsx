import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMemberData } from '@/hooks/useMemberData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Calendar, Dumbbell, AlertCircle, User, Clock, Target, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

export default function MyWorkout() {
  const { profile } = useAuth();
  const { member, isLoading: memberLoading } = useMemberData();

  // Fetch active workout plan
  const { data: workoutPlan, isLoading: planLoading } = useQuery({
    queryKey: ['my-workout-plan', member?.id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_fitness_plans')
        .select('*')
        .eq('member_id', member!.id)
        .eq('plan_type', 'workout')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('Error fetching workout plan:', error);
        return null;
      }
      
      // Fetch trainer profile separately if created_by exists
      if (data?.created_by) {
        const { data: trainerProfile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', data.created_by)
          .single();
        
        return { ...data, trainer: trainerProfile };
      }
      
      return data;
    },
  });

  // Fetch workout templates if no custom plan
  const { data: workoutTemplates = [] } = useQuery({
    queryKey: ['workout-templates', member?.branch_id],
    enabled: !!member && !workoutPlan,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('workout_templates')
        .select('*')
        .or(`branch_id.eq.${member!.branch_id},is_public.eq.true`)
        .eq('is_active', true)
        .order('name');

      if (error) {
        console.error('Error fetching templates:', error);
        return [];
      }
      return data || [];
    },
  });

  const isLoading = memberLoading || planLoading;

  if (isLoading) {
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
          <p className="text-muted-foreground">Your account is not linked to a member profile.</p>
        </div>
      </AppLayout>
    );
  }

  // Parse workout plan data
  const planData = workoutPlan?.plan_data as {
    days?: Array<{
      day: string;
      exercises: Array<{
        name: string;
        sets: number;
        reps: string;
        notes?: string;
      }>;
    }>;
  } | null;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="h-8 w-8 text-accent" />
              My Workout Plan
            </h1>
            <p className="text-muted-foreground">
              Your personalized workout routine
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/my-requests">Request New Plan</Link>
          </Button>
        </div>

        {workoutPlan ? (
          <>
            {/* Plan Info */}
            <Card className="border-accent/20 bg-accent/5">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Dumbbell className="h-5 w-5" />
                    {workoutPlan.plan_name}
                  </CardTitle>
                  <Badge variant="default">Active</Badge>
                </div>
                {workoutPlan.description && (
                  <CardDescription>{workoutPlan.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Created</p>
                      <p className="font-medium">{format(new Date(workoutPlan.created_at || new Date()), 'dd MMM yyyy')}</p>
                    </div>
                  </div>
                  {workoutPlan.valid_until && (
                    <div className="flex items-center gap-3">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Valid Until</p>
                        <p className="font-medium">{format(new Date(workoutPlan.valid_until), 'dd MMM yyyy')}</p>
                      </div>
                    </div>
                  )}
                  {(workoutPlan as any).trainer && (
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Trainer</p>
                        <p className="font-medium">{(workoutPlan as any).trainer?.full_name || 'Assigned Trainer'}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Workout Days */}
            {planData?.days && planData.days.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {planData.days.map((day, dayIndex) => (
                  <Card key={dayIndex} className="border-border/50">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Target className="h-5 w-5 text-accent" />
                        {day.day}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {day.exercises.map((exercise, exIndex) => (
                          <div key={exIndex} className="flex items-start justify-between p-3 bg-muted/50 rounded-lg">
                            <div className="flex items-start gap-2">
                              <CheckCircle className="h-4 w-4 text-success mt-1 shrink-0" />
                              <div>
                                <p className="font-medium">{exercise.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  {exercise.sets} sets × {exercise.reps}
                                </p>
                                {exercise.notes && (
                                  <p className="text-xs text-muted-foreground mt-1">{exercise.notes}</p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="border-border/50">
                <CardContent className="py-12 text-center">
                  <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Workout plan details are being prepared by your trainer.</p>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <Activity className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">No Active Workout Plan</h3>
              <p className="text-muted-foreground mb-6">
                You don't have a personalized workout plan yet. Request one from your trainer!
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button asChild>
                  <Link to="/my-requests">Request Workout Plan</Link>
                </Button>
                {member.assigned_trainer && (
                  <Button variant="outline" asChild>
                    <Link to="/my-pt-sessions">Book PT Session</Link>
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tips Card */}
        <Card className="border-border/50 bg-muted/30">
          <CardHeader>
            <CardTitle className="text-lg">💡 Workout Tips</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>• Warm up for 5-10 minutes before starting your workout</li>
              <li>• Stay hydrated throughout your session</li>
              <li>• Focus on proper form over heavy weights</li>
              <li>• Rest 60-90 seconds between sets</li>
              <li>• Track your progress in the My Progress section</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

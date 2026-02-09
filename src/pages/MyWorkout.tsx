import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useMemberData } from '@/hooks/useMemberData';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Activity, Calendar, Dumbbell, AlertCircle, User, Clock, Target, CheckCircle, Shuffle, Zap } from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { generateDailyWorkout, DEFAULT_WEEKLY_SPLIT, type ShuffledWorkout } from '@/services/workoutShufflerService';

const FITNESS_GOAL_EQUIPMENT_PRIORITY: Record<string, string[]> = {
  'Weight Loss': ['bodyweight', 'cardio', 'cable'],
  'Muscle Gain': ['barbell', 'dumbbell', 'machine'],
  'Endurance': ['cardio', 'bodyweight'],
  'General Fitness': ['barbell', 'dumbbell', 'machine', 'bodyweight', 'cable', 'cardio'],
  'Flexibility': ['bodyweight'],
  'Body Recomposition': ['barbell', 'dumbbell', 'machine', 'cable'],
};

const EQUIPMENT_COLORS: Record<string, string> = {
  barbell: 'bg-destructive/10 text-destructive',
  dumbbell: 'bg-primary/10 text-primary',
  machine: 'bg-warning/10 text-warning',
  cable: 'bg-info/10 text-info',
  bodyweight: 'bg-success/10 text-success',
  cardio: 'bg-accent/10 text-accent',
};

export default function MyWorkout() {
  const { profile } = useAuth();
  const { member, isLoading: memberLoading } = useMemberData();
  const [activeTab, setActiveTab] = useState('today');
  const [shuffleCount, setShuffleCount] = useState(0);
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set());

  // Get today's target muscle from weekly split
  const dayIndex = (new Date().getDay() + 6) % 7; // Mon=0
  const todaySplit = DEFAULT_WEEKLY_SPLIT[dayIndex];

  // Fetch daily shuffled workout
  const { data: dailyWorkout, isLoading: shuffleLoading, refetch: refetchWorkout } = useQuery({
    queryKey: ['daily-workout', member?.id, todaySplit.targetMuscle, shuffleCount],
    enabled: !!member?.id,
    queryFn: async () => {
      const workout = await generateDailyWorkout(member!.id, todaySplit.targetMuscle, 8);

      // Prioritize exercises based on fitness goal
      const goal = member?.fitness_goals || 'General Fitness';
      const priorityEquipment = FITNESS_GOAL_EQUIPMENT_PRIORITY[goal] || FITNESS_GOAL_EQUIPMENT_PRIORITY['General Fitness'];

      const sorted = [...workout.exercises].sort((a, b) => {
        const aIdx = priorityEquipment.indexOf(a.equipment_type || '');
        const bIdx = priorityEquipment.indexOf(b.equipment_type || '');
        return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
      });

      return { ...workout, exercises: sorted };
    },
  });

  // Fetch active workout plan (trainer-assigned)
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

      if (error) return null;
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

  const isLoading = memberLoading || planLoading;

  const toggleExercise = (id: string) => {
    setCompletedExercises(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleShuffle = () => {
    setShuffleCount(c => c + 1);
    setCompletedExercises(new Set());
  };

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

  const planData = workoutPlan?.plan_data as {
    days?: Array<{
      day: string;
      exercises: Array<{ name: string; sets: number; reps: string; notes?: string }>;
    }>;
  } | null;

  const completedCount = completedExercises.size;
  const totalExercises = dailyWorkout?.exercises.length || 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="h-8 w-8 text-accent" />
              My Workout
            </h1>
            <p className="text-muted-foreground">
              {member.fitness_goals ? `Goal: ${member.fitness_goals}` : 'Your personalized workout routine'}
            </p>
          </div>
          <Button asChild variant="outline">
            <Link to="/my-requests">Request New Plan</Link>
          </Button>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="today" className="gap-2">
              <Zap className="h-4 w-4" />
              Today's Workout
            </TabsTrigger>
            <TabsTrigger value="plan" className="gap-2">
              <Dumbbell className="h-4 w-4" />
              My Plan
            </TabsTrigger>
          </TabsList>

          {/* ===== TODAY'S WORKOUT TAB ===== */}
          <TabsContent value="today" className="space-y-4 mt-4">
            <Card className="border-accent/20 bg-accent/5">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    {todaySplit.day} — {todaySplit.targetMuscle.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  </CardTitle>
                  <Button variant="outline" size="sm" onClick={handleShuffle} disabled={shuffleLoading}>
                    <Shuffle className="h-4 w-4 mr-1" />
                    Shuffle
                  </Button>
                </div>
                <CardDescription>
                  {completedCount}/{totalExercises} exercises completed
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="w-full bg-muted rounded-full h-2">
                  <div
                    className="bg-accent h-2 rounded-full transition-all"
                    style={{ width: totalExercises > 0 ? `${(completedCount / totalExercises) * 100}%` : '0%' }}
                  />
                </div>
              </CardContent>
            </Card>

            {shuffleLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-accent" />
              </div>
            ) : dailyWorkout && dailyWorkout.exercises.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2">
                {dailyWorkout.exercises.map((exercise, idx) => {
                  const done = completedExercises.has(exercise.id);
                  return (
                    <Card
                      key={exercise.id}
                      className={`cursor-pointer transition-all ${done ? 'bg-success/5 border-success/30' : 'hover:border-accent/50'}`}
                      onClick={() => toggleExercise(exercise.id)}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div className={`flex items-center justify-center h-8 w-8 rounded-full shrink-0 text-sm font-bold ${done ? 'bg-success text-success-foreground' : 'bg-muted text-muted-foreground'}`}>
                            {done ? <CheckCircle className="h-5 w-5" /> : idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium ${done ? 'line-through text-muted-foreground' : ''}`}>{exercise.name}</p>
                            <div className="flex flex-wrap gap-1.5 mt-1.5">
                              {exercise.equipment_type && (
                                <Badge variant="outline" className={`text-xs ${EQUIPMENT_COLORS[exercise.equipment_type] || ''}`}>
                                  {exercise.equipment_type}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs">
                                {exercise.difficulty}
                              </Badge>
                            </div>
                            {exercise.instructions && (
                              <p className="text-xs text-muted-foreground mt-2">{exercise.instructions}</p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No exercises found for {todaySplit.targetMuscle}. Ask your admin to seed exercises.</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ===== MY PLAN TAB ===== */}
          <TabsContent value="plan" className="space-y-4 mt-4">
            {workoutPlan ? (
              <>
                <Card className="border-accent/20 bg-accent/5">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="flex items-center gap-2">
                        <Dumbbell className="h-5 w-5" />
                        {workoutPlan.plan_name}
                      </CardTitle>
                      <Badge variant="default">Active</Badge>
                    </div>
                    {workoutPlan.description && <CardDescription>{workoutPlan.description}</CardDescription>}
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
                                    <p className="text-sm text-muted-foreground">{exercise.sets} sets × {exercise.reps}</p>
                                    {exercise.notes && <p className="text-xs text-muted-foreground mt-1">{exercise.notes}</p>}
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
                  <Card><CardContent className="py-12 text-center">
                    <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Workout plan details are being prepared by your trainer.</p>
                  </CardContent></Card>
                )}
              </>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Activity className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">No Active Workout Plan</h3>
                  <p className="text-muted-foreground mb-6">Request a personalized plan from your trainer!</p>
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <Button asChild><Link to="/my-requests">Request Workout Plan</Link></Button>
                    {member.assigned_trainer && (
                      <Button variant="outline" asChild><Link to="/my-pt-sessions">Book PT Session</Link></Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* Tips */}
        <Card className="border-border/50 bg-muted/30">
          <CardHeader><CardTitle className="text-lg">💡 Workout Tips</CardTitle></CardHeader>
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

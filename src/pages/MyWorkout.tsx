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
import {
  Activity,
  Calendar,
  Dumbbell,
  AlertCircle,
  User,
  Clock,
  Target,
  CheckCircle2,
  Shuffle,
  Zap,
  Flame,
  Trophy,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { format } from 'date-fns';
import { Link } from 'react-router-dom';
import { generateDailyWorkout, DEFAULT_WEEKLY_SPLIT } from '@/services/workoutShufflerService';

const FITNESS_GOAL_EQUIPMENT_PRIORITY: Record<string, string[]> = {
  'Weight Loss': ['bodyweight', 'cardio', 'cable'],
  'Muscle Gain': ['barbell', 'dumbbell', 'machine'],
  'Endurance': ['cardio', 'bodyweight'],
  'General Fitness': ['barbell', 'dumbbell', 'machine', 'bodyweight', 'cable', 'cardio'],
  'Flexibility': ['bodyweight'],
  'Body Recomposition': ['barbell', 'dumbbell', 'machine', 'cable'],
};

const EQUIPMENT_STYLES: Record<string, string> = {
  barbell: 'bg-destructive/10 text-destructive border-destructive/20',
  dumbbell: 'bg-primary/10 text-primary border-primary/20',
  machine: 'bg-warning/10 text-warning border-warning/20',
  cable: 'bg-info/10 text-info border-info/20',
  bodyweight: 'bg-success/10 text-success border-success/20',
  cardio: 'bg-accent/10 text-accent border-accent/20',
};

export default function MyWorkout() {
  const { profile } = useAuth();
  const { member, isLoading: memberLoading } = useMemberData();
  const [activeTab, setActiveTab] = useState('today');
  const [shuffleCount, setShuffleCount] = useState(0);
  const [completedExercises, setCompletedExercises] = useState<Set<string>>(new Set());

  const dayIndex = (new Date().getDay() + 6) % 7;
  const todaySplit = DEFAULT_WEEKLY_SPLIT[dayIndex];

  const { data: dailyWorkout, isLoading: shuffleLoading } = useQuery({
    queryKey: ['daily-workout', member?.id, todaySplit.targetMuscle, shuffleCount],
    enabled: !!member?.id,
    queryFn: async () => {
      const workout = await generateDailyWorkout(member!.id, todaySplit.targetMuscle, 8);
      const goal = member?.fitness_goals || 'General Fitness';
      const priorityEquipment =
        FITNESS_GOAL_EQUIPMENT_PRIORITY[goal] || FITNESS_GOAL_EQUIPMENT_PRIORITY['General Fitness'];
      const sorted = [...workout.exercises].sort((a, b) => {
        const aIdx = priorityEquipment.indexOf(a.equipment_type || '');
        const bIdx = priorityEquipment.indexOf(b.equipment_type || '');
        return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
      });
      return { ...workout, exercises: sorted };
    },
  });

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
    setCompletedExercises((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleShuffle = () => {
    setShuffleCount((c) => c + 1);
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
    days?: Array<{ day: string; exercises: Array<{ name: string; sets: number; reps: string; notes?: string }> }>;
  } | null;

  const completedCount = completedExercises.size;
  const totalExercises = dailyWorkout?.exercises.length || 0;
  const progressPct = totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0;
  const muscleLabel = todaySplit.targetMuscle.replace('_', ' ').replace(/\b\w/g, (l) => l.toUpperCase());

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        {/* ===== HERO ===== */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-accent p-6 sm:p-8 text-primary-foreground shadow-lg shadow-primary/20">
          <div className="absolute inset-0 opacity-20 pointer-events-none">
            <div className="absolute -right-12 -top-12 h-48 w-48 rounded-full bg-white/30 blur-3xl" />
            <div className="absolute -left-8 bottom-0 h-32 w-32 rounded-full bg-white/20 blur-2xl" />
          </div>
          <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur px-3 py-1 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5" />
                {member.fitness_goals ? `Goal: ${member.fitness_goals}` : 'Personalised Routine'}
              </div>
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">My Workout</h1>
              <p className="text-sm sm:text-base text-white/85 max-w-lg">
                {todaySplit.day} focus — {muscleLabel}. Stay consistent, track your wins.
              </p>
            </div>
            <Button asChild variant="secondary" size="lg" className="shrink-0 shadow-md">
              <Link to="/my-requests">Request New Plan</Link>
            </Button>
          </div>

          <div className="relative mt-6 grid grid-cols-3 gap-3">
            <HeroStat icon={<Target className="h-4 w-4" />} label="Today" value={muscleLabel} />
            <HeroStat icon={<CheckCircle2 className="h-4 w-4" />} label="Done" value={`${completedCount}/${totalExercises || 0}`} />
            <HeroStat icon={<Trophy className="h-4 w-4" />} label="Progress" value={`${progressPct}%`} />
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="today" className="gap-2 rounded-lg">
              <Zap className="h-4 w-4" />
              Today
            </TabsTrigger>
            <TabsTrigger value="plan" className="gap-2 rounded-lg">
              <Dumbbell className="h-4 w-4" />
              My Plan
            </TabsTrigger>
          </TabsList>

          {/* ===== TODAY ===== */}
          <TabsContent value="today" className="space-y-4 mt-4">
            <Card className="rounded-2xl border-border/60 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-accent/10 text-accent">
                        <Flame className="h-4 w-4" />
                      </div>
                      {muscleLabel}
                    </CardTitle>
                    <CardDescription>
                      {completedCount} of {totalExercises} exercises completed
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleShuffle} disabled={shuffleLoading}>
                    <Shuffle className="h-4 w-4 mr-1.5" />
                    Shuffle
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent to-primary transition-all duration-500"
                    style={{ width: `${progressPct}%` }}
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
                  const equipClass = EQUIPMENT_STYLES[exercise.equipment_type || ''] || 'bg-muted text-foreground';
                  return (
                    <Card
                      key={exercise.id}
                      onClick={() => toggleExercise(exercise.id)}
                      className={`group cursor-pointer rounded-2xl border-border/60 shadow-sm transition-all hover:shadow-md hover:-translate-y-0.5 ${
                        done ? 'bg-success/5 border-success/30' : ''
                      }`}
                    >
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                              done
                                ? 'bg-success text-success-foreground'
                                : 'bg-muted text-muted-foreground group-hover:bg-accent/10 group-hover:text-accent'
                            }`}
                          >
                            {done ? <CheckCircle2 className="h-5 w-5" /> : idx + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold leading-tight ${done ? 'line-through text-muted-foreground' : ''}`}>
                              {exercise.name}
                            </p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {exercise.equipment_type && (
                                <Badge variant="outline" className={`text-xs capitalize ${equipClass}`}>
                                  {exercise.equipment_type}
                                </Badge>
                              )}
                              <Badge variant="outline" className="text-xs capitalize">
                                {exercise.difficulty}
                              </Badge>
                            </div>
                            {exercise.instructions && (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">
                                {exercise.instructions}
                              </p>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card className="rounded-2xl border-dashed">
                <CardContent className="py-12 text-center">
                  <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No exercises found for {muscleLabel}. Try shuffling or contact your trainer.
                  </p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ===== PLAN ===== */}
          <TabsContent value="plan" className="space-y-4 mt-4">
            {workoutPlan ? (
              <>
                <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
                  <div className="bg-gradient-to-r from-accent/10 via-primary/10 to-accent/5 px-5 py-4 border-b border-border/60">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/15 text-accent">
                          <Dumbbell className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-semibold leading-tight">{workoutPlan.plan_name}</h3>
                          {workoutPlan.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{workoutPlan.description}</p>
                          )}
                        </div>
                      </div>
                      <Badge className="bg-success text-success-foreground">Active</Badge>
                    </div>
                  </div>
                  <CardContent className="grid gap-4 p-5 sm:grid-cols-3">
                    <MetaItem
                      icon={<Calendar className="h-4 w-4" />}
                      label="Created"
                      value={format(new Date(workoutPlan.created_at || new Date()), 'dd MMM yyyy')}
                    />
                    <MetaItem
                      icon={<Clock className="h-4 w-4" />}
                      label="Valid Until"
                      value={workoutPlan.valid_until ? format(new Date(workoutPlan.valid_until), 'dd MMM yyyy') : 'Ongoing'}
                    />
                    <MetaItem
                      icon={<User className="h-4 w-4" />}
                      label="Trainer"
                      value={(workoutPlan as any).trainer?.full_name || 'Assigned Trainer'}
                    />
                  </CardContent>
                </Card>

                {planData?.days && planData.days.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {planData.days.map((day, dayIndex) => (
                      <Card key={dayIndex} className="rounded-2xl border-border/60 shadow-sm">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center gap-2">
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent/10 text-accent">
                              <Target className="h-4 w-4" />
                            </div>
                            {day.day}
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {day.exercises.map((exercise, i) => (
                              <div
                                key={i}
                                className="flex items-start gap-2.5 rounded-lg bg-muted/50 p-3 transition-colors hover:bg-muted"
                              >
                                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-sm">{exercise.name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {exercise.sets} sets × {exercise.reps}
                                  </p>
                                  {exercise.notes && (
                                    <p className="text-xs text-muted-foreground mt-1 italic">{exercise.notes}</p>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="rounded-2xl border-dashed">
                    <CardContent className="py-12 text-center">
                      <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">Your trainer is preparing the plan details.</p>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : (
              <Card className="rounded-2xl border-dashed">
                <CardContent className="py-16 text-center">
                  <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10">
                    <Activity className="h-8 w-8 text-accent" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">No Active Workout Plan</h3>
                  <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                    Request a personalised plan from your trainer to take the guesswork out of training.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button asChild size="lg">
                      <Link to="/my-requests">Request Workout Plan</Link>
                    </Button>
                    {member.assigned_trainer && (
                      <Button variant="outline" size="lg" asChild>
                        <Link to="/my-pt-sessions">Book PT Session</Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {/* ===== Tips ===== */}
        <Card className="rounded-2xl border-border/60 bg-gradient-to-br from-muted/40 to-background">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-accent" />
              Workout Tips
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2.5 sm:grid-cols-2 text-sm text-muted-foreground">
              {[
                'Warm up for 5-10 minutes before training',
                'Stay hydrated throughout your session',
                'Focus on proper form over heavy weight',
                'Rest 60-90 seconds between sets',
                'Track progress in My Progress',
                'Sleep 7-9 hours for optimal recovery',
              ].map((tip) => (
                <div key={tip} className="flex gap-2">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span>{tip}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function HeroStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/15 backdrop-blur px-3 py-2.5 ring-1 ring-white/20">
      <div className="flex items-center gap-1.5 text-xs font-medium text-white/80">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-base sm:text-lg font-bold tracking-tight truncate">{value}</div>
    </div>
  );
}

function MetaItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import {
  Dumbbell,
  Apple,
  Calendar,
  Sparkles,
  Download,
  Share2,
  ShoppingCart,
  Replace,
  Flame,
  Target,
  TrendingUp,
  TrendingDown,
  ExternalLink,
  Loader2,
  Info,
} from 'lucide-react';
import { format } from 'date-fns';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { generatePlanPDF } from '@/utils/pdfGenerator';
import { toast } from 'sonner';
import {
  buildProgressSummary,
  fetchWorkoutCompletions,
  fetchMealCompletions,
  fetchMealSwaps,
  recordWorkoutCompletion,
  removeWorkoutCompletion,
  recordMealCompletion,
  removeMealCompletion,
  applySwapsToDiet,
} from '@/services/memberPlanProgressService';
import type { DietPlanContent, MealEntry, WorkoutPlanContent } from '@/types/fitnessPlan';
import { ExerciseVideoPlayer } from '@/components/fitness/member/ExerciseVideoPlayer';
import { MealSwapDialog } from '@/components/fitness/member/MealSwapDialog';
import { ShoppingListDialog } from '@/components/fitness/member/ShoppingListDialog';
import { WhatsAppShareDialog } from '@/components/fitness/member/WhatsAppShareDialog';
import type { WorkoutPlanSource, DietPlanSource } from '@/services/memberPlanProgressService';

interface UnifiedPlan {
  id: string;
  source: 'member_fitness_plans' | 'workout_plans' | 'diet_plans';
  type: 'workout' | 'diet';
  name: string;
  description?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  caloriesTarget?: number | null;
  isAI?: boolean;
  isCustom?: boolean;
  raw: any;
  content: WorkoutPlanContent | DietPlanContent;
}

function normalizeWorkout(p: any, src: UnifiedPlan['source']): UnifiedPlan {
  return {
    id: p.id,
    source: src,
    type: 'workout',
    name: p.plan_name || p.name || 'Workout Plan',
    description: p.description,
    validFrom: p.valid_from || p.start_date,
    validUntil: p.valid_until || p.end_date,
    isAI: p.is_ai_generated,
    isCustom: p.is_custom,
    raw: p,
    content: (p.plan_data || p.workout_data || {}) as WorkoutPlanContent,
  };
}

function normalizeDiet(p: any, src: UnifiedPlan['source']): UnifiedPlan {
  return {
    id: p.id,
    source: src,
    type: 'diet',
    name: p.plan_name || p.name || 'Diet Plan',
    description: p.description,
    validFrom: p.valid_from || p.start_date,
    validUntil: p.valid_until || p.end_date,
    caloriesTarget: p.calories_target ?? null,
    isAI: p.is_ai_generated,
    isCustom: p.is_custom,
    raw: p,
    content: (p.plan_data || p.meal_plan || {}) as DietPlanContent,
  };
}

function flattenWorkoutDays(content: WorkoutPlanContent | undefined) {
  if (!content) return [] as { week: number; day: any }[];
  if (content.weeks?.length) {
    return content.weeks.flatMap((w) => (w.days || []).map((d) => ({ week: w.week || 1, day: d })));
  }
  if (content.days?.length) return content.days.map((d) => ({ week: 1, day: d }));
  return [];
}

export default function MemberPlansPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [shoppingDiet, setShoppingDiet] = useState<{ name: string; content: DietPlanContent } | null>(null);
  const [swapState, setSwapState] = useState<{
    open: boolean;
    plan?: UnifiedPlan;
    mealIndex: number;
    meal?: MealEntry;
  }>({ open: false, mealIndex: 0 });
  const [shareState, setShareState] = useState<{ open: boolean; message: string; title: string }>({
    open: false,
    message: '',
    title: 'Share via WhatsApp',
  });

  // Member identity (members has no full_name/phone — those live on profiles)
  const { data: member } = useQuery({
    queryKey: ['my-member', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data: m } = await supabase
        .from('members')
        .select('id, member_code, dietary_preference, cuisine_preference, branch_id, user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (!m) return null;
      const { data: p } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', user.id)
        .maybeSingle();
      return {
        ...m,
        full_name: p?.full_name ?? null,
        phone: p?.phone ?? null,
      };
    },
    enabled: !!user?.id,
  });

  const { data: fitnessPlans = [] } = useQuery({
    queryKey: ['member-fitness-plans', member?.id],
    queryFn: async () => {
      if (!member?.id) return [];
      const { data, error } = await supabase
        .from('member_fitness_plans')
        .select('*')
        .or(`member_id.eq.${member.id},and(is_public.eq.true,member_id.is.null)`)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!member?.id,
  });

  const { data: dietPlansRaw = [] } = useQuery({
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

  const { data: workoutPlansRaw = [] } = useQuery({
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

  const workoutPlans: UnifiedPlan[] = useMemo(
    () => [
      ...fitnessPlans
        .filter((p: any) => p.plan_type === 'workout')
        .map((p: any) => normalizeWorkout(p, 'member_fitness_plans')),
      ...workoutPlansRaw.map((p: any) => normalizeWorkout(p, 'workout_plans')),
    ],
    [fitnessPlans, workoutPlansRaw],
  );

  const dietPlans: UnifiedPlan[] = useMemo(
    () => [
      ...fitnessPlans
        .filter((p: any) => p.plan_type === 'diet')
        .map((p: any) => normalizeDiet(p, 'member_fitness_plans')),
      ...dietPlansRaw.map((p: any) => normalizeDiet(p, 'diet_plans')),
    ],
    [fitnessPlans, dietPlansRaw],
  );

  // Headline progress: pick first workout + first diet (most recent)
  const primaryWorkout = workoutPlans[0];
  const primaryDiet = dietPlans[0];

  const { data: progress } = useQuery({
    queryKey: [
      'member-plan-progress',
      member?.id,
      primaryWorkout?.id ?? null,
      primaryDiet?.id ?? null,
    ],
    enabled: !!member?.id,
    queryFn: () =>
      buildProgressSummary({
        memberId: member!.id,
        workoutPlanSource: primaryWorkout
          ? (primaryWorkout.source as WorkoutPlanSource)
          : null,
        workoutPlanId: primaryWorkout?.id,
        workoutContent: primaryWorkout?.content as WorkoutPlanContent,
        dietPlanSource: primaryDiet ? (primaryDiet.source as DietPlanSource) : null,
        dietPlanId: primaryDiet?.id,
        dietContent: primaryDiet?.content as DietPlanContent,
      }),
    staleTime: 30 * 1000,
  });

  const handleDownloadPDF = (plan: UnifiedPlan) => {
    try {
      generatePlanPDF({
        name: plan.name,
        description: plan.description || undefined,
        type: plan.type,
        data: plan.content,
        validFrom: plan.validFrom || undefined,
        validUntil: plan.validUntil || undefined,
        caloriesTarget: plan.caloriesTarget || undefined,
      });
      toast.success('Opened print dialog — save as PDF.');
    } catch (e) {
      console.error(e);
      toast.error('Failed to generate PDF');
    }
  };

  const handleShareWhatsApp = (plan: UnifiedPlan) => {
    if (!member?.branch_id) {
      toast.error('Cannot share — branch context missing');
      return;
    }
    const lines: string[] = [
      `*${plan.name}* (${plan.type === 'workout' ? 'Workout' : 'Diet'})`,
      plan.description || '',
    ];
    if (plan.validFrom) {
      lines.push(`Starts: ${format(new Date(plan.validFrom), 'MMM d, yyyy')}`);
    }
    if (plan.type === 'workout') {
      const days = flattenWorkoutDays(plan.content as WorkoutPlanContent);
      lines.push('', `${days.length} workout day${days.length === 1 ? '' : 's'} planned.`);
      days.slice(0, 7).forEach(({ day }) => {
        lines.push(`- ${day.day || day.label || 'Day'}${day.focus ? ` — ${day.focus}` : ''} (${day.exercises?.length || 0} exercises)`);
      });
    } else {
      const meals = (plan.content as DietPlanContent).meals || [];
      lines.push('', `${meals.length} meals/day`);
      if (plan.caloriesTarget) lines.push(`Target: ${plan.caloriesTarget} kcal/day`);
      meals.slice(0, 8).forEach((m) => {
        lines.push(`- ${m.name}${m.calories ? ` — ${Math.round(m.calories)} kcal` : ''}`);
      });
    }
    lines.push('', '— Shared from Your Plans');
    setShareState({
      open: true,
      message: lines.filter(Boolean).join('\n'),
      title: `Share ${plan.type === 'workout' ? 'workout' : 'diet'} plan`,
    });
  };

  const handleOpenShopping = (plan: UnifiedPlan) => {
    setShoppingDiet({ name: plan.name, content: plan.content as DietPlanContent });
    setShoppingOpen(true);
  };

  if (!user) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Please sign in to see your plans.
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Your Plans</h1>
              <p className="text-muted-foreground text-sm">
                Track your assigned workouts and diet, log progress, and prep your shopping list.
              </p>
            </div>
          </div>
          {primaryDiet && (
            <Button variant="outline" size="sm" onClick={() => handleOpenShopping(primaryDiet)}>
              <ShoppingCart className="h-4 w-4 mr-2" />
              Shopping List
            </Button>
          )}
        </div>

        {/* Progress summary */}
        {(primaryWorkout || primaryDiet) && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <ProgressTile
              label="Workout compliance"
              icon={<Dumbbell className="h-4 w-4" />}
              value={progress?.workoutCompliancePct ?? 0}
              caption={`${progress?.completedExercises ?? 0}/${progress?.totalExercises ?? 0} exercises`}
              tone="primary"
            />
            <ProgressTile
              label="Diet compliance (7d)"
              icon={<Apple className="h-4 w-4" />}
              value={progress?.dietCompliancePct ?? 0}
              caption={`${progress?.completedMealsThisWeek ?? 0}/${progress?.totalMealsThisWeek ?? 0} meals logged`}
              tone="green"
            />
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase font-semibold">
                  <Replace className="h-3.5 w-3.5" /> Meal swaps
                </div>
                <div className="text-2xl font-bold mt-2">{progress?.swapCount ?? 0}</div>
                <div className="text-xs text-muted-foreground">All-time swaps on this plan</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase font-semibold">
                  <Target className="h-3.5 w-3.5" /> Weight Δ (60d)
                </div>
                <div className="text-2xl font-bold mt-2 flex items-center gap-2">
                  {progress?.weightDeltaKg == null ? (
                    <span className="text-muted-foreground text-base">—</span>
                  ) : (
                    <>
                      {progress.weightDeltaKg > 0 ? (
                        <TrendingUp className="h-5 w-5 text-amber-500" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-emerald-500" />
                      )}
                      {progress.weightDeltaKg > 0 ? '+' : ''}
                      {progress.weightDeltaKg} kg
                    </>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">Based on your check-ins</div>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="workout" className="space-y-4">
          <TabsList>
            <TabsTrigger value="workout" className="gap-2">
              <Dumbbell className="h-4 w-4" />
              Workouts ({workoutPlans.length})
            </TabsTrigger>
            <TabsTrigger value="diet" className="gap-2">
              <Apple className="h-4 w-4" />
              Diet ({dietPlans.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="workout" className="space-y-4">
            {workoutPlans.length === 0 ? (
              <EmptyState
                icon={<Dumbbell className="h-10 w-10" />}
                title="No workout plans yet"
                description="Your trainer will assign one shortly."
              />
            ) : (
              workoutPlans.map((plan) => (
                <WorkoutPlanCard
                  key={plan.id}
                  plan={plan}
                  planSource={plan.source as WorkoutPlanSource}
                  memberId={member?.id || ''}
                  onPdf={() => handleDownloadPDF(plan)}
                  onShare={() => handleShareWhatsApp(plan)}
                  onProgressChange={() =>
                    qc.invalidateQueries({ queryKey: ['member-plan-progress', member?.id] })
                  }
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="diet" className="space-y-4">
            {dietPlans.length === 0 ? (
              <EmptyState
                icon={<Apple className="h-10 w-10" />}
                title="No diet plans yet"
                description="Your trainer will assign one shortly."
              />
            ) : (
              dietPlans.map((plan) => (
                <DietPlanCard
                  key={plan.id}
                  plan={plan}
                  planSource={plan.source as DietPlanSource}
                  memberId={member?.id || ''}
                  dietaryPref={member?.dietary_preference}
                  cuisinePref={member?.cuisine_preference}
                  onPdf={() => handleDownloadPDF(plan)}
                  onShare={() => handleShareWhatsApp(plan)}
                  onShopping={() => handleOpenShopping(plan)}
                  onSwap={(mealIndex, meal) =>
                    setSwapState({ open: true, plan, mealIndex, meal })
                  }
                  onProgressChange={() =>
                    qc.invalidateQueries({ queryKey: ['member-plan-progress', member?.id] })
                  }
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>

      {swapState.open && swapState.plan && swapState.meal && member?.id && (
        <MealSwapDialog
          open={swapState.open}
          onOpenChange={(o) => setSwapState((s) => ({ ...s, open: o }))}
          memberId={member.id}
          planSource={swapState.plan.source as DietPlanSource}
          planId={swapState.plan.id}
          mealIndex={swapState.mealIndex}
          currentMeal={swapState.meal}
          dietaryType={member?.dietary_preference}
          cuisine={member?.cuisine_preference}
          onSwapComplete={() => {
            qc.invalidateQueries({ queryKey: ['meal-swaps', member.id, swapState.plan!.id] });
            qc.invalidateQueries({ queryKey: ['member-plan-progress', member.id] });
          }}
        />
      )}

      <ShoppingListDialog
        open={shoppingOpen}
        onOpenChange={setShoppingOpen}
        diet={shoppingDiet?.content || null}
        planName={shoppingDiet?.name}
        branchId={member?.branch_id ?? null}
        memberId={member?.id ?? null}
        defaultPhone={member?.phone ?? null}
      />

      <WhatsAppShareDialog
        open={shareState.open}
        onOpenChange={(o) => setShareState((s) => ({ ...s, open: o }))}
        branchId={member?.branch_id ?? null}
        memberId={member?.id ?? null}
        defaultPhone={member?.phone ?? null}
        message={shareState.message}
        title={shareState.title}
      />
    </AppLayout>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────────

function ProgressTile({
  label,
  icon,
  value,
  caption,
  tone,
}: {
  label: string;
  icon: React.ReactNode;
  value: number;
  caption: string;
  tone: 'primary' | 'green';
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase font-semibold">
          {icon} {label}
        </div>
        <div className="text-2xl font-bold mt-2">{value}%</div>
        <Progress value={value} className="h-2 mt-2" />
        <div className="text-xs text-muted-foreground mt-2">{caption}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <div className="mx-auto mb-4 text-muted-foreground/50 flex justify-center">{icon}</div>
        <h3 className="text-lg font-medium mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm">{description}</p>
      </CardContent>
    </Card>
  );
}

function PlanHeader({
  plan,
  onPdf,
  onShare,
  extra,
}: {
  plan: UnifiedPlan;
  onPdf: () => void;
  onShare: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${plan.type === 'workout' ? 'bg-primary/10' : 'bg-emerald-500/10'}`}>
            {plan.type === 'workout' ? (
              <Dumbbell className="h-5 w-5 text-primary" />
            ) : (
              <Apple className="h-5 w-5 text-emerald-500" />
            )}
          </div>
          <div>
            <CardTitle className="text-base">{plan.name}</CardTitle>
            {plan.description && (
              <CardDescription className="text-xs line-clamp-1">{plan.description}</CardDescription>
            )}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {plan.validFrom && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  {format(new Date(plan.validFrom), 'MMM d')}
                  {plan.validUntil && ` → ${format(new Date(plan.validUntil), 'MMM d, yyyy')}`}
                </span>
              )}
              {plan.isAI && (
                <Badge variant="secondary" className="text-[10px] gap-1">
                  <Sparkles className="h-3 w-3" /> AI
                </Badge>
              )}
              {plan.isCustom && (
                <Badge variant="outline" className="text-[10px]">Custom</Badge>
              )}
              {plan.caloriesTarget && (
                <Badge variant="outline" className="text-[10px] gap-1">
                  <Flame className="h-3 w-3" /> {plan.caloriesTarget} kcal/day
                </Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          {extra}
          <Button size="sm" variant="outline" onClick={onPdf}>
            <Download className="h-4 w-4 mr-1" /> PDF
          </Button>
          <Button size="sm" variant="outline" onClick={onShare}>
            <Share2 className="h-4 w-4 mr-1" /> Share
          </Button>
        </div>
      </div>
    </CardHeader>
  );
}

function WorkoutPlanCard({
  plan,
  planSource,
  memberId,
  onPdf,
  onShare,
  onProgressChange,
}: {
  plan: UnifiedPlan;
  planSource: WorkoutPlanSource;
  memberId: string;
  onPdf: () => void;
  onShare: () => void;
  onProgressChange: () => void;
}) {
  const qc = useQueryClient();
  const days = flattenWorkoutDays(plan.content as WorkoutPlanContent);
  const totalExercises = days.reduce((acc, { day }) => acc + (day.exercises?.length || 0), 0);

  const { data: completions = [], isLoading } = useQuery({
    queryKey: ['workout-completions', memberId, planSource, plan.id],
    enabled: !!memberId,
    queryFn: () => fetchWorkoutCompletions(memberId, planSource, plan.id),
  });

  const completionKey = (week: number, dayLabel: string, idx: number) =>
    `${week}|${dayLabel}|${idx}`;

  const completedSet = useMemo(() => {
    const s = new Set<string>();
    completions.forEach((c) => s.add(completionKey(c.week_number, c.day_label, c.exercise_index)));
    return s;
  }, [completions]);

  const completedCount = completedSet.size;
  const pct = totalExercises > 0 ? Math.round((completedCount / totalExercises) * 100) : 0;

  const toggle = async (week: number, day: any, idx: number, ex: any, currentlyDone: boolean) => {
    try {
      if (currentlyDone) {
        await removeWorkoutCompletion({
          member_id: memberId,
          plan_source: planSource,
          plan_id: plan.id,
          week_number: week,
          day_label: day.day || day.label || `Day ${week}`,
          exercise_index: idx,
        });
      } else {
        await recordWorkoutCompletion({
          member_id: memberId,
          plan_source: planSource,
          plan_id: plan.id,
          week_number: week,
          day_label: day.day || day.label || `Day ${week}`,
          exercise_index: idx,
          exercise_name: ex.name,
        });
      }
      qc.invalidateQueries({ queryKey: ['workout-completions', memberId, planSource, plan.id] });
      onProgressChange();
    } catch (e) {
      console.error(e);
      toast.error('Could not update completion');
    }
  };

  return (
    <Card>
      <PlanHeader plan={plan} onPdf={onPdf} onShare={onShare} />
      <CardContent className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>{completedCount} / {totalExercises} exercises completed</span>
            <span className="font-semibold">{pct}%</span>
          </div>
          <Progress value={pct} className="h-2" />
        </div>

        {days.length === 0 ? (
          <p className="text-sm text-muted-foreground">No workout days configured yet.</p>
        ) : (
          <Accordion type="multiple" className="w-full">
            {days.map(({ week, day }, dayIdx) => {
              const dayLabel = day.day || day.label || `Day ${dayIdx + 1}`;
              const dayCompleted = (day.exercises || []).filter((_: any, i: number) =>
                completedSet.has(completionKey(week, dayLabel, i)),
              ).length;
              const dayTotal = day.exercises?.length || 0;
              return (
                <AccordionItem key={`${week}-${dayIdx}`} value={`${week}-${dayIdx}`}>
                  <AccordionTrigger className="text-sm">
                    <div className="flex items-center justify-between w-full pr-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-[10px]">W{week}</Badge>
                        <span className="font-medium">{dayLabel}</span>
                        {day.focus && (
                          <span className="text-xs text-muted-foreground">— {day.focus}</span>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">{dayCompleted}/{dayTotal}</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    {day.warmup && (
                      <p className="text-xs text-muted-foreground italic">Warm-up: {day.warmup}</p>
                    )}
                    {(day.exercises || []).map((ex: any, idx: number) => {
                      const key = completionKey(week, dayLabel, idx);
                      const done = completedSet.has(key);
                      return (
                        <div
                          key={idx}
                          className={`rounded-md border p-3 ${done ? 'bg-emerald-500/5 border-emerald-500/30' : ''}`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0 flex-1">
                              <Checkbox
                                checked={done}
                                onCheckedChange={() => toggle(week, day, idx, ex, done)}
                                className="mt-0.5"
                              />
                              <div className="min-w-0">
                                <p className={`font-medium text-sm ${done ? 'line-through text-muted-foreground' : ''}`}>
                                  {ex.name}
                                </p>
                                <div className="flex flex-wrap gap-1 mt-1">
                                  {ex.sets && (
                                    <Badge variant="outline" className="text-[10px]">
                                      {ex.sets} sets{ex.reps ? ` × ${ex.reps}` : ''}
                                    </Badge>
                                  )}
                                  {(ex.rest || ex.rest_seconds) && (
                                    <Badge variant="outline" className="text-[10px]">
                                      Rest {ex.rest || `${ex.rest_seconds}s`}
                                    </Badge>
                                  )}
                                  {ex.equipment && (
                                    <Badge variant="outline" className="text-[10px]">{ex.equipment}</Badge>
                                  )}
                                </div>
                                {ex.notes && (
                                  <p className="text-xs text-muted-foreground mt-1">{ex.notes}</p>
                                )}
                                {ex.form_tips && (
                                  <ul className="text-xs text-muted-foreground mt-1 list-disc pl-4">
                                    {(Array.isArray(ex.form_tips) ? ex.form_tips : [ex.form_tips]).map(
                                      (t: string, i: number) => (
                                        <li key={i}>{t}</li>
                                      ),
                                    )}
                                  </ul>
                                )}
                              </div>
                            </div>
                          </div>
                          {ex.video_url && (
                            <div className="mt-2">
                              <ExerciseVideoPlayer url={ex.video_url} title={ex.name} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {day.cooldown && (
                      <p className="text-xs text-muted-foreground italic">Cool-down: {day.cooldown}</p>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Loading progress…
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function DietPlanCard({
  plan,
  planSource,
  memberId,
  onPdf,
  onShare,
  onShopping,
  onSwap,
  onProgressChange,
}: {
  plan: UnifiedPlan;
  planSource: DietPlanSource;
  memberId: string;
  dietaryPref?: string | null;
  cuisinePref?: string | null;
  onPdf: () => void;
  onShare: () => void;
  onShopping: () => void;
  onSwap: (mealIndex: number, meal: MealEntry) => void;
  onProgressChange: () => void;
}) {
  const qc = useQueryClient();
  const today = new Date().toISOString().split('T')[0];

  const { data: swaps = [] } = useQuery({
    queryKey: ['meal-swaps', memberId, planSource, plan.id],
    enabled: !!memberId,
    queryFn: () => fetchMealSwaps(memberId, planSource, plan.id),
  });

  const effectiveContent = useMemo(
    () => applySwapsToDiet(plan.content as DietPlanContent, swaps),
    [plan.content, swaps],
  );
  const meals = effectiveContent.meals || [];

  const { data: completions = [] } = useQuery({
    queryKey: ['meal-completions', memberId, planSource, plan.id, today],
    enabled: !!memberId,
    queryFn: () => fetchMealCompletions(memberId, planSource, plan.id, today),
  });

  const completedToday = useMemo(() => {
    const s = new Set<number>();
    completions.filter((c) => c.meal_date === today).forEach((c) => s.add(c.meal_index));
    return s;
  }, [completions, today]);

  const todayPct = meals.length > 0 ? Math.round((completedToday.size / meals.length) * 100) : 0;

  const totals = useMemo(() => {
    return meals.reduce(
      (acc, m) => {
        acc.calories += m.calories || 0;
        acc.protein += m.protein || 0;
        acc.carbs += m.carbs || 0;
        acc.fats += m.fats || 0;
        return acc;
      },
      { calories: 0, protein: 0, carbs: 0, fats: 0 },
    );
  }, [meals]);

  const toggle = async (idx: number, meal: MealEntry, currentlyDone: boolean) => {
    try {
      if (currentlyDone) {
        await removeMealCompletion({
          member_id: memberId,
          plan_source: planSource,
          plan_id: plan.id,
          meal_date: today,
          meal_index: idx,
        });
      } else {
        await recordMealCompletion({
          member_id: memberId,
          plan_source: planSource,
          plan_id: plan.id,
          meal_date: today,
          meal_index: idx,
          meal_name: meal.name,
        });
      }
      qc.invalidateQueries({ queryKey: ['meal-completions', memberId, planSource, plan.id, today] });
      onProgressChange();
    } catch (e) {
      console.error(e);
      toast.error('Could not update meal');
    }
  };

  return (
    <Card>
      <PlanHeader
        plan={plan}
        onPdf={onPdf}
        onShare={onShare}
        extra={
          <Button size="sm" variant="outline" onClick={onShopping}>
            <ShoppingCart className="h-4 w-4 mr-1" /> Shopping
          </Button>
        }
      />
      <CardContent className="space-y-3">
        <div>
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>Today: {completedToday.size} / {meals.length} meals logged</span>
            <span className="font-semibold">{todayPct}%</span>
          </div>
          <Progress value={todayPct} className="h-2" />
        </div>

        <div className="grid grid-cols-4 gap-2 text-center">
          <MacroPill label="Calories" value={`${Math.round(totals.calories)}`} suffix="kcal" />
          <MacroPill label="Protein" value={`${Math.round(totals.protein)}`} suffix="g" />
          <MacroPill label="Carbs" value={`${Math.round(totals.carbs)}`} suffix="g" />
          <MacroPill label="Fats" value={`${Math.round(totals.fats)}`} suffix="g" />
        </div>

        {meals.length === 0 ? (
          <p className="text-sm text-muted-foreground">No meals defined in this plan.</p>
        ) : (
          <div className="space-y-2">
            {meals.map((meal, idx) => {
              const done = completedToday.has(idx);
              const wasSwapped = swaps.some((s) => s.meal_index === idx);
              return (
                <div
                  key={idx}
                  className={`rounded-md border p-3 ${done ? 'bg-emerald-500/5 border-emerald-500/30' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={done}
                      onCheckedChange={() => toggle(idx, meal, done)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="min-w-0">
                          <p className={`font-medium text-sm ${done ? 'line-through text-muted-foreground' : ''}`}>
                            {meal.name}
                            {meal.time && (
                              <span className="ml-2 text-xs text-muted-foreground font-normal">
                                · {meal.time}
                              </span>
                            )}
                            {wasSwapped && (
                              <Badge variant="secondary" className="ml-2 text-[10px]">
                                Swapped
                              </Badge>
                            )}
                          </p>
                          {Array.isArray(meal.items) && meal.items.length > 0 && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {meal.items
                                .map((it) =>
                                  typeof it === 'string'
                                    ? it
                                    : `${it.food || it.name || ''}${it.quantity ? ` (${it.quantity})` : ''}`,
                                )
                                .join(' · ')}
                            </p>
                          )}
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {meal.calories ? (
                              <Badge variant="outline" className="text-[10px]">
                                <Flame className="h-3 w-3 mr-0.5" />
                                {Math.round(meal.calories)} kcal
                              </Badge>
                            ) : null}
                            {meal.protein ? (
                              <Badge variant="outline" className="text-[10px]">P {Math.round(meal.protein)}g</Badge>
                            ) : null}
                            {meal.carbs ? (
                              <Badge variant="outline" className="text-[10px]">C {Math.round(meal.carbs)}g</Badge>
                            ) : null}
                            {meal.fats ? (
                              <Badge variant="outline" className="text-[10px]">F {Math.round(meal.fats)}g</Badge>
                            ) : null}
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {meal.recipe_link && (
                            <Button
                              size="sm"
                              variant="ghost"
                              asChild
                              className="h-8 px-2"
                            >
                              <a href={meal.recipe_link} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3.5 w-3.5 mr-1" /> Recipe
                              </a>
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => onSwap(idx, meal)}
                          >
                            <Replace className="h-3.5 w-3.5 mr-1" /> Swap
                          </Button>
                        </div>
                      </div>
                      {meal.prep_video_url && (
                        <div className="mt-2">
                          <ExerciseVideoPlayer url={meal.prep_video_url} title={`${meal.name} prep`} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {effectiveContent.hydration && (
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" /> Hydration: {effectiveContent.hydration}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function MacroPill({ label, value, suffix }: { label: string; value: string; suffix: string }) {
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <div className="text-[10px] uppercase font-semibold text-muted-foreground">{label}</div>
      <div className="text-sm font-bold">
        {value}
        <span className="text-[10px] font-normal text-muted-foreground ml-0.5">{suffix}</span>
      </div>
    </div>
  );
}

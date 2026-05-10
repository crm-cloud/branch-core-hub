import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getPlanTemplate } from '@/services/fitnessService';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Sparkles, Dumbbell, UtensilsCrossed, User, Users } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { CreateFlowLayout } from '@/components/fitness/create/CreateFlowLayout';
import { MemberSearchPicker, PickedMember } from '@/components/fitness/create/MemberSearchPicker';
import { MemberProfileCard, MemberProfileOverrides } from '@/components/fitness/create/MemberProfileCard';
import { useGenerateFitnessPlan } from '@/hooks/usePTPackages';
import { newDraftId, saveDraft } from '@/lib/planDraft';
import { fetchMealCatalog } from '@/services/mealCatalogService';
import { fetchOperationalEquipmentLite } from '@/services/equipmentService';
import { fetchMemberAssignments } from '@/services/fitnessService';
import { useQuery } from '@tanstack/react-query';
import { useBranchContext } from '@/contexts/BranchContext';
import { Badge } from '@/components/ui/badge';
import { Wrench, History } from 'lucide-react';

export default function CreateAIPage() {
  const navigate = useNavigate();
  const generate = useGenerateFitnessPlan();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template');

  const [type, setType] = useState<'workout' | 'diet'>('workout');
  const [mode, setMode] = useState<'member' | 'audience'>('member');
  const [member, setMember] = useState<PickedMember | null>(null);
  const [profile, setProfile] = useState<MemberProfileOverrides>({});
  const [planName, setPlanName] = useState('');
  const [goal, setGoal] = useState('');
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [caloriesTarget, setCaloriesTarget] = useState('');
  const [proteinTarget, setProteinTarget] = useState('');
  const [carbsTarget, setCarbsTarget] = useState('');
  const [fatTarget, setFatTarget] = useState('');
  const [specialNotes, setSpecialNotes] = useState('');
  const [progressMsg, setProgressMsg] = useState<string | null>(null);

  // Audience fields (only used when mode === 'audience')
  const [audAgeMin, setAudAgeMin] = useState<string>('18');
  const [audAgeMax, setAudAgeMax] = useState<string>('45');
  const [audGender, setAudGender] = useState<'any' | 'male' | 'female'>('any');
  const [audExperience, setAudExperience] = useState<string[]>(['beginner']);
  const [audWeightMin, setAudWeightMin] = useState<string>('');
  const [audWeightMax, setAudWeightMax] = useState<string>('');
  const [audDaysPerWeek, setAudDaysPerWeek] = useState<string>('4');
  const [audDietaryType, setAudDietaryType] = useState<string>('');
  const [audCuisine, setAudCuisine] = useState<string>('');
  const [audEquipmentHint, setAudEquipmentHint] = useState<string>('');

  const { effectiveBranchId } = useBranchContext();

  // Pull catalog meals matching the selected diet/cuisine so we can pass them
  // to the AI as the gym's preferred food list. Cached because the catalog
  // doesn't change often within a session.
  const dietaryPrefForAI = mode === 'audience' ? audDietaryType : profile.dietary_preference;
  const cuisineForAI = mode === 'audience' ? audCuisine : profile.cuisine;

  const { data: catalogMeals = [] } = useQuery({
    queryKey: ['meal-catalog-ai', dietaryPrefForAI, cuisineForAI, effectiveBranchId],
    queryFn: () =>
      fetchMealCatalog({
        dietaryType: dietaryPrefForAI || null,
        cuisine: cuisineForAI || null,
        branchId: effectiveBranchId ?? null,
      }),
    enabled: type === 'diet' && !!dietaryPrefForAI && !!cuisineForAI,
  });

  // Branch operational equipment — drives workout AI to use real machines.
  const { data: branchEquipment = [] } = useQuery({
    queryKey: ['branch-equipment-lite', effectiveBranchId],
    queryFn: () => fetchOperationalEquipmentLite(effectiveBranchId ?? null),
    enabled: type === 'workout' && !!effectiveBranchId,
    staleTime: 5 * 60 * 1000,
  });

  // Last plan summary for this member (so AI can progress, not repeat).
  const { data: lastPlans = [] } = useQuery({
    queryKey: ['member-last-plans', member?.id, type],
    queryFn: async () => {
      if (!member?.id) return [];
      const all = await fetchMemberAssignments(effectiveBranchId ?? null);
      return all.filter((p) => p.member_id === member.id && p.plan_type === type).slice(0, 1);
    },
    enabled: !!member?.id,
  });
  const lastPlan = lastPlans[0];

  function buildPreviousPlanContext(): string | undefined {
    if (!lastPlan) return undefined;
    const parts = [
      `Previous ${lastPlan.plan_type} plan: "${lastPlan.plan_name}"`,
      lastPlan.valid_from && `Started ${lastPlan.valid_from}`,
      lastPlan.valid_until && `Valid until ${lastPlan.valid_until}`,
      lastPlan.description && `Notes: ${lastPlan.description}`,
    ].filter(Boolean);
    return parts.join(' · ');
  }

  useEffect(() => {
    if (!templateId) return;
    let cancelled = false;
    (async () => {
      try {
        const tpl = await getPlanTemplate(templateId);
        if (cancelled) return;
        if (!tpl) { toast.error('Template not found'); return; }
        setType(tpl.type);
        setPlanName(tpl.name);
        if (tpl.goal) setGoal(tpl.goal);
        const content: any = tpl.content || {};
        if (content.dailyCalories) setCaloriesTarget(String(content.dailyCalories));
        const macroNum = (v: any) => parseInt(String(v ?? '').replace(/\D/g, ''), 10);
        if (content.macros?.protein) setProteinTarget(String(macroNum(content.macros.protein) || ''));
        if (content.macros?.carbs) setCarbsTarget(String(macroNum(content.macros.carbs) || ''));
        if (content.macros?.fat) setFatTarget(String(macroNum(content.macros.fat) || ''));
        if (tpl.description) setSpecialNotes(tpl.description);
        setProfile(prev => ({
          ...prev,
          fitness_level: tpl.difficulty || prev.fitness_level,
          fitness_goals: tpl.goal || prev.fitness_goals,
          dietary_preference: content.dietaryType || prev.dietary_preference,
          cuisine: content.cuisine || prev.cuisine,
        }));
        toast.success(`Loaded template: ${tpl.name}`);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to load template');
      }
    })();
    return () => { cancelled = true; };
  }, [templateId]);

  const dietRequirementsMet = type !== 'diet'
    || (mode === 'member' ? (!!profile.dietary_preference && !!profile.cuisine) : (!!audDietaryType && !!audCuisine));

  const audienceRequirementsMet = mode !== 'audience' || (
    !!audAgeMin && !!audAgeMax && !!audGender && audExperience.length > 0
  );

  const ageBandMid = (() => {
    const lo = parseInt(audAgeMin) || 0;
    const hi = parseInt(audAgeMax) || 0;
    if (!lo && !hi) return undefined;
    return Math.round((lo + hi) / 2) || undefined;
  })();

  const handleGenerate = async () => {
    if (!planName.trim()) { toast.error('Please enter a plan name'); return; }
    if (mode === 'member' && !member) { toast.error('Please select a member'); return; }
    if (mode === 'audience' && !audienceRequirementsMet) {
      toast.error('Please complete the audience: age range, gender, experience');
      return;
    }
    if (type === 'diet' && !dietRequirementsMet) {
      toast.error(mode === 'member'
        ? 'Please select dietary type and cuisine in the member profile'
        : 'Please select dietary type and cuisine for the audience');
      return;
    }

    setProgressMsg(mode === 'audience'
      ? 'Generating a Common (no-PT) plan for the audience…'
      : 'Sending member context to the AI…');
    const slow = setTimeout(() => setProgressMsg('Still generating — building a personalized program 🤔'), 12000);

    try {
      const memberInfo = mode === 'member' ? {
          name: planName,
          age: profile.age ? parseInt(profile.age) : undefined,
          gender: profile.gender,
          height: profile.height ? parseFloat(profile.height) : undefined,
          weight: profile.weight ? parseFloat(profile.weight) : undefined,
          fitnessGoals: [goal, profile.fitness_goals].filter(Boolean).join('; ') || undefined,
          healthConditions: profile.health_conditions || undefined,
          experience: profile.fitness_level || 'intermediate',
          preferences: [
            type === 'diet' && profile.dietary_preference && `diet: ${profile.dietary_preference}`,
            type === 'diet' && profile.cuisine && `cuisine: ${profile.cuisine}`,
            type === 'diet' && profile.allergies && `allergies: ${profile.allergies}`,
            profile.equipment && `equipment: ${profile.equipment}`,
            type === 'workout' && profile.workout_activities && profile.workout_activities.length > 0
              && `include activities: ${profile.workout_activities.join(', ')} (structure each session warm-up → main → cool-down)`,
            specialNotes,
          ].filter(Boolean).join('; ') || undefined,
        } : {
          // Synthetic "audience profile" — no real member, just band metadata.
          name: planName,
          age: ageBandMid,
          gender: audGender === 'any' ? undefined : audGender,
          weight: audWeightMin && audWeightMax
            ? Math.round((parseFloat(audWeightMin) + parseFloat(audWeightMax)) / 2)
            : undefined,
          fitnessGoals: goal || undefined,
          experience: audExperience[0] || 'beginner',
          preferences: [
            `Common (no-PT) plan targeting ${audAgeMin}-${audAgeMax}y, gender: ${audGender}, experience: ${audExperience.join('/')}`,
            audDaysPerWeek && type === 'workout' && `${audDaysPerWeek} days/week`,
            audWeightMin && audWeightMax && `weight band ${audWeightMin}-${audWeightMax}kg`,
            type === 'diet' && audDietaryType && `diet: ${audDietaryType}`,
            type === 'diet' && audCuisine && `cuisine: ${audCuisine}`,
            type === 'workout' && audEquipmentHint && `equipment: ${audEquipmentHint}`,
            specialNotes,
          ].filter(Boolean).join('; ') || undefined,
        };

      const plan = await generate.mutateAsync({
        type,
        memberInfo,
        options: {
          durationWeeks,
          caloriesTarget: caloriesTarget ? parseInt(caloriesTarget) : undefined,
          availableMeals: type === 'diet'
            ? catalogMeals.slice(0, 80).map((m) => ({
                id: m.id,
                name: m.name,
                meal_type: m.meal_type,
                calories: m.calories,
                protein: m.protein,
                carbs: m.carbs,
                fats: m.fats,
                default_quantity: m.default_quantity,
              }))
            : undefined,
          availableEquipment: type === 'workout' ? branchEquipment.slice(0, 100) : undefined,
          previousPlanContext: mode === 'member' ? buildPreviousPlanContext() : undefined,
        },
      });

      const matchSummary = (plan as any)?.catalogMatchSummary;
      if (type === 'diet' && matchSummary?.total) {
        const { matched, total } = matchSummary;
        if (matched < total) {
          toast.message(`AI used catalog for ${matched}/${total} meals — review the rest before assigning`);
        }
      }

      clearTimeout(slow);
      setProgressMsg(null);

      const id = newDraftId();
      saveDraft({
        id,
        source: 'ai',
        templateId: templateId || undefined,
        type,
        name: plan.name || planName,
        description: plan.description,
        goal: plan.goal || goal,
        difficulty: plan.difficulty || (mode === 'member' ? profile.fitness_level : audExperience[0]),
        caloriesTarget: caloriesTarget ? parseInt(caloriesTarget) : plan.dailyCalories,
        memberId: mode === 'member' ? member!.id : undefined,
        memberName: mode === 'member' ? member!.full_name : undefined,
        memberCode: mode === 'member' ? member!.member_code : undefined,
        memberProfile: mode === 'member' ? profile : undefined,
        dietaryType: mode === 'member' ? profile.dietary_preference : audDietaryType,
        cuisine: mode === 'member' ? profile.cuisine : audCuisine,
        isCommon: mode === 'audience',
        audience: mode === 'audience' ? {
          target_age_min: parseInt(audAgeMin) || null,
          target_age_max: parseInt(audAgeMax) || null,
          target_gender: audGender,
          target_experience: audExperience,
          target_weight_min_kg: audWeightMin ? parseFloat(audWeightMin) : null,
          target_weight_max_kg: audWeightMax ? parseFloat(audWeightMax) : null,
          target_goal: goal || null,
          duration_weeks: durationWeeks,
          days_per_week: audDaysPerWeek ? parseInt(audDaysPerWeek) : null,
        } : undefined,
        content: plan,
        createdAt: new Date().toISOString(),
      });

      toast.success('Plan generated!');
      navigate(`/fitness/preview/${id}`);
    } catch (err: any) {
      clearTimeout(slow);
      setProgressMsg(null);
      toast.error(err.message || 'Failed to generate plan');
    }
  };

  return (
    <CreateFlowLayout
      title="AI Plan Generation"
      subtitle={mode === 'audience' ? 'Generate a Common (no-PT) plan for an audience segment' : 'Personalized programs powered by member metrics'}
      step="build"
      buildLabel="Generate"
      backTo="/fitness/create"
    >
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Plan Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={type} onValueChange={(v) => setType(v as any)}>
                <TabsList className="grid grid-cols-2 w-full sm:w-fit">
                  <TabsTrigger value="workout" className="gap-1.5">
                    <Dumbbell className="h-4 w-4" /> Workout
                  </TabsTrigger>
                  <TabsTrigger value="diet" className="gap-1.5">
                    <UtensilsCrossed className="h-4 w-4" /> Diet
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <MemberSearchPicker value={member} onChange={(m) => { setMember(m); setProfile({}); }} required />

              <div className="space-y-2">
                <Label>Plan Name *</Label>
                <Input
                  placeholder={type === 'workout' ? 'e.g. 4-week strength block' : 'e.g. Cutting diet — phase 1'}
                  value={planName}
                  onChange={(e) => setPlanName(e.target.value)}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Primary Goal</Label>
                  <Select value={goal} onValueChange={setGoal}>
                    <SelectTrigger><SelectValue placeholder="Select a goal" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Weight Loss">Weight Loss</SelectItem>
                      <SelectItem value="Muscle Gain">Muscle Gain</SelectItem>
                      <SelectItem value="General Fitness">General Fitness</SelectItem>
                      <SelectItem value="Endurance">Endurance</SelectItem>
                      <SelectItem value="Flexibility">Flexibility</SelectItem>
                      <SelectItem value="Recomposition">Recomposition</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {type === 'workout' ? (
                  <div className="space-y-2">
                    <Label>Duration (weeks)</Label>
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      value={durationWeeks}
                      onChange={(e) => setDurationWeeks(parseInt(e.target.value) || 4)}
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label>Daily Calorie Target</Label>
                    <Input
                      type="number"
                      placeholder="e.g. 2000"
                      value={caloriesTarget}
                      onChange={(e) => setCaloriesTarget(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {type === 'diet' && (
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label>Protein (g)</Label>
                    <Input type="number" value={proteinTarget} onChange={(e) => setProteinTarget(e.target.value)} placeholder="e.g. 150" />
                  </div>
                  <div className="space-y-2">
                    <Label>Carbs (g)</Label>
                    <Input type="number" value={carbsTarget} onChange={(e) => setCarbsTarget(e.target.value)} placeholder="e.g. 200" />
                  </div>
                  <div className="space-y-2">
                    <Label>Fats (g)</Label>
                    <Input type="number" value={fatTarget} onChange={(e) => setFatTarget(e.target.value)} placeholder="e.g. 65" />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label>Special Notes</Label>
                <Textarea
                  rows={3}
                  placeholder="Anything else the AI should know — schedule, time available, equipment, recent injuries…"
                  value={specialNotes}
                  onChange={(e) => setSpecialNotes(e.target.value)}
                />
              </div>

              <Button
                onClick={handleGenerate}
                disabled={!member || generate.isPending || !dietRequirementsMet}
                className="w-full"
                size="lg"
              >
                {generate.isPending ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating…</>
                ) : (
                  <><Sparkles className="mr-2 h-4 w-4" /> Generate Plan</>
                )}
              </Button>

              {progressMsg && (
                <div className="rounded-lg border bg-muted/50 p-3 text-sm text-muted-foreground">
                  {progressMsg}
                </div>
              )}

              {type === 'diet' && !dietRequirementsMet && member && (
                <p className="text-xs text-warning">
                  Diet plans require both <strong>dietary preference</strong> and <strong>cuisine</strong>. Set them
                  via "Edit profile data for this plan" on the right.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {member ? (
            <>
              <MemberProfileCard memberId={member.id} value={profile} onChange={setProfile} planType={type} />

              {type === 'workout' && (
                <Card>
                  <CardContent className="py-3 px-4 flex items-start gap-2.5">
                    <Wrench className="h-4 w-4 mt-0.5 text-primary" />
                    <div className="flex-1 text-xs">
                      <div className="font-medium text-foreground">
                        Branch equipment ({branchEquipment.length} machines)
                      </div>
                      <p className="text-muted-foreground mt-0.5">
                        AI will prefer these machines when prescribing exercises.
                      </p>
                      {branchEquipment.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {branchEquipment.slice(0, 8).map((e) => (
                            <Badge key={e.name} variant="secondary" className="text-[10px]">
                              {e.name}
                            </Badge>
                          ))}
                          {branchEquipment.length > 8 && (
                            <Badge variant="outline" className="text-[10px]">
                              +{branchEquipment.length - 8} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {lastPlan && (
                <Card>
                  <CardContent className="py-3 px-4 flex items-start gap-2.5">
                    <History className="h-4 w-4 mt-0.5 text-primary" />
                    <div className="flex-1 text-xs">
                      <div className="font-medium text-foreground">Previous plan</div>
                      <p className="text-muted-foreground mt-0.5 truncate">
                        {lastPlan.plan_name} · {lastPlan.valid_from || '—'} → {lastPlan.valid_until || '—'}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        AI will use this as context to progress (not repeat) the program.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card className="border-dashed">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Select a member to load their profile and metrics here.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </CreateFlowLayout>
  );
}

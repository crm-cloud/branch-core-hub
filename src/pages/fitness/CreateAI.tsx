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
import { Loader2, Sparkles, Dumbbell, UtensilsCrossed } from 'lucide-react';
import { toast } from 'sonner';
import { CreateFlowLayout } from '@/components/fitness/create/CreateFlowLayout';
import { MemberSearchPicker, PickedMember } from '@/components/fitness/create/MemberSearchPicker';
import { MemberProfileCard, MemberProfileOverrides } from '@/components/fitness/create/MemberProfileCard';
import { useGenerateFitnessPlan } from '@/hooks/usePTPackages';
import { newDraftId, saveDraft } from '@/lib/planDraft';
import { fetchMealCatalog } from '@/services/mealCatalogService';
import { useQuery } from '@tanstack/react-query';
import { useBranchContext } from '@/contexts/BranchContext';

export default function CreateAIPage() {
  const navigate = useNavigate();
  const generate = useGenerateFitnessPlan();
  const [searchParams] = useSearchParams();
  const templateId = searchParams.get('template');

  const [type, setType] = useState<'workout' | 'diet'>('workout');
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
  const { effectiveBranchId } = useBranchContext();

  // Pull catalog meals matching the selected diet/cuisine so we can pass them
  // to the AI as the gym's preferred food list. Cached because the catalog
  // doesn't change often within a session.
  const { data: catalogMeals = [] } = useQuery({
    queryKey: ['meal-catalog-ai', profile.dietary_preference, profile.cuisine, effectiveBranchId],
    queryFn: () =>
      fetchMealCatalog({
        dietaryType: profile.dietary_preference || null,
        cuisine: profile.cuisine || null,
        branchId: effectiveBranchId ?? null,
      }),
    enabled: type === 'diet' && !!profile.dietary_preference && !!profile.cuisine,
  });

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

  const dietRequirementsMet = type !== 'diet' || (!!profile.dietary_preference && !!profile.cuisine);

  const handleGenerate = async () => {
    if (!member) { toast.error('Please select a member'); return; }
    if (!planName.trim()) { toast.error('Please enter a plan name'); return; }
    if (type === 'diet' && !dietRequirementsMet) {
      toast.error('Please select dietary type and cuisine in the member profile');
      return;
    }

    setProgressMsg('Sending member context to the AI…');
    const slow = setTimeout(() => setProgressMsg('Still generating — building a personalized program 🤔'), 12000);

    try {
      const plan = await generate.mutateAsync({
        type,
        memberInfo: {
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
        },
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
        difficulty: plan.difficulty || profile.fitness_level,
        caloriesTarget: caloriesTarget ? parseInt(caloriesTarget) : plan.dailyCalories,
        memberId: member.id,
        memberName: member.full_name,
        memberCode: member.member_code,
        memberProfile: profile,
        dietaryType: profile.dietary_preference,
        cuisine: profile.cuisine,
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
      subtitle="Personalized programs powered by member metrics"
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
            <MemberProfileCard memberId={member.id} value={profile} onChange={setProfile} />
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

import { useState, useEffect } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Sparkles, Dumbbell, Utensils, Loader2, Copy, Save, UserPlus, Library, Trash2, Shuffle, Zap, Target, ChevronRight, Download, Edit, Users } from "lucide-react";
import { generatePlanPDF } from "@/utils/pdfGenerator";
import { format } from "date-fns";
import { useGenerateFitnessPlan } from "@/hooks/usePTPackages";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { fetchPlanTemplates, createPlanTemplate, FitnessPlanTemplate } from "@/services/fitnessService";
import { AssignPlanDrawer } from "@/components/fitness/AssignPlanDrawer";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// Default starter templates shown when no templates exist
const DEFAULT_TEMPLATES = [
  {
    id: 'default-beginner',
    name: 'Beginner Full Body',
    type: 'workout' as const,
    description: '3-day full body program for absolute beginners',
    difficulty: 'beginner',
    goal: 'General Fitness',
    isDefault: true,
    content: {
      name: 'Beginner Full Body',
      type: 'workout',
      difficulty: 'beginner',
      goal: 'General Fitness',
      description: '3-day full body program for absolute beginners',
      weeks: [{
        week: 1,
        days: [
          { day: 'Monday', focus: 'Full Body A', exercises: [
            { name: 'Bodyweight Squats', sets: 3, reps: '12', rest: '60s' },
            { name: 'Push-ups (or Knee Push-ups)', sets: 3, reps: '10', rest: '60s' },
            { name: 'Dumbbell Rows', sets: 3, reps: '10', rest: '60s' },
            { name: 'Plank Hold', sets: 3, reps: '30s', rest: '45s' },
          ]},
          { day: 'Wednesday', focus: 'Full Body B', exercises: [
            { name: 'Lunges', sets: 3, reps: '10/leg', rest: '60s' },
            { name: 'Dumbbell Press', sets: 3, reps: '10', rest: '60s' },
            { name: 'Lat Pulldown', sets: 3, reps: '12', rest: '60s' },
            { name: 'Russian Twists', sets: 3, reps: '20', rest: '45s' },
          ]},
          { day: 'Friday', focus: 'Full Body C', exercises: [
            { name: 'Goblet Squats', sets: 3, reps: '12', rest: '60s' },
            { name: 'Incline Push-ups', sets: 3, reps: '12', rest: '60s' },
            { name: 'Seated Cable Row', sets: 3, reps: '12', rest: '60s' },
            { name: 'Dead Bug', sets: 3, reps: '10/side', rest: '45s' },
          ]},
        ],
      }],
    },
  },
  {
    id: 'default-weightloss',
    name: 'Weight Loss Circuit',
    type: 'workout' as const,
    description: 'High-intensity circuit training for maximum calorie burn',
    difficulty: 'intermediate',
    goal: 'Weight Loss',
    isDefault: true,
    content: {
      name: 'Weight Loss Circuit',
      type: 'workout',
      difficulty: 'intermediate',
      goal: 'Weight Loss',
      description: 'High-intensity circuit training for maximum calorie burn',
      weeks: [{
        week: 1,
        days: [
          { day: 'Monday', focus: 'HIIT Circuit', exercises: [
            { name: 'Burpees', sets: 4, reps: '10', rest: '30s' },
            { name: 'Mountain Climbers', sets: 4, reps: '20', rest: '30s' },
            { name: 'Jump Squats', sets: 4, reps: '15', rest: '30s' },
            { name: 'Kettlebell Swings', sets: 4, reps: '15', rest: '30s' },
            { name: 'Battle Ropes', sets: 4, reps: '30s', rest: '30s' },
          ]},
          { day: 'Wednesday', focus: 'Cardio + Core', exercises: [
            { name: 'Treadmill Intervals', sets: 1, reps: '20 min', rest: '-' },
            { name: 'Bicycle Crunches', sets: 3, reps: '20', rest: '30s' },
            { name: 'Leg Raises', sets: 3, reps: '15', rest: '30s' },
            { name: 'Box Jumps', sets: 4, reps: '10', rest: '45s' },
          ]},
          { day: 'Friday', focus: 'Full Body Burn', exercises: [
            { name: 'Deadlifts', sets: 4, reps: '10', rest: '45s' },
            { name: 'Push Press', sets: 4, reps: '10', rest: '45s' },
            { name: 'Rowing Machine', sets: 1, reps: '500m', rest: '-' },
            { name: 'Plank Jacks', sets: 3, reps: '20', rest: '30s' },
          ]},
        ],
      }],
    },
  },
  {
    id: 'default-muscle',
    name: 'Muscle Building Split',
    type: 'workout' as const,
    description: 'Push/Pull/Legs split for hypertrophy',
    difficulty: 'intermediate',
    goal: 'Muscle Gain',
    isDefault: true,
    content: {
      name: 'Muscle Building Split',
      type: 'workout',
      difficulty: 'intermediate',
      goal: 'Muscle Gain',
      description: 'Push/Pull/Legs split for hypertrophy',
      weeks: [{
        week: 1,
        days: [
          { day: 'Monday', focus: 'Push (Chest/Shoulders/Triceps)', exercises: [
            { name: 'Bench Press', sets: 4, reps: '8-10', rest: '90s' },
            { name: 'Overhead Press', sets: 3, reps: '10', rest: '90s' },
            { name: 'Incline Dumbbell Press', sets: 3, reps: '12', rest: '60s' },
            { name: 'Lateral Raises', sets: 3, reps: '15', rest: '45s' },
            { name: 'Tricep Pushdowns', sets: 3, reps: '12', rest: '45s' },
          ]},
          { day: 'Wednesday', focus: 'Pull (Back/Biceps)', exercises: [
            { name: 'Barbell Rows', sets: 4, reps: '8-10', rest: '90s' },
            { name: 'Pull-ups', sets: 3, reps: '8', rest: '90s' },
            { name: 'Face Pulls', sets: 3, reps: '15', rest: '45s' },
            { name: 'Barbell Curls', sets: 3, reps: '12', rest: '45s' },
            { name: 'Hammer Curls', sets: 3, reps: '12', rest: '45s' },
          ]},
          { day: 'Friday', focus: 'Legs', exercises: [
            { name: 'Barbell Squats', sets: 4, reps: '8-10', rest: '120s' },
            { name: 'Romanian Deadlifts', sets: 3, reps: '10', rest: '90s' },
            { name: 'Leg Press', sets: 3, reps: '12', rest: '90s' },
            { name: 'Leg Curls', sets: 3, reps: '12', rest: '60s' },
            { name: 'Calf Raises', sets: 4, reps: '15', rest: '45s' },
          ]},
        ],
      }],
    },
  },
];

// Seeded random shuffle for daily workout
function seededShuffle<T>(array: T[], seed: string): T[] {
  const arr = [...array];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0;
  }
  for (let i = arr.length - 1; i > 0; i--) {
    hash = ((hash << 5) - hash) + i;
    hash |= 0;
    const j = Math.abs(hash) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export default function AIFitnessPage() {
  const { profile, hasAnyRole } = useAuth();
  const canUseAi = hasAnyRole(['owner', 'admin', 'manager']);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"generate" | "templates" | "assign" | "member-plans">(
    canUseAi ? "generate" : "templates"
  );
  // Defensive guard: if a non-AI role somehow lands on the generate tab, redirect to templates.
  useEffect(() => {
    if (!canUseAi && activeTab === "generate") {
      setActiveTab("templates");
    }
  }, [canUseAi, activeTab]);
  const [editingTemplate, setEditingTemplate] = useState<FitnessPlanTemplate | null>(null);
  const [planType, setPlanType] = useState<"workout" | "diet">("workout");
  const [memberInfo, setMemberInfo] = useState({
    name: "", age: "", gender: "", height: "", weight: "",
    fitnessGoals: "", healthConditions: "", experience: "beginner", preferences: "",
  });
  const [planMode, setPlanMode] = useState<'global' | 'personalized'>('global');
  const [durationWeeks, setDurationWeeks] = useState(4);
  const [caloriesTarget, setCaloriesTarget] = useState("");
  const [generatedPlan, setGeneratedPlan] = useState<any>(null);
  const [assignDrawerOpen, setAssignDrawerOpen] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<FitnessPlanTemplate | null>(null);
  const [shuffledWorkout, setShuffledWorkout] = useState<any>(null);
  const [personalizedMember, setPersonalizedMember] = useState<any>(null);
  const [memberSearchTerm, setMemberSearchTerm] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);

  // Search members for personalized mode
  const { data: memberResults = [] } = useQuery({
    queryKey: ['ai-member-search', memberSearchTerm],
    enabled: planMode === 'personalized' && memberSearchTerm.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_members', {
        search_term: memberSearchTerm,
        p_branch_id: null,
        p_limit: 8,
      });
      if (error) throw error;
      return (data || []).filter((m: any) => m.member_status === 'active');
    },
  });

  // Auto-fill biometrics when a member is selected in personalized mode
  const handleSelectPersonalizedMember = async (member: any) => {
    setPersonalizedMember(member);
    setMemberSearchTerm('');

    // Fetch gender from profile
    const { data: memberRow } = await supabase.from('members').select('user_id').eq('id', member.id).single();
    if (memberRow?.user_id) {
      const { data: profile } = await supabase.from('profiles').select('gender').eq('id', memberRow.user_id).single();
      if (profile?.gender) {
        setMemberInfo(prev => ({ ...prev, gender: profile.gender!.toLowerCase() }));
      }
    }

    // Fetch latest measurements
    const { data: measurements } = await supabase
      .from('member_measurements')
      .select('weight_kg, height_cm, body_fat_percentage')
      .eq('member_id', member.id)
      .order('recorded_at', { ascending: false })
      .limit(1);

    if (measurements && measurements.length > 0) {
      const m = measurements[0];
      setMemberInfo(prev => ({
        ...prev,
        name: member.full_name + ' Plan',
        weight: m.weight_kg ? String(m.weight_kg) : prev.weight,
        height: m.height_cm ? String(m.height_cm) : prev.height,
      }));
      toast.success('Auto-filled biometrics from member profile');
    } else {
      setMemberInfo(prev => ({ ...prev, name: member.full_name + ' Plan' }));
    }
  };

  const generatePlan = useGenerateFitnessPlan();

  const { data: templates = [], isLoading: templatesLoading } = useQuery({
    queryKey: ['fitness-templates', planType],
    queryFn: () => fetchPlanTemplates(undefined, planType),
  });

  const saveTemplateMutation = useMutation({
    mutationFn: createPlanTemplate,
    onSuccess: () => {
      toast.success("Template saved successfully!");
      queryClient.invalidateQueries({ queryKey: ['fitness-templates'] });
    },
    onError: (error: Error) => toast.error(error.message || "Failed to save template"),
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (templateId: string) => {
      const { error } = await supabase.from('fitness_plan_templates').update({ is_active: false }).eq('id', templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template deleted");
      queryClient.invalidateQueries({ queryKey: ['fitness-templates'] });
    },
  });

  const handleGenerate = async () => {
    if (!memberInfo.name) { toast.error("Please enter a plan name"); return; }
    setIsGenerating(true);
    setGenerateError(null);
    const timeoutTimer = setTimeout(() => {
      setGenerateError('still_loading');
    }, 15000);
    try {
      const plan = await generatePlan.mutateAsync({
        type: planType,
        memberInfo: {
          name: memberInfo.name,
          age: memberInfo.age ? parseInt(memberInfo.age) : undefined,
          gender: memberInfo.gender || undefined,
          height: memberInfo.height ? parseFloat(memberInfo.height) : undefined,
          weight: memberInfo.weight ? parseFloat(memberInfo.weight) : undefined,
          fitnessGoals: memberInfo.fitnessGoals || undefined,
          healthConditions: memberInfo.healthConditions || undefined,
          experience: memberInfo.experience || undefined,
          preferences: memberInfo.preferences || undefined,
        },
        options: { durationWeeks, caloriesTarget: caloriesTarget ? parseInt(caloriesTarget) : undefined },
      });
      clearTimeout(timeoutTimer);
      setGeneratedPlan(plan);
      saveTemplateMutation.mutate({
        name: plan.name || memberInfo.name,
        type: planType,
        description: plan.description,
        difficulty: plan.difficulty || 'intermediate',
        goal: plan.goal,
        content: plan,
        is_public: true,
      });
      toast.success("Plan generated & saved as template!");
    } catch (error: any) {
      clearTimeout(timeoutTimer);
      const msg = error.message || "Failed to generate plan";
      setGenerateError(msg.includes('Unauthorized') || msg.includes('401') ? 'Your session may have expired. Please log out and log back in, then try again.' : msg);
      toast.error(msg.includes('401') ? 'Session expired — please re-login' : msg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleQuickShuffle = () => {
    const seed = `${profile?.id || 'guest'}-${new Date().toISOString().split('T')[0]}`;
    const allExercises = DEFAULT_TEMPLATES.flatMap(t =>
      t.content.weeks.flatMap((w: any) => w.days.flatMap((d: any) => d.exercises))
    );
    const shuffled = seededShuffle(allExercises, seed).slice(0, 8);
    setShuffledWorkout({
      name: `Daily Workout — ${new Date().toLocaleDateString()}`,
      exercises: shuffled,
    });
    toast.success("Daily workout shuffled!");
  };

  const handleSaveTemplate = () => {
    if (!generatedPlan) return;
    saveTemplateMutation.mutate({
      name: generatedPlan.name || `${planType} Plan - ${new Date().toLocaleDateString()}`,
      type: planType,
      description: generatedPlan.description,
      difficulty: generatedPlan.difficulty || 'intermediate',
      goal: generatedPlan.goal,
      content: generatedPlan,
      is_public: true,
    });
  };

  const handleAssignGeneratedPlan = () => {
    if (!generatedPlan) return;
    setSelectedTemplate(null);
    setAssignDrawerOpen(true);
  };

  const handleAssignTemplate = (template: any) => {
    setSelectedTemplate(template);
    setAssignDrawerOpen(true);
  };

  const getDifficultyColor = (difficulty: string | null) => {
    switch (difficulty) {
      case 'beginner': return 'bg-success/20 text-success border-success/20';
      case 'intermediate': return 'bg-warning/20 text-warning border-warning/20';
      case 'advanced': return 'bg-destructive/20 text-destructive border-destructive/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const allTemplates = [...templates, ...DEFAULT_TEMPLATES.filter(dt => dt.type === planType && !templates.some((t: any) => t.name === dt.name))];

  // Member plans query
  const { data: memberPlans = [], isLoading: memberPlansLoading } = useQuery({
    queryKey: ['member-fitness-plans'],
    enabled: activeTab === 'member-plans',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('diet_plans')
        .select('id, name, description, plan_type, start_date, end_date, is_active, member_id, members:member_id(member_code, user_id, profiles:user_id(full_name, avatar_url))')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const handleEditTemplate = (template: FitnessPlanTemplate) => {
    if (!canUseAi) {
      toast.error('Editing templates requires AI access. Please contact your manager.');
      return;
    }
    const content = template.content;
    setMemberInfo({
      name: template.name,
      age: '',
      gender: '',
      height: '',
      weight: '',
      fitnessGoals: template.goal || '',
      healthConditions: '',
      experience: template.difficulty || 'intermediate',
      preferences: '',
    });
    setPlanType(template.type as 'workout' | 'diet');
    setPlanMode('global');
    setGeneratedPlan(content);
    setEditingTemplate(template);
    setActiveTab('generate');
    toast.info('Template loaded for editing. Modify and re-generate to update.');
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <Sparkles className="h-8 w-8 text-primary" />
              Diet & Workout Plans
            </h1>
            <p className="text-muted-foreground">Generate, manage, and assign personalized workout & diet plans</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Plan type toggle */}
            <div className="flex items-center rounded-xl bg-muted/50 p-1 gap-1">
              <Button
                size="sm"
                variant={planType === 'workout' ? 'default' : 'ghost'}
                onClick={() => setPlanType('workout')}
                className="gap-1.5"
              >
                <Dumbbell className="h-4 w-4" /> Workout
              </Button>
              <Button
                size="sm"
                variant={planType === 'diet' ? 'default' : 'ghost'}
                onClick={() => setPlanType('diet')}
                className="gap-1.5"
              >
                <Utensils className="h-4 w-4" /> Diet
              </Button>
            </div>
            <Button variant="outline" onClick={handleQuickShuffle} className="gap-1.5">
              <Shuffle className="h-4 w-4" /> Daily Shuffle
            </Button>
          </div>
        </div>

        {/* Quick Shuffle Result */}
        {shuffledWorkout && (
          <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-accent/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" />
                  {shuffledWorkout.name}
                </CardTitle>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => {
                    setSelectedTemplate(null);
                    setGeneratedPlan({ name: shuffledWorkout.name, type: 'workout', weeks: [{ week: 1, days: [{ day: 'Today', focus: 'Quick Shuffle', exercises: shuffledWorkout.exercises }] }] });
                    setAssignDrawerOpen(true);
                  }}>
                    <UserPlus className="h-3.5 w-3.5 mr-1" /> Assign
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShuffledWorkout(null)}>✕</Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {shuffledWorkout.exercises.map((ex: any, i: number) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-background/80 border border-border/50">
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">{i + 1}</div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{ex.name}</p>
                      <p className="text-xs text-muted-foreground">{ex.sets}×{ex.reps}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="bg-muted/50">
            {canUseAi && (
              <TabsTrigger value="generate" className="gap-1.5"><Sparkles className="h-4 w-4" /> Generate</TabsTrigger>
            )}
            <TabsTrigger value="templates" className="gap-1.5"><Library className="h-4 w-4" /> Template Library</TabsTrigger>
            <TabsTrigger value="member-plans" className="gap-1.5"><Users className="h-4 w-4" /> Member Plans</TabsTrigger>
            <TabsTrigger value="assign" className="gap-1.5"><UserPlus className="h-4 w-4" /> Assign</TabsTrigger>
          </TabsList>

          {/* ── GENERATE TAB ── */}
          <TabsContent value="generate" className="space-y-6 mt-4">
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Input Form */}
              <Card className="rounded-2xl shadow-lg shadow-primary/5">
                <CardHeader>
                  <CardTitle>Plan Details</CardTitle>
                  <CardDescription>
                    {planMode === 'global'
                      ? 'Create a master template that can be assigned to any member later.'
                      : 'Generate a personalized plan tailored to a specific member\'s body metrics.'}
                  </CardDescription>
                  {/* Mode Toggle */}
                  <div className="flex items-center rounded-xl bg-muted/50 p-1 gap-1 mt-2">
                    <Button
                      size="sm"
                      variant={planMode === 'global' ? 'default' : 'ghost'}
                      onClick={() => { setPlanMode('global'); setPersonalizedMember(null); }}
                      className="flex-1 gap-1.5"
                    >
                      <Library className="h-4 w-4" /> Global Template
                    </Button>
                    <Button
                      size="sm"
                      variant={planMode === 'personalized' ? 'default' : 'ghost'}
                      onClick={() => setPlanMode('personalized')}
                      className="flex-1 gap-1.5"
                    >
                      <UserPlus className="h-4 w-4" /> Personalized Plan
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4">
                    {/* Personalized mode: member search */}
                    {planMode === 'personalized' && (
                      <div className="space-y-2">
                        <Label>Select Member *</Label>
                        {personalizedMember ? (
                          <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                            <div>
                              <p className="font-medium text-sm">{personalizedMember.full_name}</p>
                              <p className="text-xs text-muted-foreground">{personalizedMember.member_code}</p>
                            </div>
                            <Button variant="ghost" size="sm" onClick={() => { setPersonalizedMember(null); setMemberInfo(prev => ({ ...prev, name: '', age: '', gender: '', height: '', weight: '' })); }}>Change</Button>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <Input
                              placeholder="Search member by name, code, phone..."
                              value={memberSearchTerm}
                              onChange={(e) => setMemberSearchTerm(e.target.value)}
                            />
                            {memberResults.length > 0 && (
                              <div className="space-y-1 max-h-40 overflow-y-auto border rounded-lg p-1">
                                {memberResults.map((m: any) => (
                                  <button key={m.id} onClick={() => handleSelectPersonalizedMember(m)} className="w-full text-left p-2 rounded hover:bg-accent text-sm">
                                    <span className="font-medium">{m.full_name}</span>
                                    <span className="text-muted-foreground ml-2">{m.member_code}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="grid gap-2">
                      <Label>Plan Name *</Label>
                      <Input value={memberInfo.name} onChange={(e) => setMemberInfo({ ...memberInfo, name: e.target.value })} placeholder="e.g. Push Pull Legs, Weight Loss Circuit" />
                    </div>

                    {/* Biometric fields: only in personalized mode */}
                    {planMode === 'personalized' && (
                      <>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="grid gap-2">
                            <Label>Age</Label>
                            <Input type="number" value={memberInfo.age} onChange={(e) => setMemberInfo({ ...memberInfo, age: e.target.value })} placeholder="25" />
                          </div>
                          <div className="grid gap-2">
                            <Label>Gender</Label>
                            <Select value={memberInfo.gender} onValueChange={(v) => setMemberInfo({ ...memberInfo, gender: v })}>
                              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="male">Male</SelectItem>
                                <SelectItem value="female">Female</SelectItem>
                                <SelectItem value="other">Other</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label>Experience</Label>
                            <Select value={memberInfo.experience} onValueChange={(v) => setMemberInfo({ ...memberInfo, experience: v })}>
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="beginner">Beginner</SelectItem>
                                <SelectItem value="intermediate">Intermediate</SelectItem>
                                <SelectItem value="advanced">Advanced</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="grid gap-2">
                            <Label>Height (cm)</Label>
                            <Input type="number" value={memberInfo.height} onChange={(e) => setMemberInfo({ ...memberInfo, height: e.target.value })} placeholder="175" />
                          </div>
                          <div className="grid gap-2">
                            <Label>Weight (kg)</Label>
                            <Input type="number" value={memberInfo.weight} onChange={(e) => setMemberInfo({ ...memberInfo, weight: e.target.value })} placeholder="70" />
                          </div>
                        </div>
                        <div className="grid gap-2">
                          <Label>Health Conditions</Label>
                          <Input value={memberInfo.healthConditions} onChange={(e) => setMemberInfo({ ...memberInfo, healthConditions: e.target.value })} placeholder="Any injuries or limitations..." />
                        </div>
                      </>
                    )}

                    {/* Global mode: Goal + Experience only */}
                    {planMode === 'global' && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                          <Label>Goal</Label>
                          <Select value={memberInfo.fitnessGoals} onValueChange={(v) => setMemberInfo({ ...memberInfo, fitnessGoals: v })}>
                            <SelectTrigger><SelectValue placeholder="Select goal" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Weight Loss">Weight Loss</SelectItem>
                              <SelectItem value="Muscle Gain">Muscle Gain</SelectItem>
                              <SelectItem value="General Fitness">General Fitness</SelectItem>
                              <SelectItem value="Endurance">Endurance</SelectItem>
                              <SelectItem value="Flexibility">Flexibility</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid gap-2">
                          <Label>Experience</Label>
                          <Select value={memberInfo.experience} onValueChange={(v) => setMemberInfo({ ...memberInfo, experience: v })}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="beginner">Beginner</SelectItem>
                              <SelectItem value="intermediate">Intermediate</SelectItem>
                              <SelectItem value="advanced">Advanced</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {planMode === 'personalized' && (
                      <div className="grid gap-2">
                        <Label>Fitness Goals</Label>
                        <Textarea value={memberInfo.fitnessGoals} onChange={(e) => setMemberInfo({ ...memberInfo, fitnessGoals: e.target.value })} placeholder="Lose weight, build muscle, improve endurance..." rows={2} />
                      </div>
                    )}

                    <div className="grid gap-2">
                      <Label>Preferences</Label>
                      <Input value={memberInfo.preferences} onChange={(e) => setMemberInfo({ ...memberInfo, preferences: e.target.value })} placeholder={planType === "workout" ? "Home workouts, no equipment..." : "Vegetarian, no dairy..."} />
                    </div>
                    {planType === "workout" ? (
                      <div className="grid gap-2">
                        <Label>Duration (weeks)</Label>
                        <Input type="number" value={durationWeeks} onChange={(e) => setDurationWeeks(parseInt(e.target.value) || 4)} />
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        <Label>Target Calories (optional)</Label>
                        <Input type="number" value={caloriesTarget} onChange={(e) => setCaloriesTarget(e.target.value)} placeholder="Auto-calculate based on goals" />
                      </div>
                    )}
                    <Button onClick={handleGenerate} disabled={isGenerating || saveTemplateMutation.isPending || (planMode === 'personalized' && !personalizedMember)} className="w-full">
                      {isGenerating ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{generateError === 'still_loading' ? 'Still generating… AI is thinking hard 🤔' : 'Generating plan...'}</>) : (<><Sparkles className="mr-2 h-4 w-4" />{planMode === 'global' ? 'Generate Global Template' : 'Generate Personalized Plan'}</>)}
                    </Button>
                    {generateError && generateError !== 'still_loading' && (
                      <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                        ⚠️ {generateError}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Generated Plan Display */}
              <Card className="rounded-2xl shadow-lg shadow-slate-200/50">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Generated Plan</CardTitle>
                      <CardDescription>{generatedPlan ? generatedPlan.name : "Your AI-generated plan will appear here"}</CardDescription>
                    </div>
                    {generatedPlan && (
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(JSON.stringify(generatedPlan, null, 2)); toast.success("Copied!"); }} title="Copy"><Copy className="h-4 w-4" /></Button>
                        <Button variant="outline" size="sm" onClick={handleSaveTemplate} disabled={saveTemplateMutation.isPending} title="Save Template">
                          {saveTemplateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        </Button>
                        <Button size="sm" onClick={handleAssignGeneratedPlan} title="Assign"><UserPlus className="h-4 w-4" /></Button>
                        <Button variant="outline" size="sm" onClick={() => generatePlanPDF({ name: generatedPlan.name || 'Plan', type: planType, data: generatedPlan, description: generatedPlan.description, caloriesTarget: generatedPlan.caloriesTarget })} title="Download PDF"><Download className="h-4 w-4" /></Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {!generatedPlan ? (
                    <div className="flex flex-col items-center justify-center h-[400px] text-muted-foreground">
                      <Target className="h-16 w-16 mb-4 opacity-30" />
                      <p className="text-lg font-medium mb-1">No plan generated yet</p>
                      <p className="text-sm">Fill in member details and click Generate</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[500px] pr-4">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge>{generatedPlan.difficulty || generatedPlan.type}</Badge>
                          {generatedPlan.goal && <Badge variant="outline">{generatedPlan.goal}</Badge>}
                        </div>
                        {generatedPlan.description && <p className="text-sm text-muted-foreground">{generatedPlan.description}</p>}

                        {/* Workout display */}
                        {planType === "workout" && generatedPlan.weeks?.map((week: any, wi: number) => (
                          <div key={wi} className="space-y-3">
                            <h4 className="font-semibold text-sm text-primary">Week {week.week}</h4>
                            {week.days?.map((day: any, di: number) => (
                              <Card key={di} className="p-4 rounded-xl border-border/50">
                                <div className="flex items-center justify-between mb-3">
                                  <div>
                                    <p className="font-semibold text-sm">{day.day}</p>
                                    <p className="text-xs text-muted-foreground">{day.focus}</p>
                                  </div>
                                  <Badge variant="secondary" className="text-xs">{day.exercises?.length || 0} exercises</Badge>
                                </div>
                                {day.warmup && <p className="text-xs text-muted-foreground mb-2">🔥 Warmup: {day.warmup}</p>}
                                <div className="space-y-1.5">
                                  {day.exercises?.map((ex: any, ei: number) => (
                                    <div key={ei} className="flex items-center justify-between text-sm py-1 px-2 rounded-lg hover:bg-muted/50">
                                      <span className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground w-5">{ei + 1}.</span>
                                        {ex.name}
                                      </span>
                                      <span className="text-muted-foreground text-xs">{ex.sets}×{ex.reps} • {ex.rest}</span>
                                    </div>
                                  ))}
                                </div>
                              </Card>
                            ))}
                          </div>
                        ))}

                        {/* Diet display */}
                        {planType === "diet" && generatedPlan.meals && (
                          <div className="space-y-3">
                            <div className="flex items-center gap-4 text-sm p-3 rounded-xl bg-muted/50">
                              <span>🔥 Daily: <strong>{generatedPlan.dailyCalories} cal</strong></span>
                              {generatedPlan.macros && <span>P: {generatedPlan.macros.protein} | C: {generatedPlan.macros.carbs} | F: {generatedPlan.macros.fat}</span>}
                            </div>
                            {generatedPlan.meals.map((day: any, di: number) => (
                              <Card key={di} className="p-4 rounded-xl border-border/50">
                                <p className="font-semibold text-sm mb-3">{day.day}</p>
                                <div className="space-y-2 text-sm">
                                  {day.breakfast && <div className="flex justify-between"><span>🌅 {day.breakfast.meal}</span><span className="text-muted-foreground">{day.breakfast.calories} cal</span></div>}
                                  {day.snack1 && <div className="flex justify-between"><span>🍎 {day.snack1.meal}</span><span className="text-muted-foreground">{day.snack1.calories} cal</span></div>}
                                  {day.lunch && <div className="flex justify-between"><span>🍽️ {day.lunch.meal}</span><span className="text-muted-foreground">{day.lunch.calories} cal</span></div>}
                                  {day.snack2 && <div className="flex justify-between"><span>🥜 {day.snack2.meal}</span><span className="text-muted-foreground">{day.snack2.calories} cal</span></div>}
                                  {day.dinner && <div className="flex justify-between"><span>🌙 {day.dinner.meal}</span><span className="text-muted-foreground">{day.dinner.calories} cal</span></div>}
                                </div>
                              </Card>
                            ))}
                          </div>
                        )}

                        {generatedPlan.notes && (
                          <div className="p-3 bg-muted/50 rounded-xl">
                            <p className="text-sm text-muted-foreground">{generatedPlan.notes}</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ── TEMPLATES LIBRARY TAB ── */}
          <TabsContent value="templates" className="space-y-6 mt-4">
            {templatesLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : allTemplates.length === 0 ? (
              <Card className="rounded-2xl">
                <CardContent className="py-12 text-center">
                  <Library className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Templates Yet</h3>
                  <p className="text-muted-foreground mb-4">
                    {canUseAi
                      ? 'Generate plans and save them as templates.'
                      : 'Templates will appear here once your manager creates them.'}
                  </p>
                  {canUseAi && (
                    <Button onClick={() => setActiveTab("generate")}><Sparkles className="mr-2 h-4 w-4" /> Generate First Plan</Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Default plans section */}
                {DEFAULT_TEMPLATES.filter(dt => dt.type === planType).length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Default Starter Plans</h3>
                    <div className="grid gap-4 md:grid-cols-3">
                      {DEFAULT_TEMPLATES.filter(dt => dt.type === planType).map((template) => (
                        <Card key={template.id} className="rounded-2xl hover:border-primary/30 transition-colors shadow-lg shadow-slate-200/30">
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-base">{template.name}</CardTitle>
                                <CardDescription className="text-xs mt-1">{template.description}</CardDescription>
                              </div>
                              <Badge className={`border text-xs ${getDifficultyColor(template.difficulty)}`}>{template.difficulty}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="outline" className="text-xs">
                                <Dumbbell className="h-3 w-3 mr-1" />{template.type}
                              </Badge>
                              <Badge variant="secondary" className="text-xs">{template.goal}</Badge>
                              <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">Built-in</Badge>
                            </div>
                            <Button size="sm" className="w-full" onClick={() => handleAssignTemplate(template)}>
                              <UserPlus className="h-3.5 w-3.5 mr-1" /> Assign to Member
                            </Button>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom saved templates */}
                {templates.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Your Saved Templates</h3>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {templates.map((template: FitnessPlanTemplate) => (
                        <Card key={template.id} className="rounded-2xl hover:border-primary/30 transition-colors shadow-lg shadow-slate-200/30">
                          <CardHeader className="pb-2">
                            <div className="flex items-start justify-between">
                              <div>
                                <CardTitle className="text-base">{template.name}</CardTitle>
                                <CardDescription className="text-xs mt-1">{template.description}</CardDescription>
                              </div>
                              <Badge className={`border text-xs ${getDifficultyColor(template.difficulty)}`}>{template.difficulty || 'intermediate'}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="flex items-center gap-2 mb-3">
                              <Badge variant="outline" className="text-xs">
                                {template.type === 'workout' ? <Dumbbell className="h-3 w-3 mr-1" /> : <Utensils className="h-3 w-3 mr-1" />}
                                {template.type}
                              </Badge>
                              {template.goal && <Badge variant="secondary" className="text-xs">{template.goal}</Badge>}
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" className="flex-1" onClick={() => handleAssignTemplate(template)}>
                                <UserPlus className="h-3.5 w-3.5 mr-1" /> Assign
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => {
                                generatePlanPDF({
                                  name: template.name,
                                  type: template.type,
                                  data: template.content as any,
                                });
                              }}>
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              {canUseAi && (
                                <Button size="sm" variant="outline" onClick={() => handleEditTemplate(template)} title="Edit">
                                  <Edit className="h-3.5 w-3.5" />
                                </Button>
                              )}
                              <Button size="sm" variant="ghost" onClick={() => deleteTemplateMutation.mutate(template.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          {/* ── MEMBER PLANS TAB ── */}
          <TabsContent value="member-plans" className="space-y-6 mt-4">
            {memberPlansLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
            ) : memberPlans.length === 0 ? (
              <Card className="rounded-2xl">
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-medium mb-2">No Member Plans Assigned</h3>
                  <p className="text-muted-foreground mb-4">Assign plans to members from the Template Library or Generate tab.</p>
                  <Button onClick={() => setActiveTab("templates")}><Library className="mr-2 h-4 w-4" /> Browse Templates</Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {memberPlans.map((plan: any) => {
                  const memberProfile = plan.members?.profiles;
                  return (
                    <Card key={plan.id} className="rounded-2xl shadow-lg shadow-slate-200/30">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={memberProfile?.avatar_url} />
                              <AvatarFallback className="bg-primary/10 text-primary text-xs">{memberProfile?.full_name?.charAt(0) || '?'}</AvatarFallback>
                            </Avatar>
                            <div>
                              <CardTitle className="text-sm">{memberProfile?.full_name || 'Unknown'}</CardTitle>
                              <p className="text-xs text-muted-foreground">{plan.members?.member_code}</p>
                            </div>
                          </div>
                          <Badge variant={plan.is_active ? 'default' : 'secondary'} className="text-xs">
                            {plan.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="font-medium text-sm mb-1">{plan.name}</p>
                        {plan.description && <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{plan.description}</p>}
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-xs">{plan.plan_type || 'workout'}</Badge>
                          {plan.start_date && <span>From {format(new Date(plan.start_date), 'dd MMM yyyy')}</span>}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* ── ASSIGN TAB ── */}
          <TabsContent value="assign" className="mt-4">
            <Card className="rounded-2xl shadow-lg shadow-slate-200/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserPlus className="h-5 w-5 text-primary" />
                  Assign Plan to Member
                </CardTitle>
                <CardDescription>Select a plan from templates or generate one, then assign it to a member</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-6 md:grid-cols-2">
                  {/* Pick from generated */}
                  {generatedPlan && (
                    <Card className="p-4 rounded-xl border-primary/20 bg-primary/5 cursor-pointer hover:border-primary/40 transition-colors" onClick={handleAssignGeneratedPlan}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{generatedPlan.name || 'Generated Plan'}</p>
                          <p className="text-xs text-muted-foreground">AI Generated • Click to assign</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">{generatedPlan.difficulty || planType}</Badge>
                        {generatedPlan.goal && <Badge variant="secondary" className="text-xs">{generatedPlan.goal}</Badge>}
                      </div>
                    </Card>
                  )}

                  {/* Pick from templates */}
                  {allTemplates.slice(0, 5).map((template: any) => (
                    <Card
                      key={template.id}
                      className="p-4 rounded-xl cursor-pointer hover:border-primary/30 transition-colors"
                      onClick={() => handleAssignTemplate(template)}
                    >
                      <div className="flex items-center gap-3 mb-2">
                        <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center">
                          {template.type === 'workout' ? <Dumbbell className="h-5 w-5 text-muted-foreground" /> : <Utensils className="h-5 w-5 text-muted-foreground" />}
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{template.name}</p>
                          <p className="text-xs text-muted-foreground">{template.isDefault ? 'Built-in' : 'Custom'} • Click to assign</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge className={`border text-xs ${getDifficultyColor(template.difficulty)}`}>{template.difficulty || 'intermediate'}</Badge>
                        {template.goal && <Badge variant="secondary" className="text-xs">{template.goal}</Badge>}
                      </div>
                    </Card>
                  ))}

                  {!generatedPlan && allTemplates.length === 0 && (
                    <div className="col-span-2 text-center py-12">
                      <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                      <p className="text-muted-foreground mb-4">
                        {canUseAi ? 'Generate a plan first or browse templates' : 'Browse available templates to assign to a member'}
                      </p>
                      <div className="flex gap-3 justify-center">
                        {canUseAi && (
                          <Button onClick={() => setActiveTab("generate")}><Sparkles className="mr-1 h-4 w-4" /> Generate Plan</Button>
                        )}
                        <Button variant="outline" onClick={() => setActiveTab("templates")}><Library className="mr-1 h-4 w-4" /> Browse Templates</Button>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AssignPlanDrawer
        open={assignDrawerOpen}
        onOpenChange={setAssignDrawerOpen}
        plan={selectedTemplate ? {
          name: selectedTemplate.name,
          type: (selectedTemplate as any).type as 'workout' | 'diet',
          description: (selectedTemplate as any).description || undefined,
          content: (selectedTemplate as any).content,
        } : generatedPlan ? {
          name: generatedPlan.name || `${planType} Plan`,
          type: planType,
          description: generatedPlan.description,
          content: generatedPlan,
        } : null}
      />
    </AppLayout>
  );
}

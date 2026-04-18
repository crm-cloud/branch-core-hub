import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTrainerData } from '@/hooks/useMemberData';
import { useBranchContext } from '@/contexts/BranchContext';
import { createPlanTemplate } from '@/services/fitnessService';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dumbbell, UtensilsCrossed, Plus, Trash2, Save, Users, ClipboardList,
  AlertCircle, Loader2, Clock, ArrowLeftRight, Link as LinkIcon
} from 'lucide-react';
import { VideoAttachmentControl } from '@/components/fitness/VideoAttachmentControl';
import { MealSwapModal } from '@/components/fitness/MealSwapModal';
import { AssignPlanDrawer } from '@/components/fitness/AssignPlanDrawer';
import { DIETARY_PREFERENCES, CUISINE_PREFERENCES, MealEntry } from '@/types/fitnessPlan';
import { MealCatalogEntry, MealType } from '@/services/mealCatalogService';

interface WorkoutExercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  equipment: string;
  notes: string;
  video_url?: string;
  video_file_path?: string;
}

interface WorkoutDay {
  day: string;
  label: string;
  exercises: WorkoutExercise[];
}

interface MealItem {
  food: string;
  quantity: string;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
}

interface Meal {
  name: string;
  time: string;
  items: MealItem[];
  prep_video_url?: string;
  prep_video_file_path?: string;
  recipe_link?: string;
  meal_type?: MealType;
}

const DEFAULT_DAYS: WorkoutDay[] = [
  { day: 'Day 1', label: 'Chest & Triceps', exercises: [] },
  { day: 'Day 2', label: 'Back & Biceps', exercises: [] },
  { day: 'Day 3', label: 'Shoulders & Abs', exercises: [] },
  { day: 'Day 4', label: 'Legs', exercises: [] },
  { day: 'Day 5', label: 'Arms & Core', exercises: [] },
  { day: 'Day 6', label: 'Cardio & Flexibility', exercises: [] },
  { day: 'Day 7', label: 'Rest', exercises: [] },
];

const DEFAULT_MEALS: Meal[] = [
  { name: 'Breakfast', time: '07:00', items: [], meal_type: 'breakfast' },
  { name: 'Mid-Morning Snack', time: '10:00', items: [], meal_type: 'snack' },
  { name: 'Lunch', time: '13:00', items: [], meal_type: 'lunch' },
  { name: 'Evening Snack', time: '16:00', items: [], meal_type: 'snack' },
  { name: 'Pre-Workout', time: '17:30', items: [], meal_type: 'pre_workout' },
  { name: 'Post-Workout', time: '19:00', items: [], meal_type: 'post_workout' },
  { name: 'Dinner', time: '20:30', items: [], meal_type: 'dinner' },
];

const EMPTY_EXERCISE: WorkoutExercise = { name: '', sets: 3, reps: '12', rest_seconds: 60, equipment: '', notes: '' };
const EMPTY_MEAL_ITEM: MealItem = { food: '', quantity: '', calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 };

export default function TrainerPlanBuilder() {
  const { trainer, clients, isLoading } = useTrainerData();
  const { selectedBranch: activeBranchId } = useBranchContext();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState('workout');
  const [planName, setPlanName] = useState('');
  const [planDescription, setPlanDescription] = useState('');
  const [workoutDays, setWorkoutDays] = useState<WorkoutDay[]>(DEFAULT_DAYS);
  const [meals, setMeals] = useState<Meal[]>(DEFAULT_MEALS);
  const [caloriesTarget, setCaloriesTarget] = useState<number>(2000);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [assignDrawerOpen, setAssignDrawerOpen] = useState(false);
  const [dietaryType, setDietaryType] = useState<string>('vegetarian');
  const [cuisine, setCuisine] = useState<string>('indian');
  const [swapMealIndex, setSwapMealIndex] = useState<number | null>(null);

  // Workout helpers
  const addExercise = (dayIndex: number) => {
    setWorkoutDays(prev => prev.map((d, i) =>
      i === dayIndex ? { ...d, exercises: [...d.exercises, { ...EMPTY_EXERCISE }] } : d
    ));
  };

  const updateExercise = (dayIndex: number, exIndex: number, field: keyof WorkoutExercise, value: any) => {
    setWorkoutDays(prev => prev.map((d, i) =>
      i === dayIndex ? {
        ...d,
        exercises: d.exercises.map((ex, j) => j === exIndex ? { ...ex, [field]: value } : ex)
      } : d
    ));
  };

  const removeExercise = (dayIndex: number, exIndex: number) => {
    setWorkoutDays(prev => prev.map((d, i) =>
      i === dayIndex ? { ...d, exercises: d.exercises.filter((_, j) => j !== exIndex) } : d
    ));
  };

  const updateDayLabel = (dayIndex: number, label: string) => {
    setWorkoutDays(prev => prev.map((d, i) => i === dayIndex ? { ...d, label } : d));
  };

  // Meal helpers
  const addMealItem = (mealIndex: number) => {
    setMeals(prev => prev.map((m, i) =>
      i === mealIndex ? { ...m, items: [...m.items, { ...EMPTY_MEAL_ITEM }] } : m
    ));
  };

  const updateMealItem = (mealIndex: number, itemIndex: number, field: keyof MealItem, value: any) => {
    setMeals(prev => prev.map((m, i) =>
      i === mealIndex ? {
        ...m,
        items: m.items.map((item, j) => j === itemIndex ? { ...item, [field]: value } : item)
      } : m
    ));
  };

  const removeMealItem = (mealIndex: number, itemIndex: number) => {
    setMeals(prev => prev.map((m, i) =>
      i === mealIndex ? { ...m, items: m.items.filter((_, j) => j !== itemIndex) } : m
    ));
  };

  const updateMealTime = (mealIndex: number, time: string) => {
    setMeals(prev => prev.map((m, i) => i === mealIndex ? { ...m, time } : m));
  };

  const updateMealField = (mealIndex: number, patch: Partial<Meal>) => {
    setMeals(prev => prev.map((m, i) => i === mealIndex ? { ...m, ...patch } : m));
  };

  const applySwap = (mealIndex: number, entry: MealCatalogEntry) => {
    setMeals(prev => prev.map((m, i) => i === mealIndex ? {
      ...m,
      // Replace the items with a single auto-generated entry from the catalog
      items: [{
        food: entry.name,
        quantity: entry.default_quantity || '1 serving',
        calories: entry.calories,
        protein: entry.protein,
        carbs: entry.carbs,
        fats: entry.fats,
        fiber: entry.fiber,
      }],
    } : m));
    toast.success(`Swapped to ${entry.name}`);
  };

  // Save as template
  const saveTemplate = useMutation({
    mutationFn: async () => {
      if (!planName.trim()) throw new Error('Plan name is required');
      const isWorkout = activeTab === 'workout';

      await createPlanTemplate({
        branch_id: activeBranchId || null,
        name: planName,
        type: isWorkout ? 'workout' : 'diet',
        description: planDescription,
        content: isWorkout
          ? buildWorkoutContent()
          : buildDietContent(),
      });
    },
    onSuccess: () => {
      toast.success('Plan template saved!');
      queryClient.invalidateQueries({ queryKey: ['plan-templates'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Build content payloads — preserves video / recipe metadata for P3.
  const buildWorkoutContent = () => ({
    days: workoutDays.map(d => ({
      day: `${d.day} - ${d.label}`,
      exercises: d.exercises
        .filter(e => e.name)
        .map(e => ({
          name: e.name,
          sets: e.sets,
          reps: e.reps,
          rest_seconds: e.rest_seconds,
          equipment: e.equipment,
          notes: e.notes,
          ...(e.video_url ? { video_url: e.video_url } : {}),
          ...(e.video_file_path ? { video_file_path: e.video_file_path } : {}),
        })),
    })),
  });

  const buildDietContent = () => ({
    type: dietaryType,
    cuisine,
    caloriesTarget,
    notes: `Daily Target: ${caloriesTarget} kcal`,
    meals: meals.map<MealEntry>(m => ({
      name: m.name,
      time: m.time,
      items: m.items.filter(i => i.food),
      calories: m.items.reduce((s, i) => s + i.calories, 0),
      protein: m.items.reduce((s, i) => s + i.protein, 0),
      carbs: m.items.reduce((s, i) => s + i.carbs, 0),
      fats: m.items.reduce((s, i) => s + i.fats, 0),
      ...(m.prep_video_url ? { prep_video_url: m.prep_video_url } : {}),
      ...(m.prep_video_file_path ? { prep_video_file_path: m.prep_video_file_path } : {}),
      ...(m.recipe_link ? { recipe_link: m.recipe_link } : {}),
    })),
  });

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </AppLayout>
    );
  }

  if (!trainer) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <AlertCircle className="h-12 w-12 text-warning" />
          <h2 className="text-xl font-semibold">No Trainer Profile Found</h2>
        </div>
      </AppLayout>
    );
  }

  // Calculate diet totals
  const dietTotals = meals.reduce((acc, meal) => {
    meal.items.forEach(item => {
      acc.calories += item.calories;
      acc.protein += item.protein;
      acc.carbs += item.carbs;
      acc.fats += item.fats;
      acc.fiber += item.fiber;
    });
    return acc;
  }, { calories: 0, protein: 0, carbs: 0, fats: 0, fiber: 0 });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
              <ClipboardList className="h-8 w-8 text-accent" />
              Plan Builder
            </h1>
            <p className="text-muted-foreground">Create workout & diet plans for your clients</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => saveTemplate.mutate()} disabled={saveTemplate.isPending || !planName.trim()}>
              <Save className="h-4 w-4 mr-2" />
              Save as Template
            </Button>
            <Button onClick={() => setAssignDrawerOpen(true)} disabled={!planName.trim()}>
              <Users className="h-4 w-4 mr-2" />
              Assign to Client
            </Button>
          </div>
        </div>

        {/* Plan Name & Description */}
        <Card className="border-border/50">
          <CardContent className="pt-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Plan Name *</Label>
                <Input placeholder="e.g. Muscle Gain - Phase 1" value={planName} onChange={e => setPlanName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input placeholder="Brief description" value={planDescription} onChange={e => setPlanDescription(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="workout" className="gap-2">
              <Dumbbell className="h-4 w-4" />
              Workout Plan
            </TabsTrigger>
            <TabsTrigger value="diet" className="gap-2">
              <UtensilsCrossed className="h-4 w-4" />
              Diet Plan
            </TabsTrigger>
          </TabsList>

          {/* ===== WORKOUT TAB ===== */}
          <TabsContent value="workout" className="space-y-4 mt-4">
            {/* Day selector */}
            <div className="flex gap-2 flex-wrap">
              {workoutDays.map((day, idx) => (
                <Button
                  key={idx}
                  variant={selectedDayIndex === idx ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setSelectedDayIndex(idx)}
                  className="relative"
                >
                  {day.day}
                  {day.exercises.length > 0 && (
                    <Badge variant="secondary" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {day.exercises.length}
                    </Badge>
                  )}
                </Button>
              ))}
            </div>

            {/* Selected Day */}
            <Card className="border-accent/20">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-lg">{workoutDays[selectedDayIndex].day}</CardTitle>
                  <Input
                    className="max-w-[200px] h-8 text-sm"
                    placeholder="Muscle group label"
                    value={workoutDays[selectedDayIndex].label}
                    onChange={e => updateDayLabel(selectedDayIndex, e.target.value)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {workoutDays[selectedDayIndex].exercises.map((ex, exIdx) => (
                  <div key={exIdx} className="p-3 bg-muted/50 rounded-lg space-y-2">
                    <div className="grid grid-cols-12 gap-2 items-start">
                      <div className="col-span-12 sm:col-span-3 space-y-1">
                        <Label className="text-xs">Exercise</Label>
                        <Input placeholder="Bench Press" value={ex.name} onChange={e => updateExercise(selectedDayIndex, exIdx, 'name', e.target.value)} />
                      </div>
                      <div className="col-span-3 sm:col-span-1 space-y-1">
                        <Label className="text-xs">Sets</Label>
                        <Input type="number" min={1} value={ex.sets} onChange={e => updateExercise(selectedDayIndex, exIdx, 'sets', parseInt(e.target.value) || 1)} />
                      </div>
                      <div className="col-span-3 sm:col-span-2 space-y-1">
                        <Label className="text-xs">Reps</Label>
                        <Input placeholder="12" value={ex.reps} onChange={e => updateExercise(selectedDayIndex, exIdx, 'reps', e.target.value)} />
                      </div>
                      <div className="col-span-3 sm:col-span-1 space-y-1">
                        <Label className="text-xs">Rest (s)</Label>
                        <Input type="number" min={0} value={ex.rest_seconds} onChange={e => updateExercise(selectedDayIndex, exIdx, 'rest_seconds', parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-6 sm:col-span-2 space-y-1">
                        <Label className="text-xs">Equipment</Label>
                        <Input placeholder="Barbell" value={ex.equipment} onChange={e => updateExercise(selectedDayIndex, exIdx, 'equipment', e.target.value)} />
                      </div>
                      <div className="col-span-5 sm:col-span-2 space-y-1">
                        <Label className="text-xs">Notes</Label>
                        <Input placeholder="Drop set" value={ex.notes} onChange={e => updateExercise(selectedDayIndex, exIdx, 'notes', e.target.value)} />
                      </div>
                      <div className="col-span-1 flex items-end pb-1">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeExercise(selectedDayIndex, exIdx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <VideoAttachmentControl
                      label="Form demo video"
                      folder="exercises"
                      value={{ video_url: ex.video_url, video_file_path: ex.video_file_path }}
                      onChange={(v) => {
                        updateExercise(selectedDayIndex, exIdx, 'video_url', v.video_url);
                        updateExercise(selectedDayIndex, exIdx, 'video_file_path', v.video_file_path);
                      }}
                    />
                  </div>
                ))}

                <Button variant="outline" className="w-full border-dashed" onClick={() => addExercise(selectedDayIndex)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Exercise
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ===== DIET TAB ===== */}
          <TabsContent value="diet" className="space-y-4 mt-4">
            {/* Diet preferences (used to filter the swap modal) */}
            <Card className="border-border/50">
              <CardContent className="pt-4 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Dietary Type</Label>
                  <Select value={dietaryType} onValueChange={setDietaryType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DIETARY_PREFERENCES.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Cuisine</Label>
                  <Select value={cuisine} onValueChange={setCuisine}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CUISINE_PREFERENCES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Calorie target + totals */}
            <div className="grid gap-4 sm:grid-cols-6">
              <Card className="sm:col-span-2 border-success/20 bg-success/5">
                <CardContent className="pt-4">
                  <Label className="text-xs">Daily Calorie Target</Label>
                  <Input type="number" className="mt-1 text-lg font-bold" value={caloriesTarget} onChange={e => setCaloriesTarget(parseInt(e.target.value) || 0)} />
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Calories</p>
                  <p className={`text-xl font-bold ${dietTotals.calories > caloriesTarget ? 'text-destructive' : 'text-success'}`}>
                    {dietTotals.calories}
                  </p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Protein</p>
                  <p className="text-xl font-bold">{dietTotals.protein}g</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Carbs</p>
                  <p className="text-xl font-bold">{dietTotals.carbs}g</p>
                </CardContent>
              </Card>
              <Card className="border-border/50">
                <CardContent className="pt-4 text-center">
                  <p className="text-xs text-muted-foreground">Fats</p>
                  <p className="text-xl font-bold">{dietTotals.fats}g</p>
                </CardContent>
              </Card>
            </div>

            {/* Meals */}
            {meals.map((meal, mealIdx) => (
              <Card key={mealIdx} className="border-border/50">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <UtensilsCrossed className="h-4 w-4 text-accent" />
                      {meal.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => setSwapMealIndex(mealIdx)}>
                        <ArrowLeftRight className="h-3.5 w-3.5 mr-1" /> Swap
                      </Button>
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <Input
                        type="time"
                        className="w-[120px] h-8 text-sm"
                        value={meal.time}
                        onChange={e => updateMealTime(mealIdx, e.target.value)}
                      />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {meal.items.map((item, itemIdx) => (
                    <div key={itemIdx} className="grid grid-cols-12 gap-2 items-start p-2 bg-muted/30 rounded-lg">
                      <div className="col-span-12 sm:col-span-3 space-y-1">
                        <Label className="text-xs">Food Item</Label>
                        <Input placeholder="Oats" value={item.food} onChange={e => updateMealItem(mealIdx, itemIdx, 'food', e.target.value)} />
                      </div>
                      <div className="col-span-4 sm:col-span-1 space-y-1">
                        <Label className="text-xs">Qty</Label>
                        <Input placeholder="100g" value={item.quantity} onChange={e => updateMealItem(mealIdx, itemIdx, 'quantity', e.target.value)} />
                      </div>
                      <div className="col-span-4 sm:col-span-1 space-y-1">
                        <Label className="text-xs">Cal</Label>
                        <Input type="number" value={item.calories} onChange={e => updateMealItem(mealIdx, itemIdx, 'calories', parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-4 sm:col-span-1 space-y-1">
                        <Label className="text-xs">Protein</Label>
                        <Input type="number" value={item.protein} onChange={e => updateMealItem(mealIdx, itemIdx, 'protein', parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-3 sm:col-span-1 space-y-1">
                        <Label className="text-xs">Carbs</Label>
                        <Input type="number" value={item.carbs} onChange={e => updateMealItem(mealIdx, itemIdx, 'carbs', parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-3 sm:col-span-1 space-y-1">
                        <Label className="text-xs">Fats</Label>
                        <Input type="number" value={item.fats} onChange={e => updateMealItem(mealIdx, itemIdx, 'fats', parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-3 sm:col-span-1 space-y-1">
                        <Label className="text-xs">Fiber</Label>
                        <Input type="number" value={item.fiber} onChange={e => updateMealItem(mealIdx, itemIdx, 'fiber', parseInt(e.target.value) || 0)} />
                      </div>
                      <div className="col-span-3 sm:col-span-1 flex items-end pb-1">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removeMealItem(mealIdx, itemIdx)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="w-full border-dashed" onClick={() => addMealItem(mealIdx)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Add Item
                  </Button>

                  {/* Recipe link + prep video */}
                  <div className="grid gap-3 sm:grid-cols-2 pt-2">
                    <div className="space-y-1">
                      <Label className="text-xs flex items-center gap-1"><LinkIcon className="h-3 w-3" /> Recipe link</Label>
                      <Input
                        placeholder="https://..."
                        value={meal.recipe_link || ''}
                        onChange={e => updateMealField(mealIdx, { recipe_link: e.target.value })}
                      />
                    </div>
                    <VideoAttachmentControl
                      label="Prep / cooking video"
                      folder="meals"
                      value={{ video_url: meal.prep_video_url, video_file_path: meal.prep_video_file_path }}
                      onChange={(v) => updateMealField(mealIdx, {
                        prep_video_url: v.video_url,
                        prep_video_file_path: v.video_file_path,
                      })}
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* Multi-member Assign Drawer (shared with AI Fitness page) */}
      <AssignPlanDrawer
        open={assignDrawerOpen}
        onOpenChange={setAssignDrawerOpen}
        plan={planName ? {
          name: planName,
          type: activeTab === 'workout' ? 'workout' : 'diet',
          description: planDescription,
          content: activeTab === 'workout' ? buildWorkoutContent() : buildDietContent(),
        } : null}
        branchId={activeBranchId || undefined}
      />

      {/* Meal Swap Modal */}
      <MealSwapModal
        open={swapMealIndex !== null}
        onOpenChange={(open) => !open && setSwapMealIndex(null)}
        context={swapMealIndex !== null ? {
          name: meals[swapMealIndex].name,
          mealType: meals[swapMealIndex].meal_type,
          dietaryType,
          cuisine,
          calories: meals[swapMealIndex].items.reduce((s, i) => s + i.calories, 0),
        } : null}
        onSelect={(entry) => {
          if (swapMealIndex !== null) applySwap(swapMealIndex, entry);
        }}
      />
    </AppLayout>
  );
}

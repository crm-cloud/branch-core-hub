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
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { useTrainerData } from '@/hooks/useMemberData';
import { useBranchContext } from '@/contexts/BranchContext';
import { createPlanTemplate, assignPlanToMember } from '@/services/fitnessService';
import { toast } from 'sonner';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Dumbbell, UtensilsCrossed, Plus, Trash2, Save, Users, ClipboardList,
  AlertCircle, Loader2, GripVertical, Clock
} from 'lucide-react';

interface WorkoutExercise {
  name: string;
  sets: number;
  reps: string;
  rest_seconds: number;
  equipment: string;
  notes: string;
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
  { name: 'Breakfast', time: '07:00', items: [] },
  { name: 'Mid-Morning Snack', time: '10:00', items: [] },
  { name: 'Lunch', time: '13:00', items: [] },
  { name: 'Evening Snack', time: '16:00', items: [] },
  { name: 'Pre-Workout', time: '17:30', items: [] },
  { name: 'Post-Workout', time: '19:00', items: [] },
  { name: 'Dinner', time: '20:30', items: [] },
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
  const [selectedClientId, setSelectedClientId] = useState('');

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
          ? { days: workoutDays.map(d => ({ day: `${d.day} - ${d.label}`, exercises: d.exercises.filter(e => e.name) })) }
          : { meals: meals.map(m => ({ name: m.name, time: m.time, items: m.items.filter(i => i.food), calories: m.items.reduce((s, i) => s + i.calories, 0), protein: m.items.reduce((s, i) => s + i.protein, 0), carbs: m.items.reduce((s, i) => s + i.carbs, 0), fats: m.items.reduce((s, i) => s + i.fats, 0) })), caloriesTarget },
      });
    },
    onSuccess: () => {
      toast.success('Plan template saved!');
      queryClient.invalidateQueries({ queryKey: ['plan-templates'] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Assign to client
  const assignToClient = useMutation({
    mutationFn: async () => {
      if (!selectedClientId || !planName.trim()) throw new Error('Select a client and enter a plan name');
      const isWorkout = activeTab === 'workout';

      await assignPlanToMember({
        member_id: selectedClientId,
        plan_name: planName,
        plan_type: isWorkout ? 'workout' : 'diet',
        description: planDescription,
        plan_data: isWorkout
          ? { days: workoutDays.map(d => ({ day: `${d.day} - ${d.label}`, exercises: d.exercises.filter(e => e.name) })) }
          : { meals: meals.map(m => ({ name: m.name, time: m.time, items: m.items.filter(i => i.food).map(i => i.food), calories: m.items.reduce((s, i) => s + i.calories, 0), protein: m.items.reduce((s, i) => s + i.protein, 0), carbs: m.items.reduce((s, i) => s + i.carbs, 0), fats: m.items.reduce((s, i) => s + i.fats, 0) })), notes: `Daily Target: ${caloriesTarget} kcal` },
        is_custom: true,
        branch_id: activeBranchId || undefined,
      });

      // If diet plan, also save to diet_plans table
      if (!isWorkout) {
        const { supabase } = await import('@/integrations/supabase/client');
        const { data: { user } } = await supabase.auth.getUser();
        await supabase.from('diet_plans').insert({
          member_id: selectedClientId,
          name: planName,
          description: planDescription,
          plan_data: { meals: meals.map(m => ({ name: m.name, time: m.time, items: m.items.filter(i => i.food).map(i => i.food), calories: m.items.reduce((s, i) => s + i.calories, 0), protein: m.items.reduce((s, i) => s + i.protein, 0), carbs: m.items.reduce((s, i) => s + i.carbs, 0), fats: m.items.reduce((s, i) => s + i.fats, 0) })) },
          calories_target: caloriesTarget,
          is_active: true,
          trainer_id: trainer?.id,
          start_date: new Date().toISOString().split('T')[0],
        });
      }
    },
    onSuccess: () => {
      toast.success('Plan assigned to client!');
      setAssignDrawerOpen(false);
      queryClient.invalidateQueries({ queryKey: ['member-fitness-plans'] });
    },
    onError: (e: any) => toast.error(e.message),
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
                  <div key={exIdx} className="grid grid-cols-12 gap-2 items-start p-3 bg-muted/50 rounded-lg">
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
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <UtensilsCrossed className="h-4 w-4 text-accent" />
                      {meal.name}
                    </CardTitle>
                    <div className="flex items-center gap-2">
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
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>

      {/* Assign to Client Drawer */}
      <Sheet open={assignDrawerOpen} onOpenChange={setAssignDrawerOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Assign Plan to Client
            </SheetTitle>
          </SheetHeader>

          <div className="mt-6 space-y-4">
            <Card className="bg-muted/50">
              <CardContent className="pt-4">
                <p className="font-medium">{planName || 'Untitled Plan'}</p>
                <p className="text-sm text-muted-foreground">{activeTab === 'workout' ? 'Workout' : 'Diet'} Plan</p>
              </CardContent>
            </Card>

            <div className="space-y-2">
              <Label>Select Client *</Label>
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client: any) => (
                    <SelectItem key={client.member_id} value={client.member_id}>
                      {client.member?.profile?.full_name || client.member?.member_code || 'Unknown'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {clients.length === 0 && (
              <Card className="bg-warning/5 border-warning/20">
                <CardContent className="pt-4 text-sm text-warning">
                  No active PT clients. Plans can only be assigned to your PT clients.
                </CardContent>
              </Card>
            )}
          </div>

          <SheetFooter className="mt-6">
            <Button variant="outline" onClick={() => setAssignDrawerOpen(false)}>Cancel</Button>
            <Button onClick={() => assignToClient.mutate()} disabled={assignToClient.isPending || !selectedClientId}>
              {assignToClient.isPending ? 'Assigning...' : 'Assign Plan'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}

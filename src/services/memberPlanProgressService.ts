import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { DietPlanContent, MealEntry, WorkoutDayEntry, WorkoutPlanContent } from '@/types/fitnessPlan';

// ─── Local Database augmentation ───────────────────────────────────
// The new tables added by the P3/P4 migrations are not yet in the auto-generated
// `Database` type. Define their row/insert shapes locally and cast the shared
// supabase client through one explicit boundary so all queries below are fully
// typed (no `any`).
//
// When `supabase gen types` is re-run this whole block can be deleted and we
// can use the global client directly.
type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

export type WorkoutPlanSource = 'member_fitness_plans';
export type DietPlanSource = 'member_fitness_plans' | 'diet_plans';

interface MealCatalogRow {
  id: string;
  branch_id: string | null;
  name: string;
  description: string | null;
  dietary_type: string;
  cuisine: string;
  meal_type: string;
  default_quantity: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  ingredients: string[];
  prep_video_url: string | null;
  recipe_link: string | null;
  tags: string[];
  notes: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface WorkoutCompletionRow {
  id: string;
  member_id: string;
  plan_source: WorkoutPlanSource;
  plan_id: string;
  week_number: number;
  day_label: string;
  exercise_index: number;
  exercise_name: string | null;
  completed_at: string;
}

interface MealCompletionRow {
  id: string;
  member_id: string;
  plan_source: DietPlanSource;
  plan_id: string;
  meal_date: string;
  meal_index: number;
  meal_name: string | null;
  completed_at: string;
}

interface MealSwapRow {
  id: string;
  member_id: string;
  plan_source: DietPlanSource;
  plan_id: string;
  meal_index: number;
  original_meal: Json | null;
  new_meal: Json;
  catalog_meal_id: string | null;
  swapped_at: string;
}

type ExtendedDatabase = {
  public: {
    Tables: {
      meal_catalog: {
        Row: MealCatalogRow;
        Insert: Partial<MealCatalogRow> & { name: string; dietary_type: string; cuisine: string; meal_type: string };
        Update: Partial<MealCatalogRow>;
        Relationships: [];
      };
      member_workout_completions: {
        Row: WorkoutCompletionRow;
        Insert: Partial<WorkoutCompletionRow> & {
          member_id: string;
          plan_id: string;
          day_label: string;
          exercise_index: number;
        };
        Update: Partial<WorkoutCompletionRow>;
        Relationships: [];
      };
      member_meal_completions: {
        Row: MealCompletionRow;
        Insert: Partial<MealCompletionRow> & {
          member_id: string;
          plan_id: string;
          meal_index: number;
        };
        Update: Partial<MealCompletionRow>;
        Relationships: [];
      };
      member_meal_swaps: {
        Row: MealSwapRow;
        Insert: Partial<MealSwapRow> & {
          member_id: string;
          plan_id: string;
          meal_index: number;
          new_meal: Json;
        };
        Update: Partial<MealSwapRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

const sb = supabase as unknown as SupabaseClient<ExtendedDatabase, 'public'>;

// ─── Public DTOs ────────────────────────────────────────────────────
export interface MealCatalogItem {
  id: string;
  name: string;
  description: string | null;
  dietary_type: string;
  cuisine: string;
  meal_type: string;
  default_quantity: string | null;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  fiber: number;
  ingredients: string[];
  prep_video_url: string | null;
  recipe_link: string | null;
  tags: string[];
  is_active: boolean;
}

export interface WorkoutCompletion {
  id: string;
  member_id: string;
  plan_source: WorkoutPlanSource;
  plan_id: string;
  week_number: number;
  day_label: string;
  exercise_index: number;
  exercise_name: string | null;
  completed_at: string;
}

export interface MealCompletion {
  id: string;
  member_id: string;
  plan_source: DietPlanSource;
  plan_id: string;
  meal_date: string;
  meal_index: number;
  meal_name: string | null;
  completed_at: string;
}

export interface MealSwap {
  id: string;
  member_id: string;
  plan_source: DietPlanSource;
  plan_id: string;
  meal_index: number;
  original_meal: MealEntry | null;
  new_meal: MealEntry;
  catalog_meal_id: string | null;
  swapped_at: string;
}

// ─── Catalog ────────────────────────────────────────────────────────
export async function fetchMealCatalog(filters?: {
  dietary_type?: string;
  cuisine?: string;
  meal_type?: string;
  search?: string;
}): Promise<MealCatalogItem[]> {
  let query = sb.from('meal_catalog').select('*').eq('is_active', true).order('name');
  if (filters?.dietary_type) query = query.eq('dietary_type', filters.dietary_type);
  if (filters?.cuisine) query = query.eq('cuisine', filters.cuisine);
  if (filters?.meal_type && filters.meal_type !== 'any') {
    query = query.in('meal_type', [filters.meal_type, 'any']);
  }
  if (filters?.search) query = query.ilike('name', `%${filters.search}%`);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    dietary_type: r.dietary_type,
    cuisine: r.cuisine,
    meal_type: r.meal_type,
    default_quantity: r.default_quantity,
    calories: r.calories,
    protein: Number(r.protein),
    carbs: Number(r.carbs),
    fats: Number(r.fats),
    fiber: Number(r.fiber),
    ingredients: r.ingredients ?? [],
    prep_video_url: r.prep_video_url,
    recipe_link: r.recipe_link,
    tags: r.tags ?? [],
    is_active: r.is_active,
  }));
}

// ─── Workout completions ────────────────────────────────────────────
export async function fetchWorkoutCompletions(
  memberId: string,
  planSource: WorkoutPlanSource,
  planId: string,
): Promise<WorkoutCompletion[]> {
  const { data, error } = await sb
    .from('member_workout_completions')
    .select('*')
    .eq('member_id', memberId)
    .eq('plan_source', planSource)
    .eq('plan_id', planId)
    .order('completed_at', { ascending: false });
  if (error) {
    if ((error as { code?: string; message?: string }).code === 'PGRST205' || error.message?.includes('member_workout_completions')) {
      return [];
    }
    throw error;
  }
  return data || [];
}

export async function recordWorkoutCompletion(params: {
  member_id: string;
  plan_source: WorkoutPlanSource;
  plan_id: string;
  week_number?: number;
  day_label: string;
  exercise_index: number;
  exercise_name?: string;
}): Promise<void> {
  const { error } = await (sb.from('member_workout_completions') as any).upsert(
    {
      member_id: params.member_id,
      plan_source: params.plan_source,
      plan_id: params.plan_id,
      week_number: params.week_number ?? 1,
      day_label: params.day_label,
      exercise_index: params.exercise_index,
      exercise_name: params.exercise_name ?? null,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'member_id,plan_source,plan_id,week_number,day_label,exercise_index' },
  );
  if (error) throw error;
}

export async function removeWorkoutCompletion(params: {
  member_id: string;
  plan_source: WorkoutPlanSource;
  plan_id: string;
  week_number?: number;
  day_label: string;
  exercise_index: number;
}): Promise<void> {
  const { error } = await sb
    .from('member_workout_completions')
    .delete()
    .eq('member_id', params.member_id)
    .eq('plan_source', params.plan_source)
    .eq('plan_id', params.plan_id)
    .eq('week_number', params.week_number ?? 1)
    .eq('day_label', params.day_label)
    .eq('exercise_index', params.exercise_index);
  if (error) throw error;
}

// ─── Meal completions ───────────────────────────────────────────────
export async function fetchMealCompletions(
  memberId: string,
  planSource: DietPlanSource,
  planId: string,
  fromDate?: string,
): Promise<MealCompletion[]> {
  let query = sb
    .from('member_meal_completions')
    .select('*')
    .eq('member_id', memberId)
    .eq('plan_source', planSource)
    .eq('plan_id', planId);
  if (fromDate) query = query.gte('meal_date', fromDate);
  const { data, error } = await query.order('meal_date', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function recordMealCompletion(params: {
  member_id: string;
  plan_source: DietPlanSource;
  plan_id: string;
  meal_date?: string;
  meal_index: number;
  meal_name?: string;
}): Promise<void> {
  const meal_date = params.meal_date ?? new Date().toISOString().split('T')[0];
  const { error } = await (sb.from('member_meal_completions') as any).upsert(
    {
      member_id: params.member_id,
      plan_source: params.plan_source,
      plan_id: params.plan_id,
      meal_date,
      meal_index: params.meal_index,
      meal_name: params.meal_name ?? null,
      completed_at: new Date().toISOString(),
    },
    { onConflict: 'member_id,plan_source,plan_id,meal_date,meal_index' },
  );
  if (error) throw error;
}

export async function removeMealCompletion(params: {
  member_id: string;
  plan_source: DietPlanSource;
  plan_id: string;
  meal_date?: string;
  meal_index: number;
}): Promise<void> {
  const meal_date = params.meal_date ?? new Date().toISOString().split('T')[0];
  const { error } = await sb
    .from('member_meal_completions')
    .delete()
    .eq('member_id', params.member_id)
    .eq('plan_source', params.plan_source)
    .eq('plan_id', params.plan_id)
    .eq('meal_date', meal_date)
    .eq('meal_index', params.meal_index);
  if (error) throw error;
}

// ─── Meal swaps ─────────────────────────────────────────────────────
export async function fetchMealSwaps(
  memberId: string,
  planSource: DietPlanSource,
  planId: string,
): Promise<MealSwap[]> {
  const { data, error } = await sb
    .from('member_meal_swaps')
    .select('*')
    .eq('member_id', memberId)
    .eq('plan_source', planSource)
    .eq('plan_id', planId)
    .order('swapped_at', { ascending: false });
  if (error) throw error;
  return (data || []).map((r) => ({
    id: r.id,
    member_id: r.member_id,
    plan_source: r.plan_source,
    plan_id: r.plan_id,
    meal_index: r.meal_index,
    original_meal: (r.original_meal as MealEntry | null) ?? null,
    new_meal: r.new_meal as unknown as MealEntry,
    catalog_meal_id: r.catalog_meal_id,
    swapped_at: r.swapped_at,
  }));
}

export async function recordMealSwap(params: {
  member_id: string;
  plan_source: DietPlanSource;
  plan_id: string;
  meal_index: number;
  original_meal?: MealEntry | null;
  new_meal: MealEntry;
  catalog_meal_id?: string | null;
}): Promise<void> {
  const { error } = await (sb.from('member_meal_swaps') as any).insert({
    member_id: params.member_id,
    plan_source: params.plan_source,
    plan_id: params.plan_id,
    meal_index: params.meal_index,
    original_meal: (params.original_meal ?? null) as unknown as Json,
    new_meal: params.new_meal as unknown as Json,
    catalog_meal_id: params.catalog_meal_id ?? null,
  });
  if (error) throw error;
}

// ─── Progress aggregation ───────────────────────────────────────────
export interface PlanProgressSummary {
  totalExercises: number;
  completedExercises: number;
  totalMealsThisWeek: number;
  completedMealsThisWeek: number;
  workoutCompliancePct: number;
  dietCompliancePct: number;
  swapCount: number;
  weightDeltaKg: number | null;
}

export function countWorkoutExercises(content: WorkoutPlanContent | null | undefined): {
  totalPerWeek: number;
  weeks: number;
} {
  if (!content) return { totalPerWeek: 0, weeks: 1 };
  const days: WorkoutDayEntry[] | undefined = content.weeks?.[0]?.days || content.days;
  const weeks = content.weeks?.length || 1;
  if (!days || days.length === 0) return { totalPerWeek: 0, weeks };
  const total = days.reduce((acc, d) => acc + (d.exercises?.length || 0), 0);
  return { totalPerWeek: total, weeks };
}

export function countMealsPerDay(content: DietPlanContent | null | undefined): number {
  if (!content?.meals) return 0;
  return content.meals.length;
}

export async function buildProgressSummary(params: {
  memberId: string;
  workoutPlanSource?: WorkoutPlanSource | null;
  workoutPlanId?: string | null;
  workoutContent?: WorkoutPlanContent | null;
  dietPlanSource?: DietPlanSource | null;
  dietPlanId?: string | null;
  dietContent?: DietPlanContent | null;
  daysWindow?: number;
}): Promise<PlanProgressSummary> {
  const window = params.daysWindow ?? 7;
  const fromDate = new Date(Date.now() - window * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  let completedExercises = 0;
  if (params.workoutPlanId && params.workoutPlanSource) {
    const completions = await fetchWorkoutCompletions(
      params.memberId,
      params.workoutPlanSource,
      params.workoutPlanId,
    );
    completedExercises = completions.length;
  }
  const { totalPerWeek } = countWorkoutExercises(params.workoutContent);

  let completedMeals = 0;
  let swapCount = 0;
  if (params.dietPlanId && params.dietPlanSource) {
    const [completions, swaps] = await Promise.all([
      fetchMealCompletions(params.memberId, params.dietPlanSource, params.dietPlanId, fromDate),
      fetchMealSwaps(params.memberId, params.dietPlanSource, params.dietPlanId),
    ]);
    completedMeals = completions.length;
    swapCount = swaps.length;
  }
  const mealsPerDay = countMealsPerDay(params.dietContent);
  const totalMealsThisWeek = mealsPerDay * window;

  // Weight delta — first vs last weight in last 60 days
  let weightDeltaKg: number | null = null;
  const sixty = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();
  const { data: measurements } = await supabase
    .from('member_measurements')
    .select('weight_kg, recorded_at')
    .eq('member_id', params.memberId)
    .gte('recorded_at', sixty)
    .order('recorded_at', { ascending: true });
  if (measurements && measurements.length >= 2) {
    const first = measurements.find((m) => m.weight_kg != null)?.weight_kg ?? null;
    const last = [...measurements].reverse().find((m) => m.weight_kg != null)?.weight_kg ?? null;
    if (first != null && last != null) weightDeltaKg = Number((last - first).toFixed(1));
  }

  return {
    totalExercises: totalPerWeek,
    completedExercises,
    totalMealsThisWeek,
    completedMealsThisWeek: completedMeals,
    workoutCompliancePct:
      totalPerWeek > 0 ? Math.min(100, Math.round((completedExercises / totalPerWeek) * 100)) : 0,
    dietCompliancePct:
      totalMealsThisWeek > 0 ? Math.min(100, Math.round((completedMeals / totalMealsThisWeek) * 100)) : 0,
    swapCount,
    weightDeltaKg,
  };
}

// ─── Plan helpers ───────────────────────────────────────────────────
export interface ResolvedDietPlan {
  planId: string;
  planSource: DietPlanSource;
  planName: string;
  description?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  caloriesTarget?: number | null;
  branchId?: string | null;
  content: DietPlanContent;
}

export interface ResolvedWorkoutPlan {
  planId: string;
  planSource: WorkoutPlanSource;
  planName: string;
  description?: string | null;
  validFrom?: string | null;
  validUntil?: string | null;
  branchId?: string | null;
  content: WorkoutPlanContent;
}

export function applySwapsToDiet(
  content: DietPlanContent,
  swaps: MealSwap[],
): DietPlanContent {
  if (!swaps.length || !content.meals) return content;
  const latest = new Map<number, MealEntry>();
  swaps
    .sort((a, b) => new Date(b.swapped_at).getTime() - new Date(a.swapped_at).getTime())
    .forEach((s) => {
      if (!latest.has(s.meal_index)) latest.set(s.meal_index, s.new_meal);
    });
  if (!latest.size) return content;
  const meals = content.meals.map((m, idx) => latest.get(idx) ?? m);
  return { ...content, meals };
}

// ─── Shopping list ──────────────────────────────────────────────────
export interface ShoppingListItem {
  name: string;
  count: number;
  category: string;
}

const CATEGORY_KEYWORDS: Array<{ keywords: string[]; category: string }> = [
  { keywords: ['onion', 'tomato', 'potato', 'carrot', 'spinach', 'broccoli', 'cucumber', 'pepper', 'lettuce', 'cabbage', 'cauliflower', 'sprouts', 'sweet potato', 'green peas', 'curry leaves', 'coriander', 'mint', 'lemon', 'ginger', 'garlic'], category: 'Produce' },
  { keywords: ['apple', 'banana', 'berry', 'fruit', 'papaya', 'pomegranate', 'orange'], category: 'Fruit' },
  { keywords: ['chicken', 'fish', 'salmon', 'beef', 'mutton', 'egg'], category: 'Protein' },
  { keywords: ['paneer', 'tofu', 'milk', 'yogurt', 'cheese', 'curd'], category: 'Dairy & Alt' },
  { keywords: ['dal', 'lentil', 'rajma', 'chickpea', 'chana', 'sprout'], category: 'Legumes' },
  { keywords: ['rice', 'oats', 'quinoa', 'roti', 'bread', 'flour', 'poha', 'idli', 'wheat'], category: 'Grains' },
  { keywords: ['oil', 'ghee', 'salt', 'pepper', 'masala', 'turmeric', 'cumin', 'mustard', 'spice', 'sauce', 'seed', 'tahini', 'honey'], category: 'Pantry' },
  { keywords: ['nuts', 'almond', 'walnut', 'cashew', 'makhana'], category: 'Nuts & Seeds' },
];

function categorize(name: string): string {
  const lower = name.toLowerCase();
  for (const entry of CATEGORY_KEYWORDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) return entry.category;
  }
  return 'Other';
}

function ingredientNamesForMeal(meal: MealEntry, catalogIndex: Map<string, MealCatalogItem>): string[] {
  const fromCatalog = catalogIndex.get((meal.name || '').trim().toLowerCase())?.ingredients;
  if (fromCatalog && fromCatalog.length) return fromCatalog;
  if (Array.isArray(meal.items)) {
    return meal.items
      .map((item) => {
        if (typeof item === 'string') return item;
        return item.food || item.name || '';
      })
      .filter(Boolean);
  }
  return [];
}

export async function buildShoppingList(
  content: DietPlanContent,
  daysCount: number = 7,
): Promise<{ items: ShoppingListItem[]; grouped: Record<string, ShoppingListItem[]> }> {
  const catalog = await fetchMealCatalog();
  const catalogIndex = new Map(catalog.map((c) => [c.name.trim().toLowerCase(), c]));

  const meals = content.meals || [];
  const counts = new Map<string, number>();
  for (let day = 0; day < daysCount; day++) {
    for (const meal of meals) {
      const ingredients = ingredientNamesForMeal(meal, catalogIndex);
      for (const ing of ingredients) {
        const norm = ing.trim().toLowerCase();
        if (!norm) continue;
        counts.set(norm, (counts.get(norm) || 0) + 1);
      }
    }
  }

  const items: ShoppingListItem[] = Array.from(counts.entries())
    .map(([name, count]) => ({
      name: name.replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
      category: categorize(name),
    }))
    .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

  const grouped: Record<string, ShoppingListItem[]> = {};
  for (const item of items) {
    if (!grouped[item.category]) grouped[item.category] = [];
    grouped[item.category].push(item);
  }
  return { items, grouped };
}

// Shared schema for workout/diet plan content stored in
// `fitness_plan_templates.content`, `member_fitness_plans.plan_data`,
// and `diet_plans.plan_data`. All new media-related fields are optional
// so existing stored JSON continues to load without migration.

export interface ExerciseEntry {
  name: string;
  sets?: number | string;
  reps?: number | string;
  rest?: string;
  rest_seconds?: number;
  equipment?: string;
  notes?: string;
  /** Optional public URL for an externally hosted video (YouTube, Vimeo, etc.). */
  video_url?: string;
  /** Optional storage path for a self-hosted form-demo video uploaded later (P3). */
  video_file_path?: string;
  /** Optional bullet/sentence form-cue tips shown alongside the exercise. */
  form_tips?: string[] | string;
}

export interface WorkoutDayEntry {
  day: string;
  focus?: string;
  label?: string;
  warmup?: string;
  cooldown?: string;
  exercises: ExerciseEntry[];
}

export interface WorkoutWeekEntry {
  week: number;
  days: WorkoutDayEntry[];
}

export interface WorkoutPlanContent {
  name?: string;
  description?: string;
  goal?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced' | string;
  weeks?: WorkoutWeekEntry[];
  days?: WorkoutDayEntry[];
  notes?: string;
}

export interface MealItemEntry {
  food?: string;
  name?: string;
  quantity?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  fiber?: number;
}

export interface MealEntry {
  name: string;
  time?: string;
  items?: (MealItemEntry | string)[];
  meal?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  /** Optional public URL for an externally hosted prep / cooking video. */
  prep_video_url?: string;
  /** Optional public link to a recipe (blog, app, PDF, etc.). */
  recipe_link?: string;
}

export interface DietPlanContent {
  name?: string;
  description?: string;
  type?: string;
  dailyCalories?: number;
  caloriesTarget?: number;
  macros?: { protein?: string; carbs?: string; fat?: string };
  meals?: MealEntry[];
  hydration?: string;
  supplements?: string[];
  notes?: string;
}

/**
 * Lightweight runtime validator. We deliberately avoid throwing on
 * missing optional fields — older stored JSON must continue to load
 * unchanged. Returns `true` only when the shape is structurally
 * recognisable as a workout or diet plan.
 */
export function isPlanContent(value: unknown): value is WorkoutPlanContent | DietPlanContent {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    'weeks' in v ||
    'days' in v ||
    'meals' in v ||
    'name' in v ||
    'description' in v
  );
}

export const DIETARY_PREFERENCES = [
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'non_vegetarian', label: 'Non-Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
] as const;

export const CUISINE_PREFERENCES = [
  { value: 'indian', label: 'Indian' },
  { value: 'indian_modern', label: 'Indian — Modern' },
  { value: 'continental', label: 'Continental' },
  { value: 'asian', label: 'Asian' },
  { value: 'mediterranean', label: 'Mediterranean' },
  { value: 'mixed', label: 'Mixed' },
] as const;

export const FITNESS_LEVELS = [
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
] as const;

export const ACTIVITY_LEVELS = [
  { value: 'sedentary', label: 'Sedentary (little / no exercise)' },
  { value: 'light', label: 'Light (1-3 days/week)' },
  { value: 'moderate', label: 'Moderate (3-5 days/week)' },
  { value: 'very_active', label: 'Very Active (6-7 days/week)' },
  { value: 'extra_active', label: 'Extra Active (physical job + training)' },
] as const;

export const EQUIPMENT_OPTIONS = [
  { value: 'full_gym', label: 'Full Gym Access' },
  { value: 'home_dumbbells', label: 'Home Dumbbells' },
  { value: 'resistance_bands', label: 'Resistance Bands' },
  { value: 'kettlebells', label: 'Kettlebells' },
  { value: 'pull_up_bar', label: 'Pull-up Bar' },
  { value: 'cardio_machine', label: 'Cardio Machine' },
  { value: 'bodyweight_only', label: 'Bodyweight Only' },
] as const;

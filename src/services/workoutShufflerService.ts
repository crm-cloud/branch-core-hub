import { supabase } from '@/integrations/supabase/client';

export interface Exercise {
  id: string;
  name: string;
  target_muscle: string;
  equipment_type: string | null;
  difficulty: string;
  instructions: string | null;
}

export interface ShuffledWorkout {
  exercises: Exercise[];
  seed: string;
  targetMuscle: string;
  generatedAt: string;
}

/**
 * Seeded random number generator for deterministic shuffling
 * Uses a simple hash-based approach
 */
function seededRandom(seed: string): () => number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Use the hash as a seed for a simple LCG
  let state = hash;
  return () => {
    state = (state * 1664525 + 1013904223) & 0xFFFFFFFF;
    return (state >>> 0) / 0xFFFFFFFF;
  };
}

/**
 * Fisher-Yates shuffle with seeded random
 */
function seededShuffle<T>(array: T[], seed: string): T[] {
  const result = [...array];
  const random = seededRandom(seed);
  
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  
  return result;
}

/**
 * Generate a unique daily workout for a member
 * The same member+date combination will always produce the same sequence
 * Different members on the same day get different sequences
 */
export async function generateDailyWorkout(
  memberId: string,
  targetMuscle: string,
  maxExercises: number = 8
): Promise<ShuffledWorkout> {
  // Create a seed unique to this member and today's date
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const seed = `${memberId}-${today}-${targetMuscle}`;
  
  // Fetch exercises for the target muscle group
  const { data: exercises, error } = await supabase
    .from('exercises')
    .select('id, name, target_muscle, equipment_type, difficulty, instructions')
    .eq('target_muscle', targetMuscle)
    .eq('is_active', true);
  
  if (error) throw error;
  if (!exercises || exercises.length === 0) {
    throw new Error(`No exercises found for muscle group: ${targetMuscle}`);
  }
  
  // Shuffle the exercises using the seeded randomizer
  const shuffled = seededShuffle(exercises, seed);
  
  // Return the top N exercises
  return {
    exercises: shuffled.slice(0, maxExercises),
    seed,
    targetMuscle,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Get all available muscle groups
 */
export async function getMuscleGroups(): Promise<string[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('target_muscle')
    .eq('is_active', true);
  
  if (error) throw error;
  
  const unique = [...new Set(data?.map(e => e.target_muscle) || [])];
  return unique.sort();
}

/**
 * Generate a full weekly workout plan with shuffled exercises for each day
 */
export async function generateWeeklyWorkout(
  memberId: string,
  weekPlan: { day: string; targetMuscle: string }[]
): Promise<{ day: string; workout: ShuffledWorkout }[]> {
  const results = [];
  
  for (const dayPlan of weekPlan) {
    try {
      const workout = await generateDailyWorkout(memberId, dayPlan.targetMuscle);
      results.push({
        day: dayPlan.day,
        workout,
      });
    } catch (error) {
      console.error(`Error generating workout for ${dayPlan.day}:`, error);
    }
  }
  
  return results;
}

/**
 * Standard weekly split for gym workouts
 */
export const DEFAULT_WEEKLY_SPLIT = [
  { day: 'Monday', targetMuscle: 'chest' },
  { day: 'Tuesday', targetMuscle: 'back' },
  { day: 'Wednesday', targetMuscle: 'shoulders' },
  { day: 'Thursday', targetMuscle: 'legs' },
  { day: 'Friday', targetMuscle: 'arms' },
  { day: 'Saturday', targetMuscle: 'full_body' },
  { day: 'Sunday', targetMuscle: 'cardio' },
];

/**
 * Get exercise count by muscle group
 */
export async function getExerciseCounts(): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('exercises')
    .select('target_muscle')
    .eq('is_active', true);
  
  if (error) throw error;
  
  const counts: Record<string, number> = {};
  data?.forEach(e => {
    counts[e.target_muscle] = (counts[e.target_muscle] || 0) + 1;
  });
  
  return counts;
}

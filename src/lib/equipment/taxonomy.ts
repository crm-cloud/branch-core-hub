// Controlled vocabulary for equipment categorisation. Mirrors the
// `equipment.primary_category`, `equipment.muscle_groups`, and
// `equipment.movement_pattern` columns added in the May 2026 migration.
//
// Keep these lists in sync with the DB COMMENTs on those columns.

export const PRIMARY_CATEGORIES = [
  { value: "cardio", label: "Cardio" },
  { value: "strength_machine", label: "Strength Machine" },
  { value: "free_weight", label: "Free Weight" },
  { value: "cable", label: "Cable / Pulley" },
  { value: "functional", label: "Functional" },
  { value: "bodyweight", label: "Bodyweight" },
  { value: "recovery", label: "Recovery" },
  { value: "accessory", label: "Accessory" },
] as const;

export type PrimaryCategory = (typeof PRIMARY_CATEGORIES)[number]["value"];

export const MUSCLE_GROUPS = [
  // Upper body
  { value: "chest", label: "Chest", group: "Upper" },
  { value: "back_lats", label: "Back (Lats)", group: "Upper" },
  { value: "back_traps", label: "Back (Traps / Rhomboids)", group: "Upper" },
  { value: "shoulders", label: "Shoulders", group: "Upper" },
  { value: "biceps", label: "Biceps", group: "Upper" },
  { value: "triceps", label: "Triceps", group: "Upper" },
  { value: "forearms", label: "Forearms", group: "Upper" },
  // Core
  { value: "core_abs", label: "Core (Abs)", group: "Core" },
  { value: "core_obliques", label: "Core (Obliques)", group: "Core" },
  { value: "lower_back", label: "Lower Back", group: "Core" },
  // Lower body
  { value: "glutes", label: "Glutes", group: "Lower" },
  { value: "quads", label: "Quads", group: "Lower" },
  { value: "hamstrings", label: "Hamstrings", group: "Lower" },
  { value: "calves", label: "Calves", group: "Lower" },
  { value: "hip_adductors", label: "Hip Adductors", group: "Lower" },
  { value: "hip_abductors", label: "Hip Abductors", group: "Lower" },
  // Misc
  { value: "full_body", label: "Full Body", group: "Other" },
  { value: "cardio_lower", label: "Cardio (Lower)", group: "Other" },
  { value: "cardio_upper", label: "Cardio (Upper)", group: "Other" },
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]["value"];

export const MOVEMENT_PATTERNS = [
  { value: "push", label: "Push" },
  { value: "pull", label: "Pull" },
  { value: "squat", label: "Squat" },
  { value: "hinge", label: "Hinge" },
  { value: "lunge", label: "Lunge" },
  { value: "carry", label: "Carry" },
  { value: "rotation", label: "Rotation" },
  { value: "gait", label: "Gait" },
  { value: "isolation", label: "Isolation" },
  { value: "mobility", label: "Mobility" },
] as const;

export type MovementPattern = (typeof MOVEMENT_PATTERNS)[number]["value"];

export function muscleGroupLabel(value: string): string {
  return MUSCLE_GROUPS.find((m) => m.value === value)?.label ?? value;
}

export function primaryCategoryLabel(value: string | null | undefined): string {
  if (!value) return "—";
  return PRIMARY_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

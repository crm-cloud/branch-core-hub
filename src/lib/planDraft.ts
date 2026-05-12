// Lightweight session-scoped store for in-progress plan drafts shared between
// the create/build pages and the preview page. Drafts are NOT persisted
// across browser sessions.

const DRAFT_PREFIX = 'fitness-plan-draft:';

export interface PlanAudience {
  target_age_min?: number | null;
  target_age_max?: number | null;
  target_gender?: 'any' | 'male' | 'female';
  target_weight_min_kg?: number | null;
  target_weight_max_kg?: number | null;
  target_bmi_min?: number | null;
  target_bmi_max?: number | null;
  target_goal?: string | null;
  target_experience?: string[];
  duration_weeks?: number | null;
  days_per_week?: number | null;
}

export interface PlanDraft {
  id: string;
  source: 'ai' | 'manual-workout' | 'manual-diet';
  type: 'workout' | 'diet';
  name: string;
  description?: string;
  goal?: string;
  difficulty?: string;
  caloriesTarget?: number;
  memberId?: string;
  memberName?: string;
  memberCode?: string;
  // Per-plan member profile snapshot (overrides applied)
  memberProfile?: Record<string, any>;
  // Cuisine + dietary type for diet plans
  cuisine?: string;
  dietaryType?: string;
  /** Workout sessions per week (1-7). Persisted on draft so preview/save can show it. */
  daysPerWeek?: number;
  /** If > 0, the plan rotates exercise variants every N days. */
  rotationIntervalDays?: number;
  // The actual plan content payload (weeks/days/exercises or meals)
  content: any;
  /** Marks an audience-targeted Common (no-PT) plan — saved as is_common = true. */
  isCommon?: boolean;
  audience?: PlanAudience;
  /** Optional id of the originating template — preserved through the
   * preview/assign flow so member assignments can back-reference it. */
  templateId?: string;
  createdAt: string;
}

export function newDraftId() {
  return `pd_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function saveDraft(draft: PlanDraft) {
  try {
    sessionStorage.setItem(DRAFT_PREFIX + draft.id, JSON.stringify(draft));
  } catch {
    // ignore quota errors
  }
}

export function loadDraft(id: string): PlanDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_PREFIX + id);
    return raw ? (JSON.parse(raw) as PlanDraft) : null;
  } catch {
    return null;
  }
}

export function clearDraft(id: string) {
  try {
    sessionStorage.removeItem(DRAFT_PREFIX + id);
  } catch {
    // ignore
  }
}

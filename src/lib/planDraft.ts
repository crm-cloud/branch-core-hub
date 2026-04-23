// Lightweight session-scoped store for in-progress plan drafts shared between
// the create/build pages and the preview page. Drafts are NOT persisted
// across browser sessions.

const DRAFT_PREFIX = 'fitness-plan-draft:';

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
  // The actual plan content payload (weeks/days/exercises or meals)
  content: any;
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

// Known valid values for the benefit_type database enum.
// Custom benefit types use 'other' as fallback; the actual link is via benefit_type_id (UUID).
export const KNOWN_BENEFIT_ENUMS = new Set([
  'gym_access', 'pool_access', 'sauna_access', 'steam_access', 'group_classes',
  'pt_sessions', 'locker', 'towel', 'parking', 'guest_pass', 'other', 'ice_bath',
  'yoga_class', 'crossfit_class', 'spa_access', 'sauna_session', 'cardio_area', 'functional_training',
]);

export function safeBenefitEnum(code: string): string {
  return KNOWN_BENEFIT_ENUMS.has(code) ? code : 'other';
}

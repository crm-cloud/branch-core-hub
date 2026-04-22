import type { MemberMeasurementRecord, MeasurementNumericField } from './types';

export interface MeasurementFieldDefinition {
  key: MeasurementNumericField;
  label: string;
  min: number;
  max: number;
  step?: number;
  category: 'core' | 'torso' | 'arms' | 'legs';
}

export const measurementFieldDefinitions: MeasurementFieldDefinition[] = [
  { key: 'weight_kg', label: 'Weight (kg)', min: 25, max: 350, step: 0.1, category: 'core' },
  { key: 'height_cm', label: 'Height (cm)', min: 100, max: 250, step: 0.1, category: 'core' },
  { key: 'body_fat_percentage', label: 'Body Fat %', min: 2, max: 70, step: 0.1, category: 'core' },
  { key: 'shoulder_cm', label: 'Shoulder (cm)', min: 25, max: 90, step: 0.1, category: 'torso' },
  { key: 'chest_cm', label: 'Chest (cm)', min: 40, max: 220, step: 0.1, category: 'torso' },
  { key: 'abdomen_cm', label: 'Abdomen (cm)', min: 35, max: 220, step: 0.1, category: 'torso' },
  { key: 'waist_cm', label: 'Waist (cm)', min: 35, max: 220, step: 0.1, category: 'torso' },
  { key: 'hips_cm', label: 'Hips (cm)', min: 45, max: 240, step: 0.1, category: 'torso' },
  { key: 'neck_cm', label: 'Neck (cm)', min: 20, max: 60, step: 0.1, category: 'torso' },
  { key: 'torso_length_cm', label: 'Torso Length (cm)', min: 30, max: 90, step: 0.1, category: 'torso' },
  { key: 'biceps_left_cm', label: 'Biceps Left (cm)', min: 12, max: 80, step: 0.1, category: 'arms' },
  { key: 'biceps_right_cm', label: 'Biceps Right (cm)', min: 12, max: 80, step: 0.1, category: 'arms' },
  { key: 'forearm_left_cm', label: 'Forearm Left (cm)', min: 12, max: 55, step: 0.1, category: 'arms' },
  { key: 'forearm_right_cm', label: 'Forearm Right (cm)', min: 12, max: 55, step: 0.1, category: 'arms' },
  { key: 'wrist_left_cm', label: 'Wrist Left (cm)', min: 8, max: 30, step: 0.1, category: 'arms' },
  { key: 'wrist_right_cm', label: 'Wrist Right (cm)', min: 8, max: 30, step: 0.1, category: 'arms' },
  { key: 'thighs_left_cm', label: 'Thigh Left (cm)', min: 20, max: 120, step: 0.1, category: 'legs' },
  { key: 'thighs_right_cm', label: 'Thigh Right (cm)', min: 20, max: 120, step: 0.1, category: 'legs' },
  { key: 'calves_cm', label: 'Calves (cm)', min: 18, max: 70, step: 0.1, category: 'legs' },
  { key: 'ankle_left_cm', label: 'Ankle Left (cm)', min: 10, max: 40, step: 0.1, category: 'legs' },
  { key: 'ankle_right_cm', label: 'Ankle Right (cm)', min: 10, max: 40, step: 0.1, category: 'legs' },
  { key: 'inseam_cm', label: 'Inseam (cm)', min: 40, max: 130, step: 0.1, category: 'legs' },
];

export const measurementDefinitionMap = Object.fromEntries(
  measurementFieldDefinitions.map((field) => [field.key, field]),
) as Record<MeasurementNumericField, MeasurementFieldDefinition>;

export type MeasurementDraft = Partial<Record<MeasurementNumericField, string>> & {
  notes?: string;
  gender_presentation?: 'male' | 'female' | 'other' | '';
  posture_type?: string;
  body_shape_profile?: string;
};

export function sanitizeMeasurementNumber(value: string | number | null | undefined) {
  if (value === '' || value === null || value === undefined) return null;
  const numeric = typeof value === 'number' ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) return null;
  return Number(numeric.toFixed(2));
}

export function validateMeasurementField(
  key: MeasurementNumericField,
  value: string | number | null | undefined,
) {
  const definition = measurementDefinitionMap[key];
  const numericValue = sanitizeMeasurementNumber(value);

  if (numericValue === null) {
    return { valid: true, value: null as number | null };
  }

  if (numericValue < definition.min || numericValue > definition.max) {
    return {
      valid: false,
      value: numericValue,
      message: `${definition.label} must be between ${definition.min} and ${definition.max}.`,
    };
  }

  return { valid: true, value: numericValue };
}

export function normalizeMeasurementDraft(draft: MeasurementDraft) {
  const normalized: Record<string, string | number | string[] | null> = {};
  const errors: string[] = [];

  measurementFieldDefinitions.forEach((field) => {
    const result = validateMeasurementField(field.key, draft[field.key]);
    if (!result.valid && result.message) errors.push(result.message);
    normalized[field.key] = result.value;
  });

  normalized.notes = draft.notes?.trim() || null;
  normalized.gender_presentation = draft.gender_presentation || null;
  normalized.posture_type = draft.posture_type?.trim() || null;
  normalized.body_shape_profile = draft.body_shape_profile?.trim() || null;

  return { normalized, errors };
}

export function hasMeaningfulMeasurementData(
  payload: Partial<MemberMeasurementRecord> & {
    photos?: string[] | null;
    front_progress_photo_path?: string | null;
    side_progress_photo_path?: string | null;
  },
) {
  const hasNumbers = measurementFieldDefinitions.some((field) => payload[field.key] !== null && payload[field.key] !== undefined);
  const hasPhotos = Boolean(payload.front_progress_photo_path || payload.side_progress_photo_path || payload.photos?.length);
  return hasNumbers || hasPhotos;
}

export function getMeasurementLabel(key: MeasurementNumericField) {
  return measurementDefinitionMap[key].label;
}

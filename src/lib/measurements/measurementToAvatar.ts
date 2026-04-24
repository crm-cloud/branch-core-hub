import type { MemberMeasurementRecord, MeasurementNumericField } from './types';

export interface MorphTargetState {
  torsoWidth: number;
  chestVolume: number;
  waistWidth: number;
  abdomenVolume: number;
  hipWidth: number;
  shoulderBreadth: number;
  armVolume: number;
  forearmVolume: number;
  wristSize: number;
  thighVolume: number;
  calfVolume: number;
  ankleSize: number;
  neckSize: number;
  heightScale: number;
  torsoLength: number;
  bodyFatSoftness: number;
  globalMass: number;
}

export interface AvatarSnapshot {
  genderPresentation: 'male' | 'female' | 'other';
  morphs: MorphTargetState;
}

export interface DeltaCallout {
  key: MeasurementNumericField;
  label: string;
  delta: number;
  formatted: string;
  direction: 'up' | 'down' | 'stable';
}

const MORPH_DEFAULTS: MorphTargetState = {
  torsoWidth: 0.5,
  chestVolume: 0.5,
  waistWidth: 0.5,
  abdomenVolume: 0.5,
  hipWidth: 0.5,
  shoulderBreadth: 0.5,
  armVolume: 0.5,
  forearmVolume: 0.5,
  wristSize: 0.5,
  thighVolume: 0.5,
  calfVolume: 0.5,
  ankleSize: 0.5,
  neckSize: 0.5,
  heightScale: 0.5,
  torsoLength: 0.5,
  bodyFatSoftness: 0.5,
  globalMass: 0.5,
};

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function normalized(value: number | null | undefined, min: number, max: number, fallback = 0.5) {
  if (value === null || value === undefined || Number.isNaN(value)) return fallback;
  return clamp01((value - min) / (max - min));
}

function average(...values: Array<number | null | undefined>) {
  const numeric = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (!numeric.length) return null;
  return numeric.reduce((sum, value) => sum + value, 0) / numeric.length;
}

function ease(value: number, calibration = 0.82) {
  const centered = value - 0.5;
  return clamp01(0.5 + centered * calibration);
}

function normalizeGenderPresentation(value?: string | null): 'male' | 'female' | 'other' {
  const g = (value || '').toString().trim().toLowerCase();
  if (g === 'male' || g === 'm') return 'male';
  if (g === 'female' || g === 'f') return 'female';
  return 'other';
}

export function measurementToAvatarSnapshot(
  measurement?: MemberMeasurementRecord | null,
  fallbackGender?: string | null,
): AvatarSnapshot {
  const fallback = normalizeGenderPresentation(fallbackGender);

  if (!measurement) {
    return { genderPresentation: fallback, morphs: MORPH_DEFAULTS };
  }

  const arm = average(measurement.biceps_left_cm, measurement.biceps_right_cm);
  const forearm = average(measurement.forearm_left_cm, measurement.forearm_right_cm);
  const wrist = average(measurement.wrist_left_cm, measurement.wrist_right_cm);
  const thigh = average(measurement.thighs_left_cm, measurement.thighs_right_cm);
  const ankle = average(measurement.ankle_left_cm, measurement.ankle_right_cm);

  const morphs: MorphTargetState = {
    torsoWidth: ease(average(
      normalized(measurement.chest_cm, 70, 150),
      normalized(measurement.shoulder_cm, 30, 70),
      normalized(measurement.hips_cm, 70, 150),
    ) ?? 0.5, 0.72),
    chestVolume: ease(average(
      normalized(measurement.chest_cm, 70, 150),
      normalized(measurement.weight_kg, 45, 140),
    ) ?? 0.5, 0.68),
    waistWidth: ease(average(
      normalized(measurement.waist_cm, 55, 140),
      normalized(measurement.abdomen_cm, 60, 150),
    ) ?? 0.5, 0.75),
    abdomenVolume: ease(average(
      normalized(measurement.abdomen_cm, 60, 150),
      normalized(measurement.body_fat_percentage, 8, 45),
      normalized(measurement.weight_kg, 45, 140),
    ) ?? 0.5, 0.72),
    hipWidth: ease(normalized(measurement.hips_cm, 70, 155), 0.74),
    shoulderBreadth: ease(normalized(measurement.shoulder_cm, 30, 70), 0.66),
    armVolume: ease(average(
      normalized(arm, 20, 55),
      normalized(measurement.weight_kg, 45, 140),
    ) ?? 0.5, 0.68),
    forearmVolume: ease(normalized(forearm, 18, 40), 0.7),
    wristSize: ease(normalized(wrist, 12, 23), 0.55),
    thighVolume: ease(average(
      normalized(thigh, 35, 85),
      normalized(measurement.weight_kg, 45, 140),
    ) ?? 0.5, 0.7),
    calfVolume: ease(normalized(measurement.calves_cm, 24, 52), 0.68),
    ankleSize: ease(normalized(ankle, 16, 30), 0.55),
    neckSize: ease(normalized(measurement.neck_cm, 25, 48), 0.55),
    heightScale: ease(normalized(measurement.height_cm, 145, 205), 0.5),
    torsoLength: ease(normalized(measurement.torso_length_cm, 38, 72), 0.55),
    bodyFatSoftness: ease(normalized(measurement.body_fat_percentage, 8, 45), 0.8),
    globalMass: ease(average(
      normalized(measurement.weight_kg, 45, 140),
      normalized(measurement.body_fat_percentage, 8, 45),
    ) ?? 0.5, 0.72),
  };

  return {
    genderPresentation: normalizeGenderPresentation(measurement.gender_presentation || fallbackGender),
    morphs,
  };
}

const CALLOUT_FIELDS: Array<{ key: MeasurementNumericField; label: string; unit: string }> = [
  { key: 'waist_cm', label: 'Waist', unit: 'cm' },
  { key: 'chest_cm', label: 'Chest', unit: 'cm' },
  { key: 'weight_kg', label: 'Weight', unit: 'kg' },
  { key: 'body_fat_percentage', label: 'Body fat', unit: '%' },
  { key: 'hips_cm', label: 'Hips', unit: 'cm' },
];

export function buildMeasurementCallouts(
  latest?: MemberMeasurementRecord | null,
  previous?: MemberMeasurementRecord | null,
) {
  if (!latest || !previous) return [] as DeltaCallout[];

  return CALLOUT_FIELDS
    .map(({ key, label, unit }) => {
      const latestValue = latest[key] as number | null | undefined;
      const previousValue = previous[key] as number | null | undefined;
      if (latestValue === null || latestValue === undefined || previousValue === null || previousValue === undefined) {
        return null;
      }

      const delta = Number((latestValue - previousValue).toFixed(1));
      const direction: DeltaCallout['direction'] = Math.abs(delta) < 0.1 ? 'stable' : delta > 0 ? 'up' : 'down';
      const verb = direction === 'stable' ? 'steady' : direction === 'up' ? 'up' : 'down';
      const formatted = direction === 'stable'
        ? `${label} steady`
        : `${label} ${verb} ${Math.abs(delta).toFixed(1)} ${unit}`;

      return { key, label, delta, formatted, direction };
    })
    .filter((item): item is DeltaCallout => Boolean(item))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
}

// Body-shape fields needed to render a meaningful 3D avatar. Weight/height alone
// do not give us silhouette signal, so we don't count them here.
const BODY_SHAPE_FIELDS: MeasurementNumericField[] = [
  'chest_cm',
  'waist_cm',
  'hips_cm',
  'shoulder_cm',
  'neck_cm',
  'biceps_left_cm',
  'biceps_right_cm',
  'thighs_left_cm',
  'thighs_right_cm',
  'calves_cm',
  'forearm_left_cm',
  'forearm_right_cm',
  'abdomen_cm',
  'torso_length_cm',
];

export function hasBodyShapeMeasurements(
  measurement?: MemberMeasurementRecord | null,
): boolean {
  if (!measurement) return false;
  return BODY_SHAPE_FIELDS.some((field) => {
    const value = measurement[field] as number | null | undefined;
    return typeof value === 'number' && Number.isFinite(value) && value > 0;
  });
}

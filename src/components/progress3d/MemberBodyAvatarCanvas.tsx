import { MemberBodyAvatarSvg } from './MemberBodyAvatarSvg';
import type { MemberMeasurementRecord } from '@/lib/measurements/types';
import { BodyFallbackCard } from './BodyFallbackCard';

interface MemberBodyAvatarCanvasProps {
  measurement?: MemberMeasurementRecord | null;
  previousMeasurement?: MemberMeasurementRecord | null;
  label: string;
  memberGender?: string | null;
}

/**
 * Body avatar canvas — now uses a gender-aware SVG silhouette with
 * measurement overlays. The previous react-three-fiber GLB renderer
 * required model files that aren't shipped, producing a generic
 * mannequin. This is faster, deterministic, and visually on-brand.
 */
export function MemberBodyAvatarCanvas({ measurement, previousMeasurement, label, memberGender }: MemberBodyAvatarCanvasProps) {
  if (!measurement) {
    return <BodyFallbackCard latest={measurement} previous={previousMeasurement} title={label} />;
  }
  return <MemberBodyAvatarSvg measurement={measurement} previousMeasurement={previousMeasurement} label={label} memberGender={memberGender} />;
}

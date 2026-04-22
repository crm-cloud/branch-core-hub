import { supabase } from '@/integrations/supabase/client';
import type { MemberMeasurementRecord } from './types';

type MeasurementPhotoSource = Omit<MemberMeasurementRecord, 'gender_presentation' | 'photos' | 'signedPhotoUrls' | 'frontProgressPhotoUrl' | 'sideProgressPhotoUrl'> & {
  gender_presentation?: string | null;
  photos?: unknown;
};

const PHOTO_BUCKET = 'member-photos';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function uniquePaths(paths: Array<string | null | undefined>) {
  return Array.from(new Set(paths.filter((path): path is string => Boolean(path))));
}

function normalizePhotoPaths(photos: unknown) {
  if (!Array.isArray(photos)) return [] as string[];
  return photos.filter((photo): photo is string => typeof photo === 'string');
}

export async function hydrateMeasurementPhotoUrls<T extends MeasurementPhotoSource>(measurements: T[]) {
  if (!measurements.length) return measurements;

  const normalizedMeasurements = measurements.map((measurement) => ({
    ...measurement,
    photos: normalizePhotoPaths(measurement.photos),
  }));

  const paths = uniquePaths(
    normalizedMeasurements.flatMap((measurement) => [
      ...measurement.photos,
      measurement.front_progress_photo_path,
      measurement.side_progress_photo_path,
    ]),
  );

  if (!paths.length) {
    return normalizedMeasurements.map((measurement) => ({
      ...measurement,
      signedPhotoUrls: [],
      frontProgressPhotoUrl: null,
      sideProgressPhotoUrl: null,
    })) as T[];
  }

  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;

  const signedUrlMap = new Map(data.map((item) => [item.path, item.signedUrl]));

  return normalizedMeasurements.map((measurement) => ({
    ...measurement,
    signedPhotoUrls: (measurement.photos ?? []).map((path) => signedUrlMap.get(path)).filter((url): url is string => Boolean(url)),
    frontProgressPhotoUrl: measurement.front_progress_photo_path ? signedUrlMap.get(measurement.front_progress_photo_path) ?? null : null,
    sideProgressPhotoUrl: measurement.side_progress_photo_path ? signedUrlMap.get(measurement.side_progress_photo_path) ?? null : null,
  })) as T[];
}
import { supabase } from '@/integrations/supabase/client';
import type { MemberMeasurementRecord } from './types';

const PHOTO_BUCKET = 'member-photos';
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function uniquePaths(paths: Array<string | null | undefined>) {
  return Array.from(new Set(paths.filter((path): path is string => Boolean(path))));
}

export async function hydrateMeasurementPhotoUrls<T extends MemberMeasurementRecord>(measurements: T[]) {
  if (!measurements.length) return measurements;

  const paths = uniquePaths(
    measurements.flatMap((measurement) => [
      ...(Array.isArray(measurement.photos) ? measurement.photos : []),
      measurement.front_progress_photo_path,
      measurement.side_progress_photo_path,
    ]),
  );

  if (!paths.length) {
    return measurements.map((measurement) => ({
      ...measurement,
      signedPhotoUrls: [],
      frontProgressPhotoUrl: null,
      sideProgressPhotoUrl: null,
    }));
  }

  const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;

  const signedUrlMap = new Map(data.map((item) => [item.path, item.signedUrl]));

  return measurements.map((measurement) => ({
    ...measurement,
    signedPhotoUrls: (measurement.photos ?? []).map((path) => signedUrlMap.get(path)).filter((url): url is string => Boolean(url)),
    frontProgressPhotoUrl: measurement.front_progress_photo_path ? signedUrlMap.get(measurement.front_progress_photo_path) ?? null : null,
    sideProgressPhotoUrl: measurement.side_progress_photo_path ? signedUrlMap.get(measurement.side_progress_photo_path) ?? null : null,
  }));
}
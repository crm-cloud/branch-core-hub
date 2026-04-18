import { supabase } from '@/integrations/supabase/client';

export const WORKOUT_VIDEO_BUCKET = 'workout-videos';
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // 50 MB
export const ALLOWED_VIDEO_MIME = [
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-m4v',
];
export const ACCEPTED_VIDEO_EXT = '.mp4,.mov,.webm,.m4v';

export interface UploadResult {
  path: string;
  publicUrl: string;
}

function safeName(original: string) {
  const dot = original.lastIndexOf('.');
  const ext = dot >= 0 ? original.slice(dot).toLowerCase() : '';
  const base = (dot >= 0 ? original.slice(0, dot) : original)
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'video';
  return `${base}-${Date.now()}${ext}`;
}

export function validateVideoFile(file: File): string | null {
  if (file.size > MAX_VIDEO_BYTES) {
    return `File is ${Math.round(file.size / 1024 / 1024)}MB. Limit is 50MB.`;
  }
  if (file.type && !ALLOWED_VIDEO_MIME.includes(file.type)) {
    return `Unsupported type "${file.type}". Use MP4, MOV, or WebM.`;
  }
  return null;
}

/**
 * Upload a video file to the workout-videos bucket.
 * @param file file to upload
 * @param folder logical sub-folder, e.g. 'exercises' or 'meals'
 */
export async function uploadVideo(
  file: File,
  folder: 'exercises' | 'meals' | string,
): Promise<UploadResult> {
  const validation = validateVideoFile(file);
  if (validation) throw new Error(validation);

  const path = `${folder}/${safeName(file.name)}`;
  const { error } = await supabase.storage
    .from(WORKOUT_VIDEO_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });
  if (error) throw error;

  const { data } = supabase.storage.from(WORKOUT_VIDEO_BUCKET).getPublicUrl(path);
  return { path, publicUrl: data.publicUrl };
}

export function getVideoPublicUrl(path: string): string {
  return supabase.storage.from(WORKOUT_VIDEO_BUCKET).getPublicUrl(path).data.publicUrl;
}

export async function deleteVideo(path: string): Promise<void> {
  const { error } = await supabase.storage.from(WORKOUT_VIDEO_BUCKET).remove([path]);
  if (error) throw error;
}

const URL_REGEX =
  /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|vimeo\.com|player\.vimeo\.com|.*\.mp4|.*\.webm|.*\.mov)/i;

export function isAcceptedVideoUrl(url: string): boolean {
  if (!url) return false;
  try {
    new URL(url);
  } catch {
    return false;
  }
  return URL_REGEX.test(url);
}

import { supabase } from '@/integrations/supabase/client';

const BIOMETRIC_BUCKET = 'member-photos';
// 1 hour — matches the standard private-asset TTL used elsewhere.
const SIGNED_URL_TTL_SECONDS = 60 * 60;

/**
 * Resolve a signed URL for a private biometric photo path.
 * Returns null if the path is empty/falsy or the storage call fails.
 *
 * Storage layout (private bucket `member-photos`):
 *   biometric/members/{memberId}.jpg
 *   biometric/employees/{employeeId}.jpg
 *   biometric/trainers/{trainerId}.jpg
 */
export async function resolveBiometricPhotoUrl(
  path: string | null | undefined,
): Promise<string | null> {
  if (!path) return null;
  const { data, error } = await supabase.storage
    .from(BIOMETRIC_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

export interface BiometricUploadResult {
  /** Storage path (persist on member/employee/trainer.biometric_photo_path) */
  path: string;
  /** Fresh signed URL — valid for SIGNED_URL_TTL_SECONDS */
  signedUrl: string;
}

/**
 * Upload a (compressed) biometric photo to the private bucket and return
 * both the storage path and a fresh signed URL.
 */
export async function uploadBiometricPhoto(
  entityType: 'members' | 'employees' | 'trainers',
  entityId: string,
  file: File | Blob,
): Promise<BiometricUploadResult> {
  const path = `biometric/${entityType}/${entityId}.jpg`;
  const { error: uploadError } = await supabase.storage
    .from(BIOMETRIC_BUCKET)
    .upload(path, file, { upsert: true, contentType: 'image/jpeg' });
  if (uploadError) throw uploadError;

  const signed = await resolveBiometricPhotoUrl(path);
  if (!signed) throw new Error('Failed to sign biometric photo URL');
  return { path, signedUrl: signed };
}

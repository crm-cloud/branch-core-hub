import { supabase } from '@/integrations/supabase/client';

/**
 * Upload a generated PDF/image blob to the public `attachments` bucket and
 * return the public URL. Used so WhatsApp `media_url` and email links can
 * reference real files instead of plain text.
 *
 * The bucket is configured public-read with authenticated-write policies, so
 * the resulting URL can be opened by recipients without auth.
 */
export async function uploadAttachment(
  blob: Blob,
  opts: { folder?: string; filename: string; contentType?: string },
): Promise<{ url: string; path: string }> {
  const folder = (opts.folder || 'misc').replace(/^\/+|\/+$/g, '');
  const safeName = opts.filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `${folder}/${Date.now()}-${safeName}`;

  const { error } = await supabase.storage
    .from('attachments')
    .upload(path, blob, {
      contentType: opts.contentType || blob.type || 'application/octet-stream',
      upsert: false,
      cacheControl: '3600',
    });
  if (error) throw error;

  const { data } = supabase.storage.from('attachments').getPublicUrl(path);
  return { url: data.publicUrl, path };
}

/**
 * Convert a Blob to a base64 string (no data URL prefix) for email
 * attachment payloads understood by the send-email edge function.
 */
export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let binary = '';
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

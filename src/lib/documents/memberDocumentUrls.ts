import { supabase } from '@/integrations/supabase/client';

const DOCUMENT_BUCKET = 'documents';
const SIGNED_URL_TTL_SECONDS = 60 * 30;

export interface MemberDocumentLike {
  id: string;
  storage_path?: string | null;
  file_url?: string | null;
  file_name?: string | null;
}

function normalizeSignedUrl(url: string) {
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const base = (import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
  return `${base}${url.startsWith('/') ? url : `/${url}`}`;
}

export async function resolveMemberDocumentUrl(document: MemberDocumentLike) {
  if (document.storage_path) {
    const { data, error } = await supabase.storage
      .from(DOCUMENT_BUCKET)
      .createSignedUrl(document.storage_path, SIGNED_URL_TTL_SECONDS);

    if (!error && data?.signedUrl) {
      return normalizeSignedUrl(data.signedUrl);
    }

    const { data: rpcData, error: rpcError } = await supabase.rpc('resolve_member_document_url', {
      p_document_id: document.id,
      p_expires_in: SIGNED_URL_TTL_SECONDS,
    });

    if (!rpcError && rpcData) {
      return normalizeSignedUrl(String(rpcData));
    }
  }

  if (document.file_url) return document.file_url;
  throw new Error(`Document link unavailable${document.file_name ? ` for ${document.file_name}` : ''}`);
}

export async function openMemberDocument(document: MemberDocumentLike) {
  const url = await resolveMemberDocumentUrl(document);
  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function downloadMemberDocument(document: MemberDocumentLike) {
  const url = await resolveMemberDocumentUrl(document);
  const link = window.document.createElement('a');
  link.href = url;
  if (document.file_name) link.download = document.file_name;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.click();
}
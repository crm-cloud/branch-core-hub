// v1.0.0 — Single source of truth for Meta Graph API version.
// Bump in ONE place when Meta releases a new stable version.
//
// Usage from any edge function:
//   import { META_GRAPH_VERSION, META_API_BASE, metaUrl } from "../_shared/meta-config.ts";
//   await fetch(metaUrl(`/${pageId}/messages`), { ... });

export const META_GRAPH_VERSION = "v25.0";
export const META_API_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

export function metaUrl(path: string): string {
  if (!path.startsWith("/")) path = "/" + path;
  return `${META_API_BASE}${path}`;
}

/**
 * Compute the appsecret_proof query parameter required by Meta when an
 * app_secret is configured for the integration. Returns "" when no app
 * secret is provided (caller may then omit the parameter entirely).
 */
export async function computeAppSecretProof(
  accessToken: string,
  appSecret: string | null | undefined,
): Promise<string> {
  if (!appSecret) return "";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(accessToken));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Append `appsecret_proof=...` to a Meta Graph URL when proof is non-empty. */
export function appendAppSecretProof(url: string, proof: string): string {
  if (!proof) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}appsecret_proof=${proof}`;
}

/**
 * Verify Meta's X-Hub-Signature-256 header against the raw request body
 * using HMAC-SHA256 with the app secret. Constant-time comparison.
 */
export async function verifyXHubSignature(
  rawBody: string,
  signatureHeader: string | null,
  appSecret: string,
): Promise<boolean> {
  if (!signatureHeader || !appSecret) return false;
  const expectedPrefix = "sha256=";
  if (!signatureHeader.startsWith(expectedPrefix)) return false;
  const provided = signatureHeader.slice(expectedPrefix.length).toLowerCase();

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(rawBody));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  if (computed.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ provided.charCodeAt(i);
  }
  return diff === 0;
}

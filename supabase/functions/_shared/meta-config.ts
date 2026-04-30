// v2.0.0 — Phase G: unified to v25.0 across BOTH Meta hosts.
// Adds smart fallback for graph.instagram.com which historically lags graph.facebook.com.
//
// Single source of truth for Meta Graph API version.
// Bump in ONE place when Meta releases a new stable version.
//
// Usage from any edge function:
//   import { META_GRAPH_VERSION, META_API_BASE, metaUrl, metaFetchWithFallback } from "../_shared/meta-config.ts";

export const META_GRAPH_VERSION = "v25.0";
export const META_API_BASE = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

// Instagram Login API (token prefix `IGAA…`) lives on a separate host:
// https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login
//
// We aim for v25.0 (latest) but Meta sometimes lags this host by 1-2 versions.
// `metaFetchWithFallback` will transparently retry with IG_FALLBACK_VERSION
// when Meta returns "Unsupported get/post request" on the IG host.
export const IG_GRAPH_VERSION = "v25.0";
export const IG_FALLBACK_VERSION = "v23.0"; // last known-good version on graph.instagram.com
export const IG_API_BASE = `https://graph.instagram.com/${IG_GRAPH_VERSION}`;
export const IG_API_BASE_FALLBACK = `https://graph.instagram.com/${IG_FALLBACK_VERSION}`;

const FB_HOST = "graph.facebook.com";
const IG_HOST = "graph.instagram.com";

/**
 * Meta issues two visually-different access-token formats:
 *   - `EAA…`  → Facebook Login / Page Access Token → host graph.facebook.com
 *   - `IGAA…` → Instagram Login (Instagram Business Login) → host graph.instagram.com
 * This helper returns the matching base URL + a flag so callers can adapt.
 */
export function detectMetaHost(accessToken: string | null | undefined): {
  base: string;
  isInstagramLogin: boolean;
} {
  const tok = (accessToken || "").trim();
  if (tok.startsWith("IGAA")) {
    return { base: IG_API_BASE, isInstagramLogin: true };
  }
  return { base: META_API_BASE, isInstagramLogin: false };
}

export function metaUrl(path: string): string {
  if (!path.startsWith("/")) path = "/" + path;
  return `${META_API_BASE}${path}`;
}

/**
 * Fetch wrapper that auto-retries with IG_FALLBACK_VERSION when Meta returns
 * "Unsupported get/post request" (error code 2635 or HTTP 400 mentioning "version")
 * on the graph.instagram.com host. Pass-through for graph.facebook.com.
 */
export async function metaFetchWithFallback(
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const resp = await fetch(url, init);
  if (resp.ok) return resp;

  // Only retry on the IG host; FB host is always on the latest version.
  if (!url.includes(IG_HOST) || !url.includes(`/${IG_GRAPH_VERSION}/`)) return resp;

  // Inspect error body without consuming it (clone first).
  let body: any = {};
  try {
    body = await resp.clone().json();
  } catch {
    return resp;
  }

  const code = body?.error?.code;
  const msg = String(body?.error?.message || "").toLowerCase();
  const versionRelated =
    code === 2635 || (resp.status === 400 && (msg.includes("version") || msg.includes("unsupported")));

  if (!versionRelated) return resp;

  const fallbackUrl = url.replace(`/${IG_GRAPH_VERSION}/`, `/${IG_FALLBACK_VERSION}/`);
  console.warn(
    `[meta-config] IG host rejected ${IG_GRAPH_VERSION}, retrying with ${IG_FALLBACK_VERSION}: ${fallbackUrl}`,
  );
  return fetch(fallbackUrl, init);
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

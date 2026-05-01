/**
 * Runtime environment helpers for DR awareness.
 * VITE_APP_ENV is set at build time per host:
 *   - 'primary' for the Lovable-hosted production frontend
 *   - 'dr'      for the Vercel/Cloudflare DR mirror
 */
export type RuntimeEnv = "primary" | "dr";

export function getRuntimeEnv(): RuntimeEnv {
  const v = (import.meta.env.VITE_APP_ENV as string | undefined)?.toLowerCase();
  return v === "dr" ? "dr" : "primary";
}

export function getBuildSha(): string {
  return (import.meta.env.VITE_BUILD_SHA as string | undefined) ?? "dev";
}

export function isDrHost(): boolean {
  return getRuntimeEnv() === "dr";
}

/**
 * Vite plugin that emits two static files at build time used for DR:
 *   /healthz.json  — minimal liveness probe served by the static host
 *   /app-config.json — remote config for the Flutter / mobile clients
 *
 * Source values come from environment variables so the same repo can
 * produce a "primary" and a "dr" build by changing VITE_APP_ENV.
 */
import type { Plugin } from "vite";

interface DrAssetsOptions {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /** 'primary' | 'dr' */
  env?: string;
  version?: string;
  supportEmail?: string;
  minAppVersion?: string;
}

export function drAssets(opts: DrAssetsOptions): Plugin {
  const env = opts.env ?? process.env.VITE_APP_ENV ?? "primary";
  const version =
    opts.version ?? process.env.VITE_BUILD_SHA ?? new Date().toISOString();
  const builtAt = new Date().toISOString();

  const healthz = {
    status: "ok",
    env,
    version,
    builtAt,
    latency_ms: 0,
  };

  const appConfig = {
    supabaseUrl: opts.supabaseUrl,
    supabaseAnonKey: opts.supabaseAnonKey,
    env,
    version,
    builtAt,
    minAppVersion: opts.minAppVersion ?? "1.0.0",
    drMode: env === "dr",
    supportEmail: opts.supportEmail ?? "support@theincline.in",
  };

  return {
    name: "dr-assets",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "healthz.json",
        source: JSON.stringify(healthz, null, 2),
      });
      this.emitFile({
        type: "asset",
        fileName: "app-config.json",
        source: JSON.stringify(appConfig, null, 2),
      });
    },
  };
}

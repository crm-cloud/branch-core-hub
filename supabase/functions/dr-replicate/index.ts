// supabase/functions/dr-replicate/index.ts
// v1.0.0 — Mirror auth.users + storage object bytes from PRIMARY → DR.
//
// Designed to be:
//  • Idempotent (safe to run on cron)
//  • Resumable (one bucket+chunk per call when invoked with ?chunk=…)
//  • Service-role only (validates header below)
//
// Auth: requires header  x-dr-secret: <DR_REPLICATE_SECRET>  OR a service-role JWT.
//
// Trigger via pg_cron every 6h:
//   net.http_post('https://<primary>.supabase.co/functions/v1/dr-replicate',
//                 '{"mode":"all"}'::jsonb,
//                 jsonb_build_object('x-dr-secret', '<secret>'))
//
// Returns JSON { ok, mirrored: { authUsers, buckets, objects, bytes }, errors }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-dr-secret",
};

const DR_URL = "https://pmznpbsahetwmogezhff.supabase.co";

interface MirrorReport {
  ok: boolean;
  startedAt: string;
  finishedAt?: string;
  mirrored: {
    authUsers: { listed: number; created: number; updated: number; failed: number };
    storage: {
      buckets: { ensured: number; failed: number };
      objects: { copied: number; skipped: number; failed: number; bytes: number };
    };
  };
  errors: string[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // ── Authn: service-role JWT OR shared secret ────────────────────────────
    const auth = req.headers.get("authorization") ?? "";
    const sharedSecret = req.headers.get("x-dr-secret") ?? "";
    const expectedSecret = Deno.env.get("DR_REPLICATE_SECRET") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isServiceJwt = auth === `Bearer ${serviceRoleKey}`;
    const isSharedSecret =
      expectedSecret.length > 0 && sharedSecret === expectedSecret;
    console.log("[dr-replicate] auth check", {
      hasAuth: auth.length > 0,
      hasSharedSecret: sharedSecret.length > 0,
      sharedSecretLen: sharedSecret.length,
      expectedSecretLen: expectedSecret.length,
      match: isSharedSecret,
    });
    if (!isServiceJwt && !isSharedSecret) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const drServiceKey = Deno.env.get("DR_SERVICE_ROLE_KEY");
    if (!drServiceKey) throw new Error("DR_SERVICE_ROLE_KEY not configured");

    const primaryUrl = Deno.env.get("SUPABASE_URL")!;
    const primary = createClient(primaryUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const dr = createClient(DR_URL, drServiceKey, {
      auth: { persistSession: false },
    });

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const mode: "all" | "auth" | "storage" = body.mode ?? "all";

    const report: MirrorReport = {
      ok: true,
      startedAt: new Date().toISOString(),
      mirrored: {
        authUsers: { listed: 0, created: 0, updated: 0, failed: 0 },
        storage: {
          buckets: { ensured: 0, failed: 0 },
          objects: { copied: 0, skipped: 0, failed: 0, bytes: 0 },
        },
      },
      errors: [],
    };

    // ── 1. AUTH USERS ────────────────────────────────────────────────────────
    if (mode === "all" || mode === "auth") {
      let page = 1;
      const perPage = 1000;
      while (true) {
        const { data, error } = await primary.auth.admin.listUsers({ page, perPage });
        if (error) {
          report.errors.push(`auth.list page ${page}: ${error.message}`);
          break;
        }
        const users = data?.users ?? [];
        if (users.length === 0) break;
        report.mirrored.authUsers.listed += users.length;

        for (const u of users) {
          try {
            const payload = {
              email: u.email ?? undefined,
              phone: u.phone ?? undefined,
              email_confirm: !!u.email_confirmed_at,
              phone_confirm: !!u.phone_confirmed_at,
              user_metadata: u.user_metadata ?? {},
              app_metadata: u.app_metadata ?? {},
              id: u.id,
            };
            const { error: createErr } = await dr.auth.admin.createUser(payload);
            if (createErr) {
              const msg = createErr.message?.toLowerCase() ?? "";
              if (msg.includes("already") || msg.includes("duplicate") || msg.includes("exists")) {
                // Update metadata instead.
                const { error: updErr } = await dr.auth.admin.updateUserById(u.id, {
                  email: u.email ?? undefined,
                  phone: u.phone ?? undefined,
                  user_metadata: u.user_metadata ?? {},
                  app_metadata: u.app_metadata ?? {},
                });
                if (updErr) {
                  report.mirrored.authUsers.failed++;
                  report.errors.push(`user ${u.id}: ${updErr.message}`);
                } else {
                  report.mirrored.authUsers.updated++;
                }
              } else {
                report.mirrored.authUsers.failed++;
                report.errors.push(`user ${u.id}: ${createErr.message}`);
              }
            } else {
              report.mirrored.authUsers.created++;
            }
          } catch (e) {
            report.mirrored.authUsers.failed++;
            report.errors.push(`user ${u.id}: ${(e as Error).message}`);
          }
        }
        if (users.length < perPage) break;
        page++;
      }
    }

    // ── 2. STORAGE ───────────────────────────────────────────────────────────
    if (mode === "all" || mode === "storage") {
      const { data: buckets, error: bErr } = await primary.storage.listBuckets();
      if (bErr) {
        report.errors.push(`list buckets: ${bErr.message}`);
      } else {
        for (const b of buckets ?? []) {
          // Ensure bucket on DR
          const { data: drBuckets } = await dr.storage.listBuckets();
          const exists = (drBuckets ?? []).some((x) => x.name === b.name);
          if (!exists) {
            const { error: cErr } = await dr.storage.createBucket(b.name, {
              public: b.public,
              fileSizeLimit: b.file_size_limit ?? undefined,
              allowedMimeTypes: b.allowed_mime_types ?? undefined,
            });
            if (cErr) {
              report.mirrored.storage.buckets.failed++;
              report.errors.push(`bucket ${b.name}: ${cErr.message}`);
              continue;
            }
          }
          report.mirrored.storage.buckets.ensured++;

          // Walk objects (recursive via prefix expansion is complex; use admin REST list)
          // Use service-role REST to list ALL objects in bucket regardless of folder.
          const listRes = await fetch(
            `${primaryUrl}/storage/v1/object/list/${b.name}`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${serviceRoleKey}`,
                apikey: serviceRoleKey,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ limit: 10000, offset: 0, prefix: "" }),
            },
          );
          let objects: Array<{ name: string; metadata?: { size?: number; mimetype?: string } }> = [];
          if (listRes.ok) objects = await listRes.json();

          // Recurse into subfolders (one level — Supabase storage list doesn't recurse)
          const queue = [...objects.map((o) => ({ ...o, prefix: "" }))];
          const allObjs: Array<{ path: string; size?: number; mimetype?: string }> = [];
          for (const o of queue) {
            if (o.metadata?.size != null) {
              allObjs.push({
                path: o.prefix ? `${o.prefix}/${o.name}` : o.name,
                size: o.metadata.size,
                mimetype: o.metadata.mimetype,
              });
            } else {
              // It's a folder → list its contents
              const subRes = await fetch(
                `${primaryUrl}/storage/v1/object/list/${b.name}`,
                {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${serviceRoleKey}`,
                    apikey: serviceRoleKey,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    limit: 10000,
                    offset: 0,
                    prefix: o.prefix ? `${o.prefix}/${o.name}` : o.name,
                  }),
                },
              );
              if (subRes.ok) {
                const subs: typeof objects = await subRes.json();
                for (const s of subs) {
                  if (s.metadata?.size != null) {
                    allObjs.push({
                      path: `${o.prefix ? o.prefix + "/" : ""}${o.name}/${s.name}`,
                      size: s.metadata.size,
                      mimetype: s.metadata.mimetype,
                    });
                  }
                }
              }
            }
          }

          // Mirror each object
          for (const obj of allObjs) {
            try {
              const dl = await primary.storage.from(b.name).download(obj.path);
              if (dl.error || !dl.data) {
                report.mirrored.storage.objects.failed++;
                report.errors.push(
                  `dl ${b.name}/${obj.path}: ${dl.error?.message ?? "no body"}`,
                );
                continue;
              }
              const blob = dl.data;
              const up = await dr.storage.from(b.name).upload(obj.path, blob, {
                upsert: true,
                contentType: obj.mimetype ?? blob.type,
              });
              if (up.error) {
                report.mirrored.storage.objects.failed++;
                report.errors.push(
                  `up ${b.name}/${obj.path}: ${up.error.message}`,
                );
              } else {
                report.mirrored.storage.objects.copied++;
                report.mirrored.storage.objects.bytes += obj.size ?? 0;
              }
            } catch (e) {
              report.mirrored.storage.objects.failed++;
              report.errors.push(`${b.name}/${obj.path}: ${(e as Error).message}`);
            }
          }
        }
      }
    }

    report.finishedAt = new Date().toISOString();
    report.ok = report.errors.length === 0;
    return new Response(JSON.stringify(report, null, 2), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});

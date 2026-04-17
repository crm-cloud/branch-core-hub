// v1.0.0 — Server-side image fetcher: download URL → upload to product-images bucket → return public URL
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ALLOWED = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif"];

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const url = Deno.env.get("SUPABASE_URL")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const { data: { user } } = await authClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const { imageUrl, bucket = "product-images" } = await req.json();
    if (!imageUrl || typeof imageUrl !== "string") return json({ error: "imageUrl is required" }, 400);

    let parsed: URL;
    try { parsed = new URL(imageUrl); } catch { return json({ error: "Invalid URL" }, 400); }
    if (!["http:", "https:"].includes(parsed.protocol)) return json({ error: "Only http/https URLs allowed" }, 400);

    // Fetch with size cap
    const resp = await fetch(imageUrl, { redirect: "follow" });
    if (!resp.ok) return json({ error: `Fetch failed: ${resp.status} ${resp.statusText}` }, 400);

    const ct = (resp.headers.get("content-type") || "").toLowerCase().split(";")[0].trim();
    if (!ALLOWED.includes(ct)) {
      return json({ error: `Unsupported content type: ${ct || "unknown"}. Allowed: JPEG, PNG, WebP, GIF` }, 400);
    }

    const buf = await resp.arrayBuffer();
    if (buf.byteLength > 10 * 1024 * 1024) return json({ error: "Image too large (max 10 MB)" }, 400);

    const ext = ct.split("/")[1].replace("jpeg", "jpg");
    const filename = `${crypto.randomUUID()}.${ext}`;

    const admin = createClient(url, svcKey);
    const { error: upErr } = await admin.storage.from(bucket).upload(filename, buf, {
      contentType: ct,
      upsert: false,
    });
    if (upErr) return json({ error: `Upload failed: ${upErr.message}` }, 500);

    const { data: pub } = admin.storage.from(bucket).getPublicUrl(filename);
    return json({ success: true, url: pub.publicUrl, path: filename, contentType: ct, bytes: buf.byteLength });
  } catch (e: any) {
    console.error("fetch-image-url error:", e);
    return json({ error: e.message || "Unknown error" }, 500);
  }
});

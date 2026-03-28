import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const REVOKED_DATE = "2000-01-01 00:00:00";

let cachedToken: string | null = null;
let tokenExpiry = 0;

function getBaseUrl(overrideUrl?: string): string {
  return (overrideUrl || Deno.env.get("MIPS_SERVER_URL")!).replace(/\/+$/, "");
}

async function getRuoYiToken(baseUrl?: string, username?: string, password?: string): Promise<string> {
  const url = baseUrl || getBaseUrl();
  const user = username || Deno.env.get("MIPS_USERNAME")!;
  const pass = password || Deno.env.get("MIPS_PASSWORD")!;
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;
  const res = await fetch(`${url}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "TENANT-ID": "1" },
    body: JSON.stringify({ username: user, password: pass }),
  });
  const json = await res.json();
  if (json.code !== 200 && json.code !== 0) throw new Error(`Login failed: ${json.msg}`);
  cachedToken = json.token || json.data?.token;
  if (!cachedToken) throw new Error("No token in login response");
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return cachedToken!;
}

function authHeaders(token: string): Record<string, string> {
  return {
    "Authorization": `Bearer ${token}`,
    "TENANT-ID": "1",
    "Content-Type": "application/json",
    "Accept": "application/json",
  };
}

async function lookupPerson(baseUrl: string, token: string, personSn: string): Promise<any | null> {
  const res = await fetch(`${baseUrl}/personInfo/person/list?personSn=${personSn}&pageNum=1&pageSize=5`, {
    method: "GET",
    headers: authHeaders(token),
  });
  const json = await res.json();
  const rows = json?.rows || json?.data;
  if (!Array.isArray(rows)) return null;
  return rows.find((r: any) => r.personSn === personSn) || null;
}

async function dispatchToDevices(baseUrl: string, token: string, personId: number, supabase: any, branchId?: string) {
  let deviceIds: number[] = [];
  try {
    let query = supabase.from("access_devices").select("mips_device_id").eq("is_online", true);
    if (branchId) query = query.eq("branch_id", branchId);
    const { data: devices } = await query;
    if (devices?.length) {
      deviceIds = devices.map((d: any) => d.mips_device_id).filter((id: any) => id && !isNaN(Number(id)));
    }
  } catch {}

  if (deviceIds.length === 0) {
    try {
      const res = await fetch(`${baseUrl}/through/device/list`, { method: "GET", headers: authHeaders(token) });
      const json = await res.json();
      const rows = json?.rows || json?.data;
      if (Array.isArray(rows)) {
        deviceIds = rows.filter((d: any) => d.onlineFlag === 1 || d.status === 1).map((d: any) => d.id).filter((id: any) => !isNaN(Number(id)));
      }
    } catch {}
  }

  if (deviceIds.length === 0) return;

  await fetch(`${baseUrl}/through/device/syncPerson`, {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({ personId, deviceIds, deviceNumType: "4" }),
  });
}

function formatDate(dateStr: string | null, fallback: string): string {
  if (!dateStr) return fallback;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return fallback;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    const { member_id, action, reason, branch_id } = body as {
      member_id: string;
      action: "revoke" | "restore";
      reason?: string;
      branch_id?: string;
    };

    if (!member_id || !action) {
      return new Response(JSON.stringify({ error: "Missing member_id or action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get member data
    const { data: member, error: memberError } = await supabase
      .from("members")
      .select("id, member_code, mips_person_id, mips_person_sn, branch_id, biometric_photo_url")
      .eq("id", member_id)
      .maybeSingle();

    if (memberError || !member) {
      return new Response(JSON.stringify({ error: "Member not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const effectiveBranchId = branch_id || member.branch_id;
    const personSn = member.mips_person_sn || member.member_code?.replace(/-/g, "");

    if (!personSn) {
      return new Response(JSON.stringify({ error: "Member has no MIPS sync identifier", success: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get MIPS connection for branch
    let mipsBaseUrl: string | undefined;
    let mipsUsername: string | undefined;
    let mipsPassword: string | undefined;
    if (effectiveBranchId) {
      const { data: conn } = await supabase
        .from("mips_connections")
        .select("server_url, username, password")
        .eq("branch_id", effectiveBranchId)
        .eq("is_active", true)
        .maybeSingle();
      if (conn) {
        mipsBaseUrl = conn.server_url;
        mipsUsername = conn.username;
        mipsPassword = conn.password;
      }
    }

    const baseUrl = getBaseUrl(mipsBaseUrl);
    const token = await getRuoYiToken(mipsBaseUrl, mipsUsername, mipsPassword);

    // Find the person in MIPS
    const existing = await lookupPerson(baseUrl, token, personSn);
    if (!existing) {
      console.log(`Person ${personSn} not found in MIPS — nothing to ${action}`);
      await supabase.from("members").update({ hardware_access_status: action === "revoke" ? "revoked" : "none" }).eq("id", member_id);
      return new Response(JSON.stringify({
        success: true,
        message: `Person not found in MIPS, status updated locally`,
        action,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine new validTimeEnd
    let newValidTimeEnd = REVOKED_DATE;
    if (action === "restore") {
      // Get active membership dates
      const { data: membership } = await supabase
        .from("memberships")
        .select("start_date, end_date")
        .eq("member_id", member_id)
        .eq("status", "active")
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (membership) {
        newValidTimeEnd = formatDate(membership.end_date + "T23:59:59", "2099-12-31 23:59:59");
      } else {
        newValidTimeEnd = "2099-12-31 23:59:59";
      }
    }

    // Update the person in MIPS with new validTimeEnd
    const updatedPerson = { ...existing, validTimeEnd: newValidTimeEnd };
    console.log(`${action} access for ${personSn}: validTimeEnd → ${newValidTimeEnd}`);

    const putRes = await fetch(`${baseUrl}/personInfo/person`, {
      method: "PUT",
      headers: authHeaders(token),
      body: JSON.stringify(updatedPerson),
    });
    const putJson = await putRes.json();
    const putSuccess = putJson.code === 200 || putJson.code === 0;

    if (!putSuccess) {
      console.error(`MIPS PUT failed: ${JSON.stringify(putJson)}`);
      return new Response(JSON.stringify({ success: false, error: putJson.msg || "MIPS update failed", mips_response: putJson }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dispatch updated person to devices so hardware syncs immediately
    try {
      await dispatchToDevices(baseUrl, token, existing.personId, supabase, effectiveBranchId);
      console.log(`Dispatched ${action} to devices for personId=${existing.personId}`);
    } catch (e) {
      console.warn("Device dispatch failed (non-fatal):", e);
    }

    // Update CRM status
    const newStatus = action === "revoke" ? "revoked" : "active";
    await supabase.from("members").update({ hardware_access_status: newStatus }).eq("id", member_id);

    // Log to access_logs
    await supabase.from("access_logs").insert({
      device_sn: "CRM-SYSTEM",
      event_type: `hardware_${action}`,
      result: action === "revoke" ? "member_denied" : "member",
      message: `Hardware access ${action}d: ${reason || action}. validTimeEnd=${newValidTimeEnd}`,
      member_id: member_id,
      branch_id: effectiveBranchId,
    });

    return new Response(JSON.stringify({
      success: true,
      action,
      new_valid_time_end: newValidTimeEnd,
      mips_person_id: existing.personId,
      message: `Hardware access ${action}d successfully`,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("revoke-mips-access error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

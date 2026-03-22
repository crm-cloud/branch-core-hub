// @ts-nocheck
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const toText = (value: unknown): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const normalizeSn = (value: string | null): string | null => {
  if (!value) return null;
  return value.trim().toUpperCase();
};

const readSn = (body: Record<string, unknown>): string | null => {
  return normalizeSn(
    toText(body.device_sn) ||
      toText(body.deviceSn) ||
      toText(body.sn) ||
      toText(body.serial_number) ||
      toText(body.serialNumber) ||
      toText(body.deviceKey) ||
      toText(body.device_key),
  );
};

const readIdentifier = (body: Record<string, unknown>): string | null => {
  return (
    toText(body.personId) ||
    toText(body.person_id) ||
    toText(body.customId) ||
    toText(body.custom_id) ||
    toText(body.person_uuid) ||
    toText(body.uid) ||
    toText(body.pin)
  );
};

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  const raw = await req.text();

  if (raw.startsWith("{") || raw.startsWith("[")) {
    try { return JSON.parse(raw); } catch { /* fall through */ }
  }

  if (ct.includes("form") || raw.includes("=")) {
    const params = new URLSearchParams(raw);
    const obj: Record<string, string> = {};
    for (const [k, v] of params.entries()) obj[k] = v;
    const url = new URL(req.url);
    for (const [k, v] of url.searchParams.entries()) {
      if (!obj[k]) obj[k] = v;
    }
    return obj;
  }

  try { return JSON.parse(raw); } catch { return {}; }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST" && req.method !== "GET") {
    return new Response(JSON.stringify({ code: 1, msg: "method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    let body: Record<string, unknown> = {};
    if (req.method === "POST") {
      body = await parseBody(req);
    }
    const url = new URL(req.url);
    for (const [k, v] of url.searchParams.entries()) {
      if (!body[k]) body[k] = v;
    }

    const action = (toText(body.action) || toText(body.mode) || "pull_members").toLowerCase();
    const deviceSn = readSn(body);
    const personIdentifier = readIdentifier(body);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const nowIso = new Date().toISOString();
    let device: { id: string; branch_id: string | null } | null = null;
    let accessDevice: { id: string; branch_id: string | null } | null = null;

    if (deviceSn) {
      const { data } = await supabase
        .from("hardware_devices")
        .upsert(
          {
            device_sn: deviceSn,
            device_key: toText(body.deviceKey) || toText(body.device_key),
            ip_address:
              toText(body.ip) ||
              toText(body.ip_address) ||
              toText(body.ipAddress) ||
              req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
              req.headers.get("x-real-ip") ||
              null,
            last_online: nowIso,
            last_payload: body,
            updated_at: nowIso,
          },
          { onConflict: "device_sn" },
        )
        .select("id, branch_id")
        .single();

      device = data || null;

      const { data: linkedAccessDevice } = await supabase
        .from("access_devices")
        .select("id, branch_id")
        .eq("serial_number", deviceSn)
        .maybeSingle();

      accessDevice = linkedAccessDevice || null;

      if (accessDevice?.branch_id && !device?.branch_id) {
        await supabase
          .from("hardware_devices")
          .update({ branch_id: accessDevice.branch_id, updated_at: nowIso })
          .eq("id", device.id);
        device.branch_id = accessDevice.branch_id;
      }
    }

    const branchId =
      toText(body.branch_id) || toText(body.branchId) || device?.branch_id || accessDevice?.branch_id || null;

    let branchName: string | null = null;
    if (branchId) {
      const { data: branch } = await supabase
        .from("branches")
        .select("name")
        .eq("id", branchId)
        .maybeSingle();

      branchName = branch?.name || null;
    }

    // Roster pull includes members, staff, and trainers.
    if (["pull", "pull_members", "sync", "roster", "get_roster"].includes(action)) {
      if (!branchId) {
        return new Response(JSON.stringify({ code: 0, msg: "success", members: [] }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const roster: any[] = [];

      // 1) MEMBERS — include ALL with hardware_access_enabled, photo or not
      const { data: members } = await supabase
        .from("members")
        .select("id, user_id, member_code, wiegand_code, biometric_photo_url, updated_at")
        .eq("branch_id", branchId)
        .eq("status", "active")
        .eq("hardware_access_enabled", true)
        .limit(2000);

      const memberIds = (members || []).map((member) => member.id);
      const membershipInfoMap: Record<string, { endDate: string | null; status: string | null }> = {};

      if (memberIds.length > 0) {
        const { data: memberships } = await supabase
          .from("memberships")
          .select("member_id, end_date, status")
          .in("member_id", memberIds)
          .order("end_date", { ascending: false });

        for (const membership of memberships || []) {
          if (!(membership.member_id in membershipInfoMap)) {
            membershipInfoMap[membership.member_id] = {
              endDate: membership.end_date || null,
              status: membership.status || null,
            };
          }
        }
      }

      const memberUserIds = (members || []).map((m) => m.user_id).filter(Boolean);
      let profileMap: Record<string, string> = {};
      if (memberUserIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", memberUserIds);
        profileMap = (profiles || []).reduce((acc: Record<string, string>, p) => {
          acc[p.id] = p.full_name || "Member";
          return acc;
        }, {});
      }

      for (const member of (members || [])) {
        const personName = profileMap[member.user_id] || "Member";
        const imageUrl = member.biometric_photo_url || null;
        const idCode = member.member_code || member.wiegand_code || member.id;
        const membershipInfo = membershipInfoMap[member.id] || { endDate: null, status: null };
        const expiryDate = membershipInfo.endDate;
        const membershipStatus = membershipInfo.status;

        roster.push({
          personId: member.id,
          personUUID: member.id,
          memberId: member.id,
          customId: idCode,
          memberCode: member.member_code || null,
          wiegandCode: member.wiegand_code || null,
          uid: idCode,
          pin: idCode,
          name: personName,
          personName,
          memberName: personName,
          imageUrl,
          photoUrl: imageUrl,
          hasPhoto: !!imageUrl,
          branchId,
          branchName,
          expiryDate,
          expiry_date: expiryDate,
          membershipEndDate: expiryDate,
          membershipStatus,
          role: "member",
          updatedAt: member.updated_at,
        });
      }

      // 2) STAFF (employees)
      const { data: employees } = await supabase
        .from("employees")
        .select("id, user_id, employee_code, biometric_photo_url")
        .eq("branch_id", branchId)
        .eq("is_active", true)
        .limit(500);

      const staffUserIds = (employees || []).map((e) => e.user_id).filter(Boolean);
      let staffProfileMap: Record<string, string> = {};
      if (staffUserIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", staffUserIds);
        staffProfileMap = (profiles || []).reduce((acc: Record<string, string>, p) => {
          acc[p.id] = p.full_name || "Staff";
          return acc;
        }, {});
      }

      for (const emp of (employees || [])) {
        const personName = staffProfileMap[emp.user_id] || "Staff";
        const imageUrl = emp.biometric_photo_url || null;
        roster.push({
          personId: emp.user_id || emp.id,
          personUUID: emp.user_id || emp.id,
          customId: emp.employee_code || emp.id,
          name: personName,
          personName,
          imageUrl,
          photoUrl: imageUrl,
          hasPhoto: !!imageUrl,
          branchId,
          branchName,
          expiryDate: null, // staff don't expire
          role: "staff",
        });
      }

      // 3) TRAINERS
      const { data: trainers } = await supabase
        .from("trainers")
        .select("id, user_id")
        .eq("branch_id", branchId)
        .eq("is_active", true)
        .limit(200);

      const trainerUserIds = (trainers || []).map((t) => t.user_id).filter(Boolean);
      // Avoid re-adding staff who are also trainers
      const alreadyAdded = new Set(roster.map((r) => r.personId));
      let trainerProfileMap: Record<string, { name: string; avatar: string | null }> = {};
      if (trainerUserIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", trainerUserIds);
        trainerProfileMap = (profiles || []).reduce((acc: Record<string, { name: string; avatar: string | null }>, p) => {
          acc[p.id] = { name: p.full_name || "Trainer", avatar: p.avatar_url || null };
          return acc;
        }, {});
      }

      for (const trainer of (trainers || [])) {
        const pid = trainer.user_id || trainer.id;
        if (alreadyAdded.has(pid)) continue;
        const info = trainerProfileMap[trainer.user_id] || { name: "Trainer", avatar: null };
        roster.push({
          personId: pid,
          personUUID: pid,
          customId: trainer.id,
          name: info.name,
          personName: info.name,
          imageUrl: info.avatar,
          photoUrl: info.avatar,
          hasPhoto: !!info.avatar,
          branchId,
          branchName,
          expiryDate: null,
          role: "trainer",
        });
      }

      if (accessDevice?.id) {
        await supabase.from("access_devices").update({ last_sync: nowIso }).eq("id", accessDevice.id);
      }

      return new Response(JSON.stringify({
        code: 0,
        msg: "success",
        branchId,
        branchName,
        total: roster.length,
        members: roster,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ──────────────────────────────────────────────
    // FACE REGISTRATION CALLBACK
    // ──────────────────────────────────────────────
    if (["register", "register_face", "enroll", "upload"].includes(action)) {
      const imageUrl = toText(body.imageUrl) || toText(body.photo_url);

      if (personIdentifier && imageUrl) {
        const lookupQueries = [
          supabase.from("members").select("id").eq("id", personIdentifier).maybeSingle(),
          supabase.from("members").select("id").eq("member_code", personIdentifier).maybeSingle(),
          supabase.from("members").select("id").eq("wiegand_code", personIdentifier).maybeSingle(),
          supabase.from("members").select("id").eq("user_id", personIdentifier).maybeSingle(),
        ];

        let resolvedMember: { id: string } | null = null;
        for (const query of lookupQueries) {
          const { data } = await query;
          if (data) { resolvedMember = data; break; }
        }

        if (resolvedMember) {
          await supabase
            .from("members")
            .update({ biometric_photo_url: imageUrl, biometric_enrolled: true })
            .eq("id", resolvedMember.id);
        }
      }

      await supabase.from("access_logs").insert({
        device_sn: deviceSn || "UNKNOWN",
        hardware_device_id: device?.id || null,
        branch_id: branchId,
        event_type: "register",
        result: "accepted",
        message: personIdentifier ? `Face registration received for ${personIdentifier}` : "Face registration received",
        captured_at: nowIso,
        payload: body,
      });

      return new Response(JSON.stringify({ code: 0, msg: "success" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Unknown action fallback
    await supabase.from("access_logs").insert({
      device_sn: deviceSn || "UNKNOWN",
      hardware_device_id: device?.id || null,
      branch_id: branchId,
      event_type: "register",
      result: "ignored",
      message: `Unknown action: ${action}`,
      captured_at: nowIso,
      payload: body,
    });

    return new Response(JSON.stringify({ code: 0, msg: "success" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("terminal-register error:", error);
    return new Response(JSON.stringify({ code: 0, msg: "success" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

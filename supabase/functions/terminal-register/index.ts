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

const hashToNumericId = (value: string): string => {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const numeric = (hash >>> 0) % 10000000000;
  return String(numeric).padStart(10, "0");
};

const buildTerminalCredential = (preferred: string | null, seed: string): string => {
  if (preferred && /^[0-9]{1,12}$/.test(preferred)) {
    return preferred;
  }
  return hashToNumericId(`${preferred || ""}|${seed}`);
};

async function parseBody(req: Request): Promise<Record<string, unknown>> {
  const ct = (req.headers.get("content-type") || "").toLowerCase();
  const raw = await req.text();

  if (raw.startsWith("{") || raw.startsWith("[")) {
    try {
      return JSON.parse(raw);
    } catch {
      /* fall through */
    }
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

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
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
    const debugEnabled = ["1", "true", "yes", "on"].includes((toText(body.debug) || "").toLowerCase());
    const deviceSn = readSn(body);
    const personIdentifier = readIdentifier(body);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const nowIso = new Date().toISOString();
    let device: { id: string; branch_id: string | null } | null = null;
    let accessDevice: { id: string; branch_id: string | null } | null = null;
    let targetAccessDeviceIds: string[] = [];

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
      if (accessDevice?.id) {
        targetAccessDeviceIds = [accessDevice.id];
      }

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

    // Fallback mapping: if we couldn't resolve access_device by serial, use branch devices.
    if (targetAccessDeviceIds.length === 0 && branchId) {
      const { data: branchDevices } = await supabase
        .from("access_devices")
        .select("id")
        .eq("branch_id", branchId)
        .in("device_type", ["face_terminal", "face terminal"]);

      targetAccessDeviceIds = (branchDevices || []).map((d) => d.id);
    }

    let branchName: string | null = null;
    if (branchId) {
      const { data: branch } = await supabase.from("branches").select("name").eq("id", branchId).maybeSingle();
      branchName = branch?.name || null;
    }

    // ── ROSTER PULL ──
    if (["pull", "pull_members", "sync", "roster", "get_roster"].includes(action)) {
      if (!branchId) {
        return new Response(JSON.stringify({ code: 0, msg: "success", members: [] }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const roster: any[] = [];
      let completedQueueCount = 0;

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

      // Get profiles for members — also fetch avatar_url as fallback photo
      const memberUserIds = (members || []).map((m) => m.user_id).filter(Boolean);
      let profileMap: Record<string, { name: string; avatar: string | null }> = {};
      if (memberUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", memberUserIds);
        profileMap = (profiles || []).reduce((acc: Record<string, { name: string; avatar: string | null }>, p) => {
          acc[p.id] = { name: p.full_name || "Member", avatar: p.avatar_url || null };
          return acc;
        }, {});
      }

      for (const member of members || []) {
        const profileInfo = profileMap[member.user_id] || { name: "Member", avatar: null };
        // Use biometric_photo_url first, fallback to avatar_url
        const imageUrl = member.biometric_photo_url || profileInfo.avatar || null;
        const idCode = member.member_code || member.wiegand_code || member.id;
        const terminalCredential = buildTerminalCredential(toText(idCode), `member:${member.id}`);
        const membershipInfo = membershipInfoMap[member.id] || { endDate: null, status: null };

        roster.push({
          personId: member.id,
          personUUID: member.id,
          memberId: member.id,
          customId: idCode,
          memberCode: member.member_code || null,
          wiegandCode: member.wiegand_code || null,
          uid: terminalCredential,
          pin: terminalCredential,
          name: profileInfo.name,
          personName: profileInfo.name,
          memberName: profileInfo.name,
          imageUrl,
          photoUrl: imageUrl,
          hasPhoto: !!imageUrl,
          branchId,
          branchName,
          expiryDate: membershipInfo.endDate,
          expiry_date: membershipInfo.endDate,
          membershipEndDate: membershipInfo.endDate,
          membershipStatus: membershipInfo.status,
          role: "member",
          department: "Normal User",
          updatedAt: member.updated_at,
        });
      }

      // 2) STAFF (employees) — also fetch avatar_url as fallback
      const { data: employees } = await supabase
        .from("employees")
        .select("id, user_id, employee_code, biometric_photo_url")
        .eq("branch_id", branchId)
        .eq("is_active", true)
        .limit(500);

      const staffUserIds = (employees || []).map((e) => e.user_id).filter(Boolean);
      let staffProfileMap: Record<string, { name: string; avatar: string | null }> = {};
      if (staffUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", staffUserIds);
        staffProfileMap = (profiles || []).reduce((acc: Record<string, { name: string; avatar: string | null }>, p) => {
          acc[p.id] = { name: p.full_name || "Staff", avatar: p.avatar_url || null };
          return acc;
        }, {});
      }

      for (const emp of employees || []) {
        const info = staffProfileMap[emp.user_id] || { name: "Staff", avatar: null };
        const imageUrl = emp.biometric_photo_url || info.avatar || null;
        const staffCode = emp.employee_code || emp.id;
        const terminalCredential = buildTerminalCredential(toText(staffCode), `staff:${emp.id}`);
        roster.push({
          personId: emp.user_id || emp.id,
          personUUID: emp.user_id || emp.id,
          customId: staffCode,
          uid: terminalCredential,
          pin: terminalCredential,
          name: info.name,
          personName: info.name,
          imageUrl,
          photoUrl: imageUrl,
          hasPhoto: !!imageUrl,
          branchId,
          branchName,
          expiryDate: null,
          role: "staff",
          department: "Employee",
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
      const alreadyAdded = new Set(roster.map((r) => r.personId));
      let trainerProfileMap: Record<string, { name: string; avatar: string | null }> = {};
      if (trainerUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", trainerUserIds);
        trainerProfileMap = (profiles || []).reduce(
          (acc: Record<string, { name: string; avatar: string | null }>, p) => {
            acc[p.id] = { name: p.full_name || "Trainer", avatar: p.avatar_url || null };
            return acc;
          },
          {},
        );
      }

      for (const trainer of trainers || []) {
        const pid = trainer.user_id || trainer.id;
        if (alreadyAdded.has(pid)) continue;
        const info = trainerProfileMap[trainer.user_id] || { name: "Trainer", avatar: null };
        const terminalCredential = buildTerminalCredential(toText(trainer.id), `trainer:${pid}`);
        roster.push({
          personId: pid,
          personUUID: pid,
          customId: trainer.id,
          uid: terminalCredential,
          pin: terminalCredential,
          name: info.name,
          personName: info.name,
          imageUrl: info.avatar,
          photoUrl: info.avatar,
          hasPhoto: !!info.avatar,
          branchId,
          branchName,
          expiryDate: null,
          role: "trainer",
          department: "Employee",
        });
      }

      if (targetAccessDeviceIds.length > 0) {
        await supabase.from("access_devices").update({ last_sync: nowIso }).in("id", targetAccessDeviceIds);

        // Terminal has pulled the latest roster for this device.
        // Mark queued biometric sync rows as completed so UI doesn't stay pending forever.
        const { data: updatedQueueRows, error: queueUpdateError } = await supabase
          .from("biometric_sync_queue")
          .update({
            status: "completed",
            processed_at: nowIso,
            error_message: null,
          })
          .in("device_id", targetAccessDeviceIds)
          .in("status", ["pending", "syncing", "failed"])
          .select("id");

        if (queueUpdateError) {
          console.error("terminal-register queue completion error:", queueUpdateError);
        }
        completedQueueCount = (updatedQueueRows || []).length;
      }

      const debugPayload = debugEnabled
        ? {
            action,
            deviceSn,
            branchId,
            targetAccessDeviceIds,
            completedQueueCount,
          }
        : undefined;

      return new Response(
        JSON.stringify({
          code: 0,
          msg: "success",
          branchId,
          branchName,
          total: roster.length,
          members: roster,
          ...(debugPayload ? { debug: debugPayload } : {}),
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // ── FACE REGISTRATION CALLBACK ──
    if (["register", "register_face", "enroll", "upload"].includes(action)) {
      const imageUrl = toText(body.imageUrl) || toText(body.photo_url);

      if (personIdentifier && imageUrl) {
        // Try member
        const memberLookupQueries = [
          supabase.from("members").select("id, user_id").eq("id", personIdentifier).maybeSingle(),
          supabase.from("members").select("id, user_id").eq("member_code", personIdentifier).maybeSingle(),
          supabase.from("members").select("id, user_id").eq("wiegand_code", personIdentifier).maybeSingle(),
          supabase.from("members").select("id, user_id").eq("user_id", personIdentifier).maybeSingle(),
        ];

        let resolvedMember: { id: string; user_id: string } | null = null;
        for (const query of memberLookupQueries) {
          const { data } = await query;
          if (data) {
            resolvedMember = data;
            break;
          }
        }

        if (resolvedMember) {
          // Update member biometric photo
          await supabase
            .from("members")
            .update({ biometric_photo_url: imageUrl, biometric_enrolled: true })
            .eq("id", resolvedMember.id);
          // Also update profile avatar_url (avatar = biometric unification)
          if (resolvedMember.user_id) {
            await supabase.from("profiles").update({ avatar_url: imageUrl }).eq("id", resolvedMember.user_id);
          }
        } else {
          // Try employee
          const employeeLookupQueries = [
            supabase.from("employees").select("id, user_id").eq("id", personIdentifier).maybeSingle(),
            supabase.from("employees").select("id, user_id").eq("employee_code", personIdentifier).maybeSingle(),
            supabase.from("employees").select("id, user_id").eq("user_id", personIdentifier).maybeSingle(),
          ];

          let resolvedEmployee: { id: string; user_id: string } | null = null;
          for (const query of employeeLookupQueries) {
            const { data } = await query;
            if (data) {
              resolvedEmployee = data;
              break;
            }
          }

          if (resolvedEmployee) {
            await supabase
              .from("employees")
              .update({ biometric_photo_url: imageUrl, biometric_enrolled: true })
              .eq("id", resolvedEmployee.id);
            if (resolvedEmployee.user_id) {
              await supabase.from("profiles").update({ avatar_url: imageUrl }).eq("id", resolvedEmployee.user_id);
            }
          } else {
            // Try trainer
            const trainerLookupQueries = [
              supabase.from("trainers").select("id, user_id").eq("id", personIdentifier).maybeSingle(),
              supabase.from("trainers").select("id, user_id").eq("user_id", personIdentifier).maybeSingle(),
            ];

            let resolvedTrainer: { id: string; user_id: string } | null = null;
            for (const query of trainerLookupQueries) {
              const { data } = await query;
              if (data) {
                resolvedTrainer = data;
                break;
              }
            }

            if (resolvedTrainer) {
              await supabase
                .from("trainers")
                .update({ biometric_photo_url: imageUrl, biometric_enrolled: true })
                .eq("id", resolvedTrainer.id);
              if (resolvedTrainer.user_id) {
                await supabase.from("profiles").update({ avatar_url: imageUrl }).eq("id", resolvedTrainer.user_id);
              }
            }
          }
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

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

let cachedToken: string | null = null;
let tokenExpiry = 0;

function getHostUrl(): string {
  const MIPS_URL = Deno.env.get("MIPS_SERVER_URL")!.replace(/\/+$/, "");
  const urlObj = new URL(MIPS_URL);
  return `${urlObj.protocol}//${urlObj.host}`;
}

function formatDateTime(dateStr: string | null, fallback: string): string {
  if (!dateStr) return fallback;
  // Input may be "2025-12-31" or full ISO — normalize to "YYYY-MM-DD HH:mm:ss"
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return fallback;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function nowFormatted(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function getMIPSToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken;

  const MIPS_USER = Deno.env.get("MIPS_USERNAME")!;
  const MIPS_PASS = Deno.env.get("MIPS_PASSWORD")!;
  const hostUrl = getHostUrl();

  const res = await fetch(`${hostUrl}/apiExternal/generateToken`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ identity: MIPS_USER, pStr: MIPS_PASS }),
  });

  const text = await res.text();
  let json: any;
  try {
    json = JSON.parse(text);
  } catch {
    console.error("MIPS auth returned non-JSON:", text.substring(0, 500));
    throw new Error("MIPS auth endpoint returned non-JSON response");
  }

  const codeVal = Number(json.code);
  if (codeVal !== 200 && codeVal !== 0) {
    throw new Error(`MIPS auth error: ${json.msg || JSON.stringify(json)}`);
  }

  cachedToken = json.data || json.token || json.result;
  if (!cachedToken) throw new Error("No token in MIPS auth response");
  tokenExpiry = Date.now() + 23 * 60 * 60 * 1000;
  return cachedToken!;
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
    const { person_type, person_id, branch_id } = body as {
      person_type: "member" | "employee";
      person_id: string;
      branch_id?: string;
    };

    if (!person_id || !person_type) {
      return new Response(JSON.stringify({ error: "Missing person_id or person_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = await getMIPSToken();
    console.log("MIPS token acquired successfully");

    let name = "Unknown";
    let personNo = "";
    let phone = "";
    let email = "";
    let expireTime = "2030-12-31 00:00:00";
    let tableName: string;

    if (person_type === "member") {
      tableName = "members";
      const { data: member, error } = await supabase
        .from("members")
        .select("*, profiles:user_id(full_name, phone, avatar_url, email)")
        .eq("id", person_id)
        .single();

      if (error || !member) throw new Error(`Member not found: ${error?.message}`);

      const profile = member.profiles as any;
      name = profile?.full_name || "Unknown";
      personNo = member.member_code || person_id.substring(0, 8);
      phone = profile?.phone || "";
      email = profile?.email || "";

      const { data: membership } = await supabase
        .from("memberships")
        .select("end_date")
        .eq("member_id", person_id)
        .eq("status", "active")
        .order("end_date", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (membership?.end_date) {
        expireTime = formatDateTime(membership.end_date + "T23:59:59", expireTime);
      }
    } else {
      tableName = "employees";
      const { data: emp, error } = await supabase
        .from("employees")
        .select("*, profiles:user_id(full_name, phone, avatar_url, email)")
        .eq("id", person_id)
        .single();

      if (error || !emp) throw new Error(`Employee not found: ${error?.message}`);

      const profile = emp.profiles as any;
      name = profile?.full_name || "Unknown";
      personNo = emp.employee_code || person_id.substring(0, 8);
      phone = profile?.phone || "";
      email = profile?.email || "";
    }

    // Build exact MIPS payload matching the verified curl contract
    const mipsPayload = {
      id: "",                          // empty for new person
      personNo,
      name,
      idCard: "",
      beginTime: nowFormatted(),
      expireTime,
      groupId: "",
      gender: 1,
      phone,
      email,
      birthday: "",
      entryDate: nowFormatted().split(" ")[0] + " 00:00:00",
      attendanceFlag: true,
      attendanceRuleId: 1,
      temperatureAlarm: false,
      noticeEmailList: "",
      vaccination: 1,
      vaccinationTime: "",
      secondContact: "",
      remark: person_type === "member" ? "Gym Member" : "Staff",
      ruleA: "",
      ruleB: "",
      ruleC: "",
      personPhotoId: [],              // photos require separate upload API
      personPhotoUrl: [],
    };

    const hostUrl = getHostUrl();
    const saveUrl = `${hostUrl}/admin/person/employees`;

    console.log(`Saving person to MIPS: ${name} (${personNo}), type=${person_type}`);
    console.log(`POST ${saveUrl}`);

    const res = await fetch(saveUrl, {
      method: "POST",
      headers: {
        "Owl-Auth-Token": token,
        "Content-Type": "application/json",
        "siteId": "1",
      },
      body: JSON.stringify(mipsPayload),
    });

    const responseText = await res.text();
    console.log(`MIPS response status: ${res.status}, body: ${responseText.substring(0, 500)}`);

    let responseJson: any;
    try {
      responseJson = JSON.parse(responseText);
    } catch {
      throw new Error(`MIPS returned non-JSON (status ${res.status}): ${responseText.substring(0, 300)}`);
    }

    const code = Number(responseJson.code);
    const success = code === 200 || code === 0 || res.ok;
    const mipsPersonId = responseJson?.data?.id || responseJson?.data?.personId || personNo;

    // Update sync status in database
    await supabase
      .from(tableName)
      .update({
        mips_sync_status: success ? "synced" : "failed",
        mips_person_id: success ? String(mipsPersonId) : null,
      })
      .eq("id", person_id);

    console.log(`Sync result: success=${success}, mipsPersonId=${mipsPersonId}`);

    return new Response(JSON.stringify({
      success,
      mips_person_id: mipsPersonId,
      mips_response: responseJson,
      endpoint_used: saveUrl,
      person: { name, personNo },
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("sync-to-mips error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

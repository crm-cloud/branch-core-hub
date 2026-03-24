import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Try re-inserting hyphens into a stripped code: MAIN00005 → MAIN-00005 */
function reinsertHyphen(stripped: string): string | null {
  // Match pattern: letters followed by digits, e.g. MAIN00005 or MAIN200001
  const match = stripped.match(/^([A-Za-z]+\d*)(\d{5})$/);
  if (match) return `${match[1]}-${match[2]}`;
  return null;
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
    let payload: Record<string, unknown>;

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      payload = await req.json();
    } else if (contentType.includes("form-urlencoded")) {
      const formData = await req.formData();
      payload = Object.fromEntries(formData.entries());
    } else {
      const text = await req.text();
      try {
        payload = JSON.parse(text);
      } catch {
        payload = { raw: text };
      }
    }

    console.log("MIPS webhook received:", JSON.stringify(payload));

    const personNo = String(payload.personNo || payload.person_no || payload.personId || "");
    const personName = String(payload.personName || payload.name || "Unknown");
    const passType = String(payload.passType || payload.pass_type || "face");
    const temperature = payload.temperature ? parseFloat(String(payload.temperature)) : null;
    const deviceName = String(payload.deviceName || payload.device_name || "unknown");
    const scanTime = String(payload.createTime || payload.time || new Date().toISOString());
    const imgUri = String(payload.imgUri || payload.img_uri || "");

    const eventType = passType.includes("face") ? "face_scan" : 
                      passType.includes("finger") ? "fingerprint_scan" : 
                      passType.includes("card") ? "card_scan" : "identify";

    let memberId: string | null = null;
    let profileId: string | null = null;
    let branchId: string | null = null;
    let result = "stranger";
    let message = `${personName} scanned via ${passType}`;

    if (personNo) {
      // 1. Try matching by mips_person_id (stored as hyphen-stripped or MIPS numeric id)
      const { data: member } = await supabase
        .from("members")
        .select("id, branch_id, user_id")
        .eq("mips_person_id", personNo)
        .maybeSingle();

      if (member) {
        memberId = member.id;
        branchId = member.branch_id;
        profileId = member.user_id;
        result = "member";
        message = `Member ${personName} checked in via ${passType}`;

        try {
          const { data: checkinResult } = await supabase.rpc("member_check_in", {
            _member_id: member.id,
            _branch_id: member.branch_id,
            _method: "biometric",
          });
          if (checkinResult && !(checkinResult as any).valid) {
            result = "member_denied";
            message = `${personName}: ${(checkinResult as any).message || "Check-in denied"}`;
          }
        } catch (e) {
          console.warn("Check-in RPC failed:", e);
        }
      } else {
        // 2. Try as employee by mips_person_id
        const { data: emp } = await supabase
          .from("employees")
          .select("id, branch_id, user_id")
          .eq("mips_person_id", personNo)
          .maybeSingle();

        if (emp) {
          branchId = emp.branch_id;
          profileId = emp.user_id;
          result = "staff";
          message = `Staff ${personName} scanned via ${passType}`;

          try {
            const today = new Date().toISOString().split("T")[0];
            const { data: existing } = await supabase
              .from("staff_attendance")
              .select("id, check_out")
              .eq("employee_id", emp.id)
              .eq("date", today)
              .is("check_out", null)
              .maybeSingle();

            if (existing) {
              await supabase
                .from("staff_attendance")
                .update({ check_out: new Date().toISOString() })
                .eq("id", existing.id);
              message = `Staff ${personName} checked out`;
            } else {
              await supabase.from("staff_attendance").insert({
                employee_id: emp.id,
                branch_id: emp.branch_id,
                date: today,
                check_in: new Date().toISOString(),
                source: "biometric",
              });
              message = `Staff ${personName} checked in`;
            }
          } catch (e) {
            console.warn("Staff attendance failed:", e);
          }
        } else {
          // 3. Try matching by member_code directly
          const { data: memberByCode } = await supabase
            .from("members")
            .select("id, branch_id, user_id")
            .eq("member_code", personNo)
            .maybeSingle();

          if (memberByCode) {
            memberId = memberByCode.id;
            branchId = memberByCode.branch_id;
            profileId = memberByCode.user_id;
            result = "member";
            message = `Member ${personName} checked in via ${passType}`;

            try {
              await supabase.rpc("member_check_in", {
                _member_id: memberByCode.id,
                _branch_id: memberByCode.branch_id,
                _method: "biometric",
              });
            } catch (e) {
              console.warn("Check-in RPC failed:", e);
            }
          } else {
            // 4. Fallback: try re-inserting hyphen (MAIN00005 → MAIN-00005)
            const hyphenated = reinsertHyphen(personNo);
            if (hyphenated) {
              const { data: memberByHyphen } = await supabase
                .from("members")
                .select("id, branch_id, user_id")
                .eq("member_code", hyphenated)
                .maybeSingle();

              if (memberByHyphen) {
                memberId = memberByHyphen.id;
                branchId = memberByHyphen.branch_id;
                profileId = memberByHyphen.user_id;
                result = "member";
                message = `Member ${personName} checked in via ${passType}`;

                try {
                  await supabase.rpc("member_check_in", {
                    _member_id: memberByHyphen.id,
                    _branch_id: memberByHyphen.branch_id,
                    _method: "biometric",
                  });
                } catch (e) {
                  console.warn("Check-in RPC failed:", e);
                }
              }
            }
          }
        }
      }
    }

    // Log to access_logs
    await supabase.from("access_logs").insert({
      device_sn: deviceName,
      event_type: eventType,
      result,
      message,
      member_id: memberId,
      profile_id: profileId,
      branch_id: branchId,
      captured_at: scanTime,
      payload: {
        ...payload,
        temperature,
        img_uri: imgUri,
        source: "mips_webhook",
      },
    });

    return new Response(JSON.stringify({ code: 200, msg: "Successful!" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("mips-webhook-receiver error:", message);
    return new Response(JSON.stringify({ code: 200, msg: "Received with errors" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

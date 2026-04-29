// Public, plan-gated, opaque-token-based HOWBODY report viewer.
// Renders body OR posture report depending on URL param.
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Loader2, AlertTriangle, Activity, Scan } from "lucide-react";

interface Props { reportType: "body" | "posture" }

export default function HowbodyPublicReport({ reportType }: Props) {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [report, setReport] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!token) { setError("Missing token"); setLoading(false); return; }
      const { data: tokRow } = await supabase
        .from("howbody_public_report_tokens")
        .select("data_key, report_type, expires_at")
        .eq("token", token)
        .maybeSingle();
      if (!tokRow || tokRow.report_type !== reportType) {
        setError("Report link is invalid or has been revoked.");
        setLoading(false); return;
      }
      if (tokRow.expires_at && new Date(tokRow.expires_at) < new Date()) {
        setError("Report link has expired.");
        setLoading(false); return;
      }
      const table = reportType === "body" ? "howbody_body_reports" : "howbody_posture_reports";
      const { data: r } = await supabase.from(table).select("*").eq("data_key", tokRow.data_key).maybeSingle();
      if (!r) { setError("Report not found."); setLoading(false); return; }
      setReport(r);
      setLoading(false);
    })();
  }, [token, reportType]);

  if (loading) {
    return <Shell><Loader2 className="mx-auto h-8 w-8 animate-spin text-teal-500" /></Shell>;
  }
  if (error) {
    return (
      <Shell>
        <Card className="rounded-2xl p-8 text-center shadow-lg shadow-rose-500/10">
          <AlertTriangle className="mx-auto h-10 w-10 text-rose-500" />
          <p className="mt-4 font-semibold">{error}</p>
        </Card>
      </Shell>
    );
  }

  return reportType === "body"
    ? <BodyReport r={report} />
    : <PostureReport r={report} />;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] bg-gradient-to-br from-slate-50 via-white to-teal-50/40 px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="text-center">
          <p className="text-xs uppercase tracking-[0.2em] text-teal-600">Incline Body Scan Report</p>
        </div>
        {children}
        <p className="text-center text-xs text-slate-400">The Incline Life by Incline</p>
      </div>
    </div>
  );
}

function Metric({ label, value, unit, hint }: { label: string; value: any; unit?: string; hint?: string }) {
  if (value === null || value === undefined) return null;
  return (
    <div className="rounded-2xl bg-white p-4 shadow shadow-slate-200/60">
      <p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">
        {Number(value).toFixed(value % 1 === 0 ? 0 : 1)}
        {unit && <span className="ml-1 text-sm font-medium text-slate-400">{unit}</span>}
      </p>
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}

function BodyReport({ r }: { r: any }) {
  return (
    <Shell>
      <Card className="rounded-2xl border-0 bg-gradient-to-br from-teal-500 to-emerald-600 p-8 text-white shadow-xl shadow-teal-500/30">
        <div className="flex items-center gap-3">
          <Activity className="h-8 w-8" />
          <div>
            <p className="text-xs uppercase tracking-wide text-teal-50">Body Composition</p>
            <h1 className="text-2xl font-bold">Health Score · {r.health_score ?? "—"}</h1>
          </div>
        </div>
        {r.test_time && <p className="mt-2 text-sm text-teal-50">{new Date(r.test_time).toLocaleString()}</p>}
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Metric label="Weight" value={r.weight} unit="kg" />
        <Metric label="BMI" value={r.bmi} />
        <Metric label="Body Fat %" value={r.pbf} unit="%" />
        <Metric label="Fat Mass" value={r.fat} unit="kg" />
        <Metric label="Skeletal Muscle" value={r.smm} unit="kg" />
        <Metric label="Body Water" value={r.tbw} unit="kg" />
        <Metric label="Protein" value={r.pr} unit="kg" />
        <Metric label="BMR" value={r.bmr} unit="kcal" />
        <Metric label="Metabolic Age" value={r.metabolic_age} unit="yrs" />
        <Metric label="Visceral Fat" value={r.vfr} />
        <Metric label="Waist-Hip" value={r.whr} />
        <Metric label="Target Weight" value={r.target_weight} unit="kg" />
      </div>
    </Shell>
  );
}

function PostureReport({ r }: { r: any }) {
  const imgs = [
    { label: "Front", src: r.front_img },
    { label: "Back", src: r.back_img },
    { label: "Left", src: r.left_img },
    { label: "Right", src: r.right_img },
  ].filter((i) => i.src);
  return (
    <Shell>
      <Card className="rounded-2xl border-0 bg-gradient-to-br from-teal-500 to-emerald-600 p-8 text-white shadow-xl shadow-teal-500/30">
        <div className="flex items-center gap-3">
          <Scan className="h-8 w-8" />
          <div>
            <p className="text-xs uppercase tracking-wide text-teal-50">Posture Assessment</p>
            <h1 className="text-2xl font-bold">Posture Score · {r.score ?? "—"}</h1>
          </div>
        </div>
        {r.test_time && <p className="mt-2 text-sm text-teal-50">{new Date(r.test_time).toLocaleString()}</p>}
      </Card>

      {imgs.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {imgs.map((i) => (
            <div key={i.label} className="overflow-hidden rounded-2xl bg-white shadow shadow-slate-200/60">
              <img src={i.src} alt={i.label} loading="lazy" className="h-48 w-full object-cover" />
              <p className="px-3 py-2 text-xs font-medium text-slate-700">{i.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Metric label="Head Forward" value={r.head_forward} unit="°" />
        <Metric label="Head Slant" value={r.head_slant} unit="°" />
        <Metric label="L Shoulder" value={r.shoulder_left} unit="°" />
        <Metric label="R Shoulder" value={r.shoulder_right} unit="°" />
        <Metric label="Shoulder Tilt" value={r.high_low_shoulder} unit="°" />
        <Metric label="Pelvis Tilt" value={r.pelvis_forward} unit="°" />
        <Metric label="Bust" value={r.bust} unit="cm" />
        <Metric label="Waist" value={r.waist} unit="cm" />
        <Metric label="Hip" value={r.hip} unit="cm" />
      </div>
    </Shell>
  );
}

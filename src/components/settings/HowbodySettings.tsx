// Body Scanner integration settings panel.
// Shows the URLs to give to the device vendor and a connection test button.
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Copy, Loader2, ScanLine, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";

export function HowbodySettings() {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const urls = [
    { label: "QR Login URL", value: `${origin}/scan-login`, hint: "Static base — the scanner appends ?equipmentNo=…&scanId=…" },
    { label: "Body Composition Webhook", value: `${SUPABASE_URL}/functions/v1/howbody-body-webhook`, hint: "Receives body composition results" },
    { label: "Posture Webhook", value: `${SUPABASE_URL}/functions/v1/howbody-posture-webhook`, hint: "Receives posture analysis results" },
  ];

  function copy(text: string) {
    navigator.clipboard.writeText(text);
    toast({ title: "Copied to clipboard" });
  }

  async function runTest() {
    setTesting(true);
    setTestResult(null);
    const { data, error } = await supabase.functions.invoke("howbody-test-connection");
    if (error || !data?.ok) {
      setTestResult({ ok: false, msg: data?.error || error?.message || "Test failed" });
    } else {
      setTestResult({ ok: true, msg: `Token cached, expires ${new Date(data.expires_at).toLocaleString()}` });
    }
    setTesting(false);
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl p-6 shadow-lg shadow-slate-200/50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-teal-50 p-2 text-teal-600"><ScanLine className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-bold">Body Scanner Integration</h2>
              <p className="text-sm text-muted-foreground">
                Provide these URLs to the device vendor to enable QR login and automatic report delivery.
              </p>
            </div>
          </div>
          <Badge variant="outline" className="border-teal-200 bg-teal-50 text-teal-700">Active</Badge>
        </div>

        <div className="mt-6 space-y-4">
          {urls.map((u) => (
            <div key={u.label}>
              <Label className="text-xs uppercase tracking-wide text-slate-500">{u.label}</Label>
              <div className="mt-1 flex gap-2">
                <Input readOnly value={u.value} className="font-mono text-xs" />
                <Button variant="outline" size="icon" onClick={() => copy(u.value)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-slate-500">{u.hint}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="rounded-2xl p-6 shadow-lg shadow-slate-200/50">
        <h3 className="text-base font-bold">Test connection</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Verifies the configured device-vendor credentials.
        </p>
        <Button onClick={runTest} disabled={testing} className="mt-4 bg-teal-500 hover:bg-teal-600">
          {testing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Run test
        </Button>
        {testResult && (
          <div className={`mt-4 flex items-start gap-2 rounded-xl p-3 text-sm ${testResult.ok ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
            {testResult.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4" /> : <XCircle className="mt-0.5 h-4 w-4" />}
            <span>{testResult.msg}</span>
          </div>
        )}
        <p className="mt-4 text-[11px] text-slate-400">
          Vendor: HOWBODY S580 (admin reference only — not visible to members).
        </p>
      </Card>
    </div>
  );
}

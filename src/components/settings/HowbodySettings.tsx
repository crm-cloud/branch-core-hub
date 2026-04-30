// Body Scanner integration settings panel.
// Vendor URLs + dynamic credential editor (DB-backed) + connection test.
import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Copy, Loader2, ScanLine, CheckCircle2, XCircle, Eye, EyeOff, KeyRound, Save, Database, Server } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";

interface CredsState {
  configured: boolean;
  source: "db" | "env" | "none";
  is_active: boolean;
  base_url: string;
  username: string;
  app_key_masked: string;
  has_app_key: boolean;
}

export function HowbodySettings() {
  const { toast } = useToast();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  // Credentials state
  const [loading, setLoading] = useState(true);
  const [creds, setCreds] = useState<CredsState | null>(null);
  const [baseUrl, setBaseUrl] = useState("");
  const [username, setUsername] = useState("");
  const [appKey, setAppKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadCreds() {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("howbody-save-credentials", { method: "GET" });
    if (!error && data?.ok) {
      const c = data as CredsState;
      setCreds(c);
      setBaseUrl(c.base_url || "https://prodapi.howbodyfit.com/howbody-admin");
      setUsername(c.username || "");
      setAppKey(""); // never preload key; placeholder shows masked
      setIsActive(c.is_active);
    }
    setLoading(false);
  }

  useEffect(() => { loadCreds(); }, []);

  async function saveCreds() {
    if (!baseUrl.trim() || !username.trim()) {
      toast({ title: "Missing fields", description: "Base URL and Username are required.", variant: "destructive" });
      return;
    }
    if (!creds?.has_app_key && !appKey.trim()) {
      toast({ title: "App Key required", description: "Paste the App Key for first-time setup.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const { data, error } = await supabase.functions.invoke("howbody-save-credentials", {
      method: "POST",
      body: { base_url: baseUrl.trim(), username: username.trim(), app_key: appKey.trim(), is_active: isActive },
    });
    setSaving(false);
    if (error || !data?.ok) {
      toast({ title: "Save failed", description: data?.error || error?.message || "Unknown error", variant: "destructive" });
      return;
    }
    toast({ title: "Credentials saved", description: "HOWBODY now uses these credentials live." });
    setAppKey("");
    setTestResult(null);
    await loadCreds();
  }

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

  const sourceBadge = creds?.source === "db"
    ? { label: "Configured (Database)", cls: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: Database }
    : creds?.source === "env"
      ? { label: "Using env fallback", cls: "border-amber-200 bg-amber-50 text-amber-700", icon: Server }
      : { label: "Not configured", cls: "border-rose-200 bg-rose-50 text-rose-700", icon: XCircle };
  const SourceIcon = sourceBadge.icon;

  return (
    <div className="space-y-6">
      {/* === Credentials === */}
      <Card className="rounded-2xl p-6 shadow-lg shadow-slate-200/50">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-full bg-indigo-50 p-2 text-indigo-600"><KeyRound className="h-5 w-5" /></div>
            <div>
              <h2 className="text-lg font-bold">HOWBODY Credentials</h2>
              <p className="text-sm text-muted-foreground">
                Stored securely in the database. Edge functions read these dynamically — no redeploy needed.
              </p>
            </div>
          </div>
          <Badge variant="outline" className={sourceBadge.cls}>
            <SourceIcon className="mr-1 h-3 w-3" /> {sourceBadge.label}
          </Badge>
        </div>

        {loading ? (
          <div className="mt-6 flex items-center gap-2 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <div>
              <Label htmlFor="hb-base">Base URL</Label>
              <Input
                id="hb-base"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://prodapi.howbodyfit.com/howbody-admin"
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <Label htmlFor="hb-user">Username</Label>
              <Input
                id="hb-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="TechnicalSupport20264..."
                className="mt-1 font-mono text-xs"
              />
            </div>
            <div>
              <Label htmlFor="hb-key">App Key</Label>
              <div className="mt-1 flex gap-2">
                <Input
                  id="hb-key"
                  type={showKey ? "text" : "password"}
                  value={appKey}
                  onChange={(e) => setAppKey(e.target.value)}
                  placeholder={creds?.has_app_key ? `Saved: ${creds.app_key_masked} — leave blank to keep` : "Paste App Key"}
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="icon" type="button" onClick={() => setShowKey((s) => !s)}>
                  {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                Provided by HOWBODY (e.g. <span className="font-mono">key-...</span>). Used for both outbound API calls and inbound webhook verification.
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
              <div>
                <p className="text-sm font-medium">Active</p>
                <p className="text-xs text-slate-500">Disable to fall back to env vars (if configured).</p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <Button onClick={saveCreds} disabled={saving} className="w-full bg-indigo-600 hover:bg-indigo-700">
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Save credentials
            </Button>
          </div>
        )}
      </Card>

      {/* === Vendor URLs === */}
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

      {/* === Test === */}
      <Card className="rounded-2xl p-6 shadow-lg shadow-slate-200/50">
        <h3 className="text-base font-bold">Test connection</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Verifies the configured device-vendor credentials by requesting a fresh API token.
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
          Vendor: HOWBODY S580. Device serial = <span className="font-mono">equipmentNo</span> (already captured per scan; no separate device-id field needed).
        </p>
      </Card>
    </div>
  );
}

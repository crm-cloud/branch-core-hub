import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface SyncReport {
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

const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
};

const PHASES: Array<{ pct: number; label: string }> = [
  { pct: 5, label: "Connecting to fallback database…" },
  { pct: 20, label: "Mirroring auth users…" },
  { pct: 40, label: "Ensuring storage buckets…" },
  { pct: 65, label: "Copying files…" },
  { pct: 85, label: "Verifying mirror…" },
  { pct: 95, label: "Finalising…" },
];

export function DisasterRecoveryCard() {
  const { hasAnyRole } = useAuth();
  const [lastReport, setLastReport] = useState<SyncReport | null>(null);
  const [progress, setProgress] = useState(0);
  const [phaseLabel, setPhaseLabel] = useState<string>("");
  const intervalRef = useRef<number | null>(null);
  const isOwner = hasAnyRole(["owner"]);

  const stopTicker = () => {
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startTicker = () => {
    stopTicker();
    let i = 0;
    setProgress(PHASES[0].pct);
    setPhaseLabel(PHASES[0].label);
    intervalRef.current = window.setInterval(() => {
      i = Math.min(i + 1, PHASES.length - 1);
      setProgress(PHASES[i].pct);
      setPhaseLabel(PHASES[i].label);
    }, 1400);
  };

  useEffect(() => () => stopTicker(), []);

  const sync = useMutation({
    mutationFn: async () => {
      startTicker();
      const { data, error } = await supabase.functions.invoke("dr-replicate", {
        body: { mode: "all" },
      });
      if (error) throw error;
      return data as SyncReport;
    },
    onSuccess: (report) => {
      stopTicker();
      setProgress(100);
      setPhaseLabel("Sync complete");
      setLastReport(report);
      if (report.ok) {
        toast.success(
          `Sync complete: ${report.mirrored.authUsers.listed} users, ${report.mirrored.storage.objects.copied} files (${formatBytes(report.mirrored.storage.objects.bytes)})`,
        );
      } else {
        toast.warning(`Sync finished with ${report.errors.length} error(s)`);
      }
      window.setTimeout(() => {
        setProgress(0);
        setPhaseLabel("");
      }, 2500);
    },
    onError: (e: Error) => {
      stopTicker();
      setProgress(0);
      setPhaseLabel("");
      toast.error(`Sync failed: ${e.message}`);
    },
  });

  if (!isOwner) return null;

  const isRunning = sync.isPending;

  return (
    <Card className="rounded-2xl border-border/50 shadow-lg">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
            <ShieldCheck className="h-5 w-5" />
          </div>
          Disaster Recovery
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground leading-relaxed">
          The fallback database is mirrored automatically every night at{" "}
          <span className="font-medium text-foreground">02:30 IST</span>. You can
          trigger a manual sync now — useful before risky migrations.
        </div>

        <Button
          onClick={() => sync.mutate()}
          disabled={isRunning}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isRunning ? "animate-spin" : ""}`} />
          {isRunning ? "Syncing…" : "Sync to fallback now"}
        </Button>

        {(isRunning || progress > 0) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">{phaseLabel || "Working…"}</span>
              <span className="font-semibold text-foreground tabular-nums">{progress}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {lastReport && (
          <div className="rounded-xl border bg-muted/30 p-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 font-medium">
              {lastReport.ok ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Last sync succeeded
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Last sync had {lastReport.errors.length} issue(s)
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-muted-foreground">
              <div>
                Auth users: <Badge variant="secondary">{lastReport.mirrored.authUsers.listed}</Badge>
              </div>
              <div>
                Buckets: <Badge variant="secondary">{lastReport.mirrored.storage.buckets.ensured}</Badge>
              </div>
              <div>
                Files copied: <Badge variant="secondary">{lastReport.mirrored.storage.objects.copied}</Badge>
              </div>
              <div>
                Size: <Badge variant="secondary">{formatBytes(lastReport.mirrored.storage.objects.bytes)}</Badge>
              </div>
            </div>
            {lastReport.errors.length > 0 && (
              <details className="text-xs text-amber-700">
                <summary className="cursor-pointer">View errors</summary>
                <ul className="mt-2 space-y-1 list-disc pl-4">
                  {lastReport.errors.slice(0, 10).map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

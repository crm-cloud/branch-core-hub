import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useState } from "react";
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

export function DisasterRecoveryCard() {
  const { hasAnyRole } = useAuth();
  const [lastReport, setLastReport] = useState<SyncReport | null>(null);
  const isOwner = hasAnyRole(["owner"]);

  const sync = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("dr-replicate", {
        body: { mode: "all" },
      });
      if (error) throw error;
      return data as SyncReport;
    },
    onSuccess: (report) => {
      setLastReport(report);
      if (report.ok) {
        toast.success(
          `Sync complete: ${report.mirrored.authUsers.listed} users, ${report.mirrored.storage.objects.copied} files (${formatBytes(report.mirrored.storage.objects.bytes)})`,
        );
      } else {
        toast.warning(`Sync finished with ${report.errors.length} error(s)`);
      }
    },
    onError: (e: Error) => toast.error(`Sync failed: ${e.message}`),
  });

  if (!isOwner) return null;

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
          disabled={sync.isPending}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${sync.isPending ? "animate-spin" : ""}`} />
          {sync.isPending ? "Syncing…" : "Sync to fallback now"}
        </Button>

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

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export function ReconciliationFindingsCard() {
  const { data, isLoading } = useQuery({
    queryKey: ["reconciliation-findings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reconciliation_findings")
        .select("id, run_date, kind, severity, branch_id, reference_type, reference_id, details, resolved_at")
        .is("resolved_at", null)
        .order("run_date", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60_000,
  });

  const open = data ?? [];

  return (
    <Card className="rounded-2xl shadow-lg shadow-slate-200/50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <span className="flex items-center gap-2">
            {open.length === 0 ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            )}
            Reconciliation findings
          </span>
          <Badge variant={open.length === 0 ? "secondary" : "destructive"}>
            {isLoading ? "…" : `${open.length} open`}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : open.length === 0 ? (
          <p className="text-sm text-emerald-700">All ledgers reconciled.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {open.slice(0, 8).map((f) => (
              <li
                key={f.id}
                className="flex items-start justify-between gap-3 rounded-lg bg-amber-50 px-3 py-2"
              >
                <div className="min-w-0">
                  <div className="font-medium text-slate-900">{f.kind}</div>
                  <div className="truncate text-xs text-slate-500">
                    {f.reference_type ?? ""}:{f.reference_id ?? "-"}
                  </div>
                </div>
                <Badge variant="outline" className="shrink-0 text-xs">
                  {f.run_date}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

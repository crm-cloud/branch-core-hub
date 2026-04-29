import { useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Loader2,
  Library,
  Users,
  Search,
  Eye,
  Dumbbell,
  Utensils,
  CalendarClock,
  AlarmClock,
  Activity,
  MoreVertical,
  Trash2,
  RefreshCw,
} from "lucide-react";
import { FitnessHubTabs } from "@/components/fitness/FitnessHubTabs";
import { format, differenceInDays, parseISO } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  fetchMemberAssignments,
  revokeMemberAssignment,
  type MemberAssignmentRow,
} from "@/services/fitnessService";
import { useBranch } from "@/contexts/BranchContext";
import { PlanViewerSheet } from "@/components/fitness/PlanViewerSheet";
import { SendPlanPdfMenu } from "@/components/fitness/SendPlanPdfMenu";
import { sendPlanToMember } from "@/utils/sendPlanToMember";

type StatusFilter = "active" | "expired" | "all";
type TypeFilter = "all" | "workout" | "diet";

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Activity;
  label: string;
  value: number | string;
  accent: string;
}) {
  return (
    <Card className="rounded-2xl border-0 shadow-lg shadow-slate-200/40">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-11 w-11 rounded-2xl flex items-center justify-center ${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-2xl font-bold leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-1">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function FitnessMemberPlansPage() {
  const navigate = useNavigate();
  const { activeBranchId } = useBranch();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("active");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [viewing, setViewing] = useState<MemberAssignmentRow | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<MemberAssignmentRow | null>(null);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["fitness-member-assignments", activeBranchId],
    queryFn: () => fetchMemberAssignments(activeBranchId),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assignments.filter((a) => {
      if (statusFilter === "active" && a.is_expired) return false;
      if (statusFilter === "expired" && !a.is_expired) return false;
      if (typeFilter !== "all" && a.plan_type !== typeFilter) return false;
      if (!q) return true;
      return (
        a.member_name.toLowerCase().includes(q) ||
        a.plan_name.toLowerCase().includes(q) ||
        (a.member_code || "").toLowerCase().includes(q) ||
        (a.trainer_name || "").toLowerCase().includes(q)
      );
    });
  }, [assignments, search, statusFilter, typeFilter]);

  const kpis = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const active = assignments.filter((a) => !a.is_expired);
    const workouts = active.filter((a) => a.plan_type === "workout").length;
    const diets = active.filter((a) => a.plan_type === "diet").length;
    const expiring = active.filter(
      (a) =>
        a.valid_until &&
        a.valid_until >= today &&
        differenceInDays(parseISO(a.valid_until), new Date()) <= 7,
    ).length;
    const uniqueMembers = new Set(active.map((a) => a.member_id)).size;
    return { workouts, diets, expiring, uniqueMembers };
  }, [assignments]);

  const revokeMutation = useMutation({
    mutationFn: (id: string) => revokeMemberAssignment(id),
    onSuccess: () => {
      toast.success("Plan revoked");
      queryClient.invalidateQueries({ queryKey: ["fitness-member-assignments"] });
      setRevokeTarget(null);
    },
    onError: (e: any) => toast.error(e?.message || "Failed to revoke"),
  });

  const renderStatusChip = (a: MemberAssignmentRow) => {
    if (a.is_expired) return <Badge variant="secondary" className="text-[10px]">Expired</Badge>;
    if (!a.valid_until) return <Badge className="bg-success/15 text-success border-success/20 text-[10px]">Active</Badge>;
    const days = differenceInDays(parseISO(a.valid_until), new Date());
    if (days <= 7) return <Badge className="bg-warning/15 text-warning border-warning/20 text-[10px]">{days}d left</Badge>;
    return <Badge className="bg-success/15 text-success border-success/20 text-[10px]">{days}d left</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <FitnessHubTabs />

        {/* KPI strip */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <KpiCard icon={Dumbbell} label="Active workout plans" value={kpis.workouts} accent="bg-primary/10 text-primary" />
          <KpiCard icon={Utensils} label="Active diet plans" value={kpis.diets} accent="bg-success/10 text-success" />
          <KpiCard icon={AlarmClock} label="Expiring in 7 days" value={kpis.expiring} accent="bg-warning/10 text-warning" />
          <KpiCard icon={Users} label="Members on a plan" value={kpis.uniqueMembers} accent="bg-accent/10 text-accent" />
        </div>

        {/* Header + filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Member Plans
            </h2>
            <p className="text-sm text-muted-foreground">
              Workout & diet plans currently assigned to members
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search member, plan, trainer..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <Button onClick={() => navigate("/fitness/templates")} variant="outline" className="gap-1.5">
              <Library className="h-4 w-4" /> Templates
            </Button>
          </div>
        </div>

        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {(["active", "expired", "all"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                statusFilter === s
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:bg-muted border-border"
              }`}
            >
              {s === "active" ? "Active" : s === "expired" ? "Expired" : "All"}
            </button>
          ))}
          <span className="mx-1 text-muted-foreground/50">·</span>
          {(["all", "workout", "diet"] as TypeFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`text-xs px-3 py-1.5 rounded-full border transition ${
                typeFilter === t
                  ? "bg-secondary text-secondary-foreground border-secondary"
                  : "bg-background hover:bg-muted border-border"
              }`}
            >
              {t === "all" ? "All types" : t === "workout" ? "Workout" : "Diet"}
            </button>
          ))}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <Card className="rounded-2xl border-0 shadow-lg shadow-slate-200/40">
            <CardContent className="py-16 text-center">
              <div className="h-14 w-14 mx-auto mb-4 rounded-2xl bg-muted flex items-center justify-center">
                <Users className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-1">
                {assignments.length === 0 ? "No member plans assigned yet" : "No plans match your filters"}
              </h3>
              <p className="text-sm text-muted-foreground mb-5">
                {assignments.length === 0
                  ? "Assign plans to members from the Template Library or build a new one."
                  : "Adjust the filters above to see more results."}
              </p>
              <Button onClick={() => navigate("/fitness/templates")}>
                <Library className="mr-2 h-4 w-4" /> Browse Templates
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((a) => {
              const Icon = a.plan_type === "workout" ? Dumbbell : Utensils;
              const accent = a.plan_type === "workout" ? "text-primary bg-primary/10" : "text-success bg-success/10";
              return (
                <Card
                  key={a.id}
                  className="rounded-2xl border-0 shadow-lg shadow-slate-200/40 hover:shadow-xl hover:shadow-slate-200/60 transition-shadow"
                >
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={a.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                            {a.member_name.charAt(0)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{a.member_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {a.member_code || "—"}
                          </p>
                        </div>
                      </div>
                      {renderStatusChip(a)}
                    </div>

                    <div className="rounded-xl bg-muted/40 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${accent}`}>
                          <Icon className="h-3.5 w-3.5" />
                        </div>
                        <p className="text-sm font-medium truncate flex-1">{a.plan_name}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                        {a.trainer_name && <span>by {a.trainer_name}</span>}
                        {a.template_name && (
                          <>
                            <span className="text-muted-foreground/40">·</span>
                            <Badge variant="outline" className="text-[10px] py-0 h-4">
                              {a.template_name}
                            </Badge>
                          </>
                        )}
                      </div>
                      {(a.valid_from || a.valid_until) && (
                        <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                          <CalendarClock className="h-3 w-3" />
                          {a.valid_from ? format(parseISO(a.valid_from), "dd MMM") : "—"}
                          {" → "}
                          {a.valid_until ? format(parseISO(a.valid_until), "dd MMM yyyy") : "ongoing"}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 gap-1.5"
                        onClick={() => setViewing(a)}
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      <SendPlanPdfMenu
                        member={{
                          id: a.member_id,
                          full_name: a.member_name,
                          phone: a.phone,
                          email: a.email,
                        }}
                        plan={{
                          name: a.plan_name,
                          type: a.plan_type,
                          description: a.description,
                          data: a.plan_data,
                          valid_from: a.valid_from,
                          valid_until: a.valid_until,
                          trainer_name: a.trainer_name,
                        }}
                        branchId={a.branch_id || activeBranchId}
                      />
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button size="sm" variant="ghost">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => navigate(`/fitness/templates`)}
                          >
                            <RefreshCw className="h-4 w-4 mr-2" /> Reassign / Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onClick={() => setRevokeTarget(a)}
                          >
                            <Trash2 className="h-4 w-4 mr-2" /> Revoke plan
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      <PlanViewerSheet
        open={!!viewing}
        onOpenChange={(o) => !o && setViewing(null)}
        plan={
          viewing
            ? {
                id: viewing.id,
                name: viewing.plan_name,
                type: viewing.plan_type,
                description: viewing.description,
                data: viewing.plan_data,
                member_name: viewing.member_name,
                trainer_name: viewing.trainer_name,
                valid_from: viewing.valid_from,
                valid_until: viewing.valid_until,
                template_name: viewing.template_name,
              }
            : null
        }
        onDownload={() => {
          if (!viewing) return;
          sendPlanToMember({
            member: {
              id: viewing.member_id,
              full_name: viewing.member_name,
              phone: viewing.phone,
              email: viewing.email,
            },
            plan: {
              name: viewing.plan_name,
              type: viewing.plan_type,
              description: viewing.description,
              data: viewing.plan_data,
              valid_from: viewing.valid_from,
              valid_until: viewing.valid_until,
              trainer_name: viewing.trainer_name,
            },
            branchId: viewing.branch_id || activeBranchId,
            channels: ["download"],
          });
        }}
      />

      <AlertDialog open={!!revokeTarget} onOpenChange={(o) => !o && setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke this plan?</AlertDialogTitle>
            <AlertDialogDescription>
              The member will lose access to <b>{revokeTarget?.plan_name}</b> from today.
              You can always assign a new plan later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => revokeTarget && revokeMutation.mutate(revokeTarget.id)}
            >
              Revoke
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Users, RefreshCw, Upload, Check, X, AlertCircle, Search, Image, Camera,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { syncPersonToMIPS, capturePhoto, fetchOnlineDeviceIds } from "@/services/mipsService";
import { toast } from "sonner";

interface PersonnelSyncTabProps {
  branchId?: string;
}

interface SyncPerson {
  id: string;
  name: string;
  code: string;
  type: "member" | "employee";
  hasPhoto: boolean;
  avatarUrl: string | null;
  mipsSyncStatus: string | null;
  mipsPersonId: string | null;
}

const PersonnelSyncTab = ({ branchId }: PersonnelSyncTabProps) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [capturingIds, setCapturingIds] = useState<Set<string>>(new Set());

  const { data: personnel = [], isLoading } = useQuery({
    queryKey: ["personnel-sync", branchId],
    queryFn: async () => {
      const people: SyncPerson[] = [];

      let memberQuery = supabase
        .from("members")
        .select("id, member_code, biometric_photo_url, mips_person_id, mips_sync_status, branch_id, profiles:user_id(full_name, avatar_url)")
        .order("created_at", { ascending: false });

      if (branchId) memberQuery = memberQuery.eq("branch_id", branchId);

      const { data: members } = await memberQuery;
      if (members) {
        for (const m of members) {
          const profile = m.profiles as any;
          people.push({
            id: m.id,
            name: profile?.full_name || "Unknown",
            code: m.member_code || "",
            type: "member",
            hasPhoto: !!(m.biometric_photo_url || profile?.avatar_url),
            avatarUrl: profile?.avatar_url || null,
            mipsSyncStatus: (m as any).mips_sync_status || "pending",
            mipsPersonId: (m as any).mips_person_id || null,
          });
        }
      }

      let empQuery = supabase
        .from("employees")
        .select("id, employee_code, biometric_photo_url, mips_person_id, mips_sync_status, branch_id, profiles:user_id(full_name, avatar_url)")
        .order("created_at", { ascending: false });

      if (branchId) empQuery = empQuery.eq("branch_id", branchId);

      const { data: employees } = await empQuery;
      if (employees) {
        for (const e of employees) {
          const profile = e.profiles as any;
          people.push({
            id: e.id,
            name: profile?.full_name || "Unknown",
            code: e.employee_code || "",
            type: "employee",
            hasPhoto: !!(e.biometric_photo_url || profile?.avatar_url),
            avatarUrl: profile?.avatar_url || null,
            mipsSyncStatus: (e as any).mips_sync_status || "pending",
            mipsPersonId: (e as any).mips_person_id || null,
          });
        }
      }

      return people;
    },
  });

  const syncMutation = useMutation({
    mutationFn: async (person: SyncPerson) => {
      setSyncingIds((prev) => new Set(prev).add(person.id));
      return syncPersonToMIPS(person.type, person.id, branchId);
    },
    onSuccess: (result, person) => {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(person.id);
        return next;
      });
      if (result.success) {
        toast.success(`${person.name} synced to MIPS`);
      } else {
        toast.error(`Sync failed: ${result.error || "Unknown error"}`);
      }
      queryClient.invalidateQueries({ queryKey: ["personnel-sync"] });
    },
    onError: (error: Error, person) => {
      setSyncingIds((prev) => {
        const next = new Set(prev);
        next.delete(person.id);
        return next;
      });
      toast.error(`Sync failed: ${error.message}`);
    },
  });

  const capturePhotoMutation = useMutation({
    mutationFn: async (person: SyncPerson) => {
      if (!person.mipsPersonId) throw new Error("Person not synced to MIPS yet");
      setCapturingIds((prev) => new Set(prev).add(person.id));

      // Get online devices
      const deviceIds = await fetchOnlineDeviceIds();
      if (deviceIds.length === 0) throw new Error("No online devices found");

      // Use the first online device for photo capture
      const mipsId = Number(person.mipsPersonId);
      if (isNaN(mipsId)) throw new Error("Invalid MIPS person ID");

      return capturePhoto(mipsId, deviceIds[0]);
    },
    onSuccess: (result, person) => {
      setCapturingIds((prev) => {
        const next = new Set(prev);
        next.delete(person.id);
        return next;
      });
      if (result.success) {
        toast.success(`Photo capture triggered for ${person.name}`);
      } else {
        toast.error(`Capture failed: ${result.message}`);
      }
    },
    onError: (error: Error, person) => {
      setCapturingIds((prev) => {
        const next = new Set(prev);
        next.delete(person.id);
        return next;
      });
      toast.error(`Capture failed: ${error.message}`);
    },
  });

  const bulkSyncMutation = useMutation({
    mutationFn: async () => {
      const pending = filtered.filter((p) => p.mipsSyncStatus !== "synced" && p.hasPhoto);
      let successCount = 0;
      for (const person of pending) {
        try {
          const result = await syncPersonToMIPS(person.type, person.id, branchId);
          if (result.success) successCount++;
        } catch (e) {
          console.warn(`Failed to sync ${person.name}:`, e);
        }
      }
      return { total: pending.length, success: successCount };
    },
    onSuccess: ({ total, success }) => {
      toast.success(`Bulk sync complete: ${success}/${total} synced`);
      queryClient.invalidateQueries({ queryKey: ["personnel-sync"] });
    },
    onError: (error: Error) => {
      toast.error(`Bulk sync failed: ${error.message}`);
    },
  });

  const filtered = personnel.filter((p) => {
    const matchSearch =
      !searchTerm ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus =
      statusFilter === "all" || p.mipsSyncStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: personnel.length,
    synced: personnel.filter((p) => p.mipsSyncStatus === "synced").length,
    pending: personnel.filter((p) => p.mipsSyncStatus === "pending").length,
    failed: personnel.filter((p) => p.mipsSyncStatus === "failed").length,
    noPhoto: personnel.filter((p) => !p.hasPhoto).length,
  };

  const getSyncBadge = (status: string | null) => {
    switch (status) {
      case "synced":
        return <Badge variant="default" className="bg-green-500/10 text-green-700 border-green-500/20 text-[10px]"><Check className="h-3 w-3 mr-1" />Synced</Badge>;
      case "failed":
        return <Badge variant="destructive" className="text-[10px]"><X className="h-3 w-3 mr-1" />Failed</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px] bg-orange-500/10 text-orange-700 border-orange-500/20"><AlertCircle className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1">Total: {stats.total}</Badge>
        <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-700 border-green-500/20">Synced: {stats.synced}</Badge>
        <Badge variant="outline" className="gap-1 bg-orange-500/10 text-orange-700 border-orange-500/20">Pending: {stats.pending}</Badge>
        <Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/20">Failed: {stats.failed}</Badge>
        <Badge variant="outline" className="gap-1 bg-muted">No Photo: {stats.noPhoto}</Badge>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="synced">Synced</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="default"
          size="sm"
          onClick={() => bulkSyncMutation.mutate()}
          disabled={bulkSyncMutation.isPending}
        >
          <Upload className={`h-4 w-4 mr-1.5 ${bulkSyncMutation.isPending ? "animate-pulse" : ""}`} />
          {bulkSyncMutation.isPending ? "Syncing..." : "Sync All"}
        </Button>
      </div>

      {/* Personnel list */}
      <ScrollArea className="h-[500px]">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 text-muted-foreground">
            <Users className="h-10 w-10 mb-3 opacity-40" />
            <p className="text-sm">No personnel found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map((person) => (
              <div
                key={`${person.type}-${person.id}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors"
              >
                <Avatar className="h-9 w-9">
                  {person.avatarUrl ? (
                    <AvatarImage src={person.avatarUrl} />
                  ) : null}
                  <AvatarFallback className="text-xs">
                    {person.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{person.name}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {person.type === "member" ? "Member" : "Staff"}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <span className="font-mono">{person.code}</span>
                    {!person.hasPhoto && (
                      <span className="flex items-center gap-0.5 text-orange-600">
                        <Image className="h-3 w-3" /> No Photo
                      </span>
                    )}
                    {person.mipsPersonId && (
                      <span className="font-mono text-primary">MIPS: {person.mipsPersonId}</span>
                    )}
                  </div>
                </div>

                {getSyncBadge(person.mipsSyncStatus)}

                {/* Capture Face button — only for synced persons */}
                {person.mipsSyncStatus === "synced" && person.mipsPersonId && (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={capturingIds.has(person.id)}
                    onClick={() => capturePhotoMutation.mutate(person)}
                    className="shrink-0"
                    title="Capture face photo from device"
                  >
                    <Camera className={`h-3.5 w-3.5 ${capturingIds.has(person.id) ? "animate-pulse" : ""}`} />
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  disabled={syncingIds.has(person.id) || !person.hasPhoto}
                  onClick={() => syncMutation.mutate(person)}
                  className="shrink-0"
                >
                  <Upload className={`h-3.5 w-3.5 ${syncingIds.has(person.id) ? "animate-pulse" : ""}`} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default PersonnelSyncTab;

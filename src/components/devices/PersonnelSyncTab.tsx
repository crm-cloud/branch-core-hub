import { useState, useRef } from "react";
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
  ShieldCheck, ShieldX, RotateCw, ImagePlus,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  syncPersonToMIPS, capturePhoto, fetchOnlineDeviceIds,
  verifyPersonOnMIPS, fetchAllMIPSPersons,
} from "@/services/mipsService";
import { toast } from "sonner";

interface PersonnelSyncTabProps {
  branchId?: string;
  mainBranchId?: string;
}

interface SyncPerson {
  id: string;
  name: string;
  code: string;
  type: "member" | "employee" | "trainer";
  hasPhoto: boolean;
  avatarUrl: string | null;
  mipsSyncStatus: string | null;
  mipsPersonId: string | null;
  verifiedOnDevice?: boolean | null;
  branchId?: string;
}

const PersonnelSyncTab = ({ branchId, mainBranchId }: PersonnelSyncTabProps) => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());
  const [verifyingIds, setVerifyingIds] = useState<Set<string>>(new Set());
  const [capturingIds, setCapturingIds] = useState<Set<string>>(new Set());
  const [uploadingIds, setUploadingIds] = useState<Set<string>>(new Set());
  const [verificationMap, setVerificationMap] = useState<Record<string, boolean>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetPerson, setUploadTargetPerson] = useState<SyncPerson | null>(null);

  const { data: personnel = [], isLoading } = useQuery({
    queryKey: ["personnel-sync", branchId],
    queryFn: async () => {
      const people: SyncPerson[] = [];

      // Fetch members
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
            branchId: m.branch_id,
          });
        }
      }

      // Fetch employees
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

      // Fetch trainers
      let trainerQuery = supabase
        .from("trainers")
        .select("id, biometric_photo_url, mips_person_id, mips_sync_status, branch_id, is_active, profiles:user_id(full_name, avatar_url)")
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (branchId) trainerQuery = trainerQuery.eq("branch_id", branchId);
      const { data: trainers } = await trainerQuery;
      if (trainers) {
        for (const t of trainers) {
          const profile = (t as any).profiles as any;
          people.push({
            id: t.id,
            name: profile?.full_name || "Unknown",
            code: `TRN-${t.id.substring(0, 4).toUpperCase()}`,
            type: "trainer",
            hasPhoto: !!(t.biometric_photo_url || profile?.avatar_url),
            avatarUrl: profile?.avatar_url || null,
            mipsSyncStatus: t.mips_sync_status || "pending",
            mipsPersonId: t.mips_person_id || null,
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
      setSyncingIds((prev) => { const n = new Set(prev); n.delete(person.id); return n; });
      if (result.success) {
        toast.success(`${person.name} synced to MIPS`);
        setVerificationMap((prev) => { const n = { ...prev }; delete n[person.id]; return n; });
      } else {
        toast.error(`Sync failed: ${result.error || "Unknown error"}`);
      }
      queryClient.invalidateQueries({ queryKey: ["personnel-sync"] });
    },
    onError: (error: Error, person) => {
      setSyncingIds((prev) => { const n = new Set(prev); n.delete(person.id); return n; });
      toast.error(`Sync failed: ${error.message}`);
    },
  });

  const handleVerify = async (person: SyncPerson) => {
    setVerifyingIds((prev) => new Set(prev).add(person.id));
    try {
      const result = await verifyPersonOnMIPS(person.code);
      setVerificationMap((prev) => ({ ...prev, [person.id]: result.exists }));
      if (result.exists) {
        toast.success(`${person.name} verified on MIPS device (ID: ${result.mipsId})`);
      } else {
        toast.warning(`${person.name} NOT found on MIPS — re-sync recommended`);
      }
    } catch (e) {
      toast.error(`Verify failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setVerifyingIds((prev) => { const n = new Set(prev); n.delete(person.id); return n; });
    }
  };

  const handleBulkVerify = async () => {
    const synced = personnel.filter((p) => p.mipsSyncStatus === "synced");
    if (synced.length === 0) {
      toast.info("No synced personnel to verify");
      return;
    }
    toast.info(`Verifying ${synced.length} synced personnel against MIPS...`);
    try {
      const allMIPS = await fetchAllMIPSPersons();
      const mipsNos = new Set(allMIPS.map((e) => e.personSn));
      const newMap: Record<string, boolean> = {};
      let verified = 0, missing = 0;
      for (const p of synced) {
        const stripped = p.code.replace(/-/g, "");
        const found = mipsNos.has(stripped);
        newMap[p.id] = found;
        if (found) verified++; else missing++;
      }
      setVerificationMap((prev) => ({ ...prev, ...newMap }));
      toast.success(`Verified: ${verified} present, ${missing} missing on MIPS`);
    } catch (e) {
      toast.error(`Bulk verify failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const bulkSyncMutation = useMutation({
    mutationFn: async (mode: "pending" | "stale" | "all") => {
      let targets: SyncPerson[];
      if (mode === "pending") {
        targets = filtered.filter((p) => p.mipsSyncStatus !== "synced");
      } else if (mode === "stale") {
        targets = filtered.filter((p) => p.mipsSyncStatus === "synced" && verificationMap[p.id] === false);
      } else {
        targets = filtered;
      }
      if (targets.length === 0) return { total: 0, success: 0 };
      let successCount = 0;
      for (const person of targets) {
        try {
          const result = await syncPersonToMIPS(person.type, person.id, branchId);
          if (result.success) successCount++;
        } catch (e) {
          console.warn(`Failed to sync ${person.name}:`, e);
        }
      }
      return { total: targets.length, success: successCount };
    },
    onSuccess: ({ total, success }) => {
      if (total === 0) toast.info("No personnel to sync in this category");
      else toast.success(`Bulk sync complete: ${success}/${total} synced`);
      queryClient.invalidateQueries({ queryKey: ["personnel-sync"] });
      setVerificationMap({});
    },
    onError: (error: Error) => {
      toast.error(`Bulk sync failed: ${error.message}`);
    },
  });

  const capturePhotoMutation = useMutation({
    mutationFn: async (person: SyncPerson) => {
      if (!person.mipsPersonId) throw new Error("Person not synced to MIPS yet");
      setCapturingIds((prev) => new Set(prev).add(person.id));
      const deviceIds = await fetchOnlineDeviceIds();
      if (deviceIds.length === 0) throw new Error("No online devices found");
      const mipsId = Number(person.mipsPersonId);
      if (isNaN(mipsId)) throw new Error("Invalid MIPS person ID");
      return capturePhoto(mipsId, deviceIds[0]);
    },
    onSuccess: (result, person) => {
      setCapturingIds((prev) => { const n = new Set(prev); n.delete(person.id); return n; });
      if (result.success) toast.success(`Photo capture triggered for ${person.name}`);
      else toast.error(`Capture failed: ${result.message}`);
    },
    onError: (error: Error, person) => {
      setCapturingIds((prev) => { const n = new Set(prev); n.delete(person.id); return n; });
      toast.error(`Capture failed: ${error.message}`);
    },
  });

  const handlePhotoUpload = async (file: File, person: SyncPerson) => {
    setUploadingIds((prev) => new Set(prev).add(person.id));
    try {
      const filePath = `${person.id}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("member-photos")
        .upload(filePath, file, { upsert: true, contentType: "image/jpeg" });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("member-photos")
        .getPublicUrl(filePath);

      const table = person.type === "member" ? "members" : person.type === "trainer" ? "trainers" : "employees";
      await supabase.from(table).update({ biometric_photo_url: urlData.publicUrl }).eq("id", person.id);

      toast.success(`Photo uploaded for ${person.name}, triggering sync...`);
      queryClient.invalidateQueries({ queryKey: ["personnel-sync"] });

      const result = await syncPersonToMIPS(person.type, person.id, branchId);
      if (result.success) toast.success(`${person.name} synced with new photo`);
      else toast.error(`Sync after upload failed: ${result.error}`);
    } catch (e) {
      toast.error(`Upload failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setUploadingIds((prev) => { const n = new Set(prev); n.delete(person.id); return n; });
      setUploadTargetPerson(null);
    }
  };

  const filtered = personnel.filter((p) => {
    const matchSearch =
      !searchTerm ||
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchStatus =
      statusFilter === "all" || p.mipsSyncStatus === statusFilter;
    const matchType =
      typeFilter === "all" || p.type === typeFilter;
    return matchSearch && matchStatus && matchType;
  });

  const stats = {
    total: personnel.length,
    synced: personnel.filter((p) => p.mipsSyncStatus === "synced").length,
    pending: personnel.filter((p) => p.mipsSyncStatus === "pending").length,
    failed: personnel.filter((p) => p.mipsSyncStatus === "failed").length,
    noPhoto: personnel.filter((p) => !p.hasPhoto).length,
    members: personnel.filter((p) => p.type === "member").length,
    staff: personnel.filter((p) => p.type === "employee").length,
    trainers: personnel.filter((p) => p.type === "trainer").length,
  };

  const staleCount = Object.values(verificationMap).filter((v) => v === false).length;

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

  const getTypeBadge = (type: string) => {
    switch (type) {
      case "member":
        return <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-700 border-blue-500/20">Member</Badge>;
      case "employee":
        return <Badge variant="outline" className="text-[10px] bg-purple-500/10 text-purple-700 border-purple-500/20">Staff</Badge>;
      case "trainer":
        return <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-700 border-amber-500/20">Trainer</Badge>;
      default:
        return null;
    }
  };

  const getVerifyBadge = (personId: string) => {
    const status = verificationMap[personId];
    if (status === undefined) return null;
    if (status) {
      return <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-700 border-emerald-500/20"><ShieldCheck className="h-3 w-3 mr-0.5" />On Device</Badge>;
    }
    return <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-700 border-red-500/20"><ShieldX className="h-3 w-3 mr-0.5" />Missing</Badge>;
  };

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file && uploadTargetPerson) handlePhotoUpload(file, uploadTargetPerson);
          e.target.value = "";
        }}
      />

      {/* Stats bar */}
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1">Total: {stats.total}</Badge>
        <Badge variant="outline" className="gap-1 bg-blue-500/10 text-blue-700 border-blue-500/20">Members: {stats.members}</Badge>
        <Badge variant="outline" className="gap-1 bg-purple-500/10 text-purple-700 border-purple-500/20">Staff: {stats.staff}</Badge>
        <Badge variant="outline" className="gap-1 bg-amber-500/10 text-amber-700 border-amber-500/20">Trainers: {stats.trainers}</Badge>
        <Badge variant="outline" className="gap-1 bg-green-500/10 text-green-700 border-green-500/20">Synced: {stats.synced}</Badge>
        <Badge variant="outline" className="gap-1 bg-orange-500/10 text-orange-700 border-orange-500/20">Pending: {stats.pending}</Badge>
        <Badge variant="outline" className="gap-1 bg-destructive/10 text-destructive border-destructive/20">Failed: {stats.failed}</Badge>
        {staleCount > 0 && (
          <Badge variant="outline" className="gap-1 bg-red-500/10 text-red-700 border-red-500/20">Stale: {staleCount}</Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
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
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="member">Members</SelectItem>
            <SelectItem value="employee">Staff</SelectItem>
            <SelectItem value="trainer">Trainers</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions */}
      <div className="flex flex-wrap gap-2">
        <Button variant="default" size="sm" onClick={() => bulkSyncMutation.mutate("pending")} disabled={bulkSyncMutation.isPending}>
          <Upload className={`h-4 w-4 mr-1.5 ${bulkSyncMutation.isPending ? "animate-pulse" : ""}`} />
          Sync All Pending
        </Button>
        <Button variant="outline" size="sm" onClick={handleBulkVerify}>
          <ShieldCheck className="h-4 w-4 mr-1.5" />
          Verify All Synced
        </Button>
        {staleCount > 0 && (
          <Button variant="destructive" size="sm" onClick={() => bulkSyncMutation.mutate("stale")} disabled={bulkSyncMutation.isPending}>
            <RotateCw className={`h-4 w-4 mr-1.5 ${bulkSyncMutation.isPending ? "animate-pulse" : ""}`} />
            Re-sync {staleCount} Stale
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={() => bulkSyncMutation.mutate("all")} disabled={bulkSyncMutation.isPending}>
          <RefreshCw className="h-4 w-4 mr-1.5" />
          Re-sync All
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
            {filtered.map((person) => {
              const strippedCode = person.code.replace(/-/g, "");
              return (
                <div
                  key={`${person.type}-${person.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border"
                >
                  <Avatar className="h-9 w-9">
                    {person.avatarUrl ? <AvatarImage src={person.avatarUrl} /> : null}
                    <AvatarFallback className="text-xs">
                      {person.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{person.name}</span>
                      {getTypeBadge(person.type)}
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span className="font-mono">{person.code}</span>
                      <span className="text-primary font-mono">→ {strippedCode}</span>
                      {!person.hasPhoto && (
                        <span className="flex items-center gap-0.5 text-orange-600">
                          <Image className="h-3 w-3" /> No Photo
                        </span>
                      )}
                      {person.mipsPersonId && (
                        <span className="font-mono text-primary/70">MIPS#{person.mipsPersonId}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {getSyncBadge(person.mipsSyncStatus)}
                    {getVerifyBadge(person.id)}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={verifyingIds.has(person.id)} onClick={() => handleVerify(person)} title="Verify on MIPS device">
                      <ShieldCheck className={`h-3.5 w-3.5 ${verifyingIds.has(person.id) ? "animate-pulse" : ""}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={uploadingIds.has(person.id)} onClick={() => { setUploadTargetPerson(person); fileInputRef.current?.click(); }} title="Upload face photo">
                      <ImagePlus className={`h-3.5 w-3.5 ${uploadingIds.has(person.id) ? "animate-pulse" : ""}`} />
                    </Button>
                    {person.mipsSyncStatus === "synced" && person.mipsPersonId && (
                      <Button variant="ghost" size="icon" className="h-8 w-8" disabled={capturingIds.has(person.id)} onClick={() => capturePhotoMutation.mutate(person)} title="Capture face from device camera">
                        <Camera className={`h-3.5 w-3.5 ${capturingIds.has(person.id) ? "animate-pulse" : ""}`} />
                      </Button>
                    )}
                    <Button variant="outline" size="sm" disabled={syncingIds.has(person.id)} onClick={() => syncMutation.mutate(person)} className="shrink-0" title="Sync to MIPS">
                      <Upload className={`h-3.5 w-3.5 ${syncingIds.has(person.id) ? "animate-pulse" : ""}`} />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default PersonnelSyncTab;

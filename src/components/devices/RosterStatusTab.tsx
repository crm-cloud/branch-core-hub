import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Camera, CheckCircle2, XCircle, User, Shield, Dumbbell } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface RosterStatusTabProps {
  branchId?: string;
}

interface PersonnelRow {
  id: string;
  name: string;
  role: 'member' | 'staff' | 'trainer';
  hasPhoto: boolean;
  photoUrl: string | null;
  enrolled: boolean;
  expiryDate: string | null;
  code: string | null;
}

const RosterStatusTab = ({ branchId }: RosterStatusTabProps) => {
  const { data: personnel = [], isLoading } = useQuery({
    queryKey: ["roster-status", branchId],
    queryFn: async () => {
      const rows: PersonnelRow[] = [];

      // Members
      let mQuery = supabase
        .from("members")
        .select("id, user_id, member_code, biometric_photo_url, biometric_enrolled, status, hardware_access_enabled")
        .eq("status", "active")
        .eq("hardware_access_enabled", true);
      if (branchId) mQuery = mQuery.eq("branch_id", branchId);
      const { data: members } = await mQuery;

      const memberUserIds = (members || []).map((m) => m.user_id).filter(Boolean);
      let profileMap: Record<string, { name: string; avatar: string | null }> = {};
      if (memberUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", memberUserIds);
        profileMap = (profiles || []).reduce((acc: Record<string, { name: string; avatar: string | null }>, p) => {
          acc[p.id] = { name: p.full_name || "Member", avatar: p.avatar_url || null };
          return acc;
        }, {});
      }

      // Get membership expiry
      const memberIds = (members || []).map((m) => m.id);
      let expiryMap: Record<string, string | null> = {};
      if (memberIds.length > 0) {
        const { data: memberships } = await supabase
          .from("memberships")
          .select("member_id, end_date")
          .in("member_id", memberIds)
          .eq("status", "active")
          .order("end_date", { ascending: false });
        for (const ms of memberships || []) {
          if (!(ms.member_id in expiryMap)) {
            expiryMap[ms.member_id] = ms.end_date;
          }
        }
      }

      for (const m of members || []) {
        const info = profileMap[m.user_id] || { name: "Member", avatar: null };
        const photo = m.biometric_photo_url || info.avatar || null;
        rows.push({
          id: m.id,
          name: info.name,
          role: "member",
          hasPhoto: !!photo,
          photoUrl: photo,
          enrolled: m.biometric_enrolled === true,
          expiryDate: expiryMap[m.id] || null,
          code: m.member_code,
        });
      }

      // Staff
      let sQuery = supabase
        .from("employees")
        .select("id, user_id, employee_code, biometric_photo_url, biometric_enrolled")
        .eq("is_active", true);
      if (branchId) sQuery = sQuery.eq("branch_id", branchId);
      const { data: staff } = await sQuery;

      const staffUserIds = (staff || []).map((s) => s.user_id).filter(Boolean);
      let staffProfileMap: Record<string, { name: string; avatar: string | null }> = {};
      if (staffUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", staffUserIds);
        staffProfileMap = (profiles || []).reduce((acc: Record<string, { name: string; avatar: string | null }>, p) => {
          acc[p.id] = { name: p.full_name || "Staff", avatar: p.avatar_url || null };
          return acc;
        }, {});
      }

      for (const s of staff || []) {
        const info = staffProfileMap[s.user_id] || { name: "Staff", avatar: null };
        const photo = s.biometric_photo_url || info.avatar || null;
        rows.push({
          id: s.id,
          name: info.name,
          role: "staff",
          hasPhoto: !!photo,
          photoUrl: photo,
          enrolled: s.biometric_enrolled === true,
          expiryDate: null,
          code: s.employee_code,
        });
      }

      // Trainers
      let tQuery = supabase
        .from("trainers")
        .select("id, user_id, biometric_enrolled")
        .eq("is_active", true);
      if (branchId) tQuery = tQuery.eq("branch_id", branchId);
      const { data: trainersData } = await tQuery;

      const trainerUserIds = (trainersData || []).map((t) => t.user_id).filter(Boolean);
      const existingIds = new Set(rows.map((r) => r.id));
      let trainerProfileMap: Record<string, { name: string; avatar: string | null }> = {};
      if (trainerUserIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url")
          .in("id", trainerUserIds);
        trainerProfileMap = (profiles || []).reduce((acc: Record<string, { name: string; avatar: string | null }>, p) => {
          acc[p.id] = { name: p.full_name || "Trainer", avatar: p.avatar_url || null };
          return acc;
        }, {});
      }

      for (const t of trainersData || []) {
        if (existingIds.has(t.id)) continue;
        const info = trainerProfileMap[t.user_id] || { name: "Trainer", avatar: null };
        rows.push({
          id: t.id,
          name: info.name,
          role: "trainer",
          hasPhoto: !!info.avatar,
          photoUrl: info.avatar,
          enrolled: t.biometric_enrolled === true,
          expiryDate: null,
          code: null,
        });
      }

      return rows;
    },
  });

  const roleIcon = (role: string) => {
    switch (role) {
      case "member": return <User className="h-3 w-3" />;
      case "staff": return <Shield className="h-3 w-3" />;
      case "trainer": return <Dumbbell className="h-3 w-3" />;
      default: return <User className="h-3 w-3" />;
    }
  };

  const roleBadgeColor = (role: string) => {
    switch (role) {
      case "member": return "bg-primary/10 text-primary border-primary/20";
      case "staff": return "bg-blue-500/10 text-blue-700 border-blue-500/20";
      case "trainer": return "bg-orange-500/10 text-orange-700 border-orange-500/20";
      default: return "";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  const withPhoto = personnel.filter((p) => p.hasPhoto).length;
  const enrolled = personnel.filter((p) => p.enrolled).length;

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Total Personnel</p>
          <p className="text-xl font-bold">{personnel.length}</p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">With Photo</p>
          <p className="text-xl font-bold">{withPhoto}</p>
        </div>
        <div className="rounded-xl border bg-card p-3">
          <p className="text-xs text-muted-foreground">Enrolled</p>
          <p className="text-xl font-bold text-green-600">{enrolled}</p>
        </div>
      </div>

      {/* List */}
      <ScrollArea className="h-[400px]">
        <div className="space-y-2">
          {personnel.map((person) => (
            <div
              key={person.id}
              className="flex items-center gap-3 rounded-xl border bg-card p-3 hover:shadow-sm transition-shadow"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={person.photoUrl || undefined} />
                <AvatarFallback className="bg-muted text-xs">
                  {person.name?.charAt(0)?.toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{person.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${roleBadgeColor(person.role)}`}>
                    {roleIcon(person.role)}
                    <span className="ml-1 capitalize">{person.role}</span>
                  </Badge>
                  {person.code && (
                    <span className="text-[10px] text-muted-foreground font-mono">{person.code}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* Photo status */}
                {person.hasPhoto ? (
                  <Camera className="h-4 w-4 text-green-500" />
                ) : (
                  <Camera className="h-4 w-4 text-muted-foreground/40" />
                )}

                {/* Enrolled status */}
                {person.enrolled ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : (
                  <XCircle className="h-4 w-4 text-muted-foreground/40" />
                )}

                {/* Expiry */}
                {person.expiryDate && (
                  <span className={`text-[10px] font-mono ${
                    new Date(person.expiryDate) < new Date() ? "text-destructive" : "text-muted-foreground"
                  }`}>
                    {new Date(person.expiryDate).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          ))}

          {personnel.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-10 w-10 mx-auto mb-2 opacity-40" />
              <p className="text-sm">No personnel found</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default RosterStatusTab;
import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Mail, Phone, Award, Users, Target } from "lucide-react";
import { useTrainers, useCreateTrainer, useDeactivateTrainer } from "@/hooks/useTrainers";
import { useBranches } from "@/hooks/useBranches";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { Progress } from "@/components/ui/progress";
export default function TrainersPage() {
  const { data: branches } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [newTrainer, setNewTrainer] = useState({
    user_id: "",
    specializations: "",
    certifications: "",
    bio: "",
    hourly_rate: 0,
  });
  const [availableUsers, setAvailableUsers] = useState<{ id: string; email: string; full_name: string | null }[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const branchId = selectedBranch || branches?.[0]?.id || "";
  const { data: trainers, isLoading } = useTrainers(branchId, !showInactive);
  const createTrainer = useCreateTrainer();
  const deactivateTrainer = useDeactivateTrainer();

  // Fetch PT client counts per trainer
  const { data: ptClientCounts = {} } = useQuery({
    queryKey: ['pt-client-counts', branchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_pt_packages')
        .select('trainer_id')
        .eq('branch_id', branchId)
        .eq('status', 'active');
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      data?.forEach(pkg => {
        if (pkg.trainer_id) {
          counts[pkg.trainer_id] = (counts[pkg.trainer_id] || 0) + 1;
        }
      });
      return counts;
    },
    enabled: !!branchId,
  });

  const loadAvailableUsers = async () => {
    setLoadingUsers(true);
    try {
      // Get users with trainer role who don't already have a trainer profile in this branch
      const { data: existingTrainers } = await supabase
        .from("trainers")
        .select("user_id")
        .eq("branch_id", branchId);

      const existingUserIds = (existingTrainers || []).map((t) => t.user_id);

      const { data: users } = await supabase
        .from("profiles")
        .select("id, email, full_name")
        .eq("is_active", true);

      const filtered = (users || []).filter((u) => !existingUserIds.includes(u.id));
      setAvailableUsers(filtered);
    } catch (error) {
      console.error("Failed to load users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleOpenCreate = () => {
    loadAvailableUsers();
    setIsCreateOpen(true);
  };

  const handleCreateTrainer = async () => {
    if (!newTrainer.user_id || !branchId) {
      toast.error("Please select a user");
      return;
    }

    try {
      await createTrainer.mutateAsync({
        branch_id: branchId,
        user_id: newTrainer.user_id,
        specializations: newTrainer.specializations
          ? newTrainer.specializations.split(",").map((s) => s.trim())
          : null,
        certifications: newTrainer.certifications
          ? newTrainer.certifications.split(",").map((s) => s.trim())
          : null,
        bio: newTrainer.bio || null,
        hourly_rate: newTrainer.hourly_rate || null,
      });
      toast.success("Trainer profile created");
      setIsCreateOpen(false);
      setNewTrainer({
        user_id: "",
        specializations: "",
        certifications: "",
        bio: "",
        hourly_rate: 0,
      });
    } catch (error) {
      toast.error("Failed to create trainer profile");
    }
  };

  const handleDeactivate = async (trainerId: string) => {
    try {
      await deactivateTrainer.mutateAsync(trainerId);
      toast.success("Trainer deactivated");
    } catch (error) {
      toast.error("Failed to deactivate trainer");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Trainers</h1>
            <p className="text-muted-foreground">Manage trainers and their profiles</p>
          </div>
          <div className="flex items-center gap-4">
            {branches && branches.length > 1 && (
              <Select value={selectedBranch || branches[0]?.id} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Button variant="outline" onClick={() => setShowInactive(!showInactive)}>
              {showInactive ? "Hide Inactive" : "Show Inactive"}
            </Button>
            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button onClick={handleOpenCreate}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Trainer
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                  <DialogTitle>Add Trainer Profile</DialogTitle>
                  <DialogDescription>
                    Link an existing user as a trainer for this branch
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="user">User *</Label>
                    <Select
                      value={newTrainer.user_id}
                      onValueChange={(value) => setNewTrainer({ ...newTrainer, user_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loadingUsers ? "Loading..." : "Select user"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUsers.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            {user.full_name || user.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="specializations">Specializations</Label>
                    <Input
                      id="specializations"
                      value={newTrainer.specializations}
                      onChange={(e) => setNewTrainer({ ...newTrainer, specializations: e.target.value })}
                      placeholder="Yoga, HIIT, Strength (comma-separated)"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="certifications">Certifications</Label>
                    <Input
                      id="certifications"
                      value={newTrainer.certifications}
                      onChange={(e) => setNewTrainer({ ...newTrainer, certifications: e.target.value })}
                      placeholder="ACE, NASM, CPR (comma-separated)"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="hourly_rate">Hourly Rate</Label>
                    <Input
                      id="hourly_rate"
                      type="number"
                      value={newTrainer.hourly_rate}
                      onChange={(e) => setNewTrainer({ ...newTrainer, hourly_rate: parseFloat(e.target.value) || 0 })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="bio">Bio</Label>
                    <Textarea
                      id="bio"
                      value={newTrainer.bio}
                      onChange={(e) => setNewTrainer({ ...newTrainer, bio: e.target.value })}
                      placeholder="Trainer bio and experience..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleCreateTrainer} disabled={createTrainer.isPending}>
                    {createTrainer.isPending ? "Creating..." : "Add Trainer"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading trainers...</div>
        ) : trainers?.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No trainers found. Add your first trainer to get started.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {trainers?.map((trainer) => (
              <Card key={trainer.id} className={!trainer.is_active ? "opacity-60" : ""}>
                <CardHeader>
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarImage src={trainer.profile_avatar || undefined} />
                      <AvatarFallback>
                        {(trainer.profile_name || trainer.profile_email || "T").slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <CardTitle className="text-lg">{trainer.profile_name || "Unknown"}</CardTitle>
                      <CardDescription className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {trainer.profile_email}
                      </CardDescription>
                    </div>
                    {!trainer.is_active && <Badge variant="outline">Inactive</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* PT Client Ratio */}
                  {(() => {
                    const activeClients = ptClientCounts[trainer.id] || 0;
                    const maxClients = (trainer as any).max_clients || 10;
                    const utilization = Math.min((activeClients / maxClients) * 100, 100);
                    return (
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5 text-muted-foreground" />
                            PT Clients
                          </span>
                          <span className="font-medium">
                            {activeClients}/{maxClients}
                          </span>
                        </div>
                        <Progress value={utilization} className="h-2" />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{utilization.toFixed(0)}% capacity</span>
                          {utilization >= 80 && (
                            <Badge variant="destructive" className="text-xs">Near Full</Badge>
                          )}
                        </div>
                      </div>
                    );
                  })()}

                  {trainer.profile_phone && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{trainer.profile_phone}</span>
                    </div>
                  )}
                  {trainer.specializations && trainer.specializations.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {trainer.specializations.map((spec, idx) => (
                        <Badge key={idx} variant="secondary">
                          {spec}
                        </Badge>
                      ))}
                    </div>
                  )}
                  {trainer.certifications && trainer.certifications.length > 0 && (
                    <div className="flex items-center gap-2 text-sm">
                      <Award className="h-4 w-4 text-muted-foreground" />
                      <span>{trainer.certifications.join(", ")}</span>
                    </div>
                  )}
                  {trainer.bio && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{trainer.bio}</p>
                  )}
                  {trainer.hourly_rate && (
                    <p className="text-sm font-medium">₹{trainer.hourly_rate}/hour</p>
                  )}
                  {trainer.is_active && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full mt-2"
                      onClick={() => handleDeactivate(trainer.id)}
                    >
                      Deactivate
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}

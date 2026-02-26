import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Mail, Phone, Award, Users, DollarSign, Calendar, Edit } from "lucide-react";
import { useBranchContext } from '@/contexts/BranchContext';
import { useTrainers, useDeactivateTrainer } from '@/hooks/useTrainers';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Progress } from '@/components/ui/progress';
import { AddTrainerDrawer } from '@/components/trainers/AddTrainerDrawer';
import { TrainerProfileDrawer } from '@/components/trainers/TrainerProfileDrawer';
import { EditTrainerDrawer } from '@/components/trainers/EditTrainerDrawer';
import { StatCard } from '@/components/ui/stat-card';

export default function TrainersPage() {
  const { effectiveBranchId, branchFilter } = useBranchContext();
  const branchId = branchFilter || effectiveBranchId || '';
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [selectedTrainer, setSelectedTrainer] = useState<any>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingTrainer, setEditingTrainer] = useState<any>(null);
  const { data: trainers, isLoading } = useTrainers(branchId, !showInactive);
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

  // Fetch total revenue this month
  const { data: monthlyRevenue = 0 } = useQuery({
    queryKey: ['trainers-monthly-revenue', branchId],
    queryFn: async () => {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      const { data, error } = await supabase
        .from('trainer_commissions')
        .select('amount')
        .gte('created_at', startOfMonth.toISOString());
      
      if (error) throw error;
      return (data || []).reduce((sum, c) => sum + (c.amount || 0), 0);
    },
    enabled: !!branchId,
  });

  const openTrainerProfile = (trainer: any) => {
    setSelectedTrainer(trainer);
    setProfileOpen(true);
  };

  const openEditTrainer = (trainer: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingTrainer(trainer);
    setEditOpen(true);
  };

  const handleDeactivate = async (trainerId: string) => {
    try {
      await deactivateTrainer.mutateAsync(trainerId);
      toast.success("Trainer deactivated");
    } catch (error) {
      toast.error("Failed to deactivate trainer");
    }
  };

  const totalActiveClients = Object.values(ptClientCounts).reduce((sum: number, count: number) => sum + count, 0);
  const activeTrainers = trainers?.filter(t => t.is_active).length || 0;

  return (
    <AppLayout>
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Trainers</h1>
            <p className="text-muted-foreground">Manage trainers and their profiles</p>
          </div>
          <div className="flex items-center gap-4">
            {/* Branch selector moved to global header */}
            <Button variant="outline" onClick={() => setShowInactive(!showInactive)}>
              {showInactive ? "Hide Inactive" : "Show Inactive"}
            </Button>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Trainer
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            title="Total Trainers"
            value={activeTrainers}
            description="Active trainers"
            icon={Users}
          />
          <StatCard
            title="PT Clients"
            value={totalActiveClients}
            description="Active PT packages"
            icon={Users}
          />
          <StatCard
            title="Monthly Revenue"
            value={`₹${monthlyRevenue.toLocaleString()}`}
            description="From commissions"
            icon={DollarSign}
          />
          <StatCard
            title="Avg Utilization"
            value={`${activeTrainers > 0 ? Math.round((totalActiveClients / (activeTrainers * 10)) * 100) : 0}%`}
            description="Client capacity"
            icon={Calendar}
          />
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
              <Card 
                key={trainer.id} 
                className={`cursor-pointer transition-all hover:shadow-md ${!trainer.is_active ? "opacity-60" : ""}`}
                onClick={() => openTrainerProfile(trainer)}
              >
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
                    <div className="flex items-center gap-2">
                      {!trainer.is_active && <Badge variant="outline">Inactive</Badge>}
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={(e) => openEditTrainer(trainer, e)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
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
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add Trainer Drawer */}
        <AddTrainerDrawer
          open={isCreateOpen}
          onOpenChange={setIsCreateOpen}
          branchId={branchId}
        />

        {/* Trainer Profile Drawer */}
        <TrainerProfileDrawer
          open={profileOpen}
          onOpenChange={setProfileOpen}
          trainer={selectedTrainer}
          onDeactivate={handleDeactivate}
        />

        {/* Edit Trainer Drawer */}
        <EditTrainerDrawer
          open={editOpen}
          onOpenChange={setEditOpen}
          trainer={editingTrainer}
        />
      </div>
    </AppLayout>
  );
}

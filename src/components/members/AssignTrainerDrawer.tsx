import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dumbbell, Star, Users, Zap } from 'lucide-react';

interface AssignTrainerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  memberName: string;
  branchId: string;
  currentTrainerId?: string;
}

export function AssignTrainerDrawer({
  open,
  onOpenChange,
  memberId,
  memberName,
  branchId,
  currentTrainerId,
}: AssignTrainerDrawerProps) {
  const queryClient = useQueryClient();
  const [selectedTrainerId, setSelectedTrainerId] = useState<string>(currentTrainerId || '');

  // Fetch trainers with utilization
  const { data: trainers = [], isLoading } = useQuery({
    queryKey: ['trainers-utilization', branchId],
    queryFn: async () => {
      const { data: trainerList, error } = await supabase
        .from('trainers')
        .select('*')
        .eq('branch_id', branchId)
        .eq('is_active', true);

      if (error) throw error;

      // Get profile info and utilization for each trainer
      const trainersWithUtilization = await Promise.all(
        (trainerList || []).map(async (trainer: any) => {
          // Get profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('full_name, avatar_url')
            .eq('id', trainer.user_id)
            .single();

          // Count members assigned to this trainer
          const { count: assignedMembers } = await supabase
            .from('members')
            .select('id', { count: 'exact', head: true })
            .eq('assigned_trainer_id', trainer.id)
            .eq('status', 'active');

          // Count active PT packages
          const { count: ptClients } = await supabase
            .from('member_pt_packages')
            .select('id', { count: 'exact', head: true })
            .eq('trainer_id', trainer.id)
            .eq('status', 'active');

          const totalClients = (assignedMembers || 0) + (ptClients || 0);
          const maxClients = trainer.max_clients || 20;
          const utilization = Math.min(100, Math.round((totalClients / maxClients) * 100));

          return {
            ...trainer,
            profile,
            totalClients,
            maxClients,
            utilization,
          };
        })
      );

      // Sort by utilization (least busy first)
      return trainersWithUtilization.sort((a, b) => a.utilization - b.utilization);
    },
    enabled: open,
  });

  const assignMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('members')
        .update({ assigned_trainer_id: selectedTrainerId || null })
        .eq('id', memberId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(selectedTrainerId ? 'Trainer assigned successfully' : 'Trainer removed');
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({ queryKey: ['member-details'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to assign trainer');
    },
  });

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 90) return 'bg-destructive';
    if (utilization >= 70) return 'bg-warning';
    return 'bg-success';
  };

  const recommendedTrainer = trainers[0]; // Least utilized

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            Assign Trainer
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Member Info */}
          <Card className="bg-muted/50">
            <CardContent className="pt-4">
              <p className="font-medium">{memberName}</p>
              <p className="text-sm text-muted-foreground">General Training Assignment</p>
            </CardContent>
          </Card>

          {/* Auto-Recommendation */}
          {recommendedTrainer && !currentTrainerId && (
            <Card className="border-success/50 bg-success/5">
              <CardContent className="pt-4 flex items-center gap-3">
                <Zap className="h-5 w-5 text-success" />
                <div className="flex-1">
                  <p className="font-medium text-success">Recommended</p>
                  <p className="text-sm text-muted-foreground">
                    {recommendedTrainer.profile?.full_name} has the most availability
                  </p>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setSelectedTrainerId(recommendedTrainer.id)}
                >
                  Select
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Trainer List */}
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : (
            <RadioGroup value={selectedTrainerId} onValueChange={setSelectedTrainerId}>
              <div className="space-y-3">
                {/* No Trainer Option */}
                <Card className={`cursor-pointer transition-colors ${selectedTrainerId === 'none' || !selectedTrainerId ? 'border-primary bg-primary/5' : 'hover:bg-muted/50'}`}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <RadioGroupItem value="none" id="no-trainer" />
                      <Label htmlFor="no-trainer" className="flex-1 cursor-pointer">
                        <span className="font-medium">No Trainer Assigned</span>
                        <p className="text-sm text-muted-foreground">Member will not have a dedicated trainer</p>
                      </Label>
                    </div>
                  </CardContent>
                </Card>

                {trainers.map((trainer: any) => (
                  <Card 
                    key={trainer.id} 
                    className={`cursor-pointer transition-colors ${
                      selectedTrainerId === trainer.id 
                        ? 'border-primary bg-primary/5' 
                        : 'hover:bg-muted/50'
                    } ${trainer.utilization >= 100 ? 'opacity-50' : ''}`}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start gap-3">
                        <RadioGroupItem 
                          value={trainer.id} 
                          id={trainer.id} 
                          disabled={trainer.utilization >= 100}
                        />
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={trainer.profile?.avatar_url} />
                          <AvatarFallback>
                            {trainer.profile?.full_name?.charAt(0) || 'T'}
                          </AvatarFallback>
                        </Avatar>
                        <Label htmlFor={trainer.id} className="flex-1 cursor-pointer">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{trainer.profile?.full_name}</span>
                            {trainer.id === currentTrainerId && (
                              <Badge variant="outline" className="text-xs">Current</Badge>
                            )}
                          </div>
                          
                          {/* Utilization */}
                          
                          {/* Utilization */}
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {trainer.totalClients}/{trainer.maxClients} clients
                              </span>
                              <span className={trainer.utilization >= 90 ? 'text-destructive' : ''}>
                                {trainer.utilization}% busy
                              </span>
                            </div>
                            <Progress 
                              value={trainer.utilization} 
                              className={`h-1.5 ${getUtilizationColor(trainer.utilization)}`}
                            />
                          </div>

                          {trainer.utilization >= 100 && (
                            <p className="text-xs text-destructive mt-1">At capacity</p>
                          )}
                        </Label>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </RadioGroup>
          )}
        </div>

        <SheetFooter className="mt-6">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => assignMutation.mutate()}
            disabled={assignMutation.isPending}
          >
            {assignMutation.isPending ? 'Assigning...' : 'Assign Trainer'}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

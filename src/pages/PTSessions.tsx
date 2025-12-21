import { useState } from "react";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Package, Calendar, Check, X, Clock } from "lucide-react";
import { usePTPackages, useCreatePTPackage, useActiveMemberPackages, useTrainerSessions, useCompletePTSession, useCancelPTSession, useSchedulePTSession } from "@/hooks/usePTPackages";
import { useTrainers } from "@/hooks/useTrainers";
import { useBranches } from "@/hooks/useBranches";

export default function PTSessionsPage() {
  const { data: branches } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [isCreatePackageOpen, setIsCreatePackageOpen] = useState(false);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [selectedPackageForSession, setSelectedPackageForSession] = useState<string>("");
  const [newPackage, setNewPackage] = useState({
    name: "",
    description: "",
    total_sessions: 10,
    price: 0,
    validity_days: 90,
  });
  const [newSession, setNewSession] = useState({
    scheduled_at: "",
    duration_minutes: 60,
  });

  const branchId = selectedBranch || branches?.[0]?.id || "";
  const { data: packages, isLoading: packagesLoading } = usePTPackages(branchId);
  const { data: trainers } = useTrainers(branchId);
  const { data: activePackages } = useActiveMemberPackages(branchId);
  const createPackage = useCreatePTPackage();
  const scheduleSession = useSchedulePTSession();
  const completeSession = useCompletePTSession();
  const cancelSession = useCancelPTSession();

  // Get first trainer for demo purposes - in real app would select from active package
  const firstTrainerId = trainers?.[0]?.id;
  const { data: sessions } = useTrainerSessions(firstTrainerId || "", {
    startDate: new Date(),
  });

  const handleCreatePackage = async () => {
    if (!newPackage.name || !newPackage.price || !branchId) {
      toast.error("Please fill in required fields");
      return;
    }

    try {
      await createPackage.mutateAsync({
        ...newPackage,
        branch_id: branchId,
      });
      toast.success("PT Package created");
      setIsCreatePackageOpen(false);
      setNewPackage({
        name: "",
        description: "",
        total_sessions: 10,
        price: 0,
        validity_days: 90,
      });
    } catch (error) {
      toast.error("Failed to create package");
    }
  };

  const handleScheduleSession = async () => {
    const pkg = activePackages?.find((p) => p.id === selectedPackageForSession);
    if (!pkg || !newSession.scheduled_at) {
      toast.error("Please select a package and time");
      return;
    }

    try {
      await scheduleSession.mutateAsync({
        memberPackageId: pkg.id,
        trainerId: pkg.trainer_id!,
        branchId: pkg.branch_id,
        scheduledAt: new Date(newSession.scheduled_at),
        durationMinutes: newSession.duration_minutes,
      });
      toast.success("Session scheduled");
      setIsScheduleOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to schedule session");
    }
  };

  const handleCompleteSession = async (sessionId: string) => {
    try {
      const result = await completeSession.mutateAsync({ sessionId });
      if (result.success) {
        toast.success(`Session completed. ${result.sessions_remaining} sessions remaining`);
      } else {
        toast.error(result.error || "Failed to complete session");
      }
    } catch (error) {
      toast.error("Failed to complete session");
    }
  };

  const handleCancelSession = async (sessionId: string) => {
    try {
      await cancelSession.mutateAsync({ sessionId, reason: "Cancelled by staff" });
      toast.success("Session cancelled");
    } catch (error) {
      toast.error("Failed to cancel session");
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">PT Sessions</h1>
            <p className="text-muted-foreground">Manage personal training packages and sessions</p>
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
          </div>
        </div>

        <Tabs defaultValue="packages" className="space-y-4">
          <TabsList>
            <TabsTrigger value="packages">Packages</TabsTrigger>
            <TabsTrigger value="active">Active Packages</TabsTrigger>
            <TabsTrigger value="sessions">Sessions</TabsTrigger>
          </TabsList>

          <TabsContent value="packages" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={isCreatePackageOpen} onOpenChange={setIsCreatePackageOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Create Package
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create PT Package</DialogTitle>
                    <DialogDescription>Define a new personal training package</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Package Name *</Label>
                      <Input
                        value={newPackage.name}
                        onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                        placeholder="10 Sessions Package"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Sessions *</Label>
                        <Input
                          type="number"
                          value={newPackage.total_sessions}
                          onChange={(e) => setNewPackage({ ...newPackage, total_sessions: parseInt(e.target.value) || 10 })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Price (₹) *</Label>
                        <Input
                          type="number"
                          value={newPackage.price}
                          onChange={(e) => setNewPackage({ ...newPackage, price: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Validity (days)</Label>
                      <Input
                        type="number"
                        value={newPackage.validity_days}
                        onChange={(e) => setNewPackage({ ...newPackage, validity_days: parseInt(e.target.value) || 90 })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Description</Label>
                      <Input
                        value={newPackage.description}
                        onChange={(e) => setNewPackage({ ...newPackage, description: e.target.value })}
                        placeholder="Package details..."
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsCreatePackageOpen(false)}>Cancel</Button>
                    <Button onClick={handleCreatePackage} disabled={createPackage.isPending}>
                      {createPackage.isPending ? "Creating..." : "Create Package"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {packagesLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading packages...</div>
            ) : packages?.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No PT packages found. Create your first package.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {packages?.map((pkg) => (
                  <Card key={pkg.id}>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Package className="h-5 w-5" />
                        {pkg.name}
                      </CardTitle>
                      <CardDescription>{pkg.description}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sessions:</span>
                        <span className="font-medium">{pkg.total_sessions}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Price:</span>
                        <span className="font-medium">₹{pkg.price}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Validity:</span>
                        <span className="font-medium">{pkg.validity_days} days</span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="active" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Calendar className="mr-2 h-4 w-4" />
                    Schedule Session
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Schedule PT Session</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label>Member Package *</Label>
                      <Select value={selectedPackageForSession} onValueChange={setSelectedPackageForSession}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select member package" />
                        </SelectTrigger>
                        <SelectContent>
                          {activePackages?.map((pkg) => (
                            <SelectItem key={pkg.id} value={pkg.id}>
                              {pkg.member_name} - {pkg.package_name} ({pkg.sessions_remaining} left)
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Date & Time *</Label>
                      <Input
                        type="datetime-local"
                        value={newSession.scheduled_at}
                        onChange={(e) => setNewSession({ ...newSession, scheduled_at: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Duration (minutes)</Label>
                      <Input
                        type="number"
                        value={newSession.duration_minutes}
                        onChange={(e) => setNewSession({ ...newSession, duration_minutes: parseInt(e.target.value) || 60 })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setIsScheduleOpen(false)}>Cancel</Button>
                    <Button onClick={handleScheduleSession} disabled={scheduleSession.isPending}>
                      {scheduleSession.isPending ? "Scheduling..." : "Schedule"}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            {activePackages?.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No active PT packages.
                </CardContent>
              </Card>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Package</TableHead>
                    <TableHead>Trainer</TableHead>
                    <TableHead>Sessions</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activePackages?.map((pkg) => (
                    <TableRow key={pkg.id}>
                      <TableCell className="font-medium">{pkg.member_name}</TableCell>
                      <TableCell>{pkg.package_name}</TableCell>
                      <TableCell>{pkg.trainer_name || "-"}</TableCell>
                      <TableCell>{pkg.sessions_remaining}/{pkg.sessions_total}</TableCell>
                      <TableCell>{format(new Date(pkg.expiry_date), "PP")}</TableCell>
                      <TableCell>
                        <Badge variant={pkg.status === "active" ? "default" : "secondary"}>
                          {pkg.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            {sessions?.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No upcoming sessions.
                </CardContent>
              </Card>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions?.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">
                        {format(new Date(session.scheduled_at), "PPP p")}
                      </TableCell>
                      <TableCell>{session.member_name}</TableCell>
                      <TableCell>{session.duration_minutes} min</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            session.status === "completed"
                              ? "default"
                              : session.status === "cancelled"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {session.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {session.status === "scheduled" && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleCompleteSession(session.id)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancelSession(session.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

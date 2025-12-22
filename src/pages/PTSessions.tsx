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
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Plus, Package, Calendar, Check, X, Clock, Edit, TrendingUp, Users, Dumbbell } from "lucide-react";
import { usePTPackages, useCreatePTPackage, useActiveMemberPackages, useTrainerSessions, useCompletePTSession, useCancelPTSession, useSchedulePTSession, useUpdatePTPackage } from "@/hooks/usePTPackages";
import { useTrainers } from "@/hooks/useTrainers";
import { useBranches } from "@/hooks/useBranches";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";

const SESSION_TYPES = [
  { value: "per_session", label: "Per Session" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "custom", label: "Custom" },
];

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

export default function PTSessionsPage() {
  const { data: branches } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [isCreatePackageOpen, setIsCreatePackageOpen] = useState(false);
  const [isEditPackageOpen, setIsEditPackageOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [selectedPackageForSession, setSelectedPackageForSession] = useState<string>("");
  const [newPackage, setNewPackage] = useState({
    name: "",
    description: "",
    total_sessions: 10,
    price: 0,
    validity_days: 90,
    session_type: "per_session",
    gst_inclusive: false,
    gst_percentage: 18,
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
  const updatePackage = useUpdatePTPackage();
  const scheduleSession = useSchedulePTSession();
  const completeSession = useCompletePTSession();
  const cancelSession = useCancelPTSession();

  // Get first trainer for demo purposes - in real app would select from active package
  const firstTrainerId = trainers?.[0]?.id;
  const { data: sessions } = useTrainerSessions(firstTrainerId || "", {
    startDate: new Date(),
  });

  // Chart data
  const sessionStatusData = [
    { name: "Completed", value: sessions?.filter((s) => s.status === "completed").length || 0 },
    { name: "Scheduled", value: sessions?.filter((s) => s.status === "scheduled").length || 0 },
    { name: "Cancelled", value: sessions?.filter((s) => s.status === "cancelled").length || 0 },
  ].filter((d) => d.value > 0);

  const trainerSessionsData = trainers?.slice(0, 5).map((t: any) => ({
    name: t.profiles?.full_name?.split(" ")[0] || "Trainer",
    sessions: activePackages?.filter((p) => p.trainer_id === t.id).reduce((acc, p) => acc + (p.sessions_total - p.sessions_remaining), 0) || 0,
  })) || [];

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
      resetPackageForm();
    } catch (error) {
      toast.error("Failed to create package");
    }
  };

  const handleEditPackage = async () => {
    if (!editingPackage || !editingPackage.name || !editingPackage.price) {
      toast.error("Please fill in required fields");
      return;
    }

    try {
      await updatePackage.mutateAsync({
        id: editingPackage.id,
        ...editingPackage,
      });
      toast.success("PT Package updated");
      setIsEditPackageOpen(false);
      setEditingPackage(null);
    } catch (error) {
      toast.error("Failed to update package");
    }
  };

  const openEditDialog = (pkg: any) => {
    setEditingPackage({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description || "",
      total_sessions: pkg.total_sessions,
      price: pkg.price,
      validity_days: pkg.validity_days,
      session_type: pkg.session_type || "per_session",
      gst_inclusive: pkg.gst_inclusive || false,
      gst_percentage: pkg.gst_percentage || 18,
    });
    setIsEditPackageOpen(true);
  };

  const resetPackageForm = () => {
    setNewPackage({
      name: "",
      description: "",
      total_sessions: 10,
      price: 0,
      validity_days: 90,
      session_type: "per_session",
      gst_inclusive: false,
      gst_percentage: 18,
    });
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

  const calculateGSTAmount = (price: number, gstPercentage: number, isInclusive: boolean) => {
    if (isInclusive) {
      return price - (price / (1 + gstPercentage / 100));
    }
    return price * (gstPercentage / 100);
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

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />
                Total Packages
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{packages?.length || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-success" />
                Active Memberships
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{activePackages?.length || 0}</div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-warning" />
                Sessions Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {sessions?.filter((s) => {
                  const today = new Date().toDateString();
                  return new Date(s.scheduled_at).toDateString() === today;
                }).length || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-info/10 to-info/5 border-info/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-info" />
                Completion Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {sessions?.length
                  ? Math.round((sessions.filter((s) => s.status === "completed").length / sessions.length) * 100)
                  : 0}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Session Status Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              {sessionStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={sessionStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {sessionStatusData.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No session data available
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Sessions by Trainer</CardTitle>
            </CardHeader>
            <CardContent>
              {trainerSessionsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={trainerSessionsData} layout="vertical">
                    <XAxis type="number" />
                    <YAxis type="category" dataKey="name" width={80} />
                    <Tooltip />
                    <Bar dataKey="sessions" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                  No trainer data available
                </div>
              )}
            </CardContent>
          </Card>
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
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Create PT Package</DialogTitle>
                    <DialogDescription>Define a new personal training package</DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                    <div className="grid gap-2">
                      <Label>Package Name *</Label>
                      <Input
                        value={newPackage.name}
                        onChange={(e) => setNewPackage({ ...newPackage, name: e.target.value })}
                        placeholder="10 Sessions Package"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Session Type *</Label>
                      <Select
                        value={newPackage.session_type}
                        onValueChange={(v) => setNewPackage({ ...newPackage, session_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SESSION_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>GST %</Label>
                        <Input
                          type="number"
                          value={newPackage.gst_percentage}
                          onChange={(e) => setNewPackage({ ...newPackage, gst_percentage: parseFloat(e.target.value) || 18 })}
                        />
                      </div>
                      <div className="flex items-center gap-3 pt-6">
                        <Switch
                          checked={newPackage.gst_inclusive}
                          onCheckedChange={(v) => setNewPackage({ ...newPackage, gst_inclusive: v })}
                        />
                        <Label>GST Inclusive</Label>
                      </div>
                    </div>
                    {newPackage.price > 0 && (
                      <div className="p-3 rounded-lg bg-muted text-sm">
                        <p>
                          <strong>Base Price:</strong> ₹
                          {newPackage.gst_inclusive
                            ? (newPackage.price - calculateGSTAmount(newPackage.price, newPackage.gst_percentage, true)).toFixed(2)
                            : newPackage.price}
                        </p>
                        <p>
                          <strong>GST ({newPackage.gst_percentage}%):</strong> ₹
                          {calculateGSTAmount(newPackage.price, newPackage.gst_percentage, newPackage.gst_inclusive).toFixed(2)}
                        </p>
                        <p className="font-bold">
                          <strong>Total:</strong> ₹
                          {newPackage.gst_inclusive
                            ? newPackage.price
                            : (newPackage.price + calculateGSTAmount(newPackage.price, newPackage.gst_percentage, false)).toFixed(2)}
                        </p>
                      </div>
                    )}
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

            {/* Edit Package Dialog */}
            <Dialog open={isEditPackageOpen} onOpenChange={setIsEditPackageOpen}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Edit PT Package</DialogTitle>
                  <DialogDescription>Update package details</DialogDescription>
                </DialogHeader>
                {editingPackage && (
                  <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto">
                    <div className="grid gap-2">
                      <Label>Package Name *</Label>
                      <Input
                        value={editingPackage.name}
                        onChange={(e) => setEditingPackage({ ...editingPackage, name: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Session Type *</Label>
                      <Select
                        value={editingPackage.session_type}
                        onValueChange={(v) => setEditingPackage({ ...editingPackage, session_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {SESSION_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>
                              {t.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>Sessions *</Label>
                        <Input
                          type="number"
                          value={editingPackage.total_sessions}
                          onChange={(e) => setEditingPackage({ ...editingPackage, total_sessions: parseInt(e.target.value) || 10 })}
                        />
                      </div>
                      <div className="grid gap-2">
                        <Label>Price (₹) *</Label>
                        <Input
                          type="number"
                          value={editingPackage.price}
                          onChange={(e) => setEditingPackage({ ...editingPackage, price: parseFloat(e.target.value) || 0 })}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="grid gap-2">
                        <Label>GST %</Label>
                        <Input
                          type="number"
                          value={editingPackage.gst_percentage}
                          onChange={(e) => setEditingPackage({ ...editingPackage, gst_percentage: parseFloat(e.target.value) || 18 })}
                        />
                      </div>
                      <div className="flex items-center gap-3 pt-6">
                        <Switch
                          checked={editingPackage.gst_inclusive}
                          onCheckedChange={(v) => setEditingPackage({ ...editingPackage, gst_inclusive: v })}
                        />
                        <Label>GST Inclusive</Label>
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label>Validity (days)</Label>
                      <Input
                        type="number"
                        value={editingPackage.validity_days}
                        onChange={(e) => setEditingPackage({ ...editingPackage, validity_days: parseInt(e.target.value) || 90 })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Description</Label>
                      <Input
                        value={editingPackage.description}
                        onChange={(e) => setEditingPackage({ ...editingPackage, description: e.target.value })}
                      />
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditPackageOpen(false)}>Cancel</Button>
                  <Button onClick={handleEditPackage} disabled={updatePackage.isPending}>
                    {updatePackage.isPending ? "Saving..." : "Save Changes"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

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
                {packages?.map((pkg: any) => (
                  <Card key={pkg.id} className="relative overflow-hidden">
                    <div className="absolute top-2 right-2">
                      <Button variant="ghost" size="icon" onClick={() => openEditDialog(pkg)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {SESSION_TYPES.find((t) => t.value === pkg.session_type)?.label || "Per Session"}
                        </Badge>
                        {pkg.gst_inclusive && <Badge variant="secondary" className="text-xs">GST Inc.</Badge>}
                      </div>
                      <CardTitle className="flex items-center gap-2 mt-2">
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
                        <span className="text-muted-foreground">GST:</span>
                        <span className="font-medium">{pkg.gst_percentage || 18}%</span>
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

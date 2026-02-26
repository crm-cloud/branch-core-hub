import { useState } from "react";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { toast } from "sonner";
import { Plus, Package, Calendar, Check, X, Edit, TrendingUp, Users, Dumbbell, Eye, EyeOff } from "lucide-react";
import { usePTPackages, useActiveMemberPackages, useTrainerSessions, useCompletePTSession, useCancelPTSession, useSchedulePTSession, useUpdatePTPackage } from "@/hooks/usePTPackages";
import { useTrainers } from "@/hooks/useTrainers";
import { useBranchContext } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { AddPTPackageDrawer } from "@/components/pt/AddPTPackageDrawer";
import { EditPTPackageDrawer } from "@/components/pt/EditPTPackageDrawer";

const SESSION_TYPES = [
  { value: "per_session", label: "Per Session" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "custom", label: "Custom" },
];

const CHART_COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))"];

export default function PTSessionsPage() {
  const { roles } = useAuth();
  const { effectiveBranchId, branchFilter } = useBranchContext();
  const [isCreatePackageOpen, setIsCreatePackageOpen] = useState(false);
  const [isEditPackageOpen, setIsEditPackageOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [selectedPackageForSession, setSelectedPackageForSession] = useState<string>("");
  const [showInactive, setShowInactive] = useState(false);
  const [newSession, setNewSession] = useState({
    scheduled_at: "",
    duration_minutes: 60,
  });

  const branchId = effectiveBranchId || "";
  const queryBranchId = branchFilter || branchId;
  const { data: packages, isLoading: packagesLoading } = usePTPackages(queryBranchId);
  const { data: trainers } = useTrainers(queryBranchId);
  const { data: activePackages } = useActiveMemberPackages(queryBranchId);
  const scheduleSession = useSchedulePTSession();
  const completeSession = useCompletePTSession();
  const cancelSession = useCancelPTSession();
  const updatePackage = useUpdatePTPackage();

  const firstTrainerId = trainers?.[0]?.id;
  const { data: sessions } = useTrainerSessions(firstTrainerId || "", { startDate: new Date() });

  // Filter packages by active status
  const filteredPackages = (packages || []).filter((pkg: any) => 
    showInactive ? true : pkg.is_active !== false
  );

  const sessionStatusData = [
    { name: "Completed", value: sessions?.filter((s) => s.status === "completed").length || 0 },
    { name: "Scheduled", value: sessions?.filter((s) => s.status === "scheduled").length || 0 },
    { name: "Cancelled", value: sessions?.filter((s) => s.status === "cancelled").length || 0 },
  ].filter((d) => d.value > 0);

  const trainerSessionsData = trainers?.slice(0, 5).map((t: any) => ({
    name: t.profiles?.full_name?.split(" ")[0] || "Trainer",
    sessions: activePackages?.filter((p) => p.trainer_id === t.id).reduce((acc, p) => acc + (p.sessions_total - p.sessions_remaining), 0) || 0,
  })) || [];

  const openEditDrawer = (pkg: any) => {
    setEditingPackage(pkg);
    setIsEditPackageOpen(true);
  };

  const togglePackageActive = async (pkg: any) => {
    try {
      await updatePackage.mutateAsync({
        id: pkg.id,
        is_active: !pkg.is_active,
      });
      toast.success(pkg.is_active ? "Package deactivated" : "Package activated");
    } catch (error) {
      toast.error("Failed to update package status");
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
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" />Total Packages
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-bold">{packages?.length || 0}</div></CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-success/10 to-success/5 border-success/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Users className="h-4 w-4 text-success" />Active Memberships
              </CardTitle>
            </CardHeader>
            <CardContent><div className="text-3xl font-bold">{activePackages?.length || 0}</div></CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Dumbbell className="h-4 w-4 text-warning" />Sessions Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {sessions?.filter((s) => new Date(s.scheduled_at).toDateString() === new Date().toDateString()).length || 0}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-gradient-to-br from-info/10 to-info/5 border-info/20">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-info" />Completion Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {sessions?.length ? Math.round((sessions.filter((s) => s.status === "completed").length / sessions.length) * 100) : 0}%
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-lg">Session Status Distribution</CardTitle></CardHeader>
            <CardContent>
              {sessionStatusData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie data={sessionStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {sessionStatusData.map((_, index) => (<Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />))}
                    </Pie>
                    <Tooltip /><Legend />
                  </PieChart>
                </ResponsiveContainer>
              ) : (<div className="h-[250px] flex items-center justify-center text-muted-foreground">No session data available</div>)}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-lg">Sessions by Trainer</CardTitle></CardHeader>
            <CardContent>
              {trainerSessionsData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={trainerSessionsData} layout="vertical">
                    <XAxis type="number" /><YAxis type="category" dataKey="name" width={80} /><Tooltip />
                    <Bar dataKey="sessions" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (<div className="h-[250px] flex items-center justify-center text-muted-foreground">No trainer data available</div>)}
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Switch
                  checked={showInactive}
                  onCheckedChange={setShowInactive}
                  id="show-inactive"
                />
                <Label htmlFor="show-inactive" className="text-sm cursor-pointer">
                  {showInactive ? <Eye className="h-4 w-4 inline mr-1" /> : <EyeOff className="h-4 w-4 inline mr-1" />}
                  Show Inactive
                </Label>
              </div>
              {roles.some(r => ['owner', 'admin', 'manager'].includes(r.role)) && (
                <Button onClick={() => setIsCreatePackageOpen(true)}><Plus className="mr-2 h-4 w-4" />Create Package</Button>
              )}
            </div>

            <AddPTPackageDrawer open={isCreatePackageOpen} onOpenChange={setIsCreatePackageOpen} branchId={branchId} />
            <EditPTPackageDrawer open={isEditPackageOpen} onOpenChange={setIsEditPackageOpen} package={editingPackage} />

            {packagesLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading packages...</div>
            ) : filteredPackages.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">
                {showInactive ? "No PT packages found." : "No active PT packages. Create your first package or enable 'Show Inactive'."}
              </CardContent></Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredPackages.map((pkg: any) => (
                  <Card key={pkg.id} className={`relative overflow-hidden transition-opacity ${pkg.is_active === false ? "opacity-60" : ""}`}>
                    <div className="absolute top-2 right-2 flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEditDrawer(pkg)} title="Edit">
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => togglePackageActive(pkg)}
                        title={pkg.is_active !== false ? "Deactivate" : "Activate"}
                      >
                        {pkg.is_active !== false ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <CardHeader>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="w-fit text-xs">
                          {SESSION_TYPES.find((t) => t.value === pkg.session_type)?.label || "Per Session"}
                        </Badge>
                        {pkg.is_active === false && (
                          <Badge variant="secondary" className="text-xs">Inactive</Badge>
                        )}
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
                        <span className="font-medium text-lg">₹{pkg.price}</span>
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
              <Button onClick={() => setIsScheduleOpen(true)}><Calendar className="mr-2 h-4 w-4" />Schedule Session</Button>
            </div>

            <Sheet open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
              <SheetContent>
                <SheetHeader><SheetTitle>Schedule PT Session</SheetTitle><SheetDescription>Book a personal training session</SheetDescription></SheetHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Member Package *</Label>
                    <Select value={selectedPackageForSession} onValueChange={setSelectedPackageForSession}>
                      <SelectTrigger><SelectValue placeholder="Select member package" /></SelectTrigger>
                      <SelectContent>
                        {activePackages?.map((pkg) => (<SelectItem key={pkg.id} value={pkg.id}>{pkg.member_name} - {pkg.package_name} ({pkg.sessions_remaining} left)</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date & Time *</Label>
                    <Input type="datetime-local" value={newSession.scheduled_at} onChange={(e) => setNewSession({ ...newSession, scheduled_at: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Duration (minutes)</Label>
                    <Input type="number" value={newSession.duration_minutes} onChange={(e) => setNewSession({ ...newSession, duration_minutes: parseInt(e.target.value) || 60 })} />
                  </div>
                </div>
                <SheetFooter>
                  <Button variant="outline" onClick={() => setIsScheduleOpen(false)}>Cancel</Button>
                  <Button onClick={handleScheduleSession} disabled={scheduleSession.isPending}>{scheduleSession.isPending ? "Scheduling..." : "Schedule"}</Button>
                </SheetFooter>
              </SheetContent>
            </Sheet>

            {activePackages?.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No active PT packages.</CardContent></Card>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead><TableHead>Package</TableHead><TableHead>Trainer</TableHead><TableHead>Sessions</TableHead><TableHead>Expires</TableHead><TableHead>Status</TableHead>
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
                      <TableCell><Badge variant={pkg.status === "active" ? "default" : "secondary"}>{pkg.status}</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TabsContent>

          <TabsContent value="sessions" className="space-y-4">
            {sessions?.length === 0 ? (
              <Card><CardContent className="py-8 text-center text-muted-foreground">No upcoming sessions.</CardContent></Card>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow><TableHead>Date & Time</TableHead><TableHead>Member</TableHead><TableHead>Duration</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow>
                </TableHeader>
                <TableBody>
                  {sessions?.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">{format(new Date(session.scheduled_at), "PPP p")}</TableCell>
                      <TableCell>{session.member_name}</TableCell>
                      <TableCell>{session.duration_minutes} min</TableCell>
                      <TableCell><Badge variant={session.status === "completed" ? "default" : session.status === "cancelled" ? "destructive" : "secondary"}>{session.status}</Badge></TableCell>
                      <TableCell>
                        {session.status === "scheduled" && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={() => handleCompleteSession(session.id)}><Check className="h-4 w-4" /></Button>
                            <Button size="sm" variant="ghost" onClick={() => handleCancelSession(session.id)}><X className="h-4 w-4" /></Button>
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

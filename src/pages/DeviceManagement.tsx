import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plus, Wifi, WifiOff, Settings2, Trash2, PlayCircle, Router,
  Fingerprint, CreditCard, RefreshCw, Users, Monitor, Activity,
  Radio, CheckCircle2, Clock, Zap, Bug, TestTube, Trash, Copy
} from "lucide-react";
import { toast } from "sonner";
import { useBranchContext } from '@/contexts/BranchContext';
import { fetchDevices, deleteDevice, getDeviceStats, sendDeviceCommand, subscribeToCommandStatus, AccessDevice, purgeOldAccessLogs } from "@/services/deviceService";
import { getBiometricStats, syncBranchMembersToDevices } from "@/services/biometricService";
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from "@/integrations/supabase/client";
import AddDeviceDrawer from "@/components/devices/AddDeviceDrawer";
import EditDeviceDrawer from "@/components/devices/EditDeviceDrawer";
import LiveAccessLog from "@/components/devices/LiveAccessLog";
import DeviceSetupCard from "@/components/devices/DeviceSetupCard";
import RosterStatusTab from "@/components/devices/RosterStatusTab";
import { 
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";

const isDeviceOnline = (device: AccessDevice): boolean => {
  if (device.last_heartbeat) {
    const heartbeatAge = (Date.now() - new Date(device.last_heartbeat).getTime()) / 1000;
    return heartbeatAge < 180;
  }
  return device.is_online === true;
};

const DeviceManagement = () => {
  const { hasAnyRole } = useAuth();
  const isAdminOrOwner = hasAnyRole(['owner', 'admin']);
  const queryClient = useQueryClient();
  const { selectedBranch, branches } = useBranchContext();
  const selectedBranchFilter = selectedBranch !== 'all' ? selectedBranch : '';
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<AccessDevice | null>(null);
  const [deletingDevice, setDeletingDevice] = useState<AccessDevice | null>(null);
  const [relayPendingByDevice, setRelayPendingByDevice] = useState<Record<string, boolean>>({});
  const [expandedDeviceId, setExpandedDeviceId] = useState<string | null>(null);
  const [rosterTestResult, setRosterTestResult] = useState<string | null>(null);
  const [isPurgingLogs, setIsPurgingLogs] = useState(false);
  const relayCleanupByDeviceRef = useRef<Record<string, () => void>>({});
  const relayTimeoutByDeviceRef = useRef<Record<string, number>>({});

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['access-devices', selectedBranchFilter],
    queryFn: () => fetchDevices(selectedBranchFilter || undefined),
  });

  const { data: deviceStats } = useQuery({
    queryKey: ['device-stats', selectedBranchFilter],
    queryFn: () => getDeviceStats(selectedBranchFilter || undefined),
  });

  const { data: biometricStats } = useQuery({
    queryKey: ['biometric-stats', selectedBranchFilter],
    queryFn: () => getBiometricStats(selectedBranchFilter || undefined),
  });

  // Realtime hardware_devices subscription for live status
  useEffect(() => {
    const channel = supabase
      .channel('hardware-devices-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'hardware_devices',
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['access-devices'] });
        queryClient.invalidateQueries({ queryKey: ['device-stats'] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const deleteMutation = useMutation({
    mutationFn: deleteDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-devices'] });
      queryClient.invalidateQueries({ queryKey: ['device-stats'] });
      toast.success("Device deleted successfully");
      setDeletingDevice(null);
    },
    onError: (error: Error) => toast.error(`Failed to delete device: ${error.message}`),
  });

  const syncMembersMutation = useMutation({
    mutationFn: () => syncBranchMembersToDevices(selectedBranchFilter || undefined),
    onSuccess: ({ members, staff, trainers, people, devices, queued }) => {
      if (queued === 0) {
        toast.info(`No sync items queued. ${people} personnel found, ${devices} device(s) checked.`);
      } else {
        toast.success(
          `Queued ${queued} sync items for ${people} profiles (${members}M / ${staff}S / ${trainers}T) across ${devices} device(s)`
        );
      }
      queryClient.invalidateQueries({ queryKey: ['biometric-stats'] });
      queryClient.invalidateQueries({ queryKey: ['roster-status'] });
    },
    onError: (error: Error) => toast.error(`Sync failed: ${error.message}`),
  });

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['access-devices'] });
    queryClient.invalidateQueries({ queryKey: ['device-stats'] });
    queryClient.invalidateQueries({ queryKey: ['biometric-stats'] });
    queryClient.invalidateQueries({ queryKey: ['roster-status'] });
    queryClient.invalidateQueries({ queryKey: ['access-logs-live'] });
    toast.info('Refreshing all data...');
  };

  const clearRelayWatch = (deviceId: string) => {
    const cleanup = relayCleanupByDeviceRef.current[deviceId];
    if (cleanup) { cleanup(); delete relayCleanupByDeviceRef.current[deviceId]; }
    const timeoutId = relayTimeoutByDeviceRef.current[deviceId];
    if (timeoutId) { window.clearTimeout(timeoutId); delete relayTimeoutByDeviceRef.current[deviceId]; }
    setRelayPendingByDevice((prev) => ({ ...prev, [deviceId]: false }));
  };

  useEffect(() => {
    return () => {
      Object.keys(relayCleanupByDeviceRef.current).forEach((id) => relayCleanupByDeviceRef.current[id]?.());
      Object.keys(relayTimeoutByDeviceRef.current).forEach((id) => window.clearTimeout(relayTimeoutByDeviceRef.current[id]));
    };
  }, []);

  const handleRelayAction = async (device: AccessDevice) => {
    if (!isDeviceOnline(device)) { toast.error("Device is offline."); return; }
    setRelayPendingByDevice((prev) => ({ ...prev, [device.id]: true }));
    try {
      const command = await sendDeviceCommand(device.id, "relay_open", {
        duration: device.relay_delay ?? 5, mode: device.relay_mode ?? 1,
      });
      toast.success("Relay command sent.");
      const unsubscribe = subscribeToCommandStatus(command.id, (status) => {
        const s = (status || "").toLowerCase();
        if (["completed", "executed", "success", "done"].includes(s)) {
          toast.success(`Relay executed on ${device.device_name}`); clearRelayWatch(device.id);
        } else if (["failed", "error", "rejected", "cancelled"].includes(s)) {
          toast.error(`Relay failed on ${device.device_name}`); clearRelayWatch(device.id);
        }
      });
      relayCleanupByDeviceRef.current[device.id] = unsubscribe;
      relayTimeoutByDeviceRef.current[device.id] = window.setTimeout(() => {
        toast.info(`Relay queued for ${device.device_name}.`); clearRelayWatch(device.id);
      }, 30000);
    } catch (error) {
      toast.error(`Relay failed: ${error instanceof Error ? error.message : "Unknown"}`);
      clearRelayWatch(device.id);
    }
  };

  const getDeviceTypeIcon = (type: string) => {
    switch (type) {
      case 'face_terminal': return <Fingerprint className="h-5 w-5" />;
      case 'card_reader': return <CreditCard className="h-5 w-5" />;
      default: return <Router className="h-5 w-5" />;
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Device Command Center</h1>
            <p className="text-muted-foreground">Manage facial terminals, turnstiles & access control</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={refreshAll}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              onClick={() => syncMembersMutation.mutate()}
              disabled={syncMembersMutation.isPending}
            >
              <Users className={`h-4 w-4 mr-2 ${syncMembersMutation.isPending ? 'animate-pulse' : ''}`} />
              {syncMembersMutation.isPending ? 'Syncing...' : 'Sync All'}
            </Button>
            <Button onClick={() => setIsAddDrawerOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Device
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card className="rounded-2xl bg-card shadow-lg shadow-muted/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-primary/10">
                  <Monitor className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Devices</p>
                  <p className="text-2xl font-bold">{deviceStats?.total || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl bg-card shadow-lg shadow-muted/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-green-500/10">
                  <Radio className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Online</p>
                  <p className="text-2xl font-bold text-green-600">{deviceStats?.online || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl bg-card shadow-lg shadow-muted/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-blue-500/10">
                  <Fingerprint className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Enrolled</p>
                  <p className="text-2xl font-bold">
                    {biometricStats?.enrolledTotal || 0}
                    <span className="text-sm font-normal text-muted-foreground">/{biometricStats?.totalPeople || 0}</span>
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="rounded-2xl bg-card shadow-lg shadow-muted/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full bg-orange-500/10">
                  <Clock className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Pending Sync</p>
                  <p className="text-2xl font-bold">{biometricStats?.pendingSyncs || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="devices" className="space-y-4">
          <TabsList className="bg-muted/60">
            <TabsTrigger value="devices" className="gap-1.5">
              <Monitor className="h-4 w-4" />
              Devices
            </TabsTrigger>
            <TabsTrigger value="live-feed" className="gap-1.5">
              <Activity className="h-4 w-4" />
              Live Feed
            </TabsTrigger>
            <TabsTrigger value="roster" className="gap-1.5">
              <Users className="h-4 w-4" />
              Roster
            </TabsTrigger>
            {isAdminOrOwner && (
              <TabsTrigger value="debug" className="gap-1.5">
                <Bug className="h-4 w-4" />
                Debug
              </TabsTrigger>
            )}
          </TabsList>

          {/* Devices Tab */}
          <TabsContent value="devices" className="space-y-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : devices.length === 0 ? (
              <Card className="rounded-2xl">
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Router className="h-16 w-16 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold mb-1">No Devices Registered</h3>
                  <p className="text-sm text-muted-foreground mb-4">Add your first facial terminal to get started</p>
                  <Button onClick={() => setIsAddDrawerOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Device
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {devices.map((device) => {
                  const caps = (device.config as any)?.capabilities || {};
                  const isLive = isDeviceOnline(device);
                  const relaySupported = !!caps.relay_turnstile;
                  const isExpanded = expandedDeviceId === device.id;

                  return (
                    <Card key={device.id} className={`rounded-2xl shadow-lg transition-all ${isLive ? 'shadow-green-500/10 border-green-500/20' : 'shadow-muted/20'}`}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${isLive ? 'bg-green-500/10' : 'bg-muted'}`}>
                              {getDeviceTypeIcon(device.device_type)}
                            </div>
                            <div>
                              <CardTitle className="text-base">{device.device_name}</CardTitle>
                              <CardDescription className="text-xs font-mono">
                                SN: {device.serial_number || '—'}
                              </CardDescription>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className={`h-3 w-3 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : 'bg-destructive'}`} />
                            <Badge variant={isLive ? "default" : "destructive"} className="text-xs">
                              {isLive ? "Live" : "Offline"}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Quick Stats */}
                        <div className="grid grid-cols-3 gap-2">
                          <div className="rounded-lg bg-muted/50 p-2 text-center">
                            <p className="text-[10px] text-muted-foreground">Heartbeat</p>
                            <p className="text-xs font-medium">
                              {device.last_heartbeat
                                ? formatDistanceToNow(new Date(device.last_heartbeat), { addSuffix: true })
                                : "Never"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/50 p-2 text-center">
                            <p className="text-[10px] text-muted-foreground">Last Sync</p>
                            <p className="text-xs font-medium">
                              {device.last_sync
                                ? formatDistanceToNow(new Date(device.last_sync), { addSuffix: true })
                                : "Never"}
                            </p>
                          </div>
                          <div className="rounded-lg bg-muted/50 p-2 text-center">
                            <p className="text-[10px] text-muted-foreground">Capabilities</p>
                            <div className="flex justify-center gap-1 mt-0.5">
                              {caps.facial_recognition && <Fingerprint className="h-3 w-3 text-primary" />}
                              {caps.wiegand_card_reader && <CreditCard className="h-3 w-3 text-primary" />}
                              {caps.relay_turnstile && <Zap className="h-3 w-3 text-primary" />}
                            </div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1"
                            onClick={() => setExpandedDeviceId(isExpanded ? null : device.id)}
                          >
                            <Settings2 className="h-3.5 w-3.5 mr-1.5" />
                            {isExpanded ? "Hide Setup" : "Setup"}
                          </Button>
                          {relaySupported && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRelayAction(device)}
                              disabled={!isLive || !!relayPendingByDevice[device.id]}
                            >
                              <PlayCircle className={`h-3.5 w-3.5 mr-1.5 ${relayPendingByDevice[device.id] ? 'animate-pulse' : ''}`} />
                              Relay
                            </Button>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingDevice(device)}
                          >
                            <Settings2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDeletingDevice(device)}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>

                        {/* Expandable Setup Card */}
                        {isExpanded && (
                          <div className="pt-2 border-t">
                            <DeviceSetupCard device={device} />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* Live Feed Tab */}
          <TabsContent value="live-feed">
            <LiveAccessLog branchId={selectedBranchFilter || undefined} limit={50} />
          </TabsContent>

          {/* Roster Tab */}
          <TabsContent value="roster">
            <Card className="rounded-2xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">Personnel Roster & Sync Status</CardTitle>
                    <CardDescription>All members, staff, and trainers with their enrollment status</CardDescription>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => syncMembersMutation.mutate()}
                    disabled={syncMembersMutation.isPending}
                  >
                    <Users className={`h-4 w-4 mr-2 ${syncMembersMutation.isPending ? 'animate-pulse' : ''}`} />
                    {syncMembersMutation.isPending ? 'Syncing...' : 'Sync All'}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <RosterStatusTab branchId={selectedBranchFilter || undefined} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Drawers */}
        <AddDeviceDrawer
          isOpen={isAddDrawerOpen}
          onClose={() => setIsAddDrawerOpen(false)}
          branches={branches}
          defaultBranchId={selectedBranchFilter}
        />

        {editingDevice && (
          <EditDeviceDrawer
            isOpen={!!editingDevice}
            onClose={() => setEditingDevice(null)}
            device={editingDevice}
            branches={branches}
          />
        )}

        {/* Delete Confirmation */}
        <AlertDialog open={!!deletingDevice} onOpenChange={() => setDeletingDevice(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete Device</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to delete "{deletingDevice?.device_name}"?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deletingDevice && deleteMutation.mutate(deletingDevice.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
};

export default DeviceManagement;
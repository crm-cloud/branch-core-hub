import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Plus, 
  Wifi, 
  WifiOff, 
  Settings2, 
  Trash2, 
  PlayCircle,
  Router,
  Fingerprint,
  CreditCard,
  RefreshCw,
  Info,
  Users,
  Link
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useBranchContext } from '@/contexts/BranchContext';
import { fetchDevices, deleteDevice, getDeviceStats, AccessDevice } from "@/services/deviceService";
import { getBiometricStats, getMemberSyncAudit, syncBranchMembersToDevices } from "@/services/biometricService";
import AddDeviceDrawer from "@/components/devices/AddDeviceDrawer";
import EditDeviceDrawer from "@/components/devices/EditDeviceDrawer";
import LiveAccessLog from "@/components/devices/LiveAccessLog";
import DeviceSetupCard from "@/components/devices/DeviceSetupCard";
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatDistanceToNow } from "date-fns";

const DeviceManagement = () => {
  const queryClient = useQueryClient();
  const { selectedBranch, branches } = useBranchContext();
  const selectedBranchFilter = selectedBranch !== 'all' ? selectedBranch : '';
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<AccessDevice | null>(null);
  const [deletingDevice, setDeletingDevice] = useState<AccessDevice | null>(null);

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

  const { data: memberSyncAudit } = useQuery({
    queryKey: ['member-sync-audit', selectedBranchFilter],
    queryFn: () => getMemberSyncAudit(selectedBranchFilter || undefined),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-devices'] });
      queryClient.invalidateQueries({ queryKey: ['device-stats'] });
      toast.success("Device deleted successfully");
      setDeletingDevice(null);
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete device: ${error.message}`);
    },
  });

  const syncMembersMutation = useMutation({
    mutationFn: () => syncBranchMembersToDevices(selectedBranchFilter || undefined),
    onSuccess: ({ members, devices, queued, audit }) => {
      if (queued === 0) {
        if (audit.eligibleForDeviceEnrollment > 0) {
          toast.info(
            `No members with photos for app push. ${audit.eligibleForDeviceEnrollment} member records (name/id) are ready for device enrollment sync. Devices checked: ${devices}`
          );
        } else {
          toast.info(
            `No eligible members for sync. Active: ${audit.totalActiveMembers}, access enabled: ${audit.membersWithHardwareAccess}, with photo: ${audit.membersWithBiometricPhoto}, devices checked: ${devices}`
          );
        }
      } else {
        toast.success(`Queued ${queued} sync item${queued !== 1 ? 's' : ''} for ${members} member${members !== 1 ? 's' : ''} across ${devices} device${devices !== 1 ? 's' : ''}`);
      }

      queryClient.invalidateQueries({ queryKey: ['biometric-stats'] });
      queryClient.invalidateQueries({ queryKey: ['access-devices'] });
      queryClient.invalidateQueries({ queryKey: ['member-sync-audit'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to queue member sync: ${error.message}`);
    },
  });

  const handleRelayAction = () => {
    toast.info("Remote relay trigger is disabled in callback-webhook mode");
  };

  const getDeviceTypeIcon = (type: string) => {
    switch (type) {
      case 'face_terminal':
        return <Fingerprint className="h-4 w-4" />;
      case 'card_reader':
        return <CreditCard className="h-4 w-4" />;
      default:
        return <Router className="h-4 w-4" />;
    }
  };

  const getDeviceTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      turnstile: 'Turnstile',
      face_terminal: 'Face Terminal',
      card_reader: 'Card Reader',
    };
    return labels[type] || type;
  };

  const registerUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/terminal-register`;

  const handleCopyRegisterUrl = async () => {
    try {
      await navigator.clipboard.writeText(registerUrl);
      toast.success('Registered address URL copied');
    } catch {
      toast.error('Failed to copy Registered address URL');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Device Management</h1>
          <p className="text-muted-foreground">Manage turnstiles, face terminals, and access control devices</p>
        </div>
        <div className="flex items-center gap-4">
          {/* Branch selector moved to global header */}
          <Button
            variant="outline"
            onClick={() => syncMembersMutation.mutate()}
            disabled={syncMembersMutation.isPending}
          >
            <Users className={`h-4 w-4 mr-2 ${syncMembersMutation.isPending ? 'animate-pulse' : ''}`} />
            {syncMembersMutation.isPending ? 'Syncing Members...' : 'Sync Members'}
          </Button>
          <Button onClick={() => setIsAddDrawerOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Device
          </Button>
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Member Sync Workflow</CardTitle>
          <CardDescription>
            Use either path: App Sync for existing photos, or Device Enrollment to capture new photos at terminal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Active Members</p>
              <p className="text-xl font-semibold">{memberSyncAudit?.totalActiveMembers ?? 0}</p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Access Enabled</p>
              <p className="text-xl font-semibold">{memberSyncAudit?.membersWithHardwareAccess ?? 0}</p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">With Biometric Photo</p>
              <p className="text-xl font-semibold">{memberSyncAudit?.membersWithBiometricPhoto ?? 0}</p>
            </div>
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">Eligible For App Sync</p>
              <p className="text-xl font-semibold">{memberSyncAudit?.eligibleForAppSync ?? 0}</p>
            </div>
          </div>

          <div className="rounded-lg border bg-background p-3">
            <p className="text-xs text-muted-foreground">Ready For Device Enrollment (Name/ID)</p>
            <p className="text-sm font-medium">
              {memberSyncAudit?.eligibleForDeviceEnrollment ?? 0} member{(memberSyncAudit?.eligibleForDeviceEnrollment ?? 0) !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => syncMembersMutation.mutate()}
              disabled={syncMembersMutation.isPending}
            >
              <Users className={`h-4 w-4 mr-2 ${syncMembersMutation.isPending ? 'animate-pulse' : ''}`} />
              {syncMembersMutation.isPending ? 'Syncing From App...' : 'Sync From App'}
            </Button>
            <Button variant="outline" onClick={handleCopyRegisterUrl}>
              <Link className="h-4 w-4 mr-2" />
              Copy Device Register URL
            </Button>
          </div>

          <div className="text-xs text-muted-foreground space-y-1">
            <p>App Sync path: requires hardware access ON and biometric photo present.</p>
            <p>Device path: member name and id are synced even without photo, then enroll face directly on terminal and callback updates biometric photo.</p>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Devices</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{deviceStats?.total || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Online</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-green-500">{deviceStats?.online || 0}</div>
              <Wifi className="h-5 w-5 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Offline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold text-destructive">{deviceStats?.offline || 0}</div>
              <WifiOff className="h-5 w-5 text-destructive" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Biometric Enrolled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-bold">{biometricStats?.enrollmentRate || 0}%</div>
              <span className="text-sm text-muted-foreground">
                ({biometricStats?.enrolledMembers || 0}/{biometricStats?.totalMembers || 0})
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Device List */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Registered Devices</CardTitle>
              <CardDescription>
                {devices.length} device{devices.length !== 1 ? 's' : ''} registered
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : devices.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Router className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No devices registered yet</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => setIsAddDrawerOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Device
                  </Button>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Serial Number</TableHead>
                      <TableHead>Capabilities</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Heartbeat</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map((device) => {
                      const caps = (device.config as any)?.capabilities || {};
                      const heartbeatAge = device.last_heartbeat ? (Date.now() - new Date(device.last_heartbeat).getTime()) / 1000 : Infinity;
                      const isLive = heartbeatAge < 120;
                      const relaySupported = !!caps.relay_turnstile;
                      return (
                      <TableRow key={device.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-muted">
                              {getDeviceTypeIcon(device.device_type)}
                            </div>
                            <div>
                              <div className="font-medium">{device.device_name}</div>
                              <p className="text-xs text-muted-foreground">{device.model || 'No model'}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <code className="px-2 py-1 bg-muted rounded text-xs font-mono">
                            {device.serial_number || '—'}
                          </code>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {caps.facial_recognition && <Badge variant="outline" className="text-xs bg-info/10 text-info border-info/20">Face</Badge>}
                            {caps.wiegand_card_reader && <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/20">Card</Badge>}
                            {caps.relay_turnstile && <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">Relay</Badge>}
                            {!caps.facial_recognition && !caps.wiegand_card_reader && !caps.relay_turnstile && (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className={`h-2.5 w-2.5 rounded-full ${isLive ? 'bg-green-500 animate-pulse' : device.is_online ? 'bg-yellow-500' : 'bg-destructive'}`} />
                            <span className="text-sm">{isLive ? 'Live' : device.is_online ? 'Online' : 'Offline'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {device.last_heartbeat 
                            ? formatDistanceToNow(new Date(device.last_heartbeat), { addSuffix: true })
                            : 'Never'}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={handleRelayAction}
                              disabled={!relaySupported || !device.is_online}
                              title={relaySupported ? "Remote trigger disabled in callback mode" : "Relay not supported by device"}
                              aria-label="Remote relay trigger"
                            >
                              <PlayCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingDevice(device)}
                              aria-label="Edit device"
                            >
                              <Settings2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletingDevice(device)}
                              className="text-destructive hover:text-destructive"
                              aria-label="Delete device"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live Access Log */}
        <div className="lg:col-span-1">
          <LiveAccessLog branchId={selectedBranchFilter || undefined} />
        </div>
      </div>

      {/* Per-Device Setup Cards */}
      {devices.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Device Setup & Connection</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {devices.map((device) => (
              <DeviceSetupCard key={device.id} device={device} />
            ))}
          </div>
        </div>
      )}

      {/* Terminal Setup Guide — Callback Webhooks */}
      <Collapsible>
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
              <Info className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Callback Setup Guide (Android Facial Terminal)</CardTitle>
            </CollapsibleTrigger>
            <CardDescription className="text-xs">Configure terminal callback URLs to sync with Incline Cloud</CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              {/* Step-by-step Guide */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm">Android Terminal Setup Steps (Firmware Variants)</h4>
                <ol className="space-y-3 text-sm list-decimal list-inside">
                  <li><span className="font-medium">Register the device</span> — Click "Add Device" above. Enter a name, select the branch, and enter the <strong>Serial Number (SN)</strong> from the terminal's System Info screen.</li>
                  <li><span className="font-medium">Open System Settings Center</span> — On the terminal home screen, tap the settings icon and enter admin password if prompted.</li>
                  <li><span className="font-medium">Open App Settings</span> — Path is usually <strong>System Settings Center → App Settings</strong>.</li>
                  <li><span className="font-medium">Open callback screen</span> — Look for <strong>Callback settings</strong>. On some firmware this appears under <strong>App Settings → Custom</strong> or as <strong>Identify/Heartbeat Settings</strong>.</li>
                  <li><span className="font-medium">Set callback options</span> — Enable <strong>Callback include imgBase64</strong>, keep <strong>Close Stranger data upload</strong> OFF unless you need stranger uploads.</li>
                  <li><span className="font-medium">Set Heartbeat Url</span> — Paste the heartbeat URL from the setup card.</li>
                  <li><span className="font-medium">Set Identify Callback Url</span> — Paste the identify URL from the setup card.</li>
                  <li><span className="font-medium">Set Registered address</span> — Paste the register URL from the setup card.</li>
                  <li><span className="font-medium">Verify connection</span> — The device status card above should show <span className="text-green-600 font-medium">"Connected"</span> within 30–60 seconds.</li>
                </ol>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Exact Field Mapping (Terminal Screen)</h4>
                <div className="p-3 rounded-lg bg-muted/30 border text-xs space-y-1.5">
                  <p><strong>Identify Callback Url</strong> → <span className="font-mono">/functions/v1/terminal-identify</span></p>
                  <p><strong>Heartbeat Url</strong> → <span className="font-mono">/functions/v1/terminal-heartbeat</span></p>
                  <p><strong>Registered address</strong> → <span className="font-mono">/functions/v1/terminal-register</span></p>
                  <p><strong>Callback include imgBase64</strong> → ON</p>
                  <p><strong>Close Stranger data upload</strong> → OFF (recommended)</p>
                </div>
              </div>

              {/* How callback flow works */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">How It Works (Callback Webhooks)</h4>
                <p className="text-xs text-muted-foreground">
                  The terminal calls three webhook endpoints to sync status and identify events:
                </p>
                <div className="grid gap-2">
                  {[
                    { event: 'Heartbeat', desc: 'Terminal POSTs heartbeat payloads so the cloud updates last online timestamp.' },
                    { event: 'Identify', desc: 'Terminal POSTs face recognition callbacks, and the cloud records staff or member access.' },
                    { event: 'Register', desc: 'Terminal POSTs roster pull or registration callbacks for member sync workflows.' },
                  ].map((item) => (
                    <div key={item.event} className="flex gap-2 p-2 rounded bg-muted/50 text-xs">
                      <span className="font-mono text-primary font-medium whitespace-nowrap min-w-[110px]">{item.event}</span>
                      <span className="text-muted-foreground">{item.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Enrollment flow */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Face Enrollment</h4>
                <div className="p-3 rounded-lg bg-muted/30 border text-xs space-y-2">
                  <p><strong>Option A — Terminal Capture:</strong> Enroll faces directly on the terminal. The device stores the face template locally. Attendance records are pushed to the cloud automatically.</p>
                  <p><strong>Option B — Callback Register:</strong> When the terminal sends registration callbacks, the cloud stores registration events and can return active member roster data from the register endpoint.</p>
                </div>
              </div>

              {/* Troubleshooting */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Troubleshooting</h4>
                <div className="space-y-2 text-xs text-muted-foreground">
                  <p>• <strong>Status stays "Not Connected"</strong> — Double-check the Heartbeat Url and verify terminal internet access.</p>
                  <p>• <strong>Scans not appearing</strong> — Verify Identify Callback Url and check the identifier in payload matches member/staff records.</p>
                  <p>• <strong>Registration not syncing</strong> — Verify Registered address URL and branch mapping for the device serial number.</p>
                  <p>• <strong>Cannot find "Callback settings"</strong> — Check alternate paths: <strong>App Settings → Custom</strong>, <strong>Communication Settings</strong>, or firmware menus named <strong>Identify/Heartbeat</strong>.</p>
                  <p>• <strong>Field names differ on your firmware</strong> — Map by purpose: Identify = face scan callback, Heartbeat = online ping, Registered address = roster/register callback.</p>
                  <p>• <strong>Still missing callback menu</strong> — This is firmware-dependent; request vendor to enable cloud callback module or upgrade firmware to the callback-enabled build.</p>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

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
              This will also remove all associated access logs.
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

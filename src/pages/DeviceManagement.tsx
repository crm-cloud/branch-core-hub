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
  Activity,
  Copy,
  Info
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { useBranchContext } from '@/contexts/BranchContext';
import { fetchDevices, deleteDevice, triggerRelay, sendDeviceCommand, subscribeToCommandStatus, getDeviceStats, AccessDevice } from "@/services/deviceService";
import { getBiometricStats } from "@/services/biometricService";
import AddDeviceDrawer from "@/components/devices/AddDeviceDrawer";
import EditDeviceDrawer from "@/components/devices/EditDeviceDrawer";
import LiveAccessLog from "@/components/devices/LiveAccessLog";
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
import { format, formatDistanceToNow } from "date-fns";

const DeviceManagement = () => {
  const queryClient = useQueryClient();
  const { selectedBranch, branches, effectiveBranchId } = useBranchContext();
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

  const triggerMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      // Send via Realtime device_commands table
      const { id: commandId } = await sendDeviceCommand(deviceId, 'relay_open', { duration: 5 });
      toast.info("Command sent to device...");
      
      // Also fire the edge function as fallback
      triggerRelay(deviceId).catch(() => {});

      // Subscribe to status updates
      const unsub = subscribeToCommandStatus(commandId, (status) => {
        if (status === 'executed') {
          toast.success("Gate opened successfully");
          unsub();
        }
      });

      // Timeout after 10s
      setTimeout(() => unsub(), 10000);
      return { message: 'Command sent' };
    },
    onError: (error: Error) => {
      toast.error(`Failed to trigger relay: ${error.message}`);
    },
  });

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
          <Button onClick={() => setIsAddDrawerOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Device
          </Button>
        </div>
      </div>

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
                      const isLive = heartbeatAge < 60;
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
                              onClick={() => triggerMutation.mutate(device.id)}
                              disabled={!device.is_online || triggerMutation.isPending}
                              title="Remote Trigger (setRelayIoValue)"
                            >
                              <PlayCircle className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditingDevice(device)}
                            >
                              <Settings2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setDeletingDevice(device)}
                              className="text-destructive hover:text-destructive"
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

      {/* Terminal Setup Guide */}
      <Collapsible>
        <Card className="border-dashed">
          <CardHeader className="pb-3">
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left">
              <Info className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-sm font-medium">Terminal Setup Guide</CardTitle>
            </CollapsibleTrigger>
            <CardDescription className="text-xs">Step-by-step instructions to configure your Android face terminal</CardDescription>
          </CardHeader>
          <CollapsibleContent>
            <CardContent className="space-y-6">
              {/* Step-by-step Guide */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm">Quick Setup (5 Minutes)</h4>
                <ol className="space-y-3 text-sm list-decimal list-inside">
                  <li><span className="font-medium">Register the device</span> — Click "Add Device" above. Enter a name, select the branch, and enter the <strong>Serial Number (SN)</strong> printed on the terminal's label.</li>
                  <li><span className="font-medium">Install the APK</span> — Copy the Incline APK to a USB drive, plug into the terminal, and install.</li>
                  <li><span className="font-medium">Configure Server URL</span> — Open Settings in the APK and paste the <strong>Terminal Sync URL</strong> below.</li>
                  <li><span className="font-medium">Set Device SN</span> — In the APK settings, enter the same Serial Number you registered in Step 1.</li>
                  <li><span className="font-medium">Test Connection</span> — The device status above should turn <span className="text-green-600 font-medium">● Live</span> within 30 seconds.</li>
                </ol>
              </div>

              {/* Primary Endpoint */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">🔗 Server URL (use this in APK Settings)</h4>
                {(() => {
                  const terminalUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/terminal-sync`;
                  return (
                    <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <code className="text-xs font-mono break-all">{terminalUrl}</code>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(terminalUrl);
                          toast.info("Terminal Sync URL copied!");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })()}
              </div>

              {/* How it works */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">How It Works</h4>
                <p className="text-xs text-muted-foreground">
                  The APK sends all requests to a single URL with a <code className="bg-muted px-1 rounded">type</code> field:
                </p>
                <div className="grid gap-2">
                  {[
                    { type: 'heartbeat', desc: 'Every 30s — keeps device status "Live" and receives pending commands (e.g., remote gate open)' },
                    { type: 'access_event', desc: 'Face recognized — validates member/staff, returns OPEN/DENIED with relay + LED instructions' },
                    { type: 'sync_request', desc: 'Downloads member roster (names, photos, IDs) for local face enrollment' },
                  ].map((item) => (
                    <div key={item.type} className="flex gap-2 p-2 rounded bg-muted/50 text-xs">
                      <code className="font-mono text-primary font-medium whitespace-nowrap">{item.type}</code>
                      <span className="text-muted-foreground">— {item.desc}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Test with curl */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">🧪 Test with curl</h4>
                {(() => {
                  const curlCmd = `curl -X POST ${import.meta.env.VITE_SUPABASE_URL}/functions/v1/terminal-sync \\
  -H "Content-Type: application/json" \\
  -d '{"type":"heartbeat","device_sn":"YOUR_SERIAL_NUMBER"}'`;
                  return (
                    <div className="relative">
                      <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">{curlCmd}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 text-slate-400 hover:text-white"
                        onClick={() => {
                          navigator.clipboard.writeText(curlCmd);
                          toast.info("curl command copied!");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })()}
                <p className="text-xs text-muted-foreground">
                  Expected response: <code className="bg-muted px-1 rounded">{"{ \"success\": true, \"commands\": [] }"}</code>
                </p>
              </div>

              {/* Legacy endpoints */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm text-muted-foreground">Legacy Endpoints (still supported)</h4>
                {[
                  { label: 'Heartbeat', path: 'device-heartbeat' },
                  { label: 'Access Event', path: 'device-access-event' },
                  { label: 'Sync Data', path: 'device-sync-data' },
                ].map((ep) => {
                  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${ep.path}`;
                  return (
                    <div key={ep.path} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/30">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">{ep.label}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate max-w-[300px]">{url}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => {
                          navigator.clipboard.writeText(url);
                          toast.info(`${ep.label} URL copied`);
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>

              {/* Android SDK Reference */}
              <div className="space-y-4">
                <h4 className="font-semibold text-sm">📱 Android SDK Reference (SMDT)</h4>

                <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                  <p className="font-medium">Integration flow for APK developers</p>
                  <p>
                    The APK must include <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded font-mono">SmdtAccessControl_1_1.jar</code> as a dependency.
                    On startup, call <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded font-mono">sync_request</code> against the Terminal Sync URL above to download the member roster and enroll faces locally.
                    When a card or face is detected, send an <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded font-mono">access_event</code> to the server.
                    Use the server's <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded font-mono">allow</code> / <code className="bg-amber-100 dark:bg-amber-900/50 px-1 rounded font-mono">deny</code> response to drive the relay and LEDs via the SMDT SDK calls below.
                  </p>
                </div>

                {[
                  {
                    label: 'Initialization',
                    code: 'SmdtManager smdt = SmdtManager.create(this);',
                  },
                  {
                    label: 'Open gate (relay on)',
                    code: 'smdt.setRelayIoValue(1);\nsmdt.setRelayIoMode(1, 5); // auto-close after 5 seconds',
                  },
                  {
                    label: 'Close gate (relay off)',
                    code: 'smdt.setRelayIoValue(0);',
                  },
                  {
                    label: 'LED — Access granted (green)',
                    code: 'smdt.setLedLighted(SmdtManager.LED_GREEN, true);',
                  },
                  {
                    label: 'LED — Access denied (red)',
                    code: 'smdt.setLedLighted(SmdtManager.LED_RED, true);',
                  },
                  {
                    label: 'LED — Idle / off (white)',
                    code: 'smdt.setLedLighted(SmdtManager.LED_WHITE, false);',
                  },
                  {
                    label: 'Read Wiegand card (blocking — run in background thread)',
                    code: '// Start reading (blocks until card is presented)\nbyte[] cardData = smdt.smdtReadWiegandData();\n\n// Release the read lock when done\nsmdt.smdtReleaseWiegandRead();',
                  },
                  {
                    label: 'Send card number via Wiegand (format 1 = Wiegand 26)',
                    code: 'smdt.smdtSendCard(cardNumber, 1);',
                  },
                ].map((snippet) => (
                  <div key={snippet.label} className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">{snippet.label}</p>
                    <div className="relative">
                      <pre className="text-xs font-mono bg-slate-900 text-slate-100 p-3 rounded-lg overflow-x-auto whitespace-pre">{snippet.code}</pre>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-6 w-6 text-slate-400 hover:text-white"
                        onClick={() => {
                          navigator.clipboard.writeText(snippet.code);
                          toast.info("Code copied!");
                        }}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
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

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
  Activity
} from "lucide-react";
import { toast } from "sonner";
import { useBranches } from "@/hooks/useBranches";
import { BranchSelector } from "@/components/dashboard/BranchSelector";
import { fetchDevices, deleteDevice, triggerRelay, getDeviceStats, AccessDevice } from "@/services/deviceService";
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
  const branchesQuery = useBranches();
  const branches = branchesQuery.data || [];
  
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState<AccessDevice | null>(null);
  const [deletingDevice, setDeletingDevice] = useState<AccessDevice | null>(null);

  const { data: devices = [], isLoading } = useQuery({
    queryKey: ['access-devices', selectedBranch],
    queryFn: () => fetchDevices(selectedBranch || undefined),
  });

  const { data: deviceStats } = useQuery({
    queryKey: ['device-stats', selectedBranch],
    queryFn: () => getDeviceStats(selectedBranch || undefined),
  });

  const { data: biometricStats } = useQuery({
    queryKey: ['biometric-stats', selectedBranch],
    queryFn: () => getBiometricStats(selectedBranch || undefined),
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
    mutationFn: triggerRelay,
    onSuccess: (data) => {
      toast.success(data.message || "Relay triggered successfully");
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
          <BranchSelector
            branches={branches}
            selectedBranch={selectedBranch}
            onBranchChange={setSelectedBranch}
            showAllOption
          />
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
                      <TableHead>IP Address</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Last Heartbeat</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {devices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-lg bg-muted">
                              {getDeviceTypeIcon(device.device_type)}
                            </div>
                            <div>
                              <div className="font-medium">{device.device_name}</div>
                              <Badge variant="outline" className="text-xs">
                                {getDeviceTypeBadge(device.device_type)}
                              </Badge>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {String(device.ip_address)}
                        </TableCell>
                        <TableCell>
                          {device.is_online ? (
                            <Badge variant="default" className="bg-green-500">
                              <Wifi className="h-3 w-3 mr-1" />
                              Online
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <WifiOff className="h-3 w-3 mr-1" />
                              Offline
                            </Badge>
                          )}
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
                              title="Remote Trigger"
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
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Live Access Log */}
        <div className="lg:col-span-1">
          <LiveAccessLog branchId={selectedBranch || undefined} />
        </div>
      </div>

      {/* Drawers */}
      <AddDeviceDrawer
        isOpen={isAddDrawerOpen}
        onClose={() => setIsAddDrawerOpen(false)}
        branches={branches}
        defaultBranchId={selectedBranch}
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

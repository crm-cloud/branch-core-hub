import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { updateDevice, AccessDevice } from "@/services/deviceService";
import { Loader2, Wifi, WifiOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface EditDeviceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  device: AccessDevice;
  branches: Array<{ id: string; name: string }>;
}

const EditDeviceDrawer = ({ isOpen, onClose, device, branches }: EditDeviceDrawerProps) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    device_name: "",
    ip_address: "",
    mac_address: "",
    branch_id: "",
    device_type: "turnstile",
    model: "",
    serial_number: "",
    relay_mode: 1,
    relay_delay: 5,
  });

  useEffect(() => {
    if (device) {
      setFormData({
        device_name: device.device_name || "",
        ip_address: String(device.ip_address) || "",
        mac_address: device.mac_address || "",
        branch_id: device.branch_id || "",
        device_type: device.device_type || "turnstile",
        model: device.model || "",
        serial_number: device.serial_number || "",
        relay_mode: device.relay_mode ?? 1,
        relay_delay: device.relay_delay ?? 5,
      });
    }
  }, [device]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<AccessDevice>) => updateDevice(device.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-devices'] });
      queryClient.invalidateQueries({ queryKey: ['device-stats'] });
      toast.success("Device updated successfully");
      onClose();
    },
    onError: (error: Error) => {
      toast.error(`Failed to update device: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.device_name.trim()) {
      toast.error("Device name is required");
      return;
    }
    
    if (!formData.ip_address.trim()) {
      toast.error("IP address is required");
      return;
    }

    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
    if (!ipRegex.test(formData.ip_address)) {
      toast.error("Please enter a valid IP address");
      return;
    }

    updateMutation.mutate(formData);
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Device</SheetTitle>
          <SheetDescription>
            Update device settings and configuration
          </SheetDescription>
        </SheetHeader>

        {/* Device Status */}
        <div className="mt-4 p-4 rounded-lg bg-muted">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Connection Status</span>
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
          </div>
          {device.last_heartbeat && (
            <p className="text-xs text-muted-foreground mt-2">
              Last seen: {formatDistanceToNow(new Date(device.last_heartbeat), { addSuffix: true })}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-2">
            <Label htmlFor="device_name">Device Name *</Label>
            <Input
              id="device_name"
              value={formData.device_name}
              onChange={(e) => setFormData({ ...formData, device_name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="ip_address">IP Address *</Label>
            <Input
              id="ip_address"
              value={formData.ip_address}
              onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="mac_address">MAC Address</Label>
            <Input
              id="mac_address"
              value={formData.mac_address}
              onChange={(e) => setFormData({ ...formData, mac_address: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="branch">Branch *</Label>
            <Select
              value={formData.branch_id}
              onValueChange={(value) => setFormData({ ...formData, branch_id: value })}
            >
              <SelectTrigger>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="device_type">Device Type</Label>
            <Select
              value={formData.device_type}
              onValueChange={(value) => setFormData({ ...formData, device_type: value })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="turnstile">Turnstile Gate</SelectItem>
                <SelectItem value="face_terminal">Face Recognition Terminal</SelectItem>
                <SelectItem value="card_reader">Card Reader</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="serial_number">Serial Number</Label>
              <Input
                id="serial_number"
                value={formData.serial_number}
                onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="relay_mode">Relay Mode</Label>
            <Select
              value={formData.relay_mode.toString()}
              onValueChange={(value) => setFormData({ ...formData, relay_mode: parseInt(value) })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Manual Control</SelectItem>
                <SelectItem value="1">Auto-Close</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.relay_mode === 1 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Auto-Close Delay</Label>
                <span className="text-sm font-medium">{formData.relay_delay} seconds</span>
              </div>
              <Slider
                value={[formData.relay_delay]}
                onValueChange={([value]) => setFormData({ ...formData, relay_delay: value })}
                min={1}
                max={63}
                step={1}
                className="w-full"
              />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={updateMutation.isPending} className="flex-1">
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default EditDeviceDrawer;

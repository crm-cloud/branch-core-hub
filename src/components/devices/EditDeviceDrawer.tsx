import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
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
  const config = (device.config as any) || {};
  const caps = config?.capabilities || {};

  const [formData, setFormData] = useState({
    device_name: "",
    serial_number: "",
    ip_address: "",
    mac_address: "",
    branch_id: "",
    model: "",
    relay_mode: 1,
    relay_delay: 5,
    cap_facial: true,
    cap_wiegand: false,
    cap_relay: true,
  });

  useEffect(() => {
    if (device) {
      setFormData({
        device_name: device.device_name || "",
        serial_number: device.serial_number || "",
        ip_address: String(device.ip_address) || "",
        mac_address: device.mac_address || "",
        branch_id: device.branch_id || "",
        model: device.model || "",
        relay_mode: device.relay_mode ?? 1,
        relay_delay: device.relay_delay ?? 5,
        cap_facial: caps.facial_recognition ?? true,
        cap_wiegand: caps.wiegand_card_reader ?? false,
        cap_relay: caps.relay_turnstile ?? true,
      });
    }
  }, [device]);

  const updateMutation = useMutation({
    mutationFn: (data: any) => updateDevice(device.id, data),
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
    if (!formData.device_name.trim()) { toast.error("Device name is required"); return; }
    if (!formData.serial_number.trim()) { toast.error("Serial Number is required"); return; }

    updateMutation.mutate({
      device_name: formData.device_name,
      serial_number: formData.serial_number,
      ip_address: formData.ip_address.trim() || '0.0.0.0',
      mac_address: formData.mac_address,
      branch_id: formData.branch_id,
      model: formData.model,
      relay_mode: formData.relay_mode,
      relay_delay: formData.relay_delay,
      config: {
        capabilities: {
          facial_recognition: formData.cap_facial,
          wiegand_card_reader: formData.cap_wiegand,
          relay_turnstile: formData.cap_relay,
        },
      },
    });
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit Device</SheetTitle>
          <SheetDescription>Update device settings and configuration</SheetDescription>
        </SheetHeader>

        {/* Status */}
        <div className="mt-4 p-4 rounded-lg bg-muted">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Connection Status</span>
            {device.is_online ? (
              <Badge variant="default" className="bg-green-500"><Wifi className="h-3 w-3 mr-1" />Online</Badge>
            ) : (
              <Badge variant="destructive"><WifiOff className="h-3 w-3 mr-1" />Offline</Badge>
            )}
          </div>
          {device.last_heartbeat && (
            <p className="text-xs text-muted-foreground mt-2">Last seen: {formatDistanceToNow(new Date(device.last_heartbeat), { addSuffix: true })}</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-2">
            <Label>Device Name *</Label>
            <Input value={formData.device_name} onChange={(e) => setFormData({ ...formData, device_name: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label>Serial Number (SN) *</Label>
            <Input value={formData.serial_number} onChange={(e) => setFormData({ ...formData, serial_number: e.target.value })} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>IP Address <span className="text-xs text-muted-foreground">(auto)</span></Label>
              <Input value={formData.ip_address} onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })} placeholder="Auto-detected" />
            </div>
            <div className="space-y-2">
              <Label>MAC Address</Label>
              <Input value={formData.mac_address} onChange={(e) => setFormData({ ...formData, mac_address: e.target.value })} />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Branch *</Label>
            <Select value={formData.branch_id} onValueChange={(value) => setFormData({ ...formData, branch_id: value })}>
              <SelectTrigger><SelectValue placeholder="Select branch" /></SelectTrigger>
              <SelectContent>
                {branches.map((branch) => (<SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Model</Label>
            <Input value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} />
          </div>

          {/* Capabilities */}
          <div className="space-y-3 p-4 border rounded-lg">
            <Label className="font-medium">Hardware Capabilities</Label>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox id="edit_cap_facial" checked={formData.cap_facial} onCheckedChange={(v) => setFormData({ ...formData, cap_facial: !!v })} />
                <Label htmlFor="edit_cap_facial" className="font-normal cursor-pointer">Facial Recognition</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="edit_cap_wiegand" checked={formData.cap_wiegand} onCheckedChange={(v) => setFormData({ ...formData, cap_wiegand: !!v })} />
                <Label htmlFor="edit_cap_wiegand" className="font-normal cursor-pointer">Wiegand Card Reader</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="edit_cap_relay" checked={formData.cap_relay} onCheckedChange={(v) => setFormData({ ...formData, cap_relay: !!v })} />
                <Label htmlFor="edit_cap_relay" className="font-normal cursor-pointer">Relay Turnstile Control</Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Relay Mode</Label>
            <Select value={formData.relay_mode.toString()} onValueChange={(value) => setFormData({ ...formData, relay_mode: parseInt(value) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Slider value={[formData.relay_delay]} onValueChange={([value]) => setFormData({ ...formData, relay_delay: value })} min={1} max={63} step={1} className="w-full" />
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
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

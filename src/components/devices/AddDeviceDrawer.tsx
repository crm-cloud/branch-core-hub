import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { addDevice } from "@/services/deviceService";
import { Loader2 } from "lucide-react";

interface AddDeviceDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  branches: Array<{ id: string; name: string }>;
  defaultBranchId?: string;
}

const AddDeviceDrawer = ({ isOpen, onClose, branches, defaultBranchId }: AddDeviceDrawerProps) => {
  const queryClient = useQueryClient();
  const normalizeSn = (value: string) => value.trim().toUpperCase();
  const isValidIp = (value: string) => /^(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d{2}|[1-9]?\d)){3}$/.test(value);
  const isValidMac = (value: string) => /^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(value);
  const [formData, setFormData] = useState({
    device_name: "",
    serial_number: "",
    ip_address: "",
    mac_address: "",
    branch_id: defaultBranchId || "",
    device_type: "face_terminal",
    model: "",
    relay_mode: 1,
    relay_delay: 5,
    cap_facial: true,
    cap_wiegand: false,
    cap_relay: true,
  });

  const addMutation = useMutation({
    mutationFn: addDevice,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['access-devices'] });
      queryClient.invalidateQueries({ queryKey: ['device-stats'] });
      toast.success("Device added successfully");
      onClose();
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(`Failed to add device: ${error.message}`);
    },
  });

  const resetForm = () => {
    setFormData({
      device_name: "",
      serial_number: "",
      ip_address: "",
      mac_address: "",
      branch_id: defaultBranchId || "",
      device_type: "face_terminal",
      model: "",
      relay_mode: 1,
      relay_delay: 5,
      cap_facial: true,
      cap_wiegand: false,
      cap_relay: true,
    });
  };

  useEffect(() => {
    setFormData((prev) => ({ ...prev, branch_id: defaultBranchId || "" }));
  }, [defaultBranchId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.device_name.trim()) { toast.error("Device name is required"); return; }
    if (!normalizeSn(formData.serial_number)) { toast.error("Serial Number is required"); return; }
    if (!formData.branch_id) { toast.error("Please select a branch"); return; }

    const ip = formData.ip_address.trim();
    const mac = formData.mac_address.trim();
    if (ip && !isValidIp(ip)) { toast.error("Invalid IP address format"); return; }
    if (mac && !isValidMac(mac)) { toast.error("Invalid MAC address format"); return; }

    addMutation.mutate({
      ...formData,
      serial_number: normalizeSn(formData.serial_number),
      ip_address: ip || '0.0.0.0',
      mac_address: mac || undefined,
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
          <SheetTitle>Add Access Device</SheetTitle>
          <SheetDescription>Register a new face terminal or access control device</SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-6">
          <div className="space-y-2">
            <Label htmlFor="device_name">Device Name *</Label>
            <Input id="device_name" placeholder="e.g., Main Entrance Terminal" value={formData.device_name} onChange={(e) => setFormData({ ...formData, device_name: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="serial_number">Device Serial Number (SN) *</Label>
              <Input id="serial_number" placeholder="e.g., SN-2024-ABCDEF" value={formData.serial_number} onChange={(e) => setFormData({ ...formData, serial_number: normalizeSn(e.target.value) })} />
            <p className="text-xs text-muted-foreground">Primary identifier — the device registers with the cloud using this SN</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="ip_address">IP Address <span className="text-xs text-muted-foreground">(optional)</span></Label>
              <Input id="ip_address" placeholder="Auto-detected from heartbeat" value={formData.ip_address} onChange={(e) => setFormData({ ...formData, ip_address: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mac_address">MAC Address</Label>
              <Input id="mac_address" placeholder="AA:BB:CC:DD:EE:FF" value={formData.mac_address} onChange={(e) => setFormData({ ...formData, mac_address: e.target.value })} />
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
            <Input placeholder="e.g., SMDT-X1" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })} />
          </div>

          {/* Hardware Capabilities */}
          <div className="space-y-3 p-4 border rounded-lg">
            <Label className="font-medium">Hardware Capabilities</Label>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Checkbox id="cap_facial" checked={formData.cap_facial} onCheckedChange={(v) => setFormData({ ...formData, cap_facial: !!v })} />
                <Label htmlFor="cap_facial" className="font-normal cursor-pointer">Facial Recognition</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="cap_wiegand" checked={formData.cap_wiegand} onCheckedChange={(v) => setFormData({ ...formData, cap_wiegand: !!v })} />
                <Label htmlFor="cap_wiegand" className="font-normal cursor-pointer">Wiegand Card Reader</Label>
              </div>
              <div className="flex items-center gap-3">
                <Checkbox id="cap_relay" checked={formData.cap_relay} onCheckedChange={(v) => setFormData({ ...formData, cap_relay: !!v })} />
                <Label htmlFor="cap_relay" className="font-normal cursor-pointer">Relay Turnstile Control</Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Relay Mode</Label>
            <Select value={formData.relay_mode.toString()} onValueChange={(value) => setFormData({ ...formData, relay_mode: parseInt(value) })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Manual Control</SelectItem>
                <SelectItem value="1">Auto-Close (setRelayIoMode 1)</SelectItem>
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
              <p className="text-xs text-muted-foreground">Gate auto-closes after this duration · Uses setRelayIoMode(1, {formData.relay_delay})</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={addMutation.isPending} className="flex-1">
              {addMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Device
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
};

export default AddDeviceDrawer;

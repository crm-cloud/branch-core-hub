import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Monitor, Wifi, WifiOff, DoorOpen, RotateCcw, Clock,
} from "lucide-react";
import { fetchMIPSDevices, remoteOpenDoor, restartDevice, type MIPSDevice } from "@/services/mipsService";
import { toast } from "sonner";

const MIPSDeviceCard = ({ device }: { device: MIPSDevice }) => {
  const isOnline = device.status === 1;
  const [isOpening, setIsOpening] = useState(false);
  const [isRestarting, setIsRestarting] = useState(false);

  const handleOpenDoor = async () => {
    setIsOpening(true);
    try {
      const result = await remoteOpenDoor(device.id);
      if (result.success) {
        toast.success(`Door opened on ${device.name}`);
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setIsOpening(false);
    }
  };

  const handleRestart = async () => {
    setIsRestarting(true);
    try {
      const result = await restartDevice(device.deviceKey);
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    } finally {
      setIsRestarting(false);
    }
  };

  return (
    <Card className={`rounded-2xl shadow-lg transition-all ${isOnline ? "shadow-green-500/10 border-green-500/20" : "shadow-muted/20"}`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${isOnline ? "bg-green-500/10" : "bg-muted"}`}>
              <Monitor className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">{device.name || device.deviceKey}</CardTitle>
              <CardDescription className="text-xs font-mono">
                Key: {device.deviceKey}
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${isOnline ? "bg-green-500 animate-pulse" : "bg-destructive"}`} />
            <Badge variant={isOnline ? "default" : "destructive"} className="text-xs">
              {isOnline ? "Online" : "Offline"}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Persons</p>
            <p className="text-sm font-bold">{device.personCount || 0}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Faces</p>
            <p className="text-sm font-bold">{device.faceCount || 0}</p>
          </div>
          <div className="rounded-lg bg-muted/50 p-2 text-center">
            <p className="text-[10px] text-muted-foreground">Last Active</p>
            <p className="text-[10px] font-medium truncate">
              {device.lastActiveTime ? new Date(device.lastActiveTime).toLocaleTimeString() : "—"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="flex-1"
            onClick={handleOpenDoor}
            disabled={!isOnline || isOpening}
          >
            <DoorOpen className={`h-3.5 w-3.5 mr-1.5 ${isOpening ? "animate-pulse" : ""}`} />
            {isOpening ? "Opening..." : "Open Door"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRestart}
            disabled={!isOnline || isRestarting}
          >
            <RotateCcw className={`h-3.5 w-3.5 ${isRestarting ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

interface MIPSDevicesTabProps {
  branchId?: string;
}

const MIPSDevicesTab = ({ branchId }: MIPSDevicesTabProps) => {
  const { data: devices = [], isLoading, refetch } = useQuery({
    queryKey: ["mips-devices"],
    queryFn: fetchMIPSDevices,
    staleTime: 30_000,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <RotateCcw className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (devices.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-muted-foreground">
        <Monitor className="h-12 w-12 mb-3 opacity-30" />
        <p className="text-sm">No devices found on MIPS server</p>
        <p className="text-xs mt-1">Make sure the MIPS server is running and devices are connected</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => refetch()}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {devices.map((device) => (
        <MIPSDeviceCard key={device.id || device.deviceKey} device={device} />
      ))}
    </div>
  );
};

export default MIPSDevicesTab;

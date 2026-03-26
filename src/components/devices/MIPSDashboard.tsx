import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import MIPSConnectionCard from "./MIPSConnectionCard";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Monitor, Wifi, WifiOff, Users, Fingerprint, RefreshCw, Server, Heart,
} from "lucide-react";
import { testMIPSConnection, fetchMIPSDevices, type MIPSDevice } from "@/services/mipsService";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface MIPSDashboardProps {
  branchId?: string;
  branchName?: string;
}

const MIPSDashboard = ({ branchId, branchName }: MIPSDashboardProps) => {
  const [lastChecked, setLastChecked] = useState<Date>(new Date());
  const [heartbeatPulse, setHeartbeatPulse] = useState(false);
  const prevDeviceStatusRef = useRef<Map<string, number>>(new Map());

  const { data: mipsConnection, isLoading: isTestingConnection, refetch: retestConnection } = useQuery({
    queryKey: ["mips-connection-test", branchId || "all"],
    queryFn: () => testMIPSConnection(branchId),
    staleTime: 10_000,
    refetchInterval: 15_000,
    retry: false,
  });

  const { data: mipsDevices = [] as MIPSDevice[], dataUpdatedAt } = useQuery<MIPSDevice[]>({
    queryKey: ["mips-devices", branchId || "all"],
    queryFn: () => fetchMIPSDevices(branchId),
    enabled: !!mipsConnection?.success,
    staleTime: 10_000,
    refetchInterval: 15_000,
  });

  useEffect(() => {
    if (dataUpdatedAt) {
      setLastChecked(new Date(dataUpdatedAt));
      setHeartbeatPulse(true);
      const timer = setTimeout(() => setHeartbeatPulse(false), 1000);
      return () => clearTimeout(timer);
    }
  }, [dataUpdatedAt]);

  useEffect(() => {
    if (mipsDevices.length === 0) return;

    const currentStatusMap = new Map<string, number>();
    mipsDevices.forEach((d) => {
      currentStatusMap.set(d.deviceKey || String(d.id), d.onlineFlag ?? d.status);
    });

    const prev = prevDeviceStatusRef.current;
    if (prev.size > 0) {
      for (const [deviceId, prevStatus] of prev.entries()) {
        const currentStatus = currentStatusMap.get(deviceId);
        if (prevStatus === 1 && currentStatus !== undefined && currentStatus !== 1) {
          const deviceName = mipsDevices.find((d) => (d.deviceKey || String(d.id)) === deviceId)?.name || deviceId;
          sendOfflineNotification(deviceName);
        }
      }
    }

    prevDeviceStatusRef.current = currentStatusMap;
  }, [mipsDevices]);

  const sendOfflineNotification = async (deviceName: string) => {
    try {
      const { data: adminUsers } = await supabase
        .from("user_roles" as any)
        .select("user_id")
        .in("role", ["owner", "admin"]);

      if (adminUsers && adminUsers.length > 0) {
        const notifications = (adminUsers as any[]).map((u: any) => ({
          user_id: u.user_id,
          title: "Device Offline Alert",
          message: `Device "${deviceName}" has gone offline. Please check the hardware connection.`,
          type: "warning" as const,
          category: "device",
          is_read: false,
        }));

        await supabase.from("notifications").insert(notifications);
      }
    } catch (e) {
      console.warn("Failed to send offline notification:", e);
    }
  };

  const mipsOnline = mipsDevices.filter((d) => (d.onlineFlag === 1 || d.status === 1)).length;
  const mipsTotal = mipsDevices.length;
  const mipsFaces = mipsDevices.reduce((sum, d) => sum + (d.faceCount || 0), 0);
  const mipsPersons = mipsDevices.reduce((sum, d) => sum + (d.personCount || 0), 0);

  return (
    <div className="space-y-6">
      <Card className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur">
                <Server className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold">MIPS Middleware Server</h3>
                <p className="text-sm text-white/70">Smart Pass v3 • RuoYi Cloud Integration</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Badge
                variant="outline"
                className={`border-white/30 ${
                  mipsConnection?.success
                    ? "bg-green-500/20 text-green-200"
                    : "bg-destructive/20 text-red-200"
                }`}
              >
                <div className={`h-2 w-2 rounded-full mr-1.5 ${
                  mipsConnection?.success ? "bg-green-400 animate-pulse" : "bg-red-400"
                }`} />
                {isTestingConnection ? "Testing..." : mipsConnection?.success ? "Connected" : "Disconnected"}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="text-white/70 hover:text-white hover:bg-white/10"
                onClick={() => retestConnection()}
              >
                <RefreshCw className={`h-4 w-4 ${isTestingConnection ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-white/50">
            <Heart className={`h-3 w-3 transition-transform ${heartbeatPulse ? "scale-150 text-red-300" : "scale-100"}`} />
            <span>Last checked: {formatDistanceToNow(lastChecked, { addSuffix: true })}</span>
            <span className="text-white/30">• Auto-refresh every 15s</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl shadow-lg shadow-muted/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-primary/10">
                <Monitor className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total Devices</p>
                <p className="text-2xl font-bold">{mipsTotal}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-lg shadow-muted/20 relative overflow-hidden">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-green-500/10 relative">
                {mipsOnline > 0 ? (
                  <>
                    <Wifi className="h-5 w-5 text-green-500" />
                    <span className="absolute inset-0 rounded-full border-2 border-green-400 animate-ping opacity-30" />
                  </>
                ) : (
                  <WifiOff className="h-5 w-5 text-destructive" />
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Online</p>
                <p className="text-2xl font-bold text-green-600">
                  {mipsOnline}
                  <span className="text-sm font-normal text-muted-foreground">/{mipsTotal}</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-lg shadow-muted/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-blue-500/10">
                <Fingerprint className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Faces Enrolled</p>
                <p className="text-2xl font-bold">{mipsFaces}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-lg shadow-muted/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-orange-500/10">
                <Users className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Persons Registered</p>
                <p className="text-2xl font-bold">{mipsPersons}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <MIPSConnectionCard branchId={branchId} branchName={branchName} />
    </div>
  );
};

export default MIPSDashboard;

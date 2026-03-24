import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Monitor, Wifi, WifiOff, Users, Fingerprint, Activity, RefreshCw, Server,
} from "lucide-react";
import { testMIPSConnection, fetchMIPSDevices } from "@/services/mipsService";
import { getDeviceStats } from "@/services/deviceService";
import { getBiometricStats } from "@/services/biometricService";

interface MIPSDashboardProps {
  branchId?: string;
}

const MIPSDashboard = ({ branchId }: MIPSDashboardProps) => {
  const { data: mipsConnection, isLoading: isTestingConnection, refetch: retestConnection } = useQuery({
    queryKey: ["mips-connection-test"],
    queryFn: testMIPSConnection,
    staleTime: 60_000,
    retry: false,
  });

  const { data: mipsDevices = [] } = useQuery({
    queryKey: ["mips-devices"],
    queryFn: fetchMIPSDevices,
    enabled: !!mipsConnection?.success,
    staleTime: 30_000,
  });

  const { data: localStats } = useQuery({
    queryKey: ["device-stats", branchId],
    queryFn: () => getDeviceStats(branchId),
  });

  const { data: biometricStats } = useQuery({
    queryKey: ["biometric-stats", branchId],
    queryFn: () => getBiometricStats(branchId),
  });

  const mipsOnline = mipsDevices.filter((d) => d.status === 1).length;
  const mipsTotal = mipsDevices.length;
  const mipsFaces = mipsDevices.reduce((sum, d) => sum + (d.faceCount || 0), 0);
  const mipsPersons = mipsDevices.reduce((sum, d) => sum + (d.personCount || 0), 0);

  return (
    <div className="space-y-6">
      {/* MIPS Connection Status */}
      <Card className="rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-xl">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-2xl bg-white/10 backdrop-blur">
                <Server className="h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-bold">MIPS Middleware Server</h3>
                <p className="text-sm text-white/70">Smart Pass Integration Hub</p>
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
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="rounded-2xl shadow-lg shadow-muted/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-primary/10">
                <Monitor className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">MIPS Devices</p>
                <p className="text-2xl font-bold">{mipsTotal}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl shadow-lg shadow-muted/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-full bg-green-500/10">
                {mipsOnline > 0 ? (
                  <Wifi className="h-5 w-5 text-green-500" />
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
                <p className="text-xs text-muted-foreground">Faces on Devices</p>
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
                <p className="text-xs text-muted-foreground">Local Enrolled</p>
                <p className="text-2xl font-bold">
                  {biometricStats?.enrolledTotal || 0}
                  <span className="text-sm font-normal text-muted-foreground">
                    /{biometricStats?.totalPeople || 0}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Local vs MIPS comparison */}
      <Card className="rounded-2xl shadow-lg shadow-muted/20">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 divide-x">
            <div className="pr-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">Local (Supabase)</p>
              <p className="text-lg font-bold">{localStats?.total || 0} devices</p>
              <p className="text-sm text-muted-foreground">
                {localStats?.online || 0} online / {localStats?.offline || 0} offline
              </p>
            </div>
            <div className="pl-4 text-center">
              <p className="text-xs text-muted-foreground mb-1">MIPS Server</p>
              <p className="text-lg font-bold">{mipsTotal} devices</p>
              <p className="text-sm text-muted-foreground">
                {mipsPersons} persons / {mipsFaces} faces
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MIPSDashboard;

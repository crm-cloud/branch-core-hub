import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, RefreshCw, Users, Monitor, Activity, Bug, TestTube, Copy, Server, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useBranchContext } from "@/contexts/BranchContext";
import { useAuth } from "@/contexts/AuthContext";
import AddDeviceDrawer from "@/components/devices/AddDeviceDrawer";
import LiveAccessLog from "@/components/devices/LiveAccessLog";
import MIPSDashboard from "@/components/devices/MIPSDashboard";
import MIPSDevicesTab from "@/components/devices/MIPSDevicesTab";
import PersonnelSyncTab from "@/components/devices/PersonnelSyncTab";
import { testMIPSConnection, fetchMIPSDevices, fetchMIPSEmployees, fetchMIPSPassRecords, manualSyncTest } from "@/services/mipsService";

const DeviceManagement = () => {
  const { hasAnyRole } = useAuth();
  const isAdminOrOwner = hasAnyRole(["owner", "admin"]);
  const queryClient = useQueryClient();
  const { selectedBranch, branches } = useBranchContext();
  const branchFilter = selectedBranch !== "all" ? selectedBranch : "";
  const [isAddDrawerOpen, setIsAddDrawerOpen] = useState(false);
  const [debugResult, setDebugResult] = useState<string | null>(null);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["mips-connection-test"] });
    queryClient.invalidateQueries({ queryKey: ["mips-devices"] });
    queryClient.invalidateQueries({ queryKey: ["personnel-sync"] });
    queryClient.invalidateQueries({ queryKey: ["access-logs-live"] });
    toast.info("Refreshing all data...");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Device Command Center</h1>
            <p className="text-muted-foreground">
              MIPS Middleware Integration • Facial Recognition & Access Control
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={refreshAll}>
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button onClick={() => setIsAddDrawerOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Device
            </Button>
          </div>
        </div>

        <Tabs defaultValue="dashboard" className="space-y-4">
          <TabsList className="bg-muted/60">
            <TabsTrigger value="dashboard" className="gap-1.5">
              <Server className="h-4 w-4" /> Dashboard
            </TabsTrigger>
            <TabsTrigger value="devices" className="gap-1.5">
              <Monitor className="h-4 w-4" /> Devices
            </TabsTrigger>
            <TabsTrigger value="sync" className="gap-1.5">
              <Upload className="h-4 w-4" /> Personnel Sync
            </TabsTrigger>
            <TabsTrigger value="live-feed" className="gap-1.5">
              <Activity className="h-4 w-4" /> Live Feed
            </TabsTrigger>
            {isAdminOrOwner && (
              <TabsTrigger value="debug" className="gap-1.5">
                <Bug className="h-4 w-4" /> Debug
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="dashboard">
            <MIPSDashboard branchId={branchFilter || undefined} />
          </TabsContent>

          <TabsContent value="devices">
            <MIPSDevicesTab branchId={branchFilter || undefined} />
          </TabsContent>

          <TabsContent value="sync">
            <Card className="rounded-2xl">
              <CardHeader>
                <CardTitle className="text-base">Personnel Sync to MIPS</CardTitle>
                <CardDescription>
                  Push member and staff profiles with face photos to the hardware via MIPS middleware
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PersonnelSyncTab branchId={branchFilter || undefined} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="live-feed">
            <LiveAccessLog branchId={branchFilter || undefined} limit={50} />
          </TabsContent>

          {isAdminOrOwner && (
            <TabsContent value="debug">
              <Card className="rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Bug className="h-5 w-5" />
                    E2E Test Checklist & Debug Tools
                  </CardTitle>
                  <CardDescription>
                    Webhook URL: <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                      https://iyqqpbvnszyrrgerniog.supabase.co/functions/v1/mips-webhook-receiver
                    </code>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    {[
                      "Create test member → verify appears in Personnel Sync tab",
                      "Upload face photo → verify sync to MIPS shows 'Synced'",
                      "Remote open door → verify MIPS device relay clicks",
                      "Face scan at terminal → verify event appears in Live Feed",
                      "Staff scan → verify staff attendance toggle works",
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
                        <input type="checkbox" className="h-4 w-4 rounded border-border" />
                        <span className="text-sm">{item}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button variant="outline" size="sm" onClick={async () => {
                      try {
                        setDebugResult("Testing MIPS connection...");
                        const result = await testMIPSConnection();
                        setDebugResult(JSON.stringify(result, null, 2));
                      } catch (err: any) { setDebugResult(`Error: ${err.message}`); }
                    }}>
                      <TestTube className="h-3.5 w-3.5 mr-1.5" /> Test MIPS Connection
                    </Button>
                    <Button variant="outline" size="sm" onClick={async () => {
                      try {
                        setDebugResult("Fetching MIPS devices...");
                        const devices = await fetchMIPSDevices();
                        setDebugResult(JSON.stringify(devices, null, 2));
                      } catch (err: any) { setDebugResult(`Error: ${err.message}`); }
                    }}>
                      <Monitor className="h-3.5 w-3.5 mr-1.5" /> Raw MIPS Devices
                    </Button>
                    <Button variant="outline" size="sm" onClick={async () => {
                      try {
                        setDebugResult("Fetching MIPS employees...");
                        const result = await fetchMIPSEmployees();
                        setDebugResult(JSON.stringify(result, null, 2));
                      } catch (err: any) { setDebugResult(`Error: ${err.message}`); }
                    }}>
                      <Users className="h-3.5 w-3.5 mr-1.5" /> Raw MIPS Employees
                    </Button>
                    <Button variant="outline" size="sm" onClick={async () => {
                      try {
                        setDebugResult("Fetching MIPS pass records...");
                        const result = await fetchMIPSPassRecords();
                        setDebugResult(JSON.stringify(result, null, 2));
                      } catch (err: any) { setDebugResult(`Error: ${err.message}`); }
                    }}>
                      <Activity className="h-3.5 w-3.5 mr-1.5" /> Raw Pass Records
                    </Button>
                  </div>

                  {debugResult && (
                    <div className="relative">
                      <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6"
                        onClick={() => { navigator.clipboard.writeText(debugResult); toast.success("Copied"); }}>
                        <Copy className="h-3 w-3" />
                      </Button>
                      <pre className="text-xs bg-muted rounded-lg p-4 overflow-x-auto max-h-96 whitespace-pre-wrap break-all">
                        {debugResult}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>

        <AddDeviceDrawer
          isOpen={isAddDrawerOpen}
          onClose={() => setIsAddDrawerOpen(false)}
          branches={branches}
          defaultBranchId={branchFilter}
        />
      </div>
    </AppLayout>
  );
};

export default DeviceManagement;

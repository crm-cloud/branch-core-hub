import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Wifi, WifiOff, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { AccessDevice } from "@/services/deviceService";

interface DeviceSetupCardProps {
  device: AccessDevice;
}

const DeviceSetupCard = ({ device }: DeviceSetupCardProps) => {
  const serverUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/terminal-iclock`;
  const heartbeatAge = device.last_heartbeat
    ? (Date.now() - new Date(device.last_heartbeat).getTime()) / 1000
    : Infinity;
  const isLive = heartbeatAge < 120;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.info(`${label} copied!`);
  };

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            {isLive ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-destructive" />
            )}
            {device.device_name}
          </CardTitle>
          <Badge variant={isLive ? "default" : "destructive"} className="text-xs">
            {isLive ? "Connected" : "Not Connected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Server URL */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Server URL (enter in terminal App Settings)</label>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background border">
            <code className="text-xs font-mono break-all flex-1">{serverUrl}</code>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => copyToClipboard(serverUrl, "Server URL")}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Device SN */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Device Serial Number (SN)</label>
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-background border">
            <code className="text-xs font-mono flex-1">{device.serial_number || "Not set"}</code>
            {device.serial_number && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => copyToClipboard(device.serial_number!, "Serial Number")}
              >
                <Copy className="h-3 w-3" />
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            This must match the SN shown in terminal's System Info / App Settings
          </p>
        </div>

        {/* Connection Status */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-2.5 rounded-lg bg-background border space-y-1">
            <p className="text-xs text-muted-foreground">Last Heartbeat</p>
            <p className="text-xs font-medium">
              {device.last_heartbeat
                ? formatDistanceToNow(new Date(device.last_heartbeat), { addSuffix: true })
                : "Never"}
            </p>
          </div>
          <div className="p-2.5 rounded-lg bg-background border space-y-1">
            <p className="text-xs text-muted-foreground">Last Sync</p>
            <p className="text-xs font-medium">
              {device.last_sync
                ? formatDistanceToNow(new Date(device.last_sync), { addSuffix: true })
                : "Never"}
            </p>
          </div>
        </div>

        {/* Quick Setup Steps */}
        <div className="p-3 rounded-lg bg-muted/50 space-y-2">
          <p className="text-xs font-semibold">Quick Setup</p>
          <ol className="space-y-1.5 text-xs text-muted-foreground list-decimal list-inside">
            <li>On terminal → <strong>System Settings → App Settings</strong></li>
            <li>Set <strong>Server URL</strong> to the URL above</li>
            <li>Set <strong>Push Interval</strong> to <strong>30 seconds</strong></li>
            <li>Enable <strong>Realtime Push</strong></li>
            <li>Verify status turns <span className="text-green-600 font-medium">Connected</span> above</li>
          </ol>
        </div>

        {/* Status indicators */}
        <div className="flex flex-wrap gap-2">
          {isLive ? (
            <div className="flex items-center gap-1 text-xs text-green-600">
              <CheckCircle2 className="h-3 w-3" />
              Receiving heartbeats
            </div>
          ) : (
            <div className="flex items-center gap-1 text-xs text-destructive">
              <AlertCircle className="h-3 w-3" />
              No heartbeat — check Server URL
            </div>
          )}
          {device.firmware_version && (
            <Badge variant="outline" className="text-xs">
              FW: {device.firmware_version}
            </Badge>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DeviceSetupCard;

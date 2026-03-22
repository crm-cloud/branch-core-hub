import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Activity, User, Shield, AlertTriangle, RefreshCw, Eye } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface AccessLogEntry {
  id: string;
  device_sn: string;
  event_type: string;
  result: string | null;
  message: string | null;
  member_id: string | null;
  profile_id: string | null;
  branch_id: string | null;
  payload: Record<string, unknown> | null;
  captured_at: string | null;
  created_at: string;
}

interface LiveAccessLogProps {
  branchId?: string;
  limit?: number;
}

const resultConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  member: { color: "bg-green-500", icon: <User className="h-3 w-3" />, label: "Member" },
  staff: { color: "bg-blue-500", icon: <Shield className="h-3 w-3" />, label: "Staff" },
  stranger: { color: "bg-orange-500", icon: <AlertTriangle className="h-3 w-3" />, label: "Stranger" },
  not_found: { color: "bg-destructive", icon: <AlertTriangle className="h-3 w-3" />, label: "Not Found" },
  member_denied: { color: "bg-destructive", icon: <User className="h-3 w-3" />, label: "Denied" },
  ignored: { color: "bg-muted-foreground", icon: <Activity className="h-3 w-3" />, label: "Ignored" },
  accepted: { color: "bg-green-500", icon: <Activity className="h-3 w-3" />, label: "Accepted" },
};

const LiveAccessLog = ({ branchId, limit = 20 }: LiveAccessLogProps) => {
  const queryClient = useQueryClient();
  const [liveEvents, setLiveEvents] = useState<AccessLogEntry[]>([]);
  const [expandedPayload, setExpandedPayload] = useState<string | null>(null);

  const { data: initialEvents = [], isLoading } = useQuery({
    queryKey: ["access-logs-live", branchId, limit],
    queryFn: async () => {
      let query = supabase
        .from("access_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (branchId) {
        query = query.eq("branch_id", branchId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as AccessLogEntry[];
    },
  });

  useEffect(() => {
    setLiveEvents(initialEvents);
  }, [initialEvents]);

  // Realtime subscription on access_logs
  useEffect(() => {
    const channel = supabase
      .channel("access-logs-realtime-" + (branchId || "all"))
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "access_logs",
          ...(branchId ? { filter: `branch_id=eq.${branchId}` } : {}),
        },
        (payload) => {
          const newEntry = payload.new as AccessLogEntry;
          setLiveEvents((prev) => [newEntry, ...prev].slice(0, limit));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [branchId, limit]);

  const getConfig = (result: string | null) => {
    return resultConfig[result || ""] || resultConfig.ignored;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Live Access Feed</CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => queryClient.invalidateQueries({ queryKey: ["access-logs-live"] })}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[420px] pr-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : liveEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Activity className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">No access events yet</p>
              <p className="text-xs mt-1">Events will appear here in real-time</p>
            </div>
          ) : (
            <div className="relative ml-4">
              <div className="absolute left-[7px] top-3 bottom-3 w-0.5 bg-border" />
              <div className="space-y-3">
                {liveEvents.map((event) => {
                  const config = getConfig(event.result);
                  return (
                    <div key={event.id} className="relative pl-6">
                      <div className="flex items-start gap-3">
                        {/* Timeline dot */}
                        <div
                          className={`absolute left-0 top-2 w-[15px] h-[15px] rounded-full border-2 border-background z-10 ${config.color}`}
                        />

                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs bg-muted">
                            {config.icon}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-1.5 py-0 ${
                                event.result === "member" || event.result === "staff" || event.result === "accepted"
                                  ? "bg-green-500/10 text-green-700 border-green-500/20"
                                  : event.result === "stranger" || event.result === "not_found" || event.result === "member_denied"
                                  ? "bg-destructive/10 text-destructive border-destructive/20"
                                  : "bg-muted"
                              }`}
                            >
                              {config.label}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-mono">
                              {event.device_sn}
                            </span>
                          </div>
                          <p className="text-xs mt-0.5 truncate">{event.message || "—"}</p>

                          {/* Expandable payload inspector */}
                          {event.payload && (
                            <Collapsible
                              open={expandedPayload === event.id}
                              onOpenChange={(open) => setExpandedPayload(open ? event.id : null)}
                            >
                              <CollapsibleTrigger asChild>
                                <button className="text-[10px] text-primary hover:underline flex items-center gap-1 mt-0.5">
                                  <Eye className="h-3 w-3" />
                                  Payload
                                </button>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <pre className="text-[10px] bg-muted rounded p-2 mt-1 overflow-x-auto max-h-40 whitespace-pre-wrap break-all">
                                  {JSON.stringify(event.payload, null, 2)}
                                </pre>
                              </CollapsibleContent>
                            </Collapsible>
                          )}
                        </div>

                        <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">
                          {event.captured_at || event.created_at
                            ? formatDistanceToNow(new Date(event.captured_at || event.created_at), {
                                addSuffix: true,
                              })
                            : "Just now"}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default LiveAccessLog;

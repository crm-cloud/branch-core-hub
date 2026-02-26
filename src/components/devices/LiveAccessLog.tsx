import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, CheckCircle, XCircle, User } from "lucide-react";
import { fetchAccessEvents, subscribeToAccessEvents, DeviceAccessEvent } from "@/services/deviceService";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";

interface LiveAccessLogProps {
  branchId?: string;
  limit?: number;
}

const LiveAccessLog = ({ branchId, limit = 10 }: LiveAccessLogProps) => {
  const [liveEvents, setLiveEvents] = useState<DeviceAccessEvent[]>([]);

  const { data: initialEvents = [] } = useQuery({
    queryKey: ['access-events', branchId, limit],
    queryFn: () => fetchAccessEvents(branchId, limit),
  });

  // Merge initial events with live events
  useEffect(() => {
    setLiveEvents(initialEvents);
  }, [initialEvents]);

  // Subscribe to real-time events
  useEffect(() => {
    if (!branchId) return;

    const unsubscribe = subscribeToAccessEvents(branchId, (newEvent) => {
      setLiveEvents((prev) => {
        // Add new event at the beginning, keep only 'limit' events
        const updated = [newEvent, ...prev].slice(0, limit);
        return updated;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [branchId, limit]);

  const getEventIcon = (granted: boolean) => {
    return granted ? (
      <CheckCircle className="h-4 w-4 text-green-500" />
    ) : (
      <XCircle className="h-4 w-4 text-destructive" />
    );
  };

  const getEventBadge = (event: DeviceAccessEvent) => {
    if (event.access_granted) {
      return <Badge variant="default" className="bg-green-500 text-xs">Granted</Badge>;
    }
    return <Badge variant="destructive" className="text-xs">Denied</Badge>;
  };

  const getMemberName = async (memberId: string): Promise<string> => {
    // This would ideally be part of the event data
    return "Member";
  };

  return (
    <div className="h-full">
      <ScrollArea className="h-[400px] pr-2">
        {liveEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Activity className="h-10 w-10 mb-3 opacity-50" />
            <p className="text-sm">No access events yet</p>
            <p className="text-xs mt-1">Events will appear here in real-time</p>
          </div>
        ) : (
          <div className="relative ml-4">
            {/* Vertical timeline line */}
            <div className="absolute left-[7px] top-3 bottom-3 w-0.5 bg-border" />

            <div className="space-y-4">
              {liveEvents.map((event) => (
                <div key={event.id} className="relative flex items-start gap-4 pl-6">
                  {/* Timeline dot */}
                  <div
                    className={`absolute left-0 top-2 w-[15px] h-[15px] rounded-full border-2 border-background z-10 ${
                      event.access_granted ? 'bg-green-500' : 'bg-destructive'
                    }`}
                  />

                  {/* Avatar - show biometric photo if available */}
                  <Avatar className="h-9 w-9 shrink-0">
                    {event.photo_url ? (
                      <AvatarImage src={event.photo_url} alt="Access photo" />
                    ) : null}
                    <AvatarFallback className="text-xs">
                      <User className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-semibold">
                        {event.member?.member_code || event.device_message || 'Unknown'}
                      </span>
                      <span className="text-muted-foreground ml-1">
                        {event.access_granted ? 'checked in' : 'denied'}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {event.denial_reason || event.event_type || 'Turnstile'}
                    </p>
                  </div>

                  {/* Time */}
                  <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">
                    {event.created_at
                      ? formatDistanceToNow(new Date(event.created_at), { addSuffix: true })
                      : 'Just now'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default LiveAccessLog;

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
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Activity className="h-5 w-5 text-primary" />
            Live Access Log
          </CardTitle>
          <Badge variant="outline" className="text-xs">
            Real-time
          </Badge>
        </div>
        <CardDescription>
          Recent access attempts at turnstiles
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px]">
          {liveEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Activity className="h-10 w-10 mb-3 opacity-50" />
              <p className="text-sm">No access events yet</p>
              <p className="text-xs mt-1">Events will appear here in real-time</p>
            </div>
          ) : (
            <div className="divide-y">
              {liveEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-3 p-4 hover:bg-muted/50 transition-colors"
                >
                  <Avatar className="h-10 w-10">
                    {event.photo_url ? (
                      <AvatarImage src={event.photo_url} alt="Access photo" />
                    ) : null}
                    <AvatarFallback>
                      <User className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {getEventIcon(event.access_granted)}
                      <span className="font-medium text-sm truncate">
                        {event.member?.member_code || event.device_message || 'Unknown'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      {getEventBadge(event)}
                      {event.denial_reason && (
                        <span className="text-xs text-muted-foreground truncate">
                          {event.denial_reason}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right shrink-0">
                    <p className="text-xs text-muted-foreground">
                      {event.created_at 
                        ? formatDistanceToNow(new Date(event.created_at), { addSuffix: true })
                        : 'Just now'}
                    </p>
                    {event.confidence_score && (
                      <p className="text-xs text-muted-foreground">
                        {event.confidence_score}% match
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default LiveAccessLog;

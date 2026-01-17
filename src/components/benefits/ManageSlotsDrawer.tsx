import { useState } from "react";
import { format } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Users, CheckCircle2, XCircle, UserCheck, UserX, Thermometer, Snowflake, CalendarPlus } from "lucide-react";
import { useAvailableSlots, useSlotBookings, useMarkAttendance, useGenerateDailySlots, useBenefitSettings } from "@/hooks/useBenefitBookings";
import { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type BenefitType = Database["public"]["Enums"]["benefit_type"];

interface ManageSlotsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  benefitType: BenefitType;
}

const BENEFIT_ICONS: Record<string, React.ReactNode> = {
  sauna_session: <Thermometer className="h-5 w-5" />,
  ice_bath: <Snowflake className="h-5 w-5" />,
};

const BENEFIT_LABELS: Record<string, string> = {
  sauna_session: "Sauna",
  ice_bath: "Ice Bath",
};

export function ManageSlotsDrawer({
  open,
  onOpenChange,
  branchId,
  benefitType,
}: ManageSlotsDrawerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  
  const { data: slots, isLoading: loadingSlots } = useAvailableSlots(branchId, benefitType, dateStr);
  const { data: settings } = useBenefitSettings(branchId);
  const { data: bookings, isLoading: loadingBookings } = useSlotBookings(selectedSlotId || "");
  
  const generateSlots = useGenerateDailySlots();
  const markAttendance = useMarkAttendance();
  
  const benefitSettings = settings?.find((s) => s.benefit_type === benefitType);
  
  const handleGenerateSlots = async () => {
    if (!benefitSettings) {
      toast.error("Please configure benefit settings first");
      return;
    }
    
    try {
      await generateSlots.mutateAsync({
        branchId,
        benefitType,
        date: dateStr,
        settings: benefitSettings,
      });
      toast.success("Slots generated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate slots");
    }
  };
  
  const handleMarkAttendance = async (bookingId: string, attended: boolean) => {
    try {
      await markAttendance.mutateAsync({ bookingId, attended });
      toast.success(attended ? "Marked as attended" : "Marked as no-show");
    } catch (error: any) {
      toast.error(error.message || "Failed to mark attendance");
    }
  };
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {BENEFIT_ICONS[benefitType]}
            Manage {BENEFIT_LABELS[benefitType] || benefitType} Slots
          </SheetTitle>
          <SheetDescription>
            View slots, manage bookings, and mark attendance
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          <div>
            <Label className="mb-2 block">Select Date</Label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              className="rounded-md border"
            />
          </div>
          
          <div className="flex items-center justify-between">
            <Label>Slots for {format(selectedDate, "MMM dd, yyyy")}</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerateSlots}
              disabled={generateSlots.isPending || !benefitSettings}
            >
              <CalendarPlus className="h-4 w-4 mr-2" />
              Generate Slots
            </Button>
          </div>
          
          {loadingSlots ? (
            <div className="text-sm text-muted-foreground">Loading slots...</div>
          ) : slots && slots.length > 0 ? (
            <Tabs value={selectedSlotId || ""} onValueChange={setSelectedSlotId}>
              <TabsList className="flex flex-wrap h-auto gap-1">
                {slots.map((slot) => (
                  <TabsTrigger
                    key={slot.id}
                    value={slot.id}
                    className="flex flex-col items-center py-2 px-3"
                  >
                    <span className="text-xs font-medium">{slot.start_time.slice(0, 5)}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {slot.booked_count}/{slot.capacity}
                    </span>
                  </TabsTrigger>
                ))}
              </TabsList>
              
              {slots.map((slot) => (
                <TabsContent key={slot.id} value={slot.id} className="mt-4">
                  <Card>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          <span className="font-medium">
                            {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                          </span>
                        </div>
                        <Badge variant={slot.booked_count >= slot.capacity ? "destructive" : "secondary"}>
                          <Users className="h-3 w-3 mr-1" />
                          {slot.booked_count}/{slot.capacity}
                        </Badge>
                      </div>
                      
                      {loadingBookings ? (
                        <div className="text-sm text-muted-foreground">Loading bookings...</div>
                      ) : bookings && bookings.length > 0 ? (
                        <div className="space-y-2">
                          <Label className="text-sm">Bookings</Label>
                          {bookings.map((booking) => (
                            <div
                              key={booking.id}
                              className="flex items-center justify-between p-2 border rounded-md"
                            >
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                                  {booking.member_id.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">Member</p>
                                  <Badge variant="outline" className="text-xs">
                                    {booking.status}
                                  </Badge>
                                </div>
                              </div>
                              
                              {booking.status === "booked" && (
                                <div className="flex gap-1">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0 text-green-600"
                                    onClick={() => handleMarkAttendance(booking.id, true)}
                                    disabled={markAttendance.isPending}
                                  >
                                    <UserCheck className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 w-8 p-0 text-red-600"
                                    onClick={() => handleMarkAttendance(booking.id, false)}
                                    disabled={markAttendance.isPending}
                                  >
                                    <UserX className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                              
                              {booking.status === "attended" && (
                                <CheckCircle2 className="h-5 w-5 text-green-600" />
                              )}
                              
                              {booking.status === "no_show" && (
                                <XCircle className="h-5 w-5 text-red-600" />
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground text-center py-4">
                          No bookings for this slot
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              ))}
            </Tabs>
          ) : (
            <div className="text-sm text-muted-foreground text-center py-8 border rounded-md">
              <CalendarPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No slots available. Click "Generate Slots" to create them.
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

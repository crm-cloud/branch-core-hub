import { useState } from "react";
import { format, addDays, eachDayOfInterval, isSameDay } from "date-fns";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, Users, CheckCircle2, XCircle, UserCheck, UserX, CalendarPlus, Sparkles, CalendarRange } from "lucide-react";
import { useAvailableSlots, useSlotBookings, useMarkAttendance, useGenerateDailySlots, useBenefitSettings } from "@/hooks/useBenefitBookings";
import { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";
import * as LucideIcons from "lucide-react";

type BenefitType = Database["public"]["Enums"]["benefit_type"];

interface ManageSlotsDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  benefitType: BenefitType;
  benefitTypeId?: string;
  benefitName?: string;
  benefitIcon?: string;
}

const DAYS_OF_WEEK = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
];

function getIconComponent(iconName?: string) {
  if (!iconName) return <Sparkles className="h-5 w-5" />;
  const Icon = (LucideIcons as any)[iconName];
  return Icon ? <Icon className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />;
}

export function ManageSlotsDrawer({
  open,
  onOpenChange,
  branchId,
  benefitType,
  benefitTypeId,
  benefitName,
  benefitIcon,
}: ManageSlotsDrawerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [multiDayMode, setMultiDayMode] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(),
    to: addDays(new Date(), 7),
  });
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri by default
  
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  
  const { data: slots, isLoading: loadingSlots } = useAvailableSlots(branchId, benefitType, dateStr);
  const { data: settings } = useBenefitSettings(branchId);
  const { data: bookings, isLoading: loadingBookings } = useSlotBookings(selectedSlotId || "");
  
  const generateSlots = useGenerateDailySlots();
  const markAttendance = useMarkAttendance();
  
  const benefitSettings = (benefitTypeId 
    ? settings?.find((s) => s.benefit_type_id === benefitTypeId) 
    : null) || settings?.find((s) => s.benefit_type === benefitType);
  
  const toggleDay = (day: number) => {
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };
  
  const handleGenerateSlots = async () => {
    if (!benefitSettings) {
      toast.error("Please configure benefit settings first");
      return;
    }
    
    try {
      if (multiDayMode) {
        // Generate slots for multiple days
        const dates = eachDayOfInterval({ start: dateRange.from, end: dateRange.to })
          .filter((date) => selectedDays.includes(date.getDay()));
        
        let successCount = 0;
        for (const date of dates) {
          try {
            await generateSlots.mutateAsync({
              branchId,
              benefitType,
              benefitTypeId,
              date: format(date, "yyyy-MM-dd"),
              settings: benefitSettings,
            });
            successCount++;
          } catch (err) {
            // Continue with other dates even if one fails
            console.error(`Failed to generate slots for ${format(date, "yyyy-MM-dd")}:`, err);
          }
        }
        toast.success(`Generated slots for ${successCount} of ${dates.length} days`);
      } else {
        await generateSlots.mutateAsync({
          branchId,
          benefitType,
          benefitTypeId,
          date: dateStr,
          settings: benefitSettings,
        });
        toast.success("Slots generated successfully!");
      }
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
            {getIconComponent(benefitIcon)}
            Manage {benefitName || benefitType} Slots
          </SheetTitle>
          <SheetDescription>
            View slots, manage bookings, and mark attendance
          </SheetDescription>
        </SheetHeader>
        
        <div className="mt-6 space-y-4">
          {/* Multi-day toggle */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4" />
              <span className="text-sm font-medium">Multi-day slot generation</span>
            </div>
            <Checkbox
              checked={multiDayMode}
              onCheckedChange={(checked) => setMultiDayMode(checked as boolean)}
            />
          </div>
          
          {multiDayMode ? (
            <>
              <div className="space-y-3">
                <Label>Date Range</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs text-muted-foreground">From</Label>
                    <Calendar
                      mode="single"
                      selected={dateRange.from}
                      onSelect={(date) => date && setDateRange((prev) => ({ ...prev, from: date }))}
                      className="rounded-md border"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">To</Label>
                    <Calendar
                      mode="single"
                      selected={dateRange.to}
                      onSelect={(date) => date && setDateRange((prev) => ({ ...prev, to: date }))}
                      className="rounded-md border"
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Days of Week</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => (
                    <Button
                      key={day.value}
                      type="button"
                      variant={selectedDays.includes(day.value) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleDay(day.value)}
                    >
                      {day.label}
                    </Button>
                  ))}
                </div>
              </div>
              
              <Button
                className="w-full"
                onClick={handleGenerateSlots}
                disabled={generateSlots.isPending || !benefitSettings || selectedDays.length === 0}
              >
                <CalendarPlus className="h-4 w-4 mr-2" />
                {generateSlots.isPending ? "Generating..." : "Generate Slots for Selected Days"}
              </Button>
            </>
          ) : (
            <>
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
            </>
          )}
          
          {!multiDayMode && loadingSlots ? (
            <div className="text-sm text-muted-foreground">Loading slots...</div>
          ) : !multiDayMode && slots && slots.length > 0 ? (
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
          ) : !multiDayMode ? (
            <div className="text-sm text-muted-foreground text-center py-8 border rounded-md">
              <CalendarPlus className="h-8 w-8 mx-auto mb-2 opacity-50" />
              No slots available. Click "Generate Slots" to create them.
            </div>
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

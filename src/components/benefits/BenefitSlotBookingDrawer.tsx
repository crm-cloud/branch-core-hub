import { useState } from "react";
import { format, addDays } from "date-fns";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Clock, Users, CalendarDays, Thermometer, Snowflake, CheckCircle2 } from "lucide-react";
import { useAvailableSlots, useBookSlot, useMemberBookings, useCancelBooking } from "@/hooks/useBenefitBookings";
import { Database } from "@/integrations/supabase/types";
import { toast } from "sonner";

type BenefitType = Database["public"]["Enums"]["benefit_type"];

interface BenefitSlotBookingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId: string;
  membershipId: string;
  memberName: string;
  branchId: string;
  benefitType: BenefitType;
  hasBalance: boolean;
}

const BENEFIT_ICONS: Record<string, React.ReactNode> = {
  sauna_session: <Thermometer className="h-5 w-5" />,
  ice_bath: <Snowflake className="h-5 w-5" />,
};

const BENEFIT_LABELS: Record<string, string> = {
  sauna_session: "Sauna",
  ice_bath: "Ice Bath",
};

export function BenefitSlotBookingDrawer({
  open,
  onOpenChange,
  memberId,
  membershipId,
  memberName,
  branchId,
  benefitType,
  hasBalance,
}: BenefitSlotBookingDrawerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [activeTab, setActiveTab] = useState("book");
  
  const dateStr = format(selectedDate, "yyyy-MM-dd");
  
  const { data: slots, isLoading: loadingSlots } = useAvailableSlots(branchId, benefitType, dateStr);
  const { data: bookings, isLoading: loadingBookings } = useMemberBookings(memberId, ["booked", "confirmed"]);
  
  const bookSlot = useBookSlot();
  const cancelBooking = useCancelBooking();
  
  const memberBookingsForType = bookings?.filter(
    (b) => b.slot?.benefit_type === benefitType
  );
  
  const handleBook = async () => {
    if (!selectedSlot) return;
    
    try {
      await bookSlot.mutateAsync({
        slotId: selectedSlot,
        memberId,
        membershipId,
        notes: notes || undefined,
      });
      toast.success("Slot booked successfully!");
      setSelectedSlot(null);
      setNotes("");
      setActiveTab("bookings");
    } catch (error: any) {
      toast.error(error.message || "Failed to book slot");
    }
  };
  
  const handleCancel = async (bookingId: string) => {
    try {
      await cancelBooking.mutateAsync({ bookingId, reason: "Member requested cancellation" });
      toast.success("Booking cancelled");
    } catch (error: any) {
      toast.error(error.message || "Failed to cancel booking");
    }
  };
  
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {BENEFIT_ICONS[benefitType]}
            Book {BENEFIT_LABELS[benefitType] || benefitType}
          </SheetTitle>
          <SheetDescription>
            Booking for: <span className="font-medium text-foreground">{memberName}</span>
          </SheetDescription>
        </SheetHeader>
        
        {!hasBalance && (
          <div className="mt-4 p-4 bg-destructive/10 rounded-lg text-destructive text-sm">
            This member has no remaining balance for {BENEFIT_LABELS[benefitType] || benefitType} sessions.
          </div>
        )}
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="book" className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />
              Book Slot
            </TabsTrigger>
            <TabsTrigger value="bookings" className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              My Bookings
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="book" className="space-y-4 mt-4">
            <div>
              <Label className="mb-2 block">Select Date</Label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                fromDate={new Date()}
                toDate={addDays(new Date(), 14)}
                className="rounded-md border"
              />
            </div>
            
            <div>
              <Label className="mb-2 block">Available Slots - {format(selectedDate, "MMM dd, yyyy")}</Label>
              {loadingSlots ? (
                <div className="text-sm text-muted-foreground">Loading slots...</div>
              ) : slots && slots.length > 0 ? (
                <div className="grid grid-cols-2 gap-2">
                  {slots.map((slot) => {
                    const available = slot.capacity - slot.booked_count;
                    const isFull = available <= 0;
                    const isSelected = selectedSlot === slot.id;
                    
                    return (
                      <Button
                        key={slot.id}
                        variant={isSelected ? "default" : "outline"}
                        disabled={isFull || !hasBalance}
                        onClick={() => setSelectedSlot(isSelected ? null : slot.id)}
                        className="h-auto py-3 flex flex-col items-center"
                      >
                        <div className="flex items-center gap-1 font-medium">
                          <Clock className="h-4 w-4" />
                          {slot.start_time.slice(0, 5)} - {slot.end_time.slice(0, 5)}
                        </div>
                        <div className="flex items-center gap-1 text-xs mt-1">
                          <Users className="h-3 w-3" />
                          {isFull ? "Full" : `${available} spots left`}
                        </div>
                      </Button>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground text-center py-4 border rounded-md">
                  No slots available for this date
                </div>
              )}
            </div>
            
            {selectedSlot && (
              <>
                <div>
                  <Label htmlFor="notes">Notes (optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any special requirements..."
                    className="mt-1"
                  />
                </div>
                
                <Button
                  onClick={handleBook}
                  disabled={bookSlot.isPending}
                  className="w-full"
                >
                  {bookSlot.isPending ? "Booking..." : "Confirm Booking"}
                </Button>
              </>
            )}
          </TabsContent>
          
          <TabsContent value="bookings" className="space-y-3 mt-4">
            {loadingBookings ? (
              <div className="text-sm text-muted-foreground">Loading bookings...</div>
            ) : memberBookingsForType && memberBookingsForType.length > 0 ? (
              memberBookingsForType.map((booking) => (
                <Card key={booking.id}>
                  <CardContent className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-medium">
                          {booking.slot?.slot_date && format(new Date(booking.slot.slot_date), "MMM dd, yyyy")}
                        </div>
                        <div className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {booking.slot?.start_time?.slice(0, 5)} - {booking.slot?.end_time?.slice(0, 5)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={booking.status === "booked" ? "default" : "secondary"}>
                          {booking.status}
                        </Badge>
                        {booking.status === "booked" && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleCancel(booking.id)}
                            disabled={cancelBooking.isPending}
                          >
                            Cancel
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-sm text-muted-foreground text-center py-8">
                No upcoming bookings
              </div>
            )}
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  );
}

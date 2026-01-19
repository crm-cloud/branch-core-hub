import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useMemberData } from '@/hooks/useMemberData';
import { Calendar, Clock, AlertCircle, Loader2, Droplets, Sparkles, Gift, Check, X } from 'lucide-react';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';

export default function BookBenefitSlot() {
  const queryClient = useQueryClient();
  const { member, activeMembership, isLoading: memberLoading } = useMemberData();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Fetch available slots for selected date
  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ['benefit-slots', member?.branch_id, selectedDate.toISOString().split('T')[0]],
    enabled: !!member,
    queryFn: async () => {
      const dateStr = selectedDate.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('benefit_slots')
        .select(`
          *,
          benefit_type_info:benefit_types(id, name, code, icon)
        `)
        .eq('branch_id', member!.branch_id)
        .eq('slot_date', dateStr)
        .eq('is_active', true)
        .order('start_time', { ascending: true });

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch member's existing bookings
  const { data: myBookings = [] } = useQuery({
    queryKey: ['my-benefit-bookings-all', member?.id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('benefit_bookings')
        .select(`
          *,
          slot:benefit_slots(id, slot_date, start_time, end_time, benefit_type)
        `)
        .eq('member_id', member!.id)
        .in('status', ['booked', 'confirmed'])
        .gte('slot.slot_date', new Date().toISOString().split('T')[0]);

      if (error) throw error;
      return data || [];
    },
  });

  // Fetch member's benefit credits
  const { data: credits = [] } = useQuery({
    queryKey: ['my-benefit-credits', member?.id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('member_benefit_credits')
        .select('*')
        .eq('member_id', member!.id)
        .gte('expires_at', new Date().toISOString())
        .gt('credits_remaining', 0);

      if (error) throw error;
      return data || [];
    },
  });

  // Book slot mutation
  const bookSlot = useMutation({
    mutationFn: async (slotId: string) => {
      if (!member || !activeMembership) throw new Error('No active membership');
      
      const { error } = await supabase
        .from('benefit_bookings')
        .insert({
          slot_id: slotId,
          member_id: member.id,
          membership_id: activeMembership.id,
          status: 'booked',
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Slot booked successfully!');
      queryClient.invalidateQueries({ queryKey: ['benefit-slots'] });
      queryClient.invalidateQueries({ queryKey: ['my-benefit-bookings'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to book slot');
    },
  });

  // Cancel booking mutation
  const cancelBooking = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase
        .from('benefit_bookings')
        .update({ 
          status: 'cancelled',
          cancelled_at: new Date().toISOString(),
        })
        .eq('id', bookingId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Booking cancelled');
      queryClient.invalidateQueries({ queryKey: ['benefit-slots'] });
      queryClient.invalidateQueries({ queryKey: ['my-benefit-bookings'] });
    },
    onError: () => {
      toast.error('Failed to cancel booking');
    },
  });

  if (memberLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </AppLayout>
    );
  }

  if (!member) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <AlertCircle className="h-12 w-12 text-warning" />
          <h2 className="text-xl font-semibold">No Member Profile Found</h2>
        </div>
      </AppLayout>
    );
  }

  const dates = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));

  const getBenefitIcon = (benefitType: string) => {
    switch (benefitType?.toLowerCase()) {
      case 'steam':
      case 'sauna':
        return <Droplets className="h-5 w-5" />;
      case 'spa':
        return <Sparkles className="h-5 w-5" />;
      default:
        return <Gift className="h-5 w-5" />;
    }
  };

  const isSlotBooked = (slotId: string) => {
    return myBookings.some((b: any) => b.slot_id === slotId);
  };

  const getBookingForSlot = (slotId: string) => {
    return myBookings.find((b: any) => b.slot_id === slotId);
  };

  const hasCreditsForBenefit = (benefitType: string) => {
    return credits.some((c: any) => c.benefit_type === benefitType && c.credits_remaining > 0);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Book Benefit Slots</h1>
          <p className="text-muted-foreground">Book sauna, steam, spa and other amenity slots</p>
        </div>

        {/* No Active Membership Warning */}
        {!activeMembership && (
          <Card className="border-warning/20 bg-warning/5">
            <CardContent className="py-6 text-center">
              <AlertCircle className="h-12 w-12 mx-auto text-warning mb-4" />
              <h3 className="font-semibold">No Active Membership</h3>
              <p className="text-sm text-muted-foreground mt-2">
                You need an active membership to book benefit slots.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Date Selection */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {dates.map((date) => (
            <Button
              key={date.toISOString()}
              variant={selectedDate.toDateString() === date.toDateString() ? "default" : "outline"}
              className="flex-shrink-0"
              onClick={() => setSelectedDate(date)}
            >
              <div className="text-center">
                <div className="text-xs">{format(date, 'EEE')}</div>
                <div className="font-bold">{format(date, 'd')}</div>
              </div>
            </Button>
          ))}
        </div>

        {/* Available Slots */}
        {slotsLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : slots.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Slots Available</h3>
              <p className="text-muted-foreground">
                No benefit slots are scheduled for this day. Please check another date or contact staff.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {slots.map((slot: any) => {
              const booked = isSlotBooked(slot.id);
              const booking = getBookingForSlot(slot.id);
              const spotsLeft = slot.capacity - (slot.booked_count || 0);
              const isFull = spotsLeft <= 0;
              const hasCredits = hasCreditsForBenefit(slot.benefit_type);

              return (
                <Card key={slot.id} className="border-border/50">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-lg flex items-center gap-2">
                        {getBenefitIcon(slot.benefit_type)}
                        {slot.benefit_type_info?.name || slot.benefit_type}
                      </CardTitle>
                      {booked ? (
                        <Badge variant="default">Booked</Badge>
                      ) : isFull ? (
                        <Badge variant="destructive">Full</Badge>
                      ) : (
                        <Badge variant="outline">{spotsLeft} spots</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{slot.start_time} - {slot.end_time}</span>
                    </div>
                    
                    {booked ? (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => booking && cancelBooking.mutate(booking.id)}
                        disabled={cancelBooking.isPending}
                      >
                        <X className="h-4 w-4 mr-2" />
                        Cancel Booking
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        disabled={isFull || !activeMembership || bookSlot.isPending}
                        onClick={() => bookSlot.mutate(slot.id)}
                      >
                        {isFull ? 'Slot Full' : (
                          <>
                            <Check className="h-4 w-4 mr-2" />
                            Book Now
                          </>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* My Upcoming Bookings */}
        {myBookings.length > 0 && (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>My Upcoming Bookings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {myBookings.map((booking: any) => (
                  <div key={booking.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      {getBenefitIcon(booking.slot?.benefit_type)}
                      <div>
                        <p className="font-medium">{booking.slot?.benefit_type}</p>
                        <p className="text-sm text-muted-foreground">
                          {booking.slot?.slot_date && format(new Date(booking.slot.slot_date), 'EEE, dd MMM')} • {booking.slot?.start_time} - {booking.slot?.end_time}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>
                        {booking.status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => cancelBooking.mutate(booking.id)}
                        disabled={cancelBooking.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}

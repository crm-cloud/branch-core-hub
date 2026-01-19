import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useMemberData } from '@/hooks/useMemberData';
import { Calendar, Clock, User, Users, Loader2, AlertCircle } from 'lucide-react';
import { format, addDays, startOfDay } from 'date-fns';
import { toast } from 'sonner';

export default function MemberClassBooking() {
  const queryClient = useQueryClient();
  const { member, isLoading: memberLoading } = useMemberData();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Fetch available classes
  const { data: classes = [], isLoading: classesLoading } = useQuery({
    queryKey: ['available-classes', member?.branch_id, selectedDate.toISOString()],
    enabled: !!member,
    queryFn: async () => {
      const dayStart = startOfDay(selectedDate).toISOString();
      const dayEnd = startOfDay(addDays(selectedDate, 1)).toISOString();

      const { data, error } = await supabase
        .from('classes')
        .select(`
          *,
          trainer:trainers(id, user_id),
          bookings:class_bookings(id, member_id, status)
        `)
        .eq('branch_id', member!.branch_id)
        .eq('is_active', true)
        .gte('scheduled_at', dayStart)
        .lt('scheduled_at', dayEnd)
        .order('scheduled_at', { ascending: true });

      if (error) throw error;
      
      // Fetch trainer profiles separately
      const classesWithProfiles = await Promise.all(
        (data || []).map(async (cls: any) => {
          if (cls.trainer?.user_id) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', cls.trainer.user_id)
              .maybeSingle();
            return { ...cls, trainer: { ...cls.trainer, profiles: profile } };
          }
          return cls;
        })
      );
      
      return classesWithProfiles;
    },
  });

  // Fetch my bookings
  const { data: myBookings = [] } = useQuery({
    queryKey: ['my-class-bookings', member?.id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('class_bookings')
        .select(`
          *,
          class:classes(id, name, scheduled_at, duration_minutes, capacity, trainer_id)
        `)
        .eq('member_id', member!.id)
        .in('status', ['booked', 'attended'])
        .order('booked_at', { ascending: false });

      if (error) throw error;
      
      // Filter for future classes and fetch trainer profiles
      const now = new Date();
      const futureBookings = (data || []).filter((b: any) => 
        b.class?.scheduled_at && new Date(b.class.scheduled_at) >= now
      );
      
      // Fetch trainer profiles
      const bookingsWithProfiles = await Promise.all(
        futureBookings.map(async (booking: any) => {
          if (booking.class?.trainer_id) {
            const { data: trainer } = await supabase
              .from('trainers')
              .select('id, user_id')
              .eq('id', booking.class.trainer_id)
              .maybeSingle();
            
            if (trainer?.user_id) {
              const { data: profile } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('id', trainer.user_id)
                .maybeSingle();
              return {
                ...booking,
                class: { ...booking.class, trainer: { ...trainer, profiles: profile } }
              };
            }
          }
          return booking;
        })
      );
      
      return bookingsWithProfiles;
    },
  });

  // Book class mutation
  const bookClass = useMutation({
    mutationFn: async (classId: string) => {
      const { data, error } = await supabase.rpc('book_class', {
        _class_id: classId,
        _member_id: member!.id,
      });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string };
      if (!result.success) throw new Error(result.error || 'Booking failed');
      return data;
    },
    onSuccess: () => {
      toast.success('Class booked successfully!');
      queryClient.invalidateQueries({ queryKey: ['available-classes'] });
      queryClient.invalidateQueries({ queryKey: ['my-class-bookings'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to book class');
    },
  });

  // Cancel booking mutation
  const cancelBooking = useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase.rpc('cancel_class_booking', {
        _booking_id: bookingId,
        _reason: 'Cancelled by member',
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Booking cancelled');
      queryClient.invalidateQueries({ queryKey: ['available-classes'] });
      queryClient.invalidateQueries({ queryKey: ['my-class-bookings'] });
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Class Booking</h1>
          <p className="text-muted-foreground">Browse and book group classes</p>
        </div>

        <Tabs defaultValue="browse">
          <TabsList>
            <TabsTrigger value="browse">Browse Classes</TabsTrigger>
            <TabsTrigger value="my-bookings">My Bookings ({myBookings.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="browse" className="space-y-6">
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

            {/* Classes List */}
            {classesLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : classes.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No classes scheduled for this day</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {classes.map((classItem: any) => {
                  const bookedCount = classItem.bookings?.filter((b: any) => b.status === 'booked').length || 0;
                  const isFull = bookedCount >= classItem.capacity;
                  const isBooked = classItem.bookings?.some((b: any) => b.member_id === member.id && b.status === 'booked');
                  const spotsLeft = classItem.capacity - bookedCount;

                  return (
                    <Card key={classItem.id} className="border-border/50">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <CardTitle className="text-lg">{classItem.name}</CardTitle>
                            <p className="text-sm text-muted-foreground">{classItem.class_type}</p>
                          </div>
                          {isBooked ? (
                            <Badge variant="default">Booked</Badge>
                          ) : isFull ? (
                            <Badge variant="destructive">Full</Badge>
                          ) : (
                            <Badge variant="outline">{spotsLeft} spots left</Badge>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            <span>{format(new Date(classItem.scheduled_at), 'HH:mm')}</span>
                            <span className="text-muted-foreground">({classItem.duration_minutes} min)</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4 text-sm">
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4 text-muted-foreground" />
                            <span>{classItem.trainer?.profiles?.full_name || 'No trainer'}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4 text-muted-foreground" />
                            <span>{bookedCount}/{classItem.capacity}</span>
                          </div>
                        </div>
                        {classItem.description && (
                          <p className="text-sm text-muted-foreground">{classItem.description}</p>
                        )}
                        {isBooked ? (
                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => {
                              const booking = classItem.bookings?.find((b: any) => b.member_id === member.id && b.status === 'booked');
                              if (booking) cancelBooking.mutate(booking.id);
                            }}
                            disabled={cancelBooking.isPending}
                          >
                            Cancel Booking
                          </Button>
                        ) : (
                          <Button
                            className="w-full"
                            disabled={isFull || bookClass.isPending}
                            onClick={() => bookClass.mutate(classItem.id)}
                          >
                            {isFull ? 'Class Full' : 'Book Now'}
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="my-bookings">
            {myBookings.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No upcoming bookings</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {myBookings.map((booking: any) => (
                  <Card key={booking.id} className="border-border/50">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{booking.class?.name}</h3>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                            <span>{format(new Date(booking.class?.scheduled_at), 'EEE, dd MMM yyyy • HH:mm')}</span>
                            <span>•</span>
                            <span>{booking.class?.trainer?.profiles?.full_name}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={booking.status === 'booked' ? 'default' : 'secondary'}>
                            {booking.status}
                          </Badge>
                          {booking.status === 'booked' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => cancelBooking.mutate(booking.id)}
                              disabled={cancelBooking.isPending}
                            >
                              Cancel
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

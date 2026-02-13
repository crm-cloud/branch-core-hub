import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useMemberData } from '@/hooks/useMemberData';
import { useAuth } from '@/contexts/AuthContext';
import { Calendar, Clock, User, Users, Loader2, AlertCircle, Dumbbell, Droplets, Sparkles, Gift, Check, X, CheckCircle } from 'lucide-react';
import { format, addDays, startOfDay } from 'date-fns';
import { toast } from 'sonner';

// ─── Recovery Zone Tab ───
function RecoveryZoneTab({ member, activeMembership }: { member: any; activeMembership: any }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const { data: profile } = useQuery({
    queryKey: ['my-profile-gender', user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('gender').eq('id', user!.id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: slots = [], isLoading: slotsLoading } = useQuery({
    queryKey: ['benefit-slots', member?.branch_id, selectedDate.toISOString().split('T')[0]],
    enabled: !!member,
    queryFn: async () => {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('benefit_slots')
        .select(`*, benefit_type_info:benefit_types(id, name, code, icon), facility:facilities(id, name, gender_access)`)
        .eq('branch_id', member!.branch_id)
        .eq('slot_date', dateStr)
        .eq('is_active', true)
        .order('start_time', { ascending: true });
      if (error) throw error;
      const memberGender = profile?.gender;
      return (data || []).filter((slot: any) => {
        if (!slot.facility) return true;
        const access = slot.facility.gender_access;
        return access === 'unisex' || access === memberGender;
      });
    },
  });

  const { data: myBookings = [] } = useQuery({
    queryKey: ['my-benefit-bookings-all', member?.id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('benefit_bookings')
        .select(`*, slot:benefit_slots(id, slot_date, start_time, end_time, benefit_type)`)
        .eq('member_id', member!.id)
        .in('status', ['booked', 'confirmed'])
        .gte('slot.slot_date', new Date().toISOString().split('T')[0]);
      if (error) throw error;
      return data || [];
    },
  });

  const bookSlot = useMutation({
    mutationFn: async (slotId: string) => {
      if (!member || !activeMembership) throw new Error('No active membership');
      const { error } = await supabase.from('benefit_bookings').insert({
        slot_id: slotId, member_id: member.id, membership_id: activeMembership.id, status: 'booked',
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Slot booked!'); queryClient.invalidateQueries({ queryKey: ['benefit-slots'] }); queryClient.invalidateQueries({ queryKey: ['my-benefit-bookings'] }); },
    onError: (e: any) => toast.error(e.message || 'Failed to book slot'),
  });

  const cancelBooking = useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.from('benefit_bookings').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', bookingId);
      if (error) throw error;
    },
    onSuccess: () => { toast.success('Booking cancelled'); queryClient.invalidateQueries({ queryKey: ['benefit-slots'] }); queryClient.invalidateQueries({ queryKey: ['my-benefit-bookings'] }); },
    onError: () => toast.error('Failed to cancel'),
  });

  const dates = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));
  const isSlotBooked = (slotId: string) => myBookings.some((b: any) => b.slot_id === slotId);
  const getBookingForSlot = (slotId: string) => myBookings.find((b: any) => b.slot_id === slotId);
  const getBenefitIcon = (t: string) => {
    switch (t?.toLowerCase()) { case 'steam': case 'sauna': return <Droplets className="h-5 w-5" />; case 'spa': return <Sparkles className="h-5 w-5" />; default: return <Gift className="h-5 w-5" />; }
  };

  return (
    <div className="space-y-6">
      {!activeMembership && (
        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="py-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-warning mb-4" />
            <h3 className="font-semibold">No Active Membership</h3>
            <p className="text-sm text-muted-foreground mt-2">You need an active membership to book benefit slots.</p>
          </CardContent>
        </Card>
      )}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {dates.map((date) => (
          <Button key={date.toISOString()} variant={selectedDate.toDateString() === date.toDateString() ? "default" : "outline"} className="flex-shrink-0" onClick={() => setSelectedDate(date)}>
            <div className="text-center"><div className="text-xs">{format(date, 'EEE')}</div><div className="font-bold">{format(date, 'd')}</div></div>
          </Button>
        ))}
      </div>
      {slotsLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
      ) : slots.length === 0 ? (
        <Card><CardContent className="py-12 text-center"><Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No slots available for this day</p></CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {slots.map((slot: any) => {
            const booked = isSlotBooked(slot.id);
            const booking = getBookingForSlot(slot.id);
            const spotsLeft = slot.capacity - (slot.booked_count || 0);
            const isFull = spotsLeft <= 0;
            return (
              <Card key={slot.id} className="border-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">{getBenefitIcon(slot.benefit_type)}{slot.benefit_type_info?.name || slot.benefit_type}</CardTitle>
                    {booked ? <Badge variant="default">Booked</Badge> : isFull ? <Badge variant="destructive">Full</Badge> : <Badge variant="outline">{spotsLeft} spots</Badge>}
                  </div>
                  {slot.facility?.name && <p className="text-xs text-muted-foreground mt-1">{slot.facility.name}</p>}
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground"><Clock className="h-4 w-4" /><span>{slot.start_time} - {slot.end_time}</span></div>
                  {booked ? (
                    <Button variant="outline" className="w-full" onClick={() => booking && cancelBooking.mutate(booking.id)} disabled={cancelBooking.isPending}><X className="h-4 w-4 mr-2" />Cancel Booking</Button>
                  ) : (
                    <Button className="w-full" disabled={isFull || !activeMembership || bookSlot.isPending} onClick={() => bookSlot.mutate(slot.id)}>{isFull ? 'Slot Full' : <><Check className="h-4 w-4 mr-2" />Book Now</>}</Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {myBookings.length > 0 && (
        <Card className="border-border/50">
          <CardHeader><CardTitle>My Upcoming Recovery Bookings</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-3">
              {myBookings.map((booking: any) => (
                <div key={booking.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getBenefitIcon(booking.slot?.benefit_type)}
                    <div>
                      <p className="font-medium">{booking.slot?.benefit_type}</p>
                      <p className="text-sm text-muted-foreground">{booking.slot?.slot_date && format(new Date(booking.slot.slot_date), 'EEE, dd MMM')} • {booking.slot?.start_time} - {booking.slot?.end_time}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={booking.status === 'confirmed' ? 'default' : 'secondary'}>{booking.status}</Badge>
                    <Button variant="ghost" size="sm" onClick={() => cancelBooking.mutate(booking.id)} disabled={cancelBooking.isPending}><X className="h-4 w-4" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── PT Sessions Tab ───
function PTSessionsTab({ member, ptPackages }: { member: any; ptPackages: any[] }) {
  const ptPackageIds = ptPackages.map(p => p.id);
  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['my-pt-sessions', member?.id, ptPackageIds],
    enabled: !!member && ptPackageIds.length > 0,
    queryFn: async (): Promise<any[]> => {
      const { data, error } = await supabase.from('pt_sessions').select('id, scheduled_at, duration_minutes, status, notes, trainer_id, member_pt_package_id').in('member_pt_package_id', ptPackageIds).order('scheduled_at', { ascending: false });
      if (error) throw error;
      const trainerIds = [...new Set((data || []).map(s => s.trainer_id).filter(Boolean))] as string[];
      let trainersMap: Record<string, { profiles?: { full_name: string } }> = {};
      if (trainerIds.length > 0) {
        const { data: trainers } = await supabase.from('trainers').select('id, user_id').in('id', trainerIds);
        if (trainers) {
          const userIds = trainers.map(t => t.user_id).filter(Boolean) as string[];
          const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', userIds);
          trainers.forEach(t => { const p = profiles?.find(pr => pr.id === t.user_id); trainersMap[t.id] = { profiles: p || undefined }; });
        }
      }
      return (data || []).map(session => ({ ...session, trainer: trainersMap[session.trainer_id || ''] || null }));
    },
  });

  const activePackage = ptPackages.find(p => p.status === 'active');
  const upcomingSessions = sessions.filter(s => s.status === 'scheduled' && new Date(s.scheduled_at) >= new Date());
  const completedSessions = sessions.filter(s => s.status === 'completed');

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge variant="default" className="bg-success"><CheckCircle className="h-3 w-3 mr-1" />Completed</Badge>;
      case 'scheduled': return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Scheduled</Badge>;
      case 'cancelled': return <Badge variant="destructive">Cancelled</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <Card className="border-border/50 bg-gradient-to-br from-accent/5 to-transparent">
        <CardHeader><CardTitle className="flex items-center gap-2"><Dumbbell className="h-5 w-5" />Active PT Package</CardTitle></CardHeader>
        <CardContent>
          {activePackage ? (
            <div className="grid md:grid-cols-4 gap-6">
              <div><p className="text-sm text-muted-foreground">Package</p><p className="font-semibold">{(activePackage.package as any)?.name}</p></div>
              <div><p className="text-sm text-muted-foreground">Sessions Remaining</p><p className="text-2xl font-bold text-accent">{activePackage.sessions_remaining}</p></div>
              <div><p className="text-sm text-muted-foreground">Sessions Used</p><p className="font-semibold">{activePackage.sessions_used || 0} of {activePackage.sessions_total}</p></div>
              <div><p className="text-sm text-muted-foreground">Expires On</p><p className="font-semibold">{format(new Date(activePackage.expiry_date), 'dd MMM yyyy')}</p></div>
            </div>
          ) : (
            <div className="text-center py-6"><Dumbbell className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No active PT package</p></div>
          )}
        </CardContent>
      </Card>

      <Tabs defaultValue="upcoming">
        <TabsList><TabsTrigger value="upcoming">Upcoming ({upcomingSessions.length})</TabsTrigger><TabsTrigger value="completed">Completed ({completedSessions.length})</TabsTrigger></TabsList>
        <TabsContent value="upcoming" className="space-y-4">
          {upcomingSessions.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No upcoming sessions</p></CardContent></Card>
          ) : upcomingSessions.map((s: any) => (
            <Card key={s.id} className="border-border/50"><CardContent className="py-4"><div className="flex items-center justify-between"><div className="space-y-1"><div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-accent" /><span className="font-semibold">{format(new Date(s.scheduled_at), 'EEEE, dd MMMM yyyy')}</span></div><div className="flex items-center gap-4 text-sm text-muted-foreground"><span className="flex items-center gap-1"><Clock className="h-4 w-4" />{format(new Date(s.scheduled_at), 'HH:mm')} ({s.duration_minutes} min)</span><span className="flex items-center gap-1"><User className="h-4 w-4" />{s.trainer?.profiles?.full_name}</span></div></div>{getStatusBadge(s.status)}</div></CardContent></Card>
          ))}
        </TabsContent>
        <TabsContent value="completed" className="space-y-4">
          {completedSessions.length === 0 ? (
            <Card><CardContent className="py-12 text-center"><CheckCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No completed sessions yet</p></CardContent></Card>
          ) : completedSessions.map((s: any) => (
            <Card key={s.id} className="border-border/50"><CardContent className="py-4"><div className="flex items-center justify-between"><div className="space-y-1"><div className="flex items-center gap-2"><Calendar className="h-4 w-4 text-success" /><span className="font-semibold">{format(new Date(s.scheduled_at), 'dd MMM yyyy • HH:mm')}</span></div><p className="text-sm text-muted-foreground">{s.trainer?.profiles?.full_name} • {s.duration_minutes} min</p></div>{getStatusBadge(s.status)}</div></CardContent></Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Main Page ───
export default function MemberClassBooking() {
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get('tab') || 'classes';
  const queryClient = useQueryClient();
  const { member, activeMembership, ptPackages, isLoading: memberLoading } = useMemberData();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // ─── Group Classes queries (same as before) ───
  const { data: classes = [], isLoading: classesLoading } = useQuery({
    queryKey: ['available-classes', member?.branch_id, selectedDate.toISOString()],
    enabled: !!member,
    queryFn: async () => {
      const dayStart = startOfDay(selectedDate).toISOString();
      const dayEnd = startOfDay(addDays(selectedDate, 1)).toISOString();
      const { data, error } = await supabase.from('classes').select(`*, trainer:trainers(id, user_id), bookings:class_bookings(id, member_id, status)`).eq('branch_id', member!.branch_id).eq('is_active', true).gte('scheduled_at', dayStart).lt('scheduled_at', dayEnd).order('scheduled_at', { ascending: true });
      if (error) throw error;
      const classesWithProfiles = await Promise.all(
        (data || []).map(async (cls: any) => {
          if (cls.trainer?.user_id) {
            const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', cls.trainer.user_id).maybeSingle();
            return { ...cls, trainer: { ...cls.trainer, profiles: profile } };
          }
          return cls;
        })
      );
      return classesWithProfiles;
    },
  });

  const { data: myBookings = [] } = useQuery({
    queryKey: ['my-class-bookings', member?.id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase.from('class_bookings').select(`*, class:classes(id, name, scheduled_at, duration_minutes, capacity, trainer_id)`).eq('member_id', member!.id).in('status', ['booked', 'attended']).order('booked_at', { ascending: false });
      if (error) throw error;
      const now = new Date();
      const futureBookings = (data || []).filter((b: any) => b.class?.scheduled_at && new Date(b.class.scheduled_at) >= now);
      const bookingsWithProfiles = await Promise.all(
        futureBookings.map(async (booking: any) => {
          if (booking.class?.trainer_id) {
            const { data: trainer } = await supabase.from('trainers').select('id, user_id').eq('id', booking.class.trainer_id).maybeSingle();
            if (trainer?.user_id) {
              const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', trainer.user_id).maybeSingle();
              return { ...booking, class: { ...booking.class, trainer: { ...trainer, profiles: profile } } };
            }
          }
          return booking;
        })
      );
      return bookingsWithProfiles;
    },
  });

  const bookClass = useMutation({
    mutationFn: async (classId: string) => {
      const { data, error } = await supabase.rpc('book_class', { _class_id: classId, _member_id: member!.id });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string };
      if (!result.success) throw new Error(result.error || 'Booking failed');
      return data;
    },
    onSuccess: () => { toast.success('Class booked!'); queryClient.invalidateQueries({ queryKey: ['available-classes'] }); queryClient.invalidateQueries({ queryKey: ['my-class-bookings'] }); },
    onError: (e: any) => toast.error(e.message || 'Failed to book class'),
  });

  const cancelBooking = useMutation({
    mutationFn: async (bookingId: string) => {
      const { data, error } = await supabase.rpc('cancel_class_booking', { _booking_id: bookingId, _reason: 'Cancelled by member' });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success('Booking cancelled'); queryClient.invalidateQueries({ queryKey: ['available-classes'] }); queryClient.invalidateQueries({ queryKey: ['my-class-bookings'] }); },
    onError: () => toast.error('Failed to cancel'),
  });

  if (memberLoading) {
    return <AppLayout><div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div></AppLayout>;
  }
  if (!member) {
    return <AppLayout><div className="flex flex-col items-center justify-center min-h-[50vh] gap-4"><AlertCircle className="h-12 w-12 text-warning" /><h2 className="text-xl font-semibold">No Member Profile Found</h2></div></AppLayout>;
  }

  const dates = Array.from({ length: 7 }, (_, i) => addDays(new Date(), i));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Book & Schedule</h1>
          <p className="text-muted-foreground">Browse and book classes, recovery slots & PT sessions</p>
        </div>

        <Tabs defaultValue={defaultTab}>
          <TabsList>
            <TabsTrigger value="classes"><Calendar className="h-4 w-4 mr-1.5" />Group Classes</TabsTrigger>
            <TabsTrigger value="recovery"><Droplets className="h-4 w-4 mr-1.5" />Recovery Zone</TabsTrigger>
            <TabsTrigger value="appointments"><Dumbbell className="h-4 w-4 mr-1.5" />PT Sessions</TabsTrigger>
          </TabsList>

          {/* ─── Group Classes Tab ─── */}
          <TabsContent value="classes" className="space-y-6">
            <Tabs defaultValue="browse">
              <TabsList>
                <TabsTrigger value="browse">Browse Classes</TabsTrigger>
                <TabsTrigger value="my-bookings">My Bookings ({myBookings.length})</TabsTrigger>
              </TabsList>

              <TabsContent value="browse" className="space-y-6">
                <div className="flex gap-2 overflow-x-auto pb-2">
                  {dates.map((date) => (
                    <Button key={date.toISOString()} variant={selectedDate.toDateString() === date.toDateString() ? "default" : "outline"} className="flex-shrink-0" onClick={() => setSelectedDate(date)}>
                      <div className="text-center"><div className="text-xs">{format(date, 'EEE')}</div><div className="font-bold">{format(date, 'd')}</div></div>
                    </Button>
                  ))}
                </div>
                {classesLoading ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                ) : classes.length === 0 ? (
                  <Card><CardContent className="py-12 text-center"><Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No classes scheduled for this day</p></CardContent></Card>
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
                              <div><CardTitle className="text-lg">{classItem.name}</CardTitle><p className="text-sm text-muted-foreground">{classItem.class_type}</p></div>
                              {isBooked ? <Badge variant="default">Booked</Badge> : isFull ? <Badge variant="destructive">Full</Badge> : <Badge variant="outline">{spotsLeft} spots left</Badge>}
                            </div>
                          </CardHeader>
                          <CardContent className="space-y-3">
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1"><Clock className="h-4 w-4 text-muted-foreground" /><span>{format(new Date(classItem.scheduled_at), 'HH:mm')}</span><span className="text-muted-foreground">({classItem.duration_minutes} min)</span></div>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <div className="flex items-center gap-1"><User className="h-4 w-4 text-muted-foreground" /><span>{classItem.trainer?.profiles?.full_name || 'No trainer'}</span></div>
                              <div className="flex items-center gap-1"><Users className="h-4 w-4 text-muted-foreground" /><span>{bookedCount}/{classItem.capacity}</span></div>
                            </div>
                            {classItem.description && <p className="text-sm text-muted-foreground">{classItem.description}</p>}
                            {isBooked ? (
                              <Button variant="outline" className="w-full" onClick={() => { const b = classItem.bookings?.find((b: any) => b.member_id === member.id && b.status === 'booked'); if (b) cancelBooking.mutate(b.id); }} disabled={cancelBooking.isPending}>Cancel Booking</Button>
                            ) : (
                              <Button className="w-full" disabled={isFull || bookClass.isPending} onClick={() => bookClass.mutate(classItem.id)}>{isFull ? 'Class Full' : 'Book Now'}</Button>
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
                  <Card><CardContent className="py-12 text-center"><Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">No upcoming bookings</p></CardContent></Card>
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
                              <Badge variant={booking.status === 'booked' ? 'default' : 'secondary'}>{booking.status}</Badge>
                              {booking.status === 'booked' && (
                                <Button variant="outline" size="sm" onClick={() => cancelBooking.mutate(booking.id)} disabled={cancelBooking.isPending}>Cancel</Button>
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
          </TabsContent>

          {/* ─── Recovery Zone Tab ─── */}
          <TabsContent value="recovery">
            <RecoveryZoneTab member={member} activeMembership={activeMembership} />
          </TabsContent>

          {/* ─── PT Sessions Tab ─── */}
          <TabsContent value="appointments">
            <PTSessionsTab member={member} ptPackages={ptPackages} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

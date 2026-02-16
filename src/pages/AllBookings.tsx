import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/ui/stat-card';
import { supabase } from '@/integrations/supabase/client';
import { useBranches } from '@/hooks/useBranches';
import { Calendar, Users, Heart, Dumbbell, Clock, Search, Check, X, Filter, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { ConciergeBookingDrawer } from '@/components/bookings/ConciergeBookingDrawer';

export default function AllBookingsPage() {
  const { data: branches } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [conciergeOpen, setConciergeOpen] = useState(false);

  const branchId = selectedBranch || branches?.[0]?.id || '';

  // Fetch class bookings
  const { data: classBookings = [], isLoading: loadingClasses } = useQuery({
    queryKey: ['all-class-bookings', branchId, dateFilter],
    enabled: !!branchId,
    queryFn: async () => {
      const startDate = new Date(dateFilter);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateFilter);
      endDate.setHours(23, 59, 59, 999);

      const { data: classes } = await supabase
        .from('classes')
        .select('id, name, scheduled_at')
        .eq('branch_id', branchId)
        .gte('scheduled_at', startDate.toISOString())
        .lte('scheduled_at', endDate.toISOString());

      if (!classes?.length) return [];

      const classIds = classes.map(c => c.id);
      const { data: bookings, error } = await supabase
        .from('class_bookings')
        .select(`
          *,
          member:members(id, member_code, user_id)
        `)
        .in('class_id', classIds);

      if (error) throw error;

      // Get member names
      const userIds = (bookings || [])
        .map((b: any) => b.member?.user_id)
        .filter((id): id is string => !!id);

      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p.full_name || '';
          return acc;
        }, {} as Record<string, string>);
      }

      const classMap = classes.reduce((acc, c) => {
        acc[c.id] = { name: c.name, scheduled_at: c.scheduled_at };
        return acc;
      }, {} as Record<string, { name: string; scheduled_at: string }>);

      return (bookings || []).map((b: any) => ({
        ...b,
        type: 'class',
        class_name: classMap[b.class_id]?.name,
        class_time: classMap[b.class_id]?.scheduled_at,
        member_name: b.member?.user_id ? profilesMap[b.member.user_id] : b.member?.member_code,
        member_code: b.member?.member_code,
      }));
    },
  });

  // Fetch benefit bookings
  const { data: benefitBookings = [], isLoading: loadingBenefits } = useQuery({
    queryKey: ['all-benefit-bookings', branchId, dateFilter],
    enabled: !!branchId,
    queryFn: async () => {
      const { data: slots } = await supabase
        .from('benefit_slots')
        .select('id, benefit_type, benefit_type_id, start_time, end_time, slot_date')
        .eq('branch_id', branchId)
        .eq('slot_date', dateFilter);

      if (!slots?.length) return [];

      const slotIds = slots.map(s => s.id);
      const { data: bookings, error } = await supabase
        .from('benefit_bookings')
        .select(`
          *,
          member:members(id, member_code, user_id)
        `)
        .in('slot_id', slotIds);

      if (error) throw error;

      // Get member names
      const userIds = (bookings || [])
        .map((b: any) => b.member?.user_id)
        .filter((id): id is string => !!id);

      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds);
        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p.full_name || '';
          return acc;
        }, {} as Record<string, string>);
      }

      // Fetch benefit type names
      const benefitTypeIds = [...new Set(slots.map(s => s.benefit_type_id).filter(Boolean))];
      let benefitTypeNames: Record<string, string> = {};
      if (benefitTypeIds.length > 0) {
        const { data: types } = await supabase
          .from('benefit_types')
          .select('id, name')
          .in('id', benefitTypeIds);
        benefitTypeNames = (types || []).reduce((acc, t) => {
          acc[t.id] = t.name;
          return acc;
        }, {} as Record<string, string>);
      }

      const slotMap = slots.reduce((acc, s) => {
        acc[s.id] = {
          benefit_type: s.benefit_type,
          benefit_name: s.benefit_type_id ? benefitTypeNames[s.benefit_type_id] : s.benefit_type,
          start_time: s.start_time,
          end_time: s.end_time,
          slot_date: s.slot_date,
        };
        return acc;
      }, {} as Record<string, any>);

      return (bookings || []).map((b: any) => ({
        ...b,
        type: 'benefit',
        benefit_name: slotMap[b.slot_id]?.benefit_name || slotMap[b.slot_id]?.benefit_type,
        slot_time: `${slotMap[b.slot_id]?.start_time} - ${slotMap[b.slot_id]?.end_time}`,
        slot_date: slotMap[b.slot_id]?.slot_date,
        member_name: b.member?.user_id ? profilesMap[b.member.user_id] : b.member?.member_code,
        member_code: b.member?.member_code,
      }));
    },
  });

  // Fetch PT sessions
  const { data: ptSessions = [], isLoading: loadingPT } = useQuery({
    queryKey: ['all-pt-sessions', branchId, dateFilter],
    enabled: !!branchId,
    queryFn: async () => {
      const startDate = new Date(dateFilter);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(dateFilter);
      endDate.setHours(23, 59, 59, 999);

      const { data: sessions, error } = await supabase
        .from('pt_sessions')
        .select(`
          *,
          member:members(id, member_code, user_id),
          trainer:trainers(id, user_id)
        `)
        .eq('branch_id', branchId)
        .gte('session_date', startDate.toISOString())
        .lte('session_date', endDate.toISOString());

      if (error) throw error;

      // Get member and trainer names
      const userIds = [
        ...(sessions || []).map((s: any) => s.member?.user_id),
        ...(sessions || []).map((s: any) => s.trainer?.user_id),
      ].filter((id): id is string => !!id);

      let profilesMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', [...new Set(userIds)]);
        profilesMap = (profiles || []).reduce((acc, p) => {
          acc[p.id] = p.full_name || '';
          return acc;
        }, {} as Record<string, string>);
      }

      return (sessions || []).map((s: any) => ({
        ...s,
        type: 'pt',
        member_name: s.member?.user_id ? profilesMap[s.member.user_id] : s.member?.member_code,
        member_code: s.member?.member_code,
        trainer_name: s.trainer?.user_id ? profilesMap[s.trainer.user_id] : 'Unknown Trainer',
      }));
    },
  });

  // Filter by search and status
  const filterBookings = (bookings: any[]) => {
    return bookings.filter(b => {
      const matchesSearch = !searchQuery || 
        b.member_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        b.member_code?.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || b.status === statusFilter;
      
      return matchesSearch && matchesStatus;
    });
  };

  const filteredClassBookings = filterBookings(classBookings);
  const filteredBenefitBookings = filterBookings(benefitBookings);
  const filteredPTSessions = filterBookings(ptSessions);

  // Stats
  const totalBookings = classBookings.length + benefitBookings.length + ptSessions.length;
  const confirmedBookings = [...classBookings, ...benefitBookings, ...ptSessions]
    .filter(b => ['booked', 'confirmed', 'scheduled'].includes(b.status)).length;
  const attendedBookings = [...classBookings, ...benefitBookings, ...ptSessions]
    .filter(b => ['attended', 'checked_in', 'completed'].includes(b.status)).length;

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      booked: 'secondary',
      confirmed: 'secondary',
      scheduled: 'secondary',
      attended: 'default',
      checked_in: 'default',
      completed: 'default',
      cancelled: 'outline',
      no_show: 'destructive',
    };
    return <Badge variant={variants[status] || 'outline'}>{status.replace('_', ' ')}</Badge>;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">All Bookings</h1>
            <p className="text-muted-foreground">View all member bookings across classes, benefits, and PT sessions</p>
          </div>
          <div className="flex items-center gap-4">
            <Button onClick={() => setConciergeOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Booking
            </Button>
            {branches && branches.length > 1 && (
              <Select value={selectedBranch || branches[0]?.id} onValueChange={setSelectedBranch}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard title="Total Bookings" value={totalBookings} icon={Calendar} />
          <StatCard title="Confirmed" value={confirmedBookings} icon={Check} />
          <StatCard title="Attended" value={attendedBookings} icon={Users} />
          <StatCard title="Date" value={format(new Date(dateFilter), 'dd MMM')} icon={Clock} />
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by member name or code..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="w-[180px]"
              />
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="booked">Booked</SelectItem>
                  <SelectItem value="confirmed">Confirmed</SelectItem>
                  <SelectItem value="attended">Attended</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                  <SelectItem value="no_show">No Show</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Bookings Tabs */}
        <Tabs defaultValue="classes" className="space-y-4">
          <TabsList>
            <TabsTrigger value="classes" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Classes ({filteredClassBookings.length})
            </TabsTrigger>
            <TabsTrigger value="benefits" className="flex items-center gap-2">
              <Heart className="h-4 w-4" />
              Benefits ({filteredBenefitBookings.length})
            </TabsTrigger>
            <TabsTrigger value="pt" className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4" />
              PT Sessions ({filteredPTSessions.length})
            </TabsTrigger>
          </TabsList>

          {/* Class Bookings Tab */}
          <TabsContent value="classes">
            <Card>
              <CardHeader>
                <CardTitle>Class Bookings</CardTitle>
                <CardDescription>Member bookings for group classes</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingClasses ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : filteredClassBookings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No class bookings found for this date
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Class</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Booked At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredClassBookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{booking.member_name}</div>
                              <div className="text-sm text-muted-foreground">{booking.member_code}</div>
                            </div>
                          </TableCell>
                          <TableCell>{booking.class_name}</TableCell>
                          <TableCell>
                            {booking.class_time && format(new Date(booking.class_time), 'HH:mm')}
                          </TableCell>
                          <TableCell>{getStatusBadge(booking.status)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(booking.booked_at), 'dd MMM HH:mm')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Benefit Bookings Tab */}
          <TabsContent value="benefits">
            <Card>
              <CardHeader>
                <CardTitle>Benefit Bookings</CardTitle>
                <CardDescription>Member bookings for sauna, ice bath, and other benefits</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingBenefits ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : filteredBenefitBookings.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No benefit bookings found for this date
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Benefit</TableHead>
                        <TableHead>Time Slot</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Booked At</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredBenefitBookings.map((booking) => (
                        <TableRow key={booking.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{booking.member_name}</div>
                              <div className="text-sm text-muted-foreground">{booking.member_code}</div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{booking.benefit_name}</Badge>
                          </TableCell>
                          <TableCell>{booking.slot_time}</TableCell>
                          <TableCell>{getStatusBadge(booking.status)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {format(new Date(booking.booked_at), 'dd MMM HH:mm')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* PT Sessions Tab */}
          <TabsContent value="pt">
            <Card>
              <CardHeader>
                <CardTitle>PT Sessions</CardTitle>
                <CardDescription>Scheduled personal training sessions</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingPT ? (
                  <div className="text-center py-8 text-muted-foreground">Loading...</div>
                ) : filteredPTSessions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No PT sessions found for this date
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Member</TableHead>
                        <TableHead>Trainer</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPTSessions.map((session) => (
                        <TableRow key={session.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{session.member_name}</div>
                              <div className="text-sm text-muted-foreground">{session.member_code}</div>
                            </div>
                          </TableCell>
                          <TableCell>{session.trainer_name}</TableCell>
                          <TableCell>
                            {session.session_date && format(new Date(session.session_date), 'HH:mm')}
                          </TableCell>
                          <TableCell>{getStatusBadge(session.status)}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[200px] truncate">
                            {session.notes || '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ConciergeBookingDrawer
        open={conciergeOpen}
        onOpenChange={setConciergeOpen}
        branchId={branchId}
      />
    </AppLayout>
  );
}

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/components/ui/sheet';
import { useBranchContext } from '@/contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Users, UserCheck, Clock, Search, Calendar, TrendingUp, Activity, ShieldAlert } from 'lucide-react';
import { format, startOfDay, endOfDay } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { toast } from 'sonner';

export default function AttendanceDashboard() {
  const { branchFilter } = useBranchContext();
  const { hasAnyRole, user } = useAuth();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState(format(new Date(), 'yyyy-MM-dd'));
  const isAdmin = hasAnyRole(['owner', 'admin']);
  const canForceEntry = hasAnyRole(['owner', 'admin', 'manager', 'staff']);
  const [forceEntryOpen, setForceEntryOpen] = useState(false);
  const [forceEntrySearch, setForceEntrySearch] = useState('');
  const [forceEntryReason, setForceEntryReason] = useState('');
  const [forceEntrySubmitting, setForceEntrySubmitting] = useState(false);
  const [selectedForceEntryMember, setSelectedForceEntryMember] = useState<any>(null);

  // Fetch member attendance
  const { data: memberAttendance = [] } = useQuery({
    queryKey: ['member-attendance-dashboard', branchFilter, dateFilter],
    queryFn: async () => {
      const start = startOfDay(new Date(dateFilter)).toISOString();
      const end = endOfDay(new Date(dateFilter)).toISOString();

      let query = supabase
        .from('member_attendance')
        .select(`
          *,
          members(member_code, profiles:user_id(full_name))
        `)
        .gte('check_in', start)
        .lte('check_in', end)
        .order('check_in', { ascending: false });

      if (branchFilter) {
        query = query.eq('branch_id', branchFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch staff attendance
  const { data: staffAttendance = [] } = useQuery({
    queryKey: ['staff-attendance-dashboard', branchFilter, dateFilter],
    queryFn: async () => {
      const start = startOfDay(new Date(dateFilter)).toISOString();
      const end = endOfDay(new Date(dateFilter)).toISOString();

      let query = supabase
        .from('staff_attendance')
        .select(`
          *,
          profiles:user_id(full_name, email)
        `)
        .gte('check_in', start)
        .lte('check_in', end)
        .order('check_in', { ascending: false });

      if (branchFilter) {
        query = query.eq('branch_id', branchFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Fetch weekly trends
  const { data: weeklyTrends = [] } = useQuery({
    queryKey: ['attendance-trends', branchFilter],
    queryFn: async () => {
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const start = startOfDay(date).toISOString();
        const end = endOfDay(date).toISOString();

        let memberQuery = supabase
          .from('member_attendance')
          .select('id', { count: 'exact', head: true })
          .gte('check_in', start)
          .lte('check_in', end);

        let staffQuery = supabase
          .from('staff_attendance')
          .select('id', { count: 'exact', head: true })
          .gte('check_in', start)
          .lte('check_in', end);

        if (branchFilter) {
          memberQuery = memberQuery.eq('branch_id', branchFilter);
          staffQuery = staffQuery.eq('branch_id', branchFilter);
        }

        const [memberResult, staffResult] = await Promise.all([memberQuery, staffQuery]);

        days.push({
          day: format(date, 'EEE'),
          members: memberResult.count || 0,
          staff: staffResult.count || 0,
        });
      }
      return days;
    },
  });

  // Force entry member search
  const { data: forceEntryResults = [] } = useQuery({
    queryKey: ['force-entry-search', forceEntrySearch, branchFilter],
    enabled: forceEntrySearch.length >= 2,
    queryFn: async () => {
      const { data } = await supabase.rpc('search_members', {
        search_term: forceEntrySearch,
        p_branch_id: branchFilter || null,
        p_limit: 10,
      });
      return data || [];
    },
  });

  const handleForceEntry = async () => {
    if (!selectedForceEntryMember || !branchFilter) return;
    setForceEntrySubmitting(true);
    try {
      const { error } = await supabase.from('member_attendance').insert({
        member_id: selectedForceEntryMember.id,
        branch_id: branchFilter,
        check_in: new Date().toISOString(),
        check_in_method: 'force_entry',
        force_entry: true,
        force_entry_reason: forceEntryReason || 'Override by reception',
        force_entry_by: user?.id || null,
      } as any);
      if (error) throw error;
      toast.success(`Force entry recorded for ${selectedForceEntryMember.full_name}`);
      queryClient.invalidateQueries({ queryKey: ['member-attendance-dashboard'] });
      setForceEntryOpen(false);
      setForceEntrySearch('');
      setForceEntryReason('');
      setSelectedForceEntryMember(null);
    } catch (err: any) {
      toast.error(err.message || 'Failed to record force entry');
    } finally {
      setForceEntrySubmitting(false);
    }
  };

  // Filter attendance based on search
  const filteredMemberAttendance = memberAttendance.filter((a: any) => {
    const name = a.members?.profiles?.full_name || '';
    const code = a.members?.member_code || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      code.toLowerCase().includes(searchTerm.toLowerCase());
  });

  const filteredStaffAttendance = staffAttendance.filter((a: any) => {
    const name = a.profiles?.full_name || '';
    return name.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Stats
  const stats = {
    totalMemberCheckIns: memberAttendance.length,
    activeMemberCheckIns: memberAttendance.filter((a: any) => !a.check_out).length,
    totalStaffCheckIns: staffAttendance.length,
    activeStaffCheckIns: staffAttendance.filter((a: any) => !a.check_out).length,
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  const formatDuration = (checkIn: string, checkOut: string | null) => {
    if (!checkOut) return 'Active';
    const duration = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000;
    const hours = Math.floor(duration / 60);
    const mins = Math.round(duration % 60);
    return `${hours}h ${mins}m`;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Activity className="w-8 h-8 text-accent" />
              Attendance Dashboard
            </h1>
            <p className="text-muted-foreground mt-1">Unified view of member and staff attendance</p>
          </div>
          <div className="flex items-center gap-3">
            {canForceEntry && (
              <Button variant="outline" className="gap-2 border-warning text-warning hover:bg-warning/10" onClick={() => setForceEntryOpen(true)}>
                <ShieldAlert className="h-4 w-4" />
                Force Entry
              </Button>
            )}
            <Input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-[180px]"
            />
          </div>
        </div>

        {/* Live Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-0 bg-gradient-to-br from-accent to-accent/80 text-accent-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Member Check-ins</p>
                  <h3 className="text-3xl font-bold mt-1">{stats.totalMemberCheckIns}</h3>
                  <p className="text-xs opacity-70 mt-1">{stats.activeMemberCheckIns} active</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Users className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-success to-success/80 text-success-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Staff Check-ins</p>
                  <h3 className="text-3xl font-bold mt-1">{stats.totalStaffCheckIns}</h3>
                  <p className="text-xs opacity-70 mt-1">{stats.activeStaffCheckIns} active</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <UserCheck className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-info to-info/80 text-info-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Currently Active</p>
                  <h3 className="text-3xl font-bold mt-1">
                    {stats.activeMemberCheckIns + stats.activeStaffCheckIns}
                  </h3>
                  <p className="text-xs opacity-70 mt-1">In gym right now</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Clock className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Total Today</p>
                  <h3 className="text-3xl font-bold mt-1">
                    {stats.totalMemberCheckIns + stats.totalStaffCheckIns}
                  </h3>
                  <p className="text-xs opacity-70 mt-1">All check-ins</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts */}
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Weekly Attendance Trend</CardTitle>
              <CardDescription>Last 7 days attendance overview</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={weeklyTrends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="members" 
                    stroke="hsl(var(--accent))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--accent))' }}
                    name="Members"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="staff" 
                    stroke="hsl(var(--success))" 
                    strokeWidth={2}
                    dot={{ fill: 'hsl(var(--success))' }}
                    name="Staff"
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily Comparison</CardTitle>
              <CardDescription>Members vs Staff check-ins</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={weeklyTrends}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="day" className="text-xs" />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))', 
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px'
                    }} 
                  />
                  <Bar dataKey="members" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} name="Members" />
                  <Bar dataKey="staff" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} name="Staff" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Attendance Tables */}
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>Attendance Log - {format(new Date(dateFilter), 'dd MMM yyyy')}</CardTitle>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="members">
              <TabsList className="mb-4">
                <TabsTrigger value="members" className="gap-2">
                  <Users className="h-4 w-4" />
                  Members ({filteredMemberAttendance.length})
                </TabsTrigger>
                <TabsTrigger value="staff" className="gap-2">
                  <UserCheck className="h-4 w-4" />
                  Staff ({filteredStaffAttendance.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="members">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMemberAttendance.map((attendance: any) => (
                      <TableRow key={attendance.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-accent/10 text-accent text-xs">
                                {getInitials(attendance.members?.profiles?.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{attendance.members?.profiles?.full_name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{attendance.members?.member_code}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(attendance.check_in), 'HH:mm')}</TableCell>
                        <TableCell>
                          {attendance.check_out 
                            ? format(new Date(attendance.check_out), 'HH:mm') 
                            : '-'
                          }
                        </TableCell>
                        <TableCell>{formatDuration(attendance.check_in, attendance.check_out)}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <Badge className={`border ${attendance.check_out 
                              ? 'bg-muted text-muted-foreground border-border' 
                              : 'bg-success/10 text-success border-success/20'
                            }`}>
                              {attendance.check_out ? 'Completed' : 'Active'}
                            </Badge>
                            {attendance.force_entry && (
                              <Badge variant="outline" className="bg-warning/10 text-warning border-warning/20 text-xs">
                                <ShieldAlert className="h-3 w-3 mr-0.5" />Force
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredMemberAttendance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          No member attendance records
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>

              <TabsContent value="staff">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Staff</TableHead>
                      <TableHead>Check-in</TableHead>
                      <TableHead>Check-out</TableHead>
                      <TableHead>Duration</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStaffAttendance.map((attendance: any) => (
                      <TableRow key={attendance.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className="bg-success/10 text-success text-xs">
                                {getInitials(attendance.profiles?.full_name)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-medium">{attendance.profiles?.full_name || 'Unknown'}</p>
                              <p className="text-xs text-muted-foreground">{attendance.profiles?.email}</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{format(new Date(attendance.check_in), 'HH:mm')}</TableCell>
                        <TableCell>
                          {attendance.check_out 
                            ? format(new Date(attendance.check_out), 'HH:mm') 
                            : '-'
                          }
                        </TableCell>
                        <TableCell>{formatDuration(attendance.check_in, attendance.check_out)}</TableCell>
                        <TableCell>
                          <Badge className={`border ${attendance.check_out 
                            ? 'bg-muted text-muted-foreground border-border' 
                            : 'bg-success/10 text-success border-success/20'
                          }`}>
                            {attendance.check_out ? 'Completed' : 'Active'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                    {filteredStaffAttendance.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-muted-foreground">
                          No staff attendance records
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>

      {/* Force Entry Drawer */}
      <Sheet open={forceEntryOpen} onOpenChange={setForceEntryOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-warning" />
              Force Entry Override
            </SheetTitle>
            <SheetDescription>
              Allow a member with expired/frozen membership to enter. This will be logged for audit.
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Search Member</Label>
              <Input
                placeholder="Search by name, phone, or member code..."
                value={forceEntrySearch}
                onChange={(e) => { setForceEntrySearch(e.target.value); setSelectedForceEntryMember(null); }}
              />
            </div>

            {forceEntrySearch.length >= 2 && forceEntryResults.length > 0 && !selectedForceEntryMember && (
              <div className="border rounded-lg max-h-48 overflow-y-auto">
                {forceEntryResults.map((m: any) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-3 hover:bg-muted/50 cursor-pointer border-b last:border-b-0"
                    onClick={() => setSelectedForceEntryMember(m)}
                  >
                    <div>
                      <p className="font-medium">{m.full_name}</p>
                      <p className="text-xs text-muted-foreground">{m.member_code} • {m.phone || 'No phone'}</p>
                    </div>
                    <Badge variant={m.member_status === 'active' ? 'default' : 'secondary'}>
                      {m.member_status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}

            {selectedForceEntryMember && (
              <Card className="border-warning/30 bg-warning/5">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">{selectedForceEntryMember.full_name}</p>
                      <p className="text-sm text-muted-foreground">{selectedForceEntryMember.member_code}</p>
                      <Badge variant="outline" className="mt-1">{selectedForceEntryMember.member_status}</Badge>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedForceEntryMember(null)}>Change</Button>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="space-y-2">
              <Label>Reason for Force Entry *</Label>
              <Textarea
                placeholder="e.g., Member will pay dues within 1-2 days, approved by manager..."
                value={forceEntryReason}
                onChange={(e) => setForceEntryReason(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <SheetFooter>
            <Button variant="outline" onClick={() => setForceEntryOpen(false)}>Cancel</Button>
            <Button
              onClick={handleForceEntry}
              disabled={!selectedForceEntryMember || !forceEntryReason.trim() || forceEntrySubmitting}
              className="bg-warning text-warning-foreground hover:bg-warning/90"
            >
              {forceEntrySubmitting ? 'Recording...' : 'Confirm Force Entry'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </AppLayout>
  );
}

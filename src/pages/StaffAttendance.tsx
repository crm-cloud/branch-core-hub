import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useStaffAttendance } from '@/hooks/useStaffAttendance';
import { useBranches } from '@/hooks/useBranches';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, UserCheck, UserMinus, Users, LogIn, LogOut, Shield } from 'lucide-react';
import { format } from 'date-fns';

export default function StaffAttendancePage() {
  const { data: branches } = useBranches();
  const { user, roles, hasAnyRole } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  const branchId = selectedBranch || branches?.[0]?.id;

  // Role-based access check
  const isAdmin = hasAnyRole(['owner', 'admin']);
  const isManager = hasAnyRole(['manager']);
  const isStaffOrTrainer = hasAnyRole(['staff', 'trainer']);

  const {
    todayAttendance,
    checkedInStaff,
    checkIn,
    checkOut,
    isCheckingIn,
    isCheckingOut,
  } = useStaffAttendance(branchId);

  const isUserCheckedIn = checkedInStaff.data?.some(a => a.user_id === user?.id);

  // Filter attendance based on role
  const filteredTodayAttendance = todayAttendance.data?.filter(a => {
    // Admin/Owner can see all
    if (isAdmin) return true;
    // Manager can see branch staff
    if (isManager) return true;
    // Staff/Trainer can only see their own
    if (isStaffOrTrainer) return a.user_id === user?.id;
    return false;
  });

  const filteredCheckedInStaff = checkedInStaff.data?.filter(a => {
    if (isAdmin) return true;
    if (isManager) return true;
    if (isStaffOrTrainer) return a.user_id === user?.id;
    return false;
  });

  const handleSelfCheckIn = () => {
    if (user) {
      checkIn({ userId: user.id });
    }
  };

  const handleSelfCheckOut = () => {
    if (user) {
      checkOut(user.id);
    }
  };

  const formatDuration = (checkInTime: string, checkOutTime: string | null) => {
    if (!checkOutTime) return 'Active';
    const duration = (new Date(checkOutTime).getTime() - new Date(checkInTime).getTime()) / 60000;
    const hours = Math.floor(duration / 60);
    const mins = Math.round(duration % 60);
    return `${hours}h ${mins}m`;
  };

  const getInitials = (name: string | null) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Clock className="w-8 h-8 text-accent" />
              Staff Attendance
            </h1>
            <p className="text-muted-foreground mt-1">
              {isAdmin ? 'View all staff attendance' : 
               isManager ? 'View branch staff attendance' : 
               'Track your working hours'}
            </p>
          </div>

          {/* Branch selector - only for admin/manager */}
          {(isAdmin || isManager) && branches && branches.length > 1 && (
            <Select value={branchId} onValueChange={setSelectedBranch}>
              <SelectTrigger className="w-[200px]">
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

        {/* Role indicator */}
        {!isAdmin && (
          <Card className="border-info/30 bg-info/5">
            <CardContent className="p-4 flex items-center gap-3">
              <Shield className="h-5 w-5 text-info" />
              <div>
                <p className="font-medium text-info">
                  {isManager ? 'Manager View' : 'Personal View'}
                </p>
                <p className="text-sm text-muted-foreground">
                  {isManager 
                    ? 'You can view attendance for all staff in your branch' 
                    : 'You can only view and manage your own attendance'}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Self Check-in/out Card - for staff and trainers */}
        {(isStaffOrTrainer || isManager) && (
          <Card className="border-accent/30 bg-accent/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <UserCheck className="w-5 h-5 text-accent" />
                Your Attendance
              </CardTitle>
              <CardDescription>
                {isUserCheckedIn 
                  ? 'You are currently checked in' 
                  : 'Start your shift by checking in'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isUserCheckedIn ? (
                <Button
                  onClick={handleSelfCheckOut}
                  disabled={isCheckingOut}
                  variant="outline"
                  className="w-full sm:w-auto"
                >
                  <UserMinus className="w-4 h-4 mr-2" />
                  {isCheckingOut ? 'Checking out...' : 'Check Out'}
                </Button>
              ) : (
                <Button
                  onClick={handleSelfCheckIn}
                  disabled={isCheckingIn}
                  className="w-full sm:w-auto bg-accent hover:bg-accent/90"
                >
                  <UserCheck className="w-4 h-4 mr-2" />
                  {isCheckingIn ? 'Checking in...' : 'Check In'}
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stats - visible to all but filtered data */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-0 bg-gradient-to-br from-accent to-accent/80 text-accent-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Currently Working</p>
                  <h3 className="text-3xl font-bold mt-1">{filteredCheckedInStaff?.length || 0}</h3>
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
                  <p className="text-sm opacity-80">Today's Check-ins</p>
                  <h3 className="text-3xl font-bold mt-1">{filteredTodayAttendance?.length || 0}</h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <LogIn className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-0 bg-gradient-to-br from-info to-info/80 text-info-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Completed Shifts</p>
                  <h3 className="text-3xl font-bold mt-1">
                    {filteredTodayAttendance?.filter(a => a.check_out)?.length || 0}
                  </h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <LogOut className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Currently Working */}
        <Card>
          <CardHeader>
            <CardTitle>Currently On Duty</CardTitle>
            <CardDescription>
              {isStaffOrTrainer ? 'Your active shift' : 'Staff currently checked in'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Staff</TableHead>
                  <TableHead>Check-in Time</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredCheckedInStaff?.map((attendance: any) => (
                  <TableRow key={attendance.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-accent/10 text-accent text-xs">
                            {attendance.user_id === user?.id ? 'ME' : getInitials(attendance.profile?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {attendance.user_id === user?.id ? 'You' : (attendance.profile?.full_name || 'Staff')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(attendance.check_in), 'HH:mm')}</TableCell>
                    <TableCell>{formatDuration(attendance.check_in, null)}</TableCell>
                    <TableCell>
                      <Badge className="bg-success/10 text-success border-success/20">
                        Working
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(!filteredCheckedInStaff || filteredCheckedInStaff.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      {isStaffOrTrainer ? 'You are not currently checked in' : 'No staff currently on duty'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Today's Log */}
        <Card>
          <CardHeader>
            <CardTitle>Today's Attendance Log</CardTitle>
            <CardDescription>
              {isStaffOrTrainer ? 'Your attendance history for today' : 'All staff check-ins for today'}
            </CardDescription>
          </CardHeader>
          <CardContent>
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
                {filteredTodayAttendance?.map((attendance: any) => (
                  <TableRow key={attendance.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="bg-accent/10 text-accent text-xs">
                            {attendance.user_id === user?.id ? 'ME' : getInitials(attendance.profile?.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-medium">
                          {attendance.user_id === user?.id ? 'You' : (attendance.profile?.full_name || 'Staff')}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{format(new Date(attendance.check_in), 'HH:mm')}</TableCell>
                    <TableCell>
                      {attendance.check_out
                        ? format(new Date(attendance.check_out), 'HH:mm')
                        : '-'}
                    </TableCell>
                    <TableCell>{formatDuration(attendance.check_in, attendance.check_out)}</TableCell>
                    <TableCell>
                      <Badge className={attendance.check_out 
                        ? 'bg-muted text-muted-foreground' 
                        : 'bg-success/10 text-success border-success/20'
                      }>
                        {attendance.check_out ? 'Completed' : 'Active'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(!filteredTodayAttendance || filteredTodayAttendance.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      No attendance records for today
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

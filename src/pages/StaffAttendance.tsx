import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useStaffAttendance } from '@/hooks/useStaffAttendance';
import { useBranches } from '@/hooks/useBranches';
import { useAuth } from '@/contexts/AuthContext';
import { Clock, UserCheck, UserMinus, Users, LogIn, LogOut } from 'lucide-react';
import { format } from 'date-fns';

export default function StaffAttendancePage() {
  const { data: branches } = useBranches();
  const { user } = useAuth();
  const [selectedBranch, setSelectedBranch] = useState<string>('');

  const branchId = selectedBranch || branches?.[0]?.id;

  const {
    todayAttendance,
    checkedInStaff,
    employees,
    checkIn,
    checkOut,
    isCheckingIn,
    isCheckingOut,
  } = useStaffAttendance(branchId);

  const isUserCheckedIn = checkedInStaff.data?.some(a => a.user_id === user?.id);

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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Clock className="w-8 h-8 text-accent" />
              Staff Attendance
            </h1>
            <p className="text-muted-foreground mt-1">Track staff working hours</p>
          </div>

          {branches && branches.length > 1 && (
            <select
              value={branchId}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-3 py-2 border rounded-md bg-background"
            >
              {branches.map((branch) => (
                <option key={branch.id} value={branch.id}>
                  {branch.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Self Check-in/out Card */}
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
                className="w-full sm:w-auto"
              >
                <UserCheck className="w-4 h-4 mr-2" />
                {isCheckingIn ? 'Checking in...' : 'Check In'}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Currently Working</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">
                {checkedInStaff.data?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">Staff on duty</p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Today's Check-ins</CardTitle>
              <LogIn className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {todayAttendance.data?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">Total shifts today</p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completed Shifts</CardTitle>
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(todayAttendance.data?.filter(a => a.check_out)?.length) || 0}
              </div>
              <p className="text-xs text-muted-foreground">Shifts ended</p>
            </CardContent>
          </Card>
        </div>

        {/* Currently Working */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Currently On Duty</CardTitle>
            <CardDescription>Staff currently checked in</CardDescription>
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
                {checkedInStaff.data?.map((attendance) => (
                  <TableRow key={attendance.id}>
                    <TableCell className="font-medium">
                      {attendance.user_id === user?.id ? 'You' : attendance.user_id?.slice(0, 8)}
                    </TableCell>
                    <TableCell>
                      {format(new Date(attendance.check_in), 'HH:mm')}
                    </TableCell>
                    <TableCell>
                      {formatDuration(attendance.check_in, null)}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                        Working
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(!checkedInStaff.data || checkedInStaff.data.length === 0) && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                      No staff currently on duty
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Today's Log */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Today's Attendance Log</CardTitle>
            <CardDescription>All staff check-ins for today</CardDescription>
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
                {todayAttendance.data?.map((attendance) => (
                  <TableRow key={attendance.id}>
                    <TableCell className="font-medium">
                      {attendance.user_id === user?.id ? 'You' : attendance.user_id?.slice(0, 8)}
                    </TableCell>
                    <TableCell>{format(new Date(attendance.check_in), 'HH:mm')}</TableCell>
                    <TableCell>
                      {attendance.check_out
                        ? format(new Date(attendance.check_out), 'HH:mm')
                        : '-'}
                    </TableCell>
                    <TableCell>
                      {formatDuration(attendance.check_in, attendance.check_out)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={attendance.check_out ? 'outline' : 'default'}>
                        {attendance.check_out ? 'Completed' : 'Active'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {(!todayAttendance.data || todayAttendance.data.length === 0) && (
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

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAttendance } from '@/hooks/useAttendance';
import { useBranches } from '@/hooks/useBranches';
import { Clock, UserCheck, UserMinus, Search, Users, LogIn, LogOut } from 'lucide-react';
import { format } from 'date-fns';

export default function AttendancePage() {
  const { data: branches } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Set first branch as default
  const branchId = selectedBranch || branches?.[0]?.id;

  const {
    todayAttendance,
    checkedInMembers,
    checkIn,
    checkOut,
    searchMember,
    isCheckingIn,
    isCheckingOut,
  } = useAttendance(branchId);

  const handleSearch = async () => {
    if (!searchQuery.trim() || !branchId) return;
    setIsSearching(true);
    try {
      const results = await searchMember(searchQuery);
      setSearchResults(results || []);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCheckIn = (memberId: string) => {
    checkIn({ memberId, method: 'manual' });
    setSearchResults([]);
    setSearchQuery('');
  };

  const handleCheckOut = (memberId: string) => {
    checkOut(memberId);
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
              Member Attendance
            </h1>
            <p className="text-muted-foreground mt-1">Check-in and check-out members</p>
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

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Currently In</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">
                {checkedInMembers.data?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground">Active members in gym</p>
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
              <p className="text-xs text-muted-foreground">Total visits today</p>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Checked Out</CardTitle>
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {(todayAttendance.data?.filter(a => a.check_out)?.length) || 0}
              </div>
              <p className="text-xs text-muted-foreground">Completed sessions</p>
            </CardContent>
          </Card>
        </div>

        {/* Check-in Search */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="w-5 h-5 text-accent" />
              Quick Check-in
            </CardTitle>
            <CardDescription>Search by member code or name</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Enter member code (e.g., BRN-00001)"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="pl-10"
                />
              </div>
              <Button onClick={handleSearch} disabled={isSearching}>
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </div>

            {searchResults.length > 0 && (
              <div className="mt-4 space-y-2">
                {searchResults.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div>
                      <p className="font-medium">{member.profiles?.full_name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">{member.member_code}</p>
                    </div>
                    <Button
                      onClick={() => handleCheckIn(member.id)}
                      disabled={isCheckingIn}
                      size="sm"
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      Check In
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance Tabs */}
        <Tabs defaultValue="active" className="w-full">
          <TabsList>
            <TabsTrigger value="active">Currently In ({checkedInMembers.data?.length || 0})</TabsTrigger>
            <TabsTrigger value="today">Today's Log ({todayAttendance.data?.length || 0})</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            <Card className="border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member Code</TableHead>
                    <TableHead>Check-in Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkedInMembers.data?.map((attendance) => (
                    <TableRow key={attendance.id}>
                      <TableCell className="font-medium">
                        {attendance.members?.member_code || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {format(new Date(attendance.check_in), 'HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">
                          {formatDuration(attendance.check_in, null)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCheckOut(attendance.member_id)}
                          disabled={isCheckingOut}
                        >
                          <UserMinus className="w-4 h-4 mr-2" />
                          Check Out
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!checkedInMembers.data || checkedInMembers.data.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        No members currently checked in
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="today" className="mt-4">
            <Card className="border-border/50">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member Code</TableHead>
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
                        {attendance.members?.member_code || 'N/A'}
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
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

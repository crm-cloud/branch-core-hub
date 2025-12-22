import { useState, useEffect, useRef } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAttendance } from '@/hooks/useAttendance';
import { useBranches } from '@/hooks/useBranches';
import { Clock, UserCheck, UserMinus, Search, Users, LogIn, LogOut, Scan, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';

export default function AttendancePage() {
  const { data: branches } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

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

  // Auto-focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // If exactly one result, auto check-in
      if (searchResults.length === 1) {
        handleCheckIn(searchResults[0].id, searchResults[0].profiles?.full_name);
      } else {
        handleSearch();
      }
    }
  };

  const handleCheckIn = (memberId: string, memberName?: string) => {
    checkIn({ memberId, method: 'manual' });
    setSearchResults([]);
    setSearchQuery('');
    searchInputRef.current?.focus();
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

  // Check if member is already checked in
  const isAlreadyCheckedIn = (memberId: string) => {
    return checkedInMembers.data?.some((a: any) => a.member_id === memberId);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-primary" />
              </div>
              Member Attendance
            </h1>
            <p className="text-muted-foreground mt-1">Quick check-in/out for gym members</p>
          </div>

          {branches && branches.length > 1 && (
            <select
              value={branchId}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="px-4 py-2 border rounded-lg bg-background text-sm"
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
          <Card className="border-l-4 border-l-primary">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Currently In</CardTitle>
              <Users className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-primary">
                {checkedInMembers.data?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Active members in gym</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-success">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Today's Check-ins</CardTitle>
              <LogIn className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-success">
                {todayAttendance.data?.length || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Total visits today</p>
            </CardContent>
          </Card>

          <Card className="border-l-4 border-l-muted-foreground">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Checked Out</CardTitle>
              <LogOut className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {(todayAttendance.data?.filter((a: any) => a.check_out)?.length) || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">Completed sessions</p>
            </CardContent>
          </Card>
        </div>

        {/* Check-in Search - Enhanced UI */}
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader className="pb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Scan className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Quick Check-in</CardTitle>
                <CardDescription>Search by member code, name, or phone number</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Enter member code (e.g., BRN-00001), name, or phone..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-12 h-14 text-lg bg-background border-2 focus:border-primary transition-colors"
                />
              </div>
              <Button 
                onClick={handleSearch} 
                disabled={isSearching}
                className="h-14 px-8 text-lg"
              >
                {isSearching ? 'Searching...' : 'Search'}
              </Button>
            </div>

            {/* Search Results */}
            {searchResults.length > 0 && (
              <div className="mt-6 space-y-3">
                <p className="text-sm text-muted-foreground font-medium">
                  Found {searchResults.length} member{searchResults.length > 1 ? 's' : ''}
                </p>
                {searchResults.map((member) => {
                  const alreadyIn = isAlreadyCheckedIn(member.id);
                  return (
                    <div
                      key={member.id}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                        alreadyIn 
                          ? 'bg-warning/5 border-warning/30' 
                          : 'bg-background border-border hover:border-primary/50 hover:shadow-md'
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-14 w-14 ring-2 ring-background shadow">
                          <AvatarImage src={member.profiles?.avatar_url} />
                          <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                            {member.profiles?.full_name?.charAt(0) || 'M'}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-semibold text-lg">{member.profiles?.full_name || 'Unknown'}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono">{member.member_code}</code>
                            {member.profiles?.phone && <span>{member.profiles.phone}</span>}
                          </div>
                        </div>
                      </div>
                      {alreadyIn ? (
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 gap-1 px-3 py-1.5">
                          <AlertCircle className="h-3 w-3" />
                          Already Checked In
                        </Badge>
                      ) : (
                        <Button
                          onClick={() => handleCheckIn(member.id, member.profiles?.full_name)}
                          disabled={isCheckingIn}
                          size="lg"
                          className="gap-2"
                        >
                          <UserCheck className="w-5 h-5" />
                          Check In
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {searchQuery && searchResults.length === 0 && !isSearching && (
              <div className="mt-6 text-center py-8 text-muted-foreground">
                <Search className="h-10 w-10 mx-auto opacity-30 mb-2" />
                <p>No members found matching "{searchQuery}"</p>
                <p className="text-sm">Try searching with member code, name, or phone</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Attendance Tabs */}
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="active" className="gap-2">
              <Users className="h-4 w-4" />
              Currently In ({checkedInMembers.data?.length || 0})
            </TabsTrigger>
            <TabsTrigger value="today" className="gap-2">
              <Clock className="h-4 w-4" />
              Today's Log ({todayAttendance.data?.length || 0})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Member</TableHead>
                    <TableHead>Member Code</TableHead>
                    <TableHead>Check-in Time</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkedInMembers.data?.map((attendance: any) => (
                    <TableRow key={attendance.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={attendance.members?.profiles?.avatar_url} />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {attendance.members?.profiles?.full_name?.charAt(0) || 'M'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{attendance.members?.profiles?.full_name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="px-2 py-1 bg-muted rounded text-xs font-mono">
                          {attendance.members?.member_code || 'N/A'}
                        </code>
                      </TableCell>
                      <TableCell className="font-medium">
                        {format(new Date(attendance.check_in), 'HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono">
                          {formatDuration(attendance.check_in, null)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCheckOut(attendance.member_id)}
                          disabled={isCheckingOut}
                          className="gap-2"
                        >
                          <UserMinus className="w-4 h-4" />
                          Check Out
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!checkedInMembers.data || checkedInMembers.data.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Users className="h-10 w-10 opacity-30" />
                          <p className="font-medium">No members currently checked in</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          <TabsContent value="today" className="mt-4">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Member</TableHead>
                    <TableHead>Member Code</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Check-out</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayAttendance.data?.map((attendance: any) => (
                    <TableRow key={attendance.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarImage src={attendance.members?.profiles?.avatar_url} />
                            <AvatarFallback className="bg-primary/10 text-primary text-sm">
                              {attendance.members?.profiles?.full_name?.charAt(0) || 'M'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{attendance.members?.profiles?.full_name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="px-2 py-1 bg-muted rounded text-xs font-mono">
                          {attendance.members?.member_code || 'N/A'}
                        </code>
                      </TableCell>
                      <TableCell className="font-medium">{format(new Date(attendance.check_in), 'HH:mm')}</TableCell>
                      <TableCell>
                        {attendance.check_out
                          ? format(new Date(attendance.check_out), 'HH:mm')
                          : '-'}
                      </TableCell>
                      <TableCell className="font-mono">
                        {formatDuration(attendance.check_in, attendance.check_out)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={attendance.check_out ? 'outline' : 'default'} className={attendance.check_out ? '' : 'bg-success'}>
                          {attendance.check_out ? 'Completed' : 'Active'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!todayAttendance.data || todayAttendance.data.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-12">
                        <div className="flex flex-col items-center gap-2 text-muted-foreground">
                          <Clock className="h-10 w-10 opacity-30" />
                          <p className="font-medium">No attendance records for today</p>
                        </div>
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

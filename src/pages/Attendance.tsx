import { useState, useEffect, useRef, useCallback } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useAttendance } from '@/hooks/useAttendance';
import { useBranches } from '@/hooks/useBranches';
import { Clock, UserCheck, UserMinus, Search, Users, LogIn, LogOut, Scan, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

type FlashState = {
  type: 'success' | 'denied';
  name: string;
  message: string;
  avatar?: string;
} | null;

export default function AttendancePage() {
  const { data: branches } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [flash, setFlash] = useState<FlashState>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout>>();

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

  useEffect(() => {
    searchInputRef.current?.focus();
  }, []);

  // Auto-search with debounce on 3+ chars
  useEffect(() => {
    if (searchQuery.length >= 3) {
      const timer = setTimeout(() => {
        handleSearch();
      }, 300);
      return () => clearTimeout(timer);
    } else if (searchQuery.length === 0) {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const showFlash = useCallback((state: FlashState) => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlash(state);
    flashTimerRef.current = setTimeout(() => setFlash(null), 3000);
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
      if (searchResults.length === 1) {
        handleCheckIn(searchResults[0].id, searchResults[0].profiles?.full_name, searchResults[0].profiles?.avatar_url);
      } else {
        handleSearch();
      }
    }
  };

  const handleCheckIn = (memberId: string, memberName?: string, avatarUrl?: string) => {
    checkIn({ memberId, method: 'manual' });
    showFlash({
      type: 'success',
      name: memberName || 'Member',
      message: 'Check-in successful',
      avatar: avatarUrl,
    });
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

  const isAlreadyCheckedIn = (memberId: string) => {
    return checkedInMembers.data?.some((a: any) => a.member_id === memberId);
  };

  const currentlyIn = checkedInMembers.data?.length || 0;
  const totalToday = todayAttendance.data?.length || 0;
  const checkedOut = todayAttendance.data?.filter((a: any) => a.check_out)?.length || 0;

  return (
    <AppLayout>
      <div className="space-y-4">
        {/* Compact Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Scan className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Attendance</h1>
              <p className="text-sm text-muted-foreground">Quick check-in / check-out</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Compact inline stats */}
            <div className="hidden md:flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="h-2.5 w-2.5 rounded-full bg-primary animate-pulse" />
                <span className="font-semibold text-primary">{currentlyIn}</span>
                <span className="text-muted-foreground">In</span>
              </div>
              <div className="flex items-center gap-1.5">
                <LogIn className="h-3.5 w-3.5 text-green-500" />
                <span className="font-semibold">{totalToday}</span>
                <span className="text-muted-foreground">Today</span>
              </div>
              <div className="flex items-center gap-1.5">
                <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold">{checkedOut}</span>
                <span className="text-muted-foreground">Out</span>
              </div>
            </div>
            {branches && branches.length > 1 && (
              <select
                value={branchId}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-3 py-1.5 border rounded-lg bg-background text-sm"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Flash Banner */}
        {flash && (
          <div
            className={`flex items-center gap-4 p-4 rounded-xl border-2 animate-in slide-in-from-top-2 duration-300 ${
              flash.type === 'success'
                ? 'bg-green-500/10 border-green-500/40 text-green-700 dark:text-green-400'
                : 'bg-destructive/10 border-destructive/40 text-destructive'
            }`}
          >
            {flash.type === 'success' ? (
              <CheckCircle className="h-8 w-8 flex-shrink-0" />
            ) : (
              <XCircle className="h-8 w-8 flex-shrink-0" />
            )}
            {flash.avatar && (
              <Avatar className="h-10 w-10">
                <AvatarImage src={flash.avatar} />
                <AvatarFallback>{flash.name.charAt(0)}</AvatarFallback>
              </Avatar>
            )}
            <div>
              <p className="font-bold text-lg">{flash.name}</p>
              <p className="text-sm opacity-80">{flash.message}</p>
            </div>
          </div>
        )}

        {/* Search Bar — Full width, no card wrapper */}
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Scan className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              placeholder="Scan barcode or type member code / name / phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              className="pl-12 h-14 text-lg border-2 focus:border-primary transition-colors"
            />
          </div>
          <Button
            onClick={handleSearch}
            disabled={isSearching}
            className="h-14 px-6"
            size="lg"
          >
            <Search className="w-5 h-5 mr-2" />
            {isSearching ? 'Searching...' : 'Search'}
          </Button>
        </div>

        {/* Search Results */}
        {searchResults.length > 0 && (
          <div className="space-y-2">
            {searchResults.map((member) => {
              const alreadyIn = isAlreadyCheckedIn(member.id);
              return (
                <div
                  key={member.id}
                  className={`flex items-center justify-between p-4 rounded-xl border-2 transition-all ${
                    alreadyIn
                      ? 'bg-amber-500/5 border-amber-500/30'
                      : 'bg-card border-border hover:border-primary/50 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12 ring-2 ring-background shadow">
                      <AvatarImage src={member.profiles?.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary font-semibold">
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
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1 px-3 py-1.5">
                      <AlertCircle className="h-3 w-3" />
                      Already In
                    </Badge>
                  ) : (
                    <Button
                      onClick={() => handleCheckIn(member.id, member.profiles?.full_name, member.profiles?.avatar_url)}
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

        {searchQuery.length >= 3 && searchResults.length === 0 && !isSearching && (
          <div className="text-center py-6 text-muted-foreground">
            <Search className="h-8 w-8 mx-auto opacity-30 mb-1" />
            <p className="text-sm">No members found for "{searchQuery}"</p>
          </div>
        )}

        {/* Attendance Tabs */}
        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full max-w-md grid-cols-2">
            <TabsTrigger value="active" className="gap-2">
              <Users className="h-4 w-4" />
              Currently In ({currentlyIn})
            </TabsTrigger>
            <TabsTrigger value="today" className="gap-2">
              <Clock className="h-4 w-4" />
              Today's Log ({totalToday})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4">
            <Card>
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead>Member</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Check-in</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {checkedInMembers.data?.map((attendance: any) => (
                    <TableRow key={attendance.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={attendance.members?.profiles?.avatar_url} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {attendance.members?.profiles?.full_name?.charAt(0) || 'M'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{attendance.members?.profiles?.full_name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono">
                          {attendance.members?.member_code || 'N/A'}
                        </code>
                      </TableCell>
                      <TableCell className="font-medium">
                        {format(new Date(attendance.check_in), 'HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="font-mono text-xs">
                          {formatDuration(attendance.check_in, null)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCheckOut(attendance.member_id)}
                          disabled={isCheckingOut}
                          className="gap-1"
                        >
                          <UserMinus className="w-3.5 h-3.5" />
                          Out
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!checkedInMembers.data || checkedInMembers.data.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-10">
                        <Users className="h-8 w-8 mx-auto opacity-20 mb-2" />
                        <p className="text-sm text-muted-foreground">No members currently checked in</p>
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
                    <TableHead>Code</TableHead>
                    <TableHead>In</TableHead>
                    <TableHead>Out</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {todayAttendance.data?.map((attendance: any) => (
                    <TableRow key={attendance.id} className="hover:bg-muted/30">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarImage src={attendance.members?.profiles?.avatar_url} />
                            <AvatarFallback className="bg-primary/10 text-primary text-xs">
                              {attendance.members?.profiles?.full_name?.charAt(0) || 'M'}
                            </AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{attendance.members?.profiles?.full_name || 'Unknown'}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="px-2 py-0.5 bg-muted rounded text-xs font-mono">
                          {attendance.members?.member_code || 'N/A'}
                        </code>
                      </TableCell>
                      <TableCell className="font-medium">{format(new Date(attendance.check_in), 'HH:mm')}</TableCell>
                      <TableCell>
                        {attendance.check_out ? format(new Date(attendance.check_out), 'HH:mm') : '-'}
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDuration(attendance.check_in, attendance.check_out)}
                      </TableCell>
                      <TableCell>
                        <Badge variant={attendance.check_out ? 'outline' : 'default'} className={attendance.check_out ? '' : 'bg-green-500'}>
                          {attendance.check_out ? 'Done' : 'Active'}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!todayAttendance.data || todayAttendance.data.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-10">
                        <Clock className="h-8 w-8 mx-auto opacity-20 mb-2" />
                        <p className="text-sm text-muted-foreground">No attendance records for today</p>
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

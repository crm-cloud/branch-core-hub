import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useMemberData } from '@/hooks/useMemberData';
import { Calendar, Clock, AlertCircle, Loader2, CheckCircle, TrendingUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';

export default function MyAttendance() {
  const { member, isLoading: memberLoading } = useMemberData();
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Fetch attendance for selected month
  const { data: attendance = [], isLoading: attendanceLoading } = useQuery({
    queryKey: ['my-monthly-attendance', member?.id, selectedMonth.toISOString()],
    enabled: !!member,
    queryFn: async () => {
      const monthStart = startOfMonth(selectedMonth).toISOString();
      const monthEnd = endOfMonth(selectedMonth).toISOString();

      const { data, error } = await supabase
        .from('member_attendance')
        .select('*')
        .eq('member_id', member!.id)
        .gte('check_in', monthStart)
        .lte('check_in', monthEnd)
        .order('check_in', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  if (memberLoading || attendanceLoading) {
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

  // Calculate stats
  const totalVisits = attendance.length;
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(selectedMonth),
    end: endOfMonth(selectedMonth),
  });
  const visitDays = new Set(attendance.map(a => format(new Date(a.check_in), 'yyyy-MM-dd')));
  const uniqueDays = visitDays.size;

  // Calculate average duration
  const completedSessions = attendance.filter(a => a.check_out);
  const avgDuration = completedSessions.length > 0
    ? completedSessions.reduce((sum, a) => {
        const duration = new Date(a.check_out!).getTime() - new Date(a.check_in).getTime();
        return sum + duration;
      }, 0) / completedSessions.length / (1000 * 60) // in minutes
    : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">My Attendance</h1>
          <p className="text-muted-foreground">Track your gym visits</p>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-accent/10">
                  <CheckCircle className="h-6 w-6 text-accent" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Visits</p>
                  <p className="text-2xl font-bold">{totalVisits}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-success/10">
                  <Calendar className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Days Visited</p>
                  <p className="text-2xl font-bold">{uniqueDays}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-warning/10">
                  <Clock className="h-6 w-6 text-warning" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Avg Duration</p>
                  <p className="text-2xl font-bold">{Math.round(avgDuration)} min</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-3 rounded-full bg-primary/10">
                  <TrendingUp className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Consistency</p>
                  <p className="text-2xl font-bold">
                    {Math.round((uniqueDays / daysInMonth.filter(d => d <= new Date()).length) * 100)}%
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Calendar View */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {format(selectedMonth, 'MMMM yyyy')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-2 text-center">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="text-sm font-medium text-muted-foreground py-2">
                  {day}
                </div>
              ))}
              {/* Empty cells for days before month starts */}
              {Array.from({ length: startOfMonth(selectedMonth).getDay() }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {/* Calendar days */}
              {daysInMonth.map(day => {
                const dayStr = format(day, 'yyyy-MM-dd');
                const visited = visitDays.has(dayStr);
                const isToday = isSameDay(day, new Date());
                const isFuture = day > new Date();

                return (
                  <div
                    key={dayStr}
                    className={`
                      p-3 rounded-lg text-center transition-colors
                      ${visited ? 'bg-success text-success-foreground' : 'bg-muted/50'}
                      ${isToday ? 'ring-2 ring-accent' : ''}
                      ${isFuture ? 'opacity-50' : ''}
                    `}
                  >
                    <span className="text-sm font-medium">{format(day, 'd')}</span>
                    {visited && <CheckCircle className="h-3 w-3 mx-auto mt-1" />}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Visits */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Recent Visits</CardTitle>
          </CardHeader>
          <CardContent>
            {attendance.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No visits this month</p>
              </div>
            ) : (
              <div className="space-y-3">
                {attendance.slice(0, 10).map((record) => {
                  const duration = record.check_out
                    ? Math.round((new Date(record.check_out).getTime() - new Date(record.check_in).getTime()) / (1000 * 60))
                    : null;

                  return (
                    <div key={record.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CheckCircle className="h-5 w-5 text-success" />
                        <div>
                          <p className="font-medium">{format(new Date(record.check_in), 'EEEE, dd MMM yyyy')}</p>
                          <p className="text-sm text-muted-foreground">
                            Check-in: {format(new Date(record.check_in), 'HH:mm')}
                            {record.check_out && ` • Check-out: ${format(new Date(record.check_out), 'HH:mm')}`}
                          </p>
                        </div>
                      </div>
                      {duration && (
                        <Badge variant="outline">{duration} min</Badge>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

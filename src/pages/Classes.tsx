import { useState } from "react";
import { format } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Users, Clock, CalendarDays, Check, X, UserX } from "lucide-react";
import { useClasses, useClassBookings, useMarkAttendance, useCancelBooking } from "@/hooks/useClasses";
import { useTrainers } from "@/hooks/useTrainers";
import { useBranches } from "@/hooks/useBranches";
import { useAuth } from "@/contexts/AuthContext";
import { AddClassDrawer } from "@/components/classes/AddClassDrawer";

export default function ClassesPage() {
  const { profile } = useAuth();
  const { data: branches } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const branchId = selectedBranch || branches?.[0]?.id || "";
  const { data: classes, isLoading } = useClasses(branchId, { activeOnly: true });
  const { data: trainers } = useTrainers(branchId);
  const { data: bookings } = useClassBookings(selectedClass || "");
  const markAttendance = useMarkAttendance();
  const cancelBooking = useCancelBooking();

  const handleMarkAttendance = async (bookingId: string, attended: boolean) => {
    try {
      const result = await markAttendance.mutateAsync({ bookingId, attended });
      if (result.success) {
        toast.success(attended ? "Marked as attended" : "Marked as no-show");
      } else {
        toast.error(result.error || "Failed to mark attendance");
      }
    } catch (error) {
      toast.error("Failed to mark attendance");
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    try {
      const result = await cancelBooking.mutateAsync({ bookingId, reason: "Cancelled by staff" });
      if (result.success) {
        toast.success("Booking cancelled");
      } else {
        toast.error(result.error || "Failed to cancel booking");
      }
    } catch (error) {
      toast.error("Failed to cancel booking");
    }
  };

  const selectedClassData = classes?.find((c) => c.id === selectedClass);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
            <p className="text-muted-foreground">Manage group classes and bookings</p>
          </div>
          <div className="flex items-center gap-4">
            {branches && branches.length > 1 && (
              <Select value={selectedBranch || branches[0]?.id} onValueChange={setSelectedBranch}>
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
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Class
            </Button>
          </div>
        </div>

        <AddClassDrawer open={isCreateOpen} onOpenChange={setIsCreateOpen} branchId={branchId} />

        <Tabs defaultValue="schedule" className="space-y-4">
          <TabsList>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading classes...</div>
            ) : classes?.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No classes scheduled. Create your first class to get started.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {classes?.map((cls) => (
                  <Card
                    key={cls.id}
                    className={`cursor-pointer transition-colors hover:border-primary ${
                      selectedClass === cls.id ? "border-primary" : ""
                    }`}
                    onClick={() => setSelectedClass(cls.id)}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{cls.name}</CardTitle>
                        {cls.class_type && (
                          <Badge variant="secondary">{cls.class_type}</Badge>
                        )}
                      </div>
                      <CardDescription>{cls.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <CalendarDays className="h-4 w-4 text-muted-foreground" />
                          <span>{format(new Date(cls.scheduled_at), "PPP p")}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>{cls.duration_minutes} minutes</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {cls.bookings_count}/{cls.capacity} booked
                            {cls.waitlist_count ? ` (${cls.waitlist_count} waitlisted)` : ""}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4">
            {selectedClass && selectedClassData ? (
              <Card>
                <CardHeader>
                  <CardTitle>{selectedClassData.name} - Attendance</CardTitle>
                  <CardDescription>
                    {format(new Date(selectedClassData.scheduled_at), "PPP p")}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {bookings?.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No bookings for this class</p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Member</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {bookings?.map((booking) => (
                          <TableRow key={booking.id}>
                            <TableCell className="font-medium">{booking.member_name}</TableCell>
                            <TableCell>{booking.member_phone || "-"}</TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  booking.status === "attended"
                                    ? "default"
                                    : booking.status === "no_show"
                                    ? "destructive"
                                    : booking.status === "cancelled"
                                    ? "outline"
                                    : "secondary"
                                }
                              >
                                {booking.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {booking.status === "booked" && (
                                <div className="flex items-center gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleMarkAttendance(booking.id, true)}
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleMarkAttendance(booking.id, false)}
                                  >
                                    <UserX className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleCancelBooking(booking.id)}
                                  >
                                    <X className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  Select a class from the schedule to view attendance
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

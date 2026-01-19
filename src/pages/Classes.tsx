import { useState } from "react";
import { format, isPast, isFuture, isToday, differenceInMinutes, addMinutes } from "date-fns";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Plus, Users, Clock, CalendarDays, Check, X, UserX, Edit, Phone, User, Search, Filter } from "lucide-react";
import { useClasses, useClassBookings, useMarkAttendance, useCancelBooking } from "@/hooks/useClasses";
import { useTrainers } from "@/hooks/useTrainers";
import { useBranches } from "@/hooks/useBranches";
import { useAuth } from "@/contexts/AuthContext";
import { AddClassDrawer } from "@/components/classes/AddClassDrawer";
import { EditClassDrawer } from "@/components/classes/EditClassDrawer";
import type { ClassWithDetails } from "@/services/classService";

export default function ClassesPage() {
  const { profile } = useAuth();
  const { data: branches } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [classToEdit, setClassToEdit] = useState<ClassWithDetails | null>(null);
  
  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [classTypeFilter, setClassTypeFilter] = useState<string>("all");
  const [trainerFilter, setTrainerFilter] = useState<string>("all");

  const branchId = selectedBranch || branches?.[0]?.id || "";
  const { data: classes, isLoading } = useClasses(branchId, { activeOnly: false });
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

  const handleEditClass = (cls: ClassWithDetails) => {
    setClassToEdit(cls);
    setIsEditOpen(true);
  };

  // Filter classes
  const filteredClasses = (classes || []).filter(cls => {
    const matchesSearch = !searchQuery || 
      cls.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cls.description?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesType = classTypeFilter === "all" || cls.class_type === classTypeFilter;
    const matchesTrainer = trainerFilter === "all" || cls.trainer_id === trainerFilter;
    
    return matchesSearch && matchesType && matchesTrainer;
  });

  // Get trainer name by ID
  const getTrainerName = (trainerId: string | null) => {
    if (!trainerId) return null;
    const trainer = trainers?.find((t: any) => t.id === trainerId);
    return trainer?.profile_name || trainer?.profile_email || "Unknown Trainer";
  };

  const getTrainerPhone = (trainerId: string | null) => {
    if (!trainerId) return null;
    const trainer = trainers?.find((t: any) => t.id === trainerId);
    return trainer?.profile_phone;
  };

  // Get class status badge
  const getClassStatus = (cls: ClassWithDetails) => {
    const now = new Date();
    const scheduledAt = new Date(cls.scheduled_at);
    const endTime = addMinutes(scheduledAt, cls.duration_minutes || 60);

    if (!cls.is_active) {
      return { label: "Cancelled", variant: "destructive" as const };
    }
    if (isPast(endTime)) {
      return { label: "Completed", variant: "secondary" as const };
    }
    if (isPast(scheduledAt) && isFuture(endTime)) {
      return { label: "In Progress", variant: "default" as const };
    }
    if (isToday(scheduledAt)) {
      const minsUntil = differenceInMinutes(scheduledAt, now);
      if (minsUntil <= 60 && minsUntil > 0) {
        return { label: `Starts in ${minsUntil}m`, variant: "default" as const };
      }
      return { label: "Today", variant: "outline" as const };
    }
    return { label: "Upcoming", variant: "outline" as const };
  };

  // Get capacity badge variant
  const getCapacityBadge = (cls: ClassWithDetails) => {
    const bookedCount = cls.bookings_count || 0;
    const capacity = cls.capacity;
    const percentage = (bookedCount / capacity) * 100;

    if (bookedCount >= capacity) {
      return { label: `Full (${bookedCount}/${capacity})`, variant: "destructive" as const };
    }
    if (percentage >= 75) {
      return { label: `${bookedCount}/${capacity}`, variant: "secondary" as const };
    }
    return { label: `${bookedCount}/${capacity}`, variant: "outline" as const };
  };

  const selectedClassData = filteredClasses.find((c) => c.id === selectedClass);

  // Unique class types for filter
  const classTypes = [...new Set((classes || []).map(c => c.class_type).filter(Boolean))];

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
        <EditClassDrawer 
          open={isEditOpen} 
          onOpenChange={setIsEditOpen} 
          classData={classToEdit}
          branchId={branchId}
        />

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search classes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={classTypeFilter} onValueChange={setClassTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Class Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {classTypes.map(type => (
                    <SelectItem key={type} value={type!}>
                      {type!.charAt(0).toUpperCase() + type!.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={trainerFilter} onValueChange={setTrainerFilter}>
                <SelectTrigger className="w-[180px]">
                  <User className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Trainer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Trainers</SelectItem>
                  {trainers?.map((trainer: any) => (
                    <SelectItem key={trainer.id} value={trainer.id}>
                      {trainer.profile_name || trainer.profile_email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="schedule" className="space-y-4">
          <TabsList>
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
          </TabsList>

          <TabsContent value="schedule" className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading classes...</div>
            ) : filteredClasses.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  No classes found. {searchQuery || classTypeFilter !== "all" || trainerFilter !== "all" 
                    ? "Try adjusting your filters." 
                    : "Create your first class to get started."}
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredClasses.map((cls) => {
                  const status = getClassStatus(cls);
                  const capacityBadge = getCapacityBadge(cls);
                  const trainerName = getTrainerName(cls.trainer_id);
                  const trainerPhone = getTrainerPhone(cls.trainer_id);

                  return (
                    <Card
                      key={cls.id}
                      className={`cursor-pointer transition-all hover:border-primary hover:shadow-md ${
                        selectedClass === cls.id ? "border-primary ring-2 ring-primary/20" : ""
                      } ${!cls.is_active ? "opacity-60" : ""}`}
                      onClick={() => setSelectedClass(cls.id)}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-lg flex items-center gap-2">
                              {cls.name}
                              <Badge variant={status.variant} className="text-xs">
                                {status.label}
                              </Badge>
                            </CardTitle>
                            {cls.class_type && (
                              <Badge variant="secondary" className="mt-1">
                                {cls.class_type.charAt(0).toUpperCase() + cls.class_type.slice(1)}
                              </Badge>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditClass(cls);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                        <CardDescription className="line-clamp-2">{cls.description}</CardDescription>
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
                            <Badge variant={capacityBadge.variant}>{capacityBadge.label}</Badge>
                            {(cls.waitlist_count || 0) > 0 && (
                              <Badge variant="outline">{cls.waitlist_count} waitlisted</Badge>
                            )}
                          </div>
                          
                          {/* Trainer Info */}
                          {trainerName && (
                            <div className="flex items-center gap-2 pt-2 border-t mt-2">
                              <User className="h-4 w-4 text-muted-foreground" />
                              <span className="font-medium">{trainerName}</span>
                              {trainerPhone && (
                                <a 
                                  href={`tel:${trainerPhone}`} 
                                  className="flex items-center gap-1 text-primary hover:underline"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Phone className="h-3 w-3" />
                                  {trainerPhone}
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="attendance" className="space-y-4">
            {selectedClass && selectedClassData ? (
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>{selectedClassData.name} - Attendance</CardTitle>
                      <CardDescription>
                        {format(new Date(selectedClassData.scheduled_at), "PPP p")}
                        {getTrainerName(selectedClassData.trainer_id) && (
                          <span className="ml-2">• Trainer: {getTrainerName(selectedClassData.trainer_id)}</span>
                        )}
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => handleEditClass(selectedClassData)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Class
                    </Button>
                  </div>
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
                            <TableCell>
                              {booking.member_phone ? (
                                <a href={`tel:${booking.member_phone}`} className="text-primary hover:underline flex items-center gap-1">
                                  <Phone className="h-3 w-3" />
                                  {booking.member_phone}
                                </a>
                              ) : "-"}
                            </TableCell>
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
                                    title="Mark as attended"
                                  >
                                    <Check className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleMarkAttendance(booking.id, false)}
                                    title="Mark as no-show"
                                  >
                                    <UserX className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleCancelBooking(booking.id)}
                                    title="Cancel booking"
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

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format, addDays } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Search, Calendar, Heart, Users, AlertTriangle } from 'lucide-react';

interface ConciergeBookingDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
}

interface MemberResult {
  id: string;
  member_code: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  branch_id: string;
  member_status: string;
}

export function ConciergeBookingDrawer({ open, onOpenChange, branchId }: ConciergeBookingDrawerProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberResult | null>(null);
  const [serviceType, setServiceType] = useState<'class' | 'recovery'>('class');
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [forceAdd, setForceAdd] = useState(false);
  const [booking, setBooking] = useState(false);

  // Search members
  const { data: members = [], isLoading: searchLoading } = useQuery({
    queryKey: ['concierge-search', searchTerm, branchId],
    enabled: searchTerm.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_members', {
        search_term: searchTerm,
        p_branch_id: branchId,
        p_limit: 10,
      });
      if (error) throw error;
      return (data || []) as MemberResult[];
    },
  });

  // Fetch classes for selected date
  const { data: classes = [] } = useQuery({
    queryKey: ['concierge-classes', branchId, selectedDate],
    enabled: !!selectedMember && serviceType === 'class',
    queryFn: async () => {
      const startDate = new Date(selectedDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(selectedDate);
      endDate.setHours(23, 59, 59, 999);

      const { data, error } = await supabase
        .from('classes')
        .select('id, name, scheduled_at, capacity, class_type')
        .eq('branch_id', branchId)
        .eq('is_active', true)
        .gte('scheduled_at', startDate.toISOString())
        .lte('scheduled_at', endDate.toISOString())
        .order('scheduled_at');

      if (error) throw error;

      // Get booking counts
      const classIds = (data || []).map(c => c.id);
      if (classIds.length === 0) return [];

      const { data: bookings } = await supabase
        .from('class_bookings')
        .select('class_id')
        .in('class_id', classIds)
        .eq('status', 'booked');

      const countMap: Record<string, number> = {};
      (bookings || []).forEach(b => {
        countMap[b.class_id] = (countMap[b.class_id] || 0) + 1;
      });

      return (data || []).map(c => ({
        ...c,
        booked_count: countMap[c.id] || 0,
        is_full: (countMap[c.id] || 0) >= c.capacity,
      }));
    },
  });

  // Fetch facilities & slots for recovery
  const { data: facilities = [] } = useQuery({
    queryKey: ['concierge-facilities', branchId],
    enabled: !!selectedMember && serviceType === 'recovery',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('facilities')
        .select('id, name, benefit_type_id, capacity')
        .eq('branch_id', branchId)
        .eq('is_active', true);
      if (error) throw error;
      return data || [];
    },
  });

  const [selectedFacility, setSelectedFacility] = useState<string>('');

  const { data: slots = [] } = useQuery({
    queryKey: ['concierge-slots', branchId, selectedDate, selectedFacility],
    enabled: !!selectedMember && serviceType === 'recovery' && !!selectedFacility,
    queryFn: async () => {
      // Ensure slots exist first
      await supabase.rpc('ensure_facility_slots', {
        p_branch_id: branchId,
        p_start_date: selectedDate,
        p_end_date: selectedDate,
      });

      const { data, error } = await supabase
        .from('benefit_slots')
        .select('id, start_time, end_time, capacity, booked_count')
        .eq('branch_id', branchId)
        .eq('facility_id', selectedFacility)
        .eq('slot_date', selectedDate)
        .eq('is_active', true)
        .order('start_time');

      if (error) throw error;
      return data || [];
    },
  });

  const handleBookClass = async (classId: string) => {
    if (!selectedMember) return;
    setBooking(true);
    try {
      const { data, error } = await supabase.rpc('book_class', {
        _class_id: classId,
        _member_id: selectedMember.id,
      });
      if (error) throw error;
      const result = data as any;
      if (result?.success || result?.valid !== false) {
        toast.success(`Class booked for ${selectedMember.full_name}`);
        onOpenChange(false);
        resetState();
      } else {
        if (forceAdd) {
          // Force add: direct insert bypassing validation
          const { error: insertError } = await supabase
            .from('class_bookings')
            .insert({
              class_id: classId,
              member_id: selectedMember.id,
              status: 'booked',
            });
          if (insertError) throw insertError;
          toast.success(`Class force-booked for ${selectedMember.full_name}`);
          onOpenChange(false);
          resetState();
        } else {
          toast.error(result?.error || 'Booking failed');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  const handleBookSlot = async (slotId: string) => {
    if (!selectedMember) return;
    setBooking(true);
    try {
      // Get member's active membership
      const { data: membership } = await supabase
        .from('memberships')
        .select('id')
        .eq('member_id', selectedMember.id)
        .eq('status', 'active')
        .gte('end_date', new Date().toISOString().split('T')[0])
        .order('end_date', { ascending: false })
        .limit(1)
        .single();

      if (!membership && !forceAdd) {
        toast.error('Member has no active membership');
        return;
      }

      const { error } = await supabase
        .from('benefit_bookings')
        .insert({
          slot_id: slotId,
          member_id: selectedMember.id,
          membership_id: membership?.id || selectedMember.id, // fallback for force-add
          status: 'booked',
        });

      if (error) throw error;
      toast.success(`Slot booked for ${selectedMember.full_name}`);
      onOpenChange(false);
      resetState();
    } catch (err: any) {
      toast.error(err.message || 'Booking failed');
    } finally {
      setBooking(false);
    }
  };

  const resetState = () => {
    setSelectedMember(null);
    setSearchTerm('');
    setForceAdd(false);
    setSelectedFacility('');
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetState(); }}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Concierge Booking</SheetTitle>
          <SheetDescription>Book a class or facility slot on behalf of a member</SheetDescription>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Step 1: Select Member */}
          {!selectedMember ? (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Step 1: Find Member</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, code, phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              {searchLoading && <p className="text-sm text-muted-foreground">Searching...</p>}
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {members.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setSelectedMember(m)}
                    className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors text-left"
                  >
                    <div>
                      <div className="font-medium">{m.full_name}</div>
                      <div className="text-sm text-muted-foreground">{m.member_code} • {m.phone || m.email}</div>
                    </div>
                    <Badge variant={m.member_status === 'active' ? 'default' : 'secondary'}>
                      {m.member_status}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {/* Selected member header */}
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted">
                <div>
                  <div className="font-medium">{selectedMember.full_name}</div>
                  <div className="text-sm text-muted-foreground">{selectedMember.member_code}</div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setSelectedMember(null)}>Change</Button>
              </div>

              {/* Step 2: Select Service */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Step 2: Select Service & Date</Label>
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                />
                <Tabs value={serviceType} onValueChange={(v) => setServiceType(v as 'class' | 'recovery')}>
                  <TabsList className="w-full">
                    <TabsTrigger value="class" className="flex-1 gap-1">
                      <Calendar className="h-4 w-4" /> Classes
                    </TabsTrigger>
                    <TabsTrigger value="recovery" className="flex-1 gap-1">
                      <Heart className="h-4 w-4" /> Recovery
                    </TabsTrigger>
                  </TabsList>

                  {/* Classes */}
                  <TabsContent value="class" className="space-y-2 mt-3">
                    {classes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No classes on this date</p>
                    ) : (
                      classes.map((c: any) => (
                        <div key={c.id} className="flex items-center justify-between p-3 rounded-lg border">
                          <div>
                            <div className="font-medium">{c.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {format(new Date(c.scheduled_at), 'HH:mm')} • {c.booked_count}/{c.capacity} booked
                            </div>
                          </div>
                          <Button
                            size="sm"
                            disabled={booking || (c.is_full && !forceAdd)}
                            onClick={() => handleBookClass(c.id)}
                          >
                            {c.is_full ? 'Full' : 'Book'}
                          </Button>
                        </div>
                      ))
                    )}
                  </TabsContent>

                  {/* Recovery */}
                  <TabsContent value="recovery" className="space-y-3 mt-3">
                    <Select value={selectedFacility} onValueChange={setSelectedFacility}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select facility" />
                      </SelectTrigger>
                      <SelectContent>
                        {facilities.map((f: any) => (
                          <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {selectedFacility && (
                      <div className="grid grid-cols-3 gap-2 max-h-60 overflow-y-auto">
                        {slots.length === 0 ? (
                          <p className="col-span-3 text-sm text-muted-foreground text-center py-4">No slots available</p>
                        ) : (
                          slots.map((s: any) => {
                            const available = s.booked_count < s.capacity;
                            return (
                              <Button
                                key={s.id}
                                variant={available ? 'outline' : 'ghost'}
                                size="sm"
                                disabled={booking || (!available && !forceAdd)}
                                onClick={() => handleBookSlot(s.id)}
                                className="text-xs"
                              >
                                {s.start_time?.slice(0, 5)}
                                {!available && <span className="ml-1 text-destructive">•</span>}
                              </Button>
                            );
                          })
                        )}
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>

              {/* Force Add */}
              <div className="flex items-center space-x-2 p-3 rounded-lg border border-dashed border-destructive/30">
                <Checkbox
                  id="force-add"
                  checked={forceAdd}
                  onCheckedChange={(v) => setForceAdd(!!v)}
                />
                <label htmlFor="force-add" className="text-sm flex items-center gap-1 cursor-pointer">
                  <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                  Override capacity (Force Add)
                </label>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

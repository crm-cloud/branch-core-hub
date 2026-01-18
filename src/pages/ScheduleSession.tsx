import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { useTrainerData } from '@/hooks/useMemberData';
import { supabase } from '@/integrations/supabase/client';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  User, 
  AlertCircle,
  CheckCircle,
  Plus
} from 'lucide-react';
import { format, addHours, setHours, setMinutes } from 'date-fns';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export default function ScheduleSession() {
  const { profile } = useAuth();
  const { trainer, clients, isLoading } = useTrainerData();

  const [selectedClient, setSelectedClient] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [selectedTime, setSelectedTime] = useState<string>('10:00');
  const [duration, setDuration] = useState<number>(60);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const timeSlots = [];
  for (let hour = 6; hour <= 21; hour++) {
    timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
    timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
  }

  const handleScheduleSession = async () => {
    if (!selectedClient || !selectedDate) {
      toast.error('Please select a client and date');
      return;
    }

    const clientPackage = clients.find(c => c.member_id === selectedClient);
    if (!clientPackage) {
      toast.error('Client package not found');
      return;
    }

    if ((clientPackage.sessions_remaining || 0) <= 0) {
      toast.error('Client has no remaining sessions');
      return;
    }

    setIsSubmitting(true);

    try {
      const [hours, minutes] = selectedTime.split(':').map(Number);
      const scheduledAt = setMinutes(setHours(selectedDate, hours), minutes);

      const { error } = await supabase
        .from('pt_sessions')
        .insert({
          trainer_id: trainer!.id,
          branch_id: trainer!.branch_id,
          member_pt_package_id: clientPackage.id,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: duration,
          status: 'scheduled',
          notes: notes || null,
        });

      if (error) throw error;

      toast.success('Session scheduled successfully');
      
      // Reset form
      setSelectedClient('');
      setSelectedDate(undefined);
      setSelectedTime('10:00');
      setNotes('');
    } catch (error: any) {
      toast.error('Failed to schedule session: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </AppLayout>
    );
  }

  if (!trainer) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <AlertCircle className="h-12 w-12 text-warning" />
          <h2 className="text-xl font-semibold">No Trainer Profile Found</h2>
          <p className="text-muted-foreground">Your account is not linked to a trainer profile.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Plus className="h-8 w-8 text-accent" />
            Schedule PT Session
          </h1>
          <p className="text-muted-foreground">
            Book a personal training session with your client
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Session Details Form */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-lg">Session Details</CardTitle>
              <CardDescription>Fill in the session information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Client Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Select Client
                </Label>
                {clients.length === 0 ? (
                  <div className="p-4 bg-muted/50 rounded-lg text-center">
                    <p className="text-muted-foreground text-sm">No active PT clients</p>
                  </div>
                ) : (
                  <Select value={selectedClient} onValueChange={setSelectedClient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choose a client" />
                    </SelectTrigger>
                    <SelectContent>
                      {clients.map((client: any) => (
                        <SelectItem key={client.member_id} value={client.member_id}>
                          <div className="flex items-center justify-between w-full gap-4">
                            <span>{client.member?.profile?.full_name || client.member?.member_code || 'Unknown'}</span>
                            <Badge variant="outline" className="text-xs">
                              {client.sessions_remaining} sessions left
                            </Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Date Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4" />
                  Session Date
                </Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full justify-start text-left font-normal"
                    >
                      {selectedDate ? (
                        format(selectedDate, 'EEE, dd MMM yyyy')
                      ) : (
                        <span className="text-muted-foreground">Pick a date</span>
                      )}
                      <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={setSelectedDate}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              {/* Time Selection */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Session Time
                </Label>
                <Select value={selectedTime} onValueChange={setSelectedTime}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {timeSlots.map((time) => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Duration */}
              <div className="space-y-2">
                <Label>Duration (minutes)</Label>
                <Select value={duration.toString()} onValueChange={(v) => setDuration(Number(v))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="30">30 minutes</SelectItem>
                    <SelectItem value="45">45 minutes</SelectItem>
                    <SelectItem value="60">60 minutes</SelectItem>
                    <SelectItem value="90">90 minutes</SelectItem>
                    <SelectItem value="120">120 minutes</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Session Notes (Optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Focus areas, workout plan, etc."
                  rows={3}
                />
              </div>

              {/* Submit Button */}
              <Button 
                className="w-full" 
                onClick={handleScheduleSession}
                disabled={!selectedClient || !selectedDate || isSubmitting}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Schedule Session
              </Button>
            </CardContent>
          </Card>

          {/* Client Info & Summary */}
          <div className="space-y-6">
            {/* Selected Session Summary */}
            {selectedClient && selectedDate && (
              <Card className="border-accent/20 bg-accent/5">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <CheckCircle className="h-5 w-5 text-success" />
                    Session Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Client</span>
                      <span className="font-medium">
                        {(clients.find((c: any) => c.member_id === selectedClient)?.member?.profile?.full_name) || (clients.find((c: any) => c.member_id === selectedClient)?.member?.member_code) || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span className="font-medium">{format(selectedDate, 'EEE, dd MMM yyyy')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Time</span>
                      <span className="font-medium">{selectedTime}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Duration</span>
                      <span className="font-medium">{duration} minutes</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Active Clients */}
            <Card className="border-border/50">
              <CardHeader>
                <CardTitle className="text-lg">Your PT Clients</CardTitle>
                <CardDescription>{clients.length} active client(s)</CardDescription>
              </CardHeader>
              <CardContent>
                {clients.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">No active clients</p>
                ) : (
                  <div className="space-y-3">
                    {clients.map((client: any) => (
                      <div 
                        key={client.id} 
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                          selectedClient === client.member_id 
                            ? 'border-accent bg-accent/10' 
                            : 'border-border/50 hover:bg-muted/50'
                        }`}
                        onClick={() => setSelectedClient(client.member_id)}
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-accent/10 flex items-center justify-center">
                            <User className="h-5 w-5 text-accent" />
                          </div>
                        <div>
                          <p className="font-medium">
                            {client.member?.member_code}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            {client.package?.name}
                          </p>
                          </div>
                        </div>
                        <Badge 
                          variant={client.sessions_remaining > 3 ? 'default' : 'destructive'}
                        >
                          {client.sessions_remaining} left
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

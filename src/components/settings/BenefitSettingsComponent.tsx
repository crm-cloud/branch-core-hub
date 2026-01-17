import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, Clock, Users, AlertTriangle, Sparkles } from "lucide-react";
import { useBenefitSettings, useUpsertBenefitSetting } from "@/hooks/useBenefitBookings";
import { useBookableBenefitTypes } from "@/hooks/useBenefitTypes";
import { BenefitTypesManager } from "./BenefitTypesManager";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";
import * as LucideIcons from "lucide-react";

type BenefitType = Database["public"]["Enums"]["benefit_type"];
type NoShowPolicy = Database["public"]["Enums"]["no_show_policy"];

function getIconComponent(iconName: string | null) {
  if (!iconName) return <Sparkles className="h-5 w-5" />;
  const Icon = (LucideIcons as any)[iconName];
  return Icon ? <Icon className="h-5 w-5" /> : <Sparkles className="h-5 w-5" />;
}

interface BenefitSettingFormProps {
  branchId: string;
  benefitType: BenefitType;
  label: string;
  icon: React.ReactNode;
  initialSettings?: {
    is_slot_booking_enabled?: boolean;
    slot_duration_minutes?: number;
    booking_opens_hours_before?: number;
    cancellation_deadline_minutes?: number;
    no_show_policy?: NoShowPolicy;
    no_show_penalty_amount?: number;
    max_bookings_per_day?: number;
    buffer_between_sessions_minutes?: number;
    operating_hours_start?: string;
    operating_hours_end?: string;
    capacity_per_slot?: number;
  };
}

function BenefitSettingForm({ branchId, benefitType, label, icon, initialSettings }: BenefitSettingFormProps) {
  const [isEnabled, setIsEnabled] = useState(initialSettings?.is_slot_booking_enabled ?? false);
  const [duration, setDuration] = useState(initialSettings?.slot_duration_minutes ?? 30);
  const [bookingOpens, setBookingOpens] = useState(initialSettings?.booking_opens_hours_before ?? 24);
  const [cancellationDeadline, setCancellationDeadline] = useState(initialSettings?.cancellation_deadline_minutes ?? 60);
  const [noShowPolicy, setNoShowPolicy] = useState<NoShowPolicy>(initialSettings?.no_show_policy ?? "mark_used");
  const [noShowPenalty, setNoShowPenalty] = useState(initialSettings?.no_show_penalty_amount ?? 0);
  const [maxBookings, setMaxBookings] = useState(initialSettings?.max_bookings_per_day ?? 2);
  const [buffer, setBuffer] = useState(initialSettings?.buffer_between_sessions_minutes ?? 15);
  const [startTime, setStartTime] = useState(initialSettings?.operating_hours_start ?? "06:00");
  const [endTime, setEndTime] = useState(initialSettings?.operating_hours_end ?? "22:00");
  const [capacity, setCapacity] = useState(initialSettings?.capacity_per_slot ?? 4);
  
  const upsertSetting = useUpsertBenefitSetting();
  
  const handleSave = async () => {
    try {
      await upsertSetting.mutateAsync({
        branch_id: branchId,
        benefit_type: benefitType,
        is_slot_booking_enabled: isEnabled,
        slot_duration_minutes: duration,
        booking_opens_hours_before: bookingOpens,
        cancellation_deadline_minutes: cancellationDeadline,
        no_show_policy: noShowPolicy,
        no_show_penalty_amount: noShowPenalty,
        max_bookings_per_day: maxBookings,
        buffer_between_sessions_minutes: buffer,
        operating_hours_start: startTime,
        operating_hours_end: endTime,
        capacity_per_slot: capacity,
      });
      toast.success(`${label} settings saved successfully`);
    } catch (error) {
      toast.error("Failed to save settings");
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">{icon}</div>
            <div>
              <CardTitle className="text-lg">{label}</CardTitle>
              <CardDescription>Configure slot booking for {label.toLowerCase()}</CardDescription>
            </div>
          </div>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
        </div>
      </CardHeader>
      
      {isEnabled && (
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Slot Duration */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Clock className="h-4 w-4" /> Slot Duration (mins)
              </Label>
              <Input
                type="number"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
                min={5}
                max={180}
              />
            </div>
            
            {/* Capacity */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" /> Capacity per Slot
              </Label>
              <Input
                type="number"
                value={capacity}
                onChange={(e) => setCapacity(parseInt(e.target.value) || 1)}
                min={1}
                max={50}
              />
            </div>
            
            {/* Max Bookings */}
            <div className="space-y-2">
              <Label>Max Bookings per Day (per member)</Label>
              <Input
                type="number"
                value={maxBookings}
                onChange={(e) => setMaxBookings(parseInt(e.target.value) || 1)}
                min={1}
                max={10}
              />
            </div>
            
            {/* Buffer Time */}
            <div className="space-y-2">
              <Label>Buffer Between Sessions (mins)</Label>
              <Input
                type="number"
                value={buffer}
                onChange={(e) => setBuffer(parseInt(e.target.value) || 0)}
                min={0}
                max={60}
              />
            </div>
            
            {/* Operating Hours */}
            <div className="space-y-2">
              <Label>Opening Time</Label>
              <Input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label>Closing Time</Label>
              <Input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
            
            {/* Booking Opens */}
            <div className="space-y-2">
              <Label>Booking Opens (hours before)</Label>
              <Input
                type="number"
                value={bookingOpens}
                onChange={(e) => setBookingOpens(parseInt(e.target.value) || 24)}
                min={1}
                max={168}
              />
            </div>
            
            {/* Cancellation Deadline */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4" /> Cancellation Deadline (mins before)
              </Label>
              <Input
                type="number"
                value={cancellationDeadline}
                onChange={(e) => setCancellationDeadline(parseInt(e.target.value) || 60)}
                min={0}
                max={1440}
              />
            </div>
            
            {/* No-Show Policy */}
            <div className="space-y-2">
              <Label>No-Show Policy</Label>
              <Select value={noShowPolicy} onValueChange={(v) => setNoShowPolicy(v as NoShowPolicy)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mark_used">Mark session as used</SelectItem>
                  <SelectItem value="allow_reschedule">Allow one reschedule</SelectItem>
                  <SelectItem value="charge_penalty">Charge penalty fee</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {noShowPolicy === "charge_penalty" && (
              <div className="space-y-2">
                <Label>Penalty Amount</Label>
                <Input
                  type="number"
                  value={noShowPenalty}
                  onChange={(e) => setNoShowPenalty(parseFloat(e.target.value) || 0)}
                  min={0}
                  step={0.01}
                />
              </div>
            )}
          </div>
          
          <Button onClick={handleSave} disabled={upsertSetting.isPending}>
            {upsertSetting.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </CardContent>
      )}
    </Card>
  );
}

export function BenefitSettingsComponent() {
  // Get first branch for demo - in production, use selected branch from context
  const { data: branches } = useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("*").limit(1);
      if (error) throw error;
      return data;
    },
  });
  
  const branchId = branches?.[0]?.id || "";
  const { data: settings, isLoading: loadingSettings } = useBenefitSettings(branchId);
  const { data: bookableBenefitTypes, isLoading: loadingTypes } = useBookableBenefitTypes(branchId);
  
  if (!branchId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No branch found. Please create a branch first.
      </div>
    );
  }
  
  const isLoading = loadingSettings || loadingTypes;
  
  if (isLoading) {
    return <div className="text-center py-8">Loading settings...</div>;
  }
  
  const getSettingsForType = (benefitType: BenefitType) => {
    return settings?.find((s) => s.benefit_type === benefitType);
  };
  
  return (
    <div className="space-y-8">
      {/* Benefit Types Manager */}
      <BenefitTypesManager />
      
      {/* Slot Booking Settings */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Settings2 className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Slot Booking Settings</h2>
            <p className="text-muted-foreground">Configure slot-based booking for bookable benefits</p>
          </div>
        </div>
        
        {bookableBenefitTypes && bookableBenefitTypes.length > 0 ? (
          <div className="space-y-4">
            {bookableBenefitTypes.map((bt) => (
              <BenefitSettingForm
                key={bt.id}
                branchId={branchId}
                benefitType={bt.code as BenefitType}
                label={bt.name}
                icon={getIconComponent(bt.icon)}
                initialSettings={getSettingsForType(bt.code as BenefitType)}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">
                No bookable benefit types found. Create benefit types above and enable "Requires Slot Booking" to configure slot settings.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Settings2, Clock, Users, AlertTriangle, Sparkles, SlidersHorizontal } from "lucide-react";
import { useBenefitSettings, useUpsertBenefitSetting } from "@/hooks/useBenefitBookings";
import { useBookableBenefitTypes } from "@/hooks/useBenefitTypes";
import { BenefitTypesManager } from "./BenefitTypesManager";
import { FacilitiesManager } from "./FacilitiesManager";
import { toast } from "sonner";
import { Database } from "@/integrations/supabase/types";
import * as LucideIcons from "lucide-react";
import { safeBenefitEnum } from "@/lib/benefitEnums";

type BenefitType = Database["public"]["Enums"]["benefit_type"];
type NoShowPolicy = Database["public"]["Enums"]["no_show_policy"];

function getIconComponent(iconName: string | null, className = "h-5 w-5") {
  if (!iconName) return <Sparkles className={className} />;
  const Icon = (LucideIcons as any)[iconName];
  return Icon ? <Icon className={className} /> : <Sparkles className={className} />;
}

/* ── Configure Sheet (full settings form) ── */

interface ConfigureSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchId: string;
  benefitType: BenefitType;
  benefitTypeId: string;
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

function ConfigureSheet({ open, onOpenChange, branchId, benefitType, benefitTypeId, label, icon, initialSettings }: ConfigureSheetProps) {
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
        benefit_type_id: benefitTypeId,
        is_slot_booking_enabled: true,
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
      toast.success(`${label} settings saved`);
      onOpenChange(false);
    } catch {
      toast.error("Failed to save settings");
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg">{icon}</div>
            <div>
              <SheetTitle>{label} Settings</SheetTitle>
              <SheetDescription>Configure slot booking parameters</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-5 py-6">
          {/* Duration & Capacity */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Clock className="h-4 w-4" /> Duration (mins)</Label>
              <Input type="number" value={duration} onChange={(e) => setDuration(parseInt(e.target.value) || 30)} min={5} max={180} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Users className="h-4 w-4" /> Capacity</Label>
              <Input type="number" value={capacity} onChange={(e) => setCapacity(parseInt(e.target.value) || 1)} min={1} max={50} />
            </div>
          </div>

          {/* Operating Hours */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Opening Time</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Closing Time</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>

          {/* Max Bookings & Buffer */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Max Bookings / Day</Label>
              <Input type="number" value={maxBookings} onChange={(e) => setMaxBookings(parseInt(e.target.value) || 1)} min={1} max={10} />
            </div>
            <div className="space-y-2">
              <Label>Buffer (mins)</Label>
              <Input type="number" value={buffer} onChange={(e) => setBuffer(parseInt(e.target.value) || 0)} min={0} max={60} />
            </div>
          </div>

          {/* Booking Opens & Cancellation */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Booking Opens (hrs before)</Label>
              <Input type="number" value={bookingOpens} onChange={(e) => setBookingOpens(parseInt(e.target.value) || 24)} min={1} max={168} />
            </div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><AlertTriangle className="h-4 w-4" /> Cancel Deadline (mins)</Label>
              <Input type="number" value={cancellationDeadline} onChange={(e) => setCancellationDeadline(parseInt(e.target.value) || 60)} min={0} max={1440} />
            </div>
          </div>

          {/* No-Show Policy */}
          <div className="space-y-2">
            <Label>No-Show Policy</Label>
            <Select value={noShowPolicy} onValueChange={(v) => setNoShowPolicy(v as NoShowPolicy)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
              <Input type="number" value={noShowPenalty} onChange={(e) => setNoShowPenalty(parseFloat(e.target.value) || 0)} min={0} step={0.01} />
            </div>
          )}

          <Button onClick={handleSave} disabled={upsertSetting.isPending} className="w-full">
            {upsertSetting.isPending ? "Saving..." : "Save Settings"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ── Main Component ── */

export function BenefitSettingsComponent() {
  const [configureType, setConfigureType] = useState<{
    id: string;
    code: string;
    name: string;
    icon: string | null;
    category: string | null;
    settings?: any;
  } | null>(null);

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
  const upsertSetting = useUpsertBenefitSetting();

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

  const getSettingsForType = (benefitCode: string, benefitTypeId: string) => {
    return settings?.find((s) => s.benefit_type_id === benefitTypeId)
      || settings?.find((s) => s.benefit_type === benefitCode);
  };

  const handleToggle = async (bt: any, currentlyEnabled: boolean) => {
    const existing = getSettingsForType(bt.code, bt.id);
    try {
      await upsertSetting.mutateAsync({
        branch_id: branchId,
        benefit_type: safeBenefitEnum(bt.code) as BenefitType,
        benefit_type_id: bt.id,
        is_slot_booking_enabled: !currentlyEnabled,
        slot_duration_minutes: existing?.slot_duration_minutes ?? 30,
        capacity_per_slot: existing?.capacity_per_slot ?? 4,
        operating_hours_start: existing?.operating_hours_start ?? "06:00",
        operating_hours_end: existing?.operating_hours_end ?? "22:00",
        max_bookings_per_day: existing?.max_bookings_per_day ?? 2,
        buffer_between_sessions_minutes: existing?.buffer_between_sessions_minutes ?? 15,
        booking_opens_hours_before: existing?.booking_opens_hours_before ?? 24,
        cancellation_deadline_minutes: existing?.cancellation_deadline_minutes ?? 60,
        no_show_policy: (existing?.no_show_policy as NoShowPolicy) ?? "mark_used",
        no_show_penalty_amount: existing?.no_show_penalty_amount ?? 0,
      });
      toast.success(`${bt.name} ${!currentlyEnabled ? "enabled" : "disabled"}`);
    } catch {
      toast.error("Failed to update");
    }
  };

  return (
    <div className="space-y-8">
      <BenefitTypesManager />
      <FacilitiesManager />

      {/* Slot Booking Settings — compact card grid */}
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Settings2 className="h-6 w-6 text-primary" />
          <div>
            <h2 className="text-xl font-semibold">Slot Booking Settings</h2>
            <p className="text-muted-foreground">Configure slot-based booking for bookable benefits</p>
          </div>
        </div>

        {bookableBenefitTypes && bookableBenefitTypes.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {bookableBenefitTypes.map((bt) => {
              const s = getSettingsForType(bt.code, bt.id);
              const enabled = s?.is_slot_booking_enabled ?? false;

              return (
                <Card key={bt.id} className={`transition-shadow hover:shadow-md ${enabled ? "border-primary/30" : ""}`}>
                  <CardContent className="pt-5 pb-4 px-5 space-y-3">
                    {/* Header row */}
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2.5 rounded-xl ${enabled ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                          {getIconComponent(bt.icon)}
                        </div>
                        <div>
                          <p className="font-semibold leading-tight">{bt.name}</p>
                          {bt.category && (
                            <Badge variant="secondary" className="mt-1 text-xs font-normal">{bt.category}</Badge>
                          )}
                        </div>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={() => handleToggle(bt, enabled)}
                        disabled={upsertSetting.isPending}
                      />
                    </div>

                    {/* Stats summary */}
                    {enabled && s && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3.5 w-3.5" />
                        <span>{s.slot_duration_minutes ?? 30} min</span>
                        <span>·</span>
                        <Users className="h-3.5 w-3.5" />
                        <span>Cap: {s.capacity_per_slot ?? 4}</span>
                        <span>·</span>
                        <span>{s.operating_hours_start ?? "06:00"}–{s.operating_hours_end ?? "22:00"}</span>
                      </div>
                    )}

                    {/* Configure button */}
                    {enabled && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => setConfigureType({ id: bt.id, code: bt.code, name: bt.name, icon: bt.icon, category: bt.category, settings: s })}
                      >
                        <SlidersHorizontal className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
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

      {/* Configure Sheet */}
      {configureType && (
        <ConfigureSheet
          open={!!configureType}
          onOpenChange={(open) => { if (!open) setConfigureType(null); }}
          branchId={branchId}
          benefitType={safeBenefitEnum(configureType.code) as BenefitType}
          benefitTypeId={configureType.id}
          label={configureType.name}
          icon={getIconComponent(configureType.icon)}
          initialSettings={configureType.settings}
        />
      )}
    </div>
  );
}

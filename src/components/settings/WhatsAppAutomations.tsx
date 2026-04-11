import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranchContext } from '@/contexts/BranchContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Zap, Clock, MessageSquare, Plus } from 'lucide-react';

const SYSTEM_EVENTS = [
  { value: 'member_created', label: 'New Member Created', description: 'When a new member is registered' },
  { value: 'payment_received', label: 'Payment Received', description: 'When a payment is recorded' },
  { value: 'class_booked', label: 'Class Booked', description: 'When a member books a class' },
  { value: 'facility_booked', label: 'Facility Booked', description: 'When a facility slot is booked (sauna, ice bath)' },
  { value: 'pt_session_booked', label: 'PT Session Booked', description: 'When a PT session is scheduled' },
  { value: 'membership_expiring_7d', label: 'Membership Expiring (7 days)', description: 'Triggered 7 days before membership ends' },
  { value: 'membership_expiring_1d', label: 'Membership Expiring (1 day)', description: 'Triggered 1 day before membership ends' },
  { value: 'membership_expired', label: 'Membership Expired', description: 'When membership has expired' },
  { value: 'missed_workout_3d', label: 'Missed Workout (3 days)', description: 'Member hasn\'t visited in 3+ days' },
  { value: 'birthday', label: 'Birthday Wish', description: 'On member\'s birthday' },
  { value: 'freeze_confirmed', label: 'Membership Frozen', description: 'When membership is frozen' },
  { value: 'unfreeze_confirmed', label: 'Membership Unfrozen', description: 'When membership is unfrozen' },
];

export function WhatsAppAutomations() {
  const { effectiveBranchId } = useBranchContext();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEvent, setNewEvent] = useState('');
  const [newTemplateId, setNewTemplateId] = useState('');
  const [newDelay, setNewDelay] = useState('0');

  const { data: triggers = [], isLoading: triggersLoading } = useQuery({
    queryKey: ['whatsapp-triggers', effectiveBranchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('whatsapp_triggers')
        .select('*, templates(name)')
        .eq('branch_id', effectiveBranchId!);
      if (error) throw error;
      return data || [];
    },
    enabled: !!effectiveBranchId,
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['wa-templates-for-triggers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('id, name, type')
        .eq('type', 'whatsapp')
        .order('name');
      if (error) throw error;
      return data || [];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('whatsapp_triggers')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-triggers'] });
      toast.success('Trigger updated');
    },
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('whatsapp_triggers')
        .insert({
          branch_id: effectiveBranchId!,
          event_name: newEvent,
          template_id: newTemplateId,
          delay_minutes: parseInt(newDelay) || 0,
          is_active: true,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-triggers'] });
      toast.success('Automation trigger added');
      setShowAddForm(false);
      setNewEvent('');
      setNewTemplateId('');
      setNewDelay('0');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('whatsapp_triggers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['whatsapp-triggers'] });
      toast.success('Trigger removed');
    },
  });

  const usedEvents = new Set(triggers.map((t: any) => t.event_name));

  if (triggersLoading) {
    return <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>;
  }

  return (
    <Card className="rounded-xl shadow-lg shadow-muted/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          WhatsApp Automations
        </CardTitle>
        <CardDescription>
          Automatically send WhatsApp messages when events occur (e.g., new member, payment received).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {triggers.map((trigger: any) => {
          const eventInfo = SYSTEM_EVENTS.find(e => e.value === trigger.event_name);
          return (
            <div key={trigger.id} className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium text-sm">{eventInfo?.label || trigger.event_name}</span>
                  {trigger.delay_minutes > 0 && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Clock className="h-3 w-3" /> {trigger.delay_minutes}m delay
                    </span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  → {(trigger as any).templates?.name || 'Unknown template'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={trigger.is_active}
                  onCheckedChange={(checked) => toggleMutation.mutate({ id: trigger.id, is_active: checked })}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => deleteMutation.mutate(trigger.id)}
                >
                  Remove
                </Button>
              </div>
            </div>
          );
        })}

        {triggers.length === 0 && !showAddForm && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No automations configured. Add one below.
          </p>
        )}

        {showAddForm ? (
          <div className="p-4 rounded-lg border space-y-3 bg-muted/30">
            <div>
              <Label>Event</Label>
              <Select value={newEvent} onValueChange={setNewEvent}>
                <SelectTrigger><SelectValue placeholder="Select event..." /></SelectTrigger>
                <SelectContent>
                  {SYSTEM_EVENTS.filter(e => !usedEvents.has(e.value)).map(e => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Template</Label>
              <Select value={newTemplateId} onValueChange={setNewTemplateId}>
                <SelectTrigger><SelectValue placeholder="Select template..." /></SelectTrigger>
                <SelectContent>
                  {templates.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Delay (minutes)</Label>
              <Input type="number" value={newDelay} onChange={e => setNewDelay(e.target.value)} min="0" />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => addMutation.mutate()} disabled={!newEvent || !newTemplateId}>
                Add Trigger
              </Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" className="w-full" onClick={() => setShowAddForm(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add Automation
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

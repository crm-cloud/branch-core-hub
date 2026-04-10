import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Brain, Save, X, Plus, Sparkles, MessageSquare } from 'lucide-react';
import { Input } from '@/components/ui/input';

const PRESET_FIELDS = [
  { id: 'name', label: 'Name' },
  { id: 'phone', label: 'Phone' },
  { id: 'email', label: 'Email' },
  { id: 'fitness_goal', label: 'Fitness Goal' },
  { id: 'expected_start_date', label: 'Expected Start Date' },
  { id: 'budget', label: 'Budget' },
  { id: 'age', label: 'Age' },
  { id: 'gender', label: 'Gender' },
  { id: 'preferred_timing', label: 'Preferred Timing' },
];

const DEFAULT_HANDOFF = "Thanks for sharing! Our team will reach out to you shortly. 😊";

interface AiFlowConfig {
  target_fields: string[];
  handoff_message: string;
  enabled: boolean;
}

export function AIFlowBuilder() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<AiFlowConfig>({
    target_fields: ['name', 'phone', 'fitness_goal'],
    handoff_message: DEFAULT_HANDOFF,
    enabled: false,
  });
  const [customFieldInput, setCustomFieldInput] = useState('');

  const { data: existing, isLoading } = useQuery({
    queryKey: ['ai-flow-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_settings')
        .select('*')
        .eq('integration_type', 'ai_flow')
        .eq('provider', 'whatsapp_lead')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing?.config) {
      const c = existing.config as Record<string, unknown>;
      setConfig({
        target_fields: (c.target_fields as string[]) || ['name', 'phone', 'fitness_goal'],
        handoff_message: (c.handoff_message as string) || DEFAULT_HANDOFF,
        enabled: existing.is_active ?? false,
      });
    }
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        integration_type: 'ai_flow',
        provider: 'whatsapp_lead',
        branch_id: null,
        is_active: config.enabled,
        config: {
          target_fields: config.target_fields,
          handoff_message: config.handoff_message,
        },
        credentials: {},
      };

      if (existing?.id) {
        const { error } = await supabase
          .from('integration_settings')
          .update(payload)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('integration_settings')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('AI Flow configuration saved');
      queryClient.invalidateQueries({ queryKey: ['ai-flow-config'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save'),
  });

  const toggleField = (fieldId: string) => {
    setConfig((prev) => ({
      ...prev,
      target_fields: prev.target_fields.includes(fieldId)
        ? prev.target_fields.filter((f) => f !== fieldId)
        : [...prev.target_fields, fieldId],
    }));
  };

  const addCustomField = () => {
    // Normalise: lower-case, spaces → underscores, keep only alphanum + underscore
    const trimmed = customFieldInput.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!trimmed) return;
    if (config.target_fields.includes(trimmed)) {
      toast.warning('Field already added');
      return;
    }
    setConfig((prev) => ({ ...prev, target_fields: [...prev.target_fields, trimmed] }));
    setCustomFieldInput('');
  };

  const removeField = (fieldId: string) => {
    setConfig((prev) => ({
      ...prev,
      target_fields: prev.target_fields.filter((f) => f !== fieldId),
    }));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Brain className="h-6 w-6 animate-pulse mr-2" />
        Loading AI Flow configuration…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Brain className="h-5 w-5 text-violet-500" />
            AI Lead Capture Flow
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Configure how the WhatsApp AI agent collects lead information autonomously.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="flow-enabled" className="text-sm font-medium">
            {config.enabled ? 'Enabled' : 'Disabled'}
          </Label>
          <Switch
            id="flow-enabled"
            checked={config.enabled}
            onCheckedChange={(v) => setConfig((prev) => ({ ...prev, enabled: v }))}
          />
        </div>
      </div>

      {/* Target Fields */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            Target Fields to Collect
          </CardTitle>
          <CardDescription>
            The AI will guide the conversation to naturally collect each of these fields before handing off.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Preset chips */}
          <div className="flex flex-wrap gap-2">
            {PRESET_FIELDS.map((field) => {
              const active = config.target_fields.includes(field.id);
              return (
                <button
                  key={field.id}
                  type="button"
                  onClick={() => toggleField(field.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                    active
                      ? 'bg-violet-500 text-white border-violet-500 shadow-sm'
                      : 'bg-card text-muted-foreground border-border hover:border-violet-400'
                  }`}
                >
                  {active ? '✓ ' : ''}{field.label}
                </button>
              );
            })}
          </div>

          {/* Custom fields already added (non-preset) */}
          {config.target_fields
            .filter((f) => !PRESET_FIELDS.some((p) => p.id === f))
            .map((f) => (
              <Badge key={f} variant="secondary" className="gap-1 pl-2.5 pr-1 py-1 text-sm">
                {f.replace(/_/g, ' ')}
                <button
                  type="button"
                  onClick={() => removeField(f)}
                  className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}

          {/* Add custom field */}
          <div className="flex gap-2 pt-1">
            <Input
              placeholder="Add custom field (e.g. injury_history)"
              value={customFieldInput}
              onChange={(e) => setCustomFieldInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomField()}
              className="flex-1"
            />
            <Button variant="outline" size="sm" onClick={addCustomField}>
              <Plus className="h-4 w-4 mr-1" /> Add
            </Button>
          </div>

          {/* Current selection summary */}
          {config.target_fields.length > 0 && (
            <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
              <strong>Active fields ({config.target_fields.length}):</strong>{' '}
              {config.target_fields.map((f) => f.replace(/_/g, ' ')).join(', ')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Handoff Message */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-emerald-500" />
            Handoff Message
          </CardTitle>
          <CardDescription>
            Sent to the lead automatically once all target fields are collected.
            A human agent will take over from this point.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={config.handoff_message}
            onChange={(e) => setConfig((prev) => ({ ...prev, handoff_message: e.target.value }))}
            placeholder={DEFAULT_HANDOFF}
            rows={3}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground mt-2">
            After this message, the AI bot pauses and a staff member can continue the conversation.
          </p>
        </CardContent>
      </Card>

      {/* How it works */}
      <Card className="border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm text-violet-700 dark:text-violet-300">How the AI Flow works</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1.5">
          <p>1. An inbound WhatsApp message arrives from an unregistered contact.</p>
          <p>2. The AI checks if this is a known member — if so, member context is prepended to the conversation.</p>
          <p>3. For new leads, the AI naturally steers the conversation to collect your Target Fields one by one.</p>
          <p>4. Once all fields are collected, the AI creates a Lead record in the CRM automatically.</p>
          <p>5. The Handoff Message is sent and the bot pauses — a staff member takes over.</p>
        </CardContent>
      </Card>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending || config.target_fields.length === 0}
        className="w-full"
      >
        <Save className="h-4 w-4 mr-2" />
        {saveMutation.isPending ? 'Saving…' : 'Save AI Flow Configuration'}
      </Button>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Brain, Save, Loader2, Info, Sparkles } from 'lucide-react';

// ─── Constants ────────────────────────────────────────────────────────────────

const AVAILABLE_FIELDS = [
  { id: 'name', label: 'Name', description: 'Full name of the prospect' },
  { id: 'phone', label: 'Phone', description: 'Contact phone number' },
  { id: 'email', label: 'Email', description: 'Email address' },
  { id: 'fitness_goal', label: 'Fitness Goal', description: 'What the prospect wants to achieve' },
  { id: 'expected_start_date', label: 'Expected Start Date', description: 'When they want to begin' },
  { id: 'budget', label: 'Budget', description: 'Monthly budget or price range' },
  { id: 'age', label: 'Age', description: 'Age or date of birth' },
  { id: 'gender', label: 'Gender', description: 'Gender identity' },
  { id: 'health_conditions', label: 'Health Conditions', description: 'Any relevant health concerns' },
  { id: 'referral_source', label: 'Referral Source', description: 'How they heard about the gym' },
];

const DEFAULT_HANDOFF_MESSAGE =
  "Thanks! 🙏 Our team has your details and will reach out to you shortly to get you started on your fitness journey!";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AiFlowConfig {
  target_fields: string[];
  handoff_message: string;
}

const DEFAULT_CONFIG: AiFlowConfig = {
  target_fields: ['name', 'phone', 'fitness_goal'],
  handoff_message: DEFAULT_HANDOFF_MESSAGE,
};

// ─── Component ────────────────────────────────────────────────────────────────

export function AIFlowBuilder() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<AiFlowConfig>(DEFAULT_CONFIG);

  // Load existing config from integration_settings
  const { data: existingRecord, isLoading } = useQuery({
    queryKey: ['ai-flow-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('integration_settings')
        .select('id, config')
        .eq('integration_type', 'ai_flow')
        .eq('provider', 'whatsapp_lead')
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existingRecord?.config) {
      const saved = existingRecord.config as unknown as AiFlowConfig;
      setConfig({
        target_fields: Array.isArray(saved.target_fields) ? saved.target_fields : DEFAULT_CONFIG.target_fields,
        handoff_message: saved.handoff_message || DEFAULT_HANDOFF_MESSAGE,
      });
    }
  }, [existingRecord]);

  const saveConfig = useMutation({
    mutationFn: async () => {
      if (config.target_fields.length === 0) {
        throw new Error('Select at least one field for the AI to collect');
      }
      if (!config.handoff_message.trim()) {
        throw new Error('Handoff message is required');
      }

      const payload = {
        integration_type: 'ai_flow' as const,
        provider: 'whatsapp_lead',
        is_active: true,
        config: config as unknown as Record<string, unknown>,
        branch_id: null,
      };

      if (existingRecord?.id) {
        const { error } = await supabase
          .from('integration_settings')
          .update({ config: config as unknown as Record<string, unknown>, is_active: true })
          .eq('id', existingRecord.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('integration_settings')
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('AI Flow configuration saved!');
      queryClient.invalidateQueries({ queryKey: ['ai-flow-config'] });
    },
    onError: (error: Error) => toast.error(error.message || 'Failed to save configuration'),
  });

  const toggleField = (fieldId: string, checked: boolean) => {
    setConfig((prev) => ({
      ...prev,
      target_fields: checked
        ? [...prev.target_fields, fieldId]
        : prev.target_fields.filter((f) => f !== fieldId),
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-lg bg-violet-500/10">
              <Brain className="h-4 w-4 text-violet-600" />
            </div>
            AI Lead Flow Builder
            <Badge variant="secondary" className="ml-1 text-[10px]">Beta</Badge>
          </CardTitle>
          <CardDescription>
            Configure how the AI autonomously captures lead data during WhatsApp conversations.
            The AI will naturally collect the fields you select, then route the lead to your CRM.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Info banner */}
      <div className="flex gap-2 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20 text-sm text-blue-700 dark:text-blue-400">
        <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
        <span>
          This configuration is used by the WhatsApp AI Auto-Reply system. Make sure
          <strong className="mx-1">AI Auto-Reply</strong> is enabled in the Integrations tab for leads to be captured automatically.
        </span>
      </div>

      {/* Target Fields */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" />
            Target Fields to Collect
          </CardTitle>
          <CardDescription>
            Select the information you want the AI to gather from the prospect naturally through conversation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading configuration…
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AVAILABLE_FIELDS.map((field) => {
                const isChecked = config.target_fields.includes(field.id);
                return (
                  <div
                    key={field.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                      isChecked
                        ? 'border-violet-400/50 bg-violet-500/5'
                        : 'border-border/50 hover:border-border hover:bg-muted/30'
                    }`}
                    onClick={() => toggleField(field.id, !isChecked)}
                  >
                    <Checkbox
                      id={`field-${field.id}`}
                      checked={isChecked}
                      onCheckedChange={(v) => toggleField(field.id, Boolean(v))}
                      className="mt-0.5"
                    />
                    <div className="flex-1 min-w-0">
                      <Label
                        htmlFor={`field-${field.id}`}
                        className="text-sm font-medium cursor-pointer"
                      >
                        {field.label}
                        {field.id === 'name' || field.id === 'phone' ? (
                          <Badge variant="outline" className="ml-2 text-[9px] h-4">recommended</Badge>
                        ) : null}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">{field.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {config.target_fields.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              <span className="text-xs text-muted-foreground">Will collect:</span>
              {config.target_fields.map((f) => {
                const field = AVAILABLE_FIELDS.find((x) => x.id === f);
                return field ? (
                  <Badge key={f} variant="secondary" className="text-xs">
                    {field.label}
                  </Badge>
                ) : null;
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Handoff Message */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Handoff Message</CardTitle>
          <CardDescription>
            This message is sent to the user automatically after all target fields are collected.
            It signals that a human will follow up.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          <Textarea
            value={config.handoff_message}
            onChange={(e) => setConfig((prev) => ({ ...prev, handoff_message: e.target.value }))}
            placeholder="E.g. Thanks! Our manager will call you shortly."
            rows={3}
            className="resize-none"
          />
          <p className="text-xs text-muted-foreground">
            After sending this message, the AI bot will be paused for this contact so a staff member can take over.
          </p>
        </CardContent>
      </Card>

      {/* Save Button */}
      <Button
        className="w-full"
        onClick={() => saveConfig.mutate()}
        disabled={saveConfig.isPending || isLoading}
      >
        {saveConfig.isPending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Save className="h-4 w-4 mr-2" />
        )}
        Save AI Flow Configuration
      </Button>
    </div>
  );
}

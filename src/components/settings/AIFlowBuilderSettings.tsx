import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Brain, Save, Loader2, X } from 'lucide-react';

const AVAILABLE_FIELDS = [
  { id: 'name', label: 'Name' },
  { id: 'phone', label: 'Phone' },
  { id: 'email', label: 'Email' },
  { id: 'goal', label: 'Fitness Goal' },
  { id: 'budget', label: 'Budget' },
  { id: 'start_date', label: 'Expected Start Date' },
  { id: 'experience', label: 'Fitness Experience' },
  { id: 'preferred_time', label: 'Preferred Time' },
];

const DEFAULT_HANDOFF = "Thanks for sharing! Our team will reach out to you shortly. 💪";

interface LeadCaptureConfig {
  enabled: boolean;
  target_fields: string[];
  handoff_message: string;
}

export function AIFlowBuilderSettings() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<LeadCaptureConfig>({
    enabled: false,
    target_fields: ['name', 'goal'],
    handoff_message: DEFAULT_HANDOFF,
  });

  const { data: orgSettings, isLoading } = useQuery({
    queryKey: ['org-settings-ai-flow'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_settings')
        .select('id, whatsapp_ai_config')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (orgSettings?.whatsapp_ai_config) {
      const saved = orgSettings.whatsapp_ai_config as any;
      if (saved.lead_capture) {
        setConfig({
          enabled: saved.lead_capture.enabled ?? false,
          target_fields: saved.lead_capture.target_fields ?? ['name', 'goal'],
          handoff_message: saved.lead_capture.handoff_message || DEFAULT_HANDOFF,
        });
      }
    }
  }, [orgSettings]);

  const saveConfig = useMutation({
    mutationFn: async () => {
      if (!orgSettings?.id) throw new Error('Organization settings not found');
      const existing = (orgSettings.whatsapp_ai_config as any) || {};
      const updated = { ...existing, lead_capture: config };
      const { error } = await supabase
        .from('organization_settings')
        .update({ whatsapp_ai_config: updated as any })
        .eq('id', orgSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('AI Lead Capture rules saved');
      queryClient.invalidateQueries({ queryKey: ['org-settings-ai-flow'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save'),
  });

  const toggleField = (fieldId: string) => {
    setConfig(prev => ({
      ...prev,
      target_fields: prev.target_fields.includes(fieldId)
        ? prev.target_fields.filter(f => f !== fieldId)
        : [...prev.target_fields, fieldId],
    }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-1.5 rounded-lg bg-indigo-500/10">
            <Brain className="h-4 w-4 text-indigo-600" />
          </div>
          AI Lead Capture Rules
        </CardTitle>
        <CardDescription>
          Configure how the AI chatbot qualifies and captures leads automatically from WhatsApp conversations.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label className="font-semibold">Enable AI Lead Capture</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              When enabled, the AI will naturally collect lead information and auto-create leads in your CRM.
            </p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(v) => setConfig({ ...config, enabled: v })}
          />
        </div>

        <div className="space-y-2">
          <Label className="font-semibold">Target Fields to Collect</Label>
          <p className="text-xs text-muted-foreground">
            Select which information the AI should gather from the prospect during conversation.
          </p>
          <div className="flex flex-wrap gap-2 mt-2">
            {AVAILABLE_FIELDS.map(field => {
              const isSelected = config.target_fields.includes(field.id);
              return (
                <Badge
                  key={field.id}
                  variant={isSelected ? 'default' : 'outline'}
                  className={`cursor-pointer transition-all text-xs px-3 py-1.5 rounded-lg ${
                    isSelected
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'hover:bg-muted'
                  }`}
                  onClick={() => toggleField(field.id)}
                >
                  {field.label}
                  {isSelected && <X className="h-3 w-3 ml-1" />}
                </Badge>
              );
            })}
          </div>
          {config.target_fields.length === 0 && (
            <p className="text-xs text-destructive">Select at least one field for the AI to collect.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="font-semibold">Handoff Message</Label>
          <Textarea
            rows={3}
            value={config.handoff_message}
            onChange={(e) => setConfig({ ...config, handoff_message: e.target.value })}
            placeholder="Message sent after lead is captured..."
            className="text-sm"
          />
          <p className="text-xs text-muted-foreground">
            This message is sent to the user after the AI successfully captures all lead data. The bot is then paused so a human can follow up.
          </p>
        </div>

        <Button
          className="w-full"
          onClick={() => saveConfig.mutate()}
          disabled={saveConfig.isPending || config.target_fields.length === 0}
        >
          {saveConfig.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save Lead Capture Rules
        </Button>
      </CardContent>
    </Card>
  );
}

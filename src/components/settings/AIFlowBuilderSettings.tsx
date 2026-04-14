import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Brain, Save, Loader2, X, Plus, Trash2, Zap, MessageSquare } from 'lucide-react';

const REQUIRED_FIELDS = ['name', 'email'];

const AVAILABLE_FIELDS = [
  { id: 'name', label: 'Name', required: true },
  { id: 'phone', label: 'Phone', required: false },
  { id: 'email', label: 'Email', required: true },
  { id: 'goal', label: 'Fitness Goal', required: false },
  { id: 'budget', label: 'Budget', required: false },
  { id: 'start_date', label: 'Expected Start Date', required: false },
  { id: 'experience', label: 'Fitness Experience', required: false },
  { id: 'preferred_time', label: 'Preferred Time', required: false },
];

const DEFAULT_HANDOFF = "Thanks for sharing! Our team will reach out to you shortly. 💪";

interface LeadCaptureConfig {
  enabled: boolean;
  target_fields: string[];
  handoff_message: string;
}

interface FlowRule {
  id: string;
  trigger_keywords: string[];
  action_type: 'send_text' | 'send_template' | 'assign_staff';
  response_text: string;
  template_name?: string;
  is_active: boolean;
}

export function AIFlowBuilderSettings() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<LeadCaptureConfig>({
    enabled: false,
    target_fields: ['name', 'goal'],
    handoff_message: DEFAULT_HANDOFF,
  });
  const [flowRules, setFlowRules] = useState<FlowRule[]>([]);

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
      if (saved.ai_flow_rules && Array.isArray(saved.ai_flow_rules)) {
        setFlowRules(saved.ai_flow_rules);
      }
    }
  }, [orgSettings]);

  const saveConfig = useMutation({
    mutationFn: async () => {
      if (!orgSettings?.id) throw new Error('Organization settings not found');
      const existing = (orgSettings.whatsapp_ai_config as any) || {};
      const updated = { ...existing, lead_capture: config, ai_flow_rules: flowRules };
      const { error } = await supabase
        .from('organization_settings')
        .update({ whatsapp_ai_config: updated as any })
        .eq('id', orgSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('AI Lead Capture & Flow Rules saved');
      queryClient.invalidateQueries({ queryKey: ['org-settings-ai-flow'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save'),
  });

  const toggleField = (fieldId: string) => {
    if (REQUIRED_FIELDS.includes(fieldId) && config.target_fields.includes(fieldId)) return;
    setConfig(prev => ({
      ...prev,
      target_fields: prev.target_fields.includes(fieldId)
        ? prev.target_fields.filter(f => f !== fieldId)
        : [...prev.target_fields, fieldId],
    }));
  };

  const addFlowRule = () => {
    setFlowRules(prev => [...prev, {
      id: crypto.randomUUID(),
      trigger_keywords: [],
      action_type: 'send_text',
      response_text: '',
      is_active: true,
    }]);
  };

  const updateFlowRule = (id: string, updates: Partial<FlowRule>) => {
    setFlowRules(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const removeFlowRule = (id: string) => {
    setFlowRules(prev => prev.filter(r => r.id !== id));
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
    <div className="space-y-6">
      {/* Lead Capture Rules */}
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
                const isRequired = REQUIRED_FIELDS.includes(field.id);
                return (
                  <Badge
                    key={field.id}
                    variant={isSelected ? 'default' : 'outline'}
                    className={`cursor-pointer transition-all text-xs px-3 py-1.5 rounded-lg ${
                      isSelected
                        ? isRequired ? 'bg-indigo-600 text-white cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => toggleField(field.id)}
                  >
                    {field.label}{isRequired ? ' *' : ''}
                    {isSelected && !isRequired && <X className="h-3 w-3 ml-1" />}
                  </Badge>
                );
              })}
            </div>
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
          </div>
        </CardContent>
      </Card>

      {/* AI Flow Rules (Trigger-Response) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="p-1.5 rounded-lg bg-amber-500/10">
              <Zap className="h-4 w-4 text-amber-600" />
            </div>
            AI Flow Rules
          </CardTitle>
          <CardDescription>
            Define keyword triggers that bypass the AI and send specific responses. These rules are checked before the AI processes the message.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {flowRules.map((rule) => (
            <Card key={rule.id} className="bg-muted/30 border-dashed">
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={rule.is_active}
                      onCheckedChange={(v) => updateFlowRule(rule.id, { is_active: v })}
                      className="scale-75"
                    />
                    <span className="text-xs text-muted-foreground">{rule.is_active ? 'Active' : 'Disabled'}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeFlowRule(rule.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Trigger Keywords</Label>
                  <Input
                    placeholder="price, fees, cost (comma-separated)"
                    value={rule.trigger_keywords.join(', ')}
                    onChange={(e) => updateFlowRule(rule.id, {
                      trigger_keywords: e.target.value.split(',').map(k => k.trim()).filter(Boolean)
                    })}
                    className="text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Action</Label>
                    <Select value={rule.action_type} onValueChange={(v: any) => updateFlowRule(rule.id, { action_type: v })}>
                      <SelectTrigger className="text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="send_text">Send Text Reply</SelectItem>
                        <SelectItem value="send_template">Send Template</SelectItem>
                        <SelectItem value="assign_staff">Assign to Staff</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {rule.action_type === 'send_template' && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">Template Name</Label>
                      <Input
                        placeholder="pricing_pdf"
                        value={rule.template_name || ''}
                        onChange={(e) => updateFlowRule(rule.id, { template_name: e.target.value })}
                        className="text-sm"
                      />
                    </div>
                  )}
                </div>
                {rule.action_type !== 'assign_staff' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Response Text</Label>
                    <Textarea
                      rows={2}
                      value={rule.response_text}
                      onChange={(e) => updateFlowRule(rule.id, { response_text: e.target.value })}
                      placeholder="Here are our membership plans..."
                      className="text-sm"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          <Button variant="outline" size="sm" onClick={addFlowRule} className="w-full gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Flow Rule
          </Button>
        </CardContent>
      </Card>

      {/* Save Button */}
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
        Save Lead Capture & Flow Rules
      </Button>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bot, Save, Loader2 } from 'lucide-react';

const DEFAULT_SYSTEM_PROMPT = `You are a friendly gym assistant for our fitness center. Answer questions about:
- Membership plans and pricing
- Gym timings and facilities
- Class schedules and trainers
- Trial sessions and offers

Keep responses short (1-3 sentences), professional, and helpful. If you don't know the answer, suggest they visit the gym or call the front desk.`;

interface AiConfig {
  auto_reply_enabled: boolean;
  system_prompt: string;
  reply_delay_seconds: number;
}

export function WhatsAppAISettings() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<AiConfig>({
    auto_reply_enabled: false,
    system_prompt: DEFAULT_SYSTEM_PROMPT,
    reply_delay_seconds: 3,
  });

  const { data: orgSettings, isLoading } = useQuery({
    queryKey: ['org-settings-ai'],
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
      setConfig({
        auto_reply_enabled: saved.auto_reply_enabled ?? false,
        system_prompt: saved.system_prompt || DEFAULT_SYSTEM_PROMPT,
        reply_delay_seconds: saved.reply_delay_seconds ?? 3,
      });
    }
  }, [orgSettings]);

  const saveConfig = useMutation({
    mutationFn: async () => {
      if (!orgSettings?.id) throw new Error('Organization settings not found');
      const { error } = await supabase
        .from('organization_settings')
        .update({ whatsapp_ai_config: config as any })
        .eq('id', orgSettings.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('AI auto-reply settings saved');
      queryClient.invalidateQueries({ queryKey: ['org-settings-ai'] });
    },
    onError: (err: any) => toast.error(err.message || 'Failed to save'),
  });

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
          <div className="p-1.5 rounded-lg bg-violet-500/10">
            <Bot className="h-4 w-4 text-violet-600" />
          </div>
          AI Auto-Reply
        </CardTitle>
        <CardDescription>
          Automatically reply to incoming WhatsApp messages using AI. The bot uses your gym context to generate helpful responses.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <Label className="font-semibold">Enable AI Auto-Reply</Label>
            <p className="text-xs text-muted-foreground mt-0.5">
              When enabled, the AI will automatically respond to incoming WhatsApp messages.
            </p>
          </div>
          <Switch
            checked={config.auto_reply_enabled}
            onCheckedChange={(v) => setConfig({ ...config, auto_reply_enabled: v })}
          />
        </div>

        <div className="space-y-2">
          <Label className="font-semibold">Reply Delay (seconds)</Label>
          <Input
            type="number"
            min={0}
            max={30}
            value={config.reply_delay_seconds}
            onChange={(e) => setConfig({ ...config, reply_delay_seconds: parseInt(e.target.value) || 0 })}
            className="w-32"
          />
          <p className="text-xs text-muted-foreground">
            Wait this many seconds before sending the AI reply (0-30). A short delay feels more natural.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="font-semibold">AI System Prompt / Gym Context</Label>
          <Textarea
            rows={8}
            value={config.system_prompt}
            onChange={(e) => setConfig({ ...config, system_prompt: e.target.value })}
            placeholder="Describe your gym, services, pricing, and any rules for the AI..."
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            This prompt tells the AI about your gym. Include pricing, timings, facilities, and any specific instructions.
          </p>
        </div>

        <Button
          className="w-full"
          onClick={() => saveConfig.mutate()}
          disabled={saveConfig.isPending}
        >
          {saveConfig.isPending ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Save AI Settings
        </Button>
      </CardContent>
    </Card>
  );
}

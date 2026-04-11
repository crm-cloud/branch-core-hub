import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Separator } from '@/components/ui/separator';
import { toast } from '@/hooks/use-toast';
import { Megaphone, Send, Save, Zap, Clock, Gift, Mail, MessageSquare, Phone, BarChart3, ShieldCheck } from 'lucide-react';

const STAGE_ICONS = [Zap, Clock, Gift];
const STAGE_COLORS = [
  'bg-sky-50 text-sky-600 border-sky-200',
  'bg-amber-50 text-amber-600 border-amber-200',
  'bg-emerald-50 text-emerald-600 border-emerald-200',
];

const CHANNEL_OPTIONS = [
  { id: 'whatsapp', label: 'WhatsApp', icon: MessageSquare, color: 'text-emerald-500' },
  { id: 'sms', label: 'SMS', icon: Phone, color: 'text-sky-500' },
  { id: 'email', label: 'Email', icon: Mail, color: 'text-primary' },
];

export function RetentionCampaignManager() {
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['retention-templates'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('retention_templates')
        .select('*')
        .order('stage_level', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: deliveryStats = {} } = useQuery({
    queryKey: ['retention-delivery-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('retention_nudge_logs')
        .select('stage_level, status');
      if (error) throw error;
      const stats: Record<number, { sent: number; total: number }> = {};
      for (const log of data || []) {
        if (!stats[log.stage_level]) stats[log.stage_level] = { sent: 0, total: 0 };
        stats[log.stage_level].total++;
        if (log.status === 'sent') stats[log.stage_level].sent++;
      }
      return stats;
    },
  });

  const [edits, setEdits] = useState<Record<string, { days_trigger?: number; message_body?: string; is_active?: boolean; channels?: string[] }>>({});
  const [previewName, setPreviewName] = useState('John');

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase
        .from('retention_templates')
        .update(updates)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['retention-templates'] });
      toast({ title: 'Template updated', description: 'Retention stage saved successfully.' });
    },
    onError: (err: any) => {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    },
  });

  const getEditValue = (id: string, field: string, original: any) => {
    return edits[id]?.[field as keyof typeof edits[string]] ?? original;
  };

  const setEdit = (id: string, field: string, value: any) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }));
  };

  const handleChannelToggle = (templateId: string, channel: string, currentChannels: string[]) => {
    const channels = currentChannels.includes(channel)
      ? currentChannels.filter(c => c !== channel)
      : [...currentChannels, channel];
    if (channels.length === 0) return;
    setEdit(templateId, 'channels', channels);
  };

  const handleSave = (template: any) => {
    const changes = edits[template.id];
    if (!changes) return;
    updateMutation.mutate({ id: template.id, updates: changes });
    setEdits(prev => {
      const next = { ...prev };
      delete next[template.id];
      return next;
    });
  };

  const handleTestSend = (template: any, channel: string) => {
    const body = getEditValue(template.id, 'message_body', template.message_body) as string;
    const text = body.replace(/{member_name}/g, 'Test User');
    const encoded = encodeURIComponent(text);

    if (channel === 'whatsapp') {
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    } else if (channel === 'sms') {
      window.open(`sms:?body=${encoded}`, '_blank');
    } else if (channel === 'email') {
      const subject = encodeURIComponent(`Stage ${template.stage_level}: ${template.stage_name}`);
      window.open(`mailto:?subject=${subject}&body=${encoded}`, '_blank');
    }
    toast({ title: 'Test message opened', description: `${channel.charAt(0).toUpperCase() + channel.slice(1)} opened with preview text.` });
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 text-primary p-2.5 rounded-full">
          <Megaphone className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold">Retention Campaign</h2>
          <p className="text-sm text-muted-foreground">
            Configure the 3-stage automated nudge sequence for inactive members.
            Use <code className="bg-muted px-1 rounded text-xs">{'{member_name}'}</code> as a placeholder.
          </p>
        </div>
      </div>

      {/* Cooldown Indicator */}
      <Card className="rounded-2xl border-sky-200 bg-sky-50/50">
        <CardContent className="flex items-center gap-3 py-4">
          <ShieldCheck className="h-5 w-5 text-sky-600 shrink-0" />
          <div>
            <p className="text-sm font-medium text-sky-800">30-Day Cooldown Active</p>
            <p className="text-xs text-sky-600">Each member can only receive each nudge stage once every 30 days. Sequence resets if the member visits the gym.</p>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {templates.map((template: any, idx: number) => {
          const Icon = STAGE_ICONS[idx] || Zap;
          const colorClass = STAGE_COLORS[idx] || STAGE_COLORS[0];
          const hasChanges = !!edits[template.id];
          const isActive = getEditValue(template.id, 'is_active', template.is_active) as boolean;
          const channels = getEditValue(template.id, 'channels', template.channels || ['whatsapp']) as string[];
          const stageStats = (deliveryStats as any)[template.stage_level];
          const messageBody = getEditValue(template.id, 'message_body', template.message_body) as string;

          return (
            <Card key={template.id} className={`rounded-2xl shadow-lg transition-all ${!isActive ? 'opacity-60' : ''}`}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full border ${colorClass}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Stage {template.stage_level}: {template.stage_name}</CardTitle>
                    <p className="text-xs text-muted-foreground">Triggered after member is absent</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {stageStats && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <BarChart3 className="h-3.5 w-3.5" />
                      <span>{stageStats.sent} sent</span>
                    </div>
                  )}
                  <Badge variant={isActive ? 'default' : 'secondary'}>
                    {isActive ? 'Active' : 'Paused'}
                  </Badge>
                  <Switch
                    checked={isActive}
                    onCheckedChange={(v) => setEdit(template.id, 'is_active', v)}
                  />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-3">
                  <Label className="whitespace-nowrap text-sm font-medium">Days absent:</Label>
                  <Input
                    type="number"
                    min={1}
                    max={90}
                    className="w-24"
                    value={getEditValue(template.id, 'days_trigger', template.days_trigger)}
                    onChange={(e) => setEdit(template.id, 'days_trigger', parseInt(e.target.value) || template.days_trigger)}
                  />
                  <span className="text-sm text-muted-foreground">days</span>
                </div>

                {/* Multi-Channel Selector */}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Delivery Channels</Label>
                  <div className="flex flex-wrap gap-3">
                    {CHANNEL_OPTIONS.map(ch => {
                      const ChIcon = ch.icon;
                      const isSelected = channels.includes(ch.id);
                      return (
                        <label
                          key={ch.id}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border cursor-pointer transition-colors ${
                            isSelected ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/30'
                          }`}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleChannelToggle(template.id, ch.id, channels)}
                          />
                          <ChIcon className={`h-4 w-4 ${ch.color}`} />
                          <span className="text-sm font-medium">{ch.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Message Template</Label>
                  <Textarea
                    className="mt-1.5 min-h-[80px]"
                    value={messageBody}
                    onChange={(e) => setEdit(template.id, 'message_body', e.target.value)}
                  />
                </div>

                {/* Preview Panel */}
                <div className="bg-muted/50 rounded-xl p-3 border">
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs font-medium text-muted-foreground">Preview</Label>
                    <Input
                      className="w-32 h-7 text-xs"
                      placeholder="Preview name"
                      value={previewName}
                      onChange={(e) => setPreviewName(e.target.value)}
                    />
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">
                    {messageBody.replace(/{member_name}/g, previewName || 'Member')}
                  </p>
                </div>

                <Separator />

                <div className="flex gap-2 justify-end flex-wrap">
                  {channels.map(ch => {
                    const chOption = CHANNEL_OPTIONS.find(o => o.id === ch);
                    const ChIcon = chOption?.icon || Send;
                    return (
                      <Button
                        key={ch}
                        variant="outline"
                        size="sm"
                        onClick={() => handleTestSend(template, ch)}
                      >
                        <ChIcon className={`h-3.5 w-3.5 mr-1.5 ${chOption?.color || ''}`} />
                        Test {chOption?.label || ch}
                      </Button>
                    );
                  })}
                  <Button
                    size="sm"
                    disabled={!hasChanges || updateMutation.isPending}
                    onClick={() => handleSave(template)}
                  >
                    <Save className="h-3.5 w-3.5 mr-1.5" />
                    Save Changes
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {templates.length === 0 && (
        <Card className="rounded-2xl">
          <CardContent className="py-12 text-center text-muted-foreground">
            <Megaphone className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>No retention templates configured yet.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

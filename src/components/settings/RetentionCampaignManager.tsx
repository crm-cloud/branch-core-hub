import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from '@/hooks/use-toast';
import { Megaphone, Send, Save, Zap, Clock, Gift } from 'lucide-react';

const STAGE_ICONS = [Zap, Clock, Gift];
const STAGE_COLORS = [
  'bg-sky-50 text-sky-600 border-sky-200',
  'bg-amber-50 text-amber-600 border-amber-200',
  'bg-emerald-50 text-emerald-600 border-emerald-200',
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

  const [edits, setEdits] = useState<Record<string, { days_trigger?: number; message_body?: string; is_active?: boolean }>>({});

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

  const handleTestSend = (template: any) => {
    const body = getEditValue(template.id, 'message_body', template.message_body) as string;
    const text = body.replace(/{member_name}/g, 'Test User');
    const encoded = encodeURIComponent(text);
    window.open(`https://wa.me/?text=${encoded}`, '_blank');
    toast({ title: 'Test message opened', description: 'WhatsApp opened with preview text.' });
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

      <div className="space-y-4">
        {templates.map((template: any, idx: number) => {
          const Icon = STAGE_ICONS[idx] || Zap;
          const colorClass = STAGE_COLORS[idx] || STAGE_COLORS[0];
          const hasChanges = !!edits[template.id];
          const isActive = getEditValue(template.id, 'is_active', template.is_active) as boolean;

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
                <div>
                  <Label className="text-sm font-medium">Message Template</Label>
                  <Textarea
                    className="mt-1.5 min-h-[80px]"
                    value={getEditValue(template.id, 'message_body', template.message_body)}
                    onChange={(e) => setEdit(template.id, 'message_body', e.target.value)}
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleTestSend(template)}
                  >
                    <Send className="h-3.5 w-3.5 mr-1.5" />
                    Test Send
                  </Button>
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

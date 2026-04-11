import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { Clock } from 'lucide-react';

export function LeadNurtureSettings() {
  const queryClient = useQueryClient();

  const { data: orgSettings, isLoading } = useQuery({
    queryKey: ['org-lead-nurture'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organization_settings')
        .select('id, lead_nurture_config')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const config = orgSettings?.lead_nurture_config as any ?? { enabled: true, delay_hours: 4, max_retries: 2 };
  const [enabled, setEnabled] = useState(config.enabled ?? true);
  const [delayHours, setDelayHours] = useState(String(config.delay_hours ?? 4));
  const [maxRetries, setMaxRetries] = useState(String(config.max_retries ?? 2));

  useEffect(() => {
    if (orgSettings?.lead_nurture_config) {
      const c = orgSettings.lead_nurture_config as any;
      setEnabled(c.enabled ?? true);
      setDelayHours(String(c.delay_hours ?? 4));
      setMaxRetries(String(c.max_retries ?? 2));
    }
  }, [orgSettings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        enabled,
        delay_hours: parseInt(delayHours) || 4,
        max_retries: parseInt(maxRetries) || 2,
      };
      if (orgSettings?.id) {
        const { error } = await supabase
          .from('organization_settings')
          .update({ lead_nurture_config: payload })
          .eq('id', orgSettings.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Lead nurture settings saved');
      queryClient.invalidateQueries({ queryKey: ['org-lead-nurture'] });
    },
    onError: (e: any) => toast.error(e.message || 'Failed to save'),
  });

  if (isLoading) return <Skeleton className="h-40 rounded-2xl" />;

  return (
    <Card className="rounded-2xl shadow-lg shadow-primary/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 rounded-full bg-amber-50">
            <Clock className="h-5 w-5 text-amber-600" />
          </div>
          AI Lead Nurture Follow-up
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Automatically send a gentle follow-up to leads who haven't replied within the configured time window. The AI will nudge them to re-engage.
        </p>
        <div className="flex items-center gap-3">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <Label>{enabled ? 'Enabled' : 'Disabled'}</Label>
        </div>
        <Separator />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Follow-up Delay (hours)</Label>
            <Input
              type="number"
              min="1"
              max="24"
              value={delayHours}
              onChange={e => setDelayHours(e.target.value)}
              placeholder="4"
            />
            <p className="text-xs text-muted-foreground">How long to wait before sending a follow-up</p>
          </div>
          <div className="space-y-2">
            <Label>Max Retries</Label>
            <Input
              type="number"
              min="1"
              max="5"
              value={maxRetries}
              onChange={e => setMaxRetries(e.target.value)}
              placeholder="2"
            />
            <p className="text-xs text-muted-foreground">Maximum number of follow-up attempts within 24 hours</p>
          </div>
        </div>
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving...' : 'Save Nurture Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}

import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranchContext } from '@/contexts/BranchContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  Send, RefreshCw, ChevronDown, ChevronRight,
  CheckCircle, Clock, XCircle, PauseCircle,
} from 'lucide-react';

interface MetaApiTemplate {
  id: string;
  name: string;
  status: string;
  category: string;
  language?: string;
  rejected_reason?: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: any; className: string }> = {
  APPROVED: { label: 'Approved', icon: CheckCircle, className: 'bg-success/10 text-success border-success/20' },
  PENDING: { label: 'Pending', icon: Clock, className: 'bg-warning/10 text-warning border-warning/20' },
  REJECTED: { label: 'Rejected', icon: XCircle, className: 'bg-destructive/10 text-destructive border-destructive/20' },
  PAUSED: { label: 'Paused', icon: PauseCircle, className: 'bg-muted text-muted-foreground border-border' },
  DISABLED: { label: 'Disabled', icon: PauseCircle, className: 'bg-muted text-muted-foreground border-border' },
};

/**
 * Self-contained Meta Approved Templates panel.
 * Reads its own integrations + branch context so it can render anywhere
 * (Settings → Templates Manager hub, Integrations page, etc.).
 */
export function MetaTemplatesPanel() {
  const queryClient = useQueryClient();
  const { selectedBranch, effectiveBranchId } = useBranchContext();
  const [expanded, setExpanded] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [metaApiTemplates, setMetaApiTemplates] = useState<MetaApiTemplate[] | null>(null);
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  // Include both branch-scoped AND global (branch_id IS NULL) integrations.
  const { data: integrations = [] } = useQuery({
    queryKey: ['integrations', 'whatsapp', selectedBranch],
    queryFn: async () => {
      let query = supabase
        .from('integration_settings')
        .select('*')
        .eq('integration_type', 'whatsapp')
        .eq('is_active', true);
      if (selectedBranch !== 'all') {
        query = query.or(`branch_id.eq.${selectedBranch},branch_id.is.null`);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const { data: localTemplates = [], isLoading: loadingLocal } = useQuery({
    queryKey: ['communication-templates', 'whatsapp-meta'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('templates')
        .select('id, name, type, meta_template_name, meta_template_status, meta_rejection_reason')
        .eq('type', 'whatsapp')
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  // Realtime: refresh on any templates table change.
  useEffect(() => {
    const ch = supabase
      .channel('templates-meta-panel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'templates' }, () => {
        queryClient.invalidateQueries({ queryKey: ['communication-templates'] });
        queryClient.invalidateQueries({ queryKey: ['communication-templates', 'whatsapp-meta'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [queryClient]);

  const hasWhatsAppConfig = integrations.length > 0;
  const branchForCall = effectiveBranchId;

  const handleSync = async () => {
    if (!branchForCall) {
      toast.error('No branch available to resolve WhatsApp credentials');
      return;
    }
    setIsSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('manage-whatsapp-templates', {
        body: { action: 'list', branch_id: branchForCall },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const templates: MetaApiTemplate[] = data?.templates || [];
      setMetaApiTemplates(templates);
      setLastSynced(new Date().toLocaleTimeString());
      toast.success(`Synced ${templates.length} template(s) from Meta`);
      queryClient.invalidateQueries({ queryKey: ['communication-templates'] });
      queryClient.invalidateQueries({ queryKey: ['communication-templates', 'whatsapp-meta'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to sync templates from Meta');
    } finally {
      setIsSyncing(false);
    }
  };

  const submittedLocal = localTemplates.filter((t: any) => t.meta_template_name);
  const useMetaList = metaApiTemplates !== null;
  const totalCount = useMetaList ? metaApiTemplates!.length : submittedLocal.length;

  return (
    <Card className="rounded-xl">
      <CardHeader
        className="pb-3 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 text-success" />
            Meta Approved Templates
            {totalCount > 0 && (
              <Badge variant="secondary" className="text-xs">{totalCount}</Badge>
            )}
          </div>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </CardTitle>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4">
          {!hasWhatsAppConfig && (
            <div className="p-3 rounded-lg bg-warning/10 border border-warning/20">
              <p className="text-xs text-warning-foreground">
                Configure a WhatsApp integration in Settings → Integrations before syncing or submitting templates to Meta.
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground flex-1">
              {useMetaList
                ? `${metaApiTemplates!.length} templates registered with Meta.${lastSynced ? ` Last synced: ${lastSynced}.` : ''}`
                : 'Click "Test Connection" to verify your WABA ID, then "Sync" to fetch templates.'}
            </p>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  if (!branchForCall) { toast.error('No branch available'); return; }
                  try {
                    const { data, error } = await supabase.functions.invoke('manage-whatsapp-templates', {
                      body: { action: 'list', branch_id: branchForCall },
                    });
                    if (error) throw error;
                    if (data?.error) {
                      const errStr = String(data.error);
                      if (errStr.includes('does not exist') || errStr.includes('cannot be loaded')) {
                        throw new Error('Meta Error: WABA ID not found. Please verify your WhatsApp Business Account ID in Integration Settings.');
                      }
                      throw new Error(errStr);
                    }
                    toast.success(`Connection successful — found ${data?.templates?.length || 0} templates.`);
                  } catch (err: any) {
                    toast.error(`Connection failed: ${err.message}`);
                  }
                }}
                disabled={!hasWhatsAppConfig || !branchForCall}
                className="gap-1.5"
              >
                <CheckCircle className="h-3.5 w-3.5" />
                Test Connection
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSync}
                disabled={isSyncing || !hasWhatsAppConfig || !branchForCall}
                data-testid="btn-sync-meta-templates"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${isSyncing ? 'animate-spin' : ''}`} />
                {isSyncing ? 'Syncing…' : 'Sync from Meta'}
              </Button>
            </div>
          </div>

          {useMetaList && (
            metaApiTemplates!.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Send className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No templates found in your WABA.</p>
                <p className="text-xs mt-1">Submit a template using the "Submit to Meta" button in CRM Templates.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {metaApiTemplates!.map((mt) => {
                  const cfg = STATUS_CONFIG[mt.status];
                  const Icon = cfg?.icon;
                  return (
                    <div
                      key={mt.id}
                      className="flex items-start justify-between p-3 rounded-lg border bg-card"
                      data-testid={`meta-template-row-${mt.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{mt.name}</p>
                          {cfg && Icon && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
                              <Icon className="h-3 w-3" />
                              {cfg.label}
                            </span>
                          )}
                          <Badge variant="outline" className="text-xs rounded-full capitalize">
                            {mt.category?.toLowerCase().replace('_', ' ')}
                          </Badge>
                          {mt.language && (
                            <span className="text-xs text-muted-foreground font-mono">{mt.language}</span>
                          )}
                        </div>
                        {mt.status === 'REJECTED' && mt.rejected_reason && (
                          <p className="text-xs text-destructive mt-1">
                            <strong>Reason:</strong> {mt.rejected_reason}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {!useMetaList && (
            loadingLocal ? (
              <div className="flex items-center justify-center py-6">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
              </div>
            ) : submittedLocal.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Send className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No templates submitted to Meta yet.</p>
                <p className="text-xs mt-1">
                  Go to <strong>CRM Templates</strong> and click "Submit to Meta" on any WhatsApp template.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {submittedLocal.map((t: any) => {
                  const cfg = t.meta_template_status ? STATUS_CONFIG[t.meta_template_status] : null;
                  const Icon = cfg?.icon;
                  return (
                    <div
                      key={t.id}
                      className="flex items-start p-3 rounded-lg border bg-card"
                      data-testid={`local-meta-template-row-${t.id}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-medium text-sm">{t.name}</p>
                          {cfg && Icon && (
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.className}`}>
                              <Icon className="h-3 w-3" />
                              {cfg.label}
                            </span>
                          )}
                        </div>
                        {t.meta_template_name && (
                          <p className="text-xs text-muted-foreground font-mono mt-0.5">{t.meta_template_name}</p>
                        )}
                        {t.meta_template_status === 'REJECTED' && t.meta_rejection_reason && (
                          <p className="text-xs text-destructive mt-1">
                            <strong>Reason:</strong> {t.meta_rejection_reason}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          <p className="text-xs text-muted-foreground">
            Sync to refresh live statuses. Template deletion must be done in Meta Business Manager.
          </p>
        </CardContent>
      )}
    </Card>
  );
}

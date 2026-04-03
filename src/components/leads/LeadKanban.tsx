import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Phone, MessageSquare, Calendar, ArrowRight, Flame, Sun, Snowflake } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { leadService } from '@/services/leadService';
import { communicationService } from '@/services/communicationService';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { STATUS_CONFIG, LEAD_STATUSES } from './LeadFilters';

interface LeadKanbanProps {
  leads: any[];
  onSelectLead: (lead: any) => void;
  onFollowup: (lead: any) => void;
  onConvert: (lead: any) => void;
}

export function LeadKanban({ leads, onSelectLead, onFollowup, onConvert }: LeadKanbanProps) {
  const queryClient = useQueryClient();

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      leadService.updateLeadStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      toast.success('Status updated');
    },
    onError: () => toast.error('Failed to update status'),
  });

  const handleWhatsApp = (e: React.MouseEvent, phone: string, name: string) => {
    e.stopPropagation();
    communicationService.sendWhatsApp(phone, `Hi ${name}, thanks for your interest!`);
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {LEAD_STATUSES.map(status => {
        const statusLeads = leads.filter((l: any) => l.status === status);
        const cfg = STATUS_CONFIG[status];
        return (
          <div key={status} className="space-y-3">
            <div className="flex items-center justify-between">
              <Badge className={`${cfg.color} rounded-full px-3`}>{cfg.label}</Badge>
              <span className="text-sm font-bold text-muted-foreground">{statusLeads.length}</span>
            </div>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {statusLeads.map((lead: any) => {
                const TempIcon = lead.temperature === 'hot' ? Flame : lead.temperature === 'cold' ? Snowflake : Sun;
                const tempColor = lead.temperature === 'hot' ? 'text-red-500' : lead.temperature === 'cold' ? 'text-blue-500' : 'text-amber-500';
                const isOverdue = lead.next_action_at && new Date(lead.next_action_at) < new Date();

                return (
                  <Card
                    key={lead.id}
                    className={`rounded-xl border-border/50 shadow-sm hover:shadow-md transition-shadow cursor-pointer ${
                      isOverdue ? 'ring-1 ring-destructive/30' : ''
                    }`}
                    onClick={() => onSelectLead(lead)}
                  >
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-start justify-between gap-1">
                        <p className="font-semibold text-sm truncate flex-1">{lead.full_name}</p>
                        <TempIcon className={`h-3.5 w-3.5 shrink-0 ${tempColor}`} />
                      </div>
                      <p className="text-xs text-muted-foreground truncate">{lead.phone || lead.email}</p>

                      {lead.score > 0 && (
                        <div className="flex items-center gap-1.5">
                          <Progress value={lead.score} className="h-1 flex-1" />
                          <span className="text-[10px] text-muted-foreground font-mono">{lead.score}</span>
                        </div>
                      )}

                      {lead.notes && (
                        <p className="text-xs text-muted-foreground/80 italic line-clamp-2 bg-muted/30 rounded px-2 py-1">
                          {lead.notes}
                        </p>
                      )}

                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px]">{lead.source || 'Direct'}</Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {format(new Date(lead.created_at), 'dd MMM')}
                        </span>
                      </div>

                      {isOverdue && (
                        <p className="text-[10px] text-destructive font-medium">
                          Overdue: {format(new Date(lead.next_action_at), 'MMM dd')}
                        </p>
                      )}

                      <div className="flex items-center gap-1 pt-1">
                        {lead.phone && (
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => handleWhatsApp(e, lead.phone, lead.full_name)}>
                            <MessageSquare className="h-3 w-3 text-emerald-500" />
                          </Button>
                        )}
                        {lead.phone && (
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); window.open(`tel:${lead.phone}`); }}>
                            <Phone className="h-3 w-3 text-sky-500" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onFollowup(lead); }}>
                          <Calendar className="h-3 w-3" />
                        </Button>
                        {lead.status !== 'converted' && (
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); onConvert(lead); }}>
                            <ArrowRight className="h-3 w-3 text-primary" />
                          </Button>
                        )}
                      </div>

                      <Select
                        value={lead.status}
                        onValueChange={(s) => updateStatusMutation.mutate({ id: lead.id, status: s })}
                      >
                        <SelectTrigger className="h-7 text-xs rounded-lg mt-1" onClick={(e) => e.stopPropagation()}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {LEAD_STATUSES.map(s => (
                            <SelectItem key={s} value={s}>{STATUS_CONFIG[s].label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </CardContent>
                  </Card>
                );
              })}
              {statusLeads.length === 0 && (
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed border-border/50 rounded-xl">
                  No leads
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

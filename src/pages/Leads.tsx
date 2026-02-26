import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Plus, UserPlus, Phone, Mail, MessageSquare, Calendar, ArrowRight, History, X } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadService } from '@/services/leadService';
import { communicationService } from '@/services/communicationService';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { AddLeadDrawer } from '@/components/leads/AddLeadDrawer';
import { FollowupDrawer } from '@/components/leads/FollowupDrawer';
import { ConvertMemberDrawer } from '@/components/leads/ConvertMemberDrawer';

export default function LeadsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [showAddDrawer, setShowAddDrawer] = useState(false);
  const [showFollowupDrawer, setShowFollowupDrawer] = useState(false);
  const [showConvertDrawer, setShowConvertDrawer] = useState(false);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => leadService.fetchLeads(),
    enabled: !!user,
  });

  const { data: stats } = useQuery({
    queryKey: ['lead-stats'],
    queryFn: () => leadService.getLeadStats(),
    enabled: !!user,
  });

  const { data: followups = [] } = useQuery({
    queryKey: ['followups', selectedLead?.id],
    queryFn: () => selectedLead ? leadService.fetchFollowups(selectedLead.id) : [],
    enabled: !!selectedLead,
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: any }) =>
      leadService.updateLeadStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      toast.success('Status updated');
    },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      new: 'bg-info/10 text-info',
      contacted: 'bg-warning/10 text-warning',
      interested: 'bg-success/10 text-success',
      converted: 'bg-primary/10 text-primary',
      lost: 'bg-muted text-muted-foreground',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const handleWhatsApp = (phone: string, name: string) => {
    communicationService.sendWhatsApp(phone, `Hi ${name}, thanks for your interest in Incline Fitness! How can we help you today?`);
  };

  const handleSMS = (phone: string, name: string) => {
    communicationService.sendSMS(phone, `Hi ${name}, thanks for your interest in Incline Fitness!`);
  };

  const openFollowup = (lead: any) => {
    setSelectedLead(lead);
    setShowFollowupDrawer(true);
  };

  const openConvert = (lead: any) => {
    setSelectedLead(lead);
    setShowConvertDrawer(true);
  };

  const openHistory = (lead: any) => {
    setSelectedLead(lead);
    setShowHistoryDrawer(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Lead Management</h1>
          <Button onClick={() => setShowAddDrawer(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Lead
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          {[
            { label: 'Total Leads', value: stats?.total || 0, color: 'text-foreground' },
            { label: 'New', value: stats?.new || 0, color: 'text-info' },
            { label: 'Contacted', value: stats?.contacted || 0, color: 'text-warning' },
            { label: 'Interested', value: stats?.interested || 0, color: 'text-success' },
            { label: 'Converted', value: stats?.converted || 0, color: 'text-primary' },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <p className="text-sm text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Lead Sources Breakdown */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Lead Sources</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {(() => {
                const sourceCounts: Record<string, number> = {};
                leads.forEach((lead: any) => {
                  const src = lead.source || 'Direct';
                  sourceCounts[src] = (sourceCounts[src] || 0) + 1;
                });
                return Object.entries(sourceCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([source, count]) => (
                    <Badge key={source} variant="secondary" className="text-sm px-3 py-1.5 capitalize">
                      {source}: <span className="font-bold ml-1">{count}</span>
                    </Badge>
                  ));
              })()}
              {leads.length === 0 && (
                <p className="text-sm text-muted-foreground">No leads yet</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>All Leads</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leads.map((lead: any) => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                            <UserPlus className="h-5 w-5 text-primary" />
                          </div>
                          <div className="font-medium">{lead.full_name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{lead.phone}</div>
                        <div className="text-sm text-muted-foreground">{lead.email}</div>
                      </TableCell>
                      <TableCell>
                        <Select
                          value={lead.status}
                          onValueChange={(status) => updateStatusMutation.mutate({ id: lead.id, status })}
                        >
                          <SelectTrigger className="w-32">
                            <Badge className={getStatusColor(lead.status)}>{lead.status}</Badge>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="new">New</SelectItem>
                            <SelectItem value="contacted">Contacted</SelectItem>
                            <SelectItem value="interested">Interested</SelectItem>
                            <SelectItem value="converted">Converted</SelectItem>
                            <SelectItem value="lost">Lost</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{lead.source || 'Direct'}</Badge>
                      </TableCell>
                      <TableCell>{format(new Date(lead.created_at), 'MMM dd, yyyy')}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" onClick={() => handleWhatsApp(lead.phone, lead.full_name)}>
                            <MessageSquare className="h-4 w-4 text-success" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => window.open(`tel:${lead.phone}`)}>
                            <Phone className="h-4 w-4 text-info" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => handleSMS(lead.phone, lead.full_name)}>
                            <Mail className="h-4 w-4 text-warning" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openFollowup(lead)}>
                            <Calendar className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={() => openHistory(lead)}>
                            <History className="h-4 w-4" />
                          </Button>
                          {lead.status !== 'converted' && (
                            <Button size="sm" variant="outline" onClick={() => openConvert(lead)}>
                              <ArrowRight className="h-4 w-4 mr-1" />
                              Convert
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {leads.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No leads found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Followup History Drawer */}
      <Sheet open={showHistoryDrawer} onOpenChange={setShowHistoryDrawer}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Follow-up History: {selectedLead?.full_name}</SheetTitle>
          </SheetHeader>
          <div className="mt-6">
            {followups.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">No follow-ups recorded yet.</p>
            ) : (
              <div className="space-y-4">
                {followups.map((f: any) => (
                  <div key={f.id} className="border-l-2 border-primary pl-4 py-2">
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(f.followup_date), 'MMM dd, yyyy HH:mm')}
                    </p>
                    <p className="font-medium">{f.outcome || 'No outcome recorded'}</p>
                    <p className="text-sm">{f.notes}</p>
                    {f.next_followup_date && (
                      <p className="text-sm text-info">Next: {format(new Date(f.next_followup_date), 'MMM dd, yyyy')}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <AddLeadDrawer
        open={showAddDrawer}
        onOpenChange={setShowAddDrawer}
        defaultBranchId={leads[0]?.branch_id}
      />
      <FollowupDrawer
        open={showFollowupDrawer}
        onOpenChange={setShowFollowupDrawer}
        lead={selectedLead}
      />
      <ConvertMemberDrawer
        open={showConvertDrawer}
        onOpenChange={setShowConvertDrawer}
        lead={selectedLead}
      />
    </AppLayout>
  );
}

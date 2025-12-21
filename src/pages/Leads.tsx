import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, UserPlus, Phone, Mail, MessageSquare, Calendar, ArrowRight, History } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { leadService } from '@/services/leadService';
import { communicationService } from '@/services/communicationService';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function LeadsPage() {
  const queryClient = useQueryClient();
  const [selectedLead, setSelectedLead] = useState<any>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showFollowupDialog, setShowFollowupDialog] = useState(false);
  const [showConvertDialog, setShowConvertDialog] = useState(false);
  
  const [newLead, setNewLead] = useState({
    full_name: '',
    phone: '',
    email: '',
    source: 'walk_in',
    notes: '',
    branch_id: '',
  });
  
  const [followupData, setFollowupData] = useState({
    notes: '',
    outcome: '',
    next_followup_date: '',
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ['leads'],
    queryFn: () => leadService.fetchLeads(),
  });
  
  const { data: stats } = useQuery({
    queryKey: ['lead-stats'],
    queryFn: () => leadService.getLeadStats(),
  });
  
  const { data: followups = [] } = useQuery({
    queryKey: ['followups', selectedLead?.id],
    queryFn: () => selectedLead ? leadService.fetchFollowups(selectedLead.id) : [],
    enabled: !!selectedLead,
  });

  const createLeadMutation = useMutation({
    mutationFn: (lead: typeof newLead) => leadService.createLead({
      ...lead,
      branch_id: lead.branch_id || leads[0]?.branch_id || '',
      status: 'new',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      setShowAddDialog(false);
      setNewLead({ full_name: '', phone: '', email: '', source: 'walk_in', notes: '', branch_id: '' });
      toast.success('Lead added successfully');
    },
    onError: () => toast.error('Failed to add lead'),
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

  const createFollowupMutation = useMutation({
    mutationFn: () => leadService.createFollowup({
      lead_id: selectedLead.id,
      followup_date: new Date().toISOString(),
      ...followupData,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['followups', selectedLead?.id] });
      setShowFollowupDialog(false);
      setFollowupData({ notes: '', outcome: '', next_followup_date: '' });
      toast.success('Follow-up logged');
    },
  });

  const convertMutation = useMutation({
    mutationFn: () => leadService.convertToMember(selectedLead.id, selectedLead.branch_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] });
      queryClient.invalidateQueries({ queryKey: ['lead-stats'] });
      setShowConvertDialog(false);
      setSelectedLead(null);
      toast.success('Lead converted to member!');
    },
    onError: () => toast.error('Conversion failed'),
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Lead Management</h1>
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Lead
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Lead</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Full Name *</Label>
                  <Input
                    value={newLead.full_name}
                    onChange={(e) => setNewLead({ ...newLead, full_name: e.target.value })}
                    placeholder="Enter full name"
                  />
                </div>
                <div>
                  <Label>Phone *</Label>
                  <Input
                    value={newLead.phone}
                    onChange={(e) => setNewLead({ ...newLead, phone: e.target.value })}
                    placeholder="+91 98765 43210"
                  />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={newLead.email}
                    onChange={(e) => setNewLead({ ...newLead, email: e.target.value })}
                    placeholder="email@example.com"
                  />
                </div>
                <div>
                  <Label>Source</Label>
                  <Select value={newLead.source} onValueChange={(v) => setNewLead({ ...newLead, source: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="walk_in">Walk-in</SelectItem>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="social_media">Social Media</SelectItem>
                      <SelectItem value="advertisement">Advertisement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Notes</Label>
                  <Textarea
                    value={newLead.notes}
                    onChange={(e) => setNewLead({ ...newLead, notes: e.target.value })}
                    placeholder="Any additional notes..."
                  />
                </div>
                <Button 
                  onClick={() => createLeadMutation.mutate(newLead)} 
                  className="w-full"
                  disabled={!newLead.full_name || !newLead.phone}
                >
                  Add Lead
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => { setSelectedLead(lead); setShowFollowupDialog(true); }}
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            onClick={() => setSelectedLead(lead)}
                          >
                            <History className="h-4 w-4" />
                          </Button>
                          {lead.status !== 'converted' && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => { setSelectedLead(lead); setShowConvertDialog(true); }}
                            >
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

        {/* Followup History Sidebar */}
        {selectedLead && !showFollowupDialog && !showConvertDialog && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Follow-up History: {selectedLead.full_name}</CardTitle>
              <Button variant="ghost" onClick={() => setSelectedLead(null)}>Close</Button>
            </CardHeader>
            <CardContent>
              {followups.length === 0 ? (
                <p className="text-muted-foreground">No follow-ups recorded yet.</p>
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
            </CardContent>
          </Card>
        )}

        {/* Add Followup Dialog */}
        <Dialog open={showFollowupDialog} onOpenChange={setShowFollowupDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Follow-up: {selectedLead?.full_name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Outcome</Label>
                <Select value={followupData.outcome} onValueChange={(v) => setFollowupData({ ...followupData, outcome: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="called">Called - No Answer</SelectItem>
                    <SelectItem value="spoke">Spoke - Interested</SelectItem>
                    <SelectItem value="spoke_later">Spoke - Call Back Later</SelectItem>
                    <SelectItem value="visited">Visited Gym</SelectItem>
                    <SelectItem value="not_interested">Not Interested</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Notes</Label>
                <Textarea
                  value={followupData.notes}
                  onChange={(e) => setFollowupData({ ...followupData, notes: e.target.value })}
                  placeholder="Add notes about this follow-up..."
                />
              </div>
              <div>
                <Label>Next Follow-up Date</Label>
                <Input
                  type="date"
                  value={followupData.next_followup_date}
                  onChange={(e) => setFollowupData({ ...followupData, next_followup_date: e.target.value })}
                />
              </div>
              <Button onClick={() => createFollowupMutation.mutate()} className="w-full">
                Save Follow-up
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Convert to Member Dialog */}
        <Dialog open={showConvertDialog} onOpenChange={setShowConvertDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convert to Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <p>Are you sure you want to convert <strong>{selectedLead?.full_name}</strong> to a member?</p>
              <p className="text-sm text-muted-foreground">
                This will create a new member profile and mark the lead as converted.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowConvertDialog(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={() => convertMutation.mutate()} className="flex-1">
                  Convert to Member
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

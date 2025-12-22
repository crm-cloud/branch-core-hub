import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BranchSelector } from '@/components/dashboard/BranchSelector';
import { AddMemberDrawer } from '@/components/members/AddMemberDrawer';
import { PurchaseMembershipDrawer } from '@/components/members/PurchaseMembershipDrawer';
import { PurchasePTDrawer } from '@/components/members/PurchasePTDrawer';
import { MemberProfileDrawer } from '@/components/members/MemberProfileDrawer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { 
  Search, Plus, Users, UserCheck, UserX, CreditCard, Dumbbell, 
  Eye, Clock, Building2, AlertTriangle, CheckCircle, MoreHorizontal
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranches } from '@/hooks/useBranches';
import { useState } from 'react';
import { differenceInDays, format } from 'date-fns';

export default function MembersPage() {
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchasePTOpen, setPurchasePTOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const { data: branches = [] } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState<string>('all');

  const branchFilter = selectedBranch !== 'all' ? selectedBranch : undefined;

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', search, branchFilter],
    queryFn: async () => {
      let query = supabase
        .from('members')
        .select(`
          *,
          profiles:user_id(full_name, email, phone, avatar_url),
          branch:branch_id(name, code),
          memberships(id, status, start_date, end_date, plan_id, membership_plans(name))
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (branchFilter) {
        query = query.eq('branch_id', branchFilter);
      }

      if (search) {
        query = query.or(`member_code.ilike.%${search}%,profiles.full_name.ilike.%${search}%,profiles.email.ilike.%${search}%,profiles.phone.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  // Filter by member status
  const filteredMembers = statusFilter === 'all' 
    ? members 
    : members.filter((m: any) => m.status === statusFilter);

  const stats = {
    total: members.length,
    active: members.filter((m: any) => m.status === 'active').length,
    inactive: members.filter((m: any) => m.status === 'inactive').length,
    expiringSoon: members.filter((m: any) => {
      const activeMembership = m.memberships?.find((ms: any) => ms.status === 'active');
      if (!activeMembership) return false;
      const daysLeft = differenceInDays(new Date(activeMembership.end_date), new Date());
      return daysLeft > 0 && daysLeft <= 7;
    }).length,
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-success/10 text-success border-success/20',
      inactive: 'bg-muted text-muted-foreground border-muted',
      suspended: 'bg-destructive/10 text-destructive border-destructive/20',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const getMembershipStatusColor = (status: string | null) => {
    if (!status) return 'bg-muted text-muted-foreground';
    const colors: Record<string, string> = {
      active: 'bg-success/10 text-success',
      expired: 'bg-destructive/10 text-destructive',
      frozen: 'bg-warning/10 text-warning',
      cancelled: 'bg-muted text-muted-foreground',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const getDaysLeftColor = (days: number) => {
    if (days <= 0) return 'text-destructive';
    if (days <= 7) return 'text-destructive font-bold';
    if (days <= 30) return 'text-warning';
    return 'text-success';
  };

  const getDaysLeftIcon = (days: number) => {
    if (days <= 0) return <AlertTriangle className="h-3 w-3" />;
    if (days <= 7) return <Clock className="h-3 w-3" />;
    return <CheckCircle className="h-3 w-3" />;
  };

  const getActiveMembership = (memberships: any[]) => {
    if (!memberships || memberships.length === 0) return null;
    return memberships.find((m: any) => m.status === 'active');
  };

  const getDaysRemaining = (membership: any) => {
    if (!membership) return null;
    return differenceInDays(new Date(membership.end_date), new Date());
  };

  const handleViewProfile = (member: any) => {
    setSelectedMember(member);
    setProfileOpen(true);
  };

  const handlePurchaseMembership = (member: any) => {
    setSelectedMember(member);
    setPurchaseOpen(true);
  };

  const handlePurchasePT = (member: any) => {
    setSelectedMember(member);
    setPurchasePTOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Members</h1>
            <p className="text-muted-foreground">Manage your gym members and their memberships</p>
          </div>
          <div className="flex items-center gap-3">
            <BranchSelector
              branches={branches}
              selectedBranch={selectedBranch}
              onBranchChange={setSelectedBranch}
              showAllOption={true}
            />
            <Button onClick={() => setAddMemberOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Member
            </Button>
          </div>
        </div>

        {/* Stats Row - Enhanced Design */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <Card className="relative overflow-hidden border-l-4 border-l-primary hover:shadow-md transition-shadow cursor-pointer" onClick={() => setStatusFilter('all')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Members</p>
                  <p className="text-3xl font-bold text-primary">{stats.total}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
              {statusFilter === 'all' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-primary" />}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-l-4 border-l-success hover:shadow-md transition-shadow cursor-pointer" onClick={() => setStatusFilter('active')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active</p>
                  <p className="text-3xl font-bold text-success">{stats.active}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                  <UserCheck className="h-6 w-6 text-success" />
                </div>
              </div>
              {statusFilter === 'active' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-success" />}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-l-4 border-l-muted-foreground hover:shadow-md transition-shadow cursor-pointer" onClick={() => setStatusFilter('inactive')}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Inactive</p>
                  <p className="text-3xl font-bold">{stats.inactive}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                  <UserX className="h-6 w-6 text-muted-foreground" />
                </div>
              </div>
              {statusFilter === 'inactive' && <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted-foreground" />}
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-l-4 border-l-warning hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Expiring Soon</p>
                  <p className="text-3xl font-bold text-warning">{stats.expiringSoon}</p>
                </div>
                <div className="h-12 w-12 rounded-full bg-warning/10 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Members Table */}
        <Card className="border-border/50">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, phone, or member code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10 h-11 bg-muted/30 border-border/50 focus:bg-background transition-colors"
                />
              </div>
              {statusFilter !== 'all' && (
                <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')}>
                  Clear filter
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/50">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableHead className="font-semibold">Member</TableHead>
                      <TableHead className="font-semibold">Code</TableHead>
                      <TableHead className="font-semibold">Branch</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Membership</TableHead>
                      <TableHead className="font-semibold">Days Left</TableHead>
                      <TableHead className="font-semibold">Joined</TableHead>
                      <TableHead className="font-semibold text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredMembers.map((member: any) => {
                      const activeMembership = getActiveMembership(member.memberships);
                      const daysLeft = getDaysRemaining(activeMembership);
                      
                      return (
                        <TableRow 
                          key={member.id}
                          className="cursor-pointer hover:bg-muted/50 transition-colors group"
                          onClick={() => handleViewProfile(member)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <Avatar className="h-10 w-10 ring-2 ring-background shadow-sm">
                                  <AvatarImage src={member.profiles?.avatar_url} />
                                  <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/10 text-primary font-semibold">
                                    {member.profiles?.full_name?.charAt(0) || 'M'}
                                  </AvatarFallback>
                                </Avatar>
                                {/* Status indicator dot */}
                                <div className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-background ${
                                  member.status === 'active' ? 'bg-success' : member.status === 'suspended' ? 'bg-destructive' : 'bg-muted-foreground'
                                }`} />
                              </div>
                              <div>
                                <div className="font-medium group-hover:text-primary transition-colors">{member.profiles?.full_name || 'N/A'}</div>
                                <div className="text-sm text-muted-foreground">{member.profiles?.phone || member.profiles?.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="px-2 py-1 text-xs rounded bg-muted font-mono">{member.member_code}</code>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <Building2 className="h-3.5 w-3.5" />
                              {member.branch?.name || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={getStatusColor(member.status)}>
                              {member.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {activeMembership ? (
                              <Badge className={getMembershipStatusColor(activeMembership.status)}>
                                {activeMembership.membership_plans?.name || 'Active'}
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground border-dashed">
                                No Plan
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {daysLeft !== null ? (
                              <div className={`flex items-center gap-1.5 ${getDaysLeftColor(daysLeft)}`}>
                                {getDaysLeftIcon(daysLeft)}
                                <span className="font-medium">{daysLeft > 0 ? `${daysLeft}d` : 'Expired'}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">--</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(member.joined_at), 'dd MMM yy')}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleViewProfile(member)}>
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>View Profile</TooltipContent>
                              </Tooltip>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-8 w-8">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handlePurchaseMembership(member)}>
                                    <CreditCard className="h-4 w-4 mr-2" />
                                    {activeMembership ? 'Renew Plan' : 'Add Plan'}
                                  </DropdownMenuItem>
                                  {activeMembership && (
                                    <DropdownMenuItem onClick={() => handlePurchasePT(member)}>
                                      <Dumbbell className="h-4 w-4 mr-2" />
                                      Buy PT Package
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredMembers.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-12">
                          <div className="flex flex-col items-center gap-2 text-muted-foreground">
                            <Users className="h-10 w-10 opacity-30" />
                            <p className="font-medium">No members found</p>
                            <p className="text-sm">Try adjusting your search or filters</p>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Drawers */}
      <AddMemberDrawer 
        open={addMemberOpen} 
        onOpenChange={setAddMemberOpen} 
        branchId={selectedBranch !== 'all' ? selectedBranch : branches[0]?.id || ''} 
      />
      
      {selectedMember && (
        <>
          <MemberProfileDrawer
            open={profileOpen}
            onOpenChange={setProfileOpen}
            member={selectedMember}
            onPurchaseMembership={() => handlePurchaseMembership(selectedMember)}
            onPurchasePT={() => handlePurchasePT(selectedMember)}
          />
          <PurchaseMembershipDrawer
            open={purchaseOpen}
            onOpenChange={setPurchaseOpen}
            memberId={selectedMember.id}
            memberName={selectedMember.profiles?.full_name || 'Member'}
            branchId={selectedMember.branch_id}
          />
          <PurchasePTDrawer
            open={purchasePTOpen}
            onOpenChange={setPurchasePTOpen}
            memberId={selectedMember.id}
            memberName={selectedMember.profiles?.full_name || 'Member'}
            branchId={selectedMember.branch_id}
          />
        </>
      )}
    </AppLayout>
  );
}

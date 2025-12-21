import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard } from '@/components/ui/stat-card';
import { BranchSelector } from '@/components/dashboard/BranchSelector';
import { AddMemberDrawer } from '@/components/members/AddMemberDrawer';
import { PurchaseMembershipDrawer } from '@/components/members/PurchaseMembershipDrawer';
import { PurchasePTDrawer } from '@/components/members/PurchasePTDrawer';
import { MemberProfileDrawer } from '@/components/members/MemberProfileDrawer';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  Search, Plus, Users, UserCheck, UserX, CreditCard, Dumbbell, 
  Eye, Clock, Building2, AlertTriangle, CheckCircle
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

  const stats = {
    total: members.length,
    active: members.filter((m: any) => m.status === 'active').length,
    inactive: members.filter((m: any) => m.status === 'inactive').length,
    suspended: members.filter((m: any) => m.status === 'suspended').length,
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-success/10 text-success',
      inactive: 'bg-muted text-muted-foreground',
      suspended: 'bg-destructive/10 text-destructive',
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <h1 className="text-2xl font-bold">Members</h1>
          <div className="flex items-center gap-3">
            <BranchSelector
              branches={branches}
              selectedBranch={selectedBranch}
              onBranchChange={setSelectedBranch}
              showAllOption={true}
            />
            <Button onClick={() => setAddMemberOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Member
            </Button>
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          <StatCard
            title="Total Members"
            value={stats.total}
            icon={Users}
            variant="default"
          />
          <StatCard
            title="Active"
            value={stats.active}
            icon={UserCheck}
            variant="success"
          />
          <StatCard
            title="Inactive"
            value={stats.inactive}
            icon={UserX}
            variant="default"
          />
          <StatCard
            title="Suspended"
            value={stats.suspended}
            icon={UserX}
            variant="destructive"
          />
        </div>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, phone, or member code..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Branch</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Membership</TableHead>
                      <TableHead>Days Left</TableHead>
                      <TableHead>Joined</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.map((member: any) => {
                      const activeMembership = getActiveMembership(member.memberships);
                      const daysLeft = getDaysRemaining(activeMembership);
                      
                      return (
                        <TableRow 
                          key={member.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => handleViewProfile(member)}
                        >
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={member.profiles?.avatar_url} />
                                <AvatarFallback className="bg-primary/10 text-primary">
                                  {member.profiles?.full_name?.charAt(0) || 'M'}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <div className="font-medium">{member.profiles?.full_name || 'N/A'}</div>
                                <div className="text-sm text-muted-foreground">{member.profiles?.email}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{member.member_code}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              {member.branch?.name || 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(member.status)}>{member.status}</Badge>
                          </TableCell>
                          <TableCell>
                            {activeMembership ? (
                              <div>
                                <Badge className={getMembershipStatusColor(activeMembership.status)}>
                                  {activeMembership.membership_plans?.name || 'Active'}
                                </Badge>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-muted-foreground">
                                No Plan
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {daysLeft !== null ? (
                              <div className={`flex items-center gap-1 ${getDaysLeftColor(daysLeft)}`}>
                                {getDaysLeftIcon(daysLeft)}
                                <span>{daysLeft > 0 ? `${daysLeft}d` : 'Expired'}</span>
                              </div>
                            ) : (
                              <span className="text-muted-foreground">--</span>
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(member.joined_at), 'dd MMM yy')}
                          </TableCell>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center gap-1">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleViewProfile(member)}
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button 
                                size="sm" 
                                variant="ghost"
                                onClick={() => handlePurchaseMembership(member)}
                              >
                                <CreditCard className="h-4 w-4" />
                              </Button>
                              {activeMembership && (
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => handlePurchasePT(member)}
                                >
                                  <Dumbbell className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {members.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          No members found
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
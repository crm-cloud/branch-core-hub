import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard } from '@/components/ui/stat-card';
import { BranchSelector } from '@/components/dashboard/BranchSelector';
import { AddMemberDrawer } from '@/components/members/AddMemberDrawer';
import { PurchaseMembershipDrawer } from '@/components/members/PurchaseMembershipDrawer';
import { Search, Plus, User, Users, UserCheck, UserX, CreditCard, Dumbbell } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PurchasePTDrawer } from '@/components/members/PurchasePTDrawer';
import { supabase } from '@/integrations/supabase/client';
import { useBranches } from '@/hooks/useBranches';
import { useState } from 'react';

export default function MembersPage() {
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [purchasePTOpen, setPurchasePTOpen] = useState(false);
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
          memberships(*, membership_plans(*))
        `)
        .order('created_at', { ascending: false })
        .limit(50);

      if (branchFilter) {
        query = query.eq('branch_id', branchFilter);
      }

      if (search) {
        query = query.or(`member_code.ilike.%${search}%`);
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
          <AddMemberDrawer 
            open={addMemberOpen} 
            onOpenChange={setAddMemberOpen} 
            branchId={selectedBranch !== 'all' ? selectedBranch : branches[0]?.id || ''} 
          />
          {selectedMember && (
            <>
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
                  placeholder="Search by member code..."
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Membership</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member: any) => {
                    const activeMembership = member.memberships?.find((m: any) => m.status === 'active');
                    return (
                      <TableRow key={member.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium">{member.profiles?.full_name || 'N/A'}</div>
                              <div className="text-sm text-muted-foreground">{member.profiles?.email}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="font-mono">{member.member_code}</TableCell>
                        <TableCell>
                          <Badge className={getStatusColor(member.status)}>{member.status}</Badge>
                        </TableCell>
                        <TableCell>
                          {activeMembership ? activeMembership.membership_plans?.name : (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => { setSelectedMember(member); setPurchaseOpen(true); }}
                            >
                              <CreditCard className="h-3 w-3 mr-1" />
                              Add Plan
                            </Button>
                          )}
                        </TableCell>
                        <TableCell>{new Date(member.joined_at).toLocaleDateString()}</TableCell>
                        <TableCell>
                          {activeMembership && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => { setSelectedMember(member); setPurchasePTOpen(true); }}
                            >
                              <Dumbbell className="h-3 w-3 mr-1" />
                              Buy PT
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {members.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No members found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

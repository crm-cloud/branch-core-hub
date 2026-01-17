import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatCard } from '@/components/ui/stat-card';
import { Search, Users, Activity, Clock, BarChart3 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { useBenefitBalances, useBenefitUsageHistory } from '@/hooks/useBenefits';
import { BenefitBalancesGrid } from '@/components/benefits/BenefitBalanceCard';
import { RecordBenefitUsageDrawer } from '@/components/benefits/RecordBenefitUsageDrawer';
import { benefitTypeLabels, frequencyLabels } from '@/services/benefitService';
import { format } from 'date-fns';
import type { Database } from '@/integrations/supabase/types';

type BenefitType = Database['public']['Enums']['benefit_type'];

interface MemberSearchResult {
  id: string;
  member_code: string;
  profiles: {
    full_name: string;
    email: string | null;
    phone: string | null;
  } | null;
}

export default function BenefitTracking() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMember, setSelectedMember] = useState<MemberSearchResult | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [preselectedBenefit, setPreselectedBenefit] = useState<BenefitType | undefined>();

  // Search members using the search_members function
  const { data: searchResults, isLoading: isSearching } = useQuery({
    queryKey: ['member-search', searchQuery],
    queryFn: async () => {
      if (searchQuery.length < 2) return [];
      
      // Use the search_members function for comprehensive search
      const { data, error } = await supabase
        .rpc('search_members', {
          search_term: searchQuery.trim(),
          p_branch_id: null,
          p_limit: 10
        });

      if (error) {
        console.error('Search error:', error);
        return [];
      }

      // Transform the result to match expected format
      return (data || [])
        .filter((row: any) => row.is_active) // Only active members
        .map((row: any) => ({
          id: row.id,
          member_code: row.member_code,
          profiles: {
            full_name: row.full_name,
            email: row.email,
            phone: row.phone
          }
        }));
    },
    enabled: searchQuery.length >= 2,
  });

  // Get benefit data for selected member
  const { membership, balances, isLoading: isLoadingBenefits } = useBenefitBalances(selectedMember?.id || '');
  
  // Get usage history
  const { data: usageHistory } = useBenefitUsageHistory(membership?.id || '');

  // Stats
  const totalBenefits = balances.length;
  const exhaustedBenefits = balances.filter(b => !b.isUnlimited && b.remaining === 0).length;
  const todayUsage = usageHistory?.filter(u => u.usage_date === new Date().toISOString().split('T')[0]).length || 0;

  const handleRecordUsage = (benefitType?: BenefitType) => {
    setPreselectedBenefit(benefitType);
    setDrawerOpen(true);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Benefit Tracking</h1>
          <p className="text-muted-foreground">
            Record and track member benefit usage (sauna, ice bath, etc.)
          </p>
        </div>

        {/* Search Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Find Member</CardTitle>
            <CardDescription>
              Search by name, email, phone, or member code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search members..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            {/* Search Results */}
            {searchQuery.length >= 2 && searchResults && searchResults.length > 0 && (
              <div className="mt-3 border rounded-md divide-y">
                {searchResults.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => {
                      setSelectedMember(member);
                      setSearchQuery('');
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="font-medium">
                        {member.profiles?.full_name || member.member_code}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {member.profiles?.email || member.profiles?.phone || member.member_code}
                      </div>
                    </div>
                    <Badge variant="outline">{member.member_code}</Badge>
                  </button>
                ))}
              </div>
            )}

            {searchQuery.length >= 2 && isSearching && (
              <div className="mt-3 text-center text-muted-foreground">Searching...</div>
            )}

            {searchQuery.length >= 2 && !isSearching && searchResults?.length === 0 && (
              <div className="mt-3 text-center text-muted-foreground">No members found</div>
            )}
          </CardContent>
        </Card>

        {/* Selected Member Section */}
        {selectedMember && (
          <>
            {/* Member Header */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Users className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <h2 className="text-xl font-semibold">
                        {selectedMember.profiles?.full_name || selectedMember.member_code}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {selectedMember.member_code} • {selectedMember.profiles?.email}
                      </p>
                    </div>
                  </div>
                  <Button onClick={() => handleRecordUsage()}>
                    Record Usage
                  </Button>
                </div>

                {membership && (
                  <div className="mt-4 p-3 bg-muted rounded-md">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Current Plan:</span>
                      <span className="font-medium">{membership.plan.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm mt-1">
                      <span className="text-muted-foreground">Valid Until:</span>
                      <span className="font-medium">{format(new Date(membership.end_date), 'dd MMM yyyy')}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Stats */}
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard
                title="Total Benefits"
                value={totalBenefits}
                icon={Activity}
              />
              <StatCard
                title="Exhausted"
                value={exhaustedBenefits}
                icon={BarChart3}
                className={exhaustedBenefits > 0 ? 'border-destructive/50' : ''}
              />
              <StatCard
                title="Used Today"
                value={todayUsage}
                icon={Clock}
              />
              <StatCard
                title="Total Usage"
                value={usageHistory?.length || 0}
                icon={Activity}
              />
            </div>

            {/* Tabs for Benefits & History */}
            <Tabs defaultValue="benefits" className="space-y-4">
              <TabsList>
                <TabsTrigger value="benefits">Benefit Balances</TabsTrigger>
                <TabsTrigger value="history">Usage History</TabsTrigger>
              </TabsList>

              <TabsContent value="benefits">
                {isLoadingBenefits ? (
                  <div className="text-center py-8 text-muted-foreground">Loading benefits...</div>
                ) : !membership ? (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground">
                      No active membership found
                    </CardContent>
                  </Card>
                ) : (
                  <BenefitBalancesGrid
                    balances={balances}
                    showRecordButtons
                    onRecordUsage={handleRecordUsage}
                  />
                )}
              </TabsContent>

              <TabsContent value="history">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Usage History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {!usageHistory || usageHistory.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No usage recorded yet
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Benefit</TableHead>
                            <TableHead>Count</TableHead>
                            <TableHead>Recorded By</TableHead>
                            <TableHead>Notes</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {usageHistory.map((usage) => (
                            <TableRow key={usage.id}>
                              <TableCell>
                                {format(new Date(usage.usage_date), 'dd MMM yyyy')}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  {benefitTypeLabels[usage.benefit_type]}
                                </Badge>
                              </TableCell>
                              <TableCell>{usage.usage_count}</TableCell>
                              <TableCell className="text-muted-foreground">
                                {usage.recorded_by_name || 'System'}
                              </TableCell>
                              <TableCell className="text-muted-foreground max-w-[200px] truncate">
                                {usage.notes || '-'}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Record Usage Drawer */}
            {membership && (
              <RecordBenefitUsageDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                membershipId={membership.id}
                memberId={selectedMember.id}
                memberName={selectedMember.profiles?.full_name || selectedMember.member_code}
                availableBenefits={balances}
                preselectedBenefit={preselectedBenefit}
              />
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}

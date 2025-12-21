import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLockers } from '@/hooks/useLockers';
import { useBranches } from '@/hooks/useBranches';
import { Lock, Plus, User, Key, DollarSign, Receipt, Search } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { supabase } from '@/integrations/supabase/client';
import { lockerService } from '@/services/lockerService';
import { toast } from 'sonner';
import { useQuery } from '@tanstack/react-query';

const createLockerSchema = z.object({
  locker_number: z.string().min(1, 'Locker number required'),
  size: z.string().optional(),
  monthly_fee: z.coerce.number().min(0).optional(),
  notes: z.string().optional(),
});

type CreateLockerData = z.infer<typeof createLockerSchema>;

export default function LockersPage() {
  const { data: branches } = useBranches();
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedLocker, setSelectedLocker] = useState<any>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [assignMonths, setAssignMonths] = useState(1);
  const [isAssigning, setIsAssigning] = useState(false);

  const branchId = selectedBranch || branches?.[0]?.id;

  const { lockers, createLocker, releaseLocker, isCreating } = useLockers(branchId);

  const form = useForm<CreateLockerData>({
    resolver: zodResolver(createLockerSchema),
    defaultValues: {
      locker_number: '',
      size: 'medium',
      monthly_fee: 0,
      notes: '',
    },
  });

  const handleMemberSearch = async () => {
    if (!memberSearch.trim() || !branchId) return;
    const { data } = await supabase
      .from('members')
      .select(`
        id,
        member_code,
        user_id,
        profiles:user_id (full_name)
      `)
      .eq('branch_id', branchId)
      .or(`member_code.ilike.%${memberSearch}%`)
      .limit(10);
    setSearchResults(data || []);
  };

  const handleAssignLocker = async () => {
    if (!selectedMember || !selectedLocker || !branchId) return;
    
    setIsAssigning(true);
    try {
      const startDate = new Date().toISOString().split('T')[0];
      const endDate = new Date(Date.now() + assignMonths * 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const feeAmount = (selectedLocker.monthly_fee || 0) * assignMonths;

      // Assign locker
      await lockerService.assignLocker({
        locker_id: selectedLocker.id,
        member_id: selectedMember.id,
        start_date: startDate,
        end_date: endDate,
        fee_amount: feeAmount,
      });

      // Create invoice if fee > 0
      if (feeAmount > 0) {
        await lockerService.createLockerInvoice(
          selectedMember.id,
          branchId,
          selectedLocker.id,
          selectedLocker.locker_number,
          feeAmount,
          assignMonths
        );
        toast.success(`Locker assigned and invoice of ₹${feeAmount} created`);
      } else {
        toast.success('Locker assigned (free)');
      }

      setIsAssignOpen(false);
      setSelectedLocker(null);
      setSelectedMember(null);
      setSearchResults([]);
      setMemberSearch('');
    } catch (error) {
      toast.error('Failed to assign locker');
    } finally {
      setIsAssigning(false);
    }
  };

  const onCreateSubmit = (data: CreateLockerData) => {
    if (!branchId) return;
    createLocker({
      branch_id: branchId,
      locker_number: data.locker_number,
      size: data.size,
      monthly_fee: data.monthly_fee,
      notes: data.notes,
    });
    setIsCreateOpen(false);
    form.reset();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-success/20 text-success border-success/30';
      case 'occupied':
        return 'bg-accent/20 text-accent border-accent/30';
      case 'maintenance':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'reserved':
        return 'bg-info/20 text-info border-info/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const stats = {
    total: lockers.data?.length || 0,
    available: lockers.data?.filter(l => l.status === 'available').length || 0,
    occupied: lockers.data?.filter(l => l.status === 'assigned').length || 0,
    maintenance: lockers.data?.filter(l => l.status === 'maintenance').length || 0,
  };

  const openAssignDialog = (locker: any) => {
    if (locker.status === 'available') {
      setSelectedLocker(locker);
      setIsAssignOpen(true);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Lock className="w-8 h-8 text-accent" />
              Locker Management
            </h1>
            <p className="text-muted-foreground mt-1">Manage locker assignments and rentals</p>
          </div>

          <div className="flex items-center gap-3">
            {branches && branches.length > 1 && (
              <select
                value={branchId}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="px-3 py-2 border rounded-md bg-background"
              >
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            )}

            <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Locker
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add New Locker</DialogTitle>
                  <DialogDescription>Create a new locker for the branch</DialogDescription>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="locker_number"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Locker Number</FormLabel>
                          <FormControl>
                            <Input placeholder="A-001" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="size"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Size</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select size" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="small">Small</SelectItem>
                              <SelectItem value="medium">Medium</SelectItem>
                              <SelectItem value="large">Large</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="monthly_fee"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Monthly Fee (₹0 for free)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes (Optional)</FormLabel>
                          <FormControl>
                            <Input placeholder="Any notes..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button type="submit" className="w-full" disabled={isCreating}>
                      {isCreating ? 'Creating...' : 'Create Locker'}
                    </Button>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Lockers</CardTitle>
              <Lock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <Key className="h-4 w-4 text-success" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{stats.available}</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Occupied</CardTitle>
              <User className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{stats.occupied}</div>
            </CardContent>
          </Card>
          <Card className="border-border/50">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Maintenance</CardTitle>
              <Lock className="h-4 w-4 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-warning">{stats.maintenance}</div>
            </CardContent>
          </Card>
        </div>

        {/* Locker Grid */}
        <Card className="border-border/50">
          <CardHeader>
            <CardTitle>Locker Overview</CardTitle>
            <CardDescription>Click on an available locker to assign it</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10">
              {lockers.data?.map((locker) => {
                const activeAssignment = locker.locker_assignments?.find(a => a.is_active);
                return (
                  <div
                    key={locker.id}
                    onClick={() => openAssignDialog(locker)}
                    className={`
                      relative p-3 rounded-lg border-2 text-center cursor-pointer
                      transition-all hover:scale-105
                      ${getStatusColor(locker.status)}
                    `}
                    title={activeAssignment ? `Assigned to: ${activeAssignment.members?.member_code}` : 'Click to assign'}
                  >
                    <div className="font-bold text-sm">{locker.locker_number}</div>
                    <div className="text-xs opacity-70 capitalize">{locker.size || 'M'}</div>
                    {locker.monthly_fee && locker.monthly_fee > 0 && (
                      <div className="text-xs mt-1 flex items-center justify-center gap-0.5">
                        ₹{locker.monthly_fee}
                      </div>
                    )}
                    {activeAssignment && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="absolute -top-1 -right-1 w-5 h-5 p-0 rounded-full bg-destructive text-destructive-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          releaseLocker({ assignmentId: activeAssignment.id, lockerId: locker.id });
                        }}
                      >
                        ×
                      </Button>
                    )}
                  </div>
                );
              })}
              {(!lockers.data || lockers.data.length === 0) && (
                <div className="col-span-full text-center text-muted-foreground py-8">
                  No lockers configured. Add your first locker.
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-6 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-success/20 border border-success/30" />
                <span className="text-muted-foreground">Available</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-accent/20 border border-accent/30" />
                <span className="text-muted-foreground">Occupied</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded bg-warning/20 border border-warning/30" />
                <span className="text-muted-foreground">Maintenance</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Assign Locker Dialog */}
        <Dialog open={isAssignOpen} onOpenChange={setIsAssignOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Assign Locker {selectedLocker?.locker_number}</DialogTitle>
              <DialogDescription>
                Assign this locker to a member
                {selectedLocker?.monthly_fee > 0 && ` (₹${selectedLocker.monthly_fee}/month)`}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              {/* Member Search */}
              <div>
                <label className="text-sm font-medium">Search Member</label>
                <div className="flex gap-2 mt-1">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Enter member code"
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleMemberSearch()}
                      className="pl-10"
                    />
                  </div>
                  <Button variant="outline" onClick={handleMemberSearch}>Search</Button>
                </div>
              </div>

              {/* Search Results */}
              {searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((member) => (
                    <div
                      key={member.id}
                      onClick={() => setSelectedMember(member)}
                      className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedMember?.id === member.id ? 'border-accent bg-accent/10' : 'hover:bg-muted/50'
                      }`}
                    >
                      <p className="font-medium">{member.profiles?.full_name || 'Unknown'}</p>
                      <p className="text-sm text-muted-foreground">{member.member_code}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Selected Member */}
              {selectedMember && (
                <div className="p-4 rounded-lg bg-accent/10 border border-accent/30">
                  <p className="font-medium">Selected: {selectedMember.profiles?.full_name}</p>
                  <p className="text-sm text-muted-foreground">{selectedMember.member_code}</p>
                </div>
              )}

              {/* Duration */}
              <div>
                <label className="text-sm font-medium">Duration (Months)</label>
                <Select value={String(assignMonths)} onValueChange={(v) => setAssignMonths(Number(v))}>
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 3, 6, 12].map((m) => (
                      <SelectItem key={m} value={String(m)}>{m} Month{m > 1 ? 's' : ''}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Total Amount */}
              {selectedLocker?.monthly_fee > 0 && (
                <div className="p-4 rounded-lg bg-muted">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Total Amount:</span>
                    <span className="text-xl font-bold">₹{selectedLocker.monthly_fee * assignMonths}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    <Receipt className="w-3 h-3 inline mr-1" />
                    An invoice will be generated automatically
                  </p>
                </div>
              )}

              <Button 
                onClick={handleAssignLocker} 
                className="w-full" 
                disabled={!selectedMember || isAssigning}
              >
                {isAssigning ? 'Assigning...' : 'Assign Locker'}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}

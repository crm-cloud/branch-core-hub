import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useLockers } from '@/hooks/useLockers';
import { useBranchContext } from '@/contexts/BranchContext';
import { Lock, Plus, User, Key, Package, MapPin } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { toast } from 'sonner';
import { BulkCreateLockersDrawer } from '@/components/lockers/BulkCreateLockersDrawer';
import { AssignLockerDrawer } from '@/components/lockers/AssignLockerDrawer';

const createLockerSchema = z.object({
  locker_number: z.string().min(1, 'Locker number required'),
  size: z.string().optional(),
  area: z.string().optional(),
  notes: z.string().optional(),
});

type CreateLockerData = z.infer<typeof createLockerSchema>;

export default function LockersPage() {
  const { effectiveBranchId: branchId } = useBranchContext();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isBulkCreateOpen, setIsBulkCreateOpen] = useState(false);
  const [isAssignOpen, setIsAssignOpen] = useState(false);
  const [selectedLocker, setSelectedLocker] = useState<any>(null);

  const { lockers, createLocker, releaseLocker, isCreating } = useLockers(branchId);

  const form = useForm<CreateLockerData>({
    resolver: zodResolver(createLockerSchema),
    defaultValues: {
      locker_number: '',
      size: 'medium',
      area: '',
      notes: '',
    },
  });

  const onCreateSubmit = (data: CreateLockerData) => {
    if (!branchId) return;
    createLocker({
      branch_id: branchId,
      locker_number: data.locker_number,
      size: data.size,
      notes: data.area ? `Area: ${data.area}${data.notes ? ` | ${data.notes}` : ''}` : data.notes,
    });
    setIsCreateOpen(false);
    form.reset();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'available':
        return 'bg-success/20 text-success border-success/30';
      case 'assigned':
        return 'bg-accent/20 text-accent border-accent/30';
      case 'maintenance':
        return 'bg-warning/20 text-warning border-warning/30';
      case 'reserved':
        return 'bg-info/20 text-info border-info/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getAreaFromNotes = (notes: string | null) => {
    if (!notes) return null;
    const match = notes.match(/^Area:\s*([^|]+)/);
    return match ? match[1].trim() : null;
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
            {/* Branch selector moved to global header */}

            <Button variant="outline" onClick={() => setIsBulkCreateOpen(true)}>
              <Package className="w-4 h-4 mr-2" />
              Bulk Create
            </Button>

            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Locker
            </Button>

            <Sheet open={isCreateOpen} onOpenChange={setIsCreateOpen}>
              <SheetContent>
                <SheetHeader>
                  <SheetTitle>Add New Locker</SheetTitle>
                  <SheetDescription>Create a new locker for the branch</SheetDescription>
                </SheetHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onCreateSubmit)} className="space-y-4 mt-6">
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
                      name="area"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Area / Location</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. Men's Changing Room" {...field} />
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
              </SheetContent>
            </Sheet>
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
                const area = getAreaFromNotes(locker.notes);
                return (
                  <div
                    key={locker.id}
                    onClick={() => openAssignDialog(locker)}
                    className={`
                      relative p-3 rounded-lg border-2 text-center cursor-pointer
                      transition-all hover:scale-105
                      ${getStatusColor(locker.status)}
                    `}
                    title={activeAssignment ? `Assigned to: ${activeAssignment.members?.member_code}` : area ? `Area: ${area}` : 'Click to assign'}
                  >
                    <div className="font-bold text-sm">{locker.locker_number}</div>
                    <div className="text-xs opacity-70 capitalize">{locker.size || 'M'}</div>
                    {area && (
                      <div className="text-xs mt-1 flex items-center justify-center gap-0.5 opacity-70">
                        <MapPin className="h-2.5 w-2.5" />
                        {area.length > 8 ? area.slice(0, 8) + '…' : area}
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

        {/* Assign Locker Drawer */}
        <AssignLockerDrawer
          open={isAssignOpen}
          onOpenChange={setIsAssignOpen}
          locker={selectedLocker}
          branchId={branchId || ''}
        />

        {/* Bulk Create Drawer */}
        <BulkCreateLockersDrawer
          open={isBulkCreateOpen}
          onOpenChange={setIsBulkCreateOpen}
          branchId={branchId || ''}
        />
      </div>
    </AppLayout>
  );
}

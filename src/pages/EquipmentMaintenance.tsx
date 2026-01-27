import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Wrench, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchEquipment, fetchMaintenanceRecords, createMaintenanceRecord, updateEquipmentStatus, getEquipmentStats, getMaintenanceCostsByMonth } from '@/services/equipmentService';
import { useState } from 'react';
import { toast } from 'sonner';

export default function EquipmentMaintenancePage() {
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ['equipment-list'],
    queryFn: () => fetchEquipment(),
  });

  const { data: maintenanceRecords = [] } = useQuery({
    queryKey: ['maintenance-records'],
    queryFn: () => fetchMaintenanceRecords(),
  });

  const { data: stats } = useQuery({
    queryKey: ['equipment-stats'],
    queryFn: () => getEquipmentStats(),
  });

  const { data: monthlyCosts } = useQuery({
    queryKey: ['maintenance-costs'],
    queryFn: () => getMaintenanceCostsByMonth(),
  });

  const createMaintenanceMutation = useMutation({
    mutationFn: createMaintenanceRecord,
    onSuccess: () => {
      toast.success('Maintenance record created');
      queryClient.invalidateQueries({ queryKey: ['maintenance-records'] });
      setMaintenanceDialogOpen(false);
    },
    onError: (error) => {
      toast.error('Failed to create record: ' + error.message);
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: any }) => updateEquipmentStatus(id, status),
    onSuccess: () => {
      toast.success('Status updated');
      queryClient.invalidateQueries({ queryKey: ['equipment-list'] });
      queryClient.invalidateQueries({ queryKey: ['equipment-stats'] });
    },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      operational: 'bg-green-500/10 text-green-500',
      maintenance: 'bg-yellow-500/10 text-yellow-500',
      out_of_order: 'bg-destructive/10 text-destructive',
      retired: 'bg-muted text-muted-foreground',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational': return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'maintenance': return <Wrench className="h-4 w-4 text-yellow-500" />;
      case 'out_of_order': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return null;
    }
  };

  const totalMonthlyCost = monthlyCosts ? Object.values(monthlyCosts).reduce((a, b) => a + b, 0) : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Equipment & Maintenance</h1>
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Add Equipment
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Equipment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Operational</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">{stats?.operational || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">In Maintenance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">{stats?.maintenance || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Out of Order</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats?.outOfOrder || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">YTD Maintenance Cost</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">₹{totalMonthlyCost.toLocaleString()}</div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="equipment">
          <TabsList>
            <TabsTrigger value="equipment">Equipment</TabsTrigger>
            <TabsTrigger value="maintenance">Maintenance Log</TabsTrigger>
          </TabsList>

          <TabsContent value="equipment" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>All Equipment</CardTitle>
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
                        <TableHead>Equipment</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Purchase Price</TableHead>
                        <TableHead>Warranty</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {equipment.map((item: any) => (
                        <TableRow key={item.id}>
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                                {getStatusIcon(item.status)}
                              </div>
                              <div>
                                <div className="font-medium">{item.name}</div>
                                <div className="text-sm text-muted-foreground">{item.brand} {item.model}</div>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{item.category || '-'}</TableCell>
                          <TableCell>{item.location || '-'}</TableCell>
                          <TableCell>₹{(item.purchase_price || 0).toLocaleString()}</TableCell>
                          <TableCell>
                            {item.warranty_expiry ? (
                              new Date(item.warranty_expiry) > new Date() ? (
                                <span className="text-green-500">{new Date(item.warranty_expiry).toLocaleDateString()}</span>
                              ) : (
                                <span className="text-muted-foreground">Expired</span>
                              )
                            ) : '-'}
                          </TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(item.status)}>{item.status.replace('_', ' ')}</Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Select
                                value={item.status}
                                onValueChange={(value) => updateStatusMutation.mutate({ id: item.id, status: value })}
                              >
                                <SelectTrigger className="w-28 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="operational">Operational</SelectItem>
                                  <SelectItem value="maintenance">Maintenance</SelectItem>
                                  <SelectItem value="out_of_order">Out of Order</SelectItem>
                                  <SelectItem value="retired">Retired</SelectItem>
                                </SelectContent>
                              </Select>
                              <Sheet open={maintenanceDialogOpen && selectedEquipment === item.id} onOpenChange={(open) => {
                                setMaintenanceDialogOpen(open);
                                if (open) setSelectedEquipment(item.id);
                              }}>
                                <SheetTrigger asChild>
                                  <Button size="sm" variant="outline">
                                    <Wrench className="h-3 w-3" />
                                  </Button>
                                </SheetTrigger>
                                <SheetContent>
                                  <SheetHeader>
                                    <SheetTitle>Log Maintenance - {item.name}</SheetTitle>
                                  </SheetHeader>
                                  <form
                                    onSubmit={(e) => {
                                      e.preventDefault();
                                      const form = e.target as HTMLFormElement;
                                      const formData = new FormData(form);
                                      createMaintenanceMutation.mutate({
                                        equipmentId: item.id,
                                        maintenanceType: formData.get('maintenanceType') as string,
                                        description: formData.get('description') as string,
                                        scheduledDate: formData.get('scheduledDate') as string,
                                        cost: Number(formData.get('cost')) || undefined,
                                      });
                                    }}
                                    className="space-y-4 mt-6"
                                  >
                                    <div className="space-y-2">
                                      <Label htmlFor="maintenanceType">Maintenance Type</Label>
                                      <Select name="maintenanceType" defaultValue="preventive">
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="preventive">Preventive</SelectItem>
                                          <SelectItem value="corrective">Corrective</SelectItem>
                                          <SelectItem value="inspection">Inspection</SelectItem>
                                          <SelectItem value="repair">Repair</SelectItem>
                                          <SelectItem value="replacement">Replacement</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="space-y-2">
                                      <Label htmlFor="description">Description</Label>
                                      <Textarea name="description" placeholder="Describe the maintenance work..." />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                      <div className="space-y-2">
                                        <Label htmlFor="scheduledDate">Scheduled Date</Label>
                                        <Input type="date" name="scheduledDate" />
                                      </div>
                                      <div className="space-y-2">
                                        <Label htmlFor="cost">Estimated Cost</Label>
                                        <Input type="number" name="cost" placeholder="0" />
                                      </div>
                                    </div>
                                    <Button type="submit" className="w-full" disabled={createMaintenanceMutation.isPending}>
                                      {createMaintenanceMutation.isPending ? 'Saving...' : 'Log Maintenance'}
                                    </Button>
                                  </form>
                                </SheetContent>
                              </Sheet>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {equipment.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            No equipment found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="maintenance" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Maintenance History</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipment</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead>Completed</TableHead>
                      <TableHead>Cost</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {maintenanceRecords.map((record: any) => (
                      <TableRow key={record.id}>
                        <TableCell>
                          <div className="font-medium">{record.equipment?.name}</div>
                          <div className="text-sm text-muted-foreground">{record.equipment?.brand}</div>
                        </TableCell>
                        <TableCell className="capitalize">{record.maintenance_type}</TableCell>
                        <TableCell className="max-w-xs truncate">{record.description || '-'}</TableCell>
                        <TableCell>{record.scheduled_date ? new Date(record.scheduled_date).toLocaleDateString() : '-'}</TableCell>
                        <TableCell>
                          {record.completed_date ? (
                            <Badge className="bg-green-500/10 text-green-500">
                              {new Date(record.completed_date).toLocaleDateString()}
                            </Badge>
                          ) : (
                            <Badge className="bg-yellow-500/10 text-yellow-500">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>₹{(record.cost || 0).toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                    {maintenanceRecords.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                          No maintenance records
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

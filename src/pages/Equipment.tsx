import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Dumbbell, Download, Pencil, Copy } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { AddEquipmentDrawer } from '@/components/equipment/AddEquipmentDrawer';
import { useBranchContext } from '@/contexts/BranchContext';
import { exportToCSV } from '@/lib/csvExport';
import { toast } from 'sonner';

export default function EquipmentPage() {
  const [addDrawerOpen, setAddDrawerOpen] = useState(false);
  const [equipmentToEdit, setEquipmentToEdit] = useState<any | null>(null);
  const { branchFilter, effectiveBranchId } = useBranchContext();
  
  const { data: equipment = [], isLoading } = useQuery({
    queryKey: ['equipment', branchFilter],
    queryFn: async () => {
      let query = supabase
        .from('equipment')
        .select('*')
        .order('name');
      if (branchFilter) query = query.eq('branch_id', branchFilter);
      const { data, error } = await query;
      if (error) throw error;
      return data;
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

  const currentBranchId = effectiveBranchId || '';

  const copyModelNumber = async (item: any) => {
    const modelValue = item.model || item.serial_number;
    if (!modelValue) {
      return;
    }

    try {
      await navigator.clipboard.writeText(modelValue);
      toast.success('Model number copied');
    } catch {
      toast.error('Failed to copy model number');
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Equipment</h1>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
              const rows = equipment.map((e: any) => ({
                Name: e.name,
                Brand: e.brand || '',
                Model: e.model || '',
                'Serial Number': e.serial_number || '',
                Category: e.category || '',
                Status: e.status,
                Location: e.location || '',
                'Purchase Date': e.purchase_date || '',
                'Purchase Price': e.purchase_price || '',
              }));
              exportToCSV(rows, 'equipment');
            }}>
              <Download className="h-4 w-4" /> Export
            </Button>
            <Button onClick={() => setAddDrawerOpen(true)} disabled={!currentBranchId}>
              <Plus className="mr-2 h-4 w-4" />
              Add Equipment
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Equipment</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{equipment.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Operational</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                {equipment.filter((e: any) => e.status === 'operational').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Maintenance</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">
                {equipment.filter((e: any) => e.status === 'maintenance').length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Out of Order</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">
                {equipment.filter((e: any) => e.status === 'out_of_order').length}
              </div>
            </CardContent>
          </Card>
        </div>

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
                    <TableHead>Name</TableHead>
                    <TableHead>Model Number</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Warranty</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {equipment.map((item: any) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                            <Dumbbell className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <div className="font-medium">{item.name}</div>
                            <div className="text-sm text-muted-foreground">{item.brand || '-'}</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{item.model || item.serial_number || '-'}</span>
                          {(item.model || item.serial_number) && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => copyModelNumber(item)}
                              aria-label="Copy model number"
                              title="Copy model number"
                            >
                              <Copy className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{item.category || 'General'}</TableCell>
                      <TableCell>{item.location || '-'}</TableCell>
                      <TableCell>
                        <Badge className={getStatusColor(item.status)}>{item.status.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell>
                        {item.warranty_expiry 
                          ? new Date(item.warranty_expiry).toLocaleDateString()
                          : '-'
                        }
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEquipmentToEdit(item);
                            setAddDrawerOpen(true);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
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
      </div>
      
      <AddEquipmentDrawer
        open={addDrawerOpen}
        onOpenChange={(open) => {
          setAddDrawerOpen(open);
          if (!open) {
            setEquipmentToEdit(null);
          }
        }}
        branchId={currentBranchId}
        equipmentToEdit={equipmentToEdit}
      />
    </AppLayout>
  );
}

import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AddProductDrawer } from '@/components/products/AddProductDrawer';
import { Plus, Package, AlertTriangle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranches } from '@/hooks/useBranches';

export default function InventoryPage() {
  const [addProductOpen, setAddProductOpen] = useState(false);
  const { data: branches = [] } = useBranches();
  const branchId = branches[0]?.id || '';

  const { data: inventory = [], isLoading } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          *,
          products(*)
        `)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const lowStockItems = inventory.filter((item: any) => 
    item.quantity <= (item.min_quantity || 5)
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Inventory</h1>
          <Button onClick={() => setAddProductOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>

        {lowStockItems.length > 0 && (
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2 text-yellow-600">
                <AlertTriangle className="h-4 w-4" />
                Low Stock Alert
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {lowStockItems.length} items are running low on stock
              </p>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>All Products</CardTitle>
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
                    <TableHead>Product</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Min Stock</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {inventory.map((item: any) => {
                    const isLow = item.quantity <= (item.min_quantity || 5);
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded bg-primary/10 flex items-center justify-center">
                              <Package className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <div className="font-medium">{item.products?.name}</div>
                              <div className="text-sm text-muted-foreground">₹{item.products?.price}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{item.products?.category || 'General'}</TableCell>
                        <TableCell className="font-medium">{item.quantity}</TableCell>
                        <TableCell>{item.min_quantity || 5}</TableCell>
                        <TableCell>
                          <Badge className={isLow ? 'bg-yellow-500/10 text-yellow-500' : 'bg-green-500/10 text-green-500'}>
                            {isLow ? 'Low Stock' : 'In Stock'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {inventory.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                        No inventory items found
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AddProductDrawer
        open={addProductOpen}
        onOpenChange={setAddProductOpen}
      />
    </AppLayout>
  );
}

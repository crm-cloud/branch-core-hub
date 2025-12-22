import { useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { AddProductDrawer } from '@/components/products/AddProductDrawer';
import { 
  Plus, 
  Package, 
  AlertTriangle, 
  ShoppingCart,
  TrendingUp,
  Tag,
  Search,
  Filter
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useBranches } from '@/hooks/useBranches';
import { toast } from 'sonner';

export default function InventoryPage() {
  const [addProductOpen, setAddProductOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<string>('all');
  const { data: branches = [] } = useBranches();
  const queryClient = useQueryClient();

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

  // Get unique categories
  const categories = [...new Set(inventory.map((item: any) => item.products?.category).filter(Boolean))];

  // Filter inventory
  const filteredInventory = inventory.filter((item: any) => {
    const productName = item.products?.name || '';
    const matchesSearch = productName.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.products?.category === categoryFilter;
    const isLow = item.quantity <= (item.min_quantity || 5);
    const matchesStock = stockFilter === 'all' || 
      (stockFilter === 'low' && isLow) ||
      (stockFilter === 'in-stock' && !isLow);
    return matchesSearch && matchesCategory && matchesStock;
  });

  // Calculate stats
  const lowStockItems = inventory.filter((item: any) => 
    item.quantity <= (item.min_quantity || 5)
  );
  
  const stats = {
    totalProducts: inventory.length,
    lowStock: lowStockItems.length,
    totalValue: inventory.reduce((sum: number, item: any) => 
      sum + (item.quantity * (item.products?.price || 0)), 0
    ),
    categories: categories.length,
  };

  // Toggle product active status
  const toggleProductStatus = useMutation({
    mutationFn: async ({ productId, isActive }: { productId: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('products')
        .update({ is_active: isActive })
        .eq('id', productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      toast.success('Product status updated');
    },
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Inventory</h1>
            <p className="text-muted-foreground mt-1">Manage products and stock levels</p>
          </div>
          <Button onClick={() => setAddProductOpen(true)} className="bg-accent hover:bg-accent/90">
            <Plus className="mr-2 h-4 w-4" />
            Add Product
          </Button>
        </div>

        {/* Stats Cards - Vuexy Style */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-accent to-accent/80 text-accent-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Total Products</p>
                  <h3 className="text-3xl font-bold mt-1">{stats.totalProducts}</h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Package className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-warning to-warning/80 text-warning-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Low Stock</p>
                  <h3 className="text-3xl font-bold mt-1">{stats.lowStock}</h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-success to-success/80 text-success-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Stock Value</p>
                  <h3 className="text-3xl font-bold mt-1">₹{stats.totalValue.toLocaleString()}</h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-info to-info/80 text-info-foreground">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm opacity-80">Categories</p>
                  <h3 className="text-3xl font-bold mt-1">{stats.categories}</h3>
                </div>
                <div className="h-12 w-12 rounded-full bg-white/20 flex items-center justify-center">
                  <Tag className="h-6 w-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Low Stock Alert */}
        {lowStockItems.length > 0 && (
          <Card className="border-warning/50 bg-warning/5">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-warning/20 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="font-medium text-warning">Low Stock Alert</p>
                <p className="text-sm text-muted-foreground">
                  {lowStockItems.length} product{lowStockItems.length > 1 ? 's are' : ' is'} running low on stock
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  className="pl-10"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={stockFilter} onValueChange={setStockFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Stock Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stock</SelectItem>
                  <SelectItem value="in-stock">In Stock</SelectItem>
                  <SelectItem value="low">Low Stock</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Product List */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Product List</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[300px]">Product</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Price</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead>Min Stock</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Active</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredInventory.map((item: any) => {
                      const isLow = item.quantity <= (item.min_quantity || 5);
                      const isActive = item.products?.is_active !== false;
                      
                      return (
                        <TableRow key={item.id} className="group">
                          <TableCell>
                            <div className="flex items-center gap-3">
                              <div className="h-12 w-12 rounded-lg bg-accent/10 flex items-center justify-center">
                                {item.products?.image_url ? (
                                  <img 
                                    src={item.products.image_url} 
                                    alt={item.products.name}
                                    className="h-10 w-10 object-cover rounded"
                                  />
                                ) : (
                                  <Package className="h-6 w-6 text-accent" />
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{item.products?.name}</p>
                                <p className="text-sm text-muted-foreground">
                                  SKU: {item.products?.sku || 'N/A'}
                                </p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {item.products?.category || 'General'}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-semibold">
                            ₹{(item.products?.price || 0).toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <span className={isLow ? 'text-warning font-semibold' : ''}>
                              {item.quantity}
                            </span>
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {item.min_quantity || 5}
                          </TableCell>
                          <TableCell>
                            <Badge className={`border ${isLow ? 'bg-warning/10 text-warning border-warning/20' : 'bg-success/10 text-success border-success/20'}`}>
                              {isLow ? 'Low Stock' : 'In Stock'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Switch
                              checked={isActive}
                              onCheckedChange={(checked) => {
                                toggleProductStatus.mutate({
                                  productId: item.product_id,
                                  isActive: checked,
                                });
                              }}
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    {filteredInventory.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                          <p>No products found</p>
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

      <AddProductDrawer
        open={addProductOpen}
        onOpenChange={setAddProductOpen}
      />
    </AppLayout>
  );
}

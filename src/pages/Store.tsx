import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingBag, Package, ShoppingCart, DollarSign, TrendingUp, ExternalLink, AlertTriangle, Boxes } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function StorePage() {
  const queryClient = useQueryClient();

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['store-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: orders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['ecommerce-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ecommerce_orders')
        .select(`
          *,
          members(member_code, profiles:user_id(full_name))
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Fetch POS sales
  const { data: posSales = [], isLoading: posLoading } = useQuery({
    queryKey: ['store-pos-sales'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pos_sales')
        .select(`
          *,
          members(member_code, profiles:user_id(full_name)),
          invoices(invoice_number)
        `)
        .order('sale_date', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data;
    },
  });

  // Fetch inventory stats
  const { data: inventoryStats } = useQuery({
    queryKey: ['store-inventory-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          quantity,
          min_quantity,
          products(price, name)
        `);
      
      if (error) throw error;
      
      const totalValue = data?.reduce((sum, i: any) => {
        return sum + ((i.quantity || 0) * (i.products?.price || 0));
      }, 0) || 0;
      
      const lowStockItems = data?.filter((i: any) => (i.quantity || 0) < (i.min_quantity || 10)).length || 0;
      const totalItems = data?.reduce((sum, i: any) => sum + (i.quantity || 0), 0) || 0;
      
      return { totalValue, lowStockItems, totalItems };
    },
  });

  const updateOrderStatus = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'confirmed' | 'returned' }) => {
      const { error } = await supabase
        .from('ecommerce_orders')
        .update({ status })
        .eq('id', orderId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Order status updated');
      queryClient.invalidateQueries({ queryKey: ['ecommerce-orders'] });
    },
    onError: () => {
      toast.error('Failed to update order status');
    },
  });

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-500',
      processing: 'bg-blue-500/10 text-blue-500',
      shipped: 'bg-purple-500/10 text-purple-500',
      delivered: 'bg-green-500/10 text-green-500',
      cancelled: 'bg-destructive/10 text-destructive',
      completed: 'bg-green-500/10 text-green-500',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  // Calculate stats
  const onlineOrdersTotal = orders
    .filter((o: any) => o.status === 'delivered')
    .reduce((sum: number, o: any) => sum + o.total_amount, 0);
  
  const posTotal = posSales.reduce((sum: number, s: any) => sum + s.total_amount, 0);
  const pendingOrders = orders.filter((o: any) => o.status === 'pending').length;
  const todayPosSales = posSales.filter((s: any) => {
    const today = new Date().toISOString().split('T')[0];
    return s.sale_date?.startsWith(today);
  });
  const todayPosTotal = todayPosSales.reduce((sum: number, s: any) => sum + s.total_amount, 0);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Store Management</h1>
          <div className="flex gap-2">
            <Link to="/pos">
              <Button variant="outline">
                <ShoppingCart className="h-4 w-4 mr-2" />
                Open POS
              </Button>
            </Link>
            <Link to="/products">
              <Button variant="outline">
                <Package className="h-4 w-4 mr-2" />
                Manage Products
              </Button>
            </Link>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-5">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Products</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{products.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
                <Boxes className="h-4 w-4" />
                Stock Value
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-500">
                ₹{(inventoryStats?.totalValue || 0).toLocaleString()}
              </div>
              {inventoryStats?.lowStockItems && inventoryStats.lowStockItems > 0 ? (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  {inventoryStats.lowStockItems} low stock
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">{inventoryStats?.totalItems || 0} items in stock</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Today's POS Sales</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">
                ₹{todayPosTotal.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">{todayPosSales.length} transactions</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pending Online Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">
                {pendingOrders}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-500">
                ₹{(onlineOrdersTotal + posTotal).toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">Online + POS combined</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="pos-history">
          <TabsList>
            <TabsTrigger value="pos-history" className="gap-2">
              <ShoppingCart className="h-4 w-4" />
              POS History ({posSales.length})
            </TabsTrigger>
            <TabsTrigger value="online-orders" className="gap-2">
              <ShoppingBag className="h-4 w-4" />
              Online Orders ({orders.length})
            </TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
          </TabsList>
          
          {/* POS History Tab */}
          <TabsContent value="pos-history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>POS Sales History</CardTitle>
              </CardHeader>
              <CardContent>
                {posLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date/Time</TableHead>
                        <TableHead>Invoice</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Payment</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {posSales.map((sale: any) => (
                        <TableRow key={sale.id}>
                          <TableCell>
                            {format(new Date(sale.sale_date), 'dd MMM yyyy HH:mm')}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            {sale.invoices?.invoice_number || '-'}
                          </TableCell>
                          <TableCell>
                            {sale.members?.profiles?.full_name || sale.members?.member_code || 'Walk-in'}
                          </TableCell>
                          <TableCell>{(sale.items as any[])?.length || 0} items</TableCell>
                          <TableCell className="font-medium">₹{sale.total_amount.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="capitalize">{sale.payment_method}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                      {posSales.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            <ShoppingCart className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            No POS sales yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Online Orders Tab */}
          <TabsContent value="online-orders" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Online Orders</CardTitle>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order #</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Items</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order: any) => (
                        <TableRow key={order.id}>
                          <TableCell className="font-mono">{order.order_number}</TableCell>
                          <TableCell>{order.members?.profiles?.full_name || 'Guest'}</TableCell>
                          <TableCell>{(order.items as any[])?.length || 0} items</TableCell>
                          <TableCell className="font-medium">₹{order.total_amount.toLocaleString()}</TableCell>
                          <TableCell>
                            <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                          </TableCell>
                          <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Select
                              value={order.status}
                              onValueChange={(status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled') => updateOrderStatus.mutate({ orderId: order.id, status })}
                            >
                              <SelectTrigger className="w-[120px] h-8">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pending">Pending</SelectItem>
                                <SelectItem value="processing">Processing</SelectItem>
                                <SelectItem value="shipped">Shipped</SelectItem>
                                <SelectItem value="delivered">Delivered</SelectItem>
                                <SelectItem value="cancelled">Cancelled</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                        </TableRow>
                      ))}
                      {orders.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                            <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            No online orders yet
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="products" className="mt-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Available Products</CardTitle>
                <Link to="/products">
                  <Button variant="outline" size="sm">
                    Manage Products
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {productsLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : (
                  <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-4">
                    {products.map((product: any) => (
                      <Card key={product.id} className="overflow-hidden">
                        <div className="aspect-square bg-muted flex items-center justify-center">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="object-cover w-full h-full" />
                          ) : (
                            <Package className="h-12 w-12 text-muted-foreground" />
                          )}
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-medium truncate">{product.name}</h3>
                          <p className="text-sm text-muted-foreground">{product.category || 'General'}</p>
                          <p className="text-lg font-bold mt-2">₹{product.price}</p>
                        </CardContent>
                      </Card>
                    ))}
                    {products.length === 0 && (
                      <div className="col-span-full text-center py-8 text-muted-foreground">
                        No products available
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

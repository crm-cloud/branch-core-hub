import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ShoppingBag, Package, ShoppingCart, ExternalLink, AlertTriangle, Boxes, TrendingUp, DollarSign, CreditCard } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';

export default function StorePage() {

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

  // Fetch member store orders from invoices — improved filter with fallback
  const { data: memberStoreOrders = [], isLoading: ordersLoading } = useQuery({
    queryKey: ['member-store-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          members(member_code, profiles:user_id(full_name)),
          invoice_items(description, quantity, unit_price, total_amount, reference_type)
        `)
        .or('notes.eq.Store purchase by member,notes.ilike.%store%purchase%')
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
        .select(`quantity, min_quantity, products(price, name)`);

      if (error) throw error;

      const totalValue = data?.reduce((sum, i: any) => {
        return sum + ((i.quantity || 0) * (i.products?.price || 0));
      }, 0) || 0;

      const lowStockItems = data?.filter((i: any) => (i.quantity || 0) < (i.min_quantity || 10)).length || 0;
      const totalItems = data?.reduce((sum, i: any) => sum + (i.quantity || 0), 0) || 0;

      return { totalValue, lowStockItems, totalItems };
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
      paid: 'bg-green-500/10 text-green-500',
    };
    return colors[status] || 'bg-muted text-muted-foreground';
  };

  // Calculate stats
  const onlineOrdersTotal = memberStoreOrders
    .filter((o: any) => o.status === 'paid')
    .reduce((sum: number, o: any) => sum + o.total_amount, 0);

  const posTotal = posSales.reduce((sum: number, s: any) => sum + s.total_amount, 0);
  const pendingOrders = memberStoreOrders.filter((o: any) => o.status === 'pending' || o.status === 'partial').length;
  const todayPosSales = posSales.filter((s: any) => {
    const today = new Date().toISOString().split('T')[0];
    return s.sale_date?.startsWith(today);
  });
  const todayPosTotal = todayPosSales.reduce((sum: number, s: any) => sum + s.total_amount, 0);
  const totalRevenue = onlineOrdersTotal + posTotal;

  // Sparkline data from last 7 POS sales
  const sparklineData = posSales.slice(0, 7).reverse().map((s: any) => ({ value: s.total_amount || 0 }));

  // Stock gauge data
  const stockUsed = inventoryStats?.totalItems || 0;
  const stockCapacity = Math.max(stockUsed, 100);
  const stockPercent = stockCapacity > 0 ? Math.round((stockUsed / stockCapacity) * 100) : 0;
  const stockGaugeData = [
    { name: 'Used', value: stockUsed },
    { name: 'Remaining', value: stockCapacity - stockUsed },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-800">Store Management</h1>
            <p className="text-muted-foreground text-sm">POS, products & online store overview</p>
          </div>
          <div className="flex gap-2">
            <Link to="/pos">
              <Button className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-200 hover:shadow-xl">
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

        {/* Hero Card */}
        <div className="bg-gradient-to-r from-violet-600 to-indigo-600 rounded-2xl shadow-lg p-6 text-white">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Store Overview</h2>
              <p className="text-white/70 text-sm mt-1">Today's sales & inventory at a glance</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              <div className="text-center">
                <p className="text-2xl font-bold">{posSales.length}</p>
                <p className="text-white/70 text-xs mt-1">Total Sales</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">{products.length}</p>
                <p className="text-white/70 text-xs mt-1">Products</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">₹{todayPosTotal.toLocaleString()}</p>
                <p className="text-white/70 text-xs mt-1">Today's POS</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold">₹{totalRevenue.toLocaleString()}</p>
                <p className="text-white/70 text-xs mt-1">Total Revenue</p>
              </div>
            </div>
          </div>
        </div>

        {/* Profit / Stock / Low Stock Row */}
        <div className="grid gap-6 md:grid-cols-3">
          {/* Profit Card with sparkline */}
          <Card className="rounded-2xl border-none shadow-lg shadow-indigo-100">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Profit</CardTitle>
                <div className="h-8 w-8 rounded-xl bg-green-50 flex items-center justify-center">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-800">₹{totalRevenue.toLocaleString()}</p>
              <div className="h-[50px] mt-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sparklineData}>
                    <Line type="monotone" dataKey="value" stroke="hsl(142, 71%, 45%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Stock Value with donut */}
          <Card className="rounded-2xl border-none shadow-lg shadow-indigo-100">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Stock Value</CardTitle>
                <div className="h-8 w-8 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Boxes className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-slate-800">₹{(inventoryStats?.totalValue || 0).toLocaleString()}</p>
              <div className="flex items-center gap-3 mt-2">
                <div className="h-[50px] w-[50px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={stockGaugeData} cx="50%" cy="50%" innerRadius={16} outerRadius={24} dataKey="value" startAngle={90} endAngle={-270}>
                        <Cell fill="hsl(217, 91%, 60%)" />
                        <Cell fill="hsl(var(--muted))" />
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">{inventoryStats?.totalItems || 0} items</p>
                  <p className="text-xs text-muted-foreground">in stock</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Low Stock Alert */}
          <Card className="rounded-2xl border-none shadow-lg shadow-indigo-100">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">Low Stock Alert</CardTitle>
                <div className={`h-8 w-8 rounded-xl flex items-center justify-center ${(inventoryStats?.lowStockItems || 0) > 0 ? 'bg-orange-50' : 'bg-green-50'}`}>
                  <AlertTriangle className={`h-4 w-4 ${(inventoryStats?.lowStockItems || 0) > 0 ? 'text-orange-500' : 'text-green-600'}`} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${(inventoryStats?.lowStockItems || 0) > 0 ? 'text-orange-500' : 'text-green-600'}`}>
                {inventoryStats?.lowStockItems || 0}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {(inventoryStats?.lowStockItems || 0) > 0 ? 'Items need restocking' : 'All stock levels are healthy'}
              </p>
              <div className="mt-3 flex gap-3 text-xs">
                <div className="rounded-lg bg-violet-50 px-2.5 py-1.5 font-medium text-violet-600">
                  {pendingOrders} pending orders
                </div>
                <div className="rounded-lg bg-green-50 px-2.5 py-1.5 font-medium text-green-600">
                  {todayPosSales.length} sales today
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Transactions + Tables */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Recent Transactions Timeline */}
          <Card className="rounded-2xl border-none shadow-lg shadow-indigo-100">
            <CardHeader>
              <CardTitle className="text-base font-bold text-slate-800">Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {posSales.slice(0, 8).map((sale: any) => (
                  <div key={sale.id} className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                      <CreditCard className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {sale.members?.profiles?.full_name || sale.members?.member_code || 'Walk-in'}
                      </p>
                      <p className="text-xs text-muted-foreground capitalize">{sale.payment_method}</p>
                    </div>
                    <span className="text-sm font-bold text-green-600">
                      +₹{sale.total_amount?.toLocaleString()}
                    </span>
                  </div>
                ))}
                {posSales.length === 0 && (
                  <p className="text-center text-sm text-muted-foreground py-8">No sales yet</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Main Tables */}
          <div className="lg:col-span-2">
            <Tabs defaultValue="pos-history">
              <TabsList>
                <TabsTrigger value="pos-history" className="gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  POS History ({posSales.length})
                </TabsTrigger>
                <TabsTrigger value="online-orders" className="gap-2">
                  <ShoppingBag className="h-4 w-4" />
                  Store Orders ({memberStoreOrders.length})
                </TabsTrigger>
                <TabsTrigger value="products">Products</TabsTrigger>
              </TabsList>

              <TabsContent value="pos-history" className="mt-4">
                <Card className="rounded-2xl border-none shadow-lg shadow-indigo-100">
                  <CardContent className="pt-6">
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
                              <TableCell>{format(new Date(sale.sale_date), 'dd MMM yyyy HH:mm')}</TableCell>
                              <TableCell className="font-mono text-xs">{sale.invoices?.invoice_number || '-'}</TableCell>
                              <TableCell>{sale.members?.profiles?.full_name || sale.members?.member_code || 'Walk-in'}</TableCell>
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

              <TabsContent value="online-orders" className="mt-4">
                <Card className="rounded-2xl border-none shadow-lg shadow-indigo-100">
                  <CardContent className="pt-6">
                    {ordersLoading ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Invoice #</TableHead>
                            <TableHead>Member</TableHead>
                            <TableHead>Items</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Date</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {memberStoreOrders.map((order: any) => (
                            <TableRow key={order.id}>
                              <TableCell className="font-mono">{order.invoice_number}</TableCell>
                              <TableCell>{order.members?.profiles?.full_name || order.members?.member_code || 'Guest'}</TableCell>
                              <TableCell>{(order.invoice_items as any[])?.length || 0} items</TableCell>
                              <TableCell className="font-medium">₹{order.total_amount.toLocaleString()}</TableCell>
                              <TableCell>
                                <Badge className={getStatusColor(order.status)}>{order.status}</Badge>
                              </TableCell>
                              <TableCell>{format(new Date(order.created_at), 'dd MMM yyyy HH:mm')}</TableCell>
                            </TableRow>
                          ))}
                          {memberStoreOrders.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                No member store orders yet
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
                <Card className="rounded-2xl border-none shadow-lg shadow-indigo-100">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base font-bold text-slate-800">Available Products</CardTitle>
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
                          <Card key={product.id} className="overflow-hidden rounded-xl border-none shadow-md shadow-indigo-50">
                            <div className="aspect-square bg-muted flex items-center justify-center">
                              {product.image_url ? (
                                <img src={product.image_url} alt={product.name} className="object-cover w-full h-full" />
                              ) : (
                                <Package className="h-12 w-12 text-muted-foreground" />
                              )}
                            </div>
                            <CardContent className="p-4">
                              <h3 className="font-medium truncate text-slate-800">{product.name}</h3>
                              <p className="text-sm text-muted-foreground">{product.category || 'General'}</p>
                              <p className="text-lg font-bold mt-2 text-violet-600">₹{product.price}</p>
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
        </div>
      </div>
    </AppLayout>
  );
}

import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Package, Wallet, Search, Receipt, User } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { toast } from 'sonner';
import { createPOSSale, type CartItem } from '@/services/storeService';

export default function POSPage() {
  const queryClient = useQueryClient();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['pos-products', categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*, product_categories(name)')
        .eq('is_active', true)
        .order('name');
      
      if (categoryFilter) {
        query = query.eq('category_id', categoryFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['product-categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ['pos-members', memberSearch],
    queryFn: async () => {
      if (!memberSearch || memberSearch.length < 2) return [];
      const { data, error } = await supabase
        .from('members')
        .select('id, member_code, user_id, profiles:user_id(full_name, phone)')
        .or(`member_code.ilike.%${memberSearch}%`)
        .limit(10);
      if (error) throw error;
      return data;
    },
    enabled: memberSearch.length >= 2,
  });

  const { data: walletBalance = 0 } = useQuery({
    queryKey: ['member-wallet', selectedMember?.id],
    queryFn: async () => {
      if (!selectedMember?.id) return 0;
      const { data, error } = await supabase
        .from('wallets')
        .select('balance')
        .eq('member_id', selectedMember.id)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.balance || 0;
    },
    enabled: !!selectedMember?.id,
  });

  const { data: todaySales = [] } = useQuery({
    queryKey: ['today-pos-sales'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('pos_sales')
        .select('*')
        .gte('sale_date', `${today}T00:00:00`)
        .lte('sale_date', `${today}T23:59:59`)
        .order('sale_date', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      const { data: branch } = await supabase.from('branches').select('id').limit(1).single();
      if (!branch) throw new Error('No branch found');

      // If paying with wallet, check balance
      if (paymentMethod === 'wallet') {
        if (!selectedMember) throw new Error('Please select a member to use wallet payment');
        if (walletBalance < cartTotal) throw new Error('Insufficient wallet balance');

        // Deduct from wallet
        const { error: updateError } = await supabase
          .from('wallets')
          .update({ balance: walletBalance - cartTotal })
          .eq('member_id', selectedMember.id);
        if (updateError) throw updateError;
      }

      const sale = await createPOSSale({
        branchId: branch.id,
        memberId: selectedMember?.id,
        items: cart,
        paymentMethod,
      });

      return sale;
    },
    onSuccess: (sale) => {
      toast.success('Sale completed successfully!');
      setLastSale({ ...sale, items: cart, total: cartTotal, paymentMethod, member: selectedMember });
      setShowInvoice(true);
      setCart([]);
      setSelectedMember(null);
      setPaymentMethod('cash');
      queryClient.invalidateQueries({ queryKey: ['today-pos-sales'] });
      queryClient.invalidateQueries({ queryKey: ['member-wallet'] });
    },
    onError: (error) => {
      toast.error('Failed to complete sale: ' + error.message);
    },
  });

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.product.id === product.id);
      if (existing) {
        return prev.map((item) =>
          item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: Math.max(0, item.quantity + delta) }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => prev.filter((item) => item.product.id !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  const todayTotal = todaySales.reduce((sum: number, sale: any) => sum + sale.total_amount, 0);

  const filteredProducts = products.filter((p: any) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const printInvoice = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice</title>
        <style>
          body { font-family: monospace; padding: 20px; max-width: 300px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
          .item { display: flex; justify-content: space-between; margin: 5px 0; }
          .total { border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; font-weight: bold; }
          .footer { text-align: center; margin-top: 20px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>GYM STORE</h2>
          <p>${new Date().toLocaleString()}</p>
          ${lastSale?.member ? `<p>Member: ${lastSale.member.member_code}</p>` : ''}
        </div>
        ${lastSale?.items?.map((item: any) => `
          <div class="item">
            <span>${item.product.name} x${item.quantity}</span>
            <span>₹${(item.product.price * item.quantity).toLocaleString()}</span>
          </div>
        `).join('')}
        <div class="total">
          <div class="item"><span>TOTAL</span><span>₹${lastSale?.total?.toLocaleString()}</span></div>
          <div class="item"><span>Payment</span><span>${lastSale?.paymentMethod?.toUpperCase()}</span></div>
        </div>
        <div class="footer">
          <p>Thank you for your purchase!</p>
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.onload = () => printWindow.print();
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Point of Sale</h1>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            Today's Sales: ₹{todayTotal.toLocaleString()}
          </Badge>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Products */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search products..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All</SelectItem>
                  {categories.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
                {filteredProducts.map((product: any) => (
                  <Card
                    key={product.id}
                    className="cursor-pointer hover:border-primary transition-colors"
                    onClick={() => addToCart(product)}
                  >
                    <CardContent className="p-4">
                      <div className="aspect-square bg-muted rounded flex items-center justify-center mb-3 overflow-hidden">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="object-cover w-full h-full" />
                        ) : (
                          <Package className="h-8 w-8 text-muted-foreground" />
                        )}
                      </div>
                      <h3 className="font-medium text-sm truncate">{product.name}</h3>
                      <p className="text-lg font-bold text-primary">₹{product.price}</p>
                    </CardContent>
                  </Card>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="col-span-full text-center py-8 text-muted-foreground">
                    No products found
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cart */}
          <div className="space-y-4">
            {/* Member Selection */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer (Optional)
                </CardTitle>
              </CardHeader>
              <CardContent>
                {selectedMember ? (
                  <div className="flex items-center justify-between bg-muted/50 p-2 rounded">
                    <div>
                      <p className="font-medium">{selectedMember.profiles?.full_name || selectedMember.member_code}</p>
                      <p className="text-xs text-muted-foreground">Wallet: ₹{walletBalance.toLocaleString()}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedMember(null)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div>
                    <Input
                      placeholder="Search member by code..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                    />
                    {members.length > 0 && (
                      <div className="mt-2 border rounded divide-y max-h-32 overflow-y-auto">
                        {members.map((m: any) => (
                          <div
                            key={m.id}
                            className="p-2 hover:bg-muted cursor-pointer text-sm"
                            onClick={() => {
                              setSelectedMember(m);
                              setMemberSearch('');
                            }}
                          >
                            {m.profiles?.full_name || m.member_code} ({m.member_code})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Cart ({cart.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {cart.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">Cart is empty</p>
                ) : (
                  <>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {cart.map((item) => (
                        <div key={item.product.id} className="flex items-center justify-between gap-2 p-2 bg-muted/50 rounded">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.product.name}</p>
                            <p className="text-sm text-muted-foreground">₹{item.product.price}</p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQuantity(item.product.id, -1)}>
                              <Minus className="h-3 w-3" />
                            </Button>
                            <span className="w-6 text-center text-sm">{item.quantity}</span>
                            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => updateQuantity(item.product.id, 1)}>
                              <Plus className="h-3 w-3" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => removeFromCart(item.product.id)}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t pt-4 space-y-3">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span>₹{cartTotal.toLocaleString()}</span>
                      </div>

                      <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="cash">💵 Cash</SelectItem>
                          <SelectItem value="card">💳 Card</SelectItem>
                          <SelectItem value="upi">📱 UPI</SelectItem>
                          {selectedMember && (
                            <SelectItem value="wallet" disabled={walletBalance < cartTotal}>
                              👛 Wallet (₹{walletBalance.toLocaleString()})
                            </SelectItem>
                          )}
                        </SelectContent>
                      </Select>

                      <Button 
                        className="w-full" 
                        size="lg"
                        onClick={() => checkoutMutation.mutate()}
                        disabled={checkoutMutation.isPending}
                      >
                        <CreditCard className="mr-2 h-5 w-5" />
                        {checkoutMutation.isPending ? 'Processing...' : 'Complete Sale'}
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Recent Sales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {todaySales.slice(0, 5).map((sale: any) => (
                    <div key={sale.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {new Date(sale.sale_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="font-medium">₹{sale.total_amount}</span>
                    </div>
                  ))}
                  {todaySales.length === 0 && (
                    <p className="text-center py-4 text-muted-foreground text-sm">No sales today</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Invoice Dialog */}
      <Dialog open={showInvoice} onOpenChange={setShowInvoice}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Sale Complete!
            </DialogTitle>
            <DialogDescription>
              Sale ID: {lastSale?.id?.slice(0, 8)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="border rounded p-4 space-y-2">
              {lastSale?.items?.map((item: any) => (
                <div key={item.product.id} className="flex justify-between text-sm">
                  <span>{item.product.name} x{item.quantity}</span>
                  <span>₹{(item.product.price * item.quantity).toLocaleString()}</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold">
                <span>Total</span>
                <span>₹{lastSale?.total?.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Payment Method</span>
                <span className="capitalize">{lastSale?.paymentMethod}</span>
              </div>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowInvoice(false)} className="flex-1">
                Close
              </Button>
              <Button onClick={printInvoice} className="flex-1">
                <Receipt className="h-4 w-4 mr-2" />
                Print Receipt
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}

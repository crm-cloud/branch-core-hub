import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ShoppingCart, Plus, Minus, Trash2, CreditCard, Package, Wallet, Search, Receipt, User, Phone, Mail, UserPlus, FileText } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useState } from 'react';
import { toast } from 'sonner';
import { createPOSSale, type CartItem } from '@/services/storeService';
import { useNavigate } from 'react-router-dom';

export default function POSPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [showInvoice, setShowInvoice] = useState(false);
  const [lastSale, setLastSale] = useState<any>(null);
  const [guestInfo, setGuestInfo] = useState({ name: '', phone: '', email: '' });
  const [showGuestForm, setShowGuestForm] = useState(false);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['pos-products', categoryFilter],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*, product_categories(name), inventory(quantity, min_quantity, branch_id)')
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

  // Enhanced member search - search by code, name, phone, email
  const { data: members = [] } = useQuery({
    queryKey: ['pos-members', memberSearch],
    queryFn: async () => {
      if (!memberSearch || memberSearch.length < 2) return [];
      
      // Use the search_members function for comprehensive search
      const { data, error } = await supabase.rpc('search_members', {
        search_term: memberSearch,
        p_limit: 10
      });
      
      if (error) {
        console.error('Member search error:', error);
        // Fallback to direct query
        const { data: fallbackData, error: fallbackError } = await supabase
          .from('members')
          .select('id, member_code, user_id, profiles:user_id(full_name, phone, email)')
          .or(`member_code.ilike.%${memberSearch}%`)
          .limit(10);
        if (fallbackError) throw fallbackError;
        return fallbackData || [];
      }
      
      return data || [];
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
        .select('*, invoices(invoice_number)')
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
      toast.success('Sale completed successfully! Invoice created.');
      setLastSale({ ...sale, items: cart, total: cartTotal, paymentMethod, member: selectedMember });
      setShowInvoice(true);
      setCart([]);
      setSelectedMember(null);
      setPaymentMethod('cash');
      setGuestInfo({ name: '', phone: '', email: '' });
      setShowGuestForm(false);
      queryClient.invalidateQueries({ queryKey: ['today-pos-sales'] });
      queryClient.invalidateQueries({ queryKey: ['member-wallet'] });
      // Also invalidate invoices and payments so they appear in Finance and Invoices pages
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['finance-income'] });
      queryClient.invalidateQueries({ queryKey: ['pos-sales-income'] });
    },
    onError: (error) => {
      toast.error('Failed to complete sale: ' + error.message);
    },
  });

  const getStock = (product: any): number | null => {
    const inv = product.inventory?.[0];
    if (!inv) return null; // No inventory tracked
    return inv.quantity ?? 0;
  };

  const getMinStock = (product: any): number => {
    return product.inventory?.[0]?.min_quantity ?? 5;
  };

  const addToCart = (product: any) => {
    const stock = getStock(product);
    const existingQty = cart.find((item) => item.product.id === product.id)?.quantity || 0;
    if (stock !== null && existingQty + 1 > stock) {
      toast.error(`Only ${stock} in stock for ${product.name}`);
      return;
    }
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
          .invoice-number { font-size: 12px; color: #666; margin-top: 5px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h2>GYM STORE</h2>
          <p>${new Date().toLocaleString()}</p>
          ${lastSale?.member ? `<p>Member: ${lastSale.member.member_code || lastSale.member.full_name}</p>` : ''}
          ${lastSale?.invoice_id ? `<p class="invoice-number">Invoice: ${lastSale.id?.slice(0, 8)}</p>` : ''}
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

  const getMemberDisplayInfo = (member: any) => {
    // Handle both search_members RPC result and direct query result
    const name = member.full_name || member.profiles?.full_name || member.member_code;
    const phone = member.phone || member.profiles?.phone || '';
    const email = member.email || member.profiles?.email || '';
    return { name, phone, email };
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
              <Select value={categoryFilter || "all"} onValueChange={(val) => setCategoryFilter(val === "all" ? "" : val)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
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
                {filteredProducts.map((product: any) => {
                  const stock = getStock(product);
                  const isOutOfStock = stock !== null && stock <= 0;
                  const isLowStock = stock !== null && stock > 0 && stock < getMinStock(product);

                  return (
                    <Card
                      key={product.id}
                      className={`transition-colors ${isOutOfStock ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-primary'} ${isLowStock ? 'border-warning/50' : ''}`}
                      onClick={() => !isOutOfStock && addToCart(product)}
                    >
                      <CardContent className="p-4 relative">
                        {isOutOfStock && (
                          <Badge variant="destructive" className="absolute top-2 right-2 text-xs">Out of Stock</Badge>
                        )}
                        {isLowStock && (
                          <Badge className="absolute top-2 right-2 text-xs bg-warning text-warning-foreground">Low: {stock}</Badge>
                        )}
                        <div className="aspect-square bg-muted rounded flex items-center justify-center mb-3 overflow-hidden">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} className="object-cover w-full h-full" />
                          ) : (
                            <Package className="h-8 w-8 text-muted-foreground" />
                          )}
                        </div>
                        <h3 className="font-medium text-sm truncate">{product.name}</h3>
                        <div className="flex items-center justify-between">
                          <p className="text-lg font-bold text-primary">₹{product.price}</p>
                          {stock !== null && !isOutOfStock && (
                            <span className="text-xs text-muted-foreground">{stock} left</span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
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
            {/* Enhanced Member Selection */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {selectedMember ? (
                  <div className="bg-muted/50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{getMemberDisplayInfo(selectedMember).name}</p>
                        <div className="flex flex-col text-xs text-muted-foreground mt-1">
                          {getMemberDisplayInfo(selectedMember).phone && (
                            <span className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {getMemberDisplayInfo(selectedMember).phone}
                            </span>
                          )}
                          {getMemberDisplayInfo(selectedMember).email && (
                            <span className="flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {getMemberDisplayInfo(selectedMember).email}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-primary mt-1">Wallet: ₹{walletBalance.toLocaleString()}</p>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => setSelectedMember(null)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ) : showGuestForm ? (
                  <div className="space-y-2">
                    <Input
                      placeholder="Guest Name"
                      value={guestInfo.name}
                      onChange={(e) => setGuestInfo({ ...guestInfo, name: e.target.value })}
                    />
                    <Input
                      placeholder="Phone Number"
                      value={guestInfo.phone}
                      onChange={(e) => setGuestInfo({ ...guestInfo, phone: e.target.value })}
                    />
                    <Input
                      placeholder="Email (optional)"
                      value={guestInfo.email}
                      onChange={(e) => setGuestInfo({ ...guestInfo, email: e.target.value })}
                    />
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="w-full"
                      onClick={() => setShowGuestForm(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Search by code, name, phone, email..."
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        className="pl-9"
                      />
                    </div>
                    {members.length > 0 && (
                      <div className="border rounded divide-y max-h-40 overflow-y-auto">
                        {members.map((m: any) => {
                          const info = getMemberDisplayInfo(m);
                          return (
                            <div
                              key={m.id}
                              className="p-2 hover:bg-muted cursor-pointer"
                              onClick={() => {
                                setSelectedMember(m);
                                setMemberSearch('');
                              }}
                            >
                              <p className="font-medium text-sm">{info.name}</p>
                              <div className="flex gap-3 text-xs text-muted-foreground">
                                {m.member_code && <span>{m.member_code}</span>}
                                {info.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{info.phone}</span>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="w-full text-muted-foreground"
                      onClick={() => setShowGuestForm(true)}
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Walk-in Guest
                    </Button>
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
                    <div key={sale.id} className="flex justify-between items-center text-sm p-2 bg-muted/30 rounded">
                      <div>
                        <span className="text-muted-foreground">
                          {new Date(sale.sale_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {sale.invoices?.invoice_number && (
                          <span className="ml-2 text-xs text-primary font-mono">{sale.invoices.invoice_number}</span>
                        )}
                      </div>
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
              <Receipt className="h-5 w-5 text-green-500" />
              Sale Complete!
            </DialogTitle>
            <DialogDescription>
              Invoice has been created and payment recorded.
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
              <Button variant="outline" onClick={() => navigate('/invoices')} className="flex-1">
                <FileText className="h-4 w-4 mr-2" />
                View Invoices
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

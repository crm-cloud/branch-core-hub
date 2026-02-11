import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useMemberData } from '@/hooks/useMemberData';
import { ShoppingBag, Search, Package, AlertCircle, Loader2, Plus, Minus, ShoppingCart, Check } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface CartItem {
  product: any;
  quantity: number;
}

export default function MemberStore() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { member, isLoading: memberLoading } = useMemberData();
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);

  // Fetch products - don't require inventory (show all active products)
  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['store-products', member?.branch_id],
    enabled: !!member,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          category:product_categories(id, name),
          inventory(quantity, branch_id)
        `)
        .eq('is_active', true);

      if (error) throw error;
      
      // Filter to show inventory for this branch or no inventory data
      return (data || []).map(product => ({
        ...product,
        inventory: product.inventory?.filter((inv: any) => inv.branch_id === member!.branch_id) || []
      }));
    },
  });

  const filteredProducts = products.filter((p: any) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.category?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const addToCart = (product: any) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [...prev, { product, quantity: 1 }];
    });
    toast.success(`${product.name} added to cart`);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev =>
      prev.map(item => {
        if (item.product.id === productId) {
          const newQty = item.quantity + delta;
          return newQty > 0 ? { ...item, quantity: newQty } : item;
        }
        return item;
      }).filter(item => item.quantity > 0)
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  // Checkout mutation - creates invoice for member
  const checkout = useMutation({
    mutationFn: async () => {
      if (!member || cart.length === 0) throw new Error('Cart is empty');
      
      // Let the database trigger generate the invoice number
      
      // Create invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          invoice_number: '',
          member_id: member.id,
          branch_id: member.branch_id,
          subtotal: cartTotal,
          total_amount: cartTotal,
          status: 'pending',
          notes: 'Store purchase by member',
        })
        .select()
        .single();
      
      if (invoiceError) throw invoiceError;
      
      // Create invoice items
      const items = cart.map(item => ({
        invoice_id: invoice.id,
        description: item.product.name,
        quantity: item.quantity,
        unit_price: item.product.price,
        total_amount: item.product.price * item.quantity,
        reference_type: 'product',
        reference_id: item.product.id,
      }));
      
      const { error: itemsError } = await supabase
        .from('invoice_items')
        .insert(items);
      
      if (itemsError) throw itemsError;
      
      return invoice;
    },
    onSuccess: (invoice) => {
      toast.success(`Order placed! Invoice: ${invoice.invoice_number}`);
      setCart([]);
      queryClient.invalidateQueries({ queryKey: ['member-invoices'] });
      queryClient.invalidateQueries({ queryKey: ['my-pending-invoices'] });
      navigate('/my-invoices');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to place order');
    },
  });

  if (memberLoading || productsLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
        </div>
      </AppLayout>
    );
  }

  if (!member) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center min-h-[50vh] gap-4">
          <AlertCircle className="h-12 w-12 text-warning" />
          <h2 className="text-xl font-semibold">No Member Profile Found</h2>
        </div>
      </AppLayout>
    );
  }

  // Helper to determine stock display
  const getStockDisplay = (product: any) => {
    const hasInventory = product.inventory && product.inventory.length > 0;
    const stock = hasInventory ? product.inventory[0].quantity : null;
    
    if (!hasInventory) {
      return { text: 'Available', canAdd: true, stock: null };
    }
    if (stock === 0) {
      return { text: 'Out of Stock', canAdd: false, stock: 0 };
    }
    return { text: `${stock} in stock`, canAdd: true, stock };
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Store</h1>
            <p className="text-muted-foreground">Browse and purchase products</p>
          </div>
          {cartCount > 0 && (
            <Badge variant="default" className="text-lg px-4 py-2">
              <ShoppingCart className="h-5 w-5 mr-2" />
              {cartCount} items • ₹{cartTotal.toLocaleString()}
            </Badge>
          )}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Products Grid */}
          <div className="md:col-span-2">
            {filteredProducts.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No products found</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {filteredProducts.map((product: any) => {
                  const stockInfo = getStockDisplay(product);
                  const cartItem = cart.find(item => item.product.id === product.id);
                  const maxQty = stockInfo.stock ?? 999; // No limit if no inventory tracking

                  return (
                    <Card key={product.id} className="border-border/50">
                      <CardContent className="p-4">
                        <div className="flex gap-4">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              className="w-20 h-20 object-cover rounded-lg"
                            />
                          ) : (
                            <div className="w-20 h-20 bg-muted rounded-lg flex items-center justify-center">
                              <Package className="h-8 w-8 text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1">
                            <h3 className="font-semibold">{product.name}</h3>
                            <p className="text-sm text-muted-foreground">{product.category?.name}</p>
                            <p className="text-lg font-bold text-accent mt-1">₹{product.price}</p>
                            <p className={`text-xs ${stockInfo.canAdd ? 'text-muted-foreground' : 'text-destructive'}`}>
                              {stockInfo.text}
                            </p>
                          </div>
                        </div>
                        <div className="mt-4">
                          {cartItem ? (
                            <div className="flex items-center justify-between">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => updateQuantity(product.id, -1)}
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <span className="font-semibold">{cartItem.quantity}</span>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() => updateQuantity(product.id, 1)}
                                disabled={cartItem.quantity >= maxQty}
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <Button
                              className="w-full"
                              onClick={() => addToCart(product)}
                              disabled={!stockInfo.canAdd}
                            >
                              {stockInfo.canAdd ? 'Add to Cart' : 'Out of Stock'}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart */}
          <div>
            <Card className="border-border/50 sticky top-4">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Your Cart
                </CardTitle>
              </CardHeader>
              <CardContent>
                {cart.length === 0 ? (
                  <div className="text-center py-8">
                    <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                    <p className="text-muted-foreground">Your cart is empty</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={item.product.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{item.product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            ₹{item.product.price} × {item.quantity}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">₹{(item.product.price * item.quantity).toLocaleString()}</p>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => removeFromCart(item.product.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                    <div className="border-t pt-4">
                      <div className="flex justify-between text-lg font-bold">
                        <span>Total</span>
                        <span>₹{cartTotal.toLocaleString()}</span>
                      </div>
                    </div>
                    <Button 
                      className="w-full" 
                      size="lg"
                      onClick={() => checkout.mutate()}
                      disabled={checkout.isPending}
                    >
                      {checkout.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        <>
                          <Check className="h-4 w-4 mr-2" />
                          Place Order
                        </>
                      )}
                    </Button>
                    <p className="text-xs text-center text-muted-foreground">
                      An invoice will be generated. Pay at the front desk.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}

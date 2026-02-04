import { useState, useRef } from 'react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Image as ImageIcon, Loader2 } from 'lucide-react';
import { uploadProductImage, createProduct, updateProduct } from '@/services/productService';

interface AddProductDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: any;
}

export function AddProductDrawer({ open, onOpenChange, product }: AddProductDrawerProps) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = !!product;
  
  const [formData, setFormData] = useState({
    name: product?.name || '',
    description: product?.description || '',
    sku: product?.sku || '',
    price: product?.price || '',
    cost_price: product?.cost_price || '',
    tax_rate: product?.tax_rate || 0,
    category_id: product?.category_id || '',
    branch_id: product?.branch_id || '',
    is_active: product?.is_active ?? true,
    image_url: product?.image_url || '',
    initial_quantity: '',
  });
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState(product?.image_url || '');

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

  const { data: branches = [] } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const { data, error } = await supabase.from('branches').select('id, name');
      if (error) throw error;
      return data;
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image size must be less than 5MB');
      return;
    }

    setUploading(true);
    try {
      const publicUrl = await uploadProductImage(file);
      setFormData({ ...formData, image_url: publicUrl });
      setImagePreview(publicUrl);
      toast.success('Image uploaded successfully');
    } catch (error: any) {
      toast.error('Failed to upload image: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        sku: formData.sku || null,
        price: Number(formData.price),
        cost_price: formData.cost_price ? Number(formData.cost_price) : null,
        tax_rate: formData.tax_rate ? Number(formData.tax_rate) : null,
        category_id: formData.category_id || null,
        branch_id: formData.branch_id || null,
        is_active: formData.is_active,
        image_url: formData.image_url || null,
      };

      if (isEditing) {
        return updateProduct(product.id, payload);
      } else {
        const newProduct = await createProduct(payload as any);
        
        // Create inventory record with initial quantity
        if (formData.initial_quantity && Number(formData.initial_quantity) > 0) {
          const quantity = Number(formData.initial_quantity);
          const branchId = formData.branch_id || branches[0]?.id;
          
          if (branchId) {
            // Create inventory record
            await supabase.from('inventory').insert({
              product_id: newProduct.id,
              branch_id: branchId,
              quantity: quantity,
              min_quantity: 5, // Default low stock threshold
            });
            
            // Record initial stock movement
            await supabase.from('stock_movements').insert({
              product_id: newProduct.id,
              branch_id: branchId,
              movement_type: 'initial',
              quantity: quantity,
              notes: 'Initial stock on product creation',
            });
          }
        }
        
        return newProduct;
      }
    },
    onSuccess: () => {
      toast.success(isEditing ? 'Product updated' : 'Product created with inventory');
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['pos-products'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to save product');
    },
  });

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      sku: '',
      price: '',
      cost_price: '',
      tax_rate: 0,
      category_id: '',
      branch_id: '',
      is_active: true,
      image_url: '',
      initial_quantity: '',
    });
    setImagePreview('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.price) {
      toast.error('Name and price are required');
      return;
    }
    saveMutation.mutate();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{isEditing ? 'Edit Product' : 'Add New Product'}</SheetTitle>
          <SheetDescription>
            {isEditing ? 'Update product details' : 'Add a new product to your inventory'}
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
          {/* Image Upload */}
          <div className="space-y-2">
            <Label>Product Image</Label>
            <div 
              className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Uploading...</p>
                </div>
              ) : imagePreview ? (
                <div className="relative">
                  <img src={imagePreview} alt="Preview" className="max-h-40 mx-auto rounded" />
                  <p className="text-xs text-muted-foreground mt-2">Click to change</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-4">
                  <Upload className="h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">Click to upload image</p>
                  <p className="text-xs text-muted-foreground">PNG, JPG up to 5MB</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="name">Product Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Whey Protein"
                required
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Product description..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sku">SKU</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                placeholder="PRD-001"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select
                value={formData.category_id}
                onValueChange={(v) => setFormData({ ...formData, category_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat: any) => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="price">Selling Price (₹) *</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="999"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cost_price">Cost Price (₹)</Label>
              <Input
                id="cost_price"
                type="number"
                min="0"
                step="0.01"
                value={formData.cost_price}
                onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
                placeholder="500"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tax_rate">Tax Rate (%)</Label>
              <Input
                id="tax_rate"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.tax_rate}
                onChange={(e) => setFormData({ ...formData, tax_rate: Number(e.target.value) })}
                placeholder="18"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="branch">Branch</Label>
              <Select
                value={formData.branch_id || '__all__'}
                onValueChange={(v) => setFormData({ ...formData, branch_id: v === '__all__' ? '' : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All branches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Branches</SelectItem>
                  {branches.map((branch: any) => (
                    <SelectItem key={branch.id} value={branch.id}>{branch.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {!isEditing && (
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="initial_quantity">Initial Stock Quantity *</Label>
                <Input
                  id="initial_quantity"
                  type="number"
                  min="0"
                  value={formData.initial_quantity}
                  onChange={(e) => setFormData({ ...formData, initial_quantity: e.target.value })}
                  placeholder="50"
                  required
                />
                <p className="text-xs text-muted-foreground">Set the starting inventory for this product</p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <Label htmlFor="is_active">Active</Label>
              <p className="text-xs text-muted-foreground">Product is available for sale</p>
            </div>
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={saveMutation.isPending} className="flex-1">
              {saveMutation.isPending ? 'Saving...' : isEditing ? 'Update Product' : 'Add Product'}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}

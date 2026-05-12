import { supabase } from '@/integrations/supabase/client';

export interface ProductCategory {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  parent_id: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  description: string | null;
  sku: string | null;
  price: number;
  cost_price: number | null;
  tax_rate: number | null;
  image_url: string | null;
  category_id: string | null;
  branch_id: string | null;
  is_active: boolean;
  requires_batch_tracking?: boolean;
  requires_lab_report?: boolean;
  default_shelf_life_days?: number | null;
  created_at: string;
}

// Product Categories
export async function fetchCategories() {
  const { data, error } = await supabase
    .from('product_categories')
    .select('*')
    .eq('is_active', true)
    .order('sort_order');
  if (error) throw error;
  return data as ProductCategory[];
}

export async function createCategory(category: Omit<ProductCategory, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('product_categories')
    .insert(category)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(id: string, category: Partial<ProductCategory>) {
  const { data, error } = await supabase
    .from('product_categories')
    .update(category)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase
    .from('product_categories')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}

// Products
export async function fetchProducts(branchId?: string) {
  let query = supabase
    .from('products')
    .select('*, product_categories(name)')
    .eq('is_active', true)
    .order('name');
  
  if (branchId) {
    query = query.eq('branch_id', branchId);
  }
  
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function createProduct(product: Omit<Product, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateProduct(id: string, product: Partial<Product>) {
  const { data, error } = await supabase
    .from('products')
    .update(product)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteProduct(id: string) {
  const { error } = await supabase
    .from('products')
    .update({ is_active: false })
    .eq('id', id);
  if (error) throw error;
}

// Image upload — verbose error reporting + pre-flight validation
const ALLOWED_IMAGE_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const PRODUCTS_BUCKET = 'products';

export async function uploadProductImage(file: File): Promise<string> {
  // Pre-flight validation with friendly errors
  if (!ALLOWED_IMAGE_MIMES.includes(file.type)) {
    throw new Error(`Unsupported image type: ${file.type || 'unknown'}. Use JPG, PNG, WebP or GIF.`);
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error(`Image too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Max 5MB.`);
  }

  const fileExt = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const fileName = `${crypto.randomUUID()}.${fileExt}`;
  const filePath = `products/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(PRODUCTS_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    // Surface the real Supabase storage error so the toast is actionable
    console.error('uploadProductImage failed:', {
      bucket: PRODUCTS_BUCKET,
      path: filePath,
      mime: file.type,
      size: file.size,
      error: uploadError,
    });
    const detail = (uploadError as any)?.message || 'unknown storage error';
    const status = (uploadError as any)?.statusCode ? ` [${(uploadError as any).statusCode}]` : '';
    throw new Error(`Storage upload failed${status}: ${detail}`);
  }

  const { data: { publicUrl } } = supabase.storage
    .from(PRODUCTS_BUCKET)
    .getPublicUrl(filePath);

  return publicUrl;
}

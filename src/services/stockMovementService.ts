import { supabase } from '@/integrations/supabase/client';

export type MovementType = 'stock_in' | 'sale' | 'adjustment' | 'return' | 'initial';

export interface StockMovement {
  id: string;
  product_id: string;
  branch_id: string;
  movement_type: MovementType;
  quantity: number;
  reference_id: string | null;
  reference_type: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
}

export interface StockMovementWithProduct extends StockMovement {
  products?: {
    name: string;
    sku: string | null;
  };
  profiles?: {
    full_name: string | null;
  };
}

export const stockMovementService = {
  // Record a stock movement
  async recordMovement(movement: {
    product_id: string;
    branch_id: string;
    movement_type: MovementType;
    quantity: number;
    reference_id?: string;
    reference_type?: string;
    notes?: string;
  }): Promise<StockMovement> {
    const { data: user } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('stock_movements')
      .insert({
        ...movement,
        created_by: user?.user?.id || null,
      })
      .select()
      .single();

    if (error) throw error;
    return data as StockMovement;
  },

  // Get stock movements for a product
  async getProductMovements(productId: string, limit = 50): Promise<StockMovementWithProduct[]> {
    const { data, error } = await supabase
      .from('stock_movements')
      .select(`
        *,
        products:product_id (name, sku)
      `)
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    
    // Fetch creator names separately since there's no FK relationship
    const movements = data || [];
    const creatorIds = [...new Set(movements.map(m => m.created_by).filter(Boolean))];
    
    let creatorMap: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', creatorIds as string[]);
      
      if (profiles) {
        creatorMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name || 'Unknown']));
      }
    }

    return movements.map(m => ({
      ...m,
      profiles: m.created_by ? { full_name: creatorMap[m.created_by] || null } : undefined
    })) as StockMovementWithProduct[];
  },

  // Get all stock movements for a branch
  async getBranchMovements(branchId: string, options?: {
    movementType?: MovementType;
    startDate?: string;
    endDate?: string;
    limit?: number;
  }): Promise<StockMovementWithProduct[]> {
    let query = supabase
      .from('stock_movements')
      .select(`
        *,
        products:product_id (name, sku)
      `)
      .eq('branch_id', branchId)
      .order('created_at', { ascending: false });

    if (options?.movementType) {
      query = query.eq('movement_type', options.movementType);
    }
    if (options?.startDate) {
      query = query.gte('created_at', options.startDate);
    }
    if (options?.endDate) {
      query = query.lte('created_at', options.endDate);
    }
    if (options?.limit) {
      query = query.limit(options.limit);
    } else {
      query = query.limit(100);
    }

    const { data, error } = await query;
    if (error) throw error;
    
    // Fetch creator names separately since there's no FK relationship
    const movements = data || [];
    const creatorIds = [...new Set(movements.map(m => m.created_by).filter(Boolean))];
    
    let creatorMap: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', creatorIds as string[]);
      
      if (profiles) {
        creatorMap = Object.fromEntries(profiles.map(p => [p.id, p.full_name || 'Unknown']));
      }
    }

    return movements.map(m => ({
      ...m,
      profiles: m.created_by ? { full_name: creatorMap[m.created_by] || null } : undefined
    })) as StockMovementWithProduct[];
  },

  // Record initial stock for a product
  async setInitialStock(productId: string, branchId: string, quantity: number, notes?: string): Promise<StockMovement> {
    return this.recordMovement({
      product_id: productId,
      branch_id: branchId,
      movement_type: 'initial',
      quantity,
      notes: notes || 'Initial stock setup',
    });
  },

  // Add stock (restock/purchase)
  async addStock(productId: string, branchId: string, quantity: number, notes?: string): Promise<StockMovement> {
    // Record movement
    const movement = await this.recordMovement({
      product_id: productId,
      branch_id: branchId,
      movement_type: 'stock_in',
      quantity,
      notes,
    });

    // Update inventory
    const { data: inventory, error: fetchError } = await supabase
      .from('inventory')
      .select('id, quantity')
      .eq('product_id', productId)
      .eq('branch_id', branchId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    if (inventory) {
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ 
          quantity: (inventory.quantity || 0) + quantity,
          last_restocked_at: new Date().toISOString()
        })
        .eq('id', inventory.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('inventory')
        .insert({
          product_id: productId,
          branch_id: branchId,
          quantity,
          last_restocked_at: new Date().toISOString()
        });
      if (insertError) throw insertError;
    }

    return movement;
  },

  // Adjust stock (correction)
  async adjustStock(productId: string, branchId: string, newQuantity: number, notes?: string): Promise<StockMovement> {
    // Get current quantity
    const { data: inventory, error: fetchError } = await supabase
      .from('inventory')
      .select('id, quantity')
      .eq('product_id', productId)
      .eq('branch_id', branchId)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    const currentQty = inventory?.quantity || 0;
    const adjustmentQty = newQuantity - currentQty;

    // Record movement
    const movement = await this.recordMovement({
      product_id: productId,
      branch_id: branchId,
      movement_type: 'adjustment',
      quantity: adjustmentQty,
      notes: notes || `Adjusted from ${currentQty} to ${newQuantity}`,
    });

    // Update inventory
    if (inventory) {
      const { error: updateError } = await supabase
        .from('inventory')
        .update({ quantity: newQuantity })
        .eq('id', inventory.id);
      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('inventory')
        .insert({
          product_id: productId,
          branch_id: branchId,
          quantity: newQuantity
        });
      if (insertError) throw insertError;
    }

    return movement;
  },
};

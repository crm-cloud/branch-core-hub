import { supabase } from '@/integrations/supabase/client';

export interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  cost_price: number | null;
  category: string | null;
  sku: string | null;
  image_url: string | null;
  tax_rate: number | null;
  is_active: boolean | null;
  branch_id: string | null;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export async function fetchProducts(branchId?: string) {
  let query = supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (branchId) {
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Product[];
}

export async function fetchProductsByCategory(category: string, branchId?: string) {
  let query = supabase
    .from('products')
    .select('*')
    .eq('is_active', true)
    .eq('category', category)
    .order('name');

  if (branchId) {
    query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Product[];
}

export async function createProduct(product: Omit<Product, 'id'>) {
  const { data, error } = await supabase
    .from('products')
    .insert(product)
    .select()
    .single();

  if (error) throw error;
  return data as Product;
}

export async function updateProduct(id: string, product: Partial<Product>) {
  const { data, error } = await supabase
    .from('products')
    .update(product)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Product;
}

/**
 * Create a POS sale.
 *
 * As of v2 this delegates to the authoritative `create_pos_sale` Postgres
 * RPC, which performs the entire checkout (sale + invoice + items + wallet
 * debit + remainder settlement + coupon usage + inventory) inside a single
 * transaction and routes payments through `settle_payment` for full
 * lifecycle/audit consistency.
 */
export async function createPOSSale(sale: {
  branchId: string;
  memberId?: string;
  items: CartItem[];
  paymentMethod: string;
  soldBy?: string;
  transactionId?: string;
  slipUrl?: string;
  /** Guest snapshot (used when no memberId) */
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  /** If true: invoice is created as `pending` with NO payment row. Webhook will settle. */
  awaitingPayment?: boolean;
  /** Optional flat discount amount (post-validation, e.g. coupon value). */
  discountAmount?: number;
  /** The coupon code (if any). */
  discountCodeId?: string;
  discountCode?: string;
  /** Wallet portion (₹) to apply against the bill. */
  walletApplied?: number;
  /** Optional client-supplied idempotency key for retry-safety. */
  idempotencyKey?: string;
}) {
  const items = sale.items.map((item) => ({
    product_id: item.product.id,
    name: item.product.name,
    quantity: item.quantity,
    unit_price: item.product.price,
    total: item.product.price * item.quantity,
  }));

  const { data, error } = await (supabase as any).rpc('create_pos_sale', {
    p_branch_id: sale.branchId,
    p_member_id: sale.memberId ?? null,
    p_items: items,
    p_payment_method: sale.paymentMethod,
    p_sold_by: sale.soldBy ?? null,
    p_guest_name: sale.guestName ?? null,
    p_guest_phone: sale.guestPhone ?? null,
    p_guest_email: sale.guestEmail ?? null,
    p_awaiting_payment: !!sale.awaitingPayment,
    p_discount_amount: sale.discountAmount ?? 0,
    p_discount_code_id: sale.discountCodeId ?? null,
    p_discount_code: sale.discountCode ?? null,
    p_wallet_applied: sale.walletApplied ?? 0,
    p_transaction_id: sale.transactionId ?? null,
    p_slip_url: sale.slipUrl ?? null,
    p_idempotency_key: sale.idempotencyKey ?? null,
  });

  if (error) throw error;
  const result = data as {
    pos_sale_id: string;
    invoice_id: string;
    subtotal: number;
    discount: number;
    wallet_applied: number;
    remainder: number;
    total: number;
    awaiting: boolean;
  };

  // Maintain the previous return shape so existing callers keep working.
  return {
    id: result.pos_sale_id,
    invoice_id: result.invoice_id,
    subtotal: result.subtotal,
    discount: result.discount,
    wallet_applied: result.wallet_applied,
    remainder: result.remainder,
    total_amount: result.total,
    payment_status: result.awaiting ? 'awaiting_payment' : 'paid',
  };
}

// ── Legacy client-side checkout body removed (now handled server-side in
//    create_pos_sale). The function below is retained for signature
//    compatibility but the body is dead — kept empty to make removal trivial.
async function _legacyCreatePOSSale_REMOVED(sale: {
  branchId: string;
  memberId?: string;
  items: CartItem[];
  paymentMethod: string;
  soldBy?: string;
  transactionId?: string;
  slipUrl?: string;
  guestName?: string;
  guestPhone?: string;
  guestEmail?: string;
  awaitingPayment?: boolean;
  discountAmount?: number;
  discountCodeId?: string;
  discountCode?: string;
  walletApplied?: number;
}) {
  // unreachable — kept as type anchor only
  void sale;
  return null;
  const subtotalAmount = sale.items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const discountAmount = Math.max(0, Math.min(sale.discountAmount || 0, subtotalAmount));
  const totalAmount = Math.max(0, subtotalAmount - discountAmount);
  const walletApplied = Math.max(0, Math.min(sale.walletApplied || 0, totalAmount));
  const remainderDue = Math.max(0, totalAmount - walletApplied);

  const saleItems = sale.items.map((item) => ({
    product_id: item.product.id,
    name: item.product.name,
    quantity: item.quantity,
    unit_price: item.product.price,
    total: item.product.price * item.quantity,
  }));

  // Resolve customer snapshot fields
  // Priority: explicit guest fields → member's profile snapshot → null
  let customerName: string | null = sale.guestName?.trim() || null;
  let customerPhone: string | null = sale.guestPhone?.trim() || null;
  let customerEmail: string | null = sale.guestEmail?.trim() || null;

  if (sale.memberId && !customerName) {
    const { data: memberRow } = await supabase
      .from('members')
      .select('user_id, profiles:user_id(full_name, phone, email)')
      .eq('id', sale.memberId)
      .maybeSingle();
    const profile = (memberRow as any)?.profiles;
    if (profile) {
      customerName = profile.full_name || null;
      customerPhone = profile.phone || null;
      customerEmail = profile.email || null;
    }
  }

  const isAwaiting = !!sale.awaitingPayment;

  // Wallet split is incompatible with awaiting-payment (link) flows
  const effectiveWalletApplied = isAwaiting ? 0 : walletApplied;
  const effectiveRemainderDue = isAwaiting ? totalAmount : remainderDue;

  // ── Pre-flight checks (fail BEFORE creating any rows) ─────────────────
  // 1) Wallet sufficiency: read current balance and abort if insufficient.
  //    The actual deduction happens later via a conditional update so that
  //    concurrent debits cannot drive the balance negative.
  if (effectiveWalletApplied > 0) {
    if (!sale.memberId) {
      throw new Error('Wallet redemption requires a member');
    }
    const { data: walletPre } = await supabase
      .from('wallets')
      .select('id, balance')
      .eq('member_id', sale.memberId)
      .maybeSingle();
    if (!walletPre) {
      throw new Error('Member wallet not found');
    }
    if ((Number(walletPre.balance) || 0) < effectiveWalletApplied) {
      throw new Error('Insufficient wallet balance');
    }
  }

  // 2) Re-validate coupon server-side (active, dates, branch, max_uses, min_purchase)
  if (!isAwaiting && sale.discountCodeId && discountAmount > 0) {
    const today = new Date().toISOString().split('T')[0];
    const { data: codePre } = await supabase
      .from('discount_codes')
      .select('id, is_active, valid_from, valid_until, max_uses, times_used, branch_id, min_purchase')
      .eq('id', sale.discountCodeId)
      .maybeSingle();
    if (!codePre || !codePre.is_active) {
      throw new Error('Coupon is no longer valid');
    }
    if (codePre.valid_from && codePre.valid_from > today) {
      throw new Error('Coupon is not yet valid');
    }
    if (codePre.valid_until && codePre.valid_until < today) {
      throw new Error('Coupon has expired');
    }
    if (codePre.max_uses != null && (codePre.times_used || 0) >= codePre.max_uses) {
      throw new Error('Coupon usage limit reached');
    }
    if (codePre.branch_id && codePre.branch_id !== sale.branchId) {
      throw new Error('Coupon is not valid at this branch');
    }
    if (codePre.min_purchase && subtotalAmount < Number(codePre.min_purchase)) {
      throw new Error(`Coupon requires minimum purchase of ₹${Number(codePre.min_purchase).toLocaleString()}`);
    }
  }

  // Compose invoice/sale notes
  const noteParts: string[] = [isAwaiting ? 'POS Sale — Awaiting Payment Link' : 'POS Sale'];
  if (sale.discountCode && discountAmount > 0) {
    noteParts.push(`Coupon ${sale.discountCode}: -₹${discountAmount.toFixed(2)}`);
  }
  if (effectiveWalletApplied > 0) {
    noteParts.push(`Wallet applied: ₹${effectiveWalletApplied.toFixed(2)}`);
  }
  const composedNotes = noteParts.join(' | ');

  // Create POS sale row with snapshot + lifecycle status
  const { data: posSale, error: saleError } = await supabase
    .from('pos_sales')
    .insert({
      branch_id: sale.branchId,
      member_id: sale.memberId,
      items: saleItems,
      total_amount: totalAmount,
      payment_method: sale.paymentMethod as any,
      sold_by: sale.soldBy,
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_email: customerEmail,
      payment_status: isAwaiting ? 'awaiting_payment' : 'paid',
    } as any)
    .select()
    .single();

  if (saleError) throw saleError;

  // Create invoice for the POS sale (pending if awaiting link, paid otherwise)
  const { data: invoice, error: invoiceError } = await supabase
    .from('invoices')
    .insert({
      branch_id: sale.branchId,
      member_id: sale.memberId || null,
      invoice_number: null as any, // Auto-generated by trigger
      subtotal: subtotalAmount,
      discount_amount: discountAmount > 0 ? discountAmount : null,
      total_amount: totalAmount,
      amount_paid: isAwaiting ? 0 : totalAmount,
      status: isAwaiting ? 'pending' : 'paid',
      due_date: new Date().toISOString().split('T')[0],
      pos_sale_id: posSale.id,
      source: 'pos' as any,
      notes: composedNotes,
    } as any)
    .select()
    .single();

  let invoiceId: string | null = null;

  if (invoiceError) {
    console.error('Failed to create invoice for POS sale:', invoiceError);
  } else {
    invoiceId = invoice.id;
    // Update POS sale with invoice ID
    await supabase
      .from('pos_sales')
      .update({ invoice_id: invoice.id })
      .eq('id', posSale.id);

    // Create invoice items
    const invoiceItems = sale.items.map((item) => ({
      invoice_id: invoice.id,
      description: item.product.name,
      quantity: item.quantity,
      unit_price: item.product.price,
      total_amount: item.product.price * item.quantity,
      reference_type: 'product',
      reference_id: item.product.id,
    }));

    await supabase.from('invoice_items').insert(invoiceItems);

    // Only insert completed payment row(s) when NOT awaiting gateway confirmation
    if (!isAwaiting) {
      const paymentRows: any[] = [];

      // Wallet portion (if any)
      if (effectiveWalletApplied > 0 && sale.memberId) {
        paymentRows.push({
          branch_id: sale.branchId,
          member_id: sale.memberId,
          invoice_id: invoice.id,
          amount: effectiveWalletApplied,
          payment_method: 'wallet' as any,
          status: 'completed',
          payment_date: new Date().toISOString(),
          notes: 'Wallet redemption',
        });
      }

      // Remainder via the chosen payment method (only if there's something left)
      if (effectiveRemainderDue > 0) {
        paymentRows.push({
          branch_id: sale.branchId,
          member_id: sale.memberId || null,
          invoice_id: invoice.id,
          amount: effectiveRemainderDue,
          payment_method: sale.paymentMethod as any,
          status: 'completed',
          payment_date: new Date().toISOString(),
          transaction_id: sale.transactionId || null,
          slip_url: sale.slipUrl || null,
        });
      }

      if (paymentRows.length) {
        await supabase.from('payments').insert(paymentRows as any);
      }
    }
  }

  // Deduct wallet & log transaction. Use a conditional update keyed on the
  // expected balance to avoid driving the wallet negative under concurrent debits.
  // Retry up to 3 times if the balance moved between read and write.
  if (!isAwaiting && effectiveWalletApplied > 0 && sale.memberId) {
    let deducted = false;
    for (let attempt = 0; attempt < 3 && !deducted; attempt++) {
      const { data: walletRow } = await supabase
        .from('wallets')
        .select('id, balance')
        .eq('member_id', sale.memberId)
        .maybeSingle();
      if (!walletRow) break;
      const currentBalance = Number(walletRow.balance) || 0;
      if (currentBalance < effectiveWalletApplied) {
        throw new Error('Insufficient wallet balance');
      }
      const newBalance = currentBalance - effectiveWalletApplied;
      const { data: updated, error: updErr } = await supabase
        .from('wallets')
        .update({ balance: newBalance })
        .eq('id', walletRow.id)
        .eq('balance', currentBalance) // conditional — fails silently if changed
        .select('id')
        .maybeSingle();
      if (updErr) throw updErr;
      if (updated) {
        await supabase.from('wallet_transactions').insert({
          wallet_id: walletRow.id,
          txn_type: 'debit' as any,
          amount: effectiveWalletApplied,
          balance_after: newBalance,
          description: sale.discountCode
            ? `POS sale (coupon ${sale.discountCode})`
            : 'POS sale',
          reference_type: 'pos_sale',
          reference_id: posSale.id,
        } as any);
        deducted = true;
      }
    }
    if (!deducted) {
      throw new Error('Wallet balance changed during checkout — please retry');
    }
  }

  // Increment discount code usage counter with a guard against exceeding max_uses.
  if (!isAwaiting && sale.discountCodeId && discountAmount > 0) {
    const { data: codeRow } = await supabase
      .from('discount_codes')
      .select('times_used, max_uses')
      .eq('id', sale.discountCodeId)
      .maybeSingle();
    if (codeRow) {
      const current = codeRow.times_used || 0;
      const next = current + 1;
      let q = supabase
        .from('discount_codes')
        .update({ times_used: next })
        .eq('id', sale.discountCodeId)
        .eq('times_used', current); // conditional — guards against concurrent increments
      if (codeRow.max_uses != null) {
        q = q.lt('times_used', codeRow.max_uses);
      }
      await q;
    }
  }

  // Update inventory regardless (stock leaves the shelf either way)
  for (const item of sale.items) {
    const { data: inventory } = await supabase
      .from('inventory')
      .select('*')
      .eq('product_id', item.product.id)
      .eq('branch_id', sale.branchId)
      .maybeSingle();

    if (inventory) {
      await supabase
        .from('inventory')
        .update({ quantity: (inventory.quantity || 0) - item.quantity })
        .eq('id', inventory.id);
    }
  }

  return { ...posSale, invoice_id: invoiceId };
}

export async function createEcommerceOrder(order: {
  branchId: string;
  memberId: string;
  items: CartItem[];
  shippingAddress?: any;
}) {
  const subtotal = order.items.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );
  const taxAmount = subtotal * 0.18; // 18% GST
  const totalAmount = subtotal + taxAmount;

  const orderItems = order.items.map((item) => ({
    product_id: item.product.id,
    name: item.product.name,
    quantity: item.quantity,
    unit_price: item.product.price,
    total: item.product.price * item.quantity,
  }));

  // Generate order number
  const orderNumber = `ORD-${Date.now().toString(36).toUpperCase()}`;

  const { data, error } = await supabase
    .from('ecommerce_orders')
    .insert({
      branch_id: order.branchId,
      member_id: order.memberId,
      order_number: orderNumber,
      items: orderItems,
      subtotal,
      tax_amount: taxAmount,
      total_amount: totalAmount,
      shipping_address: order.shippingAddress,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchPOSSales(branchId: string, date?: string) {
  let query = supabase
    .from('pos_sales')
    .select(`
      *,
      members(member_code, profiles:user_id(full_name))
    `)
    .eq('branch_id', branchId)
    .order('sale_date', { ascending: false });

  if (date) {
    query = query.gte('sale_date', `${date}T00:00:00`).lte('sale_date', `${date}T23:59:59`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned';

export async function fetchEcommerceOrders(branchId: string, status?: OrderStatus) {
  let query = supabase
    .from('ecommerce_orders')
    .select(`
      *,
      members(member_code, profiles:user_id(full_name))
    `)
    .eq('branch_id', branchId)
    .order('created_at', { ascending: false });

  if (status) {
    query = query.eq('status', status);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function updateOrderStatus(orderId: string, status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'returned') {
  const { data, error } = await supabase
    .from('ecommerce_orders')
    .update({ status })
    .eq('id', orderId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

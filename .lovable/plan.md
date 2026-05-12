## Goal

Enhance Products & Inventory and POS to support **batch numbers, MFG/EXP dates, and uploadable lab test reports (CoA)** for products that need it (proteins, supplements, sports nutrition) — without forcing it on apparel, accessories, beverages, etc.

## Design Principle: Opt-in per product

Add a single boolean `requires_batch_tracking` on `products`. When OFF (default), POS and inventory behave exactly as today. When ON, the product is sold from **batches** (FEFO — First Expire, First Out) and a CoA / lab report can be attached per batch.

This is the cleanest pattern (Tally / Zoho / Odoo style) and avoids two parallel inventory worlds.

---

## Data Model

### 1. `products` — add 3 columns
- `requires_batch_tracking boolean default false`
- `requires_lab_report boolean default false` (warns staff if a batch is created without CoA)
- `default_shelf_life_days integer null` (auto-suggest EXP from MFG when entering stock)

### 2. New table `product_batches`
- `id`, `product_id`, `branch_id`
- `batch_number text` (unique per product+branch)
- `mfg_date date`, `exp_date date`
- `quantity_received int`, `quantity_remaining int`
- `cost_price numeric`, `supplier text`, `invoice_ref text`
- `lab_report_url text` (signed URL to PDF/image in `product-lab-reports` bucket)
- `lab_report_filename text`, `lab_report_uploaded_at timestamptz`
- `lab_verified boolean default false`, `lab_verified_by uuid`
- `status text` — `active | depleted | expired | recalled | quarantined`
- `notes`, `created_by`, timestamps
- Unique `(product_id, branch_id, batch_number)`
- Indexes on `(product_id, branch_id, status, exp_date)` for FEFO lookups

### 3. New table `batch_movements` (or reuse `stock_movements` + add `batch_id`)
- Add `batch_id uuid null` to `stock_movements` so every sale/adjustment is traceable to a batch.

### 4. `store_invoice_items` — add `batch_id uuid null`
So receipts and reports can show which batch a member received (critical for recalls).

### 5. Storage
- New private bucket `product-lab-reports` (PDF / JPG / PNG, ≤10 MB)
- RLS: owner/admin/manager upload + view; staff view; never public. Member-facing: optional signed URL on receipt for batch-tracked items.

### 6. RLS
- `product_batches`: staff read (their branch), manager+ write.
- Trigger: when `quantity_remaining = 0` → auto-set `status='depleted'`; daily cron flips `exp_date < today` to `expired` and blocks sale.

### 7. Atomic RPC `consume_batch_stock(product_id, branch_id, qty)`
Returns the batch(es) used (FEFO), decrements `quantity_remaining`, writes `stock_movements` rows, and updates `inventory.quantity`. Used by POS on checkout. Single source of truth — no client-side multi-step writes.

---

## UI Changes

### Products page (Add/Edit drawer)
- New section **"Batch & Compliance"**:
  - Toggle: *Track batches & expiry* (`requires_batch_tracking`)
  - Toggle: *Require lab test report (CoA)* — only enabled when batch tracking is on
  - Number: *Default shelf life (days)*
- Product list: badge **"Batch tracked"** + **"CoA"** chip; column for *Nearest expiry*.

### Products page → Product detail (new tab "Batches")
- Table of batches: batch #, MFG, EXP, remaining qty, status, CoA preview/download.
- **"Add Batch"** drawer (right-side Sheet, per design system):
  - Batch number (auto-suggest `INC-{productSKU}-{YYMMDD}-{seq}`)
  - MFG date, EXP date (auto-fills from shelf life)
  - Quantity received, cost price, supplier, invoice ref
  - **Lab Report uploader** (PDF/JPG, 10 MB) → `product-lab-reports` bucket, stores signed-URL path
  - Notes
- Row actions: View CoA, Mark verified, Recall, Quarantine, Adjust qty.

### POS (`POS.tsx`)
- For non-batch products: unchanged.
- For batch-tracked products in cart:
  - Show **"Batch: B123 · EXP 12/26"** auto-picked via FEFO under the line item
  - Allow staff to **override batch** (dropdown of available batches sorted by EXP)
  - Block sale if no active non-expired batch with stock → show "Out of stock / no valid batch"
  - Warning chip if expiring within 30 days
- Checkout calls `consume_batch_stock` RPC; receipt prints batch # + EXP next to product.

### Receipts / Invoices (`pdfBlob.ts`)
- For lines with `batch_id`, append `Batch: {no} · EXP {date}` under the item name (mirrors how machine name is shown under exercises in fitness PDFs — same pattern).
- Footer note for batch-tracked items: "Lab report available on request."

### Member portal (`MyInvoices.tsx`)
- For batch-tracked items, expose **"Download lab report"** link (signed URL, 60s TTL) — builds trust, matches FSSAI norms for supplements.

### Alerts / Automation
- Daily cron: products with batches expiring in **30 / 15 / 7 days** → notification to manager (uses existing notification system).
- Auto-flip status to `expired` and exclude from POS.
- Reuse existing `automation-brain` rule pattern; no new cron infra.

---

## Rollout (phased — safe to ship one at a time)

1. **Phase 1 — Schema + Add Batch UI** (no POS change)
   Migration, new bucket, Add Batch drawer, Batches tab, lab report upload. Product toggle defaults OFF, so nothing existing changes.

2. **Phase 2 — POS integration**
   Add `consume_batch_stock` RPC, wire POS to call it for batch-tracked products only, show batch on cart line and receipt PDF.

3. **Phase 3 — Compliance & alerts**
   Expiry cron + manager alerts, member-side CoA link on invoices, recall workflow.

---

## Out of Scope (call out, don't build now)
- Multi-warehouse transfers between batches
- Serial-number tracking (per-bottle) — overkill for gym retail
- Supplier master / PO module — can be added later; for now `supplier` is free text on the batch
- Barcode scanning for batch capture — easy to bolt on once Phase 1 ships

---

## Files Touched (estimate)

**New:** migration; `src/services/batchService.ts`; `src/components/products/AddBatchDrawer.tsx`; `src/components/products/ProductBatchesTab.tsx`; `src/components/pos/BatchPicker.tsx`.
**Edited:** `src/services/productService.ts` (3 new fields), `src/components/products/AddProductDrawer.tsx` (toggles), `src/pages/Products.tsx` (badges + batches tab), `src/pages/POS.tsx` (FEFO + batch line), `src/utils/pdfBlob.ts` (batch line under product), `src/services/storeService.ts` (call RPC, persist `batch_id` on items), `src/pages/MyInvoices.tsx` (CoA link).

Approve and I'll start with Phase 1 (schema + Add Batch UI) so existing POS keeps working untouched.
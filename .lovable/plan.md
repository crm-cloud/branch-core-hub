# Settings, Benefits, Templates & Add-On Pricing Overhaul

Five focused fixes spanning Settings IA, Benefits page UX, WhatsApp filter placement, template attachment audit, and add-on package GST.

---

## 1. Benefit Settings → Tabbed layout with KPI cards

**File:** `src/components/settings/BenefitSettingsComponent.tsx`

Currently stacks `BenefitTypesManager` + `FacilitiesManager` + Slot Settings vertically. Convert to a tabbed shell with a KPI strip on top.

**KPI Strip (4 cards):**
- Total Benefit Types (active count)
- Facilities/Rooms (count + maintenance count badge)
- Bookable Today (slot-enabled benefit types)
- Active Member Credits (count of `member_benefit_credits` with `remaining > 0`)

**Tabs:**
- a. **Benefits** — existing `<BenefitTypesManager />`
- b. **Facilities / Rooms** — existing `<FacilitiesManager />`
- c. **Slot Booking Settings** — existing slot-settings grid + `ConfigureSheet`

URL persists via `?subtab=benefits|facilities|slots`. Vuexy card styling (`rounded-2xl`, soft shadows, gradient icon badges).

---

## 2. WhatsApp Status filter → Move under WhatsApp tab

**File:** `src/components/settings/TemplateManager.tsx` (lines ~155, ~460–520)

Today the "WHATSAPP STATUS: All / Approved / Pending / Rejected / Draft" pills render globally above the SMS/Email/WhatsApp channel tabs. Per the screenshot, this is confusing because the filter is WhatsApp-specific.

**Fix:** Render the status pill row **only inside the WhatsApp `TabsContent`** (conditional on `activeChannelTab === 'whatsapp'`). Keep counts driven by the same memoized list. SMS/Email tabs no longer show those pills.

---

## 3. Settings menu → Alphabetical order

**File:** `src/pages/Settings.tsx` — `SETTINGS_MENU` array (lines 23–41)

Reorder by label A→Z (keys / icons / content keys preserved so URL `?tab=` and functionality stay intact):

```
AI Agent → Appearance → Backup & Restore → Benefits → Body Scanner →
Branches → Finance Categories → Integrations → Marketing & Retention →
Notifications → Organization → Plan & Benefit Templates → Referrals →
Security → Tax & GST → Templates Manager → Website
```

Pure ordering change; no key/value renames, no route breakage.

---

## 4. Template Attachments Audit (PDFs / Images for Reports & Invoices)

**Finding:** The `templates` table has **no** attachment / header-media columns — only `name, type, subject, content, variables, meta_template_*`. Edge functions like `deliver-scan-report` and invoice senders attach PDFs ad-hoc inline at send time, bypassing the template system. So the user is correct: there is no template-level attachment support.

**Plan — add first-class attachment support:**

DB migration on `public.templates`:
- `header_type text` — `none | image | document | video`
- `header_media_url text` — static media link (e.g. brand logo, sample PDF)
- `header_media_handle text` — Meta media handle for WhatsApp templates
- `attachment_source text` — `none | static | dynamic`
  - `static` → use `header_media_url`
  - `dynamic` → resolve at send time from `{{attachment_url}}` variable (so report/invoice PDFs flow through naturally)
- `attachment_filename_template text` — e.g. `Invoice_{{invoice_number}}.pdf`

**TemplateManager UI** (`TemplateManager.tsx`):
- New "Attachment" section in the editor sheet (visible for WhatsApp + Email).
- Upload to existing `template-media` storage bucket (create if missing) with RLS for admin/owner/manager.
- Live preview chip showing filename + type.

**Edge function alignment:**
- `deliver-scan-report` and invoice senders: when invoking by `template_id`, pass `attachment_url` + `attachment_filename` into the template context so the resolver attaches automatically.
- Add 2 starter templates seeded:
  - `scan_report_delivery` (WhatsApp, document header, dynamic)
  - `invoice_delivery` (WhatsApp + Email, document header, dynamic)

This unblocks "Send PDF report / Send Invoice" flows from the unified Template Manager.

---

## 5. Add-On Packages → HSN / Tax / GST inclusive toggle

**Files:**
- DB migration on `public.benefit_packages`
- `src/components/plans/AddBenefitPackageDrawer.tsx`
- `src/components/plans/BenefitPackagesPanel.tsx`

**DB migration — add columns:**
- `hsn_code text` (nullable)
- `tax_rate numeric(5,2) default 0` — GST %
- `tax_inclusive boolean default true` — toggle: price already includes tax vs. tax added on top
- `gst_category text` — `goods | services` (defaults `services` for sessions)

**Drawer UI additions** (new "Tax & GST" section below Price):
- HSN/SAC Code input (with helper: SAC for service-based benefits)
- Tax Rate select (0 / 5 / 12 / 18 / 28) — pull defaults from existing `useGstRates` if available
- Switch: **"Price is GST inclusive"** (default ON, matches India retail norm)
- Live preview row computing base + CGST + SGST split based on toggle:
  - Inclusive: `base = price / (1 + rate/100)`, `tax = price - base`
  - Exclusive: `base = price`, `total = price * (1 + rate/100)`

**Panel display:** Add small `HSN: 9999` and `GST 18%` chips on each card; show "incl. GST" / "+ GST" suffix on the price badge.

**Invoicing flow:** `record_payment` RPC already handles tax splits when invoice line items carry `tax_rate` + `hsn_code` (per `gst-compliant-invoicing` memory). Pass these through when an add-on package is sold so GST invoices come out correctly.

---

## Order of execution

1. DB migrations (templates attachments + benefit_packages GST) — single migration file.
2. Settings menu reorder (trivial).
3. WhatsApp status filter move.
4. Benefit Settings tabs + KPI strip.
5. Add-On drawer GST fields + panel chips.
6. Template Manager attachment UI + storage bucket + 2 seeded templates.
7. Wire `deliver-scan-report` / invoice senders to pass dynamic attachment context.

No breaking changes to existing routes, RLS, or data.

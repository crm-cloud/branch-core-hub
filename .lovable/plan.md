## Goal
Make `src/utils/pdfBlob.ts` the **single source of truth** for every PDF generated in the app, delete the legacy generator, fold scattered inline builders into it, and ensure every call passes the same `BrandContext` so branding is identical everywhere.

## Current state (audit)

Two parallel pipelines exist today:

| File | Tech | Output style | Status |
|---|---|---|---|
| `src/utils/pdfBlob.ts` (1064 lines) | jsPDF + autoTable + `BrandContext` | Branded, blob-based, designed | **Keep — source of truth** |
| `src/utils/pdfGenerator.ts` (923 lines) | `window.open` + HTML + browser print dialog | Unbranded, inconsistent | **Delete** |
| `src/utils/planPdf.ts` (24 lines) | Wrapper around `buildPlanPdf` | Thin helper | Keep (or inline) |
| `src/components/members/MemberRegistrationForm.tsx` lines 700+ | Inline `jsPDF` + `autoTable` builder | One-off, no brand | **Move into `pdfBlob.ts`** |

Legacy `pdfGenerator.ts` is still imported in only **two** places:
- `src/pages/HRM.tsx` → `generateContractPDF`
- `src/components/invoices/InvoiceViewDrawer.tsx` → `generateInvoicePDF`, `generateThermalReceipt`

Equivalents already exist in `pdfBlob.ts`: `buildContractPdf`, `buildInvoicePdf`, `buildPaymentReceiptPdf`, `buildPayslipPdf`, `buildPlanPdf`. **No thermal variant** exists yet — needs to be added.

## Changes

### 1. Extend `src/utils/pdfBlob.ts` (the SoT)
Add the missing builders so nothing else needs to construct `jsPDF` directly:

- `buildThermalReceiptPdf(data: InvoicePdfInput, brand?: BrandContext): Blob` — port the 80×200mm thermal layout from `pdfGenerator.ts::generateThermalReceipt` into jsPDF (small page format `[80, 200]`).
- `buildRegistrationFormPdf(args, brand?: BrandContext): Blob` — move the full body of `buildRegistrationFormPdf` out of `MemberRegistrationForm.tsx` into `pdfBlob.ts` and add brand header/footer for consistency.
- Re-export the small download helpers (`downloadBlob`, `printBlob`) and a new `downloadPdf(blob, filename)` convenience wrapper so call sites have one import path.

### 2. Migrate the two remaining callers off `pdfGenerator.ts`

`src/pages/HRM.tsx`:
```ts
// before
import { generateContractPDF } from '@/utils/pdfGenerator';
generateContractPDF(contract);
// after
import { buildContractPdf, downloadBlob } from '@/utils/pdfBlob';
const brand = useBrandContext();
downloadBlob(buildContractPdf(contract, brand), `Contract-${contract.id}.pdf`);
```

`src/components/invoices/InvoiceViewDrawer.tsx`:
- `generateInvoicePDF` → `buildInvoicePdf` + `downloadBlob`
- `generateThermalReceipt` → `buildThermalReceiptPdf` + `printBlob` (so the same thermal print path runs through the SoT)

### 3. Migrate `MemberRegistrationForm.tsx`
Replace the inline `buildRegistrationFormPdf` and the local `jspdf` / `jspdf-autotable` imports with the new export from `pdfBlob.ts`. Remove ~360 lines of duplicate PDF code from the component.

### 4. Fold `planPdf.ts` into `pdfBlob.ts`
Move `downloadPlanPdf` and `planPdfFilename` into `pdfBlob.ts` and update the two importers (`Templates.tsx`, `sendPlanToMember.ts` indirectly) to import from `@/utils/pdfBlob`. Delete `src/utils/planPdf.ts`.

### 5. Delete legacy file
Remove `src/utils/pdfGenerator.ts` entirely once steps 2 & 4 land. Run `rg "pdfGenerator"` to confirm zero references before deletion.

### 6. Brand consistency pass
Every builder call site must obtain brand the same way:
```ts
const brand = useBrandContext();
buildXxxPdf(data, brand);
```
Audit and fix the few sites that currently call builders without `brand` (`POS.tsx` receipt, `TrainerEarnings.tsx` payslip, `InvoiceShareDrawer.tsx`).

## After this change
- One file (`pdfBlob.ts`) owns every PDF: invoices, receipts (A4 + thermal), payslips, contracts, fitness plans, registration forms.
- One import surface: `@/utils/pdfBlob`.
- One brand pipeline: `useBrandContext()` → builder → identical header/footer/logo/colors across every PDF.
- ~1300 lines of duplicate PDF code removed (`pdfGenerator.ts` + inline registration builder + `planPdf.ts`).

## Out of scope
- Edge-function PDFs (`howbody-report-pdf` Supabase function) — server-side, separate pipeline; not touched.
- Visual redesign of any PDF — this is consolidation only; layouts stay as they are in `pdfBlob.ts` today.
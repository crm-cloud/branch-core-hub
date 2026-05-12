// Single source of truth for downloading a fitness plan PDF in the browser.
// Wraps the branded `buildPlanPdf` (jsPDF) so every entry point — Templates,
// PlanViewerSheet, MemberPlans, AssignPlanDrawer — produces an identical file.
//
// Do NOT add an alternative HTML/print-window generator for plans. The legacy
// `generatePlanPDF` in `src/utils/pdfGenerator.ts` is intentionally no longer
// used for fitness plans; callers must come through this helper.

import { buildPlanPdf, downloadBlob, type PlanPdfInput } from './pdfBlob';
import type { BrandContext } from '@/lib/brand/useBrandContext';

export function planPdfFilename(plan: { name: string; type: 'workout' | 'diet' }) {
  const safeName = plan.name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 80) || 'plan';
  return `${plan.type === 'workout' ? 'Workout' : 'Diet'}-Plan-${safeName}.pdf`;
}

export async function downloadPlanPdf(
  input: PlanPdfInput,
  brand?: BrandContext,
): Promise<Blob> {
  const blob = await buildPlanPdf(input, brand);
  downloadBlob(blob, planPdfFilename({ name: input.name, type: input.type }));
  return blob;
}

// Real PDF blob generation using jsPDF + autoTable.
// All builders accept an optional `brand: BrandContext` for company/branch info.

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { DEFAULT_BRAND, type BrandContext } from '@/lib/brand/useBrandContext';

const BRAND = {
  primary: [99, 102, 241] as [number, number, number], // indigo
  text: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  success: [34, 197, 94] as [number, number, number],
  danger: [239, 68, 68] as [number, number, number],
};

function setColor(doc: jsPDF, c: [number, number, number]) {
  doc.setTextColor(c[0], c[1], c[2]);
}

function inr(n: number) {
  return `Rs. ${(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

function fallbackBrand(branchName?: string): BrandContext {
  return { ...DEFAULT_BRAND, branch: { name: branchName || 'Incline Fitness' } };
}

function header(
  doc: jsPDF,
  title: string,
  brandOrBranchName?: BrandContext | string,
  meta?: { docNumber?: string; issueDate?: string },
) {
  const brand: BrandContext =
    typeof brandOrBranchName === 'string' || brandOrBranchName == null
      ? fallbackBrand(brandOrBranchName as string | undefined)
      : brandOrBranchName;

  doc.setFillColor(...BRAND.primary);
  doc.rect(0, 0, 210, 8, 'F');
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  setColor(doc, BRAND.primary);
  doc.text(brand.companyName.toUpperCase(), 14, 22);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  setColor(doc, BRAND.muted);
  let yy = 28;
  if (brand.branch.name) { doc.text(brand.branch.name, 14, yy); yy += 4; }
  if (brand.branch.address) {
    const lines = doc.splitTextToSize(brand.branch.address, 100);
    doc.text(lines, 14, yy); yy += lines.length * 4;
  }
  const contact = [brand.branch.phone, brand.branch.email].filter(Boolean).join('  •  ');
  if (contact) { doc.text(contact, 14, yy); yy += 4; }
  if (brand.branch.gstin) { doc.text(`GSTIN: ${brand.branch.gstin}`, 14, yy); yy += 4; }

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  setColor(doc, BRAND.text);
  doc.text(title, 196, 22, { align: 'right' });

  if (meta) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    setColor(doc, BRAND.muted);
    let my = 28;
    if (meta.docNumber) { doc.text(`# ${meta.docNumber}`, 196, my, { align: 'right' }); my += 4; }
    if (meta.issueDate) { doc.text(`Date: ${meta.issueDate}`, 196, my, { align: 'right' }); my += 4; }
  }
}

function footer(doc: jsPDF, brand?: BrandContext) {
  const b = brand || DEFAULT_BRAND;
  const pageH = doc.internal.pageSize.height;
  setColor(doc, BRAND.muted);
  doc.setFontSize(8);
  const line1 = `Generated ${new Date().toLocaleString('en-IN')} • ${b.legalName}`;
  doc.text(line1, 105, pageH - 12, { align: 'center' });
  const line2 = [b.website, b.supportEmail].filter(Boolean).join('  •  ');
  if (line2) doc.text(line2, 105, pageH - 7, { align: 'center' });
}

// Trigger a browser download for a blob.
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

// Open a blob in a new tab for printing.
export function printBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const w = window.open(url, '_blank');
  if (w) {
    w.addEventListener('load', () => w.print(), { once: true });
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

// Number to words (Indian, simple) for payslip.
export function rupeesInWords(num: number): string {
  num = Math.round(num);
  if (num === 0) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const inWords = (n: number): string => {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + inWords(n % 10000000) : '');
  };
  return inWords(num).trim() + ' Rupees Only';
}

// ---------- INVOICE ----------
export interface InvoicePdfInput {
  invoice_number: string;
  created_at: string;
  due_date?: string | null;
  status: string;
  subtotal: number;
  discount_amount?: number | null;
  tax_amount?: number | null;
  gst_rate?: number | null;
  total_amount: number;
  amount_paid?: number | null;
  notes?: string | null;
  is_gst_invoice?: boolean | null;
  customer_gstin?: string | null;
  items: Array<{ description: string; quantity: number; unit_price: number; total_amount: number; hsn_code?: string }>;
  member_name: string;
  member_code?: string | null;
  member_email?: string | null;
  member_phone?: string | null;
  branch_name: string;
  branch_address?: string | null;
  branch_phone?: string | null;
  branch_email?: string | null;
  gst_number?: string | null;
}

export function buildInvoicePdf(data: InvoicePdfInput, brand?: BrandContext): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const title = data.is_gst_invoice ? 'TAX INVOICE' : 'INVOICE';
  const resolvedBrand: BrandContext = brand || {
    ...DEFAULT_BRAND,
    branch: {
      name: data.branch_name,
      address: data.branch_address ?? null,
      phone: data.branch_phone ?? null,
      email: data.branch_email ?? null,
      gstin: data.gst_number ?? null,
    },
  };
  header(doc, title, resolvedBrand, {
    docNumber: data.invoice_number,
    issueDate: new Date(data.created_at).toLocaleDateString('en-IN'),
  });

  let y = 56;
  setColor(doc, BRAND.muted);
  doc.setFontSize(9);
  if (data.due_date) doc.text(`Due: ${new Date(data.due_date).toLocaleDateString('en-IN')}`, 196, y, { align: 'right' });
  doc.text(`Status: ${(data.status || '').toUpperCase()}`, 196, y + 5, { align: 'right' });

  // Bill to
  y = 70;
  doc.setFillColor(248, 250, 252);
  doc.rect(14, y, 90, 26, 'F');
  setColor(doc, BRAND.muted);
  doc.setFontSize(8);
  doc.text('BILL TO', 17, y + 5);
  setColor(doc, BRAND.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text(data.member_name, 17, y + 11);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, BRAND.muted);
  if (data.member_code) doc.text(data.member_code, 17, y + 16);
  if (data.member_email) doc.text(data.member_email, 17, y + 20);
  if (data.member_phone) doc.text(data.member_phone, 17, y + 24);
  if (data.customer_gstin) doc.text(`GSTIN: ${data.customer_gstin}`, 60, y + 24);

  // Items table
  const showHsn = !!data.is_gst_invoice && data.items.some(i => i.hsn_code);
  const head = showHsn
    ? [['Description', 'HSN', 'Qty', 'Rate', 'Amount']]
    : [['Description', 'Qty', 'Rate', 'Amount']];
  const body = data.items.map(i => showHsn
    ? [i.description, i.hsn_code || '-', String(i.quantity || 1), inr(i.unit_price), inr(i.total_amount)]
    : [i.description, String(i.quantity || 1), inr(i.unit_price), inr(i.total_amount)],
  );

  autoTable(doc, {
    startY: y + 32,
    head,
    body,
    theme: 'grid',
    headStyles: { fillColor: BRAND.primary, textColor: 255, fontStyle: 'bold', fontSize: 9 },
    bodyStyles: { fontSize: 9, textColor: BRAND.text },
    columnStyles: showHsn
      ? { 1: { halign: 'center' }, 2: { halign: 'center' }, 3: { halign: 'right' }, 4: { halign: 'right' } }
      : { 1: { halign: 'center' }, 2: { halign: 'right' }, 3: { halign: 'right' } },
    margin: { left: 14, right: 14 },
  });

  // Totals
  const tableEnd = (doc as any).lastAutoTable.finalY + 6;
  const right = 196;
  const labelX = 140;
  doc.setFontSize(9);
  setColor(doc, BRAND.muted);
  let ty = tableEnd;
  const row = (label: string, value: string, color?: [number, number, number]) => {
    setColor(doc, BRAND.muted);
    doc.text(label, labelX, ty);
    if (color) setColor(doc, color); else setColor(doc, BRAND.text);
    doc.text(value, right, ty, { align: 'right' });
    ty += 5;
  };
  row('Subtotal', inr(data.subtotal));
  if ((data.discount_amount || 0) > 0) row('Discount', `-${inr(data.discount_amount!)}`, BRAND.success);
  if ((data.tax_amount || 0) > 0) {
    const half = (data.tax_amount || 0) / 2;
    const rate = data.gst_rate ? ` @ ${data.gst_rate / 2}%` : '';
    row(`CGST${rate}`, inr(half));
    row(`SGST${rate}`, inr(half));
  }
  doc.setLineWidth(0.4);
  doc.setDrawColor(...BRAND.text);
  doc.line(labelX, ty, right, ty);
  ty += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  setColor(doc, BRAND.text);
  doc.text('Total', labelX, ty);
  doc.text(inr(data.total_amount), right, ty, { align: 'right' });
  ty += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  if ((data.amount_paid || 0) > 0) row('Paid', inr(data.amount_paid!), BRAND.success);
  const due = data.total_amount - (data.amount_paid || 0);
  if (due > 0) {
    doc.setFont('helvetica', 'bold');
    row('Balance Due', inr(due), BRAND.danger);
    doc.setFont('helvetica', 'normal');
  }

  if (data.notes) {
    ty += 6;
    setColor(doc, BRAND.muted);
    doc.setFontSize(8);
    doc.text('Notes:', 14, ty);
    setColor(doc, BRAND.text);
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(data.notes, 180);
    doc.text(lines, 14, ty + 4);
  }

  footer(doc, resolvedBrand);
  return doc.output('blob');
}

// ---------- PAYMENT RECEIPT ----------
export interface PaymentReceiptInput {
  receipt_number: string;
  payment_date: string;
  amount: number;
  payment_method: string;
  transaction_id?: string | null;
  invoice_number?: string | null;
  member_name: string;
  member_code?: string | null;
  branch_name: string;
  branch_address?: string | null;
  notes?: string | null;
  invoice_total?: number | null;
  invoice_paid?: number | null;
}

export function buildPaymentReceiptPdf(data: PaymentReceiptInput, brand?: BrandContext): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const resolvedBrand: BrandContext = brand || {
    ...DEFAULT_BRAND,
    branch: { name: data.branch_name, address: data.branch_address ?? null },
  };
  header(doc, 'PAYMENT RECEIPT', resolvedBrand, {
    docNumber: data.receipt_number,
    issueDate: new Date(data.payment_date).toLocaleString('en-IN'),
  });

  let y = 56;
  setColor(doc, BRAND.muted);

  y += 12;
  doc.setFillColor(240, 253, 244);
  doc.rect(14, y, 182, 24, 'F');
  setColor(doc, BRAND.success);
  doc.setFontSize(10);
  doc.text('AMOUNT RECEIVED', 105, y + 8, { align: 'center' });
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text(inr(data.amount), 105, y + 19, { align: 'center' });
  doc.setFont('helvetica', 'normal');

  y += 32;
  setColor(doc, BRAND.text);
  doc.setFontSize(10);
  const rows: Array<[string, string]> = [
    ['Received From', data.member_name + (data.member_code ? ` (${data.member_code})` : '')],
    ['Payment Method', data.payment_method.toUpperCase()],
  ];
  if (data.invoice_number) rows.push(['Invoice', data.invoice_number]);
  if (data.transaction_id) rows.push(['Transaction ID', data.transaction_id]);
  if (typeof data.invoice_total === 'number') {
    rows.push(['Invoice Total', inr(data.invoice_total)]);
    rows.push(['Total Paid', inr(data.invoice_paid || 0)]);
    const bal = (data.invoice_total || 0) - (data.invoice_paid || 0);
    if (bal > 0) rows.push(['Balance Due', inr(bal)]);
  }
  if (data.notes) rows.push(['Notes', data.notes]);

  autoTable(doc, {
    startY: y,
    body: rows,
    theme: 'plain',
    bodyStyles: { fontSize: 10, textColor: BRAND.text },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50, textColor: BRAND.muted } },
    margin: { left: 14, right: 14 },
  });

  footer(doc, resolvedBrand);
  return doc.output('blob');
}

// ---------- DIET / WORKOUT PLAN ----------
export interface PlanPdfInput {
  name: string;
  type: 'workout' | 'diet';
  description?: string | null;
  caloriesTarget?: number | null;
  validFrom?: string | null;
  validUntil?: string | null;
  data: any;
  member_name?: string | null;
  member_code?: string | null;
  trainer_name?: string | null;
  goal?: string | null;
  notes?: string | null;
  branch_name?: string | null;
}

export function buildPlanPdf(input: PlanPdfInput, brand?: BrandContext): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const title = input.type === 'workout' ? 'WORKOUT PLAN' : 'DIET PLAN';
  const resolvedBrand: BrandContext = brand || fallbackBrand(input.branch_name || undefined);
  header(doc, title, resolvedBrand, {
    issueDate: new Date().toLocaleDateString('en-IN'),
  });

  let y = 58;
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  setColor(doc, BRAND.text);
  doc.text(input.name, 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, BRAND.muted);
  const headerLines: string[] = [];
  if (input.member_name) headerLines.push(`Member: ${input.member_name}${input.member_code ? ` (${input.member_code})` : ''}`);
  if (input.trainer_name) headerLines.push(`Trainer: ${input.trainer_name}`);
  if (input.goal) headerLines.push(`Goal: ${input.goal}`);
  headerLines.forEach(line => { doc.text(line, 14, y); y += 4; });
  if (input.description) {
    const lines = doc.splitTextToSize(input.description, 180);
    doc.text(lines, 14, y);
    y += lines.length * 4 + 2;
  }
  const meta: string[] = [];
  if (input.validFrom) meta.push(`From ${new Date(input.validFrom).toLocaleDateString('en-IN')}`);
  if (input.validUntil) meta.push(`To ${new Date(input.validUntil).toLocaleDateString('en-IN')}`);
  if (input.caloriesTarget) meta.push(`Target ${input.caloriesTarget} kcal/day`);
  if (meta.length) { doc.text(meta.join('  •  '), 14, y); y += 6; }
  y += 2;

  if (input.type === 'workout') {
    const weeks = input.data?.weeks || (input.data?.days ? [{ week: 1, days: input.data.days }] : []);
    weeks.forEach((week: any, wi: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      setColor(doc, BRAND.primary);
      doc.text(`Week ${week.week || wi + 1}`, 14, y);
      y += 5;
      (week.days || []).forEach((day: any, di: number) => {
        const rows = (day.exercises || []).map((ex: any) => {
          const name = typeof ex === 'string' ? ex : ex.name || '';
          const sets = ex.sets ? `${ex.sets}` : '';
          const reps = ex.reps ? `${ex.reps}` : '';
          const rest = ex.rest || (ex.rest_seconds ? `${ex.rest_seconds}s` : '');
          return [name, sets, reps, rest];
        });
        autoTable(doc, {
          startY: y,
          head: [[day.day || day.label || `Day ${di + 1}${day.focus ? ' — ' + day.focus : ''}`, 'Sets', 'Reps', 'Rest']],
          body: rows.length ? rows : [['Rest day', '', '', '']],
          theme: 'striped',
          headStyles: { fillColor: [241, 245, 249], textColor: BRAND.text, fontStyle: 'bold', fontSize: 9 },
          bodyStyles: { fontSize: 9, textColor: BRAND.text },
          columnStyles: { 1: { halign: 'center', cellWidth: 18 }, 2: { halign: 'center', cellWidth: 22 }, 3: { halign: 'center', cellWidth: 22 } },
          margin: { left: 14, right: 14 },
        });
        y = (doc as any).lastAutoTable.finalY + 4;
      });
      y += 2;
    });
  } else {
    const meals = input.data?.meals || input.data?.days?.[0]?.meals || [];
    if (meals.length) {
      const rows = meals.map((m: any) => [
        m.meal || m.name || '-',
        m.time || '-',
        m.items ? (Array.isArray(m.items) ? m.items.join(', ') : String(m.items)) : (m.description || '-'),
        m.calories ? `${m.calories} kcal` : '-',
      ]);
      autoTable(doc, {
        startY: y,
        head: [['Meal', 'Time', 'Items', 'Calories']],
        body: rows,
        theme: 'striped',
        headStyles: { fillColor: BRAND.primary, textColor: 255, fontSize: 9 },
        bodyStyles: { fontSize: 9, textColor: BRAND.text },
        columnStyles: { 3: { halign: 'right', cellWidth: 24 } },
        margin: { left: 14, right: 14 },
      });
    } else {
      doc.text('No meals defined.', 14, y);
    }
  }

  if (input.notes) {
    y = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 6 : y + 6;
    setColor(doc, BRAND.muted);
    doc.setFontSize(8);
    doc.text('Notes:', 14, y);
    setColor(doc, BRAND.text);
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(input.notes, 180);
    doc.text(lines, 14, y + 4);
  }

  footer(doc, resolvedBrand);
  return doc.output('blob');
}

// ---------- PAYSLIP ----------
export interface PayslipPdfInput {
  employee_name: string;
  employee_code?: string | null;
  designation?: string | null;
  period_label: string;        // e.g. "Sep 2026"
  period_start: string;
  period_end: string;
  attendance: {
    present?: number; half_day?: number; late?: number; missing_checkout?: number;
    leave?: number; holiday?: number; weekly_off?: number; absent?: number;
    payable_days?: number; total_days?: number; monthly_salary?: number;
  };
  earnings: { base: number; pt_commission: number; ot: number; bonus: number };
  deductions: { deductions: number; advance: number; penalty: number };
  gross: number;
  net: number;
  payment_method?: string | null;
  payment_reference?: string | null;
  paid_date?: string | null;
  prepared_by?: string | null;
  notes?: string | null;
}

export function buildPayslipPdf(data: PayslipPdfInput, brand: BrandContext): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  header(doc, 'PAYSLIP', brand, {
    docNumber: data.period_label,
    issueDate: new Date().toLocaleDateString('en-IN'),
  });

  let y = 58;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  setColor(doc, BRAND.text);
  doc.text(data.employee_name, 14, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  setColor(doc, BRAND.muted);
  const sub = [data.employee_code, data.designation].filter(Boolean).join(' • ');
  if (sub) { doc.text(sub, 14, y + 5); }
  doc.text(
    `Period: ${new Date(data.period_start).toLocaleDateString('en-IN')} – ${new Date(data.period_end).toLocaleDateString('en-IN')}`,
    196, y, { align: 'right' },
  );

  // Attendance summary
  y += 14;
  const a = data.attendance || {};
  autoTable(doc, {
    startY: y,
    head: [['Present', 'Half', 'Late', 'Missing', 'Leave', 'Holiday', 'Off', 'Absent', 'Payable']],
    body: [[
      String(a.present ?? 0), String(a.half_day ?? 0), String(a.late ?? 0),
      String(a.missing_checkout ?? 0), String(a.leave ?? 0), String(a.holiday ?? 0),
      String(a.weekly_off ?? 0), String(a.absent ?? 0), String(a.payable_days ?? 0),
    ]],
    theme: 'grid',
    headStyles: { fillColor: BRAND.primary, textColor: 255, fontSize: 8 },
    bodyStyles: { fontSize: 9, halign: 'center' },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  // Earnings + deductions side-by-side
  const earningsRows: Array<[string, string]> = [
    ['Basic / Pro-rated', inr(data.earnings.base)],
    ['PT Commission', inr(data.earnings.pt_commission)],
    ['Overtime', inr(data.earnings.ot)],
    ['Bonus', inr(data.earnings.bonus)],
    ['Gross Earnings', inr(data.gross)],
  ];
  const deductionRows: Array<[string, string]> = [
    ['Deductions', inr(data.deductions.deductions)],
    ['Advance', inr(data.deductions.advance)],
    ['Penalty', inr(data.deductions.penalty)],
    ['Total Deductions', inr(data.deductions.deductions + data.deductions.advance + data.deductions.penalty)],
  ];

  autoTable(doc, {
    startY: y,
    head: [['Earnings', '']],
    body: earningsRows,
    theme: 'grid',
    headStyles: { fillColor: [16, 185, 129], textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right', cellWidth: 40 } },
    margin: { left: 14, right: 110 },
    tableWidth: 88,
  });
  autoTable(doc, {
    startY: y,
    head: [['Deductions', '']],
    body: deductionRows,
    theme: 'grid',
    headStyles: { fillColor: BRAND.danger, textColor: 255, fontSize: 9 },
    bodyStyles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right', cellWidth: 40 } },
    margin: { left: 108, right: 14 },
    tableWidth: 88,
  });

  const ny = Math.max(
    (doc as any).lastAutoTable.finalY,
    (doc as any).previousAutoTable?.finalY || 0,
  ) + 8;

  // Net pay
  doc.setFillColor(238, 242, 255);
  doc.rect(14, ny, 182, 18, 'F');
  setColor(doc, BRAND.primary);
  doc.setFontSize(10);
  doc.text('NET PAY', 18, ny + 7);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  setColor(doc, BRAND.text);
  doc.text(inr(data.net), 192, ny + 9, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  setColor(doc, BRAND.muted);
  doc.text(rupeesInWords(data.net), 18, ny + 14);

  let py = ny + 24;
  doc.setFontSize(9);
  setColor(doc, BRAND.muted);
  if (data.payment_method) { doc.text(`Payment: ${data.payment_method.toUpperCase()}${data.payment_reference ? ` (${data.payment_reference})` : ''}`, 14, py); py += 4; }
  if (data.paid_date) { doc.text(`Paid on: ${new Date(data.paid_date).toLocaleDateString('en-IN')}`, 14, py); py += 4; }
  if (data.prepared_by) { doc.text(`Prepared by: ${data.prepared_by}`, 14, py); py += 4; }
  if (data.notes) {
    py += 2;
    doc.text('Notes: ' + data.notes, 14, py);
  }

  footer(doc, brand);
  return doc.output('blob');
}

// ---------- CONTRACT ----------
export interface ContractPdfInput {
  contract_number?: string | null;
  employee_name: string;
  employee_code?: string | null;
  position?: string | null;
  department?: string | null;
  contract_type: string;
  start_date: string;
  end_date?: string | null;
  salary: number;
  salary_type?: string | null;
  terms?: string | null;
  prepared_by?: string | null;
}

export function buildContractPdf(data: ContractPdfInput, brand: BrandContext): Blob {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  header(doc, 'EMPLOYMENT CONTRACT', brand, {
    docNumber: data.contract_number || undefined,
    issueDate: new Date().toLocaleDateString('en-IN'),
  });

  let y = 58;
  doc.setFontSize(10);
  setColor(doc, BRAND.text);
  doc.setFont('helvetica', 'bold');
  doc.text('Between', 14, y); y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(`${brand.legalName} ("Company")`, 14, y); y += 5;
  if (brand.branch.address) {
    const lines = doc.splitTextToSize(brand.branch.address, 180);
    doc.text(lines, 14, y); y += lines.length * 4;
  }
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.text('And', 14, y); y += 5;
  doc.setFont('helvetica', 'normal');
  doc.text(`${data.employee_name}${data.employee_code ? ` (${data.employee_code})` : ''} ("Employee")`, 14, y);
  y += 8;

  autoTable(doc, {
    startY: y,
    body: [
      ['Position', data.position || '-'],
      ['Department', data.department || '-'],
      ['Contract Type', data.contract_type],
      ['Start Date', new Date(data.start_date).toLocaleDateString('en-IN')],
      ['End Date', data.end_date ? new Date(data.end_date).toLocaleDateString('en-IN') : 'Open-ended'],
      ['Salary', `${inr(data.salary)}${data.salary_type ? ` / ${data.salary_type}` : ''}`],
    ],
    theme: 'plain',
    bodyStyles: { fontSize: 10 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 50, textColor: BRAND.muted } },
    margin: { left: 14, right: 14 },
  });
  y = (doc as any).lastAutoTable.finalY + 6;

  if (data.terms) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    setColor(doc, BRAND.text);
    doc.text('Terms & Conditions', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(data.terms, 180);
    doc.text(lines, 14, y);
    y += lines.length * 4 + 6;
  }

  // Signature blocks
  const pageH = doc.internal.pageSize.height;
  const sy = Math.max(y, pageH - 50);
  doc.setLineWidth(0.3);
  doc.setDrawColor(...BRAND.muted);
  doc.line(20, sy, 90, sy);
  doc.line(120, sy, 190, sy);
  setColor(doc, BRAND.muted);
  doc.setFontSize(9);
  doc.text('Company Representative', 20, sy + 5);
  doc.text('Employee Signature', 120, sy + 5);

  footer(doc, brand);
  return doc.output('blob');
}

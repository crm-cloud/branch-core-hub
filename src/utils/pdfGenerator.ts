// PDF generation utility for fitness plans and contracts

interface PlanData {
  name: string;
  description?: string;
  type: 'workout' | 'diet';
  data: any;
  validFrom?: string;
  validUntil?: string;
  caloriesTarget?: number;
}

interface ContractData {
  employeeName: string;
  employeeCode: string;
  employeeEmail?: string;
  employeePhone?: string;
  position?: string;
  department?: string;
  startDate: string;
  endDate?: string;
  salary: number;
  salaryType?: string;
  contractType: string;
  terms?: any;
  companyName?: string;
  companyAddress?: string;
}

function escapeHtml(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeContractTerms(terms: unknown, startDate?: string, companyAddress?: string): string {
  if (!terms) return '';
  let content = '';

  if (typeof terms === 'string') content = terms;
  if (typeof terms === 'object') {
    const candidate = (terms as { conditions?: unknown }).conditions;
    if (typeof candidate === 'string') content = candidate;
    else content = JSON.stringify(terms, null, 2);
  }
  if (!content) content = String(terms);

  const readableDate = startDate
    ? new Date(startDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });
  const resolvedCompanyAddress = companyAddress || 'Udaipur, Rajasthan';

  // Normalize legacy placeholders from older saved contracts.
  content = content.replace(
    /This Employment Agreement \("Agreement"\) is executed on this ___ day of ________, 20__ at __________\./g,
    `This Employment Agreement ("Agreement") is executed on ${readableDate} at ${resolvedCompanyAddress}.`,
  );
  content = content.replace(
    /Having its principal place of business at:\s*_+/g,
    `Having its principal place of business at: ${resolvedCompanyAddress}`,
  );

  return content;
}

function renderContractTermsHtml(terms: unknown, startDate?: string, companyAddress?: string): string {
  const raw = normalizeContractTerms(terms, startDate, companyAddress).trim();
  if (!raw) {
    return '<p style="font-size:13px;color:#666;">No terms added.</p>';
  }

  const lines = raw.split(/\r?\n/);
  const htmlLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed) return '<br/>';

    const headingMatch = trimmed.match(/^#{1,6}\s+(.*)$/);
    if (headingMatch) {
      return `<p style="font-weight:700;margin:12px 0 4px;">${escapeHtml(headingMatch[1])}</p>`;
    }

    if (trimmed === '---') {
      return '<hr style="border:none;border-top:1px solid #ddd;margin:10px 0;"/>';
    }

    if (/^[-*]\s+/.test(trimmed)) {
      return `<p style="margin:4px 0 4px 14px;">• ${escapeHtml(trimmed.replace(/^[-*]\s+/, ''))}</p>`;
    }

    if (/^\[[ xX]\]\s+/.test(trimmed)) {
      const checked = /^\[[xX]\]\s+/.test(trimmed) ? '☑' : '☐';
      return `<p style="margin:4px 0;">${checked} ${escapeHtml(trimmed.replace(/^\[[ xX]\]\s+/, ''))}</p>`;
    }

    return `<p style="margin:4px 0;">${escapeHtml(trimmed)}</p>`;
  });

  return htmlLines.join('');
}

/**
 * @deprecated For fitness plans use `downloadPlanPdf` from `src/utils/planPdf.ts`
 * (jsPDF/autoTable, branded, identical to what we send members). This legacy
 * print-window generator is retained only for HRM/contracts/invoices that still
 * rely on the print-dialog UX. Do NOT add new fitness callers here.
 */
export function generatePlanPDF(plan: PlanData): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to download PDF');
    return;
  }

  const isWorkout = plan.type === 'workout';
  const planData = plan.data || {};

  let contentHTML = '';

  if (isWorkout) {
    contentHTML = generateWorkoutContent(planData);
  } else {
    contentHTML = generateDietContent(planData, plan.caloriesTarget);
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>${plan.name} - ${isWorkout ? 'Workout' : 'Diet'} Plan</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          padding: 40px;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 20px;
          border-bottom: 2px solid #6366f1;
        }
        .header h1 {
          color: #6366f1;
          font-size: 28px;
          margin-bottom: 8px;
        }
        .header p {
          color: #666;
          font-size: 14px;
        }
        .meta {
          background: #f8f9fa;
          padding: 15px;
          border-radius: 8px;
          margin-bottom: 25px;
          display: flex;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 10px;
        }
        .meta-item {
          font-size: 13px;
        }
        .meta-item strong {
          color: #6366f1;
        }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          font-size: 18px;
          color: #6366f1;
          margin-bottom: 15px;
          padding-bottom: 8px;
          border-bottom: 1px solid #e5e7eb;
        }
        .day-card {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 15px;
          margin-bottom: 15px;
        }
        .day-title {
          font-weight: 600;
          color: #333;
          margin-bottom: 10px;
          font-size: 16px;
        }
        .exercise-list, .meal-list {
          list-style: none;
        }
        .exercise-list li, .meal-list li {
          padding: 8px 0;
          border-bottom: 1px solid #e5e7eb;
          font-size: 14px;
        }
        .exercise-list li:last-child, .meal-list li:last-child {
          border-bottom: none;
        }
        .exercise-detail {
          color: #666;
          font-size: 12px;
          margin-top: 3px;
        }
        .calories-badge {
          background: #6366f1;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 11px;
          margin-left: 8px;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 12px;
          color: #999;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
        }
        @media print {
          body { padding: 20px; }
          .day-card { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${escapeHtml(plan.name)}</h1>
        <p>${escapeHtml(plan.description || (isWorkout ? 'Personalized Workout Plan' : 'Personalized Diet Plan'))}</p>
      </div>
      
      <div class="meta">
        <div class="meta-item"><strong>Type:</strong> ${isWorkout ? 'Workout Plan' : 'Diet Plan'}</div>
        ${plan.validFrom ? `<div class="meta-item"><strong>Start:</strong> ${new Date(plan.validFrom).toLocaleDateString()}</div>` : ''}
        ${plan.validUntil ? `<div class="meta-item"><strong>End:</strong> ${new Date(plan.validUntil).toLocaleDateString()}</div>` : ''}
        ${plan.caloriesTarget ? `<div class="meta-item"><strong>Daily Calories:</strong> ${plan.caloriesTarget} kcal</div>` : ''}
      </div>

      ${contentHTML}

      <div class="footer">
        <p>Generated on ${new Date().toLocaleDateString()} • This plan is personalized for you</p>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  
  // Wait for content to load then print
  printWindow.onload = () => {
    printWindow.print();
  };
}

export function generateContractPDF(contract: ContractData): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to download PDF');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Employment Contract - ${contract.employeeName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          padding: 36px;
          color: #0f172a;
          max-width: 900px;
          margin: 0 auto;
          line-height: 1.55;
          background: #ffffff;
        }
        .header {
          text-align: center;
          margin-bottom: 30px;
          padding-bottom: 18px;
          border-bottom: 2px solid #0f172a;
        }
        .company-name {
          font-size: 24px;
          font-weight: 700;
          letter-spacing: 0.5px;
        }
        .company-address {
          font-size: 13px;
          color: #475569;
          margin-top: 6px;
        }
        .title {
          font-size: 20px;
          font-weight: 700;
          text-align: center;
          margin: 22px 0 26px;
          color: #1e293b;
        }
        .section {
          margin-bottom: 18px;
        }
        .section-title {
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 10px;
          letter-spacing: 0.6px;
          color: #334155;
          text-transform: uppercase;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px 16px;
          margin-bottom: 16px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 14px;
        }
        .info-item {
          font-size: 13px;
        }
        .info-item label {
          font-weight: 600;
          display: block;
          margin-bottom: 2px;
          color: #475569;
        }
        .terms-box {
          background: #ffffff;
          padding: 20px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          margin: 18px 0;
        }
        .signature-section {
          margin-top: 36px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 30px;
        }
        .signature-box {
          text-align: center;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 16px 12px;
        }
        .signature-line {
          border-top: 1px solid #334155;
          margin-top: 50px;
          padding-top: 10px;
          font-size: 12px;
          color: #334155;
        }
        .footer {
          margin-top: 30px;
          text-align: center;
          font-size: 11px;
          color: #64748b;
        }
        @media print {
          body { padding: 24px; }
          .signature-section { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">${escapeHtml(contract.companyName || 'FITNESS CENTER')}</div>
        <div class="company-address">${escapeHtml(contract.companyAddress || 'Udaipur, Rajasthan')}</div>
      </div>

      <div class="title">EMPLOYMENT CONTRACT</div>

      <div class="section">
        <div class="section-title">Employee Details</div>
        <div class="info-grid">
          <div class="info-item">
            <label>Employee Name:</label>
            <span>${escapeHtml(contract.employeeName)}</span>
          </div>
          <div class="info-item">
            <label>Employee Code:</label>
            <span>${escapeHtml(contract.employeeCode)}</span>
          </div>
          <div class="info-item">
            <label>Email:</label>
            <span>${escapeHtml(contract.employeeEmail || '-')}</span>
          </div>
          <div class="info-item">
            <label>Phone:</label>
            <span>${escapeHtml(contract.employeePhone || '-')}</span>
          </div>
          <div class="info-item">
            <label>Position:</label>
            <span>${escapeHtml(contract.position || '-')}</span>
          </div>
          <div class="info-item">
            <label>Department:</label>
            <span>${escapeHtml(contract.department || '-')}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Contract Details</div>
        <div class="info-grid">
          <div class="info-item">
            <label>Contract Type:</label>
            <span>${escapeHtml(contract.contractType)}</span>
          </div>
          <div class="info-item">
            <label>Salary Type:</label>
            <span>${escapeHtml(contract.salaryType || 'Monthly')}</span>
          </div>
          <div class="info-item">
            <label>Start Date:</label>
            <span>${new Date(contract.startDate).toLocaleDateString('en-IN')}</span>
          </div>
          <div class="info-item">
            <label>End Date:</label>
            <span>${contract.endDate ? new Date(contract.endDate).toLocaleDateString('en-IN') : 'Ongoing'}</span>
          </div>
          <div class="info-item">
            <label>Monthly Salary:</label>
            <span>₹${contract.salary.toLocaleString('en-IN')}</span>
          </div>
        </div>
      </div>

      <div class="terms-box">
        <div class="section-title">Terms & Conditions</div>
        ${renderContractTermsHtml(contract.terms, contract.startDate, contract.companyAddress || 'Udaipur, Rajasthan')}
      </div>

      <div class="signature-section">
        <div class="signature-box">
          <div class="signature-line">
            Employee Signature<br/>
            <small>Date: _______________</small>
          </div>
        </div>
        <div class="signature-box">
          <div class="signature-line">
            Employer Signature<br/>
            <small>Date: _______________</small>
          </div>
        </div>
      </div>

      <div class="footer">
        <p>This is a computer-generated document. Generated on ${new Date().toLocaleDateString('en-IN')}</p>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  
  printWindow.onload = () => {
    printWindow.print();
  };
}

function generateWorkoutContent(data: any): string {
  let html = '';

  // Newer shape: weeks → days → exercises
  if (data.weeks && Array.isArray(data.weeks) && data.weeks.length > 0) {
    data.weeks.forEach((week: any, wIdx: number) => {
      html += '<div class="section">';
      html += `<h2 class="section-title">Week ${escapeHtml(week.week || wIdx + 1)}</h2>`;
      (week.days || []).forEach((day: any, dIdx: number) => {
        html += `
          <div class="day-card">
            <div class="day-title">${escapeHtml(day.day || day.label || `Day ${dIdx + 1}`)}${day.focus ? ` — ${escapeHtml(day.focus)}` : ''}</div>
            <ul class="exercise-list">
        `;
        (day.exercises || []).forEach((ex: any) => {
          const name = typeof ex === 'string' ? ex : ex.name;
          const sets = ex.sets ? `${escapeHtml(ex.sets)} sets` : '';
          const reps = ex.reps ? ` × ${escapeHtml(ex.reps)} reps` : '';
          const rest = ex.rest ? escapeHtml(ex.rest) : (ex.rest_seconds ? `${escapeHtml(ex.rest_seconds)}s rest` : '');
          html += `<li><strong>${escapeHtml(name)}</strong>${sets || reps || rest ? `<div class="exercise-detail">${[sets + reps, rest].filter(Boolean).join(' • ')}</div>` : ''}</li>`;
        });
        html += '</ul></div>';
      });
      html += '</div>';
    });
    return html;
  }

  if (data.days && Array.isArray(data.days)) {
    html += '<div class="section">';
    html += '<h2 class="section-title">Weekly Schedule</h2>';
    
    data.days.forEach((day: any, index: number) => {
      html += `
        <div class="day-card">
          <div class="day-title">${escapeHtml(day.name || `Day ${index + 1}`)}</div>
          <ul class="exercise-list">
      `;
      
      if (day.exercises && Array.isArray(day.exercises)) {
        day.exercises.forEach((exercise: any) => {
          const exName = typeof exercise === 'string' ? exercise : exercise.name;
          html += `
            <li>
              <strong>${escapeHtml(exName)}</strong>
              ${exercise.sets ? `<div class="exercise-detail">${escapeHtml(exercise.sets)} sets × ${escapeHtml(exercise.reps)} reps ${exercise.weight ? `@ ${escapeHtml(exercise.weight)}` : ''}</div>` : ''}
            </li>
          `;
        });
      }
      
      html += '</ul></div>';
    });
    
    html += '</div>';
  } else if (data.exercises && Array.isArray(data.exercises)) {
    html += '<div class="section">';
    html += '<h2 class="section-title">Exercises</h2>';
    html += '<div class="day-card"><ul class="exercise-list">';
    
    data.exercises.forEach((exercise: any) => {
      const name = typeof exercise === 'string' ? exercise : exercise.name;
      html += `<li><strong>${escapeHtml(name)}</strong></li>`;
    });
    
    html += '</ul></div></div>';
  } else {
    html += '<div class="section"><p>No workout details available</p></div>';
  }
  
  return html;
}

function generateDietContent(data: any, caloriesTarget?: number): string {
  let html = '';
  
  if (caloriesTarget) {
    html += `
      <div class="section">
        <h2 class="section-title">Daily Target</h2>
        <div class="day-card">
          <p><strong>Calories:</strong> ${caloriesTarget} kcal/day</p>
        </div>
      </div>
    `;
  }
  
  const meals = data.meals || data;

  // Newer shape: meals is an array of MealEntry objects
  if (Array.isArray(meals) && meals.length > 0) {
    html += '<div class="section">';
    html += '<h2 class="section-title">Meal Plan</h2>';
    meals.forEach((meal: any, idx: number) => {
      html += `
        <div class="day-card">
          <div class="day-title">${escapeHtml(meal.name || `Meal ${idx + 1}`)}${meal.time ? ` <span style="font-weight:400;color:#666;font-size:13px;">· ${escapeHtml(meal.time)}</span>` : ''}${meal.calories ? `<span class="calories-badge">${Math.round(Number(meal.calories) || 0)} kcal</span>` : ''}</div>
          <ul class="meal-list">
      `;
      const items = Array.isArray(meal.items) ? meal.items : [];
      if (items.length === 0) {
        html += `<li>${escapeHtml(meal.meal || meal.description || '—')}</li>`;
      } else {
        items.forEach((it: any) => {
          if (typeof it === 'string') {
            html += `<li>${escapeHtml(it)}</li>`;
          } else {
            const food = it.food || it.name || '';
            const qty = it.quantity ? ` <span style="color:#666;">(${escapeHtml(it.quantity)})</span>` : '';
            const cals = it.calories ? `<span class="calories-badge">${Math.round(Number(it.calories) || 0)} kcal</span>` : '';
            html += `<li>${escapeHtml(food)}${qty}${cals}</li>`;
          }
        });
      }
      html += '</ul></div>';
    });
    html += '</div>';
    if (data.hydration) html += `<div class="section"><h2 class="section-title">Hydration</h2><div class="day-card"><p>${escapeHtml(data.hydration)}</p></div></div>`;
    if (data.notes) html += `<div class="section"><h2 class="section-title">Notes</h2><div class="day-card"><p>${escapeHtml(data.notes)}</p></div></div>`;
    return html;
  }

  if (meals && typeof meals === 'object') {
    html += '<div class="section">';
    html += '<h2 class="section-title">Meal Plan</h2>';
    
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];
    
    mealTypes.forEach((mealType) => {
      const mealData = meals[mealType];
      if (mealData) {
        html += `
          <div class="day-card">
            <div class="day-title">${escapeHtml(mealType.charAt(0).toUpperCase() + mealType.slice(1))}</div>
            <ul class="meal-list">
        `;
        
        if (Array.isArray(mealData)) {
          mealData.forEach((item: any) => {
            const name = typeof item === 'string' ? item : item.name;
            const calories = typeof item === 'object' ? item.calories : null;
            html += `<li>${escapeHtml(name)}${calories ? `<span class="calories-badge">${Math.round(Number(calories) || 0)} kcal</span>` : ''}</li>`;
          });
        } else if (typeof mealData === 'string') {
          html += `<li>${escapeHtml(mealData)}</li>`;
        }
        
        html += '</ul></div>';
      }
    });
    
    html += '</div>';
  } else {
    html += '<div class="section"><p>No diet details available</p></div>';
  }
  
  return html;
}
// ========== PAYSLIP PDF ==========
interface PayslipData {
  employeeName: string;
  employeeCode: string;
  month: string;
  baseSalary: number;
  daysPresent: number;
  workingDays: number;
  proRatedPay: number;
  ptCommission: number;
  grossPay: number;
  pfDeduction: number;
  netPay: number;
  department?: string;
  position?: string;
  companyName?: string;
}

export function generatePayslipPDF(data: PayslipData): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to download PDF');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Payslip - ${escapeHtml(data.employeeName)} - ${escapeHtml(data.month)}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 3px solid #6366f1; }
        .header h1 { color: #6366f1; font-size: 22px; }
        .header p { color: #666; font-size: 13px; margin-top: 5px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 25px; background: #f8f9fa; padding: 15px; border-radius: 8px; }
        .info-item { font-size: 13px; }
        .info-item strong { color: #6366f1; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f1f5f9; text-align: left; padding: 10px; font-size: 13px; border-bottom: 2px solid #e2e8f0; }
        td { padding: 10px; font-size: 13px; border-bottom: 1px solid #e2e8f0; }
        .amount { text-align: right; font-weight: 600; }
        .deduction { color: #ef4444; }
        .total-row { background: #f0fdf4; font-weight: 700; }
        .total-row td { border-top: 2px solid #22c55e; font-size: 15px; }
        .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #999; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${escapeHtml(data.companyName || 'PAYSLIP')}</h1>
        <p>Pay Period: ${escapeHtml(data.month)}</p>
      </div>
      <div class="info-grid">
        <div class="info-item"><strong>Employee:</strong> ${escapeHtml(data.employeeName)}</div>
        <div class="info-item"><strong>Code:</strong> ${escapeHtml(data.employeeCode)}</div>
        <div class="info-item"><strong>Department:</strong> ${escapeHtml(data.department || '-')}</div>
        <div class="info-item"><strong>Position:</strong> ${escapeHtml(data.position || '-')}</div>
        <div class="info-item"><strong>Days Present:</strong> ${data.daysPresent} / ${data.workingDays}</div>
        <div class="info-item"><strong>Base Salary:</strong> ₹${data.baseSalary.toLocaleString('en-IN')}</div>
      </div>
      <table>
        <thead><tr><th>Component</th><th class="amount">Amount (₹)</th></tr></thead>
        <tbody>
          <tr><td>Pro-rated Base Pay</td><td class="amount">${data.proRatedPay.toLocaleString('en-IN')}</td></tr>
          <tr><td>PT Session Commission</td><td class="amount">${data.ptCommission.toLocaleString('en-IN')}</td></tr>
          <tr><td><strong>Gross Pay</strong></td><td class="amount"><strong>${data.grossPay.toLocaleString('en-IN')}</strong></td></tr>
          <tr><td class="deduction">PF Deduction (12%)</td><td class="amount deduction">-${data.pfDeduction.toLocaleString('en-IN')}</td></tr>
          <tr class="total-row"><td>Net Pay</td><td class="amount">₹${data.netPay.toLocaleString('en-IN')}</td></tr>
        </tbody>
      </table>
      <div class="footer">
        <p>Generated on ${new Date().toLocaleDateString('en-IN')} • This is a computer-generated payslip</p>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => { printWindow.print(); };
}

// ========== INVOICE PDF ==========
interface InvoiceItem {
  description: string;
  quantity: number;
  unit_price: number;
  total_amount: number;
  hsn_code?: string;
}

interface InvoicePDFData {
  invoice_number: string;
  created_at: string;
  due_date?: string;
  status: string;
  subtotal: number;
  discount_amount?: number;
  tax_amount?: number;
  total_amount: number;
  amount_paid: number;
  notes?: string;
  items: InvoiceItem[];
  member_name: string;
  member_code?: string;
  member_email?: string;
  member_phone?: string;
  branch_name: string;
  branch_address?: string;
  branch_phone?: string;
  branch_email?: string;
  branch_state?: string;
  gst_number?: string;
  logo_url?: string;
  is_gst_invoice?: boolean;
  gst_rate?: number;
  customer_gstin?: string;
}

export function generateInvoicePDF(data: InvoicePDFData): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) { alert('Please allow popups to download PDF'); return; }

  const due = data.total_amount - (data.amount_paid || 0);
  const statusColors: Record<string, string> = {
    paid: '#22c55e', pending: '#f59e0b', partial: '#3b82f6', overdue: '#ef4444', cancelled: '#94a3b8',
  };
  const statusColor = statusColors[data.status] || '#94a3b8';
  const gstRate = data.gst_rate || 0;
  const cgstRate = gstRate / 2;
  const sgstRate = gstRate / 2;
  const taxHalf = (data.tax_amount || 0) / 2;
  const invoiceTitle = data.is_gst_invoice ? 'TAX INVOICE' : 'INVOICE';

  const showHsnColumn = data.is_gst_invoice && data.items.some(i => i.hsn_code);

  const itemRows = data.items.map(i => `
    <tr>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;">${escapeHtml(i.description)}</td>
      ${showHsnColumn ? `<td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:12px;text-align:center;color:#64748b;">${i.hsn_code || '-'}</td>` : ''}
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:center;">${i.quantity || 1}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:right;">₹${i.unit_price.toLocaleString('en-IN')}</td>
      <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:13px;text-align:right;">₹${i.total_amount.toLocaleString('en-IN')}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html><html><head>
    <title>Invoice ${data.invoice_number}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif; padding:40px; color:#1e293b; max-width:800px; margin:0 auto; background:#fff; }
      @media print { body { padding:20px; } .no-print { display:none; } }
    </style>
  </head><body>
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:30px;padding-bottom:20px;border-bottom:3px solid #6366f1;">
      <div>
        ${data.logo_url ? `<img src="${escapeHtml(data.logo_url)}" alt="Logo" style="height:50px;margin-bottom:8px;">` : ''}
        <h1 style="font-size:24px;color:#6366f1;font-weight:800;">Incline Fitness</h1>
        <p style="font-size:12px;color:#64748b;margin-top:4px;">${escapeHtml(data.branch_name)}</p>
        <p style="font-size:12px;color:#64748b;">${escapeHtml(data.branch_address || '')}</p>
        <p style="font-size:12px;color:#64748b;">${escapeHtml(data.branch_phone || '')} ${data.branch_email ? '· ' + escapeHtml(data.branch_email) : ''}</p>
        ${data.gst_number ? `<p style="font-size:11px;color:#94a3b8;margin-top:4px;">GSTIN: ${escapeHtml(data.gst_number)}</p>` : ''}
      </div>
      <div style="text-align:right;">
        <h2 style="font-size:28px;font-weight:800;color:#1e293b;">${escapeHtml(invoiceTitle)}</h2>
        <p style="font-size:14px;font-family:monospace;color:#64748b;margin-top:4px;">${escapeHtml(data.invoice_number)}</p>
        <span style="display:inline-block;background:${statusColor};color:#fff;padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;text-transform:uppercase;margin-top:8px;">${escapeHtml(data.status)}</span>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px;">
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
        <p style="font-size:10px;color:#94a3b8;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Bill To</p>
        <p style="font-weight:600;">${escapeHtml(data.member_name)}</p>
        ${data.member_code ? `<p style="font-size:12px;color:#64748b;font-family:monospace;">${escapeHtml(data.member_code)}</p>` : ''}
        ${data.member_email ? `<p style="font-size:12px;color:#64748b;">${escapeHtml(data.member_email)}</p>` : ''}
        ${data.member_phone ? `<p style="font-size:12px;color:#64748b;">${escapeHtml(data.member_phone)}</p>` : ''}
        ${data.customer_gstin ? `<p style="font-size:11px;color:#94a3b8;margin-top:4px;">GSTIN: ${escapeHtml(data.customer_gstin)}</p>` : ''}
      </div>
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;text-align:right;">
        <p style="font-size:12px;color:#64748b;">Date: <strong>${new Date(data.created_at).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</strong></p>
        ${data.due_date ? `<p style="font-size:12px;color:#64748b;margin-top:4px;">Due: <strong>${new Date(data.due_date).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</strong></p>` : ''}
      </div>
    </div>

    <table style="width:100%;border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <thead><tr style="background:#f1f5f9;">
        <th style="padding:10px 12px;font-size:11px;text-align:left;color:#64748b;text-transform:uppercase;">Description</th>
        ${showHsnColumn ? '<th style="padding:10px 12px;font-size:11px;text-align:center;color:#64748b;text-transform:uppercase;">HSN/SAC</th>' : ''}
        <th style="padding:10px 12px;font-size:11px;text-align:center;color:#64748b;text-transform:uppercase;">Qty</th>
        <th style="padding:10px 12px;font-size:11px;text-align:right;color:#64748b;text-transform:uppercase;">Rate</th>
        <th style="padding:10px 12px;font-size:11px;text-align:right;color:#64748b;text-transform:uppercase;">Amount</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>

    <div style="display:flex;justify-content:flex-end;margin-bottom:30px;">
      <div style="width:280px;">
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;"><span style="color:#64748b;">Subtotal</span><span>₹${data.subtotal.toLocaleString('en-IN')}</span></div>
        ${(data.discount_amount || 0) > 0 ? `<div style="display:flex;justify-content:space-between;padding:6px 0;font-size:13px;color:#22c55e;"><span>Discount</span><span>-₹${(data.discount_amount || 0).toLocaleString('en-IN')}</span></div>` : ''}
        ${(data.tax_amount || 0) > 0 ? `
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#64748b;"><span>CGST${cgstRate ? ' @ ' + cgstRate + '%' : ''}</span><span>₹${taxHalf.toLocaleString('en-IN')}</span></div>
          <div style="display:flex;justify-content:space-between;padding:4px 0;font-size:12px;color:#64748b;"><span>SGST${sgstRate ? ' @ ' + sgstRate + '%' : ''}</span><span>₹${taxHalf.toLocaleString('en-IN')}</span></div>
        ` : ''}
        <hr style="border:none;border-top:2px solid #1e293b;margin:8px 0;">
        <div style="display:flex;justify-content:space-between;padding:6px 0;font-size:18px;font-weight:800;"><span>Total</span><span>₹${data.total_amount.toLocaleString('en-IN')}</span></div>
        ${data.amount_paid > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:13px;color:#22c55e;"><span>Paid</span><span>₹${data.amount_paid.toLocaleString('en-IN')}</span></div>` : ''}
        ${due > 0 ? `<div style="display:flex;justify-content:space-between;padding:4px 0;font-size:14px;font-weight:600;color:#ef4444;"><span>Balance Due</span><span>₹${due.toLocaleString('en-IN')}</span></div>` : ''}
      </div>
    </div>

    ${data.notes ? `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:20px;"><p style="font-size:12px;color:#64748b;">${escapeHtml(data.notes)}</p></div>` : ''}

    <div style="text-align:center;margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;">
      ${data.is_gst_invoice && data.branch_state ? `<p style="font-size:10px;color:#94a3b8;margin-bottom:4px;">Subject to ${data.branch_state} jurisdiction</p>` : ''}
      <p style="font-size:11px;color:#94a3b8;">Thank you for choosing Incline Fitness!</p>
      <p style="font-size:10px;color:#cbd5e1;margin-top:4px;">Generated on ${new Date().toLocaleDateString('en-IN')} • The Incline Life by Incline</p>
    </div>
  </body></html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => { printWindow.print(); };
}

// ========== THERMAL RECEIPT (80mm) ==========
export function generateThermalReceipt(data: InvoicePDFData): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) { alert('Please allow popups'); return; }

  const due = data.total_amount - (data.amount_paid || 0);
  const itemRows = data.items.map(i =>
    `<tr><td style="font-size:11px;padding:2px 0;">${escapeHtml(i.description)}</td>
     <td style="font-size:11px;text-align:center;padding:2px 0;">${i.quantity || 1}</td>
     <td style="font-size:11px;text-align:right;padding:2px 0;">₹${i.total_amount.toLocaleString('en-IN')}</td></tr>`
  ).join('');

  const html = `<!DOCTYPE html><html><head>
    <title>Receipt ${data.invoice_number}</title>
    <style>
      * { margin:0; padding:0; box-sizing:border-box; }
      body { font-family:'Courier New',Courier,monospace; width:302px; margin:0 auto; padding:10px; color:#000; font-size:12px; }
      .dash { border-top:1px dashed #000; margin:6px 0; }
      @media print { body { width:80mm; padding:4mm; } @page { size:80mm auto; margin:0; } }
    </style>
  </head><body>
    <div style="text-align:center;margin-bottom:6px;">
      <strong style="font-size:14px;">INCLINE FITNESS</strong><br>
      <span style="font-size:10px;">${escapeHtml(data.branch_name)}</span><br>
      ${data.branch_phone ? `<span style="font-size:10px;">Tel: ${escapeHtml(data.branch_phone)}</span><br>` : ''}
      ${data.gst_number ? `<span style="font-size:9px;">GSTIN: ${escapeHtml(data.gst_number)}</span>` : ''}
    </div>
    <div class="dash"></div>
    <div style="display:flex;justify-content:space-between;font-size:11px;">
      <span>${escapeHtml(data.invoice_number)}</span>
      <span>${new Date(data.created_at).toLocaleDateString('en-IN')}</span>
    </div>
    <div style="font-size:11px;margin:2px 0;">Customer: ${escapeHtml(data.member_name)}</div>
    <div class="dash"></div>
    <table style="width:100%;border-collapse:collapse;">
      <tr><th style="font-size:10px;text-align:left;padding:2px 0;">ITEM</th><th style="font-size:10px;text-align:center;">QTY</th><th style="font-size:10px;text-align:right;">AMT</th></tr>
      ${itemRows}
    </table>
    <div class="dash"></div>
    <div style="display:flex;justify-content:space-between;font-size:12px;"><span>Subtotal</span><span>₹${data.subtotal.toLocaleString('en-IN')}</span></div>
    ${(data.discount_amount || 0) > 0 ? `<div style="display:flex;justify-content:space-between;font-size:11px;"><span>Discount</span><span>-₹${(data.discount_amount || 0).toLocaleString('en-IN')}</span></div>` : ''}
    ${(data.tax_amount || 0) > 0 ? `
      <div style="display:flex;justify-content:space-between;font-size:11px;"><span>CGST${data.gst_rate ? ' @' + (data.gst_rate/2) + '%' : ''}</span><span>₹${((data.tax_amount||0)/2).toLocaleString('en-IN')}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:11px;"><span>SGST${data.gst_rate ? ' @' + (data.gst_rate/2) + '%' : ''}</span><span>₹${((data.tax_amount||0)/2).toLocaleString('en-IN')}</span></div>
    ` : ''}
    <div class="dash"></div>
    <div style="display:flex;justify-content:space-between;font-size:14px;font-weight:bold;"><span>TOTAL</span><span>₹${data.total_amount.toLocaleString('en-IN')}</span></div>
    ${data.amount_paid > 0 ? `<div style="display:flex;justify-content:space-between;font-size:11px;"><span>Paid</span><span>₹${data.amount_paid.toLocaleString('en-IN')}</span></div>` : ''}
    ${due > 0 ? `<div style="display:flex;justify-content:space-between;font-size:12px;font-weight:bold;"><span>DUE</span><span>₹${due.toLocaleString('en-IN')}</span></div>` : ''}
    <div class="dash"></div>
    <div style="text-align:center;font-size:10px;margin-top:6px;">
      <p>Thank you! Visit again.</p>
      <p style="margin-top:4px;">${new Date().toLocaleString('en-IN')}</p>
    </div>
  </body></html>`;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => { printWindow.print(); };
}
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
        <h1>${plan.name}</h1>
        <p>${plan.description || (isWorkout ? 'Personalized Workout Plan' : 'Personalized Diet Plan')}</p>
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
          font-family: 'Times New Roman', serif; 
          padding: 50px;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          line-height: 1.6;
        }
        .header {
          text-align: center;
          margin-bottom: 40px;
          padding-bottom: 20px;
          border-bottom: 3px double #333;
        }
        .company-name {
          font-size: 24px;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 2px;
        }
        .company-address {
          font-size: 12px;
          color: #666;
          margin-top: 5px;
        }
        .title {
          font-size: 20px;
          font-weight: bold;
          text-align: center;
          margin: 30px 0;
          text-decoration: underline;
        }
        .section {
          margin-bottom: 25px;
        }
        .section-title {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 10px;
          text-transform: uppercase;
        }
        .info-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 15px;
          margin-bottom: 20px;
        }
        .info-item {
          font-size: 13px;
        }
        .info-item label {
          font-weight: bold;
          display: block;
          margin-bottom: 3px;
        }
        .terms-box {
          background: #f9f9f9;
          padding: 20px;
          border: 1px solid #ddd;
          margin: 20px 0;
        }
        .terms-box ol {
          margin-left: 20px;
        }
        .terms-box li {
          margin-bottom: 10px;
          font-size: 13px;
        }
        .signature-section {
          margin-top: 60px;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 50px;
        }
        .signature-box {
          text-align: center;
        }
        .signature-line {
          border-top: 1px solid #333;
          margin-top: 60px;
          padding-top: 10px;
          font-size: 12px;
        }
        .footer {
          margin-top: 40px;
          text-align: center;
          font-size: 11px;
          color: #999;
        }
        @media print {
          body { padding: 30px; }
          .signature-section { break-inside: avoid; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="company-name">${contract.companyName || 'FITNESS CENTER'}</div>
        <div class="company-address">${contract.companyAddress || 'Address to be filled'}</div>
      </div>

      <div class="title">EMPLOYMENT CONTRACT</div>

      <div class="section">
        <div class="section-title">Employee Details</div>
        <div class="info-grid">
          <div class="info-item">
            <label>Employee Name:</label>
            <span>${contract.employeeName}</span>
          </div>
          <div class="info-item">
            <label>Employee Code:</label>
            <span>${contract.employeeCode}</span>
          </div>
          <div class="info-item">
            <label>Email:</label>
            <span>${contract.employeeEmail || '___________________'}</span>
          </div>
          <div class="info-item">
            <label>Phone:</label>
            <span>${contract.employeePhone || '___________________'}</span>
          </div>
          <div class="info-item">
            <label>Position:</label>
            <span>${contract.position || '___________________'}</span>
          </div>
          <div class="info-item">
            <label>Department:</label>
            <span>${contract.department || '___________________'}</span>
          </div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Contract Details</div>
        <div class="info-grid">
          <div class="info-item">
            <label>Contract Type:</label>
            <span>${contract.contractType}</span>
          </div>
          <div class="info-item">
            <label>Salary Type:</label>
            <span>${contract.salaryType || 'Monthly'}</span>
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
        <ol>
          <li>The Employee agrees to perform their duties diligently and to the best of their abilities.</li>
          <li>Working hours shall be as per the organization's standard policy.</li>
          <li>The Employee shall maintain confidentiality of all business information.</li>
          <li>Either party may terminate this contract with a notice period of 30 days.</li>
          <li>The Employee shall adhere to all company policies and procedures.</li>
          <li>Salary shall be paid on or before the 7th of each month.</li>
          <li>The Employee is entitled to leaves as per company policy.</li>
          <li>Any disputes shall be resolved through mutual discussion.</li>
        </ol>
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
  
  if (data.days && Array.isArray(data.days)) {
    html += '<div class="section">';
    html += '<h2 class="section-title">Weekly Schedule</h2>';
    
    data.days.forEach((day: any, index: number) => {
      html += `
        <div class="day-card">
          <div class="day-title">${day.name || `Day ${index + 1}`}</div>
          <ul class="exercise-list">
      `;
      
      if (day.exercises && Array.isArray(day.exercises)) {
        day.exercises.forEach((exercise: any) => {
          html += `
            <li>
              <strong>${exercise.name || exercise}</strong>
              ${exercise.sets ? `<div class="exercise-detail">${exercise.sets} sets × ${exercise.reps} reps ${exercise.weight ? `@ ${exercise.weight}` : ''}</div>` : ''}
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
      html += `<li><strong>${name}</strong></li>`;
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
  
  if (meals && typeof meals === 'object') {
    html += '<div class="section">';
    html += '<h2 class="section-title">Meal Plan</h2>';
    
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'];
    
    mealTypes.forEach((mealType) => {
      const mealData = meals[mealType];
      if (mealData) {
        html += `
          <div class="day-card">
            <div class="day-title">${mealType.charAt(0).toUpperCase() + mealType.slice(1)}</div>
            <ul class="meal-list">
        `;
        
        if (Array.isArray(mealData)) {
          mealData.forEach((item: any) => {
            const name = typeof item === 'string' ? item : item.name;
            const calories = typeof item === 'object' ? item.calories : null;
            html += `<li>${name}${calories ? `<span class="calories-badge">${calories} kcal</span>` : ''}</li>`;
          });
        } else if (typeof mealData === 'string') {
          html += `<li>${mealData}</li>`;
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
      <title>Payslip - ${data.employeeName} - ${data.month}</title>
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
        <h1>${data.companyName || 'PAYSLIP'}</h1>
        <p>Pay Period: ${data.month}</p>
      </div>
      <div class="info-grid">
        <div class="info-item"><strong>Employee:</strong> ${data.employeeName}</div>
        <div class="info-item"><strong>Code:</strong> ${data.employeeCode}</div>
        <div class="info-item"><strong>Department:</strong> ${data.department || '-'}</div>
        <div class="info-item"><strong>Position:</strong> ${data.position || '-'}</div>
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
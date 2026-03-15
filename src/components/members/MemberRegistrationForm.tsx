import { format } from 'date-fns';

interface RegistrationFormData {
  memberName: string;
  memberCode: string;
  email?: string;
  phone?: string;
  gender?: string;
  dateOfBirth?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  planName?: string;
  startDate?: string;
  endDate?: string;
  pricePaid?: number;
  branchName?: string;
}

export function printRegistrationForm(data: RegistrationFormData) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to print');
    return;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Membership Registration - ${data.memberName}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', sans-serif; padding: 40px; color: #333; max-width: 800px; margin: 0 auto; }
        .header { text-align: center; margin-bottom: 30px; padding-bottom: 15px; border-bottom: 3px double #6366f1; }
        .header h1 { color: #6366f1; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; }
        .header p { color: #666; font-size: 12px; margin-top: 5px; }
        .title { font-size: 18px; font-weight: bold; text-align: center; margin: 20px 0; text-decoration: underline; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 14px; font-weight: bold; color: #6366f1; margin-bottom: 10px; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .info-item { font-size: 13px; }
        .info-item label { font-weight: 600; display: block; margin-bottom: 2px; color: #555; }
        .info-item .value { padding: 6px 0; border-bottom: 1px dotted #ccc; min-height: 28px; }
        .terms { background: #f9f9f9; padding: 15px; border: 1px solid #ddd; margin: 20px 0; font-size: 12px; }
        .terms ol { margin-left: 18px; }
        .terms li { margin-bottom: 6px; }
        .signature-section { margin-top: 50px; display: grid; grid-template-columns: 1fr 1fr; gap: 40px; }
        .signature-box { text-align: center; }
        .signature-line { border-top: 1px solid #333; margin-top: 50px; padding-top: 8px; font-size: 12px; }
        .footer { margin-top: 30px; text-align: center; font-size: 10px; color: #999; }
        @media print { body { padding: 20px; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>${data.branchName || 'FITNESS CENTER'}</h1>
        <p>Membership Registration Form</p>
      </div>

      <div class="title">MEMBERSHIP AGREEMENT</div>

      <div class="section">
        <div class="section-title">Member Details</div>
        <div class="info-grid">
          <div class="info-item"><label>Full Name</label><div class="value">${data.memberName}</div></div>
          <div class="info-item"><label>Member Code</label><div class="value">${data.memberCode}</div></div>
          <div class="info-item"><label>Email</label><div class="value">${data.email || '___________________'}</div></div>
          <div class="info-item"><label>Phone</label><div class="value">${data.phone || '___________________'}</div></div>
          <div class="info-item"><label>Gender</label><div class="value">${data.gender || '___________________'}</div></div>
          <div class="info-item"><label>Date of Birth</label><div class="value">${data.dateOfBirth ? format(new Date(data.dateOfBirth), 'dd MMM yyyy') : '___________________'}</div></div>
          <div class="info-item" style="grid-column: span 2"><label>Address</label><div class="value">${data.address || '___________________'}</div></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Emergency Contact</div>
        <div class="info-grid">
          <div class="info-item"><label>Name</label><div class="value">${data.emergencyContactName || '___________________'}</div></div>
          <div class="info-item"><label>Phone</label><div class="value">${data.emergencyContactPhone || '___________________'}</div></div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">Membership Details</div>
        <div class="info-grid">
          <div class="info-item"><label>Plan</label><div class="value">${data.planName || '___________________'}</div></div>
          <div class="info-item"><label>Amount Paid</label><div class="value">${data.pricePaid ? '₹' + data.pricePaid.toLocaleString('en-IN') : '___________________'}</div></div>
          <div class="info-item"><label>Start Date</label><div class="value">${data.startDate ? format(new Date(data.startDate), 'dd MMM yyyy') : '___________________'}</div></div>
          <div class="info-item"><label>End Date</label><div class="value">${data.endDate ? format(new Date(data.endDate), 'dd MMM yyyy') : '___________________'}</div></div>
        </div>
      </div>

      <div class="terms">
        <div class="section-title" style="color: #333;">Terms & Conditions</div>
        <ol>
          <li>I hereby acknowledge that I am medically fit to exercise and participate in fitness activities.</li>
          <li>I understand that the membership fee is non-refundable and non-transferable.</li>
          <li>I agree to follow all gym rules, regulations, and safety guidelines.</li>
          <li>I will use equipment responsibly and report any damage immediately.</li>
          <li>The management reserves the right to revoke membership for misconduct.</li>
          <li>Membership freezing is subject to applicable charges and approval.</li>
          <li>Personal belongings must be secured in lockers. The gym is not responsible for lost items.</li>
          <li>I consent to the storage and use of my personal data for membership management purposes.</li>
        </ol>
      </div>

      <div class="signature-section">
        <div class="signature-box">
          <div class="signature-line">Member Signature<br/><small>Date: _______________</small></div>
        </div>
        <div class="signature-box">
          <div class="signature-line">Staff Signature<br/><small>Date: _______________</small></div>
        </div>
      </div>

      <div class="footer">
        <p>Generated on ${new Date().toLocaleDateString('en-IN')} • This is a computer-generated document</p>
      </div>
    </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.onload = () => printWindow.print();
}

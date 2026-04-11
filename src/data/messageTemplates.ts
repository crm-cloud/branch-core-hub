export interface MessageTemplate {
  id: string;
  name: string;
  category: 'welcome' | 'reminder' | 'promotion' | 'followup' | 'general' | 'payment' | 'class' | 'facility' | 'pt';
  type: 'sms' | 'email' | 'whatsapp';
  subject?: string;
  content: string;
}

export const messageTemplates: MessageTemplate[] = [
  // ── WhatsApp Templates ──
  {
    id: 'welcome-new-member',
    name: 'New Member Welcome',
    category: 'welcome',
    type: 'whatsapp',
    content: `🎉 Welcome to Incline Fitness, {{name}}!\n\nWe're thrilled to have you as part of our fitness family.\n\n📍 Your Member ID: {{member_code}}\n📅 Plan: {{plan_name}}\n📅 Valid until: {{end_date}}\n\nSee you at the gym! 💪`,
  },
  {
    id: 'trial-welcome',
    name: 'Trial Day Welcome',
    category: 'welcome',
    type: 'whatsapp',
    content: `Hi {{name}}! Welcome to your trial day at Incline Fitness 🎉\n\nOur trainer {{trainer_name}} will guide you. Enjoy!`,
  },
  {
    id: 'payment-received-wa',
    name: 'Payment Received',
    category: 'payment',
    type: 'whatsapp',
    content: `Hi {{name}}, your payment of ₹{{amount}} has been received ✅\n\nInvoice: {{invoice_number}}\nDate: {{date}}\n\nThank you for staying active with Incline Fitness! 💪`,
  },
  {
    id: 'payment-reminder-wa',
    name: 'Payment Reminder',
    category: 'payment',
    type: 'whatsapp',
    content: `Hi {{name}}, you have a pending payment of ₹{{amount}} at Incline Fitness.\n\nInvoice: {{invoice_number}}\nDue date: {{due_date}}\n\nPlease clear the dues at your earliest convenience.`,
  },
  {
    id: 'payment-overdue-wa',
    name: 'Payment Overdue',
    category: 'payment',
    type: 'whatsapp',
    content: `Hi {{name}}, your payment of ₹{{amount}} is overdue.\n\nInvoice: {{invoice_number}}\n\nPlease settle immediately to avoid service interruption.`,
  },
  {
    id: 'membership-expiry-whatsapp',
    name: 'Membership Expiry Reminder',
    category: 'reminder',
    type: 'whatsapp',
    content: `⏰ Hi {{name}}!\n\nYour Incline Fitness membership is expiring on {{end_date}}.\n\n🔄 Renew now and get:\n• Early bird discount\n• No registration fee\n• Free personal training session\n\nReply to renew or visit us. 💪`,
  },
  {
    id: 'freeze-confirmation-wa',
    name: 'Freeze Confirmation',
    category: 'general',
    type: 'whatsapp',
    content: `Hi {{name}}, your membership has been frozen ❄️\n\nFreeze period: {{freeze_start}} to {{freeze_end}}\n\nYour membership will automatically resume after the freeze period ends.`,
  },
  {
    id: 'unfreeze-confirmation-wa',
    name: 'Unfreeze Confirmation',
    category: 'general',
    type: 'whatsapp',
    content: `Hi {{name}}, your membership has been unfrozen ✅\n\nValid until: {{new_end_date}}\n\nWelcome back — see you at the gym! 💪`,
  },
  {
    id: 'class-booking-confirmed-wa',
    name: 'Class Booking Confirmed',
    category: 'class',
    type: 'whatsapp',
    content: `✅ Class Booked!\n\nHi {{name}}, you're registered for:\n📌 {{class_name}}\n📅 {{class_date}}\n⏰ {{class_time}}\n👤 Trainer: {{trainer_name}}\n\nPlease arrive 10 mins early. See you there! 🏃`,
  },
  {
    id: 'class-cancelled-wa',
    name: 'Class Booking Cancelled',
    category: 'class',
    type: 'whatsapp',
    content: `Hi {{name}}, your booking for {{class_name}} on {{class_date}} has been cancelled.\n\nYou can rebook anytime from our app or visit the front desk.`,
  },
  {
    id: 'class-reminder-wa',
    name: 'Class Reminder',
    category: 'class',
    type: 'whatsapp',
    content: `🔔 Reminder: Hi {{name}}, your {{class_name}} class starts in 1 hour at {{class_time}}!\n\nTrainer: {{trainer_name}}\nGet ready! 🏋️`,
  },
  {
    id: 'sauna-booking-wa',
    name: 'Sauna Booking Confirmed',
    category: 'facility',
    type: 'whatsapp',
    content: `🧖 Sauna Booked!\n\nHi {{name}}, your sauna session is confirmed:\n📅 {{date}}\n⏰ {{start_time}} - {{end_time}}\n\nPlease arrive on time. Enjoy!`,
  },
  {
    id: 'ice-bath-booking-wa',
    name: 'Ice Bath Booking Confirmed',
    category: 'facility',
    type: 'whatsapp',
    content: `🧊 Ice Bath Booked!\n\nHi {{name}}, your ice bath session is confirmed:\n📅 {{date}}\n⏰ {{start_time}} - {{end_time}}\n\nBring a towel and enjoy the recovery!`,
  },
  {
    id: 'facility-reminder-wa',
    name: 'Facility Slot Reminder',
    category: 'facility',
    type: 'whatsapp',
    content: `🔔 Reminder: Hi {{name}}, your {{facility_name}} session is in 30 minutes — {{date}} at {{time}}. Be ready!`,
  },
  {
    id: 'pt-session-booked-wa',
    name: 'PT Session Booked',
    category: 'pt',
    type: 'whatsapp',
    content: `💪 PT Session Booked!\n\nHi {{name}}, your session with {{trainer_name}} is confirmed:\n📅 {{date}}\n⏰ {{time}}\n\nGet ready for an amazing workout!`,
  },
  {
    id: 'pt-session-reminder-wa',
    name: 'PT Session Reminder',
    category: 'pt',
    type: 'whatsapp',
    content: `🔔 Hi {{name}}, your PT session with {{trainer_name}} starts in 1 hour at {{time}}.\n\nDon't forget your water bottle and towel!`,
  },
  {
    id: 'pt-pack-expiring-wa',
    name: 'PT Pack Expiring',
    category: 'pt',
    type: 'whatsapp',
    content: `Hi {{name}}, your PT package ({{package_name}}) has {{remaining_sessions}} sessions remaining and expires on {{expiry_date}}.\n\nBook now! Reply to schedule.`,
  },
  {
    id: 'special-offer',
    name: 'Special Offer',
    category: 'promotion',
    type: 'whatsapp',
    content: `🔥 SPECIAL OFFER at Incline Fitness!\n\nHi {{name}}!\n\nFor a limited time:\n✨ 20% OFF on annual memberships\n✨ FREE personal training session\n✨ No joining fee\n\n📅 Offer valid till {{offer_end_date}}\n\nDon't miss out!`,
  },
  {
    id: 'referral-offer',
    name: 'Referral Program',
    category: 'promotion',
    type: 'whatsapp',
    content: `🎁 REFER & EARN!\n\nHi {{name}}!\n\nRefer a friend to Incline Fitness and get:\n✅ 1 month FREE extension\n✅ ₹500 gym shop credit\n✅ Your friend gets 10% OFF!\n\nShare your referral code: {{referral_code}}`,
  },
  {
    id: 'missed-workout',
    name: 'Missed Workout Follow-up',
    category: 'followup',
    type: 'whatsapp',
    content: `👋 Hey {{name}}!\n\nWe noticed you haven't visited in {{days_absent}} days. Consistency is key! Even a 30-min session counts.\n\nWe're here to help! Reply or visit us. 💪`,
  },
  {
    id: 'lead-followup',
    name: 'Lead Follow-up',
    category: 'followup',
    type: 'whatsapp',
    content: `Hi {{name}}! 👋\n\nThanks for your interest in Incline Fitness!\n\nWould you like to:\n📍 Schedule a gym tour?\n🎯 Discuss your fitness goals?\n💰 Know about our membership plans?\n\nReply with your preferred time!`,
  },
  {
    id: 'birthday-wish',
    name: 'Birthday Wishes',
    category: 'general',
    type: 'whatsapp',
    content: `🎂 Happy Birthday, {{name}}! 🎉\n\nWishing you a fantastic year ahead!\n\n🎁 Here's a gift: {{gift_details}}\n\nFrom your Incline Fitness Family 🏋️`,
  },
  {
    id: 'feedback-request-wa',
    name: 'Feedback Request',
    category: 'general',
    type: 'whatsapp',
    content: `Hi {{name}}! We'd love to hear from you 🙏\n\nHow was your experience at Incline Fitness? Rate us 1-5 or share your thoughts. Your feedback helps us improve!`,
  },

  // ── Email Templates ──
  {
    id: 'welcome-email',
    name: 'Welcome Email',
    category: 'welcome',
    type: 'email',
    subject: 'Welcome to Incline Fitness! 🏋️',
    content: `Dear {{name}},\n\nWelcome to Incline Fitness! We're excited to have you join our community.\n\nYour membership details:\n- Member ID: {{member_code}}\n- Plan: {{plan_name}}\n- Valid until: {{end_date}}\n\nHere's what you can enjoy:\n✓ State-of-the-art equipment\n✓ Group fitness classes\n✓ Sauna & Ice Bath facilities\n✓ Personal training\n\nQuestions? Reply to this email or visit our front desk.\n\nBest regards,\nThe Incline Fitness Team`,
  },
  {
    id: 'payment-receipt-email',
    name: 'Payment Receipt Email',
    category: 'payment',
    type: 'email',
    subject: 'Payment Received — Incline Fitness',
    content: `Dear {{name}},\n\nThank you for your payment!\n\nPayment Details:\n• Amount: ₹{{amount}}\n• Invoice: {{invoice_number}}\n• Date: {{date}}\n\nYour payment has been successfully processed.\n\nKeep up the great work!\n\nBest regards,\nIncline Fitness`,
  },
  {
    id: 'payment-reminder-email',
    name: 'Payment Reminder Email',
    category: 'payment',
    type: 'email',
    subject: 'Payment Reminder — Incline Fitness',
    content: `Dear {{name}},\n\nThis is a reminder that you have a pending payment of ₹{{amount}}.\n\nInvoice: {{invoice_number}}\nDue Date: {{due_date}}\n\nPlease settle your dues at your earliest convenience.\n\nThank you,\nIncline Fitness`,
  },
  {
    id: 'renewal-reminder-email',
    name: 'Renewal Reminder Email',
    category: 'reminder',
    type: 'email',
    subject: 'Membership Renewal Reminder — Incline Fitness',
    content: `Dear {{name}},\n\nYour Incline Fitness membership ({{plan_name}}) is expiring on {{end_date}}.\n\nRenew now to:\n• Continue uninterrupted access\n• Avail early renewal discounts\n• Keep your membership benefits active\n\nVisit us or reply to this email to renew.\n\nBest regards,\nIncline Fitness`,
  },
  {
    id: 'class-booking-email',
    name: 'Class Booking Email',
    category: 'class',
    type: 'email',
    subject: 'Class Booking Confirmed — Incline Fitness',
    content: `Dear {{name}},\n\nYour class booking is confirmed!\n\n📌 Class: {{class_name}}\n📅 Date: {{date}}\n⏰ Time: {{time}}\n👤 Trainer: {{trainer_name}}\n\nPlease arrive 10 minutes early.\n\nBest regards,\nIncline Fitness`,
  },
  {
    id: 'facility-booking-email',
    name: 'Facility Booking Email',
    category: 'facility',
    type: 'email',
    subject: 'Facility Booking Confirmed — Incline Fitness',
    content: `Dear {{name}},\n\nYour {{facility_name}} booking is confirmed!\n\n📅 Date: {{date}}\n⏰ Time: {{start_time}} - {{end_time}}\n\nPlease arrive on time. Enjoy your session!\n\nBest regards,\nIncline Fitness`,
  },
  {
    id: 'pt-session-email',
    name: 'PT Session Email',
    category: 'pt',
    type: 'email',
    subject: 'PT Session Scheduled — Incline Fitness',
    content: `Dear {{name}},\n\nYour personal training session is scheduled!\n\n👤 Trainer: {{trainer_name}}\n📅 Date: {{date}}\n⏰ Time: {{time}}\n\nRemember to bring your water bottle and towel.\n\nSee you there!\nIncline Fitness`,
  },
  {
    id: 'birthday-email',
    name: 'Birthday Email',
    category: 'general',
    type: 'email',
    subject: '🎂 Happy Birthday from Incline Fitness!',
    content: `Dear {{name}},\n\nHappy Birthday! 🎉\n\nThe entire Incline Fitness team wishes you a wonderful birthday!\n\nAs a birthday gift: {{gift_details}}\n\nHave a fantastic day!\n\nWarm regards,\nIncline Fitness`,
  },
  {
    id: 'feedback-email',
    name: 'Feedback Request Email',
    category: 'general',
    type: 'email',
    subject: 'We\'d love your feedback — Incline Fitness',
    content: `Dear {{name}},\n\nWe hope you're enjoying your experience at Incline Fitness!\n\nWe'd love to hear your feedback. Your input helps us create a better experience for everyone.\n\nPlease reply with your thoughts.\n\nThank you!\nIncline Fitness`,
  },

  // ── SMS Templates ──
  {
    id: 'membership-expiry-sms',
    name: 'Membership Expiring SMS',
    category: 'reminder',
    type: 'sms',
    content: `Hi {{name}}, your Incline Fitness membership expires on {{end_date}}. Renew now! Visit us or call for renewal options.`,
  },
  {
    id: 'payment-reminder-sms',
    name: 'Payment Due SMS',
    category: 'payment',
    type: 'sms',
    content: `Hi {{name}}, pending payment of ₹{{amount}} at Incline Fitness. Invoice: {{invoice_number}}. Due: {{due_date}}.`,
  },
  {
    id: 'class-reminder-sms',
    name: 'Class Booking Reminder SMS',
    category: 'class',
    type: 'sms',
    content: `Hi {{name}}, your {{class_name}} class starts at {{class_time}} today. Trainer: {{trainer_name}}. Arrive 10 mins early. - Incline Fitness`,
  },
  {
    id: 'birthday-sms',
    name: 'Birthday SMS',
    category: 'general',
    type: 'sms',
    content: `Happy Birthday {{name}}! 🎂 Incline Fitness wishes you health & fitness. Visit today for your birthday surprise!`,
  },
  {
    id: 'trial-followup-sms',
    name: 'Trial Session Follow-up SMS',
    category: 'followup',
    type: 'sms',
    content: `Hi {{name}}! How was your trial at Incline Fitness? Sign up today and get a special offer! Call us or visit.`,
  },
];

export const getTemplatesByType = (type: 'sms' | 'email' | 'whatsapp') => {
  return messageTemplates.filter((t) => t.type === type);
};

export const getTemplatesByCategory = (category: MessageTemplate['category']) => {
  return messageTemplates.filter((t) => t.category === category);
};

// ── Branded HTML Email Templates ──

export function getWelcomeEmailHTML(vars: {
  name: string; member_code: string; plan_name: string; end_date: string;
  branch_name: string; branch_address: string; login_url?: string;
}) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:40px 32px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:28px;font-weight:700;">Welcome to Incline Fitness</h1>
    <p style="color:#e0e0ff;margin:8px 0 0;font-size:15px;">Your fitness journey starts here 💪</p>
  </td></tr>
  <tr><td style="padding:32px;">
    <p style="font-size:16px;color:#1e293b;margin:0 0 20px;">Hi <strong>${vars.name}</strong>,</p>
    <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 24px;">
      We're thrilled to have you join the Incline Fitness family! Here are your membership details:
    </p>
    <table width="100%" style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin:0 0 24px;">
      <tr><td style="padding:8px 12px;font-size:13px;color:#64748b;">Member ID</td><td style="padding:8px 12px;font-size:13px;font-weight:600;color:#1e293b;">${vars.member_code}</td></tr>
      <tr><td style="padding:8px 12px;font-size:13px;color:#64748b;">Plan</td><td style="padding:8px 12px;font-size:13px;font-weight:600;color:#1e293b;">${vars.plan_name}</td></tr>
      <tr><td style="padding:8px 12px;font-size:13px;color:#64748b;">Valid Until</td><td style="padding:8px 12px;font-size:13px;font-weight:600;color:#1e293b;">${vars.end_date}</td></tr>
      <tr><td style="padding:8px 12px;font-size:13px;color:#64748b;">Branch</td><td style="padding:8px 12px;font-size:13px;font-weight:600;color:#1e293b;">${vars.branch_name}</td></tr>
    </table>
    <p style="font-size:14px;color:#475569;line-height:1.6;margin:0 0 16px;">What you can enjoy:</p>
    <ul style="font-size:14px;color:#475569;line-height:2;padding-left:20px;margin:0 0 24px;">
      <li>State-of-the-art equipment</li><li>Group fitness classes</li>
      <li>Sauna & Ice Bath facilities</li><li>Personal training sessions</li>
    </ul>
    ${vars.login_url ? `<div style="text-align:center;margin:24px 0;">
      <a href="${vars.login_url}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;display:inline-block;">Login to Your Account</a>
    </div>` : ''}
    <p style="font-size:13px;color:#94a3b8;margin:24px 0 0;">📍 ${vars.branch_address}</p>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} Incline Fitness. All rights reserved.</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;
}

export function getInvoiceEmailHTML(vars: {
  name: string; invoice_number: string; date: string; due_date?: string;
  items: Array<{ description: string; qty: number; rate: number; amount: number }>;
  subtotal: number; tax_amount: number; discount: number; total: number;
  amount_paid: number; status: string;
  branch_name: string; branch_address: string; branch_phone: string; gst_number?: string;
  payment_link?: string;
}) {
  const due = vars.total - vars.amount_paid;
  const statusColor = vars.status === 'paid' ? '#22c55e' : vars.status === 'partial' ? '#3b82f6' : '#ef4444';
  const itemRows = vars.items.map(i => `
    <tr><td style="padding:10px 12px;font-size:13px;border-bottom:1px solid #f1f5f9;">${i.description}</td>
    <td style="padding:10px 12px;font-size:13px;text-align:center;border-bottom:1px solid #f1f5f9;">${i.qty}</td>
    <td style="padding:10px 12px;font-size:13px;text-align:right;border-bottom:1px solid #f1f5f9;">₹${i.rate.toLocaleString('en-IN')}</td>
    <td style="padding:10px 12px;font-size:13px;text-align:right;border-bottom:1px solid #f1f5f9;">₹${i.amount.toLocaleString('en-IN')}</td></tr>
  `).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:28px 32px;">
    <table width="100%"><tr>
      <td><h1 style="color:#ffffff;margin:0;font-size:22px;">Incline Fitness</h1>
        <p style="color:#94a3b8;margin:4px 0 0;font-size:12px;">${vars.branch_name} · ${vars.branch_phone}</p></td>
      <td style="text-align:right;"><span style="background:${statusColor};color:#fff;padding:6px 14px;border-radius:20px;font-size:12px;font-weight:600;text-transform:uppercase;">${vars.status}</span></td>
    </tr></table>
  </td></tr>
  <tr><td style="padding:32px;">
    <table width="100%" style="margin-bottom:24px;"><tr>
      <td><p style="margin:0;font-size:12px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.5px;">Invoice</p>
        <p style="margin:4px 0;font-size:18px;font-weight:700;color:#1e293b;">${vars.invoice_number}</p></td>
      <td style="text-align:right;"><p style="margin:0;font-size:12px;color:#94a3b8;">Date: ${vars.date}</p>
        ${vars.due_date ? `<p style="margin:2px 0;font-size:12px;color:#94a3b8;">Due: ${vars.due_date}</p>` : ''}</td>
    </tr></table>
    <p style="font-size:14px;color:#1e293b;margin:0 0 20px;">Dear <strong>${vars.name}</strong>,</p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin-bottom:20px;">
      <tr style="background:#f8fafc;">
        <th style="padding:10px 12px;font-size:12px;text-align:left;color:#64748b;text-transform:uppercase;">Description</th>
        <th style="padding:10px 12px;font-size:12px;text-align:center;color:#64748b;text-transform:uppercase;">Qty</th>
        <th style="padding:10px 12px;font-size:12px;text-align:right;color:#64748b;text-transform:uppercase;">Rate</th>
        <th style="padding:10px 12px;font-size:12px;text-align:right;color:#64748b;text-transform:uppercase;">Amount</th>
      </tr>
      ${itemRows}
    </table>
    <table width="100%" style="margin-bottom:24px;">
      <tr><td style="text-align:right;padding:4px 0;font-size:13px;color:#64748b;">Subtotal</td><td style="text-align:right;padding:4px 0;font-size:13px;width:120px;">₹${vars.subtotal.toLocaleString('en-IN')}</td></tr>
      ${vars.discount > 0 ? `<tr><td style="text-align:right;padding:4px 0;font-size:13px;color:#22c55e;">Discount</td><td style="text-align:right;padding:4px 0;font-size:13px;color:#22c55e;">-₹${vars.discount.toLocaleString('en-IN')}</td></tr>` : ''}
      ${vars.tax_amount > 0 ? `<tr><td style="text-align:right;padding:4px 0;font-size:13px;color:#64748b;">GST</td><td style="text-align:right;padding:4px 0;font-size:13px;">₹${vars.tax_amount.toLocaleString('en-IN')}</td></tr>` : ''}
      <tr><td colspan="2"><hr style="border:none;border-top:1px solid #e2e8f0;margin:8px 0;"></td></tr>
      <tr><td style="text-align:right;padding:4px 0;font-size:16px;font-weight:700;color:#1e293b;">Total</td><td style="text-align:right;padding:4px 0;font-size:16px;font-weight:700;color:#1e293b;">₹${vars.total.toLocaleString('en-IN')}</td></tr>
      ${vars.amount_paid > 0 ? `<tr><td style="text-align:right;padding:4px 0;font-size:13px;color:#22c55e;">Paid</td><td style="text-align:right;padding:4px 0;font-size:13px;color:#22c55e;">₹${vars.amount_paid.toLocaleString('en-IN')}</td></tr>` : ''}
      ${due > 0 ? `<tr><td style="text-align:right;padding:4px 0;font-size:14px;font-weight:600;color:#ef4444;">Balance Due</td><td style="text-align:right;padding:4px 0;font-size:14px;font-weight:600;color:#ef4444;">₹${due.toLocaleString('en-IN')}</td></tr>` : ''}
    </table>
    ${vars.payment_link && due > 0 ? `<div style="text-align:center;margin:24px 0;">
      <a href="${vars.payment_link}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:14px 40px;border-radius:8px;font-size:16px;font-weight:700;display:inline-block;">💳 Pay Now — ₹${due.toLocaleString('en-IN')}</a>
    </div>` : ''}
    ${vars.gst_number ? `<p style="font-size:11px;color:#94a3b8;margin:20px 0 0;">GSTIN: ${vars.gst_number}</p>` : ''}
  </td></tr>
  <tr><td style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-size:12px;color:#94a3b8;">${vars.branch_name} · ${vars.branch_address}</p>
    <p style="margin:4px 0 0;font-size:11px;color:#cbd5e1;">© ${new Date().getFullYear()} Incline Fitness</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

export function getPaymentLinkHTML(vars: {
  name: string; amount: number; description: string; payment_link: string;
  branch_name: string;
}) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f4f4f7;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:40px 0;">
<tr><td align="center">
<table width="500" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
  <tr><td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px;text-align:center;">
    <h1 style="color:#ffffff;margin:0;font-size:24px;">Incline Fitness</h1>
    <p style="color:#e0e0ff;margin:8px 0 0;font-size:14px;">${vars.branch_name}</p>
  </td></tr>
  <tr><td style="padding:32px;text-align:center;">
    <p style="font-size:16px;color:#1e293b;margin:0 0 8px;">Hi <strong>${vars.name}</strong>,</p>
    <p style="font-size:14px;color:#64748b;margin:0 0 24px;">${vars.description}</p>
    <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;margin:0 0 24px;">
      <p style="margin:0;font-size:14px;color:#64748b;">Amount Due</p>
      <p style="margin:8px 0 0;font-size:36px;font-weight:800;color:#1e293b;">₹${vars.amount.toLocaleString('en-IN')}</p>
    </div>
    <a href="${vars.payment_link}" style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#ffffff;text-decoration:none;padding:16px 48px;border-radius:8px;font-size:17px;font-weight:700;display:inline-block;box-shadow:0 4px 14px rgba(99,102,241,0.4);">💳 Pay Now</a>
    <p style="font-size:12px;color:#94a3b8;margin:20px 0 0;">Secure payment via Razorpay / PhonePe</p>
  </td></tr>
  <tr><td style="background:#f8fafc;padding:16px;text-align:center;border-top:1px solid #e2e8f0;">
    <p style="margin:0;font-size:11px;color:#cbd5e1;">© ${new Date().getFullYear()} Incline Fitness</p>
  </td></tr>
</table></td></tr></table></body></html>`;
}

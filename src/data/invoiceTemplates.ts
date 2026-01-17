export interface InvoiceMessageTemplate {
  id: string;
  name: string;
  type: 'whatsapp' | 'email' | 'sms';
  subject?: string;
  content: string;
}

export const invoiceTemplates: InvoiceMessageTemplate[] = [
  // WhatsApp Templates
  {
    id: 'invoice-whatsapp-new',
    name: 'New Invoice - WhatsApp',
    type: 'whatsapp',
    content: `*Invoice from {{gym_name}}*

Dear {{customer_name}},

Your invoice #{{invoice_number}} is ready.

📋 *Invoice Details*
Amount: ₹{{total_amount}}
{{#if amount_paid}}Paid: ₹{{amount_paid}}{{/if}}
{{#if balance_due}}Balance Due: ₹{{balance_due}}{{/if}}
{{#if is_paid}}✅ Paid in Full{{/if}}
Date: {{invoice_date}}

{{#if items}}
*Items:*
{{#each items}}
• {{description}} - ₹{{amount}}
{{/each}}
{{/if}}

Thank you for your business!
Team {{gym_name}}`,
  },
  {
    id: 'invoice-whatsapp-reminder',
    name: 'Payment Reminder - WhatsApp',
    type: 'whatsapp',
    content: `⏰ *Payment Reminder*

Dear {{customer_name}},

This is a friendly reminder about your pending invoice.

📋 Invoice: #{{invoice_number}}
💰 Amount Due: ₹{{balance_due}}
📅 Due Date: {{due_date}}

Please clear the dues at your earliest convenience.

For any queries, please contact us.

Team {{gym_name}}`,
  },
  {
    id: 'invoice-whatsapp-receipt',
    name: 'Payment Receipt - WhatsApp',
    type: 'whatsapp',
    content: `✅ *Payment Received*

Dear {{customer_name}},

Thank you for your payment!

📋 Invoice: #{{invoice_number}}
💰 Amount Paid: ₹{{payment_amount}}
💳 Payment Method: {{payment_method}}
📅 Date: {{payment_date}}

Your account is now up to date.

Thank you for choosing {{gym_name}}! 💪`,
  },

  // Email Templates
  {
    id: 'invoice-email-new',
    name: 'New Invoice - Email',
    type: 'email',
    subject: 'Invoice #{{invoice_number}} from {{gym_name}}',
    content: `Dear {{customer_name}},

Please find your invoice details below:

INVOICE DETAILS
───────────────
Invoice Number: {{invoice_number}}
Date: {{invoice_date}}
Due Date: {{due_date}}

ITEMS
───────────────
{{#each items}}
{{description}} - ₹{{amount}}
{{/each}}

SUMMARY
───────────────
Subtotal: ₹{{subtotal}}
{{#if discount}}Discount: -₹{{discount}}{{/if}}
{{#if tax}}Tax: ₹{{tax}}{{/if}}
Total: ₹{{total_amount}}
{{#if amount_paid}}Paid: ₹{{amount_paid}}{{/if}}
{{#if balance_due}}Balance Due: ₹{{balance_due}}{{/if}}

{{#if is_paid}}
Status: ✅ PAID
{{else}}
Please make the payment at your earliest convenience.
{{/if}}

Thank you for choosing {{gym_name}}!

Best regards,
Team {{gym_name}}`,
  },
  {
    id: 'invoice-email-reminder',
    name: 'Payment Reminder - Email',
    type: 'email',
    subject: 'Payment Reminder: Invoice #{{invoice_number}}',
    content: `Dear {{customer_name}},

This is a friendly reminder about your pending invoice.

Invoice Number: {{invoice_number}}
Amount Due: ₹{{balance_due}}
Due Date: {{due_date}}

Please clear the dues at your earliest convenience to avoid any service interruption.

If you have already made the payment, please disregard this message.

For any queries, feel free to contact us.

Best regards,
Team {{gym_name}}`,
  },
  {
    id: 'invoice-email-receipt',
    name: 'Payment Receipt - Email',
    type: 'email',
    subject: 'Payment Confirmation - Invoice #{{invoice_number}}',
    content: `Dear {{customer_name}},

Thank you for your payment! This email confirms that we have received your payment.

PAYMENT DETAILS
───────────────
Invoice Number: {{invoice_number}}
Amount Paid: ₹{{payment_amount}}
Payment Method: {{payment_method}}
Payment Date: {{payment_date}}
Transaction ID: {{transaction_id}}

Your account is now up to date.

Thank you for choosing {{gym_name}}!

Best regards,
Team {{gym_name}}`,
  },

  // SMS Templates
  {
    id: 'invoice-sms-new',
    name: 'New Invoice - SMS',
    type: 'sms',
    content: `{{gym_name}}: Invoice #{{invoice_number}} for ₹{{total_amount}}. {{#if balance_due}}Due: ₹{{balance_due}}{{else}}Paid{{/if}}. Thank you!`,
  },
  {
    id: 'invoice-sms-reminder',
    name: 'Payment Reminder - SMS',
    type: 'sms',
    content: `{{gym_name}} Reminder: Invoice #{{invoice_number}} has ₹{{balance_due}} pending. Due: {{due_date}}. Please pay at your earliest.`,
  },
  {
    id: 'invoice-sms-receipt',
    name: 'Payment Receipt - SMS',
    type: 'sms',
    content: `{{gym_name}}: Payment of ₹{{payment_amount}} received for Invoice #{{invoice_number}}. Thank you!`,
  },
];

export const getInvoiceTemplatesByType = (type: 'whatsapp' | 'email' | 'sms') => {
  return invoiceTemplates.filter((t) => t.type === type);
};

export const renderInvoiceTemplate = (template: string, data: Record<string, any>): string => {
  let result = template;
  
  // Simple variable replacement
  Object.entries(data).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, String(value || ''));
  });
  
  // Remove unmatched conditional blocks (simplified)
  result = result.replace(/{{#if \w+}}[\s\S]*?{{\/if}}/g, '');
  result = result.replace(/{{#each \w+}}[\s\S]*?{{\/each}}/g, '');
  
  return result;
};

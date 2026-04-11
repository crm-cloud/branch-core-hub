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

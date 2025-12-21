export interface MessageTemplate {
  id: string;
  name: string;
  category: 'welcome' | 'reminder' | 'promotion' | 'followup' | 'general';
  type: 'sms' | 'email' | 'whatsapp';
  subject?: string;
  content: string;
}

export const messageTemplates: MessageTemplate[] = [
  // Welcome Templates
  {
    id: 'welcome-new-member',
    name: 'New Member Welcome',
    category: 'welcome',
    type: 'whatsapp',
    content: `🎉 Welcome to Incline Fitness, {{name}}!

We're thrilled to have you as part of our fitness family.

📍 Your Member ID: {{member_code}}
📅 Membership Start: {{start_date}}
📅 Membership End: {{end_date}}

Download our app to track your progress and book classes!

See you at the gym! 💪`,
  },
  {
    id: 'welcome-email',
    name: 'Welcome Email',
    category: 'welcome',
    type: 'email',
    subject: 'Welcome to Incline Fitness! 🏋️',
    content: `Dear {{name}},

Welcome to Incline Fitness! We're excited to have you join our community.

Your membership details:
- Member ID: {{member_code}}
- Plan: {{plan_name}}
- Valid until: {{end_date}}

Here's what you can do:
✓ Access our state-of-the-art equipment
✓ Join group fitness classes
✓ Get personalized training
✓ Use our locker facilities

Questions? Reply to this email or visit our front desk.

Let's achieve your fitness goals together!

Best regards,
The Incline Fitness Team`,
  },

  // Reminder Templates
  {
    id: 'membership-expiry-7days',
    name: 'Membership Expiring (7 Days)',
    category: 'reminder',
    type: 'sms',
    content: `Hi {{name}}, your Incline Fitness membership expires in 7 days ({{end_date}}). Renew now to continue your fitness journey! Visit us or call for renewal options.`,
  },
  {
    id: 'membership-expiry-whatsapp',
    name: 'Membership Expiry Reminder',
    category: 'reminder',
    type: 'whatsapp',
    content: `⏰ Reminder: Hi {{name}}!

Your Incline Fitness membership is expiring on {{end_date}}.

🔄 Renew now and get:
• Early bird discount
• No registration fee
• Free personal training session

Don't miss a day of your workout! Reply to renew or visit us. 💪`,
  },
  {
    id: 'payment-reminder',
    name: 'Payment Due Reminder',
    category: 'reminder',
    type: 'sms',
    content: `Hi {{name}}, you have a pending payment of ₹{{amount}} at Incline Fitness. Please clear the dues at your earliest convenience. Invoice: {{invoice_number}}`,
  },
  {
    id: 'class-reminder',
    name: 'Class Booking Reminder',
    category: 'reminder',
    type: 'whatsapp',
    content: `🧘 Class Reminder!

Hi {{name}}, you're booked for:
📌 {{class_name}}
📅 {{class_date}}
⏰ {{class_time}}
👤 Trainer: {{trainer_name}}

Please arrive 10 mins early. See you there! 🏃`,
  },

  // Promotion Templates
  {
    id: 'special-offer',
    name: 'Special Offer',
    category: 'promotion',
    type: 'whatsapp',
    content: `🔥 SPECIAL OFFER at Incline Fitness!

Hi {{name}}! 

For a limited time:
✨ 20% OFF on annual memberships
✨ FREE personal training session
✨ No joining fee

📅 Offer valid till {{offer_end_date}}

Don't miss out! Visit us today or reply to know more.

#GetFit #InclineFitness`,
  },
  {
    id: 'referral-offer',
    name: 'Referral Program',
    category: 'promotion',
    type: 'whatsapp',
    content: `🎁 REFER & EARN!

Hi {{name}}!

Refer a friend to Incline Fitness and get:
✅ 1 month FREE extension
✅ ₹500 gym shop credit
✅ Your friend gets 10% OFF!

Share your referral code: {{referral_code}}

Let's grow our fitness family together! 💪`,
  },

  // Follow-up Templates
  {
    id: 'missed-workout',
    name: 'Missed Workout Follow-up',
    category: 'followup',
    type: 'whatsapp',
    content: `👋 Hey {{name}}!

We noticed you haven't visited the gym in a while. Everything okay?

Remember, consistency is key! Even a 30-minute session counts.

Need help with:
• Workout routine?
• Schedule changes?
• Personal training?

We're here to help! Reply or visit us. 💪`,
  },
  {
    id: 'lead-followup',
    name: 'Lead Follow-up',
    category: 'followup',
    type: 'whatsapp',
    content: `Hi {{name}}! 👋

Thanks for your interest in Incline Fitness!

Would you like to:
📍 Schedule a gym tour?
🎯 Discuss your fitness goals?
💰 Know about our membership plans?

Reply with your preferred time for a visit, and we'll keep everything ready for you!

Team Incline Fitness 🏋️`,
  },
  {
    id: 'trial-followup',
    name: 'Trial Session Follow-up',
    category: 'followup',
    type: 'sms',
    content: `Hi {{name}}! How was your trial at Incline Fitness? Ready to start your fitness journey? Sign up today and get 15% OFF! Call us or visit for details.`,
  },

  // General Templates
  {
    id: 'birthday-wish',
    name: 'Birthday Wishes',
    category: 'general',
    type: 'whatsapp',
    content: `🎂 Happy Birthday, {{name}}! 🎉

Wishing you a fantastic year ahead filled with health, happiness, and fitness goals achieved!

🎁 Here's a special birthday gift:
FREE personal training session this month!

Celebrate with a power workout! 💪

From your Incline Fitness Family 🏋️`,
  },
  {
    id: 'gym-closure',
    name: 'Gym Closure Notice',
    category: 'general',
    type: 'sms',
    content: `Incline Fitness Notice: Our gym will be closed on {{closure_date}} for {{reason}}. We apologize for the inconvenience. Regular hours resume on {{resume_date}}.`,
  },
  {
    id: 'new-class-announcement',
    name: 'New Class Announcement',
    category: 'general',
    type: 'whatsapp',
    content: `🆕 NEW CLASS ALERT!

Hi {{name}}! 

We're excited to introduce:
🏃 {{class_name}}
📅 Starting {{start_date}}
⏰ Every {{schedule}}
👤 With {{trainer_name}}

Limited slots available! Book now to secure your spot.

Reply to reserve! 💪`,
  },
];

export const getTemplatesByType = (type: 'sms' | 'email' | 'whatsapp') => {
  return messageTemplates.filter((t) => t.type === type);
};

export const getTemplatesByCategory = (category: MessageTemplate['category']) => {
  return messageTemplates.filter((t) => t.category === category);
};

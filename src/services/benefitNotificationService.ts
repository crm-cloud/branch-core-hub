import { supabase } from "@/integrations/supabase/client";

interface BookingDetails {
  id: string;
  member_id: string;
  slot_id: string;
  slot_date: string;
  start_time: string;
  end_time: string;
  benefit_name: string;
  member_name?: string;
  member_phone?: string;
}

interface NotificationPayload {
  user_id?: string;
  branch_id: string;
  title: string;
  message: string;
  type: string;
  reference_type?: string;
  reference_id?: string;
}

// Create in-app notification
async function createNotification(payload: NotificationPayload) {
  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: payload.user_id,
      branch_id: payload.branch_id,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      reference_type: payload.reference_type,
      reference_id: payload.reference_id,
      is_read: false,
    });
    if (error) console.error("Failed to create notification:", error);
  } catch (err) {
    console.error("Notification error:", err);
  }
}

// Log communication for WhatsApp/SMS
async function logCommunication(
  branchId: string,
  memberId: string,
  recipient: string,
  type: "whatsapp" | "sms",
  content: string,
  subject?: string
) {
  try {
    const { error } = await supabase.from("communication_logs").insert({
      branch_id: branchId,
      member_id: memberId,
      recipient,
      type,
      content,
      subject,
      status: "pending",
    });
    if (error) console.error("Failed to log communication:", error);
  } catch (err) {
    console.error("Communication log error:", err);
  }
}

// Format time for display
function formatTime(time: string): string {
  return time.slice(0, 5);
}

// Booking confirmation notification
export async function notifyBookingConfirmation(booking: BookingDetails, branchId: string) {
  const message = `Your ${booking.benefit_name} slot is confirmed for ${booking.slot_date} at ${formatTime(booking.start_time)}`;
  
  await createNotification({
    branch_id: branchId,
    title: "Booking Confirmed",
    message,
    type: "booking_confirmation",
    reference_type: "benefit_booking",
    reference_id: booking.id,
  });

  // Log for WhatsApp/SMS if phone available
  if (booking.member_phone) {
    const whatsappMessage = `Hi${booking.member_name ? ` ${booking.member_name}` : ""}, your ${booking.benefit_name} slot is confirmed for ${booking.slot_date} at ${formatTime(booking.start_time)}-${formatTime(booking.end_time)}. Please arrive 5 minutes early.`;
    
    await logCommunication(
      branchId,
      booking.member_id,
      booking.member_phone,
      "whatsapp",
      whatsappMessage,
      "Booking Confirmation"
    );
  }
}

// Booking cancellation notification
export async function notifyBookingCancellation(
  booking: BookingDetails,
  branchId: string,
  reason?: string
) {
  const message = `Your ${booking.benefit_name} booking for ${booking.slot_date} at ${formatTime(booking.start_time)} has been cancelled${reason ? `: ${reason}` : ""}`;
  
  await createNotification({
    branch_id: branchId,
    title: "Booking Cancelled",
    message,
    type: "booking_cancellation",
    reference_type: "benefit_booking",
    reference_id: booking.id,
  });

  if (booking.member_phone) {
    await logCommunication(
      branchId,
      booking.member_id,
      booking.member_phone,
      "whatsapp",
      message,
      "Booking Cancellation"
    );
  }
}

// Low balance alert
export async function notifyLowBalance(
  memberId: string,
  branchId: string,
  benefitName: string,
  remaining: number,
  memberPhone?: string
) {
  const message = `You have only ${remaining} ${benefitName} session${remaining === 1 ? "" : "s"} remaining. Purchase more to continue enjoying this benefit.`;
  
  await createNotification({
    branch_id: branchId,
    title: "Low Benefit Balance",
    message,
    type: "low_balance_alert",
    reference_type: "member",
    reference_id: memberId,
  });

  if (memberPhone) {
    await logCommunication(
      branchId,
      memberId,
      memberPhone,
      "whatsapp",
      message,
      "Low Balance Alert"
    );
  }
}

// Booking reminder (to be called by a scheduled job)
export async function notifyBookingReminder(booking: BookingDetails, branchId: string) {
  const message = `Reminder: Your ${booking.benefit_name} session is scheduled for today at ${formatTime(booking.start_time)}`;
  
  await createNotification({
    branch_id: branchId,
    title: "Upcoming Session",
    message,
    type: "booking_reminder",
    reference_type: "benefit_booking",
    reference_id: booking.id,
  });

  if (booking.member_phone) {
    const whatsappMessage = `Reminder: Your ${booking.benefit_name} session is in 1 hour at ${formatTime(booking.start_time)}. See you soon!`;
    
    await logCommunication(
      branchId,
      booking.member_id,
      booking.member_phone,
      "whatsapp",
      whatsappMessage,
      "Session Reminder"
    );
  }
}

// No-show notification
export async function notifyNoShow(booking: BookingDetails, branchId: string, penalty?: number) {
  const message = penalty
    ? `You missed your ${booking.benefit_name} session at ${formatTime(booking.start_time)}. A penalty of ₹${penalty} has been applied.`
    : `You missed your ${booking.benefit_name} session at ${formatTime(booking.start_time)}. This session has been marked as used.`;
  
  await createNotification({
    branch_id: branchId,
    title: "Session Missed",
    message,
    type: "no_show",
    reference_type: "benefit_booking",
    reference_id: booking.id,
  });

  if (booking.member_phone) {
    await logCommunication(
      branchId,
      booking.member_id,
      booking.member_phone,
      "whatsapp",
      message,
      "Missed Session"
    );
  }
}

// Deduction notification
export async function notifyBenefitDeducted(
  memberId: string,
  branchId: string,
  benefitName: string,
  remaining: number,
  isUnlimited: boolean
) {
  if (isUnlimited) return; // No notification for unlimited benefits

  const message = `1 ${benefitName} session used. ${remaining} session${remaining === 1 ? "" : "s"} remaining.`;
  
  await createNotification({
    branch_id: branchId,
    title: "Benefit Used",
    message,
    type: "benefit_deduction",
    reference_type: "member",
    reference_id: memberId,
  });

  // Send low balance alert if running low (3 or fewer remaining)
  if (remaining > 0 && remaining <= 3) {
    // This will be handled separately to avoid duplicate notifications
    console.log(`Low balance alert threshold reached for ${benefitName}`);
  }
}

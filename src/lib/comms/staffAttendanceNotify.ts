/**
 * Staff-attendance manual-entry notification (Section D — built but disabled).
 *
 * When the biometric turnstile is offline, an authorised user (owner/admin/manager)
 * can manually record someone else's attendance from the Attendance Command Center.
 * To deter misuse, we want every such entry to ping the *target* user
 * ("Your attendance was recorded by <actor> at <time> — Reason: <reason>").
 *
 * This helper is wired into the call sites already, but gated behind
 * `STAFF_ATTENDANCE_NOTIFY_ENABLED`. Flip the flag to `true` (and author the
 * matching templates under Settings → Communication Templates for the
 * `staff_attendance_recorded` event) to switch it on.
 *
 * Template variables exposed: {{actor_name}}, {{action}} (check_in|check_out),
 * {{time}}, {{reason}}, {{branch_name}}.
 */

import { dispatchCommunication, buildDedupeKey } from '@/lib/comms/dispatch';

/** Master kill-switch. Keep `false` until templates are authored & approved. */
export const STAFF_ATTENDANCE_NOTIFY_ENABLED = false;

export interface StaffAttendanceNotifyInput {
  /** auth user id of the staff member whose attendance was recorded */
  targetUserId: string;
  /** preferred contact (E.164 phone) — required for whatsapp/sms */
  targetPhone?: string | null;
  /** optional email — used when whatsapp/sms unavailable */
  targetEmail?: string | null;
  /** action that was recorded */
  action: 'check_in' | 'check_out';
  /** human-readable name of the person who recorded the entry */
  actorName: string;
  /** ISO timestamp of the entry */
  occurredAt: string;
  /** branch the entry was recorded under */
  branchId: string;
  branchName?: string;
  /** optional free-text justification provided by the actor */
  reason?: string;
  /** the underlying staff_attendance row id, used for dedupe */
  attendanceId?: string | null;
}

/**
 * Fire-and-forget notify. Always returns — never throws — so it cannot break
 * the check-in flow even when enabled.
 */
export async function notifyStaffAttendanceRecorded(
  input: StaffAttendanceNotifyInput,
): Promise<void> {
  if (!STAFF_ATTENDANCE_NOTIFY_ENABLED) return;

  const variables = {
    actor_name: input.actorName,
    action: input.action === 'check_in' ? 'checked you IN' : 'checked you OUT',
    time: new Date(input.occurredAt).toLocaleString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: 'short',
    }),
    reason: input.reason || '—',
    branch_name: input.branchName || '',
  };

  const body =
    `Heads up: ${variables.actor_name} ${variables.action} at ${variables.time}` +
    (input.reason ? ` (reason: ${input.reason})` : '') +
    `. If this wasn't expected, please flag it to your manager immediately.`;

  const dedupeBase = input.attendanceId || `${input.targetUserId}:${input.occurredAt}`;

  // Try WhatsApp first, then SMS as fallback (both transactional, force=true).
  const tasks: Promise<unknown>[] = [];

  if (input.targetPhone) {
    tasks.push(
      dispatchCommunication({
        branch_id: input.branchId,
        channel: 'whatsapp',
        category: 'transactional',
        recipient: input.targetPhone,
        user_id: input.targetUserId,
        payload: { body, variables },
        dedupe_key: buildDedupeKey(['staff_attendance_recorded', dedupeBase, 'wa']),
        force: true,
      }).catch(() => undefined),
    );
  }

  if (input.targetEmail) {
    tasks.push(
      dispatchCommunication({
        branch_id: input.branchId,
        channel: 'email',
        category: 'transactional',
        recipient: input.targetEmail,
        user_id: input.targetUserId,
        payload: {
          subject: 'Your attendance was recorded manually',
          body,
          variables,
          use_branded_template: true,
        },
        dedupe_key: buildDedupeKey(['staff_attendance_recorded', dedupeBase, 'em']),
        force: true,
      }).catch(() => undefined),
    );
  }

  await Promise.allSettled(tasks);
}

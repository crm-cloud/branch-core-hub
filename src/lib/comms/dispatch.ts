// Single source of truth for outbound communications from the client.
//
// Re-exports the canonical dispatcher implemented in `preferencesService.ts`
// under a more discoverable path. All client code must import from here:
//
//   import { dispatchCommunication } from '@/lib/comms/dispatch';
//
// NEVER call `send-email`, `send-whatsapp`, `send-sms` directly from the
// client. The dispatcher (edge fn `dispatch-communication`) handles dedupe,
// member preferences, quiet hours, provider routing, and the
// `communication_logs` writes.
export {
  dispatchCommunication,
  type CommChannel,
  type CommCategory,
  type DispatchInput as DispatchPayload,
  type DispatchResult,
} from '@/services/preferencesService';

/** Build a stable dedupe key from a domain + entity + channel.
 *  Convention: `<topic>:<entity_id>[:<sub>]:<channel>`
 *  Example: `buildDedupeKey('invoice', invoice.id, 'wa')` */
export function buildDedupeKey(
  parts: Array<string | number | null | undefined>,
): string {
  return parts.filter((p) => p !== null && p !== undefined && p !== '').join(':');
}

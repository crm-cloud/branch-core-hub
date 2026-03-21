// @ts-nocheck
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const toText = (value: unknown): string | null => {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

const normalizeSn = (value: string | null): string | null => {
  if (!value) return null
  return value.trim().toUpperCase()
}

const readSn = (body: Record<string, unknown>): string | null => {
  return normalizeSn(
    toText(body.device_sn) ||
      toText(body.deviceSn) ||
      toText(body.sn) ||
      toText(body.serial_number) ||
      toText(body.serialNumber) ||
      toText(body.deviceKey) ||
      toText(body.device_key)
  )
}

const readIdentifier = (body: Record<string, unknown>): string | null => {
  return (
    toText(body.personId) ||
    toText(body.person_id) ||
    toText(body.customId) ||
    toText(body.custom_id) ||
    toText(body.person_uuid) ||
    toText(body.uid) ||
    toText(body.pin) ||
    toText(body.id_card) ||
    toText(body.idCard) ||
    toText(body.searchScore) // some devices put an identifier-like field here
  )
}

/** Parse body as JSON first; fall back to form-urlencoded. */
async function parseBody(req: Request): Promise<Record<string, unknown>> {
  const ct = (req.headers.get('content-type') || '').toLowerCase()
  const raw = await req.text()

  if (raw.startsWith('{') || raw.startsWith('[')) {
    try { return JSON.parse(raw) } catch { /* fall through */ }
  }

  if (ct.includes('form') || raw.includes('=')) {
    const params = new URLSearchParams(raw)
    const obj: Record<string, string> = {}
    for (const [k, v] of params.entries()) obj[k] = v
    const url = new URL(req.url)
    for (const [k, v] of url.searchParams.entries()) {
      if (!obj[k]) obj[k] = v
    }
    return obj
  }

  try { return JSON.parse(raw) } catch { return {} }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ code: 1, msg: 'method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const body = await parseBody(req)
    // Merge query string params
    const url = new URL(req.url)
    for (const [k, v] of url.searchParams.entries()) {
      if (!body[k]) body[k] = v
    }

    const deviceSn = readSn(body)
    const personIdentifier = readIdentifier(body)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const nowIso = new Date().toISOString()

    let hardwareDevice: { id: string; branch_id: string | null } | null = null
    let accessDeviceId: string | null = null
    if (deviceSn) {
      const ipAddress =
        toText(body.ip) ||
        toText(body.ip_address) ||
        toText(body.ipAddress) ||
        req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
        req.headers.get('x-real-ip') ||
        null

      const { data } = await supabase
        .from('hardware_devices')
        .upsert(
          {
            device_sn: deviceSn,
            device_key: toText(body.deviceKey) || toText(body.device_key),
            ip_address: ipAddress,
            last_online: nowIso,
            last_payload: body,
            updated_at: nowIso,
          },
          { onConflict: 'device_sn' }
        )
        .select('id, branch_id')
        .single()

      hardwareDevice = data || null

      const { data: accessDevice } = await supabase
        .from('access_devices')
        .select('id, branch_id')
        .eq('serial_number', deviceSn)
        .maybeSingle()

      if (accessDevice) {
        accessDeviceId = accessDevice.id
        const accessUpdate: Record<string, unknown> = {
          is_online: true,
          last_heartbeat: nowIso,
        }
        if (ipAddress) accessUpdate.ip_address = ipAddress
        await supabase
          .from('access_devices')
          .update(accessUpdate)
          .eq('id', accessDevice.id)
      }
    }

    const fallbackBranchId =
      toText(body.branch_id) || toText(body.branchId) || hardwareDevice?.branch_id || null

    if (!personIdentifier) {
      // Log the raw payload for debugging but don't treat as error
      console.log('terminal-identify: no person identifier found in payload keys:', Object.keys(body))
      
      await supabase.from('access_logs').insert({
        device_sn: deviceSn || 'UNKNOWN',
        hardware_device_id: hardwareDevice?.id || null,
        branch_id: fallbackBranchId,
        event_type: 'identify',
        result: 'ignored',
        message: 'Missing person identifier',
        captured_at: nowIso,
        payload: body,
      })

      if (accessDeviceId && fallbackBranchId) {
        await supabase.from('device_access_events').insert({
          device_id: accessDeviceId,
          branch_id: fallbackBranchId,
          event_type: 'identify',
          access_granted: false,
          denial_reason: 'missing_identifier',
          device_message: 'Missing person identifier',
          processed_at: nowIso,
        })
      }

      return new Response(JSON.stringify({ code: 0, msg: 'success' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 1) Profiles cross-reference
    let profileId: string | null = null
    {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', personIdentifier)
        .maybeSingle()
      if (profile) profileId = profile.id
    }

    // 2) Member lookup by multiple identifiers
    let member: { id: string; user_id: string; branch_id: string } | null = null
    {
      const lookups = [
        supabase.from('members').select('id, user_id, branch_id').eq('id', personIdentifier).maybeSingle(),
        supabase.from('members').select('id, user_id, branch_id').eq('member_code', personIdentifier).maybeSingle(),
        supabase.from('members').select('id, user_id, branch_id').eq('wiegand_code', personIdentifier).maybeSingle(),
      ]

      if (profileId) {
        lookups.push(
          supabase.from('members').select('id, user_id, branch_id').eq('user_id', profileId).maybeSingle()
        )
      }

      for (const query of lookups) {
        const { data } = await query
        if (data) {
          member = data
          break
        }
      }
    }

    // 3) Staff lookup by multiple identifiers
    let staffUserId: string | null = null
    let staffBranchId: string | null = null
    if (!member) {
      const employeeLookups = [
        supabase.from('employees').select('user_id, branch_id').eq('id', personIdentifier).maybeSingle(),
        supabase.from('employees').select('user_id, branch_id').eq('employee_code', personIdentifier).maybeSingle(),
      ]
      if (profileId) {
        employeeLookups.push(
          supabase.from('employees').select('user_id, branch_id').eq('user_id', profileId).maybeSingle()
        )
      }

      for (const query of employeeLookups) {
        const { data } = await query
        if (data) {
          staffUserId = data.user_id
          staffBranchId = data.branch_id
          break
        }
      }

      if (!staffUserId) {
        const trainerLookups = [
          supabase.from('trainers').select('user_id, branch_id').eq('id', personIdentifier).maybeSingle(),
        ]
        if (profileId) {
          trainerLookups.push(
            supabase.from('trainers').select('user_id, branch_id').eq('user_id', profileId).maybeSingle()
          )
        }

        for (const query of trainerLookups) {
          const { data } = await query
          if (data) {
            staffUserId = data.user_id
            staffBranchId = data.branch_id
            break
          }
        }
      }
    }

    if (staffUserId) {
      await supabase.from('staff_attendance').insert({
        user_id: staffUserId,
        branch_id: staffBranchId || fallbackBranchId,
        check_in: nowIso,
        notes: `Terminal identify webhook (${deviceSn || 'UNKNOWN'})`,
      })

      await supabase.from('access_logs').insert({
        device_sn: deviceSn || 'UNKNOWN',
        hardware_device_id: hardwareDevice?.id || null,
        branch_id: staffBranchId || fallbackBranchId,
        profile_id: staffUserId,
        event_type: 'identify',
        result: 'staff',
        message: 'Staff identify success',
        captured_at: nowIso,
        payload: body,
      })

      if (accessDeviceId) {
        await supabase.from('device_access_events').insert({
          device_id: accessDeviceId,
          branch_id: staffBranchId || fallbackBranchId,
          staff_id: staffUserId,
          event_type: 'identify',
          access_granted: true,
          device_message: 'Staff identify success',
          processed_at: nowIso,
        })
      }

      return new Response(JSON.stringify({ code: 0, msg: 'success' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (member) {
      const branchForCheckin = member.branch_id || fallbackBranchId

      // Call member_check_in RPC to validate membership and record attendance
      let checkInResult: any = null
      if (branchForCheckin) {
        const { data: rpcResult } = await supabase.rpc('member_check_in', {
          _member_id: member.id,
          _branch_id: branchForCheckin,
          _method: 'terminal',
        })
        checkInResult = rpcResult
      }

      const accessGranted = checkInResult?.valid === true || checkInResult?.success === true
      const checkInMessage = checkInResult?.message || (accessGranted ? 'Member check-in success' : 'Member identified but check-in failed')

      await supabase.from('access_logs').insert({
        device_sn: deviceSn || 'UNKNOWN',
        hardware_device_id: hardwareDevice?.id || null,
        branch_id: branchForCheckin,
        member_id: member.id,
        profile_id: member.user_id,
        event_type: 'identify',
        result: accessGranted ? 'member' : 'member_denied',
        message: checkInMessage,
        captured_at: nowIso,
        payload: body,
      })

      if (accessDeviceId && branchForCheckin) {
        await supabase.from('device_access_events').insert({
          device_id: accessDeviceId,
          branch_id: branchForCheckin,
          member_id: member.id,
          event_type: 'identify',
          access_granted: accessGranted,
          denial_reason: accessGranted ? null : (checkInResult?.reason || 'check_in_failed'),
          device_message: checkInMessage,
          processed_at: nowIso,
        })
      }

      return new Response(JSON.stringify({ code: 0, msg: 'success' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabase.from('access_logs').insert({
      device_sn: deviceSn || 'UNKNOWN',
      hardware_device_id: hardwareDevice?.id || null,
      branch_id: fallbackBranchId,
      event_type: 'identify',
      result: 'not_found',
      message: `No staff/member match for identifier ${personIdentifier}`,
      captured_at: nowIso,
      payload: body,
    })

    if (accessDeviceId && fallbackBranchId) {
      await supabase.from('device_access_events').insert({
        device_id: accessDeviceId,
        branch_id: fallbackBranchId,
        event_type: 'identify',
        access_granted: false,
        denial_reason: 'not_found',
        device_message: `No match for ${personIdentifier}`,
        processed_at: nowIso,
      })
    }

    return new Response(JSON.stringify({ code: 0, msg: 'success' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('terminal-identify error:', error)
    return new Response(JSON.stringify({ code: 0, msg: 'success' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

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
    toText(body.pin)
  )
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
    const body = (await req.json()) as Record<string, unknown>
    const action = (toText(body.action) || toText(body.mode) || 'pull_members').toLowerCase()
    const deviceSn = readSn(body)
    const personIdentifier = readIdentifier(body)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const nowIso = new Date().toISOString()
    let device: { id: string; branch_id: string | null } | null = null

    if (deviceSn) {
      const { data } = await supabase
        .from('hardware_devices')
        .upsert(
          {
            device_sn: deviceSn,
            device_key: toText(body.deviceKey) || toText(body.device_key),
            ip_address:
              toText(body.ip) ||
              toText(body.ip_address) ||
              toText(body.ipAddress) ||
              req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
              req.headers.get('x-real-ip') ||
              null,
            last_online: nowIso,
            last_payload: body,
            updated_at: nowIso,
          },
          { onConflict: 'device_sn' }
        )
        .select('id, branch_id')
        .single()

      device = data || null
    }

    const branchId = toText(body.branch_id) || toText(body.branchId) || device?.branch_id || null

    if (['pull', 'pull_members', 'sync', 'roster', 'get_roster'].includes(action)) {
      if (!branchId) {
        return new Response(JSON.stringify({ code: 0, msg: 'success', members: [] }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      const { data: members } = await supabase
        .from('members')
        .select('id, user_id, member_code, wiegand_code, biometric_photo_url, updated_at')
        .eq('branch_id', branchId)
        .eq('status', 'active')
        .eq('hardware_access_enabled', true)
        .limit(2000)

      const userIds = (members || []).map((m) => m.user_id).filter(Boolean)
      let profileMap: Record<string, string> = {}

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', userIds)

        profileMap = (profiles || []).reduce((acc: Record<string, string>, profile) => {
          acc[profile.id] = profile.full_name || 'Member'
          return acc
        }, {})
      }

      const roster = (members || []).map((member) => ({
        personId: member.id,
        customId: member.member_code || member.wiegand_code || member.id,
        name: profileMap[member.user_id] || 'Member',
        imageUrl: member.biometric_photo_url,
        updatedAt: member.updated_at,
      }))

      return new Response(JSON.stringify({ code: 0, msg: 'success', members: roster }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    if (['register', 'register_face', 'enroll', 'upload'].includes(action)) {
      const imageUrl = toText(body.imageUrl) || toText(body.photo_url)

      if (personIdentifier && imageUrl) {
        const { data: member } = await supabase
          .from('members')
          .select('id')
          .eq('id', personIdentifier)
          .maybeSingle()

        if (member) {
          await supabase
            .from('members')
            .update({ biometric_photo_url: imageUrl, biometric_enrolled: true })
            .eq('id', member.id)
        }
      }

      await supabase.from('access_logs').insert({
        device_sn: deviceSn || 'UNKNOWN',
        hardware_device_id: device?.id || null,
        branch_id: branchId,
        event_type: 'register',
        result: 'accepted',
        message: personIdentifier ? `Face registration received for ${personIdentifier}` : 'Face registration received',
        captured_at: nowIso,
        payload: body,
      })

      return new Response(JSON.stringify({ code: 0, msg: 'success' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    await supabase.from('access_logs').insert({
      device_sn: deviceSn || 'UNKNOWN',
      hardware_device_id: device?.id || null,
      branch_id: branchId,
      event_type: 'register',
      result: 'ignored',
      message: `Unknown action: ${action}`,
      captured_at: nowIso,
      payload: body,
    })

    return new Response(JSON.stringify({ code: 0, msg: 'success' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('terminal-register error:', error)
    return new Response(JSON.stringify({ code: 0, msg: 'success' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

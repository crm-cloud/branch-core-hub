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
    const deviceSn = readSn(body)
    const deviceKey = toText(body.deviceKey) || toText(body.device_key)
    const ipAddress =
      toText(body.ip) ||
      toText(body.ip_address) ||
      toText(body.ipAddress) ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      req.headers.get('x-real-ip') ||
      null

    if (!deviceSn) {
      return new Response(JSON.stringify({ code: 1, msg: 'device_sn/deviceKey is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const nowIso = new Date().toISOString()
    const upsertData: Record<string, unknown> = {
      device_sn: deviceSn,
      device_key: deviceKey,
      ip_address: ipAddress,
      last_online: nowIso,
      last_payload: body,
      updated_at: nowIso,
    }

    const branchId = toText(body.branch_id) || toText(body.branchId)
    if (branchId) {
      upsertData.branch_id = branchId
    }

    const { data, error } = await supabase
      .from('hardware_devices')
      .upsert(upsertData, { onConflict: 'device_sn' })
      .select('id, device_sn, branch_id, last_online')
      .single()

    if (error) {
      console.error('terminal-heartbeat upsert error:', error)
      return new Response(JSON.stringify({ code: 1, msg: 'failed to save heartbeat' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Compatibility bridge: keep legacy access_devices heartbeat fields fresh for Device Management UI.
    await supabase
      .from('access_devices')
      .update({
        is_online: true,
        last_heartbeat: nowIso,
        ip_address: ipAddress,
        firmware_version:
          toText(body.firmware_version) ||
          toText(body.firmwareVersion) ||
          null,
      })
      .eq('serial_number', deviceSn)

    return new Response(
      JSON.stringify({
        code: 0,
        msg: 'success',
        data: {
          device_sn: data.device_sn,
          branch_id: data.branch_id,
          last_online: data.last_online,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('terminal-heartbeat error:', error)
    return new Response(JSON.stringify({ code: 1, msg: 'invalid request' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

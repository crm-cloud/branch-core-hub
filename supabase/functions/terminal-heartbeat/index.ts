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

/** Parse body as JSON first; fall back to form-urlencoded. */
async function parseBody(req: Request): Promise<Record<string, unknown>> {
  const ct = (req.headers.get('content-type') || '').toLowerCase()
  const raw = await req.text()

  // Try JSON first (even if content-type says otherwise — some devices lie)
  if (raw.startsWith('{') || raw.startsWith('[')) {
    try { return JSON.parse(raw) } catch { /* fall through */ }
  }

  // Form-urlencoded fallback
  if (ct.includes('form') || raw.includes('=')) {
    const params = new URLSearchParams(raw)
    const obj: Record<string, string> = {}
    for (const [k, v] of params.entries()) obj[k] = v
    // Also parse query string params
    const url = new URL(req.url)
    for (const [k, v] of url.searchParams.entries()) {
      if (!obj[k]) obj[k] = v
    }
    return obj
  }

  // Last resort — try JSON anyway
  try { return JSON.parse(raw) } catch { return {} }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  // Accept both GET and POST — some devices send heartbeat as GET with query params
  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response(JSON.stringify({ code: 1, msg: 'method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    let body: Record<string, unknown> = {}
    if (req.method === 'POST') {
      body = await parseBody(req)
    }
    // Merge query string params (devices often put SN in query)
    const url = new URL(req.url)
    for (const [k, v] of url.searchParams.entries()) {
      if (!body[k]) body[k] = v
    }

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

    // Compatibility bridge: keep legacy access_devices heartbeat fields fresh.
    // Only update if ipAddress is non-null to avoid inet cast errors.
    const accessUpdate: Record<string, unknown> = {
      is_online: true,
      last_heartbeat: nowIso,
      firmware_version:
        toText(body.firmware_version) ||
        toText(body.firmwareVersion) ||
        null,
    }
    if (ipAddress) {
      accessUpdate.ip_address = ipAddress
    }
    await supabase
      .from('access_devices')
      .update(accessUpdate)
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

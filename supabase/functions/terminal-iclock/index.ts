import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * ZKTeco ICLOCK/PUSH Protocol Handler
 * 
 * Stock ZKTeco terminals use the ICLOCK protocol:
 * - GET  /iclock/cdata?SN=xxx           → Device handshake
 * - POST /iclock/cdata?SN=xxx&table=... → Device pushes attendance/enrollment data
 * - GET  /iclock/getrequest?SN=xxx      → Device polls for pending commands
 * - POST /iclock/devicecmd?SN=xxx       → Device confirms command execution
 */

function getSupabase() {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

async function lookupDevice(supabase: any, sn: string) {
  const { data } = await supabase
    .from('access_devices')
    .select('*')
    .eq('serial_number', sn)
    .single()
  return data
}

/** GET /iclock/cdata — Device handshake / initial registration */
async function handleHandshake(supabase: any, sn: string) {
  const device = await lookupDevice(supabase, sn)
  
  if (!device) {
    // Return OK anyway so device doesn't error loop, but log it
    console.warn(`Unknown device SN: ${sn}`)
    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  // Update heartbeat
  await supabase
    .from('access_devices')
    .update({
      is_online: true,
      last_heartbeat: new Date().toISOString(),
    })
    .eq('id', device.id)

  // ZKTeco expects specific response format for handshake
  const response = [
    `GET OPTION FROM: ${sn}`,
    `ATTLOGStamp=0`,
    `OPERLOGStamp=0`,
    `ATTPHOTOStamp=0`,
    `ErrorDelay=30`,
    `Delay=10`,
    `TransTimes=00:00;14:05`,
    `TransInterval=1`,
    `TransFlag=TransData AttLog\tOpLog`,
    `TimeZone=5`,
    `Realtime=1`,
    `Encrypt=0`,
  ].join('\r\n')

  return new Response(response, {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}

/** POST /iclock/cdata — Device pushes attendance records */
async function handleAttendancePush(supabase: any, sn: string, table: string, body: string) {
  const device = await lookupDevice(supabase, sn)
  if (!device) {
    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  // Update heartbeat
  await supabase
    .from('access_devices')
    .update({ is_online: true, last_heartbeat: new Date().toISOString() })
    .eq('id', device.id)

  if (table === 'ATTLOG') {
    // Parse attendance log lines
    // Format: PIN\tTimestamp\tVerifyMode\tInOutMode\tWorkCode
    // Example: 12345\t2024-01-15 09:30:00\t15\t0\t0
    const lines = body.split('\n').filter(l => l.trim())
    
    for (const line of lines) {
      const parts = line.split('\t')
      if (parts.length < 2) continue
      
      const pin = parts[0]?.trim()
      const timestamp = parts[1]?.trim()
      const verifyMode = parseInt(parts[2]?.trim() || '0')
      const inOutMode = parseInt(parts[3]?.trim() || '0')

      if (!pin) continue

      // Determine check method from verify mode
      // 1=Fingerprint, 15=Face, 3=Password, 4=Card
      const methodMap: Record<number, string> = {
        1: 'fingerprint', 15: 'face', 3: 'password', 4: 'card',
      }
      const method = methodMap[verifyMode] || 'biometric'

      // Try to find member by various identifiers
      let member: any = null
      let staff: any = null

      // Try member by ID (if PIN is UUID)
      if (pin.includes('-')) {
        const { data: m } = await supabase
          .from('members')
          .select('id, member_code, branch_id, user_id, hardware_access_enabled, wiegand_code')
          .eq('id', pin)
          .single()
        member = m
      }

      // Try by wiegand_code
      if (!member) {
        const { data: m } = await supabase
          .from('members')
          .select('id, member_code, branch_id, user_id, hardware_access_enabled, wiegand_code')
          .eq('wiegand_code', pin)
          .single()
        member = m
      }

      // Try by member_code
      if (!member) {
        const { data: m } = await supabase
          .from('members')
          .select('id, member_code, branch_id, user_id, hardware_access_enabled, wiegand_code')
          .eq('member_code', pin)
          .single()
        member = m
      }

      const eventData: Record<string, unknown> = {
        device_id: device.id,
        branch_id: device.branch_id,
        event_type: method === 'face' ? 'face_recognized' : method === 'card' ? 'card_read' : 'biometric',
        processed_at: timestamp || new Date().toISOString(),
      }

      if (member) {
        eventData.member_id = member.id
        
        // Validate and check in
        const { data: validation } = await supabase.rpc('validate_member_checkin', {
          _member_id: member.id,
          _branch_id: device.branch_id,
        })

        if (validation?.valid) {
          // inOutMode: 0=CheckIn, 1=CheckOut
          if (inOutMode === 1) {
            await supabase.rpc('member_check_out', { _member_id: member.id })
          } else {
            await supabase.rpc('member_check_in', {
              _member_id: member.id,
              _branch_id: device.branch_id,
              _method: method,
            })
          }
          eventData.access_granted = true
          eventData.response_sent = 'OPEN'
        } else if (validation?.reason === 'already_checked_in') {
          // Check out on second scan
          if (inOutMode === 1) {
            await supabase.rpc('member_check_out', { _member_id: member.id })
          }
          eventData.access_granted = true
          eventData.response_sent = 'OPEN'
        } else {
          eventData.access_granted = false
          eventData.denial_reason = validation?.reason || 'unknown'
          eventData.response_sent = 'DENIED'
          eventData.device_message = validation?.message || 'Access Denied'
        }
      } else {
        // Try staff/employee
        if (pin.includes('-')) {
          const { data: emp } = await supabase
            .from('employees')
            .select('id, user_id, branch_id, is_active')
            .eq('id', pin)
            .single()
          staff = emp
        }

        if (staff && staff.is_active) {
          eventData.staff_id = staff.id
          if (inOutMode === 1) {
            // Check out - update existing open record
            await supabase
              .from('staff_attendance')
              .update({ check_out: timestamp || new Date().toISOString() })
              .eq('employee_id', staff.id)
              .is('check_out', null)
              .order('check_in', { ascending: false })
              .limit(1)
          } else {
            await supabase.from('staff_attendance').insert({
              employee_id: staff.id,
              branch_id: device.branch_id,
              check_in: timestamp || new Date().toISOString(),
              check_in_method: method,
            })
          }
          eventData.access_granted = true
          eventData.response_sent = 'OPEN'
        } else {
          eventData.access_granted = false
          eventData.denial_reason = 'not_found'
          eventData.response_sent = 'DENIED'
          eventData.device_message = `Unknown PIN: ${pin}`
        }
      }

      await supabase.from('device_access_events').insert(eventData)
    }
  } else if (table === 'OPERLOG') {
    // Operation log — device admin events, just log them
    console.log(`OPERLOG from ${sn}:`, body)
  }

  return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
}

/** GET /iclock/getrequest — Device polls for pending commands */
async function handleGetRequest(supabase: any, sn: string) {
  const device = await lookupDevice(supabase, sn)
  if (!device) {
    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  // Check for pending biometric sync commands
  const { data: pendingSyncs } = await supabase
    .from('biometric_sync_queue')
    .select('*')
    .eq('device_id', device.id)
    .eq('status', 'pending')
    .order('queued_at', { ascending: true })
    .limit(20)

  // Check for pending device_commands
  const { data: pendingCmds } = await supabase
    .from('device_commands')
    .select('*')
    .eq('device_id', device.id)
    .eq('status', 'pending')
    .order('issued_at', { ascending: true })
    .limit(10)

  const commands: string[] = []
  let cmdId = 1

  // Convert biometric syncs to ICLOCK commands
  for (const sync of (pendingSyncs || [])) {
    if (sync.sync_type === 'enroll' || sync.sync_type === 'add') {
      // DATA UPDATE USERINFO — register user on device
      const pin = sync.person_uuid
      const name = (sync.person_name || 'User').substring(0, 24).replace(/\t/g, ' ')
      commands.push(`C:${cmdId}:DATA UPDATE USERINFO PIN=${pin}\tName=${name}\tPri=0`)
      cmdId++
    } else if (sync.sync_type === 'delete') {
      commands.push(`C:${cmdId}:DATA DELETE USERINFO PIN=${sync.person_uuid}`)
      cmdId++
    }

    // Mark as delivered
    await supabase
      .from('biometric_sync_queue')
      .update({ status: 'delivered', processed_at: new Date().toISOString() })
      .eq('id', sync.id)
  }

  // Convert device commands
  for (const cmd of (pendingCmds || [])) {
    if (cmd.command_type === 'relay_open') {
      commands.push(`C:${cmdId}:CONTROL DEVICE 1 1 ${cmd.payload?.duration || 5}`)
      cmdId++
    } else if (cmd.command_type === 'reboot') {
      commands.push(`C:${cmdId}:CONTROL DEVICE 2 0 0`)
      cmdId++
    } else if (cmd.command_type === 'clear_data') {
      commands.push(`C:${cmdId}:DATA DELETE USERINFO PIN=*`)
      cmdId++
    }

    await supabase
      .from('device_commands')
      .update({ status: 'executed', executed_at: new Date().toISOString() })
      .eq('id', cmd.id)
  }

  if (commands.length === 0) {
    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }

  return new Response(commands.join('\r\n'), {
    status: 200,
    headers: { 'Content-Type': 'text/plain' },
  })
}

/** POST /iclock/devicecmd — Device confirms command execution */
async function handleDeviceCmd(supabase: any, sn: string, body: string) {
  // Device sends back: ID=<cmd_id>&Return=<result>&CMD=<command>
  console.log(`Device ${sn} command response:`, body)
  
  // Parse the response to update sync status
  const params = new URLSearchParams(body)
  const returnCode = params.get('Return') || params.get('return')
  
  if (returnCode === '0') {
    // Command executed successfully
    console.log(`Device ${sn}: Command executed successfully`)
  } else {
    console.warn(`Device ${sn}: Command failed with code ${returnCode}`)
  }

  return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const pathname = url.pathname
    const sn = url.searchParams.get('SN') || url.searchParams.get('sn') || ''
    const table = url.searchParams.get('table') || ''

    const supabase = getSupabase()

    // Route based on ICLOCK protocol paths
    // The terminal sends to: ServerURL/iclock/cdata, /iclock/getrequest, /iclock/devicecmd
    // Since edge functions strip the function name from the path, we get /iclock/cdata etc.

    // Normalize: strip leading /terminal-iclock if present
    const path = pathname
      .replace(/^\/terminal-iclock/, '')
      .replace(/^\/+/, '/')
      .toLowerCase()

    // GET /iclock/cdata — Handshake
    if (req.method === 'GET' && (path.includes('/cdata') || path === '/' || path === '')) {
      if (!sn) {
        return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }
      return await handleHandshake(supabase, sn)
    }

    // POST /iclock/cdata — Attendance data push
    if (req.method === 'POST' && (path.includes('/cdata') || path === '/' || path === '')) {
      if (!sn) {
        return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }
      const body = await req.text()
      return await handleAttendancePush(supabase, sn, table, body)
    }

    // GET /iclock/getrequest — Device polls for commands
    if (req.method === 'GET' && path.includes('/getrequest')) {
      if (!sn) {
        return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
      }
      return await handleGetRequest(supabase, sn)
    }

    // POST /iclock/devicecmd — Device confirms command execution
    if (req.method === 'POST' && path.includes('/devicecmd')) {
      const body = await req.text()
      return await handleDeviceCmd(supabase, sn, body)
    }

    // Fallback — just return OK so device doesn't error
    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })

  } catch (error) {
    console.error('ICLOCK handler error:', error)
    return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } })
  }
})

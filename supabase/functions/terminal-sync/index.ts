import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

interface TerminalRequest {
  type: 'heartbeat' | 'access_event' | 'sync_request';
  device_sn: string;
  // heartbeat fields
  ip_address?: string;
  firmware_version?: string;
  status?: Record<string, unknown>;
  // access_event fields
  person_uuid?: string;
  confidence?: number;
  photo_base64?: string;
  timestamp?: string;
  // sync_request fields
  last_sync_at?: string;
}

async function lookupDeviceBySN(supabase: any, sn: string) {
  const { data, error } = await supabase
    .from('access_devices')
    .select('*')
    .eq('serial_number', sn)
    .single();
  if (error || !data) return null;
  return data;
}

async function handleHeartbeat(supabase: any, device: any, body: TerminalRequest, clientIp: string) {
  const updateData: Record<string, unknown> = {
    is_online: true,
    last_heartbeat: new Date().toISOString(),
  };
  if (body.ip_address || clientIp) {
    updateData.ip_address = body.ip_address || clientIp;
  }
  if (body.firmware_version) {
    updateData.firmware_version = body.firmware_version;
  }

  await supabase
    .from('access_devices')
    .update(updateData)
    .eq('id', device.id);

  // Fetch pending commands
  const { data: pendingCmds } = await supabase
    .from('device_commands')
    .select('*')
    .eq('device_id', device.id)
    .eq('status', 'pending')
    .order('issued_at', { ascending: true })
    .limit(10);

  const commands = (pendingCmds || []).map((cmd: any) => ({
    id: cmd.id,
    command: cmd.command_type,
    payload: cmd.payload,
  }));

  // Mark returned commands as executed
  if (commands.length > 0) {
    const ids = commands.map((c: any) => c.id);
    await supabase
      .from('device_commands')
      .update({ status: 'executed', executed_at: new Date().toISOString() })
      .in('id', ids);
  }

  // Check for pending biometric syncs
  const { data: pendingSyncs } = await supabase
    .from('biometric_sync_queue')
    .select('id')
    .eq('device_id', device.id)
    .eq('status', 'pending')
    .limit(1);

  return {
    success: true,
    device_id: device.id,
    server_time: new Date().toISOString(),
    has_pending_syncs: pendingSyncs && pendingSyncs.length > 0,
    commands,
    relay_mode: device.relay_mode ?? 1,
    relay_delay: device.relay_delay ?? 5,
  };
}

async function handleAccessEvent(supabase: any, device: any, body: TerminalRequest) {
  const { person_uuid, confidence, photo_base64, timestamp } = body;

  if (!person_uuid) {
    return { error: 'person_uuid is required', status: 400 };
  }

  // Try member by ID
  let member: any = null;
  const { data: m1 } = await supabase
    .from('members')
    .select('id, member_code, branch_id, user_id, custom_welcome_message, hardware_access_enabled, wiegand_code')
    .eq('id', person_uuid)
    .single();
  member = m1;

  // Fallback: wiegand_code
  if (!member) {
    const { data: m2 } = await supabase
      .from('members')
      .select('id, member_code, branch_id, user_id, custom_welcome_message, hardware_access_enabled, wiegand_code')
      .eq('wiegand_code', person_uuid)
      .single();
    member = m2;
  }

  const eventData: Record<string, unknown> = {
    device_id: device.id,
    branch_id: device.branch_id,
    event_type: 'face_recognized',
    confidence_score: confidence,
    photo_url: photo_base64 ? `data:image/jpeg;base64,${photo_base64.substring(0, 100)}...` : null,
    processed_at: timestamp || new Date().toISOString(),
  };

  let response: any;

  if (member) {
    eventData.member_id = member.id;
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', member.user_id)
      .single();
    const memberName = profile?.full_name || 'Member';

    if (member.branch_id !== device.branch_id) {
      response = { action: 'DENIED', message: 'Wrong Branch', led_color: 'RED', relay_delay: 0, person_name: memberName, member_code: member.member_code };
      eventData.access_granted = false;
      eventData.denial_reason = 'wrong_branch';
    } else {
      const { data: validationResult } = await supabase.rpc('validate_member_checkin', {
        _member_id: member.id,
        _branch_id: device.branch_id,
      });
      const validation = validationResult as any;

      if (validation?.valid) {
        await supabase.rpc('member_check_in', {
          _member_id: member.id,
          _branch_id: device.branch_id,
          _method: 'biometric',
        });
        let welcomeMsg = member.custom_welcome_message || `Welcome, ${memberName}!`;
        welcomeMsg = welcomeMsg.replace('{name}', memberName);
        response = {
          action: 'OPEN', message: welcomeMsg, led_color: 'GREEN',
          relay_mode: device.relay_mode ?? 1, relay_delay: device.relay_delay ?? 5,
          person_name: memberName, member_code: member.member_code,
          plan_name: validation.plan_name, days_remaining: validation.days_remaining,
        };
        eventData.access_granted = true;
      } else if (validation?.reason === 'already_checked_in') {
        response = {
          action: 'OPEN', message: `Welcome back, ${memberName}!`, led_color: 'GREEN',
          relay_mode: device.relay_mode ?? 1, relay_delay: device.relay_delay ?? 5,
          person_name: memberName, member_code: member.member_code,
        };
        eventData.access_granted = true;
      } else {
        let denyMessage = 'Access Denied';
        switch (validation?.reason) {
          case 'expired': denyMessage = 'Membership Expired'; break;
          case 'frozen': denyMessage = 'Membership Frozen'; break;
          case 'no_membership': denyMessage = 'No Active Plan'; break;
          default: denyMessage = validation?.message || 'See Reception';
        }
        response = { action: 'DENIED', message: denyMessage, led_color: 'RED', relay_delay: 0, person_name: memberName, member_code: member.member_code };
        eventData.access_granted = false;
        eventData.denial_reason = validation?.reason || 'unknown';
      }
    }
  } else {
    // Try staff
    const { data: employee } = await supabase
      .from('employees')
      .select('id, user_id, branch_id, is_active')
      .eq('id', person_uuid)
      .single();

    if (employee) {
      eventData.staff_id = employee.id;
      const { data: profile } = await supabase.from('profiles').select('full_name').eq('id', employee.user_id).single();
      const staffName = profile?.full_name || 'Staff';

      if (employee.is_active && employee.branch_id === device.branch_id) {
        await supabase.from('staff_attendance').insert({
          employee_id: employee.id,
          branch_id: device.branch_id,
          check_in: new Date().toISOString(),
          check_in_method: 'biometric',
        });
        response = { action: 'OPEN', message: `Welcome, ${staffName}!`, led_color: 'GREEN', relay_mode: device.relay_mode ?? 1, relay_delay: device.relay_delay ?? 5, person_name: staffName };
        eventData.access_granted = true;
      } else {
        response = { action: 'DENIED', message: employee.is_active ? 'Wrong Branch' : 'Account Inactive', led_color: 'RED', relay_delay: 0, person_name: staffName };
        eventData.access_granted = false;
        eventData.denial_reason = employee.is_active ? 'wrong_branch' : 'inactive';
      }
    } else {
      // Try trainer
      const { data: trainer } = await supabase
        .from('trainers')
        .select('id, user_id, branch_id, is_active')
        .eq('id', person_uuid)
        .single();

      if (trainer) {
        const { data: tp } = await supabase.from('profiles').select('full_name').eq('id', trainer.user_id).single();
        const trainerName = tp?.full_name || 'Trainer';

        if (trainer.is_active && trainer.branch_id === device.branch_id) {
          await supabase.from('staff_attendance').insert({
            employee_id: trainer.id,
            branch_id: device.branch_id,
            check_in: new Date().toISOString(),
            check_in_method: 'biometric',
          });
          response = { action: 'OPEN', message: `Welcome, ${trainerName}!`, led_color: 'GREEN', relay_mode: device.relay_mode ?? 1, relay_delay: device.relay_delay ?? 5, person_name: trainerName };
          eventData.access_granted = true;
        } else {
          response = { action: 'DENIED', message: trainer.is_active ? 'Wrong Branch' : 'Account Inactive', led_color: 'RED', relay_delay: 0, person_name: trainerName };
          eventData.access_granted = false;
          eventData.denial_reason = trainer.is_active ? 'wrong_branch' : 'inactive';
        }
      } else {
        response = { action: 'DENIED', message: 'Not Registered', led_color: 'RED', relay_delay: 0 };
        eventData.access_granted = false;
        eventData.denial_reason = 'not_found';
      }
    }
  }

  eventData.response_sent = response.action;
  eventData.device_message = response.message;
  await supabase.from('device_access_events').insert(eventData);

  return response;
}

async function handleSyncRequest(supabase: any, device: any, body: TerminalRequest) {
  const { last_sync_at } = body;

  // Return member roster for this branch
  let query = supabase
    .from('members')
    .select('id, member_code, user_id, hardware_access_enabled, wiegand_code, biometric_photo_url')
    .eq('branch_id', device.branch_id)
    .eq('status', 'active');

  if (last_sync_at) {
    query = query.gte('updated_at', last_sync_at);
  }

  const { data: members } = await query.limit(500);

  // Enrich with names
  const roster = [];
  for (const m of (members || [])) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', m.user_id)
      .single();

    roster.push({
      person_uuid: m.id,
      person_name: profile?.full_name || 'Unknown',
      member_code: m.member_code,
      photo_url: m.biometric_photo_url || null,
      wiegand_code: m.wiegand_code || null,
      access_enabled: m.hardware_access_enabled !== false,
    });
  }

  // Also include staff/trainers
  const { data: employees } = await supabase
    .from('employees')
    .select('id, user_id, biometric_photo_url, is_active')
    .eq('branch_id', device.branch_id)
    .eq('is_active', true);

  for (const e of (employees || [])) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', e.user_id)
      .single();

    roster.push({
      person_uuid: e.id,
      person_name: profile?.full_name || 'Staff',
      member_code: null,
      photo_url: e.biometric_photo_url || null,
      wiegand_code: null,
      access_enabled: true,
    });
  }

  // Update device last_sync
  await supabase
    .from('access_devices')
    .update({ last_sync: new Date().toISOString() })
    .eq('id', device.id);

  return {
    success: true,
    device_id: device.id,
    sync_time: new Date().toISOString(),
    roster_count: roster.length,
    roster,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: TerminalRequest = await req.json();
    const { type, device_sn } = body;

    if (!device_sn) {
      return new Response(
        JSON.stringify({ error: 'device_sn (serial number) is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!type || !['heartbeat', 'access_event', 'sync_request'].includes(type)) {
      return new Response(
        JSON.stringify({ error: 'type must be heartbeat, access_event, or sync_request' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Lookup device by serial number
    const device = await lookupDeviceBySN(supabase, device_sn);
    if (!device) {
      return new Response(
        JSON.stringify({ error: 'Device not found. Register this serial number in Device Management first.', device_sn }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract client IP from headers
    const clientIp = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 
                     req.headers.get('x-real-ip') || '';

    let result: any;

    switch (type) {
      case 'heartbeat':
        result = await handleHeartbeat(supabase, device, body, clientIp);
        break;
      case 'access_event':
        result = await handleAccessEvent(supabase, device, body);
        break;
      case 'sync_request':
        result = await handleSyncRequest(supabase, device, body);
        break;
    }

    if (result?.error && result?.status) {
      const { status, ...rest } = result;
      return new Response(
        JSON.stringify(rest),
        { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify(result),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Terminal sync error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

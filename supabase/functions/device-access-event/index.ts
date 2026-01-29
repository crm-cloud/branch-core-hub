import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AccessEventRequest {
  device_id: string;
  person_uuid: string;
  confidence: number;
  photo_base64?: string;
  timestamp?: string;
}

interface AccessEventResponse {
  action: 'OPEN' | 'DENIED';
  message: string;
  led_color: 'GREEN' | 'RED' | 'WHITE';
  relay_delay: number;
  person_name?: string;
  member_code?: string;
  plan_name?: string;
  days_remaining?: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: AccessEventRequest = await req.json();
    const { device_id, person_uuid, confidence, photo_base64, timestamp } = body;

    if (!device_id || !person_uuid) {
      return new Response(
        JSON.stringify({ error: 'device_id and person_uuid are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get device info
    const { data: device, error: deviceError } = await supabase
      .from('access_devices')
      .select('*')
      .eq('id', device_id)
      .single();

    if (deviceError || !device) {
      return new Response(
        JSON.stringify({ error: 'Device not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Try to find member by UUID (member.id)
    const { data: member } = await supabase
      .from('members')
      .select(`
        id,
        member_code,
        branch_id,
        user_id
      `)
      .eq('id', person_uuid)
      .single();

    let response: AccessEventResponse;
    let eventData: Record<string, unknown> = {
      device_id,
      branch_id: device.branch_id,
      event_type: 'face_recognized',
      confidence_score: confidence,
      photo_url: photo_base64 ? `data:image/jpeg;base64,${photo_base64.substring(0, 100)}...` : null,
      processed_at: timestamp || new Date().toISOString(),
    };

    if (member) {
      eventData.member_id = member.id;

      // Get member's profile for name
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', member.user_id)
        .single();

      const memberName = profile?.full_name || 'Member';

      // Check if member is at the correct branch
      if (member.branch_id !== device.branch_id) {
        response = {
          action: 'DENIED',
          message: 'Wrong Branch',
          led_color: 'RED',
          relay_delay: 0,
          person_name: memberName,
          member_code: member.member_code,
        };
        eventData.access_granted = false;
        eventData.denial_reason = 'wrong_branch';
        eventData.response_sent = 'DENIED';
        eventData.device_message = 'Wrong Branch';
      } else {
        // Check membership status using RPC
        const { data: validationResult } = await supabase
          .rpc('validate_member_checkin', {
            _member_id: member.id,
            _branch_id: device.branch_id,
          });

        const validation = validationResult as {
          valid: boolean;
          reason?: string;
          message?: string;
          plan_name?: string;
          days_remaining?: number;
        };

        if (validation?.valid) {
          // Perform check-in
          await supabase.rpc('member_check_in', {
            _member_id: member.id,
            _branch_id: device.branch_id,
            _method: 'biometric',
          });

          response = {
            action: 'OPEN',
            message: `Welcome, ${memberName}!`,
            led_color: 'GREEN',
            relay_delay: device.relay_delay || 5,
            person_name: memberName,
            member_code: member.member_code,
            plan_name: validation.plan_name,
            days_remaining: validation.days_remaining,
          };
          eventData.access_granted = true;
          eventData.response_sent = 'OPEN';
          eventData.device_message = `Welcome, ${memberName}!`;
        } else {
          // Denied based on reason
          let denyMessage = 'Access Denied';
          let denyReason = validation?.reason || 'unknown';

          switch (validation?.reason) {
            case 'expired':
              denyMessage = 'Membership Expired - See Reception';
              break;
            case 'frozen':
              denyMessage = 'Membership Frozen';
              break;
            case 'no_membership':
              denyMessage = 'No Active Plan';
              break;
            case 'already_checked_in':
              // Actually allow if already checked in
              response = {
                action: 'OPEN',
                message: `Welcome back, ${memberName}!`,
                led_color: 'GREEN',
                relay_delay: device.relay_delay || 5,
                person_name: memberName,
                member_code: member.member_code,
              };
              eventData.access_granted = true;
              eventData.response_sent = 'OPEN';
              eventData.device_message = `Welcome back, ${memberName}!`;
              
              // Insert event and return early
              await supabase.from('device_access_events').insert(eventData);
              return new Response(
                JSON.stringify(response),
                { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
              );
            default:
              denyMessage = validation?.message || 'Please See Reception';
          }

          response = {
            action: 'DENIED',
            message: denyMessage,
            led_color: 'RED',
            relay_delay: 0,
            person_name: memberName,
            member_code: member.member_code,
          };
          eventData.access_granted = false;
          eventData.denial_reason = denyReason;
          eventData.response_sent = 'DENIED';
          eventData.device_message = denyMessage;
        }
      }
    } else {
      // Try to find as staff
      const { data: employee } = await supabase
        .from('employees')
        .select('id, user_id, branch_id, is_active')
        .eq('id', person_uuid)
        .single();

      if (employee) {
        eventData.staff_id = employee.id;

        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', employee.user_id)
          .single();

        const staffName = profile?.full_name || 'Staff';

        if (employee.is_active && employee.branch_id === device.branch_id) {
          // Staff check-in - log attendance
          await supabase.from('staff_attendance').insert({
            employee_id: employee.id,
            branch_id: device.branch_id,
            check_in: new Date().toISOString(),
            check_in_method: 'biometric',
          });

          response = {
            action: 'OPEN',
            message: `Welcome, ${staffName}!`,
            led_color: 'GREEN',
            relay_delay: device.relay_delay || 5,
            person_name: staffName,
          };
          eventData.access_granted = true;
          eventData.response_sent = 'OPEN';
          eventData.device_message = `Welcome, ${staffName}!`;
        } else {
          response = {
            action: 'DENIED',
            message: employee.is_active ? 'Wrong Branch' : 'Account Inactive',
            led_color: 'RED',
            relay_delay: 0,
            person_name: staffName,
          };
          eventData.access_granted = false;
          eventData.denial_reason = employee.is_active ? 'wrong_branch' : 'inactive';
          eventData.response_sent = 'DENIED';
          eventData.device_message = employee.is_active ? 'Wrong Branch' : 'Account Inactive';
        }
      } else {
        // Person not found
        response = {
          action: 'DENIED',
          message: 'Not Registered',
          led_color: 'RED',
          relay_delay: 0,
        };
        eventData.access_granted = false;
        eventData.denial_reason = 'not_found';
        eventData.response_sent = 'DENIED';
        eventData.device_message = 'Not Registered';
      }
    }

    // Log the event
    await supabase.from('device_access_events').insert(eventData);

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Access event error:', error);
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errMsg }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

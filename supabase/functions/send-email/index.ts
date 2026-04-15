// v2.0.0 — Universal Email Dispatcher with Branded Template Support
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── Branded HTML Email Template ─────────────────────────────────────────────
function wrapInBrandedTemplate(bodyHtml: string, subject: string, variables?: Record<string, string>): string {
  let content = bodyHtml;
  // Interpolate variables like {{user_name}}, {{invoice_id}}, {{amount}}
  if (variables) {
    for (const [key, value] of Object.entries(variables)) {
      content = content.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #000000; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    .wrapper { background-color: #000000; width: 100%; padding: 32px 0; }
    .container { max-width: 600px; margin: 0 auto; background-color: #111111; border-radius: 16px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #000000 0%, #1a1a1a 100%); padding: 32px 40px; text-align: center; border-bottom: 2px solid #EAB308; }
    .logo-text { color: #EAB308; font-size: 28px; font-weight: 800; letter-spacing: 2px; margin: 0; }
    .logo-sub { color: #ffffff60; font-size: 11px; letter-spacing: 4px; text-transform: uppercase; margin-top: 4px; }
    .body { padding: 40px; color: #ffffff; line-height: 1.7; font-size: 15px; }
    .body h1, .body h2, .body h3 { color: #ffffff; margin-top: 0; }
    .body p { color: #ffffffcc; margin: 0 0 16px; }
    .body a { color: #EAB308; }
    .cta-btn { display: inline-block; background: #EAB308; color: #000000 !important; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 15px; margin: 16px 0; }
    .footer { background-color: #0a0a0a; padding: 24px 40px; text-align: center; border-top: 1px solid #ffffff10; }
    .footer p { color: #ffffff40; font-size: 12px; margin: 0 0 4px; }
    .footer a { color: #EAB308; text-decoration: none; }
    @media (max-width: 640px) { .body { padding: 24px; } .header { padding: 24px; } }
  </style>
</head>
<body>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <p class="logo-text">INCLINE</p>
        <p class="logo-sub">Fitness</p>
      </div>
      <div class="body">
        ${content}
      </div>
      <div class="footer">
        <p>The Incline Life by Incline</p>
        <p style="margin-top: 8px;"><a href="https://inclinefitness.in">inclinefitness.in</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    const { to, subject, html, text, branch_id, attachments, from_override, use_branded_template, variables } = body;

    if (!to || !subject || (!html && !text)) {
      return json({ error: "Missing required fields: to, subject, html or text" }, 400);
    }

    // Apply branded template if requested
    let finalHtml = html || text!;
    if (use_branded_template) {
      finalHtml = wrapInBrandedTemplate(finalHtml, subject, variables);
    }

    // Fetch active email integration
    const { data: integrations, error: intErr } = await supabase
      .from("integration_settings")
      .select("*")
      .eq("integration_type", "email")
      .eq("is_active", true)
      .limit(1);

    if (intErr || !integrations?.length) {
      return json({ error: "No active email provider configured. Please configure an email provider in Settings → Integrations." }, 400);
    }

    const integration = integrations[0];
    const config = integration.config || {};
    const credentials = integration.credentials || {};
    const provider = integration.provider;

    const fromEmail = from_override || config.from_email || "noreply@inclinefitness.in";
    const fromName = config.from_name || "Incline Fitness";

    let result: { success: boolean; message_id?: string; error?: string };

    switch (provider) {
      case "smtp":
        result = await sendViaSMTP(to, subject, finalHtml, fromEmail, fromName, config, credentials);
        break;
      case "sendgrid":
        result = await sendViaSendGrid(to, subject, finalHtml, fromEmail, fromName, credentials, attachments);
        break;
      case "mailgun":
        result = await sendViaMailgun(to, subject, finalHtml, fromEmail, fromName, config, credentials, attachments);
        break;
      case "ses":
        result = await sendViaSES(to, subject, finalHtml, fromEmail, fromName, config, credentials);
        break;
      default:
        result = { success: false, error: `Unsupported email provider: ${provider}` };
    }

    // Log to communication_logs
    if (branch_id) {
      await supabase.from("communication_logs").insert({
        branch_id,
        type: "email",
        recipient: to,
        subject,
        content: (html || text || "").slice(0, 500),
        status: result.success ? "sent" : "failed",
        sent_at: new Date().toISOString(),
      });
    }

    if (result.success) {
      return json({ success: true, message_id: result.message_id, provider });
    } else {
      return json({ error: result.error, provider }, 500);
    }
  } catch (error: any) {
    console.error("send-email error:", error);
    return json({ error: error.message }, 500);
  }
});

// === SendGrid ===
async function sendViaSendGrid(
  to: string, subject: string, html: string, fromEmail: string, fromName: string,
  credentials: Record<string, string>,
  attachments?: Array<{ filename: string; content_base64: string; content_type: string }>
) {
  const payload: any = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: fromEmail, name: fromName },
    subject,
    content: [{ type: "text/html", value: html }],
  };

  if (attachments?.length) {
    payload.attachments = attachments.map(a => ({
      content: a.content_base64,
      filename: a.filename,
      type: a.content_type,
      disposition: "attachment",
    }));
  }

  try {
    const resp = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${credentials.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (resp.ok || resp.status === 202) {
      const msgId = resp.headers.get("x-message-id") || undefined;
      return { success: true, message_id: msgId };
    }
    const errText = await resp.text();
    return { success: false, error: `SendGrid ${resp.status}: ${errText}` };
  } catch (e) {
    return { success: false, error: `SendGrid failed: ${(e as Error).message}` };
  }
}

// === Mailgun ===
async function sendViaMailgun(
  to: string, subject: string, html: string, fromEmail: string, fromName: string,
  config: Record<string, string>, credentials: Record<string, string>,
  attachments?: Array<{ filename: string; content_base64: string; content_type: string }>
) {
  const domain = config.domain;
  if (!domain) return { success: false, error: "Mailgun domain not configured" };

  const formData = new FormData();
  formData.append("from", `${fromName} <${fromEmail}>`);
  formData.append("to", to);
  formData.append("subject", subject);
  formData.append("html", html);

  if (attachments?.length) {
    for (const att of attachments) {
      const bytes = Uint8Array.from(atob(att.content_base64), c => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: att.content_type });
      formData.append("attachment", blob, att.filename);
    }
  }

  try {
    const resp = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`api:${credentials.api_key}`)}`,
      },
      body: formData,
    });

    if (resp.ok) {
      const data = await resp.json();
      return { success: true, message_id: data.id };
    }
    const errText = await resp.text();
    return { success: false, error: `Mailgun ${resp.status}: ${errText}` };
  } catch (e) {
    return { success: false, error: `Mailgun failed: ${(e as Error).message}` };
  }
}

// === SMTP (via simple HTTPS relay approach — sends raw email via external relay) ===
async function sendViaSMTP(
  to: string, subject: string, html: string, fromEmail: string, fromName: string,
  config: Record<string, string>, credentials: Record<string, string>
) {
  // Deno doesn't have native SMTP; we use a lightweight HTTP-to-SMTP bridge pattern
  // For production SMTP, users should use SendGrid/Mailgun. This provides basic support.
  const host = config.host;
  const port = config.port || "587";
  const username = credentials.username;
  const password = credentials.password;

  if (!host || !username || !password) {
    return { success: false, error: "SMTP host, username, and password are required" };
  }

  try {
    const portNum = parseInt(port);
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    // Helper to build email message body
    const buildMessage = () => [
      `From: ${fromName} <${fromEmail}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      html,
      `.`,
    ].join("\r\n");

    // Port 465: Implicit TLS — connect with TLS from the start
    if (port === "465") {
      const tlsConn = await Deno.connectTls({ hostname: host, port: portNum });

      const read = async () => {
        const buf = new Uint8Array(4096);
        const n = await tlsConn.read(buf);
        return n ? decoder.decode(buf.subarray(0, n)) : "";
      };
      const write = async (cmd: string) => {
        await tlsConn.write(encoder.encode(cmd + "\r\n"));
        return await read();
      };

      await read(); // greeting
      await write(`EHLO inclinefitness.in`);
      await write("AUTH LOGIN");
      await write(btoa(username));
      const authResp = await write(btoa(password));

      if (!authResp.startsWith("235")) {
        tlsConn.close();
        return { success: false, error: `SMTP auth failed (port 465): ${authResp}` };
      }

      await write(`MAIL FROM:<${fromEmail}>`);
      await write(`RCPT TO:<${to}>`);
      await write("DATA");
      const dataResp = await write(buildMessage());
      await write("QUIT");
      tlsConn.close();

      return dataResp.startsWith("250")
        ? { success: true, message_id: `smtp-${Date.now()}` }
        : { success: false, error: `SMTP DATA error (465): ${dataResp}` };
    }

    // Port 587 / 25: plain TCP first
    const conn = await Deno.connect({ hostname: host, port: portNum });

    const read = async () => {
      const buf = new Uint8Array(4096);
      const n = await conn.read(buf);
      return n ? decoder.decode(buf.subarray(0, n)) : "";
    };

    const write = async (cmd: string) => {
      await conn.write(encoder.encode(cmd + "\r\n"));
      return await read();
    };

    await read(); // greeting
    await write(`EHLO inclinefitness.in`);

    // STARTTLS for port 587
    if (port === "587") {
      await write("STARTTLS");
      const tlsConn = await Deno.startTls(conn, { hostname: host });
      
      const tlsWrite = async (cmd: string) => {
        await tlsConn.write(encoder.encode(cmd + "\r\n"));
        const buf = new Uint8Array(1024);
        const n = await tlsConn.read(buf);
        return n ? decoder.decode(buf.subarray(0, n)) : "";
      };

      await tlsWrite(`EHLO inclinefitness.in`);

      // AUTH LOGIN
      await tlsWrite("AUTH LOGIN");
      await tlsWrite(btoa(username));
      const authResp = await tlsWrite(btoa(password));

      if (!authResp.startsWith("235")) {
        tlsConn.close();
        return { success: false, error: "SMTP authentication failed" };
      }

      await tlsWrite(`MAIL FROM:<${fromEmail}>`);
      await tlsWrite(`RCPT TO:<${to}>`);
      await tlsWrite("DATA");

      const message = [
        `From: ${fromName} <${fromEmail}>`,
        `To: ${to}`,
        `Subject: ${subject}`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=UTF-8`,
        ``,
        html,
        `.`,
      ].join("\r\n");

      const dataResp = await tlsWrite(message);
      await tlsWrite("QUIT");
      tlsConn.close();

      return dataResp.startsWith("250")
        ? { success: true, message_id: `smtp-${Date.now()}` }
        : { success: false, error: `SMTP DATA error: ${dataResp}` };
    }

    // Plain SMTP (port 25/465)
    await write("AUTH LOGIN");
    await write(btoa(username));
    const authResp = await write(btoa(password));

    if (!authResp.startsWith("235")) {
      conn.close();
      return { success: false, error: "SMTP authentication failed" };
    }

    await write(`MAIL FROM:<${fromEmail}>`);
    await write(`RCPT TO:<${to}>`);
    await write("DATA");

    const message = [
      `From: ${fromName} <${fromEmail}>`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      html,
      `.`,
    ].join("\r\n");

    const dataResp = await write(message);
    await write("QUIT");
    conn.close();

    return dataResp.startsWith("250")
      ? { success: true, message_id: `smtp-${Date.now()}` }
      : { success: false, error: `SMTP error: ${dataResp}` };
  } catch (e) {
    return { success: false, error: `SMTP failed: ${(e as Error).message}` };
  }
}

// === AWS SES (Simple REST approach) ===
async function sendViaSES(
  to: string, subject: string, html: string, fromEmail: string, fromName: string,
  config: Record<string, string>, credentials: Record<string, string>
) {
  const region = config.region || "ap-south-1";
  const accessKeyId = credentials.access_key_id;
  const secretKey = credentials.secret_access_key;

  if (!accessKeyId || !secretKey) {
    return { success: false, error: "AWS SES access key and secret key are required" };
  }

  const endpoint = `https://email.${region}.amazonaws.com/v2/email/outbound-emails`;

  const body = JSON.stringify({
    Content: {
      Simple: {
        Body: { Html: { Charset: "UTF-8", Data: html } },
        Subject: { Charset: "UTF-8", Data: subject },
      },
    },
    Destination: { ToAddresses: [to] },
    FromEmailAddress: `${fromName} <${fromEmail}>`,
  });

  // SigV4 signing is complex; for simplicity, use SES v1 query API
  const params = new URLSearchParams({
    Action: "SendEmail",
    "Source": `${fromName} <${fromEmail}>`,
    "Destination.ToAddresses.member.1": to,
    "Message.Subject.Data": subject,
    "Message.Body.Html.Data": html,
  });

  try {
    const resp = await fetch(`https://email.${region}.amazonaws.com/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Amz-Date": new Date().toISOString().replace(/[:-]|\.\d{3}/g, ""),
        Authorization: `AWS ${accessKeyId}:${secretKey}`,
      },
      body: params.toString(),
    });

    if (resp.ok) {
      const text = await resp.text();
      const messageIdMatch = text.match(/<MessageId>(.*?)<\/MessageId>/);
      return { success: true, message_id: messageIdMatch?.[1] };
    }
    const errText = await resp.text();
    return { success: false, error: `SES ${resp.status}: ${errText.slice(0, 300)}` };
  } catch (e) {
    return { success: false, error: `SES failed: ${(e as Error).message}` };
  }
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface ParsedLead {
  name: string | null;
  phone: string | null;
  email: string | null;
  details: string | null;
}

function decodeQuotedPrintable(text: string): string {
  return text
    .replace(/=\r?\n/g, '')
    .replace(/=([0-9A-F]{2})/gi, (_, hex) => {
      return String.fromCharCode(parseInt(hex, 16));
    });
}

function decodeBase64(text: string): string {
  try {
    const binaryString = atob(text);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new TextDecoder('utf-8').decode(bytes);
  } catch (e) {
    return text;
  }
}

function stripHtmlTags(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

interface EmailHeaders {
  contentType: string;
  charset: string;
  transferEncoding: string;
  isHtml: boolean;
}

function parseEmailHeaders(headerText: string): EmailHeaders {
  const contentTypeMatch = headerText.match(/Content-Type:\s*([^;\r\n]+)/i);
  const charsetMatch = headerText.match(/charset=["']?([^"'\s;]+)/i);
  const transferEncodingMatch = headerText.match(/Content-Transfer-Encoding:\s*([^\r\n]+)/i);

  return {
    contentType: contentTypeMatch ? contentTypeMatch[1].trim().toLowerCase() : 'text/plain',
    charset: charsetMatch ? charsetMatch[1].trim().toLowerCase() : 'utf-8',
    transferEncoding: transferEncodingMatch ? transferEncodingMatch[1].trim().toLowerCase() : '7bit',
    isHtml: contentTypeMatch ? contentTypeMatch[1].toLowerCase().includes('text/html') : false,
  };
}

function decodeEmailBody(body: string, headers: EmailHeaders): string {
  console.log('Decoding email body with headers:', {
    contentType: headers.contentType,
    charset: headers.charset,
    transferEncoding: headers.transferEncoding,
    isHtml: headers.isHtml,
    bodyPreview: body.substring(0, 200)
  });

  let decoded = body;

  if (headers.transferEncoding === 'quoted-printable') {
    decoded = decodeQuotedPrintable(decoded);
    console.log('After quoted-printable decode:', decoded.substring(0, 200));
  } else if (headers.transferEncoding === 'base64') {
    decoded = decodeBase64(decoded);
    console.log('After base64 decode:', decoded.substring(0, 200));
  }

  if (headers.isHtml) {
    decoded = stripHtmlTags(decoded);
    console.log('After HTML strip:', decoded.substring(0, 200));
  }

  decoded = decoded
    .replace(/=2D/g, '-')
    .replace(/=3D/g, '=')
    .replace(/=20/g, ' ')
    .trim();

  console.log('Final decoded body:', decoded.substring(0, 200));

  return decoded;
}

function extractNameAndEmail(fromField: string): { name: string; email: string } {
  const nameEmailMatch = fromField.match(/^"?([^"<]+)"?\s*<([^>]+)>$/);

  if (nameEmailMatch) {
    return {
      name: nameEmailMatch[1].trim(),
      email: nameEmailMatch[2].trim().toLowerCase()
    };
  }

  const emailOnlyMatch = fromField.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailOnlyMatch) {
    const email = emailOnlyMatch[1].toLowerCase();
    const namePart = email.split('@')[0].replace(/[._]/g, ' ');
    return {
      name: namePart,
      email: email
    };
  }

  return {
    name: fromField.trim() || 'Lead sin nombre',
    email: ''
  };
}

function parseLeadFromBody(body: string): ParsedLead {
  const result: ParsedLead = {
    name: null,
    phone: null,
    email: null,
    details: null,
  };

  const namePatterns = [
    /(?:nombre\s*completo\s*(?:del\s*contratante)?|nombre):\s*(.+)/i,
    /nombre\s+completo:\s*(.+)/i,
  ];

  for (const pattern of namePatterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      result.name = match[1].trim();
      break;
    }
  }

  const emailPatterns = [
    /(?:correo\s*electr[oó]nico|email|e-mail):\s*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/i,
  ];

  for (const pattern of emailPatterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      result.email = match[1].trim().toLowerCase();
      break;
    }
  }

  const phonePatterns = [
    /(?:celular|tel[eé]fono|phone):\s*([\d\s\-\+\(\)]+)/i,
  ];

  for (const pattern of phonePatterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      const cleaned = match[1].trim().replace(/\s/g, '');
      if (cleaned.length >= 10) {
        result.phone = normalizePhone(cleaned);
        break;
      }
    }
  }

  const detailsPatterns = [
    /(?:detalles|comentarios|observaciones):\s*(.+)/i,
  ];

  for (const pattern of detailsPatterns) {
    const match = body.match(pattern);
    if (match && match[1]) {
      result.details = match[1].trim();
      break;
    }
  }

  if (!result.details && (result.name || result.email || result.phone)) {
    result.details = body.substring(0, 500);
  }

  return result;
}

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/[^0-9+]/g, '');

  if (/^\+521[0-9]{10}$/.test(cleaned)) {
    return cleaned;
  } else if (/^\+52[0-9]{10}$/.test(cleaned)) {
    return '+521' + cleaned.substring(3);
  } else if (/^521[0-9]{10}$/.test(cleaned)) {
    return '+' + cleaned;
  } else if (/^52[0-9]{10}$/.test(cleaned)) {
    return '+521' + cleaned.substring(2);
  } else if (/^[0-9]{10}$/.test(cleaned)) {
    return '+521' + cleaned;
  }

  return cleaned;
}

interface EmailMessage {
  uid: number;
  messageId: string;
  from: string;
  subject: string;
  body: string;
  date: string;
  headers: EmailHeaders;
}

async function fetchIMAPEmails(
  host: string,
  port: number,
  user: string,
  password: string,
  tls: boolean,
  mailbox: string,
  lastSyncUid: number | null
): Promise<EmailMessage[]> {
  let conn;
  try {
    if (tls) {
      conn = await Deno.connectTls({
        hostname: host,
        port: port,
      });
    } else {
      conn = await Deno.connect({
        hostname: host,
        port: port,
        transport: "tcp",
      });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let buffer = new Uint8Array(4096);
    await conn.read(buffer);

    await conn.write(encoder.encode(`A001 LOGIN ${user} ${password}\r\n`));
    buffer = new Uint8Array(4096);
    await conn.read(buffer);

    await conn.write(encoder.encode(`A002 SELECT ${mailbox}\r\n`));
    buffer = new Uint8Array(4096);
    await conn.read(buffer);

    const searchQuery = lastSyncUid !== null
      ? `A003 UID SEARCH UID ${lastSyncUid + 1}:*\r\n`
      : `A003 UID SEARCH ALL\r\n`;

    await conn.write(encoder.encode(searchQuery));
    buffer = new Uint8Array(4096);
    const searchBytesRead = await conn.read(buffer);
    const searchResponse = decoder.decode(buffer.subarray(0, searchBytesRead || 0));

    const messageUids: number[] = [];
    const searchMatch = searchResponse.match(/\* SEARCH (.+)/);
    if (searchMatch) {
      const uids = searchMatch[1].trim().split(' ').filter(id => id && id !== 'A003');
      messageUids.push(...uids.map(id => parseInt(id)).filter(id => !isNaN(id)));
    }

    const emails: EmailMessage[] = [];
    const maxMessages = Math.min(messageUids.length, 50);

    for (let i = 0; i < maxMessages; i++) {
      const uid = messageUids[i];

      await conn.write(encoder.encode(`A${100 + i} UID FETCH ${uid} (BODY[HEADER] BODY[TEXT])\r\n`));

      let fullResponse = '';
      let bytesRead = 0;
      do {
        buffer = new Uint8Array(8192);
        bytesRead = await conn.read(buffer) || 0;
        fullResponse += decoder.decode(buffer.subarray(0, bytesRead));
      } while (bytesRead > 0 && !fullResponse.includes(`A${100 + i} OK`));

      const headerMatch = fullResponse.match(/BODY\[HEADER\]\s*\{(\d+)\}\s*([\s\S]+?)(?=BODY\[TEXT\])/);
      const headerText = headerMatch ? headerMatch[2] : '';

      const messageIdMatch = fullResponse.match(/Message-ID:\s*<([^>]+)>/i);
      const fromMatch = fullResponse.match(/From:\s*(.+)/i);
      const subjectMatch = fullResponse.match(/Subject:\s*(.+)/i);
      const dateMatch = fullResponse.match(/Date:\s*(.+)/i);

      const headers = parseEmailHeaders(headerText);

      const bodyMatch = fullResponse.match(/BODY\[TEXT\]\s*\{(\d+)\}\s*([\s\S]+?)(?=\r?\n\))/);
      let rawBody = '';
      if (bodyMatch) {
        rawBody = bodyMatch[2].trim();
      }

      const decodedBody = rawBody ? decodeEmailBody(rawBody, headers) : 'Empty message';

      emails.push({
        uid: uid,
        messageId: messageIdMatch ? messageIdMatch[1] : `${host}-${uid}-${Date.now()}`,
        from: fromMatch ? fromMatch[1].trim() : 'unknown',
        subject: subjectMatch ? subjectMatch[1].trim() : 'No subject',
        body: decodedBody,
        date: dateMatch ? dateMatch[1].trim() : new Date().toISOString(),
        headers: headers,
      });
    }

    await conn.write(encoder.encode("A999 LOGOUT\r\n"));

    try {
      conn.close();
    } catch (e) {
    }

    return emails;

  } catch (error) {
    console.error("Error fetching IMAP emails:", error);
    if (conn) {
      try {
        conn.close();
      } catch (e) {
      }
    }
    return [];
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing authorization header"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const parts = token.split('.');
    if (parts.length !== 3) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid token format"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let userId: string;
    try {
      const payload = JSON.parse(atob(parts[1]));
      userId = payload.sub;
      if (!userId) {
        throw new Error("No user ID in token");
      }
    } catch (e) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid token payload"
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (!profile || profile.role !== "admin") {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Only admins can sync emails"
        }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: accounts, error: accountsError } = await supabase
      .from("email_ingest_accounts")
      .select("*")
      .eq("is_active", true);

    if (accountsError) throw accountsError;
    if (!accounts || accounts.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No active email accounts configured",
          stats: { read: 0, created: 0, duplicates: 0, errors: 0 }
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let totalRead = 0;
    let totalCreated = 0;
    let totalDuplicates = 0;
    let totalErrors = 0;

    for (const account of accounts) {
      try {
        const emails = await fetchIMAPEmails(
          account.imap_host,
          account.imap_port,
          account.imap_user,
          account.imap_password,
          account.imap_tls,
          account.imap_mailbox,
          account.last_sync_uid
        );

        let highestUid = account.last_sync_uid || 0;

        for (const email of emails) {
          totalRead++;

          if (email.uid > highestUid) {
            highestUid = email.uid;
          }

          const { data: existing } = await supabase
            .from("email_ingest_messages")
            .select("id")
            .eq("message_id", email.messageId)
            .maybeSingle();

          if (existing) {
            totalDuplicates++;
            continue;
          }

          const senderInfo = extractNameAndEmail(email.from);
          const parsed = parseLeadFromBody(email.body);

          const finalName = parsed.name || senderInfo.name;
          const finalEmail = parsed.email || null;
          const finalPhone = parsed.phone || "";

          let status = "processed";
          let createdProspectId = null;
          let errorDetails = null;

          try {
            let existingProspect = null;

            if (finalEmail) {
              const { data: prospect } = await supabase
                .from("prospects")
                .select("id")
                .eq("email", finalEmail)
                .maybeSingle();
              existingProspect = prospect;
            } else if (finalPhone) {
              const { data: prospect } = await supabase
                .from("prospects")
                .select("id")
                .eq("phone", finalPhone)
                .maybeSingle();
              existingProspect = prospect;
            }

            if (existingProspect) {
              status = "duplicate";
              totalDuplicates++;

              const { data: emailMessage } = await supabase
                .from("email_messages")
                .insert({
                  entity_type: "prospect",
                  prospect_id: existingProspect.id,
                  to_email: account.imap_user,
                  from_email: senderInfo.email || email.from,
                  subject: email.subject,
                  body_html: email.body.replace(/\n/g, '<br>'),
                  body_text: email.body,
                  status: "sent",
                  direction: "inbound",
                })
                .select()
                .single();

              await supabase.from("interactions").insert({
                prospect_id: existingProspect.id,
                created_by: userId,
                type: "email",
                content: `Email recibido: ${email.subject}`
              });

              if (emailMessage) {
                const preview = email.body.length > 200 ? email.body.substring(0, 200) + '...' : email.body;
                await supabase.from("activity_feed").insert({
                  entity_type: "prospect",
                  entity_id: existingProspect.id,
                  event_type: "email",
                  direction: "inbound",
                  title: email.subject,
                  description: email.body.replace(/\n/g, '<br>'),
                  preview: preview,
                  metadata: {
                    from_email: senderInfo.email || email.from,
                    to_email: account.imap_user,
                  },
                  source_table: "email_messages",
                  source_id: emailMessage.id,
                  created_by: userId,
                });
              }
            } else {
              const { data: newProspect, error: prospectError } = await supabase
                .from("prospects")
                .insert({
                  full_name: finalName,
                  phone: finalPhone,
                  email: finalEmail || null,
                  comments: parsed.details || `Email: ${email.subject}\n\n${email.body.substring(0, 300)}`,
                  origin: "web",
                  status: "nuevo",
                  executive_id: userId,
                })
                .select("id")
                .single();

              if (prospectError) throw prospectError;

              createdProspectId = newProspect.id;
              totalCreated++;

              const { data: emailMessage } = await supabase
                .from("email_messages")
                .insert({
                  entity_type: "prospect",
                  prospect_id: newProspect.id,
                  to_email: account.imap_user,
                  from_email: senderInfo.email || email.from,
                  subject: email.subject,
                  body_html: email.body.replace(/\n/g, '<br>'),
                  body_text: email.body,
                  status: "sent",
                  direction: "inbound",
                })
                .select()
                .single();

              if (emailMessage) {
                const preview = email.body.length > 200 ? email.body.substring(0, 200) + '...' : email.body;
                await supabase.from("activity_feed").insert({
                  entity_type: "prospect",
                  entity_id: newProspect.id,
                  event_type: "email",
                  direction: "inbound",
                  title: email.subject,
                  description: email.body.replace(/\n/g, '<br>'),
                  preview: preview,
                  metadata: {
                    from_email: senderInfo.email || email.from,
                    to_email: account.imap_user,
                  },
                  source_table: "email_messages",
                  source_id: emailMessage.id,
                  created_by: userId,
                });
              }
            }
          } catch (prospectError) {
            status = "error";
            errorDetails = prospectError.message;
            totalErrors++;
          }

          await supabase.from("email_ingest_messages").insert({
            account_id: account.id,
            message_id: email.messageId,
            from_email: senderInfo.email || email.from,
            subject: email.subject,
            raw_body: email.body,
            parsed_name: finalName,
            parsed_phone: finalPhone,
            parsed_email: finalEmail,
            parsed_details: parsed.details,
            status,
            created_prospect_id: createdProspectId,
            error_details: errorDetails,
            received_at: email.date,
          });
        }

        await supabase
          .from("email_ingest_accounts")
          .update({
            last_sync_at: new Date().toISOString(),
            last_sync_uid: highestUid,
            messages_synced_count: (account.messages_synced_count || 0) + emails.length
          })
          .eq("id", account.id);

      } catch (accountError) {
        console.error(`Error processing account ${account.id}:`, accountError);
        totalErrors++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Sync completed successfully`,
        stats: {
          read: totalRead,
          created: totalCreated,
          duplicates: totalDuplicates,
          errors: totalErrors
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error) {
    console.error("Error syncing emails:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to sync emails"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

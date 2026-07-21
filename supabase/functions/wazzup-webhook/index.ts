import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function toIsoSafe(input: unknown): string {
  const d =
    typeof input === "number"
      ? new Date(input)
      : new Date(String(input ?? ""));
  return Number.isNaN(d.getTime())
    ? new Date().toISOString()
    : d.toISOString();
}

interface WazzupWebhookPayload {
  test?: boolean;
  messages?: WazzupMessage[];
  statuses?: WazzupStatus[];
}

interface WazzupMessage {
  messageId: string;
  channelId: string;
  chatId: string;
  chatType: string;
  type: string;
  text?: string;
  contentUri?: string;
  status: string;
  timestamp?: number;
  dateTime?: string;
  userId?: string;
  isEcho?: boolean;
}

interface WazzupStatus {
  messageId: string;
  status: string;
  timestamp: number;
  error?: {
    code?: string;
    description?: string;
  };
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

    const payload: WazzupWebhookPayload = await req.json();

    console.log("=== WAZZUP WEBHOOK RECEIVED ===");
    console.log("Timestamp:", new Date().toISOString());
    console.log("Headers:", JSON.stringify(Object.fromEntries(req.headers.entries())));
    console.log("Payload:", JSON.stringify(payload, null, 2));

    if (payload.test === true) {
      console.log("Wazzup test webhook received - responding 200 OK");
      return new Response(
        JSON.stringify({ success: true, message: "Test webhook received" }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (payload.messages && Array.isArray(payload.messages)) {
      for (const msg of payload.messages) {
        await handleIncomingMessage(supabase, msg);
      }
    }

    if (payload.statuses && Array.isArray(payload.statuses)) {
      for (const status of payload.statuses) {
        await handleStatusUpdate(supabase, status);
      }
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

async function handleIncomingMessage(supabase: any, msg: WazzupMessage) {
  const channelId = msg.channelId;

  const { data: channel } = await supabase
    .from("wa_channels")
    .select("channel_id, is_primary")
    .eq("channel_id", channelId)
    .eq("is_primary", true)
    .maybeSingle();

  if (!channel) {
    console.log(`Ignoring message from non-primary channel: ${channelId}`);
    return;
  }

  let contactPlain = msg.chatId;

  if (contactPlain.includes('@c.us')) {
    contactPlain = contactPlain.replace('@c.us', '');
  }

  const contactE164 = formatToE164(contactPlain);
  const mediaUrl = msg.contentUri || null;
  const occurredAt = toIsoSafe(msg.dateTime ?? msg.timestamp);

  console.log("Processing message:", {
    originalChatId: msg.chatId,
    contactPlain,
    contactE164,
    channelId,
    messageId: msg.messageId,
    occurredAt
  });

  let conversationId: string;
  let assignedTo: string | null = null;

  const { data: existingConv } = await supabase
    .from("wa_conversations")
    .select("id, assigned_to")
    .eq("channel_id", channelId)
    .eq("contact_plain", contactPlain)
    .maybeSingle();

  if (existingConv) {
    conversationId = existingConv.id;
    assignedTo = existingConv.assigned_to;

    const { data: currentConv } = await supabase
      .from("wa_conversations")
      .select("unread_admin, unread_exec")
      .eq("id", conversationId)
      .single();

    await supabase
      .from("wa_conversations")
      .update({
        last_message_at: occurredAt,
        last_message_preview: msg.text?.substring(0, 100) || "[Archivo multimedia]",
        last_inbound_at: occurredAt,
        unread_admin: (currentConv?.unread_admin || 0) + 1,
        unread_exec: assignedTo ? (currentConv?.unread_exec || 0) + 1 : 0,
      })
      .eq("id", conversationId);
  } else {
    let clientId: string | null = null;
    let prospectId: string | null = null;

    const { data: clients } = await supabase
      .from("clients")
      .select("id")
      .or(`phone.eq.${contactE164},phone.eq.${contactPlain},whatsapp.eq.${contactPlain},whatsapp.eq.${contactE164}`);

    if (clients && clients.length > 0) {
      clientId = clients[0].id;
    } else {
      const { data: prospects } = await supabase
        .from("prospects")
        .select("id")
        .or(`phone.eq.${contactE164},phone.eq.${contactPlain}`);

      if (prospects && prospects.length > 0) {
        prospectId = prospects[0].id;
      } else {
        const { data: newProspect, error: prospectError } = await supabase
          .from("prospects")
          .insert({
            full_name: `Prospecto WhatsApp (${contactPlain})`,
            phone: contactPlain,
            email: null,
            product_interest: "auto",
            origin: "whatsapp",
            priority: "media",
            status: "nuevo",
            comments: "Prospecto creado automáticamente desde WhatsApp Inbox",
            last_activity_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (prospectError) {
          console.error("Error creating prospect:", prospectError);
        } else {
          prospectId = newProspect.id;
        }
      }
    }

    const { data: newConv, error: convError } = await supabase
      .from("wa_conversations")
      .insert({
        channel_id: channelId,
        contact_phone_e164: contactE164,
        contact_plain: contactPlain,
        prospect_id: prospectId,
        client_id: clientId,
        assigned_to: null,
        inbox_state: "unassigned",
        last_message_at: occurredAt,
        last_message_preview: msg.text?.substring(0, 100) || "[Archivo multimedia]",
        last_inbound_at: occurredAt,
        unread_admin: 1,
        unread_exec: 0,
      })
      .select("id")
      .single();

    if (convError) {
      console.error("Error creating conversation:", convError);
      throw convError;
    }

    conversationId = newConv.id;
  }

  const { error: msgError } = await supabase
    .from("wa_messages")
    .insert({
      conversation_id: conversationId,
      direction: "in",
      wazzup_message_id: msg.messageId,
      from_plain: contactPlain,
      to_plain: channelId,
      type: msg.type || "text",
      text: msg.text || null,
      media_url: mediaUrl,
      media_meta: mediaUrl ? { contentUri: mediaUrl } : null,
      status: msg.status === "inbound" ? "received" : msg.status,
      sent_at: occurredAt,
    });

  if (msgError && msgError.code !== "23505") {
    console.error("Error inserting message:", msgError);
  } else if (msgError?.code === "23505") {
    console.log(`Message ${msg.messageId} already exists (duplicate ignored)`);
  }
}

async function handleStatusUpdate(supabase: any, status: WazzupStatus) {
  console.log("Status update received:", JSON.stringify(status));

  const statusMap: Record<string, string> = {
    'queued': 'pending',
    'sent': 'sent',
    'delivered': 'delivered',
    'read': 'read',
    'error': 'failed',
    'failed': 'failed',
    'deleted': 'failed',
    'inbound': 'received',
  };

  const mappedStatus = statusMap[status.status.toLowerCase()] || status.status;

  const updateData: any = {
    status: mappedStatus,
  };

  if (status.error) {
    updateData.error_details = status.error;
    updateData.status = 'failed';
    console.error("Message failed:", status.messageId, status.error);
  }

  const { error } = await supabase
    .from("wa_messages")
    .update(updateData)
    .eq("wazzup_message_id", status.messageId);

  if (error) {
    console.error("Error updating message status:", error);
  } else {
    console.log(`Updated message ${status.messageId} to status: ${mappedStatus}`);
  }
}

function formatToE164(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");

  if (cleaned.startsWith("521")) {
    return `+${cleaned}`;
  }

  if (cleaned.startsWith("52") && cleaned.length === 12) {
    return `+${cleaned}`;
  }

  if (cleaned.startsWith("52") && cleaned.length === 11) {
    return `+521${cleaned.substring(2)}`;
  }

  if (cleaned.length === 10) {
    return `+521${cleaned}`;
  }

  if (!cleaned.startsWith("52")) {
    return `+521${cleaned}`;
  }

  return `+521${cleaned}`;
}

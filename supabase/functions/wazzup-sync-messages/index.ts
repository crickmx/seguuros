import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-internal-secret",
};

interface WazzupMessage {
  messageId: string;
  chatId: string;
  chatType: string;
  type: string;
  text?: string;
  contentUri?: string;
  timestamp: number;
  userId?: string;
  status?: string;
}

async function syncSingleChat(
  supabase: any,
  wazzupApiKey: string,
  channelId: string,
  chatId: string
): Promise<{ success: boolean; imported: number; skipped: number; total: number }> {
  const contactPlain = chatId.replace('@c.us', '');
  const formattedChatId = chatId.includes('@') ? chatId : `${chatId}@c.us`;
  const wazzupUrl = `https://api.wazzup24.com/v3/channels/${channelId}/chats/${formattedChatId}/messages?count=50`;

  console.log(`Syncing chat: ${formattedChatId} (plain: ${contactPlain}) on channel: ${channelId}`);

  const wazzupResponse = await fetch(wazzupUrl, {
    headers: {
      "Authorization": `Bearer ${wazzupApiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!wazzupResponse.ok) {
    const errorText = await wazzupResponse.text();
    console.error("Wazzup API error:", errorText);
    throw new Error(`Wazzup API error: ${wazzupResponse.status}`);
  }

  const messages: WazzupMessage[] = await wazzupResponse.json();

  const { data: conversation } = await supabase
    .from("wa_conversations")
    .select("id")
    .eq("channel_id", channelId)
    .eq("contact_plain", contactPlain)
    .maybeSingle();

  if (!conversation) {
    throw new Error(`Conversation not found for ${contactPlain}`);
  }

  let imported = 0;
  let skipped = 0;

  for (const msg of messages.reverse()) {
    const isOutbound = msg.chatType === 'user' || msg.userId;
    const direction = isOutbound ? 'out' : 'in';

    const { error } = await supabase
      .from("wa_messages")
      .insert({
        conversation_id: conversation.id,
        direction: direction,
        wazzup_message_id: msg.messageId,
        from_plain: isOutbound ? channelId : contactPlain,
        to_plain: isOutbound ? contactPlain : channelId,
        type: msg.type || "text",
        text: msg.text || null,
        media_url: msg.contentUri || null,
        media_meta: msg.contentUri ? { contentUri: msg.contentUri } : null,
        status: msg.status || "received",
        sent_at: new Date(msg.timestamp).toISOString(),
      });

    if (error) {
      if (error.code === "23505") {
        skipped++;
      } else {
        console.error("Error importing message:", msg.messageId, error);
      }
    } else {
      imported++;
    }
  }

  return {
    success: true,
    imported,
    skipped,
    total: messages.length
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
    const authHeader = req.headers.get("authorization");
    const internalSecret = req.headers.get("x-internal-secret");

    if (!authHeader && !internalSecret) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const wazzupApiKey = Deno.env.get("WAZZUP_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!wazzupApiKey) {
      throw new Error("WAZZUP_API_KEY not configured");
    }

    const contentType = req.headers.get("content-type") || "";
    const rawBody = await req.text();
    let body: any = {};

    if (rawBody && contentType.includes("application/json")) {
      try {
        body = JSON.parse(rawBody);
      } catch {
        body = {};
      }
    }

    const { chatId, channelId } = body;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (chatId && channelId) {
      const result = await syncSingleChat(supabase, wazzupApiKey, channelId, chatId);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: primaryChannel } = await supabase
      .from("wa_channels")
      .select("channel_id")
      .eq("is_primary", true)
      .maybeSingle();

    if (!primaryChannel) {
      return new Response(
        JSON.stringify({
          success: false,
          message: "No se encontró canal principal. Ejecuta wazzup-sync-channels primero."
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: conversations } = await supabase
      .from("wa_conversations")
      .select("id, channel_id, contact_plain")
      .eq("channel_id", primaryChannel.channel_id)
      .limit(50);

    if (!conversations || conversations.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          synced: 0,
          errors: 0,
          message: "No hay conversaciones para sincronizar"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Starting sync for ${conversations.length} conversations`);

    let totalImported = 0;
    let totalSkipped = 0;
    let errors = 0;
    const errorDetails: any[] = [];

    for (const conv of conversations) {
      if (!conv.channel_id) {
        console.log(`Skipping conversation ${conv.contact_plain} - no channel_id`);
        continue;
      }

      try {
        console.log(`\n=== Syncing conversation ${conv.id} ===`);
        console.log(`Contact: ${conv.contact_plain}, Channel: ${conv.channel_id}`);

        const result = await syncSingleChat(
          supabase,
          wazzupApiKey,
          conv.channel_id,
          conv.contact_plain
        );

        console.log(`Result: imported=${result.imported}, skipped=${result.skipped}, total=${result.total}`);

        totalImported += result.imported || 0;
        totalSkipped += result.skipped || 0;
      } catch (error) {
        console.error(`Error syncing chat ${conv.contact_plain}:`, error);
        errors++;
        errorDetails.push({
          contact: conv.contact_plain,
          channelId: conv.channel_id,
          error: error.message || String(error)
        });
      }
    }

    console.log(`\n=== Sync Complete ===`);
    console.log(`Total imported: ${totalImported}`);
    console.log(`Total skipped: ${totalSkipped}`);
    console.log(`Total errors: ${errors}`);

    return new Response(
      JSON.stringify({
        success: true,
        synced: totalImported,
        skipped: totalSkipped,
        errors,
        total: conversations.length,
        errorDetails: errorDetails.length > 0 ? errorDetails : undefined
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Sync error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

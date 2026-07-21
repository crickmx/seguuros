import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendMessageRequest {
  conversation_id: string;
  text?: string;
  mode: "text" | "template" | "media";
  templateId?: string;
  templateValues?: Array<{ parameter: string; value: string }>;
  media_url?: string;
  media_type?: string;
  storage_path?: string;
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
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const wazzupApiKey = Deno.env.get("WAZZUP_API_KEY")!;
    const wazzupBaseUrl = Deno.env.get("WAZZUP_BASE_URL") || "https://api.wazzup24.com";

    const authHeader = req.headers.get("Authorization");
    console.log("Auth header present:", !!authHeader);

    if (!authHeader) {
      console.error("Missing authorization header");
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    console.log("User auth result:", { userId: user?.id, error: userError?.message });

    if (userError || !user) {
      console.error("User authentication failed:", userError?.message);
      return new Response(
        JSON.stringify({
          error: "Unauthorized",
          details: userError?.message || "Auth session missing!",
          debug: {
            hasAuthHeader: !!authHeader,
            authHeaderLength: authHeader?.length,
            userError: userError?.message
          }
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseAdminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: profile } = await supabaseAdminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "ejecutivo", "cliente"].includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: "Forbidden - insufficient permissions" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const body: SendMessageRequest = await req.json();

    const { data: conversation, error: convError } = await supabaseAdminClient
      .from("wa_conversations")
      .select("id, channel_id, contact_plain, assigned_to, last_inbound_at")
      .eq("id", body.conversation_id)
      .single();

    if (convError || !conversation) {
      return new Response(
        JSON.stringify({ error: "Conversation not found" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let channelId = conversation.channel_id;

    if (!channelId) {
      const { data: primaryChannel } = await supabaseAdminClient
        .from("wa_channels")
        .select("channel_id")
        .eq("is_primary", true)
        .maybeSingle();

      if (!primaryChannel) {
        const { data: anyChannel } = await supabaseAdminClient
          .from("wa_channels")
          .select("channel_id")
          .limit(1)
          .maybeSingle();

        if (!anyChannel) {
          return new Response(
            JSON.stringify({ error: "No hay canales de WhatsApp configurados" }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        channelId = anyChannel.channel_id;
      } else {
        channelId = primaryChannel.channel_id;
      }

      await supabaseAdminClient
        .from("wa_conversations")
        .update({ channel_id: channelId })
        .eq("id", conversation.id);
    }

    console.log("=== SENDING MESSAGE ===");
    console.log("Conversation contact_plain:", conversation.contact_plain);
    console.log("Channel ID:", channelId);
    console.log("Message mode:", body.mode);
    console.log("Message text length:", body.text?.length || 0);

    const formattedChatId = conversation.contact_plain.includes('@')
      ? conversation.contact_plain
      : `${conversation.contact_plain}@c.us`;

    console.log("Formatted chatId:", formattedChatId);

    let wazzupPayload: any = {
      channelId: channelId,
      chatType: "whatsapp",
      chatId: formattedChatId,
    };

    if (body.mode === "media" && body.media_url) {
      wazzupPayload.contentUri = body.media_url;
      if (body.text) {
        wazzupPayload.text = body.text;
      }
    } else if (body.mode === "text") {
      wazzupPayload.text = body.text;
    } else if (body.mode === "template" && body.templateId) {
      wazzupPayload.templateId = body.templateId;
      if (body.templateValues && body.templateValues.length > 0) {
        wazzupPayload.templateValues = body.templateValues;
      }
    }

    console.log("Sending to Wazzup API:", {
      url: `${wazzupBaseUrl}/v3/message`,
      payload: JSON.stringify(wazzupPayload),
    });

    const wazzupResponse = await fetch(`${wazzupBaseUrl}/v3/message`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${wazzupApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(wazzupPayload),
    });

    const responseText = await wazzupResponse.text();
    console.log("Wazzup API response:", {
      status: wazzupResponse.status,
      statusText: wazzupResponse.statusText,
      body: responseText,
    });

    if (!wazzupResponse.ok) {
      console.error("Wazzup API error:", {
        status: wazzupResponse.status,
        body: responseText,
        payload: wazzupPayload,
      });
      return new Response(
        JSON.stringify({ error: "Failed to send message", details: responseText }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const wazzupData = JSON.parse(responseText);
    const messageId = wazzupData.messageId || crypto.randomUUID();

    const messageData: any = {
      conversation_id: conversation.id,
      direction: "out",
      wazzup_message_id: messageId,
      from_plain: conversation.channel_id,
      to_plain: conversation.contact_plain,
      type: body.mode === "template" ? "template" : body.mode === "media" ? (body.media_type || "document") : "text",
      text: body.text || null,
      status: "sent",
      sent_at: new Date().toISOString(),
    };

    if (body.mode === "media") {
      messageData.media_url = body.media_url;
      messageData.storage_path = body.storage_path;
      messageData.media_meta = {
        type: body.media_type
      };
    }

    console.log("Saving message to database:", messageData);

    const { data: savedMessage, error: msgError } = await supabaseAdminClient
      .from("wa_messages")
      .insert(messageData)
      .select()
      .single();

    if (msgError) {
      console.error("Error saving message to database:", msgError);
      return new Response(
        JSON.stringify({ error: "Failed to save message", details: msgError.message }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("Message saved successfully:", savedMessage);

    let previewText = body.text?.substring(0, 100) || "[Template enviado]";
    if (body.mode === "media" && !body.text) {
      const mediaTypeEmoji = body.media_type === "image" ? "📷" :
                            body.media_type === "video" ? "🎥" :
                            body.media_type === "audio" ? "🎵" : "📄";
      previewText = `${mediaTypeEmoji} Archivo adjunto`;
    }

    await supabaseAdminClient
      .from("wa_conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: previewText,
      })
      .eq("id", conversation.id);

    return new Response(
      JSON.stringify({ success: true, messageId }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Send message error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

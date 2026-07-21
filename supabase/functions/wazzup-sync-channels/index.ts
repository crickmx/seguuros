import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-Internal-Secret",
};

interface WazzupChannel {
  channelId: string;
  transport: string;
  state: string;
  name?: string;
  plainId?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    console.log("=== SYNC CHANNELS REQUEST ===");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    console.log("Supabase URL:", supabaseUrl);
    console.log("Service key available:", supabaseServiceKey ? "yes" : "no");

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    console.log("✓ Authenticated as admin user");

    const wazzupApiKey = Deno.env.get("WAZZUP_API_KEY")!;
    const wazzupBaseUrl = Deno.env.get("WAZZUP_BASE_URL") || "https://api.wazzup24.com";
    const wazzupSenderPlain = Deno.env.get("WAZZUP_SENDER_PLAIN") || "5214429253333";

    console.log("Fetching channels from Wazzup API...");

    const channelsResponse = await fetch(`${wazzupBaseUrl}/v3/channels`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${wazzupApiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!channelsResponse.ok) {
      const errorText = await channelsResponse.text();
      console.error("Wazzup API error:", channelsResponse.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to fetch channels", details: errorText }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const channels: WazzupChannel[] = await channelsResponse.json();
    console.log(`Found ${channels.length} channels from Wazzup`);

    let primaryChannel: WazzupChannel | null = null;

    for (const channel of channels) {
      console.log(`Checking channel: ${channel.channelId}, plainId: ${channel.plainId}`);

      if (channel.plainId === wazzupSenderPlain ||
          channel.plainId === `+${wazzupSenderPlain}` ||
          channel.plainId?.replace(/\D/g, "") === wazzupSenderPlain.replace(/\D/g, "")) {
        primaryChannel = channel;
        console.log(`✓ Found primary channel: ${channel.channelId}`);

        const { error: upsertError } = await supabaseClient
          .from("wa_channels")
          .upsert({
            channel_id: channel.channelId,
            transport: channel.transport,
            plain_id: channel.plainId || wazzupSenderPlain,
            state: channel.state,
            is_primary: true,
          }, {
            onConflict: "channel_id",
          });

        if (upsertError) {
          console.error("Error upserting channel:", upsertError);
        } else {
          console.log("✓ Channel saved to database");
        }

        break;
      }
    }

    if (!primaryChannel) {
      console.error("Primary channel not found. Available channels:",
        channels.map(c => `${c.channelId} (${c.plainId})`).join(", "));

      return new Response(
        JSON.stringify({
          error: "Primary channel not found",
          searchingFor: wazzupSenderPlain,
          availableChannels: channels.map(c => ({ channelId: c.channelId, plainId: c.plainId }))
        }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("✓ Sync completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        primaryChannel: {
          channelId: primaryChannel.channelId,
          plainId: primaryChannel.plainId,
          transport: primaryChannel.transport,
          state: primaryChannel.state,
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Sync channels error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

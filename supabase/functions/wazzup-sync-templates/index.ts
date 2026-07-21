import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface WazzupTemplate {
  id: string;
  name: string;
  language: string;
  category: string;
  status: string;
  components: Array<{
    type: string;
    format?: string;
    text?: string;
    buttons?: Array<{
      type: string;
      text: string;
    }>;
  }>;
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
    const wazzupApiKey = Deno.env.get("WAZZUP_API_KEY")!;
    const wazzupBaseUrl = Deno.env.get("WAZZUP_BASE_URL") || "https://api.wazzup24.com";

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized", details: userError?.message }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!profile || !["admin", "ejecutivo"].includes(profile.role)) {
      return new Response(
        JSON.stringify({ error: "Forbidden - insufficient permissions" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: primaryChannel } = await supabaseClient
      .from("wa_channels")
      .select("channel_id")
      .eq("is_primary", true)
      .maybeSingle();

    if (!primaryChannel) {
      return new Response(
        JSON.stringify({ error: "No primary channel configured" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let totalSynced = 0;
    let totalErrors = 0;

    const channels = [primaryChannel];

    for (const channel of channels) {
      try {
        console.log(`Syncing templates for channel: ${channel.channel_id}`);

        const templatesResponse = await fetch(
          `${wazzupBaseUrl}/v3/templates/whatsapp?channelId=${channel.channel_id}`,
          {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${wazzupApiKey}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (!templatesResponse.ok) {
          console.error(`Failed to fetch templates for channel ${channel.channel_id}:`,
            await templatesResponse.text());
          totalErrors++;
          continue;
        }

        const templatesData = await templatesResponse.json();
        const templates: WazzupTemplate[] = templatesData.templates || [];

        console.log(`Found ${templates.length} templates for channel ${channel.channel_id}`);

        for (const template of templates) {
          try {
            const { error: upsertError } = await supabaseClient
              .from("wa_templates")
              .upsert({
                channel_id: channel.channel_id,
                wazzup_template_id: template.id,
                name: template.name,
                language: template.language,
                category: template.category,
                status: template.status,
                components: template.components,
                synced_at: new Date().toISOString(),
              }, {
                onConflict: 'wazzup_template_id'
              });

            if (upsertError) {
              console.error("Error upserting template:", template.id, upsertError);
              totalErrors++;
            } else {
              totalSynced++;
            }
          } catch (error) {
            console.error("Error processing template:", template.id, error);
            totalErrors++;
          }
        }
      } catch (error) {
        console.error(`Error syncing channel ${channel.channel_id}:`, error);
        totalErrors++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: totalSynced,
        errors: totalErrors
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Sync templates error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

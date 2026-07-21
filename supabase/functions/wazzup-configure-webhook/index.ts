import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const wazzupApiKey = Deno.env.get("WAZZUP_API_KEY");
    const wazzupBaseUrl = Deno.env.get("WAZZUP_BASE_URL") || "https://api.wazzup24.com";
    const supabaseUrl = Deno.env.get("SUPABASE_URL");

    if (!wazzupApiKey) {
      throw new Error("WAZZUP_API_KEY not configured");
    }

    const webhookUrl = `${supabaseUrl}/functions/v1/wazzup-webhook`;

    console.log("=== CONFIGURING WEBHOOK ===");
    console.log("Webhook URL:", webhookUrl);
    console.log("Wazzup Base URL:", wazzupBaseUrl);

    const webhookBody = {
      webhooksUri: webhookUrl,
      subscriptions: {
        messagesAndStatuses: true,
        contactsAndDealsCreation: true
      }
    };

    const endpoints = [
      { method: "PATCH", url: `${wazzupBaseUrl}/v3/webhooks`, body: webhookBody },
      { method: "PUT", url: `${wazzupBaseUrl}/v3/webhooks`, body: webhookBody },
      { method: "POST", url: `${wazzupBaseUrl}/v3/webhooks`, body: webhookBody },
    ];

    const results = [];

    for (const endpoint of endpoints) {
      console.log(`\nTrying ${endpoint.method} ${endpoint.url}`);

      try {
        const response = await fetch(endpoint.url, {
          method: endpoint.method,
          headers: {
            "Authorization": `Bearer ${wazzupApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(endpoint.body),
        });

        const responseText = await response.text();
        let data;

        try {
          data = JSON.parse(responseText);
        } catch {
          data = { rawResponse: responseText };
        }

        console.log(`Status: ${response.status}`);
        console.log(`Response:`, JSON.stringify(data, null, 2));

        results.push({
          endpoint: `${endpoint.method} ${endpoint.url}`,
          status: response.status,
          success: response.ok,
          response: data,
        });

        if (response.ok) {
          return new Response(
            JSON.stringify({
              success: true,
              message: "Webhook configured successfully",
              webhookUrl: webhookUrl,
              endpoint: `${endpoint.method} ${endpoint.url}`,
              response: data,
            }),
            {
              status: 200,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
      } catch (err) {
        console.log(`Error: ${err.message}`);
        results.push({
          endpoint: `${endpoint.method} ${endpoint.url}`,
          error: err.message,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: "Could not find working webhook endpoint",
        webhookUrl: webhookUrl,
        attemptedEndpoints: results,
        instructions: "Wazzup24 may not support webhook configuration via API, or requires different authentication. Check their documentation or configure manually if available in dashboard.",
      }),
      {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error configuring webhook:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        instructions: "Check WAZZUP_API_KEY configuration and API access",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

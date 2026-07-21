import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { createTransport } from "npm:nodemailer@6.9.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    if (profile.role !== 'admin') {
      throw new Error("Only admin can test email configuration");
    }

    const { config_id } = await req.json();

    if (!config_id) {
      throw new Error("config_id is required");
    }

    const { data: emailConfig, error: configError } = await supabase
      .from("email_outbound_config")
      .select("*")
      .eq("id", config_id)
      .maybeSingle();

    if (configError || !emailConfig) {
      throw new Error("Email configuration not found");
    }

    console.log(`Testing email configuration: ${emailConfig.name}`);
    console.log(`SMTP: ${emailConfig.smtp_host}:${emailConfig.smtp_port}`);
    console.log(`User: ${emailConfig.smtp_user}`);
    console.log(`Secure: ${emailConfig.smtp_secure}`);

    let testStatus = 'success';
    let testError = null;

    try {
      const transporter = createTransport({
        host: emailConfig.smtp_host,
        port: emailConfig.smtp_port,
        secure: emailConfig.smtp_secure,
        auth: {
          user: emailConfig.smtp_user,
          pass: emailConfig.smtp_password,
        },
      });

      await transporter.verify();
      console.log("SMTP connection verified successfully");

      const testMailOptions = {
        from: emailConfig.from_name
          ? `"${emailConfig.from_name}" <${emailConfig.from_email}>`
          : emailConfig.from_email,
        to: emailConfig.from_email,
        subject: "Prueba de configuración SMTP - Seguuros CRM",
        text: "Este es un correo de prueba para verificar la configuración SMTP.",
        html: "<p>Este es un correo de prueba para verificar la configuración SMTP.</p><p><strong>La configuración está funcionando correctamente.</strong></p>",
      };

      const info = await transporter.sendMail(testMailOptions);
      console.log("Test email sent successfully:", info.messageId);
    } catch (error) {
      testStatus = 'failed';
      testError = error instanceof Error ? error.message : "Unknown error during test";
      console.error("Test failed:", testError);
    }

    const { error: updateError } = await supabase
      .from("email_outbound_config")
      .update({
        last_test_at: new Date().toISOString(),
        last_test_status: testStatus,
        last_test_error: testError,
      })
      .eq("id", config_id);

    if (updateError) {
      console.error("Failed to update test status:", updateError);
    }

    if (testStatus === 'failed') {
      throw new Error(testError || "Email test failed");
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email configuration test successful",
        config_name: emailConfig.name,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error testing email config:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 400,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
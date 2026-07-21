import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.39.3";
import { createTransport } from "npm:nodemailer@6.9.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendEmailRequest {
  entity_type: 'prospect' | 'client';
  entity_id: string;
  to_email: string;
  cc_email?: string;
  bcc_email?: string;
  subject: string;
  body_html: string;
  body_text?: string;
  attachments?: Array<{
    file_name: string;
    file_path: string;
    mime_type: string;
    file_size: number;
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing authorization header",
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error("Auth error:", authError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid or expired token",
          details: authError?.message,
        }),
        {
          status: 401,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || !profile) {
      throw new Error("Profile not found");
    }

    if (profile.role !== 'admin' && profile.role !== 'executive') {
      throw new Error("Insufficient permissions");
    }

    const emailData: SendEmailRequest = await req.json();

    if (profile.role === 'executive') {
      if (emailData.entity_type === 'prospect') {
        const { data: prospect } = await supabase
          .from("prospects")
          .select("executive_id")
          .eq("id", emailData.entity_id)
          .maybeSingle();

        if (!prospect || prospect.executive_id !== user.id) {
          throw new Error("Not authorized to send email to this prospect");
        }
      } else if (emailData.entity_type === 'client') {
        const { data: client } = await supabase
          .from("clients")
          .select("assigned_to")
          .eq("id", emailData.entity_id)
          .maybeSingle();

        if (!client || client.assigned_to !== user.id) {
          throw new Error("Not authorized to send email to this client");
        }
      }
    }

    const { data: emailConfig } = await supabase
      .from("email_outbound_config")
      .select("*")
      .eq("is_active", true)
      .maybeSingle();

    let emailStatus = 'sent';
    let providerMessageId = null;
    let errorDetails = null;

    if (!emailConfig) {
      console.warn("No active email configuration. Email will be logged but not sent.");
      emailStatus = 'failed';
      errorDetails = 'No se encontró configuración de email activa';
    } else {
      console.log(`Using email config: ${emailConfig.name}`);
      console.log(`SMTP: ${emailConfig.smtp_host}:${emailConfig.smtp_port}`);

      try {
        const transporterConfig: any = {
          host: emailConfig.smtp_host,
          port: emailConfig.smtp_port,
          secure: emailConfig.smtp_secure,
          auth: {
            user: emailConfig.smtp_user,
            pass: emailConfig.smtp_password,
          },
        };

        if (!emailConfig.smtp_secure && emailConfig.smtp_port === 587) {
          transporterConfig.requireTLS = true;
        }

        const transporter = createTransport(transporterConfig);

        const mailOptions: any = {
          from: emailConfig.from_name
            ? `"${emailConfig.from_name}" <${emailConfig.from_email}>`
            : emailConfig.from_email,
          to: emailData.to_email,
          subject: emailData.subject,
          html: emailData.body_html,
          text: emailData.body_text || emailData.body_html.replace(/<[^>]*>/g, ''),
        };

        if (emailData.cc_email) {
          mailOptions.cc = emailData.cc_email;
        }

        if (emailData.bcc_email) {
          mailOptions.bcc = emailData.bcc_email;
        }

        if (emailData.attachments && emailData.attachments.length > 0) {
          const attachments = [];

          for (const att of emailData.attachments) {
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('email-attachments')
              .download(att.file_path);

            if (downloadError) {
              console.error(`Error downloading attachment ${att.file_name}:`, downloadError);
              continue;
            }

            const arrayBuffer = await fileData.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);

            attachments.push({
              filename: att.file_name,
              content: uint8Array,
              contentType: att.mime_type,
            });
          }

          mailOptions.attachments = attachments;
        }

        console.log("Attempting to send email to:", emailData.to_email);
        console.log("Mail options:", {
          from: mailOptions.from,
          to: mailOptions.to,
          subject: mailOptions.subject,
          hasHtml: !!mailOptions.html,
          hasText: !!mailOptions.text,
          hasAttachments: !!mailOptions.attachments,
        });

        const info = await transporter.sendMail(mailOptions);
        providerMessageId = info.messageId;
        console.log("Email sent successfully:", info.messageId);
        console.log("Full info:", info);
      } catch (error) {
        console.error("Failed to send email:", error);
        emailStatus = 'failed';
        errorDetails = error instanceof Error ? error.message : 'Error desconocido al enviar email';
      }
    }

    const { data: emailMessage, error: insertError } = await supabase
      .from("email_messages")
      .insert({
        entity_type: emailData.entity_type,
        [`${emailData.entity_type}_id`]: emailData.entity_id,
        sent_by: user.id,
        to_email: emailData.to_email,
        cc_email: emailData.cc_email,
        bcc_email: emailData.bcc_email,
        subject: emailData.subject,
        body_html: emailData.body_html,
        body_text: emailData.body_text || emailData.body_html.replace(/<[^>]*>/g, ''),
        status: emailStatus,
        provider_message_id: providerMessageId,
        error_details: errorDetails,
      })
      .select()
      .single();

    if (insertError) {
      throw insertError;
    }

    if (emailData.attachments && emailData.attachments.length > 0) {
      const attachmentsData = emailData.attachments.map(att => ({
        email_message_id: emailMessage.id,
        file_name: att.file_name,
        file_path: att.file_path,
        mime_type: att.mime_type,
        file_size: att.file_size,
      }));

      await supabase.from("email_attachments").insert(attachmentsData);
    }

    const { error: activityError } = await supabase
      .from("activity_feed")
      .insert({
        entity_type: emailData.entity_type,
        entity_id: emailData.entity_id,
        event_type: 'email',
        direction: 'outbound',
        title: emailData.subject,
        description: emailData.body_html,
        preview: emailData.body_text || emailData.body_html.replace(/<[^>]*>/g, '').substring(0, 200),
        metadata: {
          to_email: emailData.to_email,
          cc_email: emailData.cc_email,
          status: emailStatus,
          has_attachments: emailData.attachments && emailData.attachments.length > 0,
          attachments_count: emailData.attachments?.length || 0,
        },
        source_table: 'email_messages',
        source_id: emailMessage.id,
        created_by: user.id,
      });

    if (activityError) {
      console.error("Failed to create activity feed entry:", activityError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Email logged successfully",
        email_id: emailMessage.id,
        status: emailStatus,
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Error sending email:", error);
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
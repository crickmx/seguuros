import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RequestBody {
  action: 'update_user' | 'delete_user' | 'reset_password';
  userId: string;
  updates?: {
    email?: string;
    full_name?: string;
    phone?: string;
    role?: string;
    assigned_executive_id?: string | null;
    password?: string;
  };
  newPassword?: string;
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
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");

    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error("Invalid token");
    }

    const { data: profile } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      throw new Error("Unauthorized: Admin access required");
    }

    const body: RequestBody = await req.json();

    switch (body.action) {
      case "update_user": {
        if (!body.updates) {
          throw new Error("Updates are required");
        }

        const authUpdates: any = {};
        if (body.updates.email) {
          authUpdates.email = body.updates.email;
        }
        if (body.updates.password) {
          if (body.updates.password.length < 6) {
            throw new Error("La contraseña debe tener al menos 6 caracteres");
          }
          authUpdates.password = body.updates.password;
        }

        if (Object.keys(authUpdates).length > 0) {
          const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(
            body.userId,
            authUpdates
          );
          if (authUpdateError) throw authUpdateError;
        }

        const profileUpdates: any = {};
        if (body.updates.full_name !== undefined) profileUpdates.full_name = body.updates.full_name;
        if (body.updates.phone !== undefined) profileUpdates.phone = body.updates.phone;
        if (body.updates.role !== undefined) profileUpdates.role = body.updates.role;
        if (body.updates.assigned_executive_id !== undefined) {
          profileUpdates.assigned_executive_id = body.updates.assigned_executive_id;
        }
        if (body.updates.email !== undefined) profileUpdates.email = body.updates.email;

        const { error: profileUpdateError } = await adminClient
          .from("profiles")
          .update(profileUpdates)
          .eq("id", body.userId);

        if (profileUpdateError) throw profileUpdateError;

        return new Response(
          JSON.stringify({ success: true, message: "Usuario actualizado correctamente" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "reset_password": {
        if (!body.newPassword) {
          throw new Error("New password is required");
        }

        const { error: passwordError } = await adminClient.auth.admin.updateUserById(
          body.userId,
          { password: body.newPassword }
        );

        if (passwordError) throw passwordError;

        return new Response(
          JSON.stringify({ success: true, message: "Contraseña actualizada correctamente" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      case "delete_user": {
        const { error: deleteProfileError } = await adminClient
          .from("profiles")
          .delete()
          .eq("id", body.userId);

        if (deleteProfileError) throw deleteProfileError;

        const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(
          body.userId
        );

        if (deleteAuthError) throw deleteAuthError;

        return new Response(
          JSON.stringify({ success: true, message: "Usuario eliminado correctamente" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      default:
        throw new Error("Invalid action");
    }
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

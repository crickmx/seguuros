import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function testIMAPConnection(host: string, port: number, user: string, password: string, tls: boolean): Promise<{ success: boolean; error?: string }> {
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

    const buffer = new Uint8Array(4096);

    const timeoutPromise = new Promise<number>((_, reject) =>
      setTimeout(() => reject(new Error("Connection timeout")), 10000)
    );

    const readPromise = conn.read(buffer);
    const bytesRead = await Promise.race([readPromise, timeoutPromise]) as number;

    if (!bytesRead) {
      throw new Error("No response from server");
    }

    const greeting = decoder.decode(buffer.subarray(0, bytesRead));

    if (!greeting.includes("OK")) {
      throw new Error(`Invalid IMAP server response: ${greeting.substring(0, 100)}`);
    }

    await conn.write(encoder.encode(`A001 LOGIN ${user} ${password}\r\n`));

    const loginBuffer = new Uint8Array(4096);
    const loginReadPromise = conn.read(loginBuffer);
    const loginBytesRead = await Promise.race([loginReadPromise, timeoutPromise]) as number;

    if (!loginBytesRead) {
      throw new Error("No login response from server");
    }

    const loginResponse = decoder.decode(loginBuffer.subarray(0, loginBytesRead));

    await conn.write(encoder.encode("A002 LOGOUT\r\n"));

    try {
      conn.close();
    } catch (e) {
    }

    if (loginResponse.includes("A001 OK")) {
      return { success: true };
    } else if (loginResponse.includes("NO") || loginResponse.includes("BAD")) {
      return { success: false, error: "Authentication failed - Invalid credentials" };
    } else {
      return { success: false, error: `Unexpected server response: ${loginResponse.substring(0, 100)}` };
    }

  } catch (error) {
    if (conn) {
      try {
        conn.close();
      } catch (e) {
      }
    }
    return { success: false, error: error.message };
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
    const { host, port, user, password, tls } = await req.json();

    if (!host || !port || !user || !password) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required IMAP credentials"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = await testIMAPConnection(host, port, user, password, tls);

    if (result.success) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "Connection successful"
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      return new Response(
        JSON.stringify({
          success: false,
          error: result.error || "Connection failed"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

  } catch (error) {
    console.error("Error testing IMAP connection:", error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Failed to connect to IMAP server"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

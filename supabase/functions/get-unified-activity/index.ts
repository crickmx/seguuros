import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

interface ActivityFeedItem {
  id: string;
  entity_type: 'prospect' | 'client';
  entity_id: string;
  event_type: 'whatsapp' | 'email' | 'note' | 'followup' | 'status_change' | 'system' | 'policy';
  direction?: 'inbound' | 'outbound';
  title: string;
  description?: string;
  preview?: string;
  metadata: Record<string, any>;
  source_table?: string;
  source_id?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  creator_name?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const entityType = url.searchParams.get('entity_type') as 'prospect' | 'client';
    const entityId = url.searchParams.get('entity_id');
    const eventType = url.searchParams.get('event_type');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    if (!entityType || !entityId) {
      return new Response(
        JSON.stringify({ error: 'entity_type and entity_id are required' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    let query = supabaseClient
      .from('activity_feed')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (eventType && eventType !== 'all') {
      query = query.eq('event_type', eventType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching activity feed:', error);
      return new Response(
        JSON.stringify({ error: error.message }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const creatorIds = [...new Set(data.map((item: any) => item.created_by).filter(Boolean))];

    let creatorsMap: Record<string, string> = {};
    if (creatorIds.length > 0) {
      const { data: creators } = await supabaseClient
        .from('profiles')
        .select('id, full_name')
        .in('id', creatorIds);

      if (creators) {
        creatorsMap = Object.fromEntries(
          creators.map((c: any) => [c.id, c.full_name])
        );
      }
    }

    const enrichedData = data.map((item: any) => ({
      ...item,
      creator_name: item.created_by ? creatorsMap[item.created_by] || null : null,
    }));

    return new Response(
      JSON.stringify({ activities: enrichedData, count: enrichedData.length }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});

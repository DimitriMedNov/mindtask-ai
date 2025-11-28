import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    // Check if requesting user is admin
    const { data: requestingUserRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (requestingUserRole?.role !== 'admin') {
      throw new Error('Only admins can view user list');
    }

    // Get all users with their roles using service role
    const { data: authUsers, error: usersError } = await supabaseClient.auth.admin.listUsers();

    if (usersError) throw usersError;

    // Get all roles
    const { data: rolesData } = await supabaseClient
      .from('user_roles')
      .select('user_id, role');

    // Create role map
    const roleMap = new Map<string, string>();
    rolesData?.forEach(r => {
      roleMap.set(r.user_id, r.role);
    });

    // Combine user data with roles
    const users = authUsers.users.map(u => ({
      id: u.id,
      email: u.email || 'Sin email',
      role: roleMap.get(u.id) || 'user',
      created_at: u.created_at
    }));

    return new Response(
      JSON.stringify({ users }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error getting users:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
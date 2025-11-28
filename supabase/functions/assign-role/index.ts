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
      .single();

    if (requestingUserRole?.role !== 'admin') {
      throw new Error('Only admins can assign roles');
    }

    const { userId, role } = await req.json();

    if (!userId || !role) {
      throw new Error('userId and role are required');
    }

    // Delete existing role
    await supabaseClient
      .from('user_roles')
      .delete()
      .eq('user_id', userId);

    // Insert new role
    const { error: insertError } = await supabaseClient
      .from('user_roles')
      .insert({ user_id: userId, role });

    if (insertError) throw insertError;

    return new Response(
      JSON.stringify({ success: true, message: 'Role assigned successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error assigning role:', error);
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
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { leagueId, password } = await req.json();
    
    // Validate input
    if (!leagueId) {
      console.error('Missing leagueId');
      return new Response(
        JSON.stringify({ error: 'League ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('No authorization header');
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    
    if (userError || !user) {
      console.error('User authentication failed:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${user.id} attempting to join league ${leagueId}`);

    // Check if user is already a member
    const { data: existingMembership } = await supabaseClient
      .from('league_members')
      .select('id')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .single();

    if (existingMembership) {
      console.log(`User ${user.id} is already a member of league ${leagueId}`);
      return new Response(
        JSON.stringify({ success: true, message: 'Already a member' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch league to verify password (using service role to access password field)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: league, error: leagueError } = await supabaseAdmin
      .from('leagues')
      .select('id, password')
      .eq('id', leagueId)
      .single();

    if (leagueError || !league) {
      console.error('League not found:', leagueError);
      return new Response(
        JSON.stringify({ error: 'League not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify password if league is password-protected
    if (league.password && league.password !== '') {
      if (!password) {
        console.log(`Missing password for protected league ${leagueId}`);
        return new Response(
          JSON.stringify({ error: 'Password required' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Password is already hashed from client, compare directly
      if (password !== league.password) {
        console.log(`Invalid password attempt for league ${leagueId}`);
        return new Response(
          JSON.stringify({ error: 'Invalid password' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Join the league
    const { error: joinError } = await supabaseClient
      .from('league_members')
      .insert({ 
        league_id: leagueId, 
        user_id: user.id, 
        role: 'neplačan_član' 
      });

    if (joinError) {
      console.error('Failed to join league:', joinError);
      return new Response(
        JSON.stringify({ error: 'Failed to join league', details: joinError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`User ${user.id} successfully joined league ${leagueId}`);
    
    return new Response(
      JSON.stringify({ success: true, message: 'Successfully joined league' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in join-league function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

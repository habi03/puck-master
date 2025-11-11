import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const joinLeagueSchema = z.object({
  leagueId: z.string().uuid('Invalid league ID format'),
  password: z.string().max(100, 'Password too long').optional().nullable()
});

// Simple in-memory rate limiting (production should use Redis/DB)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

const checkRateLimit = (key: string, maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000): boolean => {
  const now = Date.now();
  const record = rateLimitMap.get(key);
  
  if (!record || now > record.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  
  if (record.count >= maxAttempts) {
    return false;
  }
  
  record.count++;
  return true;
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    
    // Validate input with Zod
    const validationResult = joinLeagueSchema.safeParse(body);
    if (!validationResult.success) {
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const { leagueId, password } = validationResult.data;

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
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
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting check
    const rateLimitKey = `${user.id}:${leagueId}`;
    if (!checkRateLimit(rateLimitKey)) {
      return new Response(
        JSON.stringify({ error: 'Too many attempts. Please try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is already a member
    const { data: existingMembership } = await supabaseClient
      .from('league_members')
      .select('id')
      .eq('league_id', leagueId)
      .eq('user_id', user.id)
      .single();

    if (existingMembership) {
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
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify password if league is password-protected
    if (league.password && league.password !== '') {
      if (!password) {
        return new Response(
          JSON.stringify({ error: 'Authentication failed' }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Verify password using bcrypt
      const isValidPassword = await bcrypt.compare(password, league.password);
      if (!isValidPassword) {
        return new Response(
          JSON.stringify({ error: 'Authentication failed' }),
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
      return new Response(
        JSON.stringify({ error: 'Operation failed' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    return new Response(
      JSON.stringify({ success: true, message: 'Successfully joined league' }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'An error occurred. Please try again.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

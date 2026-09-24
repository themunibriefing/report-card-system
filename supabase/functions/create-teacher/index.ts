// Supabase Edge Function: create-teacher
//
// Why this exists: creating another person's login can only be
// done with Supabase's service_role key, and that key must never
// appear in frontend code (it bypasses every RLS policy). This
// function holds that key server-side, inside Supabase itself —
// not on GitHub Pages, not anywhere in the static site — and only
// does one narrow thing: create a teacher account for the caller's
// own school, after checking the caller is an admin.
//
// Deploy with the Supabase CLI (see SETUP.md Phase 3 section).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function randomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header." }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { email, full_name } = await req.json();
    if (!email || !full_name) {
      return new Response(JSON.stringify({ error: "email and full_name are required." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Identify the caller from their JWT, then confirm they are
    // an admin, all using the service-role client (RLS doesn't
    // apply to it, so this is the one place that's safe to do).
    const {
      data: { user: caller },
      error: callerError,
    } = await admin.auth.getUser(authHeader.replace("Bearer ", ""));

    if (callerError || !caller) {
      return new Response(JSON.stringify({ error: "Invalid session." }), {
        status: 401,
        headers: corsHeaders,
      });
    }

    const { data: callerProfile, error: profileError } = await admin
      .from("profiles")
      .select("role, school_id")
      .eq("id", caller.id)
      .single();

    if (profileError || !callerProfile || callerProfile.role !== "admin") {
      return new Response(JSON.stringify({ error: "Only administrators can add teachers." }), {
        status: 403,
        headers: corsHeaders,
      });
    }

    const temporaryPassword = randomPassword();

    const { data: newUser, error: createError } = await admin.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
    });

    if (createError || !newUser?.user) {
      return new Response(
        JSON.stringify({ error: createError?.message || "Could not create the account." }),
        { status: 400, headers: corsHeaders }
      );
    }

    const { error: insertError } = await admin.from("profiles").insert({
      id: newUser.user.id,
      school_id: callerProfile.school_id,
      full_name,
      email,
      role: "teacher",
      is_active: true,
    });

    if (insertError) {
      // Roll back the auth user so we don't leave an orphaned login.
      await admin.auth.admin.deleteUser(newUser.user.id);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    return new Response(JSON.stringify({ email, temporary_password: temporaryPassword }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});

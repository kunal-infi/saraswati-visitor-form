import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn("Missing Supabase env vars: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY/ANON_KEY");
}

const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const corsOrigin = process.env.CORS_ORIGIN || "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": corsOrigin,
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const withCors = (response) => {
  Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
  return response;
};

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}

export async function POST(req) {
  if (!supabase) {
    return withCors(new Response(JSON.stringify({ error: "Database not configured" }), { status: 500 }));
  }

  try {
    const body = await req.json();
    const {
      childName = "",
      className = "",
      phoneNumber = "",
      fatherName = "",
      email = "",
      visitorCount = 0,
    } = body || {};

    if (!childName || !className || !phoneNumber || !fatherName || !email) {
      return withCors(new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 }));
    }

    const { data, error } = await supabase
      .from("visits")
      .insert({
        child_name: childName,
        class_name: className,
        phone_number: phoneNumber,
        father_name: fatherName,
        email,
        visitor_count: Number(visitorCount || 0),
      })
      .select("id")
      .single();

    if (error) {
      console.error("Insert failed", error);
      return withCors(new Response(JSON.stringify({ error: "Server error" }), { status: 500 }));
    }

    return withCors(Response.json({ id: data?.id }));
  } catch (error) {
    console.error("Insert failed", error);
    return withCors(new Response(JSON.stringify({ error: "Server error" }), { status: 500 }));
  }
}

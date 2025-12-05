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

  let body;
  try {
    body = await req.json();
  } catch (error) {
    console.error("Invalid JSON body", error);
    return withCors(new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400 }));
  }

  const { visitId, phoneNumber } = body || {};
  if (!visitId && !phoneNumber) {
    return withCors(new Response(JSON.stringify({ error: "visitId or phoneNumber is required" }), { status: 400 }));
  }

  try {
    const updateQuery = supabase
      .from("visits")
      .update({ visited: true })
      .select("id, visited, child_name, phone_number");

    const selection = visitId
      ? updateQuery.eq("id", visitId).single()
      : updateQuery.eq("phone_number", phoneNumber).order("id", { ascending: false }).limit(1).single();

    const { data, error } = await selection;

    if (error) {
      const isNoRows = error?.code === "PGRST116";
      console.error("Check-in failed", error);
      const status = isNoRows ? 404 : 500;
      const message = isNoRows ? "Visit not found" : "Server error";
      return withCors(new Response(JSON.stringify({ error: message }), { status }));
    }

    if (!data) {
      return withCors(new Response(JSON.stringify({ error: "Visit not found" }), { status: 404 }));
    }

    return withCors(
      Response.json({
        success: true,
        visitId: data.id,
        visited: data.visited,
        childName: data.child_name,
        phoneNumber: data.phone_number,
      })
    );
  } catch (error) {
    console.error("Check-in failed", error);
    return withCors(new Response(JSON.stringify({ error: "Server error" }), { status: 500 }));
  }
}

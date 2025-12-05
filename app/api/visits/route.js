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
      visitorType = "",
    } = body || {};

    const normalizedVisitorType = (visitorType || "").toLowerCase();
    const isParent = normalizedVisitorType === "parent";

    if (isParent && (!childName || !className)) {
      return withCors(new Response(JSON.stringify({ error: "Missing student details" }), { status: 400 }));
    }

    if (!phoneNumber || !email) {
      return withCors(new Response(JSON.stringify({ error: "Missing required contact fields" }), { status: 400 }));
    }

    const safeChildName = isParent ? childName : childName || "N/A";
    const safeClassName = isParent ? className : className || "N/A";

    const { data, error } = await supabase
      .from("visits")
      .insert({
        child_name: safeChildName,
        class_name: safeClassName,
        phone_number: phoneNumber || null,
        father_name: fatherName || null,
        email: email || null,
        visitor_count: Number(visitorCount || 0),
        visitor_type: visitorType || null,
        visited: false,
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

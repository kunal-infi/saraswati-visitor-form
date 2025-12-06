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
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const withCors = (response) => {
  Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
  return response;
};

export function OPTIONS() {
  return withCors(new Response(null, { status: 204 }));
}

export async function GET(req) {
  if (!supabase) {
    return withCors(new Response(JSON.stringify({ error: "Database not configured" }), { status: 500 }));
  }

  try {
    const { searchParams } = new URL(req.url);
    const email = (searchParams.get("email") || "").trim();
    const phoneNumber = (searchParams.get("phoneNumber") || "").trim();

    if (!email && !phoneNumber) {
      return withCors(new Response(JSON.stringify({ error: "Missing lookup fields" }), { status: 400 }));
    }

    const filters = [];
    if (email) filters.push({ column: "email", value: email });
    if (phoneNumber) filters.push({ column: "phone_number", value: phoneNumber });

    let query = supabase
      .from("visits")
      .select(
        "id, child_name, class_name, phone_number, father_name, email, visitor_count, visitor_type, created_at"
      )
      .order("created_at", { ascending: false })
      .limit(1);

    if (filters.length === 1) {
      query = query.eq(filters[0].column, filters[0].value);
    } else if (filters.length > 1) {
      const orClause = filters.map(({ column, value }) => `${column}.eq.${value}`).join(",");
      query = query.or(orClause);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Lookup failed", error);
      return withCors(new Response(JSON.stringify({ error: "Server error" }), { status: 500 }));
    }

    const record = data?.[0];

    if (!record) {
      return withCors(new Response(JSON.stringify({ error: "Not found" }), { status: 404 }));
    }

    return withCors(
      Response.json({
        id: record.id,
        childName: record.child_name,
        className: record.class_name,
        phoneNumber: record.phone_number,
        fatherName: record.father_name,
        email: record.email,
        visitorCount: record.visitor_count,
        visitorType: record.visitor_type,
        createdAt: record.created_at,
      })
    );
  } catch (error) {
    console.error("Lookup failed", error);
    return withCors(new Response(JSON.stringify({ error: "Server error" }), { status: 500 }));
  }
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

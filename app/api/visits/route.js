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
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const withCors = (response) => {
  Object.entries(corsHeaders).forEach(([key, value]) => response.headers.set(key, value));
  return response;
};

const baseSelect =
  "id, child_name, class_name, phone_number, father_name, email, visitor_count, visitor_type, visited, created_at";

const mapVisit = (record) => ({
  id: record?.id ?? "",
  childName: record?.child_name ?? "",
  className: record?.class_name ?? "",
  phoneNumber: record?.phone_number ?? "",
  fatherName: record?.father_name ?? "",
  email: record?.email ?? "",
  visitorCount: record?.visitor_count ?? 0,
  visitorType: record?.visitor_type ?? "",
  visited: Boolean(record?.visited),
  createdAt: record?.created_at ?? null,
});

const buildCsv = (records = []) => {
  const headers = [
    "id",
    "childName",
    "className",
    "fatherName",
    "phoneNumber",
    "email",
    "visitorCount",
    "visitorType",
    "visited",
    "createdAt",
  ];

  const escape = (value) => {
    if (value === null || value === undefined) return "";
    const text = String(value);
    const needsQuotes = text.includes(",") || text.includes('"') || text.includes("\n");
    const escaped = text.replace(/"/g, '""');
    return needsQuotes ? `"${escaped}"` : escaped;
  };

  const lines = [
    headers.join(","),
    ...records.map((record) =>
      headers
        .map((key) => {
          const val = record[key];
          return key === "visited" ? escape(val ? "true" : "false") : escape(val ?? "");
        })
        .join(",")
    ),
  ];

  return lines.join("\n");
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
    const mode = (searchParams.get("mode") || "").toLowerCase();
    const format = (searchParams.get("format") || "").toLowerCase();
    const wantsList = mode === "list" || format === "csv" || searchParams.get("all") === "true";
    const limitParam = Number.parseInt(searchParams.get("limit") || "0", 10);
    const pageParam = Number.parseInt(searchParams.get("page") || "1", 10);
    const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
    const limit = Number.isFinite(limitParam) && limitParam > 0 ? Math.min(limitParam, 500) : 200;
    const rangeStart = (page - 1) * limit;
    const rangeEnd = rangeStart + limit - 1;

    if (wantsList) {
      const rawSearch = (searchParams.get("search") || "").replace(/,/g, " ").trim();
      let query = supabase
        .from("visits")
        .select(baseSelect, { count: "exact" })
        .order("created_at", { ascending: false })
        .range(rangeStart, rangeEnd);

      if (rawSearch) {
        const likeValue = `%${rawSearch}%`;
        const orClause = [
          `child_name.ilike.${likeValue}`,
          `class_name.ilike.${likeValue}`,
          `father_name.ilike.${likeValue}`,
          `email.ilike.${likeValue}`,
          `phone_number.ilike.${likeValue}`,
          `visitor_type.ilike.${likeValue}`,
        ].join(",");
        query = query.or(orClause);
      }

      const { data, error, count } = await query;

      if (error) {
        console.error("List fetch failed", error);
        return withCors(new Response(JSON.stringify({ error: "Server error" }), { status: 500 }));
      }

      const records = (data || []).map(mapVisit);

      if (format === "csv") {
        const csv = buildCsv(records);
        const response = new Response(csv, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": 'attachment; filename="visits.csv"',
          },
        });
        return withCors(response);
      }

      return withCors(
        Response.json({
          records,
          total: count ?? records.length,
          page,
          pageSize: limit,
        })
      );
    }

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
      .select(baseSelect)
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
        ...mapVisit(record),
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
      visited = false,
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
        visited: Boolean(visited),
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

export async function PUT(req) {
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

  const {
    id,
    childName = "",
    className = "",
    phoneNumber = "",
    fatherName = "",
    email = "",
    visitorCount = 0,
    visitorType = "",
    visited = false,
  } = body || {};

  if (!id) {
    return withCors(new Response(JSON.stringify({ error: "Visit id is required" }), { status: 400 }));
  }

  try {
    const { data, error } = await supabase
      .from("visits")
      .update({
        child_name: childName,
        class_name: className,
        phone_number: phoneNumber || null,
        father_name: fatherName || null,
        email: email || null,
        visitor_count: Number.isFinite(Number(visitorCount)) ? Number(visitorCount) : 0,
        visitor_type: visitorType || null,
        visited: Boolean(visited),
      })
      .eq("id", id)
      .select(baseSelect)
      .single();

    if (error) {
      const isNoRows = error?.code === "PGRST116";
      console.error("Update failed", error);
      const status = isNoRows ? 404 : 500;
      return withCors(new Response(JSON.stringify({ error: isNoRows ? "Visit not found" : "Server error" }), { status }));
    }

    return withCors(Response.json(mapVisit(data)));
  } catch (error) {
    console.error("Update failed", error);
    return withCors(new Response(JSON.stringify({ error: "Server error" }), { status: 500 }));
  }
}

export async function DELETE(req) {
  if (!supabase) {
    return withCors(new Response(JSON.stringify({ error: "Database not configured" }), { status: 500 }));
  }

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return withCors(new Response(JSON.stringify({ error: "Visit id is required" }), { status: 400 }));
  }

  try {
    const { error } = await supabase.from("visits").delete().eq("id", id);

    if (error) {
      const isNoRows = error?.code === "PGRST116";
      console.error("Delete failed", error);
      const status = isNoRows ? 404 : 500;
      return withCors(new Response(JSON.stringify({ error: isNoRows ? "Visit not found" : "Server error" }), { status }));
    }

    return withCors(Response.json({ success: true }));
  } catch (error) {
    console.error("Delete failed", error);
    return withCors(new Response(JSON.stringify({ error: "Server error" }), { status: 500 }));
  }
}

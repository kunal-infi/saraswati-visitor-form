import mysql from "mysql2/promise";

const requiredEnv = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"];
const missing = requiredEnv.filter((key) => !process.env[key]);

if (missing.length) {
  console.warn(`Missing database env vars: ${missing.join(", ")}`);
}

const pool =
  missing.length === 0
    ? mysql.createPool({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: Number(process.env.DB_PORT || 3306),
        waitForConnections: true,
        connectionLimit: 10,
      })
    : null;

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
  if (!pool) {
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

    const [result] = await pool.execute(
      `INSERT INTO visits (child_name, class_name, phone_number, father_name, email, visitor_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [childName, className, phoneNumber, fatherName, email, Number(visitorCount || 0)]
    );

    return withCors(Response.json({ id: result.insertId }));
  } catch (error) {
    console.error("Insert failed", error);
    return withCors(new Response(JSON.stringify({ error: "Server error" }), { status: 500 }));
  }
}

import { NextRequest, NextResponse } from "next/server";
import { canUseOpsTools } from "@/constants";

// Server-side proxy to maxion-platform-support so the admin token never reaches the browser.
// Env (server only, no NEXT_PUBLIC_): MAXION_PLATFORM_SUPPORT_URL, MAXION_PLATFORM_SUPPORT_TOKEN
// Caller must send a Firebase ID token (Authorization: Bearer <idToken>) from the Platform app;
// it is verified against Google Identity Toolkit and the email must pass canUseOpsTools().

export const dynamic = "force-dynamic";

type Method = "GET" | "POST" | "PUT" | "DELETE";
const ALLOWED: Record<Method, RegExp> = {
  GET: /^(config|check|holdings|trace|compare|history(\/[A-Za-z0-9_-]+)?|replay\/config|replay\/scan\/[A-Za-z0-9_-]+|acl\/(me|users|features|export))$/,
  POST: /^(replay\/(scan|preview|send)|acl\/import)$/,
  PUT: /^acl\/(users|features)\/[^/]+$/,
  DELETE: /^acl\/users\/[^/]+$/,
};

async function verifyIdToken(idToken: string): Promise<string | null> {
  const apiKey = process.env.NEXT_PUBLIC_PLATFORM_API_KEY;
  if (!apiKey) return null;
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken }),
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = (await res.json()) as { users?: { email?: string; emailVerified?: boolean }[] };
  const u = data.users?.[0];
  return u?.email && u.emailVerified !== false ? u.email : null;
}

async function proxy(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }, method: Method) {
  const base = process.env.MAXION_PLATFORM_SUPPORT_URL?.replace(/\/+$/, "");
  const token = process.env.MAXION_PLATFORM_SUPPORT_TOKEN;
  if (!base || !token) {
    return NextResponse.json({ error: "Platform support service is not configured (MAXION_PLATFORM_SUPPORT_URL / MAXION_PLATFORM_SUPPORT_TOKEN)" }, { status: 503 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const idToken = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!idToken) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const email = await verifyIdToken(idToken);
  if (!email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!canUseOpsTools(email)) return NextResponse.json({ error: "Not allowed for this account" }, { status: 403 });

  const { path } = await ctx.params;
  const p = path.join("/");
  if (!ALLOWED[method].test(p)) return NextResponse.json({ error: "Unknown endpoint" }, { status: 404 });

  const url = `${base}/api/${p}${req.nextUrl.search}`;
  const hasBody = method === "POST" || method === "PUT";
  let upstream: Response;
  try {
    upstream = await fetch(url, {
      method,
      headers: { "x-admin-token": token, "X-User": email, Accept: "application/json", ...(hasBody ? { "Content-Type": "application/json" } : {}) },
      body: hasBody ? await req.text() : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    return NextResponse.json({ error: `Upstream unreachable: ${err instanceof Error ? err.message : String(err)}` }, { status: 502 });
  }
  const body = await upstream.text();
  return new NextResponse(body, {
    status: upstream.status,
    headers: { "Content-Type": upstream.headers.get("content-type") ?? "application/json" },
  });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx, "GET");
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx, "POST");
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx, "PUT");
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ path: string[] }> }) {
  return proxy(req, ctx, "DELETE");
}

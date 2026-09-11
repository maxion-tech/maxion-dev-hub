import { platformFirebase } from "@/config/firebase";

// Client helper for maxion-platform-support, always via the Next.js proxy
// (/api/platform-support/*) which holds the service URL + admin token server-side
// and verifies the Firebase session before forwarding.

export async function platformSupportApi<T>(
  path: string,
  opts: { method?: "GET" | "POST" | "PUT" | "DELETE"; params?: Record<string, string>; body?: unknown } = {}
): Promise<T> {
  const user = platformFirebase.auth().currentUser;
  if (!user) throw new Error("Sign in required");
  const idToken = await user.getIdToken();
  const qs = new URLSearchParams(Object.entries(opts.params ?? {}).filter(([, v]) => v !== "")).toString();
  let res: Response;
  try {
    res = await fetch(`/api/platform-support/${path}${qs ? `?${qs}` : ""}`, {
      method: opts.method ?? "GET",
      headers: {
        Authorization: `Bearer ${idToken}`,
        ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (err) {
    throw new Error(`Cannot reach the service (${err instanceof Error ? err.message : String(err)})`);
  }
  const data = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data as T;
}

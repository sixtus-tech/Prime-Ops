export async function POST(request) {
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
  try {
    const contentType = request.headers.get("content-type") || "";
    let accessToken, refreshToken, expiresInMillis;
    if (contentType.includes("urlencoded") || contentType.includes("multipart")) {
      const formData = await request.formData();
      accessToken = formData.get("accessToken") || formData.get("access_token");
      refreshToken = formData.get("refreshToken") || formData.get("refresh_token");
      expiresInMillis = formData.get("expiresInMillis") || formData.get("expires_in_millis");
    } else {
      const body = await request.json().catch(() => null);
      if (body) { accessToken = body.accessToken || body.access_token; refreshToken = body.refreshToken; expiresInMillis = body.expiresInMillis; }
    }
    console.log("[KC POST callback] accessToken:", accessToken ? "present" : "missing");
    if (!accessToken) return Response.redirect(new URL("/auth/kingschat?error=no_token", request.url), 302);
    const r = await fetch(API + "/auth/kingschat/sdk-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken, refreshToken, expiresInMillis }) });
    const data = await r.json();
    if (!r.ok) return Response.redirect(new URL("/auth/kingschat?error=server_error", request.url), 302);
    const params = new URLSearchParams({ token: data.token, user: JSON.stringify(data.user) });
    return Response.redirect(new URL("/auth/kingschat?" + params, request.url), 302);
  } catch (err) { console.error("[KC callback error]", err); return Response.redirect(new URL("/auth/kingschat?error=server_error", request.url), 302); }
}
export async function GET(request) {
  const url = new URL(request.url);
  console.log("[KC GET callback] params:", Object.fromEntries(url.searchParams));
  const accessToken = url.searchParams.get("accessToken") || url.searchParams.get("access_token");
  if (!accessToken) return Response.redirect(new URL("/auth/kingschat?error=no_token", request.url), 302);
  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
  try {
    const r = await fetch(API + "/auth/kingschat/sdk-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accessToken }) });
    const data = await r.json();
    if (!r.ok) return Response.redirect(new URL("/auth/kingschat?error=server_error", request.url), 302);
    const params = new URLSearchParams({ token: data.token, user: JSON.stringify(data.user) });
    return Response.redirect(new URL("/auth/kingschat?" + params, request.url), 302);
  } catch (err) { console.error("[KC GET error]", err); return Response.redirect(new URL("/auth/kingschat?error=server_error", request.url), 302); }
}

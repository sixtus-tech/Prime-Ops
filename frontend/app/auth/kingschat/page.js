"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

function KCAuthHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState("Processing...");

  useEffect(() => {
    const token = searchParams.get("token");
    const error = searchParams.get("error");
    let user = null;
    const userStr = searchParams.get("user");
    if (userStr) { try { user = JSON.parse(userStr); } catch {} }
    if (!user && searchParams.get("name")) {
      user = { name: decodeURIComponent(searchParams.get("name")), role: searchParams.get("role") || "user" };
    }

    // Detect if this is a redirect flow (mobile) vs popup flow (desktop)
    var isRedirectFlow = !window.opener;

    if (token) {
      setStatus("Fetching profile...");
      fetch(API + "/auth/me", { headers: { Authorization: "Bearer " + token } })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var fullUser = data.user || user;
          var authResult = { token: token, user: fullUser };

          if (isRedirectFlow) {
            // Mobile redirect flow — save auth directly and navigate
            localStorage.setItem("token", token);
            localStorage.setItem("user", JSON.stringify(fullUser));
            setStatus("Login successful! Redirecting...");
            var returnPath = localStorage.getItem("kc_login_return") || "/";
            localStorage.removeItem("kc_login_return");
            // Redirect based on role
            var dest = fullUser.role === "director" ? "/dashboard" : "/portal";
            if (returnPath && returnPath !== "/" && returnPath !== "/admin/login" && returnPath !== "/portal/login") {
              dest = returnPath;
            }
            setTimeout(function() { window.location.href = dest; }, 300);
          } else {
            // Popup flow — signal parent window
            localStorage.setItem("kc_auth_result", JSON.stringify(authResult));
            setStatus("Login successful! Closing...");
            setTimeout(function() { window.close(); }, 500);
          }
        })
        .catch(function() {
          var authResult = { token: token, user: user };
          if (isRedirectFlow) {
            localStorage.setItem("token", token);
            localStorage.setItem("user", JSON.stringify(user));
            setStatus("Login successful! Redirecting...");
            setTimeout(function() { window.location.href = user?.role === "director" ? "/dashboard" : "/portal"; }, 300);
          } else {
            localStorage.setItem("kc_auth_result", JSON.stringify(authResult));
            setStatus("Login successful! Closing...");
            setTimeout(function() { window.close(); }, 500);
          }
        });
    } else {
      var errResult = { error: error || "Login failed" };
      if (isRedirectFlow) {
        setStatus("Login failed. Redirecting...");
        setTimeout(function() { window.location.href = "/"; }, 1500);
      } else {
        localStorage.setItem("kc_auth_result", JSON.stringify(errResult));
        setStatus("Login failed. You can close this window.");
      }
    }
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-white text-lg font-medium">{status}</p>
      </div>
    </div>
  );
}

export default function KCAuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-900"><p className="text-white">Loading...</p></div>}>
      <KCAuthHandler />
    </Suspense>
  );
}

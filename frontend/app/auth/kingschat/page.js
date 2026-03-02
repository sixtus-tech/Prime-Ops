"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
function KCAuthHandler() {
  const searchParams = useSearchParams();
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
    if (token) {
      setStatus("Fetching profile...");
      fetch(API + "/auth/me", { headers: { Authorization: "Bearer " + token } })
        .then(function(r) { return r.json(); })
        .then(function(data) {
          var fullUser = data.user || user;
          localStorage.setItem("kc_auth_result", JSON.stringify({ token: token, user: fullUser }));
          setStatus("Login successful! Closing..."); setTimeout(function() { window.close(); }, 500);
        })
        .catch(function() {
          localStorage.setItem("kc_auth_result", JSON.stringify({ token: token, user: user }));
          setStatus("Login successful! Closing..."); setTimeout(function() { window.close(); }, 500);
        });
    } else {
      localStorage.setItem("kc_auth_result", JSON.stringify({ error: error || "Login failed" }));
      setStatus("Login failed. You can close this window.");
    }
  }, [searchParams]);
  return (<div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"><div className="text-center"><div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-600/20 mb-4"><svg className="w-8 h-8 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></div><p className="text-white text-lg font-medium">{status}</p></div></div>);
}
export default function KCAuthPage() {
  return (<Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-900"><p className="text-white">Loading...</p></div>}><KCAuthHandler /></Suspense>);
}

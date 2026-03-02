"use client";

import { useEffect, useState } from "react";

export default function KingsChatCallbackPage() {
  const [status, setStatus] = useState("Processing KingsChat login...");

  useEffect(() => {
    // KC may put tokens in URL params, hash fragment, or both
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace("#", "?"));

    const accessToken =
      params.get("access_token") || params.get("accessToken") ||
      hash.get("access_token") || hash.get("accessToken");
    const refreshToken =
      params.get("refresh_token") || params.get("refreshToken") ||
      hash.get("refresh_token") || hash.get("refreshToken");
    const expiresIn =
      params.get("expires_in_millis") || params.get("expiresInMillis") ||
      hash.get("expires_in_millis") || hash.get("expiresInMillis");
    const error =
      params.get("error") || hash.get("error");

    if (window.opener) {
      if (accessToken) {
        window.opener.postMessage({
          type: "KC_AUTH_CALLBACK",
          accessToken,
          refreshToken,
          expiresInMillis: expiresIn ? parseInt(expiresIn) : null,
        }, window.location.origin);
        setStatus("Login successful! Closing...");
        setTimeout(() => window.close(), 500);
      } else if (error) {
        window.opener.postMessage({
          type: "KC_AUTH_CALLBACK",
          error: error,
        }, window.location.origin);
        setStatus("Login failed. Closing...");
        setTimeout(() => window.close(), 1000);
      } else {
        // No tokens yet — KC might post via postMessage from its own page
        // Listen for it and relay
        const listener = (event) => {
          if (event.data?.accessToken || event.data?.access_token) {
            window.opener.postMessage({
              type: "KC_AUTH_CALLBACK",
              accessToken: event.data.accessToken || event.data.access_token,
              refreshToken: event.data.refreshToken || event.data.refresh_token,
              expiresInMillis: event.data.expiresInMillis || event.data.expires_in_millis,
            }, window.location.origin);
            setStatus("Login successful! Closing...");
            setTimeout(() => window.close(), 500);
          } else if (event.data?.error) {
            window.opener.postMessage({
              type: "KC_AUTH_CALLBACK",
              error: event.data.error,
            }, window.location.origin);
            setStatus("Login failed. Closing...");
            setTimeout(() => window.close(), 1000);
          }
        };
        window.addEventListener("message", listener);
        setStatus("Waiting for KingsChat authentication...");

        // Timeout after 30s
        setTimeout(() => {
          window.removeEventListener("message", listener);
          setStatus("Authentication timed out. You can close this window.");
        }, 30000);
      }
    } else {
      // Not in a popup — redirect to home
      setStatus("Redirecting...");
      window.location.href = "/";
    }
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-600/20 mb-4">
          <div className="w-8 h-8 border-3 border-purple-400 border-t-transparent rounded-full animate-spin" />
        </div>
        <p className="text-white text-lg font-medium">{status}</p>
        <p className="text-slate-400 text-sm mt-2">This window will close automatically.</p>
      </div>
    </div>
  );
}

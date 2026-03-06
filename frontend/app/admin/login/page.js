"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/auth";
import Link from "next/link";

export default function AdminLoginPage() {
  const router = useRouter();
  const { loginWithKingsChat } = useAuth();
  const [error, setError] = useState("");
  const [kcLoading, setKcLoading] = useState(false);

  async function handleKcLogin() {
    setError("");
    setKcLoading(true);
    try {
      await loginWithKingsChat();
      localStorage.setItem("loginType", "admin");
      router.push("/dashboard");
    } catch (err) {
      setError(err.message || "KingsChat login failed");
    } finally {
      setKcLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">Prime Ops</h1>
          <p className="text-blue-300 mt-1">Project Director Console</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">Welcome</h2>
          <p className="text-gray-500 text-sm mb-6">
            Sign in with your KingsChat account to manage your projects and teams.
          </p>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
              {error}
            </div>
          )}

          <button
            onClick={handleKcLogin}
            disabled={kcLoading}
            className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 text-base"
          >
            {kcLoading ? (
              <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/>
                <path d="M12 6c-1.65 0-3 1.35-3 3s1.35 3 3 3 3-1.35 3-3-1.35-3-3-3zm0 4.5c-.83 0-1.5-.67-1.5-1.5S11.17 7.5 12 7.5s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
              </svg>
            )}
            {kcLoading ? "Connecting..." : "Sign in with KingsChat"}
          </button>

          <div className="mt-6 pt-4 border-t border-gray-100 text-center">
            <Link href="/portal/login" className="text-sm text-gray-500 hover:text-gray-700">
              Team member? <span className="text-emerald-600 font-medium">Go to Team Portal →</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

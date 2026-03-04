"use client";
import { useEffect } from "react";
import Link from "next/link";

export default function HomePage() {
  // ── KingsChat popup callback interceptor ────────────────────────
  // When KC auth redirects back to our origin inside the popup,
  // this catches the tokens and relays them to the parent window.
  useEffect(() => {
    if (!window.opener) return; // Not in a popup — skip

    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace("#", "?"));

    const accessToken = params.get("access_token") || hash.get("access_token");
    const refreshToken = params.get("refresh_token") || hash.get("refresh_token");
    const expiresIn = params.get("expires_in_millis") || hash.get("expires_in_millis");
    const error = params.get("error") || hash.get("error");

    if (accessToken) {
      window.opener.postMessage({
        accessToken,
        refreshToken,
        expiresInMillis: expiresIn ? parseInt(expiresIn) : null,
      }, "*");
      window.close();
      return;
    }
    if (error) {
      window.opener.postMessage({ error }, "*");
      window.close();
      return;
    }
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="w-full max-w-2xl mx-4 text-center">
        {/* Logo */}
        <div className="mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-600 to-emerald-600 mb-6">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Prime Ops</h1>
          <p className="text-slate-400 text-lg">Operations Management Platform</p>
        </div>

        {/* Two Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          {/* Director Card */}
          <Link href="/admin/login" className="group bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8 hover:border-blue-500/50 hover:bg-slate-800/80 transition-all">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-blue-600/20 text-blue-400 mb-4 group-hover:bg-blue-600/30 transition">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Project Director</h2>
            <p className="text-slate-400 text-sm mb-4">
              Create programs, assign committee heads, track milestones, and manage your teams.
            </p>
            <span className="text-blue-400 text-sm font-medium group-hover:text-blue-300">
              Open Director Console →
            </span>
          </Link>

          {/* Member Card */}
          <Link href="/portal/login" className="group bg-slate-800/50 backdrop-blur border border-slate-700 rounded-2xl p-8 hover:border-emerald-500/50 hover:bg-slate-800/80 transition-all">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-emerald-600/20 text-emerald-400 mb-4 group-hover:bg-emerald-600/30 transition">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">Committee Member</h2>
            <p className="text-slate-400 text-sm mb-4">
              Access your committees, submit proposals, view milestones, and collaborate with your team.
            </p>
            <span className="text-emerald-400 text-sm font-medium group-hover:text-emerald-300">
              Open Member Portal →
            </span>
          </Link>
        </div>

        <p className="text-slate-500 text-sm">
          Same account works for both — choose based on what you need to do.
        </p>
      </div>
    </main>
  );
}

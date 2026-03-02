"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../lib/auth";
import Link from "next/link";

export default function PortalLoginPage() {
  const router = useRouter();
  const { login, loginWithKingsChat } = useAuth();
  const [mode, setMode] = useState("login"); // "login" | "activate"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [kcLoading, setKcLoading] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      localStorage.setItem("loginType", "portal");
      router.push("/portal");
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleKcLogin() {
    setError("");
    setKcLoading(true);
    try {
      await loginWithKingsChat();
      localStorage.setItem("loginType", "portal");
      router.push("/portal");
    } catch (err) {
      setError(err.message || "KingsChat login failed");
    } finally {
      setKcLoading(false);
    }
  }

  async function handleActivate(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/activate-member`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name: name || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Activation failed");

      setSuccess("Account activated! Signing you in...");
      await login(email, password);
      localStorage.setItem("loginType", "portal");
      router.push("/portal");
    } catch (err) {
      setError(err.message || "Activation failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900">
      <div className="w-full max-w-md mx-4">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white">Prime Ops</h1>
          <p className="text-blue-300 mt-1">Committee Member Portal</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {mode === "login" ? (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Welcome back</h2>
              <p className="text-gray-500 text-sm mb-6">Sign in to view your committees and tasks.</p>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
              )}

              {/* KingsChat Login Button */}
              <button
                onClick={handleKcLogin}
                disabled={kcLoading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50 mb-4"
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

              <div className="relative mb-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-gray-400">or use email</span>
                </div>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="you@example.com"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {loading ? "Please wait..." : "Sign In"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => { setMode("activate"); setError(""); }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  First time? Set up your account →
                </button>
              </div>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-gray-900 mb-1">Activate your account</h2>
              <p className="text-gray-500 text-sm mb-6">
                Enter the email your director used when adding you, then create your password.
              </p>

              {error && (
                <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">{error}</div>
              )}
              {success && (
                <div className="bg-emerald-50 text-blue-600 text-sm px-4 py-3 rounded-lg mb-4">{success}</div>
              )}

              <form onSubmit={handleActivate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email (from your director)</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="the email your director added you with"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Your Name (optional update)</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="Leave blank to keep your current name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Create Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="At least 6 characters"
                    required
                    minLength={6}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition disabled:opacity-50"
                >
                  {loading ? "Please wait..." : "Activate Account"}
                </button>
              </form>

              <div className="mt-6 text-center">
                <button
                  onClick={() => { setMode("login"); setError(""); setSuccess(""); }}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  ← Already activated? Sign in
                </button>
              </div>
            </>
          )}

          <div className="mt-4 pt-4 border-t border-gray-100 text-center">
            <Link href="/admin/login" className="text-sm text-gray-500 hover:text-gray-700">
              Program director? <span className="text-blue-600 font-medium">Go to Director Console →</span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

// frontend/app/auth/callback/page.js
// ═══════════════════════════════════════════════════════════════════════
// OAuth callback handler — Supabase redirects here after OAuth flow
// ═══════════════════════════════════════════════════════════════════════

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

export default function AuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    // Supabase handles the code exchange automatically
    // We just need to wait for the session to be established
    const handleCallback = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();

      if (error) {
        console.error("Auth callback error:", error);
        router.push("/login?error=auth_failed");
        return;
      }

      if (session) {
        // Ensure user record exists in our backend
        try {
          const res = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api"}/auth/me`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }
          );

          if (res.ok) {
            const data = await res.json();
            // Redirect based on role
            if (data.user.role === "director") {
              router.push("/dashboard");
            } else {
              router.push("/portal");
            }
          } else {
            router.push("/portal");
          }
        } catch {
          router.push("/portal");
        }
      } else {
        router.push("/login");
      }
    };

    handleCallback();
  }, [router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-surface-500 text-sm">Signing you in...</p>
      </div>
    </main>
  );
}

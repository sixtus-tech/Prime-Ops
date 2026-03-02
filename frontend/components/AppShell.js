"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AuthProvider, useAuth } from "../lib/auth";
import { MobileProvider } from "../lib/useMobile";
import Sidebar from "./Sidebar";
import PortalSidebar from "./PortalSidebar";
import MobileHeader from "./MobileHeader";

const publicPaths = ["/", "/admin/login", "/portal/login", "/auth/kingschat", "/auth/kingschat/callback"];

// Routes that only directors can access
const directorPaths = ["/dashboard", "/events", "/committees", "/approvals", "/status-updates"];

function isDirectorRoute(pathname) {
  return directorPaths.some((p) => pathname === p || pathname.startsWith(p + "/"));
}

function AppContent({ children }) {
  const { user, loading, logout } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isPublicPath = publicPaths.includes(pathname);

  // Determine access based on actual user role, NOT loginType
  const isDirector = user?.role === "director";

  useEffect(() => {
    if (loading) return;

    // Not logged in
    if (!user) {
      if (isPublicPath) return;
      router.replace("/");
      return;
    }

    // Logged in — redirect away from public/login pages
    if (pathname === "/") {
      router.replace(isDirector ? "/dashboard" : "/portal");
      return;
    }
    if (pathname === "/admin/login") {
      router.replace(isDirector ? "/dashboard" : "/portal");
      return;
    }
    if (pathname === "/portal/login") {
      router.replace(isDirector ? "/dashboard" : "/portal");
      return;
    }

    // Non-director trying to access director-only pages → redirect to portal
    if (!isDirector && isDirectorRoute(pathname)) {
      router.replace("/portal");
      return;
    }
  }, [user, loading, pathname, router, isDirector, isPublicPath]);

  // Loading
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-surface-500 text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  // Public pages — no sidebar
  if (!user && isPublicPath) {
    return children;
  }

  // Redirecting
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <p className="text-surface-500 text-sm">Redirecting...</p>
      </div>
    );
  }

  // Non-director on a director route → show nothing while redirecting
  if (!isDirector && isDirectorRoute(pathname)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-surface-50">
        <p className="text-surface-500 text-sm">Redirecting...</p>
      </div>
    );
  }

  // Portal layout — for non-directors, or directors visiting /portal
  if (!isDirector || pathname.startsWith("/portal")) {
    return (
      <>
        <PortalSidebar />
        <MobileHeader portalMode />
        <div className="md:ml-64 min-h-screen pt-14 md:pt-0">{children}</div>
      </>
    );
  }

  // Director layout
  return (
    <>
      <Sidebar />
      <MobileHeader />
      <div className="md:ml-64 min-h-screen pt-14 md:pt-0">{children}</div>
    </>
  );
}

export default function AppShell({ children }) {
  return (
    <AuthProvider>
      <MobileProvider>
        <AppContent>{children}</AppContent>
      </MobileProvider>
    </AuthProvider>
  );
}

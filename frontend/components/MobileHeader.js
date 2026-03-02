"use client";

import Link from "next/link";
import { useMobile } from "../lib/useMobile";
import NotificationBell from "./NotificationBell";

export default function MobileHeader({ portalMode }) {
  const { isMobile, toggleSidebar } = useMobile();

  if (!isMobile) return null;

  return (
    <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-surface-200 z-30 flex items-center justify-between px-4 md:hidden">
      {/* Hamburger */}
      <button
        onClick={toggleSidebar}
        className="p-2 -ml-2 rounded-lg text-surface-600 hover:bg-surface-100 active:bg-surface-200 transition-colors"
        aria-label="Open menu"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Logo */}
      <Link href={portalMode ? "/portal" : "/dashboard"} className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-brand-500 flex items-center justify-center shadow-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        <span className="font-display text-base font-bold text-surface-900">Prime Ops</span>
      </Link>

      {/* Notification bell */}
      <div className="flex items-center">
        <NotificationBell />
      </div>
    </header>
  );
}

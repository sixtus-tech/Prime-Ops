"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../lib/auth";
import NotificationBell from "./NotificationBell";
import { useMobile } from "../lib/useMobile";

export default function PortalSidebar() {
  const pathname = usePathname();
  const { user, logout, authFetch } = useAuth();
  const { isMobile, sidebarOpen, setSidebarOpen } = useMobile();
  const [memberRoles, setMemberRoles] = useState([]);

  useEffect(() => {
    if (!user) return;
    authFetch("/auth/me")
      .then((data) => {
        const roles = data.user?.members?.map((m) => m.role) || [];
        setMemberRoles(roles);
      })
      .catch(() => {});
  }, [user]);

  const isHead = memberRoles.includes("head");
  const roleLabel = isHead ? "Team Lead" : "Team Member";

  const navItems = [
    {
      href: "/portal",
      label: "My Committees",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      href: "/portal/proposals",
      label: "My Workplans",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
        </svg>
      ),
    },
  ];

  function isActive(href) {
    if (href === "/portal") return pathname === "/portal";
    return pathname.startsWith(href);
  }

  return (
    <>
      {/* Backdrop overlay — mobile only */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed left-0 top-0 bottom-0 w-64 bg-white flex flex-col z-50 border-r border-surface-200 transition-transform duration-300 ease-in-out ${
          isMobile && !sidebarOpen ? "-translate-x-full" : "translate-x-0"
        }`}
      >
        {/* Logo */}
        <div className="px-6 pt-6 pb-5 border-b border-surface-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-brand-500 flex items-center justify-center flex-shrink-0 shadow-md shadow-brand-500/20">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div>
                <h1 className="font-display text-lg font-bold leading-tight text-surface-900">Prime Ops</h1>
                <span className="text-[10px] text-surface-400 uppercase tracking-widest font-semibold">Committee Portal</span>
              </div>
            </div>
            {isMobile && (
              <button onClick={() => setSidebarOpen(false)} className="p-1.5 rounded-lg text-surface-400 hover:bg-surface-100">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            )}
          </div>
        </div>

        {/* User info */}
        <div className="px-6 py-4 border-b border-surface-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5 min-w-0">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-surface-200" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                  {user?.name?.charAt(0)}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-surface-800 truncate">{user?.name}</p>
                {user?.kcUsername ? (
                  <p className="text-[10px] text-surface-400 truncate">@{user.kcUsername}</p>
                ) : (
                  <p className="text-[11px] text-surface-400 truncate">{user?.email}</p>
                )}
              </div>
            </div>
            <div className="hidden md:block">
              <NotificationBell />
            </div>
          </div>
          <span className={`inline-block mt-1.5 text-[10px] px-2 py-0.5 rounded-full font-semibold ${
            isHead ? "bg-amber-50 text-amber-600" : "bg-brand-50 text-brand-600"
          }`}>
            {roleLabel}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => isMobile && setSidebarOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                isActive(item.href)
                  ? "bg-brand-500 text-white font-medium shadow-md shadow-brand-500/20"
                  : "text-surface-500 hover:text-surface-800 hover:bg-surface-50"
              }`}
            >
              <span className={isActive(item.href) ? "text-white" : "text-surface-400"}>
                {item.icon}
              </span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Logout */}
        <div className="px-3 pb-5">
          <button
            onClick={() => { logout(); if (isMobile) setSidebarOpen(false); }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-surface-400 hover:text-surface-800 hover:bg-surface-50 transition-all"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign Out
          </button>
          <div className="text-[10px] text-surface-400 text-center mt-3">Prime Ops v1.6</div>
        </div>
      </aside>
    </>
  );
}

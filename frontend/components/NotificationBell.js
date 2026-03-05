"use client";
import { useState, useEffect, useRef } from "react";
import { useAuth } from "../lib/auth";

// Notification types relevant to each context
const DIRECTOR_TYPES = [
  "proposal_submitted", "proposal_submission", "committee_overdue",
  "status_update_submitted", "status_update", "director_broadcast",
  "budget_review", "general",
];

const PORTAL_TYPES = [
  "committee_appointment", "committee_added", "deadline_set",
  "deadline_7_day_reminder", "deadline_3_day_reminder",
  "deadline_1_day_reminder", "deadline_due_today", "deadline_overdue",
  "deadline_manual_reminder", "task_assigned", "role_changed",
  "proposal_comment", "milestone", "director_broadcast",
  "commented", "general",
];

export default function NotificationBell() {
  const { authFetch, isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Detect context from URL
  const isPortal = typeof window !== "undefined" && window.location.pathname.startsWith("/portal");

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  useEffect(() => {
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function filterByContext(items) {
    const allowedTypes = isPortal ? PORTAL_TYPES : DIRECTOR_TYPES;
    return items.filter((n) => {
      // Match exact type
      if (allowedTypes.includes(n.type)) return true;
      // Handle deadline subtypes like "deadline_7_day_reminder"
      if (isPortal && n.type?.startsWith("deadline_")) return true;
      // Fall back to link-based filtering
      if (isPortal && n.link?.startsWith("/portal")) return true;
      if (!isPortal && n.link && !n.link.startsWith("/portal")) return true;
      return false;
    });
  }

  async function fetchNotifications() {
    try {
      const data = await authFetch("/notifications");
      const items = Array.isArray(data) ? data : data.notifications || [];
      const filtered = filterByContext(items);
      setNotifications(filtered.slice(0, 20));
      setUnreadCount(filtered.filter((n) => !n.read).length);
    } catch {}
  }

  async function markAllRead() {
    try {
      await authFetch("/notifications/mark-read", { method: "POST" });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  }

  async function handleClick(notification) {
    if (!notification.read) {
      try {
        await authFetch(`/notifications/${notification.id}/read`, { method: "POST" });
        setNotifications((prev) =>
          prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n))
        );
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {}
    }
    if (notification.link) window.location.href = notification.link;
    setOpen(false);
  }

  function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    const hours = Math.floor(mins / 60);
    if (hours < 24) return hours + "h ago";
    return Math.floor(hours / 24) + "d ago";
  }

  if (!isAuthenticated) return null;

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button onClick={() => setOpen(!open)} style={{ position: "relative", background: "none", border: "none", cursor: "pointer", padding: 6, fontSize: 20, borderRadius: 8 }} title="Notifications">
        🔔
        {unreadCount > 0 && (
          <span style={{ position: "absolute", top: 2, right: 2, background: "#ef4444", color: "#fff", fontSize: 11, fontWeight: 700, borderRadius: "50%", width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center" }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: "absolute", top: "100%", left: 0, width: 340, maxHeight: 420, overflowY: "auto", background: "#fff", border: "1px solid #e5e7eb", borderRadius: 12, boxShadow: "0 8px 30px rgba(0,0,0,0.12)", zIndex: 1000, marginTop: 8 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid #f3f4f6" }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ background: "none", border: "none", color: "#6366f1", fontSize: 13, cursor: "pointer", fontWeight: 500 }}>Mark all read</button>
            )}
          </div>
          {notifications.length === 0 ? (
            <p style={{ padding: 20, textAlign: "center", color: "#9ca3af" }}>No notifications yet</p>
          ) : (
            notifications.map((n) => (
              <div key={n.id} onClick={() => handleClick(n)} style={{ padding: "10px 16px", borderBottom: "1px solid #f9fafb", cursor: n.link ? "pointer" : "default", background: n.read ? "#fff" : "#f0f4ff" }}>
                <p style={{ fontWeight: n.read ? 400 : 600, fontSize: 14, marginBottom: 2 }}>{n.title}</p>
                <p style={{ fontSize: 13, color: "#6b7280", lineHeight: 1.4 }}>{n.message}</p>
                <p style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>{timeAgo(n.createdAt)}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

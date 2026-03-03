"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

const STATUS_COLORS = {
  draft: "bg-surface-100 text-surface-600",
  planning: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  active: "bg-brand-100 text-brand-700",
  completed: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-600",
};

const APPROVAL_STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-700",
  under_review: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
  revision_requested: "bg-orange-100 text-orange-700",
};

const PRIORITY_DOT = {
  low: "bg-surface-400",
  normal: "bg-blue-400",
  high: "bg-orange-400",
  urgent: "bg-red-500",
};

const TYPE_ICONS = { church: "⛪", corporate: "🏢", general: "🌐" };

// ─── KPI Card ────────────────────────────────────────────────────────

function KpiCard({ label, value, icon, accent = false, sub }) {
  return (
    <div
      className={`rounded-xl border p-5 ${
        accent
          ? "bg-brand-500 text-white border-brand-500"
          : "bg-white text-surface-900 border-surface-200"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`text-sm font-medium ${accent ? "text-brand-100" : "text-surface-500"}`}>
          {label}
        </span>
        <span className="text-xl">{icon}</span>
      </div>
      <p className={`text-3xl font-display ${accent ? "text-white" : "text-surface-900"}`}>
        {value}
      </p>
      {sub && (
        <p className={`text-xs mt-1 ${accent ? "text-brand-200" : "text-surface-400"}`}>
          {sub}
        </p>
      )}
    </div>
  );
}

// ─── Mini bar chart ──────────────────────────────────────────────────

function StatusBarChart({ data, colors }) {
  const maxVal = Math.max(...Object.values(data), 1);
  return (
    <div className="flex items-end gap-2 h-28">
      {Object.entries(data).map(([key, val]) => (
        <div key={key} className="flex-1 flex flex-col items-center gap-1">
          <span className="text-xs font-bold text-surface-700">{val}</span>
          <div
            className={`w-full rounded-t-md transition-all ${colors[key]?.replace("text-", "bg-")?.split(" ")[0] || "bg-surface-300"}`}
            style={{ height: `${Math.max((val / maxVal) * 80, 4)}px` }}
          />
          <span className="text-[9px] text-surface-400 capitalize truncate w-full text-center">
            {key.replace("_", " ")}
          </span>
        </div>
      ))}
    </div>
  );
}

// ─── Activity icon ───────────────────────────────────────────────────

function activityIcon(action) {
  const map = {
    event_created: "📅",
    event_updated: "✏️",
    status_changed: "🔄",
    committee_added: "🤝",
    member_added: "👤",
    proposal_generated: "✨",
    approval_submitted: "📤",
    approval_approved: "✅",
    approval_rejected: "❌",
    approval_commented: "💬",
    approval_under_review: "🔍",
    approval_revision_requested: "🔁",
  };
  return map[action] || "📌";
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [statsData, actData] = await Promise.all([
          api.dashboardStats(),
          api.activityFeed(20),
        ]);
        setStats(statsData);
        setActivity(actData.activities);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-surface-400">
        <div className="text-center">
          <div className="w-10 h-10 rounded-full border-4 border-surface-200 border-t-brand-500 animate-spin mx-auto mb-3" />
          Loading dashboard...
        </div>
      </div>
    );
  }

  const t = stats?.totals || {};

  return (
    <main className="min-h-screen">
      {/* Header */}
      <div className="bg-brand-600 text-white px-6 lg:px-10 py-10">
        <h1 className="font-display text-3xl lg:text-4xl">Dashboard</h1>
        <p className="mt-2 text-white/70">
          Overview of your projects, committees, and approval pipeline.
        </p>
      </div>

      <div className="px-6 lg:px-10 py-8 space-y-8">
        {/* ─── KPI Cards ─── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          <KpiCard label="Total Projects" value={t.events || 0} icon="📅" />
          <KpiCard label="Committees" value={t.committees || 0} icon="🤝" />
          <KpiCard label="Members" value={t.members || 0} icon="👥" />
          <KpiCard label="Proposals" value={t.proposals || 0} icon="📝" />
          <KpiCard
            label="Pending Approvals"
            value={t.pendingApprovals || 0}
            icon="⏳"
            accent={t.pendingApprovals > 0}
            sub={t.pendingApprovals > 0 ? "Needs attention" : "All clear"}
          />
          <KpiCard label="Total Approvals" value={t.totalApprovals || 0} icon="✅" />
        </div>

        {/* ─── Charts row ─── */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Projects by Status */}
          <div className="bg-white rounded-xl border border-surface-200 p-6">
            <h3 className="font-display text-lg text-surface-900 mb-4">Projects by Status</h3>
            {stats?.eventsByStatus && Object.keys(stats.eventsByStatus).length > 0 ? (
              <StatusBarChart data={stats.eventsByStatus} colors={STATUS_COLORS} />
            ) : (
              <p className="text-surface-400 text-sm py-8 text-center">No events yet</p>
            )}
          </div>

          {/* Approvals by Status */}
          <div className="bg-white rounded-xl border border-surface-200 p-6">
            <h3 className="font-display text-lg text-surface-900 mb-4">Approvals Pipeline</h3>
            {stats?.approvalsByStatus && Object.keys(stats.approvalsByStatus).length > 0 ? (
              <StatusBarChart data={stats.approvalsByStatus} colors={APPROVAL_STATUS_COLORS} />
            ) : (
              <p className="text-surface-400 text-sm py-8 text-center">No approvals yet</p>
            )}
          </div>
        </div>

        {/* ─── Main content grid ─── */}
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Pending Approvals */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-surface-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
              <h3 className="font-display text-lg text-surface-900">Pending Approvals</h3>
              <Link href="/approvals" className="text-brand-500 hover:text-brand-600 text-sm font-medium">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-surface-100">
              {stats?.pendingRequests?.length > 0 ? (
                stats.pendingRequests.map((req) => (
                  <Link
                    key={req.id}
                    href={`/approvals/${req.id}`}
                    className="px-6 py-3.5 flex items-center gap-4 hover:bg-surface-50 transition-colors block"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full ${PRIORITY_DOT[req.priority] || PRIORITY_DOT.normal}`} title={req.priority} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-800 truncate">{req.title}</p>
                      <p className="text-xs text-surface-400 truncate">
                        {req.event?.title} · By {req.requestedBy}
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${APPROVAL_STATUS_COLORS[req.status]}`}>
                      {req.status.replace("_", " ")}
                    </span>
                    {req.dueDate && (
                      <span className="text-[10px] text-surface-400">
                        Due {new Date(req.dueDate).toLocaleDateString()}
                      </span>
                    )}
                  </Link>
                ))
              ) : (
                <div className="px-6 py-8 text-center text-surface-400 text-sm">
                  No pending approvals — you&apos;re all caught up!
                </div>
              )}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-100">
              <h3 className="font-display text-lg text-surface-900">Recent Activity</h3>
            </div>
            <div className="max-h-[420px] overflow-y-auto divide-y divide-surface-50">
              {activity.length > 0 ? (
                activity.map((a) => (
                  <div key={a.id} className="px-5 py-3 flex gap-3">
                    <span className="text-base mt-0.5">{activityIcon(a.action)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-surface-700 leading-relaxed">{a.description}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {a.event && (
                          <Link
                            href={`/events/${a.event.id}`}
                            className="text-[10px] text-brand-500 hover:text-brand-600 truncate max-w-[120px]"
                          >
                            {a.event.title}
                          </Link>
                        )}
                        <span className="text-[10px] text-surface-300">
                          {timeAgo(a.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-6 py-8 text-center text-surface-400 text-sm">
                  No activity yet — create your first project!
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ─── Bottom row ─── */}
        <div className="grid lg:grid-cols-2 gap-6">
          {/* Recent Projects */}
          <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-100 flex items-center justify-between">
              <h3 className="font-display text-lg text-surface-900">Recent Projects</h3>
              <Link href="/events" className="text-brand-500 hover:text-brand-600 text-sm font-medium">
                View all →
              </Link>
            </div>
            <div className="divide-y divide-surface-100">
              {stats?.recentEvents?.length > 0 ? (
                stats.recentEvents.map((e) => (
                  <Link
                    key={e.id}
                    href={`/events/${e.id}`}
                    className="px-6 py-3.5 flex items-center gap-3 hover:bg-surface-50 transition-colors block"
                  >
                    <span>{TYPE_ICONS[e.eventType] || "🌐"}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-800 truncate">{e.title}</p>
                      <p className="text-xs text-surface-400">
                        {e._count?.committees || 0} committees
                      </p>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${STATUS_COLORS[e.status]}`}>
                      {e.status}
                    </span>
                  </Link>
                ))
              ) : (
                <div className="px-6 py-8 text-center text-surface-400 text-sm">No events yet</div>
              )}
            </div>
          </div>

          {/* Upcoming Projects */}
          <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
            <div className="px-6 py-4 border-b border-surface-100">
              <h3 className="font-display text-lg text-surface-900">Upcoming Projects</h3>
            </div>
            <div className="divide-y divide-surface-100">
              {stats?.upcomingEvents?.length > 0 ? (
                stats.upcomingEvents.map((e) => (
                  <Link
                    key={e.id}
                    href={`/events/${e.id}`}
                    className="px-6 py-3.5 flex items-center gap-3 hover:bg-surface-50 transition-colors block"
                  >
                    <div className="w-11 h-11 rounded-lg bg-brand-50 flex flex-col items-center justify-center text-brand-600 flex-shrink-0">
                      <span className="text-[10px] font-bold uppercase leading-none">
                        {new Date(e.startDate).toLocaleDateString("en", { month: "short" })}
                      </span>
                      <span className="text-sm font-display leading-none mt-0.5">
                        {new Date(e.startDate).getDate()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-surface-800 truncate">{e.title}</p>
                      {e.estimatedAttendance && (
                        <p className="text-xs text-surface-400">👥 {e.estimatedAttendance}</p>
                      )}
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${STATUS_COLORS[e.status]}`}>
                      {e.status}
                    </span>
                  </Link>
                ))
              ) : (
                <div className="px-6 py-8 text-center text-surface-400 text-sm">
                  No upcoming projects scheduled
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Top Committees */}
        {stats?.topCommittees?.length > 0 && (
          <div className="bg-white rounded-xl border border-surface-200 p-6">
            <h3 className="font-display text-lg text-surface-900 mb-4">Largest Committees</h3>
            <div className="grid sm:grid-cols-5 gap-3">
              {stats.topCommittees.map((c) => (
                <Link
                  key={c.id}
                  href={`/events/${c.event?.id}`}
                  className="rounded-lg border border-surface-200 p-3 hover:border-brand-200 transition-colors block text-center"
                >
                  <p className="text-2xl font-display text-brand-500">{c._count?.members || 0}</p>
                  <p className="text-xs font-medium text-surface-800 truncate mt-1">{c.name}</p>
                  <p className="text-[10px] text-surface-400 truncate">{c.event?.title}</p>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

// ─── Util ────────────────────────────────────────────────────────────

function timeAgo(dateStr) {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now - date) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString();
}

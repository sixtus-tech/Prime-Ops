"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

const ROLE_BADGE = {
  chair: "bg-brand-100 text-brand-700",
  "co-chair": "bg-blue-100 text-blue-700",
  member: "bg-surface-100 text-surface-600",
};

const EVENT_COLORS = [
  { accent: "border-l-orange-500", badge: "bg-orange-50 text-orange-700", dot: "bg-orange-500", headerBg: "bg-orange-50/50" },
  { accent: "border-l-blue-500", badge: "bg-blue-50 text-blue-700", dot: "bg-blue-500", headerBg: "bg-blue-50/50" },
  { accent: "border-l-emerald-500", badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500", headerBg: "bg-emerald-50/50" },
  { accent: "border-l-purple-500", badge: "bg-purple-50 text-purple-700", dot: "bg-purple-500", headerBg: "bg-purple-50/50" },
  { accent: "border-l-amber-500", badge: "bg-amber-50 text-amber-700", dot: "bg-amber-500", headerBg: "bg-amber-50/50" },
  { accent: "border-l-rose-500", badge: "bg-rose-50 text-rose-700", dot: "bg-rose-500", headerBg: "bg-rose-50/50" },
  { accent: "border-l-cyan-500", badge: "bg-cyan-50 text-cyan-700", dot: "bg-cyan-500", headerBg: "bg-cyan-50/50" },
  { accent: "border-l-indigo-500", badge: "bg-indigo-50 text-indigo-700", dot: "bg-indigo-500", headerBg: "bg-indigo-50/50" },
];

const STATUS_STYLES = {
  draft: "bg-surface-100 text-surface-600",
  approved: "bg-green-100 text-green-700",
  pending: "bg-yellow-100 text-yellow-700",
  in_progress: "bg-blue-100 text-blue-700",
  completed: "bg-emerald-100 text-emerald-700",
};

export default function CommitteesPage() {
  const [committees, setCommittees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedEvents, setExpandedEvents] = useState({});

  useEffect(() => {
    async function load() {
      try {
        const data = await api.listCommittees();
        setCommittees(data.committees);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Group committees by event
  const eventGroups = {};
  const unlinked = [];

  committees.forEach((c) => {
    if (c.event?.id) {
      if (!eventGroups[c.event.id]) {
        eventGroups[c.event.id] = { event: c.event, committees: [] };
      }
      eventGroups[c.event.id].committees.push(c);
    } else {
      unlinked.push(c);
    }
  });

  const sortedGroups = Object.values(eventGroups).sort((a, b) =>
    (a.event.title || "").localeCompare(b.event.title || "")
  );

  const totalMembers = committees.reduce((sum, c) => sum + (c.members?.length || 0), 0);
  const totalChairs = committees.reduce(
    (sum, c) => sum + (c.members?.filter((m) => m.role === "chair").length || 0), 0
  );

  const toggleEvent = (eventId) => {
    setExpandedEvents((prev) => ({ ...prev, [eventId]: !prev[eventId] }));
  };

  // Auto-expand all on first load
  useEffect(() => {
    if (sortedGroups.length > 0 && Object.keys(expandedEvents).length === 0) {
      const initial = {};
      sortedGroups.forEach((g) => { initial[g.event.id] = true; });
      if (unlinked.length > 0) initial["unlinked"] = true;
      setExpandedEvents(initial);
    }
  }, [committees]);

  return (
    <main className="min-h-screen">
      <div className="bg-brand-600 text-white px-6 lg:px-10 py-10">
        <h1 className="font-display text-3xl lg:text-4xl">Committees</h1>
        <p className="mt-2 text-white/70">
          Overview of all committees across your projects.
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:flex gap-4 sm:gap-8 mt-6 pt-5 border-t border-white/20">
          <div>
            <p className="text-white/60 text-xs">Total Committees</p>
            <p className="text-2xl font-display text-white">{committees.length}</p>
          </div>
          <div>
            <p className="text-white/60 text-xs">Total Members</p>
            <p className="text-2xl font-display text-white">{totalMembers}</p>
          </div>
          <div>
            <p className="text-white/60 text-xs">Committee Chairs</p>
            <p className="text-2xl font-display text-white">{totalChairs}</p>
          </div>
          <div>
            <p className="text-white/60 text-xs">Events</p>
            <p className="text-2xl font-display text-white">{sortedGroups.length}</p>
          </div>
        </div>
      </div>

      <div className="px-6 lg:px-10 py-8">
        {loading ? (
          <div className="text-center py-20 text-surface-400">Loading committees...</div>
        ) : committees.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mx-auto mb-4 text-2xl">
              🤝
            </div>
            <p className="text-surface-700 font-medium text-lg">No committees yet</p>
            <p className="text-surface-400 text-sm mt-1">
              Create a project first, then add committees to it.
            </p>
            <Link href="/events" className="text-brand-500 hover:text-brand-600 text-sm font-medium mt-3 inline-block">
              Go to Projects →
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {sortedGroups.map((group, groupIndex) => {
              const colors = EVENT_COLORS[groupIndex % EVENT_COLORS.length];
              const isExpanded = expandedEvents[group.event.id] !== false;
              const memberCount = group.committees.reduce((sum, c) => sum + (c.members?.length || 0), 0);
              const chairCount = group.committees.reduce(
                (sum, c) => sum + (c.members?.filter((m) => m.role === "chair").length || 0), 0
              );

              return (
                <div key={group.event.id} className="bg-white rounded-2xl border border-surface-200 overflow-hidden shadow-sm">
                  {/* Event Header */}
                  <button
                    onClick={() => toggleEvent(group.event.id)}
                    className={`w-full text-left px-6 py-5 flex items-center gap-4 hover:bg-surface-50/50 transition-colors ${colors.headerBg}`}
                  >
                    <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${colors.dot} ring-4 ring-white/80`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="font-display text-lg text-surface-900 truncate">
                          {group.event.title}
                        </h2>
                        {group.event.status && (
                          <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${STATUS_STYLES[group.event.status] || STATUS_STYLES.draft}`}>
                            {group.event.status.replace("_", " ")}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-surface-400">
                        <span className="flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/></svg>
                          {group.committees.length} committee{group.committees.length !== 1 ? "s" : ""}
                        </span>
                        <span className="flex items-center gap-1">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                          {memberCount} member{memberCount !== 1 ? "s" : ""}
                        </span>
                        {chairCount > 0 && (
                          <span className="flex items-center gap-1">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                            {chairCount} chair{chairCount !== 1 ? "s" : ""}
                          </span>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/events/${group.event.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-brand-500 hover:text-brand-600 font-medium px-3 py-1.5 rounded-lg hover:bg-brand-50 transition-colors flex-shrink-0 hidden sm:block"
                    >
                      View Project →
                    </Link>
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      className={`text-surface-400 transition-transform duration-200 flex-shrink-0 ${isExpanded ? "rotate-180" : ""}`}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>

                  {/* Committees Grid */}
                  {isExpanded && (
                    <div className="border-t border-surface-100 px-6 py-5">
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {group.committees.map((c) => (
                          <Link
                            key={c.id}
                            href={`/events/${c.event?.id}`}
                            className={`bg-white rounded-xl border border-surface-200 border-l-[3px] ${colors.accent} p-4 hover:shadow-md hover:border-surface-300 transition-all group block`}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="font-medium text-surface-900 group-hover:text-brand-600 transition-colors text-sm leading-tight">
                                {c.name}
                              </h3>
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${colors.badge}`}>
                                {c.members?.length || 0}
                              </span>
                            </div>

                            {/* Responsibilities preview */}
                            {c.responsibilities?.length > 0 && (
                              <div className="mb-2.5">
                                <ul className="space-y-0.5">
                                  {c.responsibilities.slice(0, 2).map((r) => (
                                    <li key={r.id} className="text-xs text-surface-500 truncate">• {r.text}</li>
                                  ))}
                                  {c.responsibilities.length > 2 && (
                                    <li className="text-xs text-surface-400">+{c.responsibilities.length - 2} more</li>
                                  )}
                                </ul>
                              </div>
                            )}

                            {/* Members preview */}
                            {c.members?.length > 0 && (
                              <div className="flex items-center gap-1 pt-2 border-t border-surface-100">
                                {c.members.slice(0, 5).map((m) => (
                                  <div
                                    key={m.id}
                                    title={`${m.name} (${m.role})`}
                                    className="w-6 h-6 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-[9px] font-bold border-2 border-white"
                                  >
                                    {m.name.charAt(0)}
                                  </div>
                                ))}
                                {c.members.length > 5 && (
                                  <span className="text-[10px] text-surface-400 ml-1">+{c.members.length - 5}</span>
                                )}
                                <div className="ml-auto">
                                  {c.members.filter((m) => m.role === "chair").length > 0 && (
                                    <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${ROLE_BADGE.chair}`}>
                                      {c.members.filter((m) => m.role === "chair").length} Chair
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unlinked committees */}
            {unlinked.length > 0 && (
              <div className="bg-white rounded-2xl border border-surface-200 overflow-hidden shadow-sm">
                <button
                  onClick={() => toggleEvent("unlinked")}
                  className="w-full text-left px-6 py-5 flex items-center gap-4 hover:bg-surface-50/50 transition-colors"
                >
                  <div className="w-3.5 h-3.5 rounded-full flex-shrink-0 bg-surface-400 ring-4 ring-white/80" />
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display text-lg text-surface-700">Unassigned Committees</h2>
                    <p className="text-xs text-surface-400 mt-0.5">
                      {unlinked.length} committee{unlinked.length !== 1 ? "s" : ""} not linked to any project
                    </p>
                  </div>
                  <svg
                    width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`text-surface-400 transition-transform duration-200 flex-shrink-0 ${expandedEvents["unlinked"] !== false ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </button>

                {expandedEvents["unlinked"] !== false && (
                  <div className="border-t border-surface-100 px-6 py-5">
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {unlinked.map((c) => (
                        <div key={c.id} className="bg-white rounded-xl border border-surface-200 border-l-[3px] border-l-surface-300 p-4">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="font-medium text-surface-900 text-sm">{c.name}</h3>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-surface-100 text-surface-500">
                              {c.members?.length || 0}
                            </span>
                          </div>
                          {c.responsibilities?.length > 0 && (
                            <ul className="space-y-0.5">
                              {c.responsibilities.slice(0, 2).map((r) => (
                                <li key={r.id} className="text-xs text-surface-500 truncate">• {r.text}</li>
                              ))}
                            </ul>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

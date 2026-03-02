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

const TYPE_ICONS = {
  church: "⛪",
  corporate: "🏢",
  general: "🌐",
};

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: "", eventType: "" });

  useEffect(() => {
    loadEvents();
  }, [filter]);

  async function loadEvents() {
    setLoading(true);
    try {
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.eventType) params.eventType = filter.eventType;
      const data = await api.listEvents(params);
      setEvents(data.events);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id, title) {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await api.deleteEvent(id);
      setEvents((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
  }

  return (
    <main className="min-h-screen">
      {/* Header */}
      <div className="bg-brand-600 text-white px-6 lg:px-10 py-10 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl">Events</h1>
          <p className="mt-2 text-white/70">
            Manage all your events, track status, and oversee committees.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Link
            href="/events/new"
            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>
            </svg>
            New Event
          </Link>
          <Link
            href="/"
            className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4"/>
            </svg>
            AI Generate
          </Link>
        </div>
      </div>

      <div className="px-6 lg:px-10 py-8">
        {/* Filters */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <select
            value={filter.status}
            onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-surface-200 text-sm text-surface-700 bg-white"
          >
            <option value="">All Statuses</option>
            <option value="draft">Draft</option>
            <option value="planning">Planning</option>
            <option value="approved">Approved</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={filter.eventType}
            onChange={(e) => setFilter((f) => ({ ...f, eventType: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-surface-200 text-sm text-surface-700 bg-white"
          >
            <option value="">All Types</option>
            <option value="church">Church</option>
            <option value="corporate">Corporate</option>
            <option value="general">General</option>
          </select>
        </div>

        {/* Events list */}
        {loading ? (
          <div className="text-center py-20 text-surface-400">Loading events...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mx-auto mb-4 text-2xl">
              📅
            </div>
            <p className="text-surface-700 font-medium text-lg">No events yet</p>
            <p className="text-surface-400 text-sm mt-1">
              Create an event manually or generate one from an AI proposal.
            </p>
            <div className="flex gap-2 justify-center mt-4">
              <Link href="/events/new" className="text-brand-500 hover:text-brand-600 text-sm font-medium">
                Create manually →
              </Link>
              <span className="text-surface-300">|</span>
              <Link href="/" className="text-brand-500 hover:text-brand-600 text-sm font-medium">
                AI Generate →
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {events.map((event) => (
              <Link
                key={event.id}
                href={`/events/${event.id}`}
                className="bg-white rounded-xl border border-surface-200 p-4 sm:p-5 hover:border-brand-200 overflow-hidden hover:shadow-sm transition-all group block"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-lg">{TYPE_ICONS[event.eventType] || "🌐"}</span>
                      <h3 className="font-display text-base sm:text-lg text-surface-900 group-hover:text-brand-600 transition-colors line-clamp-2 sm:truncate">
                        {event.title}
                      </h3>
                    </div>
                    {event.subtitle && (
                      <p className="text-surface-500 text-sm mb-2 truncate">{event.subtitle}</p>
                    )}
                    {event.summary && (
                      <p className="text-surface-400 text-sm line-clamp-2">{event.summary}</p>
                    )}

                    {/* Meta row */}
                    <div className="flex items-center gap-x-3 gap-y-1 sm:gap-4 mt-3 text-xs text-surface-400 flex-wrap">
                      {event.startDate && (
                        <span>📅 {new Date(event.startDate).toLocaleDateString()}</span>
                      )}
                      {event.estimatedBudget && (
                        <span>💰 {event.estimatedBudget}</span>
                      )}
                      {event.estimatedAttendance && (
                        <span>👥 {event.estimatedAttendance}</span>
                      )}
                      <span>🤝 {event.committees?.length || 0} committees</span>
                      <span>
                        👤{" "}
                        {event.committees?.reduce((sum, c) => sum + (c.members?.length || 0), 0) || 0}{" "}
                        members
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[event.status] || STATUS_COLORS.draft}`}>
                      {event.status}
                    </span>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(event.id, event.title);
                      }}
                      className="text-surface-300 hover:text-red-500 transition-colors p-1"
                      title="Delete event"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

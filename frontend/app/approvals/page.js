"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "../../lib/api";

const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-700",
  under_review: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-600",
  revision_requested: "bg-orange-100 text-orange-700",
};

const PRIORITY_BADGE = {
  low: "bg-surface-100 text-surface-500",
  normal: "bg-blue-50 text-blue-600",
  high: "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

// ─── Create Approval Form ────────────────────────────────────────────

function CreateApprovalForm({ events, onCreated }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    eventId: "",
    title: "",
    description: "",
    requestedBy: "",
    priority: "normal",
    dueDate: "",
  });

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.eventId || !form.title || !form.requestedBy) return;
    setSaving(true);
    try {
      const data = await api.createApproval(form);
      onCreated(data.approval);
      setForm({ eventId: "", title: "", description: "", requestedBy: "", priority: "normal", dueDate: "" });
      setOpen(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="bg-brand-500 hover:bg-brand-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2 shadow-sm"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/>
        </svg>
        Submit for Approval
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-surface-200 p-6 space-y-4 mb-6 animate-fade-in">
      <h3 className="font-display text-lg text-surface-900">New Approval Request</h3>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Event *</label>
          <select
            value={form.eventId}
            onChange={(e) => set("eventId", e.target.value)}
            required
            className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
          >
            <option value="">Select an event...</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Requested By *</label>
          <input
            value={form.requestedBy}
            onChange={(e) => set("requestedBy", e.target.value)}
            placeholder="Your name"
            required
            className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-surface-500 mb-1">Title *</label>
        <input
          value={form.title}
          onChange={(e) => set("title", e.target.value)}
          placeholder="e.g. Budget Approval for Youth Conference"
          required
          className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-surface-500 mb-1">Description</label>
        <textarea
          value={form.description}
          onChange={(e) => set("description", e.target.value)}
          placeholder="Details about what needs approval..."
          rows={3}
          className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 resize-none"
        />
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Priority</label>
          <select
            value={form.priority}
            onChange={(e) => set("priority", e.target.value)}
            className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
          >
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Due Date</label>
          <input
            type="date"
            value={form.dueDate}
            onChange={(e) => set("dueDate", e.target.value)}
            className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="px-5 py-2.5 rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50 text-sm"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all"
        >
          {saving ? "Submitting..." : "Submit Request"}
        </button>
      </div>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN APPROVALS PAGE
// ═══════════════════════════════════════════════════════════════════════

export default function ApprovalsPage() {
  const [approvals, setApprovals] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({ status: "", priority: "" });

  useEffect(() => {
    loadData();
  }, [filter]);

  async function loadData() {
    setLoading(true);
    try {
      const params = {};
      if (filter.status) params.status = filter.status;
      if (filter.priority) params.priority = filter.priority;

      const [appData, evData] = await Promise.all([
        api.listApprovals(params),
        api.listEvents(),
      ]);
      setApprovals(appData.approvals);
      setEvents(evData.events);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function handleCreated(approval) {
    setApprovals((prev) => [approval, ...prev]);
  }

  async function handleDelete(id) {
    if (!confirm("Delete this approval request?")) return;
    try {
      await api.deleteApproval(id);
      setApprovals((prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  // Count by status
  const counts = approvals.reduce((acc, a) => {
    acc[a.status] = (acc[a.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <main className="min-h-screen">
      <div className="bg-brand-600 text-white px-6 lg:px-10 py-10 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl lg:text-4xl">Approvals</h1>
          <p className="mt-2 text-white/70">
            Submit, review, and track approval requests for your events.
          </p>
        </div>
        <CreateApprovalForm events={events} onCreated={handleCreated} />
      </div>

      <div className="px-6 lg:px-10 py-8">
        {/* Status summary pills */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setFilter((f) => ({ ...f, status: "" }))}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              !filter.status ? "bg-surface-900 text-white" : "bg-white text-surface-600 border border-surface-200"
            }`}
          >
            All ({approvals.length})
          </button>
          {Object.entries(STATUS_COLORS).map(([status, color]) => (
            <button
              key={status}
              onClick={() => setFilter((f) => ({ ...f, status: f.status === status ? "" : status }))}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all capitalize ${
                filter.status === status ? color : "bg-white text-surface-600 border border-surface-200 hover:bg-surface-50"
              }`}
            >
              {status.replace("_", " ")} ({counts[status] || 0})
            </button>
          ))}
        </div>

        {/* Priority filter */}
        <div className="flex gap-2 mb-6">
          <select
            value={filter.priority}
            onChange={(e) => setFilter((f) => ({ ...f, priority: e.target.value }))}
            className="px-3 py-2 rounded-lg border border-surface-200 text-sm text-surface-700 bg-white"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>

        {/* Approvals list */}
        {loading ? (
          <div className="text-center py-20 text-surface-400">Loading approvals...</div>
        ) : approvals.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 rounded-full bg-surface-100 flex items-center justify-center mx-auto mb-4 text-2xl">
              ✅
            </div>
            <p className="text-surface-700 font-medium text-lg">No approval requests</p>
            <p className="text-surface-400 text-sm mt-1">
              {filter.status
                ? `No ${filter.status.replace("_", " ")} requests found.`
                : "Submit your first approval request to get started."}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {approvals.map((a) => (
              <div
                key={a.id}
                className="bg-white rounded-xl border border-surface-200 hover:border-brand-200 transition-all"
              >
                <Link href={`/approvals/${a.id}`} className="block p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-surface-900 truncate">{a.title}</h3>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${STATUS_COLORS[a.status]}`}>
                          {a.status.replace("_", " ")}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${PRIORITY_BADGE[a.priority]}`}>
                          {a.priority}
                        </span>
                      </div>
                      {a.description && (
                        <p className="text-sm text-surface-500 line-clamp-1 mt-0.5">{a.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-surface-400">
                        <span>📅 {a.event?.title || "Unknown event"}</span>
                        <span>👤 {a.requestedBy}</span>
                        <span>💬 {a._count?.actions || 0} actions</span>
                        {a.dueDate && (
                          <span className={new Date(a.dueDate) < new Date() ? "text-red-500 font-medium" : ""}>
                            ⏰ Due {new Date(a.dueDate).toLocaleDateString()}
                          </span>
                        )}
                        <span>{new Date(a.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>

                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleDelete(a.id);
                      }}
                      className="p-1.5 text-surface-300 hover:text-red-500 transition-colors flex-shrink-0"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                      </svg>
                    </button>
                  </div>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

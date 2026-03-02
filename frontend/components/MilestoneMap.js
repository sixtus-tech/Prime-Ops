"use client";
import React, { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ─── Status config ──────────────────────────────────────────────────
const STATUS_CONFIG = {
  not_started: { label: "Not Started", color: "bg-surface-100 text-surface-500", dot: "bg-surface-300" },
  in_progress: { label: "In Progress", color: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  completed: { label: "Completed", color: "bg-green-50 text-green-700", dot: "bg-green-500" },
  at_risk: { label: "At Risk", color: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  pending_approval: { label: "Pending Approval", color: "bg-purple-50 text-purple-700", dot: "bg-purple-500" },
  verified: { label: "Verified", color: "bg-green-50 text-green-700", dot: "bg-green-500" },
  unverified: { label: "Unverified", color: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
};

function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.not_started;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </span>
  );
}

// ─── Progress Ring ──────────────────────────────────────────────────
function ProgressRing({ progress, size = 48, strokeWidth = 4 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  const color = progress === 100 ? "#22c55e" : progress >= 50 ? "#3b82f6" : progress > 0 ? "#f59e0b" : "#d1d5db";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f1f5f9" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2} cy={size / 2} r={radius} fill="none"
          stroke={color} strokeWidth={strokeWidth}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-surface-700">
        {progress}%
      </span>
    </div>
  );
}

// ─── Editable Milestone (inline edit for director) ──────────────────
function EditMilestoneModal({ milestone, onSave, onClose }) {
  const [form, setForm] = useState({
    title: milestone.title,
    description: milestone.description || "",
    targetDate: milestone.targetDate ? new Date(milestone.targetDate).toISOString().split("T")[0] : "",
    requiresApproval: milestone.requiresApproval,
  });
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        title: form.title,
        description: form.description || null,
        targetDate: form.targetDate || null,
        requiresApproval: form.requiresApproval,
      });
      onClose();
    } catch {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="bg-white rounded-xl shadow-2xl border border-surface-200 p-6 w-full max-w-md space-y-4 animate-fade-in"
      >
        <h3 className="font-display text-lg text-surface-900">Edit Milestone</h3>
        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Title</label>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            rows={2}
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 resize-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-surface-500 mb-1">Target Date</label>
          <input
            type="date"
            value={form.targetDate}
            onChange={(e) => setForm((f) => ({ ...f, targetDate: e.target.value }))}
            className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400"
          />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={form.requiresApproval}
            onChange={(e) => setForm((f) => ({ ...f, requiresApproval: e.target.checked }))}
            className="w-4 h-4 rounded border-surface-300 text-brand-500 focus:ring-brand-400"
          />
          <span className="text-sm text-surface-700">Critical milestone (requires sign-off)</span>
        </label>
        <div className="flex gap-2 pt-2">
          <button type="button" onClick={onClose} className="flex-1 text-sm py-2 rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50 transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving} className="flex-1 text-sm py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-medium transition-colors disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Sub-Milestone Row ──────────────────────────────────────────────
function SubMilestoneRow({ sub, onApprove, onRevert }) {
  const isCompleted = sub.status === "completed" || sub.status === "verified";
  const isPending = sub.status === "pending_approval";

  return (
    <div className={`flex items-center justify-between py-2.5 px-3 rounded-lg transition-colors ${isCompleted ? "bg-green-50/50" : isPending ? "bg-purple-50/50" : "hover:bg-surface-50"}`}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Completion indicator */}
        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
          isCompleted ? "border-green-500 bg-green-500" : isPending ? "border-purple-400 bg-purple-50" : "border-surface-300"
        }`}>
          {isCompleted && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
          {isPending && (
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9333ea" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1" /><circle cx="12" cy="5" r="1" /><circle cx="12" cy="19" r="1" />
            </svg>
          )}
        </div>

        <div className="min-w-0">
          <p className={`text-sm font-medium truncate ${isCompleted ? "text-surface-500 line-through" : "text-surface-800"}`}>
            {sub.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-xs text-surface-400">{sub.committee?.name}</span>
            {sub.requiresApproval && (
              <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">CRITICAL</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0 ml-3">
        <StatusBadge status={sub.status} />

        {/* Director actions */}
        {isPending && (
          <button
            onClick={() => onApprove(sub.id)}
            className="text-xs font-medium text-green-600 hover:text-green-700 bg-green-50 hover:bg-green-100 px-2.5 py-1 rounded-lg transition-colors"
          >
            Approve
          </button>
        )}
        {isCompleted && !sub.verified && (
          <button
            onClick={() => onRevert(sub.id)}
            className="text-xs text-surface-400 hover:text-red-500 transition-colors"
            title="Revert to in progress"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Milestone Card ─────────────────────────────────────────────────
function MilestoneCard({ milestone, onUpdate, onDelete, onApprove, onRevert, userName }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);

  const subCount = milestone.subMilestones?.length || 0;
  const completedSubs = milestone.subMilestones?.filter(
    (s) => s.status === "completed" || s.status === "verified"
  ).length || 0;
  const pendingSubs = milestone.subMilestones?.filter(
    (s) => s.status === "pending_approval"
  ).length || 0;

  const isOverdue = milestone.targetDate && new Date(milestone.targetDate) < new Date() && milestone.status !== "completed";

  async function handleSave(data) {
    await apiFetch(`/milestones/master/${milestone.id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
    onUpdate();
  }

  async function handleDelete() {
    if (!confirm(`Delete milestone "${milestone.title}" and all its sub-milestones?`)) return;
    await apiFetch(`/milestones/master/${milestone.id}`, { method: "DELETE" });
    onUpdate();
  }

  return (
    <>
      <div className={`bg-white rounded-xl border transition-all ${
        milestone.status === "at_risk" ? "border-amber-300 shadow-amber-100/50 shadow-md" :
        milestone.status === "completed" ? "border-green-200" :
        "border-surface-200 hover:border-surface-300"
      }`}>
        {/* Header */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Phase number */}
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 ${
              milestone.status === "completed" ? "bg-green-100 text-green-700" :
              milestone.status === "at_risk" ? "bg-amber-100 text-amber-700" :
              milestone.status === "in_progress" ? "bg-blue-100 text-blue-700" :
              "bg-surface-100 text-surface-500"
            }`}>
              {milestone.phase}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-display text-sm text-surface-900 truncate">{milestone.title}</h3>
                {milestone.requiresApproval && (
                  <span className="text-[10px] font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded flex-shrink-0">CRITICAL</span>
                )}
              </div>
              {milestone.description && (
                <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">{milestone.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2">
                <StatusBadge status={milestone.status} />
                {milestone.targetDate && (
                  <span className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-surface-400"}`}>
                    {isOverdue ? "⚠ Overdue: " : "Due: "}
                    {new Date(milestone.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                )}
                {subCount > 0 && (
                  <span className="text-xs text-surface-400">{completedSubs}/{subCount} tasks</span>
                )}
                {pendingSubs > 0 && (
                  <span className="text-xs font-medium text-purple-600">{pendingSubs} awaiting sign-off</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1 flex-shrink-0">
              <ProgressRing progress={milestone.progress} size={40} strokeWidth={3} />
              <div className="flex flex-col gap-0.5 ml-1">
                <button onClick={() => setEditing(true)} className="p-1 text-surface-400 hover:text-brand-500 rounded transition-colors" title="Edit">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                  </svg>
                </button>
                <button onClick={handleDelete} className="p-1 text-surface-400 hover:text-red-500 rounded transition-colors" title="Delete">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="px-4 pb-1">
          <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ease-out ${
                milestone.progress === 100 ? "bg-green-500" :
                milestone.status === "at_risk" ? "bg-amber-500" :
                "bg-blue-500"
              }`}
              style={{ width: `${milestone.progress}%` }}
            />
          </div>
        </div>

        {/* Sub-milestones toggle */}
        {subCount > 0 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center justify-center gap-1 py-2 text-xs text-surface-400 hover:text-surface-600 border-t border-surface-100 transition-colors"
          >
            <svg
              width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {expanded ? "Hide" : "Show"} {subCount} sub-milestone{subCount !== 1 ? "s" : ""}
          </button>
        )}

        {/* Expanded sub-milestones */}
        {expanded && subCount > 0 && (
          <div className="border-t border-surface-100 px-2 py-2 space-y-0.5">
            {milestone.subMilestones.map((sub) => (
              <SubMilestoneRow
                key={sub.id}
                sub={sub}
                onApprove={onApprove}
                onRevert={onRevert}
              />
            ))}
          </div>
        )}
      </div>

      {editing && (
        <EditMilestoneModal
          milestone={milestone}
          onSave={handleSave}
          onClose={() => setEditing(false)}
        />
      )}
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export default function MilestoneMap({ eventId, userName }) {
  const [milestones, setMilestones] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);

  const loadMilestones = useCallback(async () => {
    try {
      const data = await apiFetch(`/milestones/${eventId}`);
      setMilestones(data.milestones || []);
      setStats(data.stats || null);
      setError(null);
    } catch (err) {
      if (!err.message?.includes("Failed to fetch")) {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    loadMilestones();
  }, [loadMilestones]);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      await apiFetch(`/milestones/${eventId}/generate`, {
        method: "POST",
        body: JSON.stringify({ performedBy: userName || "Director" }),
      });
      await loadMilestones();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleRegenerate() {
    if (!confirm("This will delete all current milestones and sub-milestones, then generate new ones. Continue?")) return;
    setGenerating(true);
    setError(null);
    try {
      await apiFetch(`/milestones/${eventId}/all`, { method: "DELETE" });
      await apiFetch(`/milestones/${eventId}/generate`, {
        method: "POST",
        body: JSON.stringify({ performedBy: userName || "Director" }),
      });
      await loadMilestones();
    } catch (err) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleApprove(subMilestoneId) {
    try {
      await apiFetch(`/milestones/sub/${subMilestoneId}/approve`, {
        method: "POST",
        body: JSON.stringify({ approvedBy: userName || "Director" }),
      });
      await loadMilestones();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleRevert(subMilestoneId) {
    try {
      await apiFetch(`/milestones/sub/${subMilestoneId}/revert`, { method: "POST" });
      await loadMilestones();
    } catch (err) {
      setError(err.message);
    }
  }

  // ─── Empty state ──────────────────────────────────────────────────
  if (!loading && milestones.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-dashed border-surface-300 p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center mx-auto mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-brand-500" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
          </svg>
        </div>
        <h3 className="font-display text-lg text-surface-800 mb-1">No Milestone Map Yet</h3>
        <p className="text-sm text-surface-500 mb-4 max-w-sm mx-auto">
          Generate a milestone map to track progress across all committees. Milestones are auto-created when the event proposal is approved.
        </p>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="inline-flex items-center gap-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-all disabled:opacity-60"
        >
          {generating ? (
            <>
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
                <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" className="opacity-75" />
              </svg>
              Generating...
            </>
          ) : (
            <>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-4" />
              </svg>
              Generate Milestone Map
            </>
          )}
        </button>
        {error && <p className="text-xs text-red-500 mt-3">{error}</p>}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // ─── Milestone map ────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Header stats bar */}
      {stats && (
        <div className="bg-white rounded-xl border border-surface-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <ProgressRing progress={stats.overallProgress} size={52} strokeWidth={4} />
              <div>
                <p className="text-sm font-medium text-surface-800">
                  Overall Progress
                </p>
                <p className="text-xs text-surface-500">
                  {stats.completedSubMilestones}/{stats.totalSubMilestones} deliverables complete
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {stats.atRisk > 0 && (
                <div className="flex items-center gap-1.5 text-amber-600">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <span className="text-xs font-medium">{stats.atRisk} at risk</span>
                </div>
              )}
              <div className="flex items-center gap-3 text-xs text-surface-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />{stats.completed} done</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500" />{stats.inProgress} active</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-surface-300" />{stats.notStarted} pending</span>
              </div>
              <button
                onClick={handleRegenerate}
                disabled={generating}
                className="text-xs text-surface-400 hover:text-surface-600 transition-colors flex items-center gap-1"
                title="Regenerate milestones"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  className={generating ? "animate-spin" : ""}
                >
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" /><path d="M3 3v5h5" />
                </svg>
                {generating ? "Generating..." : "Regenerate"}
              </button>
            </div>
          </div>

          {/* Full progress bar */}
          <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-500 to-green-500 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${stats.overallProgress}%` }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </div>
      )}

      {/* Milestone cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {milestones.map((m) => (
          <MilestoneCard
            key={m.id}
            milestone={m}
            onUpdate={loadMilestones}
            onDelete={loadMilestones}
            onApprove={handleApprove}
            onRevert={handleRevert}
            userName={userName}
          />
        ))}
      </div>
    </div>
  );
}

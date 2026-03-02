"use client";

import { useState, useEffect, useCallback } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

const STATUS_COLORS = {
  not_started: { bg: "bg-surface-100", text: "text-surface-500", dot: "bg-surface-400", label: "Not Started" },
  in_progress: { bg: "bg-blue-50", text: "text-blue-700", dot: "bg-blue-500", label: "In Progress" },
  completed: { bg: "bg-green-50", text: "text-green-700", dot: "bg-green-500", label: "Completed" },
  verified: { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500", label: "Verified" },
  pending_approval: { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500", label: "Awaiting Approval" },
  at_risk: { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500", label: "At Risk" },
};

export default function CommitteeMilestones({ committeeId, isChair }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [completing, setCompleting] = useState(null); // sub-milestone id being completed

  const fetchMilestones = useCallback(async () => {
    try {
      const res = await fetch(`${API}/milestones/committee/${committeeId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
    } catch (err) {
      console.error("Fetch milestones error:", err);
    } finally {
      setLoading(false);
    }
  }, [committeeId]);

  useEffect(() => {
    fetchMilestones();
  }, [fetchMilestones]);

  async function handleComplete(subId) {
    if (completing) return;
    setCompleting(subId);
    try {
      const res = await fetch(`${API}/milestones/sub/${subId}/complete`, { method: "POST" });
      if (!res.ok) throw new Error("Failed to complete");
      await fetchMilestones();
    } catch (err) {
      alert("Failed to update milestone: " + err.message);
    } finally {
      setCompleting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="w-7 h-7 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.subMilestones?.length === 0) {
    return (
      <div className="bg-surface-50 border border-surface-200 rounded-xl p-8 text-center">
        <div className="text-3xl mb-2">🎯</div>
        <p className="text-sm font-medium text-surface-700">No milestones assigned yet</p>
        <p className="text-xs text-surface-500 mt-1">
          Milestones will appear here once your proposal is approved and the director generates the milestone map.
        </p>
      </div>
    );
  }

  const { subMilestones, stats } = data;

  // Group by parent milestone
  const grouped = subMilestones.reduce((acc, sub) => {
    const parentId = sub.milestone?.id || "unknown";
    if (!acc[parentId]) {
      acc[parentId] = {
        milestone: sub.milestone,
        subs: [],
      };
    }
    acc[parentId].subs.push(sub);
    return acc;
  }, {});

  const phases = Object.values(grouped).sort(
    (a, b) => (a.milestone?.phase || 0) - (b.milestone?.phase || 0)
  );

  function isOverdue(sub) {
    if (sub.status === "completed" || sub.status === "verified") return false;
    const parent = sub.milestone;
    if (!parent?.targetDate) return false;
    return new Date(parent.targetDate) < new Date();
  }

  return (
    <div className="space-y-6">
      {/* Progress Header */}
      <div className="bg-white rounded-xl border border-surface-200 p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display text-lg text-surface-900">Your Milestones</h3>
            <p className="text-xs text-surface-500 mt-0.5">
              {stats.completed} of {stats.total} completed
              {stats.pendingApproval > 0 && (
                <span className="text-amber-600 ml-2">
                  · {stats.pendingApproval} awaiting director approval
                </span>
              )}
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl font-bold text-brand-600">{stats.progress}%</span>
          </div>
        </div>
        <div className="w-full h-3 bg-surface-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{
              width: `${stats.progress}%`,
              background: stats.progress === 100
                ? "linear-gradient(90deg, #10b981, #059669)"
                : "linear-gradient(90deg, #6366f1, #8b5cf6)",
            }}
          />
        </div>
        {/* Quick stats row */}
        <div className="flex gap-4 mt-3">
          {[
            { label: "Not Started", count: subMilestones.filter(s => s.status === "not_started").length, color: "text-surface-500" },
            { label: "In Progress", count: subMilestones.filter(s => s.status === "in_progress").length, color: "text-blue-600" },
            { label: "Completed", count: subMilestones.filter(s => s.status === "completed" || s.status === "verified").length, color: "text-green-600" },
            { label: "Awaiting Approval", count: stats.pendingApproval, color: "text-amber-600" },
          ].filter(s => s.count > 0).map(s => (
            <span key={s.label} className={`text-xs ${s.color}`}>
              {s.count} {s.label}
            </span>
          ))}
        </div>
      </div>

      {/* Phases / Grouped Milestones */}
      {phases.map(({ milestone: parent, subs }) => (
        <div key={parent?.id || "unknown"} className="bg-white rounded-xl border border-surface-200 overflow-hidden">
          {/* Phase Header */}
          <div className="px-5 py-4 border-b border-surface-100 bg-surface-50/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-brand-500 bg-brand-50 px-2.5 py-1 rounded-full">
                  Phase {parent?.phase || "?"}
                </span>
                <h4 className="text-sm font-semibold text-surface-900">{parent?.title || "Milestone"}</h4>
              </div>
              {parent?.targetDate && (
                <span className={`text-xs px-2.5 py-1 rounded-full ${
                  new Date(parent.targetDate) < new Date()
                    ? "bg-red-50 text-red-600 font-medium"
                    : "text-surface-400"
                }`}>
                  {new Date(parent.targetDate) < new Date() ? "⚠ " : "📅 "}
                  {new Date(parent.targetDate).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>

          {/* Sub-milestones Checklist */}
          <div className="divide-y divide-surface-50">
            {subs.map((sub) => {
              const done = sub.status === "completed" || sub.status === "verified";
              const pending = sub.status === "pending_approval";
              const overdue = isOverdue(sub);
              const colors = STATUS_COLORS[sub.status] || STATUS_COLORS.not_started;
              const canComplete = isChair && !done && !pending && sub.status !== "at_risk";

              return (
                <div
                  key={sub.id}
                  className={`flex items-start gap-3 px-5 py-4 transition-colors ${
                    overdue ? "bg-red-50/30" : done ? "bg-green-50/20" : "hover:bg-surface-50/50"
                  }`}
                >
                  {/* Checkbox / Status Icon */}
                  <div className="pt-0.5 flex-shrink-0">
                    {done ? (
                      <div className="w-5 h-5 rounded-md bg-green-500 flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    ) : pending ? (
                      <div className="w-5 h-5 rounded-md bg-amber-400 flex items-center justify-center">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                      </div>
                    ) : canComplete ? (
                      <button
                        onClick={() => handleComplete(sub.id)}
                        disabled={completing === sub.id}
                        className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${
                          completing === sub.id
                            ? "border-brand-300 bg-brand-50"
                            : "border-surface-300 hover:border-brand-400 hover:bg-brand-50"
                        }`}
                        title={sub.requiresApproval ? "Mark complete (requires director approval)" : "Mark complete"}
                      >
                        {completing === sub.id && (
                          <div className="w-3 h-3 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                        )}
                      </button>
                    ) : (
                      <div className={`w-5 h-5 rounded-md border-2 border-surface-200 ${overdue ? "border-red-300" : ""}`} />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-medium ${done ? "text-surface-400 line-through" : "text-surface-900"}`}>
                        {sub.title}
                      </p>
                      {sub.requiresApproval && !done && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-medium flex-shrink-0">
                          Requires Approval
                        </span>
                      )}
                      {overdue && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 font-medium flex-shrink-0">
                          Overdue
                        </span>
                      )}
                    </div>
                    {sub.description && (
                      <p className={`text-xs mt-1 ${done ? "text-surface-300" : "text-surface-500"}`}>
                        {sub.description}
                      </p>
                    )}
                    {/* Status + completion info */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                        {colors.label}
                      </span>
                      {sub.completedAt && (
                        <span className="text-[10px] text-surface-400">
                          Completed {new Date(sub.completedAt).toLocaleDateString()}
                        </span>
                      )}
                      {sub.approvedBy && (
                        <span className="text-[10px] text-green-500">
                          · Approved by {sub.approvedBy}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Info note for chairs */}
      {isChair && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3 flex items-start gap-2.5">
          <span className="text-blue-400 mt-0.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </span>
          <div>
            <p className="text-xs text-blue-800 font-medium">How milestones work</p>
            <p className="text-xs text-blue-600 mt-0.5">
              Check off milestones as your team completes them. Items marked "Requires Approval" will be sent to the Program Director for verification before being marked complete.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

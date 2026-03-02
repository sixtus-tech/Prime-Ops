"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "../../../lib/api";
import ProposalPreview from "../../../components/ProposalPreview";

const STATUS_COLORS = {
  pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  under_review: "bg-blue-100 text-blue-700 border-blue-200",
  approved: "bg-green-100 text-green-700 border-green-200",
  rejected: "bg-red-100 text-red-600 border-red-200",
  revision_requested: "bg-orange-100 text-orange-700 border-orange-200",
};

const PRIORITY_COLORS = {
  low: "text-surface-500",
  normal: "text-blue-600",
  high: "text-orange-600",
  urgent: "text-red-600",
};

const ACTION_ICONS = {
  submitted: "📤",
  approved: "✅",
  rejected: "❌",
  commented: "💬",
  revision_requested: "🔁",
  under_review: "🔍",
  reassigned: "🔀",
};

const ACTION_COLORS = {
  submitted: "bg-surface-200",
  approved: "bg-green-500",
  rejected: "bg-red-500",
  commented: "bg-blue-400",
  revision_requested: "bg-orange-400",
  under_review: "bg-blue-500",
  reassigned: "bg-purple-400",
};

export default function ApprovalDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [approval, setApproval] = useState(null);
  const [proposal, setProposal] = useState(null);
  const [showProposal, setShowProposal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionForm, setActionForm] = useState({
    performedBy: "",
    comment: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const loadApproval = useCallback(async () => {
    try {
      const data = await api.getApproval(id);
      setApproval(data.approval);
      // Parse linked proposal if available
      if (data.proposal?.proposalJson) {
        try {
          const parsed = typeof data.proposal.proposalJson === "string"
            ? JSON.parse(data.proposal.proposalJson)
            : data.proposal.proposalJson;
          setProposal({ ...parsed, _meta: data.proposal });
        } catch { setProposal(null); }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadApproval();
  }, [loadApproval]);

  async function performAction(action) {
    if (!actionForm.performedBy.trim()) {
      alert("Please enter your name.");
      return;
    }
    // Require comment for rejections and revision requests
    if ((action === "rejected" || action === "revision_requested") && !actionForm.comment.trim()) {
      alert("Please provide a reason.");
      return;
    }

    setSubmitting(true);
    try {
      const data = await api.approvalAction(id, {
        action,
        performedBy: actionForm.performedBy.trim(),
        comment: actionForm.comment.trim() || null,
      });
      setApproval(data.approval);
      setActionForm((f) => ({ ...f, comment: "" }));
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-surface-400">
        Loading...
      </div>
    );
  }

  if (!approval) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-surface-700 font-medium">Approval request not found</p>
          <button onClick={() => router.push("/approvals")} className="text-brand-500 text-sm mt-2">
            ← Back to approvals
          </button>
        </div>
      </div>
    );
  }

  const isTerminal = ["approved", "rejected"].includes(approval.status);

  return (
    <main className="min-h-screen">
      {/* Header */}
      <div className="bg-brand-600 text-white px-6 lg:px-10 py-8">
        <button
          onClick={() => router.push("/approvals")}
          className="flex items-center gap-1 text-surface-400 hover:text-white text-sm mb-4 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          All Approvals
        </button>

        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-display text-2xl sm:text-3xl">{approval.title}</h1>
              <span className={`px-3 py-1 rounded-full text-xs font-medium capitalize border ${STATUS_COLORS[approval.status]}`}>
                {approval.status.replace("_", " ")}
              </span>
            </div>
            {approval.event && (
              <Link
                href={`/events/${approval.event.id}`}
                className="text-surface-400 hover:text-brand-400 text-sm transition-colors"
              >
                📅 {approval.event.title} →
              </Link>
            )}
          </div>
        </div>

        {/* Meta bar */}
        <div className="flex flex-wrap gap-6 mt-5 pt-4 border-t border-white/20 text-sm">
          <div>
            <p className="text-white/60 text-xs">Requested By</p>
            <p className="text-white">{approval.requestedBy}</p>
          </div>
          <div>
            <p className="text-white/60 text-xs">Priority</p>
            <p className={`font-medium capitalize ${PRIORITY_COLORS[approval.priority]}`}>
              {approval.priority}
            </p>
          </div>
          <div>
            <p className="text-white/60 text-xs">Submitted</p>
            <p className="text-white">{new Date(approval.createdAt).toLocaleDateString()}</p>
          </div>
          {approval.dueDate && (
            <div>
              <p className="text-white/60 text-xs">Due Date</p>
              <p className={new Date(approval.dueDate) < new Date() ? "text-red-400 font-medium" : "text-white"}>
                {new Date(approval.dueDate).toLocaleDateString()}
              </p>
            </div>
          )}
          {approval.event?.estimatedBudget && (
            <div>
              <p className="text-white/60 text-xs">Event Budget</p>
              <p className="text-white">{approval.event.estimatedBudget}</p>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 lg:px-10 py-8 max-w-4xl">
        {/* Description */}
        {approval.description && (
          <div className="bg-white rounded-xl border border-surface-200 p-6 mb-6">
            <h3 className="text-sm font-medium text-surface-500 uppercase tracking-wide mb-2">Description</h3>
            <p className="text-surface-700 leading-relaxed">{approval.description}</p>
          </div>
        )}

        {/* ─── Proposal Preview ─── */}
        {proposal && (
          <div className="mb-6">
            <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
              {/* Toggle header */}
              <button
                onClick={() => setShowProposal(!showProposal)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-surface-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-brand-50 flex items-center justify-center">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A8CFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <h3 className="font-display text-base text-surface-900">
                      {proposal.title || "Committee Proposal"}
                    </h3>
                    <p className="text-xs text-surface-400 mt-0.5">
                      {proposal._meta?.committee?.name ? `${proposal._meta.committee.name} · ` : ""}
                      Submitted by {proposal._meta?.submittedBy || approval.requestedBy}
                      {proposal._meta?.createdAt ? ` · ${new Date(proposal._meta.createdAt).toLocaleDateString()}` : ""}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {proposal._meta?.id && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
                        window.open(`${API}/proposal/${proposal._meta.id}/pdf`, "_blank");
                      }}
                      className="text-xs text-red-500 hover:text-red-600 font-medium px-2 py-1 rounded-lg hover:bg-red-50 transition-colors cursor-pointer flex items-center gap-1"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                      PDF
                    </span>
                  )}
                  <span className="text-sm text-brand-500 font-medium">
                    {showProposal ? "Hide" : "View Proposal"}
                  </span>
                  <svg
                    width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                    className={`text-surface-400 transition-transform duration-200 ${showProposal ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </button>

              {/* Proposal content */}
              {showProposal && (
                <div className="border-t border-surface-100 px-6 py-6">
                  <ProposalPreview proposal={proposal} />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── Action Timeline ─── */}
        <div className="mb-8">
          <h3 className="font-display text-lg text-surface-900 mb-4">Approval History</h3>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[15px] top-4 bottom-4 w-0.5 bg-surface-200" />

            <div className="space-y-4">
              {approval.actions?.map((action, i) => (
                <div key={action.id} className="relative pl-10 animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  {/* Dot */}
                  <div className={`absolute left-[7px] top-1.5 w-[17px] h-[17px] rounded-full border-2 border-white shadow-sm flex items-center justify-center ${ACTION_COLORS[action.action] || "bg-surface-300"}`}>
                    <span className="text-[8px]">{ACTION_ICONS[action.action] ? "" : ""}</span>
                  </div>

                  <div className="bg-white rounded-xl border border-surface-200 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-base">{ACTION_ICONS[action.action] || "📌"}</span>
                      <span className="text-sm font-medium text-surface-800 capitalize">
                        {action.action.replace("_", " ")}
                      </span>
                      <span className="text-xs text-surface-400">
                        by {action.performedBy}
                      </span>
                      <span className="text-xs text-surface-300 ml-auto">
                        {new Date(action.createdAt).toLocaleString()}
                      </span>
                    </div>
                    {action.comment && (
                      <p className="text-sm text-surface-600 mt-1 pl-7">{action.comment}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ─── Action Panel ─── */}
        {!isTerminal && (
          <div className="bg-white rounded-xl border-2 border-brand-200 p-6">
            <h3 className="font-display text-lg text-surface-900 mb-4">Take Action</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">Your Name *</label>
                <input
                  value={actionForm.performedBy}
                  onChange={(e) => setActionForm((f) => ({ ...f, performedBy: e.target.value }))}
                  placeholder="Enter your name"
                  className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-surface-500 mb-1">
                  Comment {["rejected", "revision_requested"].includes(approval.status) ? "*" : "(optional)"}
                </label>
                <textarea
                  value={actionForm.comment}
                  onChange={(e) => setActionForm((f) => ({ ...f, comment: e.target.value }))}
                  placeholder="Add a note or reason..."
                  rows={3}
                  className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 resize-none"
                />
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  onClick={() => performAction("approved")}
                  disabled={submitting}
                  className="bg-green-500 hover:bg-green-600 disabled:bg-green-300 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                  Approve
                </button>

                <button
                  onClick={() => performAction("rejected")}
                  disabled={submitting}
                  className="bg-red-500 hover:bg-red-600 disabled:bg-red-300 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/>
                  </svg>
                  Reject
                </button>

                <button
                  onClick={() => performAction("revision_requested")}
                  disabled={submitting}
                  className="bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                >
                  🔁 Request Revision
                </button>

                {approval.status === "pending" && (
                  <button
                    onClick={() => performAction("under_review")}
                    disabled={submitting}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-blue-300 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                  >
                    🔍 Mark Under Review
                  </button>
                )}

                <button
                  onClick={() => performAction("commented")}
                  disabled={submitting || !actionForm.comment.trim()}
                  className="border border-surface-300 text-surface-700 hover:bg-surface-50 disabled:text-surface-300 disabled:border-surface-200 px-5 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center gap-2"
                >
                  💬 Comment Only
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Terminal state banner */}
        {isTerminal && (
          <div className={`rounded-xl border-2 p-6 text-center ${
            approval.status === "approved"
              ? "bg-green-50 border-green-200"
              : "bg-red-50 border-red-200"
          }`}>
            <span className="text-3xl">{approval.status === "approved" ? "✅" : "❌"}</span>
            <p className={`text-lg font-display mt-2 ${
              approval.status === "approved" ? "text-green-700" : "text-red-700"
            }`}>
              This request has been {approval.status}
            </p>
            <p className="text-sm text-surface-500 mt-1">
              {approval.actions?.[approval.actions.length - 1]?.comment || "No additional notes."}
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

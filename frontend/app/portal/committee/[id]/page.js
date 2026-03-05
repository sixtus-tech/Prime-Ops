"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "../../../../lib/auth";
import { api } from "../../../../lib/api";
import ChatMode from "../../../../components/ChatMode";
import ProposalPreview from "../../../../components/ProposalPreview";
import ProposalEditor from "../../../../components/ProposalEditor";
import DocumentUpload from "../../../../components/DocumentUpload";
import TasksPanel from "../../../../components/TasksPanel";
import StatusUpdateForm from "../../../../components/StatusUpdateForm";
import StatusUpdateTimeline from "../../../../components/StatusUpdateTimeline";
import CommitteeMilestones from "../../../../components/CommitteeMilestones";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

// ─── Proposal Status Badges ──────────────────────────────────────────
const statusStyle = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  revision_requested: "bg-orange-100 text-orange-700",
};

const STATUS_LABELS = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Not Approved",
  revision_requested: "Revision Requested",
  under_review: "Under Review",
  commented: "Commented",
};

// ─── Director Feedback Sub-component ─────────────────────────────────
function DirectorFeedback({ proposalId, authFetch }) {
  const [feedback, setFeedback] = useState(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!proposalId) return;
    authFetch(`/portal/proposals/${proposalId}`)
      .then((data) => {
        if (data.approval?.actions?.length > 0) {
          const directorActions = data.approval.actions.filter(
            (a) => a.action !== "submitted"
          );
          setFeedback(directorActions);
        }
      })
      .catch(console.error)
      .finally(() => setLoaded(true));
  }, [proposalId, authFetch]);

  if (!loaded || !feedback?.length) return null;

  const actionColors = {
    revision_requested: { bg: "bg-orange-50", border: "border-orange-100", text: "text-orange-800", icon: "🔄" },
    rejected: { bg: "bg-red-50", border: "border-red-100", text: "text-red-800", icon: "❌" },
    approved: { bg: "bg-green-50", border: "border-green-100", text: "text-green-800", icon: "✅" },
    commented: { bg: "bg-blue-50", border: "border-blue-100", text: "text-blue-800", icon: "💬" },
    under_review: { bg: "bg-purple-50", border: "border-purple-100", text: "text-purple-800", icon: "👀" },
  };

  return (
    <div className="px-4 py-3 space-y-2 border-b border-surface-100 bg-surface-50/50">
      <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">Director Feedback</p>
      {feedback.map((a) => {
        const colors = actionColors[a.action] || actionColors.commented;
        return (
          <div key={a.id} className={`${colors.bg} ${colors.border} border rounded-lg px-3 py-2`}>
            <div className="flex items-center gap-2 mb-1">
              <span>{colors.icon}</span>
              <span className={`text-xs font-medium ${colors.text}`}>
                {STATUS_LABELS[a.action] || a.action.replace("_", " ")} by {a.performedBy}
              </span>
              <span className="text-[10px] text-surface-400 ml-auto">
                {new Date(a.createdAt).toLocaleString()}
              </span>
            </div>
            {a.comment && (
              <p className={`text-sm ${colors.text} ml-6`}>&ldquo;{a.comment}&rdquo;</p>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Member Comment Form ─────────────────────────────────────────────
function MemberCommentForm({ proposalId, committeeId, authFetch, onCommented }) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!comment.trim() || submitting) return;
    setSubmitting(true);
    try {
      await authFetch(`/portal/committee/${committeeId}/proposals/${proposalId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: comment.trim() }),
      });
      setComment("");
      if (onCommented) onCommented();
    } catch (err) {
      alert("Failed to submit comment: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="px-5 py-4 border-t border-surface-100 bg-surface-50/30">
      <label className="block text-xs font-medium text-surface-500 mb-1.5">
        Add a comment or suggestion
      </label>
      <div className="flex gap-2">
        <input
          type="text"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share a suggestion, concern, or idea about this workplan..."
          className="flex-1 rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
        />
        <button
          type="submit"
          disabled={!comment.trim() || submitting}
          className="bg-brand-500 hover:bg-brand-600 disabled:bg-surface-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-all flex-shrink-0"
        >
          {submitting ? "..." : "Comment"}
        </button>
      </div>
    </form>
  );
}

// ─── Proposal Comments Display ───────────────────────────────────────
function ProposalComments({ proposalId, committeeId, authFetch, refreshKey }) {
  const [comments, setComments] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!proposalId || !committeeId) return;
    authFetch(`/portal/committee/${committeeId}/proposals/${proposalId}/comments`)
      .then((data) => setComments(data.comments || []))
      .catch(() => setComments([]))
      .finally(() => setLoaded(true));
  }, [proposalId, committeeId, authFetch, refreshKey]);

  if (!loaded || comments.length === 0) return null;

  return (
    <div className="px-5 py-3 border-t border-surface-100 bg-surface-50/30 space-y-2">
      <p className="text-xs font-medium text-surface-500 uppercase tracking-wider">
        Member Comments ({comments.length})
      </p>
      {comments.map((c) => (
        <div key={c.id} className="flex items-start gap-2">
          <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="text-[10px] font-medium text-brand-600">
              {(c.authorName || "?").charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-surface-700">{c.authorName}</span>
              <span className="text-[10px] text-surface-400">{c.authorRole}</span>
              <span className="text-[10px] text-surface-300 ml-auto">
                {new Date(c.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="text-sm text-surface-600 mt-0.5">{c.content}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
export default function CommitteeDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { authFetch, user, token } = useAuth();

  const [committee, setCommittee] = useState(null);
  const [memberRole, setMemberRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Proposal generation state
  const [genMode, setGenMode] = useState("text");
  const [description, setDescription] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedProposal, setGeneratedProposal] = useState(null);
  const [savedProposalId, setSavedProposalId] = useState(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingProposal, setEditingProposal] = useState(false);

  // Member form state
  const [memberForm, setMemberForm] = useState({ name: "", email: "", phone: "", role: "member", kcUsername: "" });
  const [addingMember, setAddingMember] = useState(false);

  // KingsChat lookup state
  const [kcLookup, setKcLookup] = useState({ loading: false, result: null, error: null });
  const [kcSelected, setKcSelected] = useState(false);
  const kcLookupTimeout = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [expandedProposal, setExpandedProposal] = useState(null);
  const [timelineKey, setTimelineKey] = useState(0);
  const [commentRefreshKey, setCommentRefreshKey] = useState(0);

  const fetchCommittee = useCallback(async () => {
    try {
      const data = await authFetch(`/portal/committee/${id}`);
      setCommittee(data.committee);
      setMemberRole(data.memberRole);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [authFetch, id]);

  useEffect(() => {
    fetchCommittee();
  }, [fetchCommittee]);

  // Reset create form when switching away from proposal tab
  useEffect(() => {
    if (activeTab !== "proposal") {
      setShowCreateForm(false);
      setEditingProposal(false);
    }
  }, [activeTab]);

  // ── Role helpers ───────────────────────────────────────────────────
  
  const isChair = memberRole === "chair" || memberRole === "co-chair" || memberRole === "head";
  const isMember = !isChair;
  const roleLabel = memberRole === "chair" ? "Team Lead" : memberRole === "co-chair" ? "Co-Team Lead" : "Team Member";

  // ── Build committee context for AI generation ──────────────────
  function buildCommitteeContext() {
    return {
      committeeName: committee.name,
      responsibilities: committee.responsibilities?.map((r) => r.text) || [],
      eventTitle: committee.event?.title,
      eventType: committee.event?.eventType || "general",
      eventDates: committee.event?.startDate
        ? `${new Date(committee.event.startDate).toLocaleDateString()}${committee.event?.endDate ? ` — ${new Date(committee.event.endDate).toLocaleDateString()}` : ""}`
        : null,
      venue: committee.event?.venue || null,
      estimatedBudget: committee.event?.estimatedBudget || null,
      estimatedAttendance: committee.event?.estimatedAttendance || null,
      eventDescription: committee.event?.description || null,
    };
  }

  // ── Generate proposal from text ─────────────────────────────────
  async function handleTextGenerate(e) {
    e.preventDefault();
    if (description.trim().length < 10 || generating) return;
    setGenerating(true);

    try {
      const genRes = await fetch(`${API}/proposal/generate-committee`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: description.trim(),
          committeeContext: buildCommitteeContext(),
        }),
      });

      const genData = await genRes.json();
      if (!genRes.ok) throw new Error(genData.error);

      const saveData = await authFetch(`/portal/committee/${id}/proposal`, {
        method: "POST",
        body: JSON.stringify({
          inputText: description,
          inputType: "text",
          proposalJson: genData.proposal,
        }),
      });

      setGeneratedProposal(genData.proposal);
      setSavedProposalId(saveData.proposal.id);
      setShowCreateForm(false);
      setEditingProposal(false);
      fetchCommittee();
    } catch (err) {
      alert("Failed to generate workplan: " + err.message);
    } finally {
      setGenerating(false);
    }
  }

  // ── Handle chat proposal ready ──────────────────────────────────
  async function handleChatProposalReady(proposal, _proposalId, summary) {
    try {
      const saveData = await authFetch(`/portal/committee/${id}/proposal`, {
        method: "POST",
        body: JSON.stringify({
          inputText: summary,
          inputType: "chat",
          proposalJson: proposal,
        }),
      });

      setGeneratedProposal(proposal);
      setSavedProposalId(saveData.proposal.id);
      setShowCreateForm(false);
      setEditingProposal(false);
      fetchCommittee();
    } catch (err) {
      alert("Failed to save workplan: " + err.message);
    }
  }

  // ── Submit proposal for director review ─────────────────────────
  async function handleSubmit(proposalId) {
    if (!confirm("Submit this workplan to the Project Director for review?")) return;
    setSubmitting(true);
    try {
      await authFetch(`/portal/committee/${id}/submit`, {
        method: "POST",
        body: JSON.stringify({ proposalId }),
      });
      alert("Workplan submitted for review!");
      setSavedProposalId(null);
      setGeneratedProposal(null);
      setEditingProposal(false);
      fetchCommittee();
    } catch (err) {
      alert("Failed to submit: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // ── Save edited proposal to backend ─────────────────────────────
  async function handleSaveEdit(updated) {
    setGeneratedProposal(updated);
    setEditingProposal(false);
    if (savedProposalId) {
      try {
        await authFetch(`/portal/committee/${id}/proposals/${savedProposalId}`, {
          method: "PATCH",
          body: JSON.stringify({ proposalJson: updated }),
        });
        fetchCommittee();
      } catch (err) {
        console.error("Failed to save edit:", err);
        alert("Edit saved locally but failed to sync to server. Try again.");
      }
    }
  }

  // ── Download proposal as PDF ────────────────────────────────────
  function handleDownloadPDF(proposalId) {
    const url = `${API}/proposal/${proposalId}/pdf`;
    window.open(url, "_blank");
  }

  // ── KingsChat username lookup (debounced) ───────────────────────
  function handleKcUsernameChange(value) {
    setMemberForm((f) => ({ ...f, kcUsername: value }));
    setKcLookup({ loading: false, result: null, error: null });
    setKcSelected(false);

    if (kcLookupTimeout.current) clearTimeout(kcLookupTimeout.current);

    const cleaned = value.trim().replace(/^@/, "");
    if (!cleaned || cleaned.length < 2) return;

    kcLookupTimeout.current = setTimeout(async () => {
      setKcLookup({ loading: true, result: null, error: null });
      try {
        const data = await api.lookupKcUser(cleaned);
        if (data.found) {
          setKcLookup({ loading: false, result: data.profile, error: null });
        } else {
          setKcLookup({ loading: false, result: null, error: data.message || "Not found" });
        }
      } catch (err) {
        setKcLookup({ loading: false, result: null, error: err.message });
      }
    }, 600);
  }

  function handleSelectKcUser(profile) {
    setKcSelected(true);
    setMemberForm((f) => ({
      ...f,
      name: f.name || profile.name || "",
      kcUsername: profile.username || f.kcUsername,
    }));
  }

  function handleClearKcUser() {
    setKcSelected(false);
    setKcLookup({ loading: false, result: null, error: null });
    setMemberForm((f) => ({ ...f, kcUsername: "", name: "" }));
  }

  // ── Add member ──────────────────────────────────────────────────
  async function handleAddMember(e) {
    e.preventDefault();
    if (!memberForm.name.trim()) return;
    setAddingMember(true);
    try {
      await authFetch(`/portal/committee/${id}/members`, {
        method: "POST",
        body: JSON.stringify({
          name: memberForm.name,
          email: memberForm.email,
          phone: memberForm.phone,
          role: memberForm.role,
          kcUsername: memberForm.kcUsername.trim().replace(/^@/, "") || undefined,
          kcId: kcLookup.result?.kcId || undefined,
        }),
      });
      setMemberForm({ name: "", email: "", phone: "", role: "member", kcUsername: "" });
      setKcLookup({ loading: false, result: null, error: null });
      setKcSelected(false);
      fetchCommittee();
    } catch (err) {
      alert("Failed to add member: " + err.message);
    } finally {
      setAddingMember(false);
    }
  }

  // ── Remove member ───────────────────────────────────────────────
  async function handleRemoveMember(memberId, memberName) {
    if (!confirm(`Remove ${memberName} from this committee?`)) return;
    try {
      await authFetch(`/portal/committee/${id}/members/${memberId}`, { method: "DELETE" });
      fetchCommittee();
    } catch (err) {
      alert("Failed to remove member: " + err.message);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen">
        <div className="bg-brand-600 text-white px-6 lg:px-10 py-10">
          <h1 className="font-display text-3xl">Loading...</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  if (!committee) {
    return (
      <main className="min-h-screen">
        <div className="bg-brand-600 text-white px-6 lg:px-10 py-10">
          <h1 className="font-display text-3xl">Committee not found</h1>
        </div>
      </main>
    );
  }

  const hasProposals = committee.proposals?.length > 0;

  return (
    <main className="min-h-screen">
      {/* Header */}
      <div className="bg-brand-600 text-white px-6 lg:px-10 py-10">
        <button
          onClick={() => router.push("/portal")}
          className="flex items-center gap-1 text-surface-400 hover:text-white text-sm mb-3 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          My Committees
        </button>
        <div className="flex items-center gap-3">
          <h1 className="font-display text-2xl sm:text-3xl">{committee.name}</h1>
          <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${
            isChair ? "bg-white/20 text-white" : "bg-white/10 text-white/80"
          }`}>
            {roleLabel}
          </span>
        </div>
        <p className="text-surface-400 mt-1">
          {committee.event?.title}
          {committee.proposalDeadline && (
            <span className="ml-3 text-sm">
              📅 Due Date: {new Date(committee.proposalDeadline).toLocaleDateString()}
            </span>
          )}
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">

        {/* Member info banner */}
        {isMember && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-6 flex items-center gap-2">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-400 flex-shrink-0">
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
            <p className="text-xs text-blue-700">
              You&apos;re viewing as a <strong>team member</strong>. You can view proposals, milestones, and updates, and leave comments on proposals. Committee heads manage submissions and milestones.
            </p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-surface-100 rounded-xl p-1 mb-6 overflow-x-auto">
          {[
            { id: "overview", label: "Overview" },
            { id: "proposal", label: hasProposals ? `Workplans (${committee.proposals.length})` : (isChair ? "Create Workplan" : "Workplans") },
            { id: "updates", label: "Updates" },
            { id: "milestones", label: "Milestones" },
            { id: "tasks", label: "Tasks & Due Dates" },
            { id: "members", label: `Members (${committee.members?.length || 0})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-fit whitespace-nowrap py-2.5 px-3 rounded-lg text-xs sm:text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? "bg-white text-surface-900 shadow-sm"
                  : "text-surface-500 hover:text-surface-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ═══ OVERVIEW TAB ═══ */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            <div className="bg-white rounded-xl border border-surface-200 p-6">
              <h3 className="font-display text-lg text-surface-900 mb-3">Event Details</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div><span className="text-surface-500">Event:</span> <span className="text-surface-900 font-medium">{committee.event?.title}</span></div>
                <div><span className="text-surface-500">Type:</span> <span className="text-surface-900">{committee.event?.eventType}</span></div>
                {committee.event?.startDate && <div><span className="text-surface-500">Start:</span> <span className="text-surface-900">{new Date(committee.event.startDate).toLocaleDateString()}</span></div>}
                {committee.event?.endDate && <div><span className="text-surface-500">End:</span> <span className="text-surface-900">{new Date(committee.event.endDate).toLocaleDateString()}</span></div>}
                {committee.event?.venue && <div><span className="text-surface-500">Venue:</span> <span className="text-surface-900">{committee.event.venue}</span></div>}
                {committee.event?.estimatedBudget && <div><span className="text-surface-500">Budget:</span> <span className="text-surface-900">{committee.event.estimatedBudget}</span></div>}
              </div>
            </div>

            {committee.responsibilities?.length > 0 && (
              <div className="bg-white rounded-xl border border-surface-200 p-6">
                <h3 className="font-display text-lg text-surface-900 mb-3">Your Responsibilities</h3>
                <div className="space-y-2">
                  {committee.responsibilities.map((r) => (
                    <div key={r.id} className="flex items-start gap-2 text-sm">
                      <span className="text-brand-500 mt-0.5">✓</span>
                      <span className="text-surface-700">{r.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-surface-200 p-6">
              <h3 className="font-display text-lg text-surface-900 mb-3">Workplans</h3>
              {!hasProposals ? (
                <div className="text-center py-8">
                  <p className="text-surface-500 text-sm mb-3">No workplans created yet.</p>
                  {isChair && (
                    <button
                      onClick={() => setActiveTab("proposal")}
                      className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all"
                    >
                      Create Your First Workplan
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {committee.proposals.map((p) => {
                    let parsed = null;
                    try { parsed = JSON.parse(p.proposalJson); } catch {}
                    const isExpanded = expandedProposal === p.id;
                    return (
                      <div key={p.id} className="rounded-lg border border-surface-100 hover:border-surface-200 transition-all overflow-hidden">
                        <div
                          className="flex items-center justify-between p-4 cursor-pointer"
                          onClick={() => setExpandedProposal(isExpanded ? null : p.id)}
                        >
                          <div className="flex items-center gap-3">
                            <svg
                              width="16" height="16" viewBox="0 0 24 24" fill="none"
                              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                              className={`text-surface-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                            >
                              <polyline points="9 18 15 12 9 6"/>
                            </svg>
                            <div>
                              <p className="text-sm font-medium text-surface-900">{parsed?.title || "Untitled Workplan"}</p>
                              <p className="text-xs text-surface-400 mt-0.5">
                                Created {new Date(p.createdAt).toLocaleDateString()} via {p.inputType}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${statusStyle[p.status] || "bg-gray-100"}`}>
                              {STATUS_LABELS[p.status] || p.status.replace("_", " ")}
                            </span>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDownloadPDF(p.id); }}
                              className="text-xs text-surface-400 hover:text-brand-500 px-2 py-1.5 rounded-lg border border-surface-100 hover:border-brand-200 transition-all"
                              title="Download PDF"
                            >
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" x2="12" y1="15" y2="3"/>
                              </svg>
                            </button>
                            {p.status === "draft" && isChair && (
                              <button
                                onClick={(e) => { e.stopPropagation(); handleSubmit(p.id); }}
                                disabled={submitting}
                                className="text-xs bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg transition-all"
                              >
                                Submit
                              </button>
                            )}
                            {p.status === "revision_requested" && isChair && (
                              <button
                                onClick={(e) => { e.stopPropagation(); setActiveTab("proposal"); setShowCreateForm(true); }}
                                className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg transition-all"
                              >
                                Revise
                              </button>
                            )}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-surface-100">
                            {(p.status === "revision_requested" || p.status === "rejected") && (
                              <DirectorFeedback proposalId={p.id} authFetch={authFetch} />
                            )}
                            {p.status === "approved" && (
                              <div className="bg-green-50 px-4 py-3 border-b border-green-100 flex items-center gap-2">
                                <span className="text-green-600">✅</span>
                                <span className="text-sm font-medium text-green-800">Approved by Project Director</span>
                              </div>
                            )}
                            <div className="p-5 max-h-[500px] overflow-y-auto">
                              {parsed ? (
                                <ProposalPreview proposal={parsed} compact />
                              ) : (
                                <p className="text-sm text-surface-500">Unable to display proposal.</p>
                              )}
                            </div>
                            {/* Member comments */}
                            <ProposalComments
                              proposalId={p.id}
                              committeeId={committee.id}
                              authFetch={authFetch}
                              refreshKey={commentRefreshKey}
                            />
                            {/* Comment form for members */}
                            {isMember && (
                              <MemberCommentForm
                                proposalId={p.id}
                                committeeId={committee.id}
                                authFetch={authFetch}
                                onCommented={() => setCommentRefreshKey((k) => k + 1)}
                              />
                            )}
                            {/* Action buttons — chair only */}
                            {(p.status === "draft" || p.status === "revision_requested") && isChair && (
                              <div className="px-5 py-4 border-t border-surface-100 bg-surface-50/50 flex items-center gap-3">
                                {p.status === "draft" && (
                                  <button
                                    onClick={() => handleSubmit(p.id)}
                                    disabled={submitting}
                                    className="bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-all flex items-center gap-2"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <line x1="22" x2="11" y1="2" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                                    </svg>
                                    {submitting ? "Submitting..." : "Submit to Project Director"}
                                  </button>
                                )}
                                {p.status === "revision_requested" && (
                                  <button
                                    onClick={() => { setActiveTab("proposal"); setShowCreateForm(true); }}
                                    className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-all flex items-center gap-2"
                                  >
                                    Create Revision
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDownloadPDF(p.id)}
                                  className="text-sm text-surface-500 hover:text-brand-500 px-4 py-2.5 rounded-lg border border-surface-200 hover:border-brand-200 transition-all flex items-center gap-2"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/>
                                  </svg>
                                  Download PDF
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ═══ PROPOSAL TAB ═══ */}
        {activeTab === "proposal" && (
          <div className="space-y-6">

            {/* ── Member view: read-only proposals + comment ── */}
            {isMember && (
              <>
                {!hasProposals ? (
                  <div className="bg-surface-50 border border-surface-200 rounded-xl p-8 text-center">
                    <div className="text-3xl mb-2">📝</div>
                    <p className="text-sm font-medium text-surface-700">No workplans yet</p>
                    <p className="text-xs text-surface-500 mt-1">Your committee head will create and submit proposals. You&apos;ll be able to view and comment on them here.</p>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                    <div className="px-5 py-4 border-b border-surface-100">
                      <h3 className="font-display text-lg text-surface-900">Committee Proposals</h3>
                      <p className="text-xs text-surface-500 mt-0.5">Click to expand and leave comments or suggestions</p>
                    </div>
                    <div className="divide-y divide-surface-100">
                      {committee.proposals.map((p) => {
                        let parsed = null;
                        try { parsed = JSON.parse(p.proposalJson); } catch {}
                        const isExpanded = expandedProposal === p.id;
                        return (
                          <div key={p.id} className="transition-all">
                            <div
                              className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-surface-50"
                              onClick={() => setExpandedProposal(isExpanded ? null : p.id)}
                            >
                              <div className="flex items-center gap-3">
                                <svg
                                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                  className={`text-surface-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                >
                                  <polyline points="9 18 15 12 9 6"/>
                                </svg>
                                <div>
                                  <p className="text-sm font-medium text-surface-900">{parsed?.title || "Untitled Workplan"}</p>
                                  <p className="text-xs text-surface-400 mt-0.5">
                                    Created {new Date(p.createdAt).toLocaleDateString()} via {p.inputType}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${statusStyle[p.status] || "bg-gray-100"}`}>
                                  {STATUS_LABELS[p.status] || p.status.replace("_", " ")}
                                </span>
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleDownloadPDF(p.id); }}
                                  className="text-xs text-surface-400 hover:text-brand-500 px-2 py-1.5 rounded-lg border border-surface-100 hover:border-brand-200 transition-all"
                                  title="Download PDF"
                                >
                                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                    <polyline points="7 10 12 15 17 10"/>
                                    <line x1="12" x2="12" y1="15" y2="3"/>
                                  </svg>
                                </button>
                              </div>
                            </div>
                            {isExpanded && (
                              <div className="border-t border-surface-100">
                                {(p.status === "revision_requested" || p.status === "rejected") && (
                                  <DirectorFeedback proposalId={p.id} authFetch={authFetch} />
                                )}
                                {p.status === "approved" && (
                                  <div className="bg-green-50 px-4 py-3 border-b border-green-100 flex items-center gap-2">
                                    <span className="text-green-600">✅</span>
                                    <span className="text-sm font-medium text-green-800">Approved by Project Director</span>
                                  </div>
                                )}
                                <div className="p-5 max-h-[500px] overflow-y-auto">
                                  {parsed ? (
                                    <ProposalPreview proposal={parsed} compact />
                                  ) : (
                                    <p className="text-sm text-surface-500">Unable to display proposal.</p>
                                  )}
                                </div>
                                <ProposalComments
                                  proposalId={p.id}
                                  committeeId={committee.id}
                                  authFetch={authFetch}
                                  refreshKey={commentRefreshKey}
                                />
                                <MemberCommentForm
                                  proposalId={p.id}
                                  committeeId={committee.id}
                                  authFetch={authFetch}
                                  onCommented={() => setCommentRefreshKey((k) => k + 1)}
                                />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Chair view: full proposal management ── */}
            {isChair && (
              <>
                {/* Just-generated proposal preview / edit */}
                {generatedProposal && (
                  <div className="space-y-4 animate-fade-in">
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-green-600 text-lg">✅</span>
                        <span className="text-sm font-medium text-green-900">
                          {editingProposal
                            ? "Editing workplan — make your changes below."
                            : "Workplan generated — review it below before submitting."}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setGeneratedProposal(null); setSavedProposalId(null); setEditingProposal(false); }}
                          className="text-xs text-surface-500 hover:text-surface-700 px-3 py-1.5 rounded-lg border border-surface-200 transition-all"
                        >
                          Back to Proposals
                        </button>
                        {savedProposalId && (
                          <button
                            onClick={() => handleDownloadPDF(savedProposalId)}
                            className="text-xs text-surface-600 hover:text-brand-600 px-3 py-1.5 rounded-lg border border-surface-200 hover:border-brand-200 transition-all flex items-center gap-1"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                              <polyline points="7 10 12 15 17 10" />
                              <line x1="12" x2="12" y1="15" y2="3" />
                            </svg>
                            PDF
                          </button>
                        )}
                        {savedProposalId && (
                          <button
                            onClick={() => setEditingProposal(!editingProposal)}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${
                              editingProposal
                                ? "text-orange-600 border-orange-200 hover:border-orange-300 bg-orange-50"
                                : "text-surface-600 hover:text-brand-600 border-surface-200 hover:border-brand-200"
                            }`}
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                            </svg>
                            {editingProposal ? "Cancel Edit" : "Edit"}
                          </button>
                        )}
                        {savedProposalId && !editingProposal && (
                          <button
                            onClick={() => handleSubmit(savedProposalId)}
                            disabled={submitting}
                            className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-5 py-2 rounded-lg transition-all"
                          >
                            {submitting ? "Submitting..." : "Submit to Director"}
                          </button>
                        )}
                      </div>
                    </div>

                    {editingProposal ? (
                      <div className="bg-white rounded-xl border border-surface-200 p-6 max-h-[700px] overflow-y-auto">
                        <ProposalEditor
                          proposal={generatedProposal}
                          onSave={handleSaveEdit}
                          onCancel={() => setEditingProposal(false)}
                        />
                      </div>
                    ) : (
                      <div className="bg-white rounded-xl border border-surface-200 p-6 max-h-[600px] overflow-y-auto">
                        <ProposalPreview proposal={generatedProposal} />
                      </div>
                    )}

                    {savedProposalId && !editingProposal && (
                      <div className="bg-white rounded-xl border border-surface-200 p-4 flex items-center justify-between sticky bottom-0">
                        <p className="text-sm text-surface-500">Happy with this proposal?</p>
                        <button
                          onClick={() => handleSubmit(savedProposalId)}
                          disabled={submitting}
                          className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-6 py-2.5 rounded-xl transition-all"
                        >
                          {submitting ? "Submitting..." : "Submit to Project Director"}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Existing proposals list */}
                {!generatedProposal && !showCreateForm && hasProposals && (
                  <div className="space-y-4">
                    {committee.proposals.filter(p => p.status === "revision_requested").map((p) => {
                      let parsed = null;
                      try { parsed = JSON.parse(p.proposalJson); } catch {}
                      return (
                        <div key={`rev-${p.id}`} className="bg-orange-50 border border-orange-200 rounded-xl overflow-hidden">
                          <div className="px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className="text-xl">🔄</span>
                              <div>
                                <p className="text-sm font-semibold text-orange-900">Revision Requested</p>
                                <p className="text-xs text-orange-700 mt-0.5">{parsed?.title || "Untitled Workplan"}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleDownloadPDF(p.id)}
                                className="text-xs text-orange-600 hover:text-orange-800 px-3 py-1.5 rounded-lg border border-orange-200 hover:border-orange-300 transition-all"
                              >
                                View PDF
                              </button>
                              <button
                                onClick={() => setShowCreateForm(true)}
                                className="text-xs bg-orange-500 hover:bg-orange-600 text-white px-4 py-1.5 rounded-lg transition-all font-medium"
                              >
                                Create Revision
                              </button>
                            </div>
                          </div>
                          <DirectorFeedback proposalId={p.id} authFetch={authFetch} />
                        </div>
                      );
                    })}

                    <div className="bg-white rounded-xl border border-surface-200 overflow-hidden">
                      <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
                        <h3 className="font-display text-lg text-surface-900">Your Proposals</h3>
                        <button
                          onClick={() => setShowCreateForm(true)}
                          className="bg-brand-500 hover:bg-brand-600 text-white text-xs font-medium px-4 py-2 rounded-lg transition-all flex items-center gap-1.5"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                          </svg>
                          New Workplan
                        </button>
                      </div>
                      <div className="divide-y divide-surface-100">
                        {committee.proposals.map((p) => {
                          let parsed = null;
                          try { parsed = JSON.parse(p.proposalJson); } catch {}
                          const isExpanded = expandedProposal === p.id;
                          return (
                            <div key={p.id} className="transition-all">
                              <div
                                className="flex items-center justify-between px-5 py-4 cursor-pointer hover:bg-surface-50"
                                onClick={() => setExpandedProposal(isExpanded ? null : p.id)}
                              >
                                <div className="flex items-center gap-3">
                                  <svg
                                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                                    className={`text-surface-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                                  >
                                    <polyline points="9 18 15 12 9 6"/>
                                  </svg>
                                  <div>
                                    <p className="text-sm font-medium text-surface-900">{parsed?.title || "Untitled Workplan"}</p>
                                    <p className="text-xs text-surface-400 mt-0.5">
                                      Created {new Date(p.createdAt).toLocaleDateString()} via {p.inputType}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium ${statusStyle[p.status] || "bg-gray-100"}`}>
                                    {STATUS_LABELS[p.status] || p.status.replace("_", " ")}
                                  </span>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); handleDownloadPDF(p.id); }}
                                    className="text-xs text-surface-400 hover:text-brand-500 px-2 py-1.5 rounded-lg border border-surface-100 hover:border-brand-200 transition-all"
                                    title="Download PDF"
                                  >
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                                      <polyline points="7 10 12 15 17 10"/>
                                      <line x1="12" x2="12" y1="15" y2="3"/>
                                    </svg>
                                  </button>
                                  {p.status === "draft" && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleSubmit(p.id); }}
                                      disabled={submitting}
                                      className="text-xs bg-brand-500 hover:bg-brand-600 text-white px-3 py-1.5 rounded-lg transition-all"
                                    >
                                      Submit
                                    </button>
                                  )}
                                </div>
                              </div>

                              {isExpanded && (
                                <div className="border-t border-surface-100">
                                  {(p.status === "revision_requested" || p.status === "rejected") && (
                                    <DirectorFeedback proposalId={p.id} authFetch={authFetch} />
                                  )}
                                  {p.status === "approved" && (
                                    <div className="bg-green-50 px-4 py-3 border-b border-green-100 flex items-center gap-2">
                                      <span className="text-green-600">✅</span>
                                      <span className="text-sm font-medium text-green-800">Approved by Project Director</span>
                                    </div>
                                  )}
                                  <div className="p-5 max-h-[500px] overflow-y-auto">
                                    {parsed ? (
                                      <ProposalPreview proposal={parsed} compact />
                                    ) : (
                                      <p className="text-sm text-surface-500">Unable to display proposal.</p>
                                    )}
                                  </div>
                                  <ProposalComments
                                    proposalId={p.id}
                                    committeeId={committee.id}
                                    authFetch={authFetch}
                                    refreshKey={commentRefreshKey}
                                  />
                                  <MemberCommentForm
                                    proposalId={p.id}
                                    committeeId={committee.id}
                                    authFetch={authFetch}
                                    onCommented={() => setCommentRefreshKey((k) => k + 1)}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* Creation form — chair only */}
                {!generatedProposal && (showCreateForm || !hasProposals) && (
                  <>
                    {hasProposals && (
                      <button
                        onClick={() => setShowCreateForm(false)}
                        className="flex items-center gap-1.5 text-sm text-surface-500 hover:text-surface-700 transition-colors"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="15 18 9 12 15 6"/>
                        </svg>
                        Back to proposals
                      </button>
                    )}

                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="text-sm text-blue-800">
                        <strong>Creating proposal for:</strong> {committee.name} — {committee.event?.title}
                      </p>
                      {committee.responsibilities?.length > 0 && (
                        <p className="text-xs text-blue-600 mt-1">
                          Responsibilities: {committee.responsibilities.map(r => r.text).join(", ")}
                        </p>
                      )}
                    </div>

                    <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
                      <div className="flex border-b border-surface-200">
                        <button
                          onClick={() => setGenMode("text")}
                          className={`flex-1 px-4 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                            genMode === "text"
                              ? "text-brand-600 border-b-2 border-brand-500 bg-brand-50/50"
                              : "text-surface-500 hover:text-surface-700 hover:bg-surface-50"
                          }`}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                          </svg>
                          Type your plan
                        </button>
                        <button
                          onClick={() => setGenMode("chat")}
                          className={`flex-1 px-4 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                            genMode === "chat"
                              ? "text-brand-600 border-b-2 border-brand-500 bg-brand-50/50"
                              : "text-surface-500 hover:text-surface-700 hover:bg-surface-50"
                          }`}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                          </svg>
                          Chat with Prime Ops
                        </button>
                        <button
                          onClick={() => setGenMode("document")}
                          className={`flex-1 px-4 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                            genMode === "document"
                              ? "text-brand-600 border-b-2 border-brand-500 bg-brand-50/50"
                              : "text-surface-500 hover:text-surface-700 hover:bg-surface-50"
                          }`}
                        >
                          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                            <polyline points="17 8 12 3 7 8" />
                            <line x1="12" x2="12" y1="3" y2="15" />
                          </svg>
                          Upload Document
                        </button>
                      </div>

                      <div className="p-6">
                        {genMode === "text" && (
                          <form onSubmit={handleTextGenerate}>
                            <textarea
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                              placeholder={`Describe your plan for the ${committee.name}...\n\nFor example: "We'll need 3 large tents for outdoor seating, a PA system with 4 speakers, stage lighting, and a backup generator. Budget estimate is around $5,000. We'll set up the day before and need 10 volunteers."`}
                              rows={6}
                              className="w-full rounded-xl border border-surface-200 px-4 py-3 text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 resize-none text-[15px] leading-relaxed"
                            />
                            <div className="flex items-center justify-between mt-4">
                              <span className="text-xs text-surface-400">
                                {description.length < 10 ? `${10 - description.length} more characters needed` : "✓ Ready to generate"}
                              </span>
                              <button
                                type="submit"
                                disabled={description.trim().length < 10 || generating}
                                className="bg-brand-500 hover:bg-brand-600 disabled:bg-surface-300 text-white font-medium px-6 py-3 rounded-xl transition-all shadow-md flex items-center gap-2"
                              >
                                {generating ? (
                                  <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    Generating...
                                  </>
                                ) : (
                                  <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
                                    </svg>
                                    Generate Proposal
                                  </>
                                )}
                              </button>
                            </div>
                          </form>
                        )}

                        {genMode === "chat" && (
                          <ChatMode
                            eventType={committee.event?.eventType || "general"}
                            onProposalReady={handleChatProposalReady}
                            committeeContext={buildCommitteeContext()}
                          />
                        )}

                        {genMode === "document" && (
                          <DocumentUpload
                            eventType={committee.event?.eventType || "general"}
                            onProposalReady={handleChatProposalReady}
                            committeeContext={buildCommitteeContext()}
                          />
                        )}
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ═══ UPDATES TAB ═══ */}
        {activeTab === "updates" && (
          <div className="space-y-6">
            {committee.proposals?.some((p) => p.status === "approved") ? (
              <>
                {/* Status update form — chair only */}
                {isChair ? (
                  <StatusUpdateForm
                    committeeId={committee.id}
                    committeeName={committee.name}
                    onSubmitted={() => { fetchCommittee(); setTimelineKey(k => k + 1); }}
                  />
                ) : (
                  <div className="bg-surface-50 border border-surface-200 rounded-xl px-4 py-3 flex items-center gap-2">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-surface-400 flex-shrink-0">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                    <p className="text-xs text-surface-500">Status updates are submitted by the committee head. You can view the update history below.</p>
                  </div>
                )}
                <div className="border-t border-surface-200 pt-6">
                  <h3 className="font-display text-lg text-surface-900 mb-4">Update History</h3>
                  <StatusUpdateTimeline committeeId={committee.id} key={timelineKey} />
                </div>
              </>
            ) : committee.proposals?.some((p) => p.status === "submitted") ? (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
                <div className="text-3xl mb-2">⏳</div>
                <p className="text-sm font-medium text-blue-900">Proposal pending approval</p>
                <p className="text-xs text-blue-600 mt-1">You can submit status updates once your workplan is approved by the Project Director.</p>
              </div>
            ) : (
              <div className="bg-surface-50 border border-surface-200 rounded-xl p-6 text-center">
                <div className="text-3xl mb-2">📝</div>
                <p className="text-sm font-medium text-surface-700">Submit your proposal first</p>
                <p className="text-xs text-surface-500 mt-1">Status updates are available after your proposal is approved.</p>
                {isChair && (
                  <button onClick={() => setActiveTab("proposal")}
                    className="mt-3 text-sm text-brand-500 hover:text-brand-600 font-medium">
                    Go to Proposals →
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ MILESTONES TAB ═══ */}
        {activeTab === "milestones" && (
          <CommitteeMilestones
            committeeId={committee.id}
            isChair={isChair}
          />
        )}

        {/* ═══ TASKS TAB ═══ */}
        {activeTab === "tasks" && (
          <div className="bg-white rounded-xl border border-surface-200 p-6">
            <TasksPanel
              eventId={committee.event?.id}
              committeeId={committee.id}
              isChair={isChair}
            />
          </div>
        )}

        {/* ═══ MEMBERS TAB ═══ */}
        {activeTab === "members" && (
          <div className="space-y-6">
            {/* Add member form — chair only */}
            {isChair && (
              <div className="bg-white rounded-xl border border-surface-200 p-6">
                <h3 className="font-display text-lg text-surface-900 mb-4">Add Team Member</h3>
                <form onSubmit={handleAddMember} className="space-y-4">
                  {/* KingsChat Username */}
                  <div>
                    <label className="block text-sm font-medium text-surface-700 mb-1">KingsChat Username</label>
                    {kcSelected && kcLookup.result ? (
                      <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
                        {kcLookup.result.avatar ? (
                          <img src={kcLookup.result.avatar} alt="" className="w-7 h-7 rounded-full" />
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-green-200 flex items-center justify-center">
                            <span className="text-xs font-medium text-green-700">
                              {(kcLookup.result.name || "?").charAt(0).toUpperCase()}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-medium text-green-800">{kcLookup.result.name}</span>
                          <span className="text-xs text-green-500 ml-2">@{kcLookup.result.username}</span>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-500 flex-shrink-0 mr-1">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                        <button
                          type="button"
                          onClick={handleClearKcUser}
                          className="text-green-400 hover:text-red-400 transition-colors p-0.5"
                          title="Remove"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="text"
                          value={memberForm.kcUsername}
                          onChange={(e) => handleKcUsernameChange(e.target.value)}
                          placeholder="@username"
                          className="w-full rounded-xl border border-surface-200 px-4 py-3 text-sm text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                        />
                        {kcLookup.loading && (
                          <div className="mt-2 flex items-center gap-1.5 text-xs text-surface-400">
                            <div className="w-3 h-3 border-2 border-brand-300 border-t-transparent rounded-full animate-spin" />
                            Searching KingsChat...
                          </div>
                        )}
                        {kcLookup.result && !kcSelected && (
                          <button
                            type="button"
                            onClick={() => handleSelectKcUser(kcLookup.result)}
                            className="mt-2 w-full flex items-center gap-3 bg-white border border-brand-200 rounded-xl px-4 py-3 hover:bg-brand-50 hover:border-brand-300 transition-all cursor-pointer text-left"
                          >
                            {kcLookup.result.avatar ? (
                              <img src={kcLookup.result.avatar} alt="" className="w-7 h-7 rounded-full" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center">
                                <span className="text-xs font-medium text-brand-600">
                                  {(kcLookup.result.name || "?").charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-surface-800">{kcLookup.result.name}</span>
                              <span className="text-xs text-surface-400 ml-2">@{kcLookup.result.username}</span>
                            </div>
                            <span className="text-[11px] text-brand-500 font-medium px-2.5 py-1 bg-brand-50 rounded-full">
                              Select
                            </span>
                          </button>
                        )}
                        {kcLookup.error && (
                          <div className="mt-2 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                            {kcLookup.error}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1">Name *</label>
                      <input
                        type="text"
                        value={memberForm.name}
                        onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                        placeholder="e.g. Sister Grace"
                        required
                        className="w-full rounded-xl border border-surface-200 px-4 py-3 text-sm text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1">Email</label>
                      <input
                        type="email"
                        value={memberForm.email}
                        onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                        placeholder="grace@example.com"
                        className="w-full rounded-xl border border-surface-200 px-4 py-3 text-sm text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1">Phone</label>
                      <input
                        type="tel"
                        value={memberForm.phone}
                        onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                        placeholder="+234..."
                        className="w-full rounded-xl border border-surface-200 px-4 py-3 text-sm text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-surface-700 mb-1">Role</label>
                      <select
                        value={memberForm.role}
                        onChange={(e) => setMemberForm({ ...memberForm, role: e.target.value })}
                        className="w-full rounded-xl border border-surface-200 px-4 py-3 text-sm text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                      >
                        <option value="member">Member</option>
                        <option value="co-chair">Co-Team Lead</option>
                      </select>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={addingMember || !memberForm.name.trim()}
                    className="bg-brand-500 hover:bg-brand-600 disabled:bg-surface-300 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all"
                  >
                    {addingMember ? "Adding..." : "Add Member"}
                  </button>
                </form>
              </div>
            )}

            <div className="bg-white rounded-xl border border-surface-200 p-6">
              <h3 className="font-display text-lg text-surface-900 mb-4">
                Team Members ({committee.members?.length || 0})
              </h3>
              {committee.members?.length === 0 ? (
                <p className="text-surface-500 text-sm">No members yet.</p>
              ) : (
                <div className="space-y-3">
                  {committee.members.map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-3 rounded-lg border border-surface-100">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-surface-200 flex items-center justify-center text-sm font-medium text-surface-600">
                          {m.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-surface-900">{m.name}</p>
                          <p className="text-xs text-surface-400">
                            {m.email || "No email"} {m.phone ? `· ${m.phone}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          m.role === "chair" ? "bg-brand-100 text-brand-700" :
                          m.role === "co-chair" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {m.role}
                        </span>
                        {m.userId && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-600">registered</span>
                        )}
                        {isChair && m.role !== "chair" && (
                          <button
                            onClick={() => handleRemoveMember(m.id, m.name)}
                            className="text-xs text-red-400 hover:text-red-600 transition-colors ml-1"
                            title="Remove member"
                          >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <line x1="18" y1="6" x2="6" y2="18" />
                              <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
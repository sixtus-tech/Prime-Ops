"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "../../../lib/api";
import BroadcastAlert from "../../../components/BroadcastAlert";
import StatusUpdateTimeline from "../../../components/StatusUpdateTimeline";
import MilestoneMap from "../../../components/MilestoneMap";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
async function apiFetch(path, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { "Content-Type": "application/json", ...options.headers },
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === "AbortError") throw new Error("Request timed out. Please try again.");
    throw err;
  }
}

const STATUSES = ["draft", "planning", "approved", "active", "completed", "cancelled"];
const STATUS_COLORS = {
  draft: "bg-surface-100 text-surface-600",
  planning: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  active: "bg-brand-100 text-brand-700",
  completed: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-600",
};
const ROLES = ["chair", "co-chair", "member"];

// ─── AddMemberForm ───────────────────────────────────────────────────
function AddMemberForm({ committeeId, onAdded }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", role: "member", kcUsername: "" });
  const [saving, setSaving] = useState(false);
  const [kcLookup, setKcLookup] = useState({ loading: false, result: null, error: null });
  const [kcSelected, setKcSelected] = useState(false);
  const kcLookupTimeout = useRef(null);

  function handleKcUsernameChange(value) {
    setForm((f) => ({ ...f, kcUsername: value }));
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
    setForm((f) => ({ ...f, name: f.name || profile.name || "", kcUsername: profile.username || f.kcUsername }));
  }

  function handleClearKcUser() {
    setKcSelected(false);
    setKcLookup({ loading: false, result: null, error: null });
    setForm((f) => ({ ...f, kcUsername: "", name: "" }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name, email: form.email, phone: form.phone, role: form.role,
        kcUsername: form.kcUsername.trim().replace(/^@/, "") || undefined,
        kcId: kcLookup.result?.kcId || undefined,
      };
      const data = await api.addMember(committeeId, payload);
      onAdded(data.member);
      setForm({ name: "", email: "", phone: "", role: "member", kcUsername: "" });
      setKcLookup({ loading: false, result: null, error: null });
      setKcSelected(false);
      setOpen(false);
    } catch (err) { alert(err.message); } finally { setSaving(false); }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="w-full py-2 border border-dashed border-surface-300 rounded-lg text-surface-400 hover:text-brand-500 hover:border-brand-300 text-xs font-medium transition-all">
        + Add Member
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="bg-surface-50 rounded-lg p-3 space-y-2 animate-fade-in">
      <div className="relative">
        {kcSelected && kcLookup.result ? (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            {kcLookup.result.avatar ? (
              <img src={kcLookup.result.avatar} alt="" className="w-5 h-5 rounded-full" />
            ) : (
              <div className="w-5 h-5 rounded-full bg-green-200 flex items-center justify-center">
                <span className="text-[10px] font-medium text-green-700">{(kcLookup.result.name || "?").charAt(0).toUpperCase()}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <span className="text-xs font-medium text-green-800">{kcLookup.result.name}</span>
              <span className="text-[11px] text-green-500 ml-1.5">@{kcLookup.result.username}</span>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-green-500 flex-shrink-0"><polyline points="20 6 9 17 4 12"/></svg>
            <button type="button" onClick={handleClearKcUser} className="text-green-400 hover:text-red-400 transition-colors p-0.5 ml-0.5" title="Remove">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-surface-400 flex-shrink-0"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
              <input type="text" placeholder="KingsChat Username" value={form.kcUsername} onChange={(e) => handleKcUsernameChange(e.target.value)} className="flex-1 text-sm rounded-lg border border-surface-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400" />
            </div>
            {kcLookup.loading && (
              <div className="mt-1.5 flex items-center gap-1.5 text-xs text-surface-400">
                <div className="w-3 h-3 border-2 border-brand-300 border-t-transparent rounded-full animate-spin" />Searching KingsChat...
              </div>
            )}
            {kcLookup.result && !kcSelected && (
              <button type="button" onClick={() => handleSelectKcUser(kcLookup.result)} className="mt-1.5 w-full flex items-center gap-2 bg-white border border-brand-200 rounded-lg px-3 py-2 hover:bg-brand-50 hover:border-brand-300 transition-all cursor-pointer text-left">
                {kcLookup.result.avatar ? (<img src={kcLookup.result.avatar} alt="" className="w-5 h-5 rounded-full" />) : (<div className="w-5 h-5 rounded-full bg-brand-100 flex items-center justify-center"><span className="text-[10px] font-medium text-brand-600">{(kcLookup.result.name || "?").charAt(0).toUpperCase()}</span></div>)}
                <div className="flex-1 min-w-0"><span className="text-xs font-medium text-surface-800">{kcLookup.result.name}</span><span className="text-[11px] text-surface-400 ml-1.5">@{kcLookup.result.username}</span></div>
                <span className="text-[10px] text-brand-500 font-medium px-2 py-0.5 bg-brand-50 rounded-full">Select</span>
              </button>
            )}
            {kcLookup.error && (<div className="mt-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">{kcLookup.error}</div>)}
          </>
        )}
      </div>
      <input type="text" placeholder="Name *" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required className="w-full text-sm rounded-lg border border-surface-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400" />
      <div className="grid grid-cols-2 gap-2">
        <input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} className="text-sm rounded-lg border border-surface-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400" />
        <input type="tel" placeholder="Phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} className="text-sm rounded-lg border border-surface-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400" />
      </div>
      <select value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} className="w-full text-sm rounded-lg border border-surface-200 px-3 py-2 focus:outline-none focus:ring-1 focus:ring-brand-400">
        {ROLES.map((r) => (<option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>))}
      </select>
      <div className="flex gap-2">
        <button type="submit" disabled={saving} className="flex-1 bg-brand-500 text-white text-sm py-2 rounded-lg hover:bg-brand-600 disabled:opacity-50 font-medium transition-all">{saving ? "Adding..." : "Add Member"}</button>
        <button type="button" onClick={() => { setOpen(false); setKcLookup({ loading: false, result: null, error: null }); setKcSelected(false); }} className="px-3 text-sm text-surface-400 hover:text-surface-600 transition-colors">Cancel</button>
      </div>
    </form>
  );
}

// ─── CommitteeCard ───────────────────────────────────────────────────
function CommitteeCard({ committee, onUpdate, onDelete, eventStartDate }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(committee.name);
  const [members, setMembers] = useState(committee.members || []);
  const [deadlineDate, setDeadlineDate] = useState(committee.proposalDeadline ? new Date(committee.proposalDeadline).toISOString().split("T")[0] : "");
  const [savingDeadline, setSavingDeadline] = useState(false);
  const savingRef = useRef(false);

  function handleMemberAdded(member) { setMembers((prev) => [...prev, member]); }
  async function handleRemoveMember(memberId) {
    if (!confirm("Remove this member?")) return;
    try { await api.removeMember(committee.id, memberId); setMembers((prev) => prev.filter((m) => m.id !== memberId)); } catch (err) { alert(err.message); }
  }
  async function handleRoleChange(memberId, newRole) {
    try { await api.updateMember(committee.id, memberId, { role: newRole }); setMembers((prev) => prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))); } catch (err) { alert(err.message); }
  }
  async function handleSaveName() {
    if (!name.trim()) return;
    try { await api.updateCommittee(committee.id, { name: name.trim() }); onUpdate(); setEditing(false); } catch (err) { alert(err.message); }
  }
  async function handleSetDeadline() {
    if (!deadlineDate || savingRef.current) return;
    savingRef.current = true;
    setSavingDeadline(true);
    try {
      await apiFetch(`/committees/${committee.id}/set-deadline`, { method: "POST", body: JSON.stringify({ proposalDeadline: deadlineDate }) });
      onUpdate();
    } catch (err) {
      alert(err.message);
    } finally {
      setSavingDeadline(false);
      savingRef.current = false;
    }
  }

  const deadline = committee.proposalDeadline ? new Date(committee.proposalDeadline) : null;
  const now = new Date();
  const daysUntil = deadline ? Math.ceil((deadline.getTime() - now.getTime()) / 86400000) : null;
  const hasSubmitted = committee.proposals?.some((p) => ["submitted", "approved"].includes(p.status));
  let deadlineStatus = null;
  if (deadline && !hasSubmitted) {
    if (daysUntil < 0) deadlineStatus = { label: `${Math.abs(daysUntil)}d overdue`, color: "text-red-600 bg-red-50", icon: "🔴" };
    else if (daysUntil <= 1) deadlineStatus = { label: "Due tomorrow", color: "text-red-600 bg-red-50", icon: "🚨" };
    else if (daysUntil <= 3) deadlineStatus = { label: `${daysUntil}d left`, color: "text-orange-600 bg-orange-50", icon: "⚠️" };
    else if (daysUntil <= 7) deadlineStatus = { label: `${daysUntil}d left`, color: "text-yellow-600 bg-yellow-50", icon: "📅" };
    else deadlineStatus = { label: `${daysUntil}d left`, color: "text-green-600 bg-green-50", icon: "✅" };
  } else if (deadline && hasSubmitted) { deadlineStatus = { label: "Submitted", color: "text-green-600 bg-green-50", icon: "✅" }; }
  const ROLE_BADGE = { chair: "bg-brand-100 text-brand-700", "co-chair": "bg-blue-100 text-blue-700", member: "bg-surface-100 text-surface-600" };

  return (
    <div className="bg-white rounded-xl border border-surface-200 overflow-hidden hover:border-brand-200 transition-colors">
      <div className="px-5 py-4 border-b border-surface-100 flex items-center justify-between">
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <input value={name} onChange={(e) => setName(e.target.value)} className="flex-1 text-sm font-medium rounded-lg border border-surface-200 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400" autoFocus onKeyDown={(e) => e.key === "Enter" && handleSaveName()} />
            <button onClick={handleSaveName} className="text-xs text-brand-500 font-medium">Save</button>
            <button onClick={() => { setEditing(false); setName(committee.name); }} className="text-xs text-surface-400">Cancel</button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-surface-800">{committee.name}</h4>
            <span className="text-xs text-surface-400">{members.length} members</span>
          </div>
        )}
        <div className="flex items-center gap-1">
          <button onClick={() => setEditing(true)} className="p-1.5 text-surface-400 hover:text-surface-600 transition-colors" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/></svg>
          </button>
          <button onClick={() => onDelete(committee.id)} className="p-1.5 text-surface-400 hover:text-red-500 transition-colors" title="Delete committee">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      </div>
      {committee.responsibilities?.length > 0 && (
        <div className="px-5 py-3 border-b border-surface-100 bg-surface-50/50">
          <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Responsibilities</p>
          <ul className="space-y-0.5">{committee.responsibilities.map((r) => (<li key={r.id} className="text-xs text-surface-500">• {r.text}</li>))}</ul>
        </div>
      )}
      <div className="px-5 py-3 border-b border-surface-100">
        <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-2">Proposal Due Date</p>
        {deadline ? (
          <div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${deadlineStatus?.color || ""}`}>{deadlineStatus?.icon} {deadlineStatus?.label}</span>
                <span className="text-xs text-surface-500">{deadline.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
              </div>
              <input type="date" value={deadlineDate} onChange={(e) => { setDeadlineDate(e.target.value); }} onBlur={() => { if (deadlineDate !== (committee.proposalDeadline ? new Date(committee.proposalDeadline).toISOString().split("T")[0] : "")) handleSetDeadline(); }} className="text-[11px] rounded border border-surface-200 px-1.5 py-0.5 text-surface-500 w-28 focus:outline-none focus:ring-1 focus:ring-brand-400" />
            </div>
            {!hasSubmitted && daysUntil !== null && daysUntil <= 3 && (
              <button onClick={async () => { try { await apiFetch(`/committees/${committee.id}/send-reminder`, { method: "POST" }); alert("Reminder sent!"); } catch (err) { alert(err.message); } }} className="mt-2 text-[11px] text-orange-600 hover:text-orange-700 font-medium flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                Send Reminder Now
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input type="date" value={deadlineDate} onChange={(e) => setDeadlineDate(e.target.value)} className="flex-1 text-xs rounded-lg border border-surface-200 px-3 py-2 text-surface-600 focus:outline-none focus:ring-1 focus:ring-brand-400" />
            <button onClick={handleSetDeadline} disabled={!deadlineDate || savingDeadline} className="text-xs bg-brand-500 hover:bg-brand-600 disabled:bg-surface-300 text-white px-3 py-2 rounded-lg font-medium transition-all">{savingDeadline ? "..." : "Set"}</button>
          </div>
        )}
      </div>
      <div className="px-5 py-4 space-y-2">
        {members.length === 0 ? (<p className="text-xs text-surface-400 italic mb-2">No members assigned yet.</p>) : (
          <div className="space-y-2 mb-3">
            {members.map((m) => (
              <div key={m.id} className="flex items-center gap-3 group">
                <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{m.name.charAt(0).toUpperCase()}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5"><p className="text-sm text-surface-800 font-medium truncate">{m.name}</p>{m.kcUsername && <span className="text-[10px] text-brand-500 font-medium">@{m.kcUsername}</span>}</div>
                  {m.email && <p className="text-[11px] text-surface-400 truncate">{m.email}</p>}
                </div>
                <select value={m.role} onChange={(e) => handleRoleChange(m.id, e.target.value)} className={`text-[10px] font-medium px-2 py-0.5 rounded-full border-0 cursor-pointer ${ROLE_BADGE[m.role]}`}>
                  {ROLES.map((r) => (<option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>))}
                </select>
                <button onClick={() => handleRemoveMember(m.id)} className="opacity-0 group-hover:opacity-100 text-surface-300 hover:text-red-500 transition-all p-1">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" x2="6" y1="6" y2="18"/><line x1="6" x2="18" y1="6" y2="18"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
        <AddMemberForm committeeId={committee.id} onAdded={handleMemberAdded} />
      </div>
    </div>
  );
}

// ─── AddCommitteeForm ────────────────────────────────────────────────
function AddCommitteeForm({ eventId, onCreated }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      const data = await api.createCommittee({ name: name.trim(), eventId, proposalDeadline: deadline || null });
      if (deadline && data.committee?.id) { await apiFetch(`/committees/${data.committee.id}/set-deadline`, { method: "POST", body: JSON.stringify({ proposalDeadline: deadline }) }).catch(() => {}); }
      onCreated(data.committee); setName(""); setDeadline(""); setOpen(false);
    } catch (err) { alert(err.message); } finally { setSaving(false); }
  }

  if (!open) {
    return (<button onClick={() => setOpen(true)} className="w-full py-8 border-2 border-dashed border-surface-300 rounded-xl text-surface-400 hover:text-brand-500 hover:border-brand-300 font-medium transition-all flex items-center justify-center gap-2"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" x2="12" y1="5" y2="19"/><line x1="5" x2="19" y1="12" y2="12"/></svg>Add Committee</button>);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-surface-200 p-5 animate-fade-in">
      <label className="block text-sm font-medium text-surface-700 mb-1.5">Committee Name</label>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Logistics Committee" autoFocus required className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400" />
      <label className="block text-sm font-medium text-surface-700 mb-1.5 mt-3">Proposal Due Date</label>
      <input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400" />
      <p className="text-[11px] text-surface-400 mt-1">Committee members will be notified of this due date and receive follow-up reminders.</p>
      <div className="flex gap-2 mt-3">
        <button type="button" onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-lg border border-surface-200 text-surface-500 hover:bg-surface-50 text-sm">Cancel</button>
        <button type="submit" disabled={saving} className="flex-1 py-2.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-300 text-sm font-medium">{saving ? "Creating..." : "Create"}</button>
      </div>
    </form>
  );
}

// ─── EventApprovals ──────────────────────────────────────────────────
const APPROVAL_STATUS_COLORS = { pending: "bg-yellow-100 text-yellow-700", under_review: "bg-blue-100 text-blue-700", approved: "bg-green-100 text-green-700", rejected: "bg-red-100 text-red-600", revision_requested: "bg-orange-100 text-orange-700" };
const APPROVAL_STATUS_LABELS = { pending: "Pending", under_review: "Under Review", approved: "Approved", rejected: "Not Approved", revision_requested: "Revision Requested" };

function EventApprovals({ eventId, eventTitle }) {
  const [approvals, setApprovals] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", requestedBy: "", priority: "normal", dueDate: "" });

  useEffect(() => { api.listApprovals({ eventId }).then((data) => { setApprovals(data.approvals); setLoaded(true); }).catch(() => setLoaded(true)); }, [eventId]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title || !form.requestedBy) return;
    setSaving(true);
    try {
      const data = await api.createApproval({ ...form, eventId });
      setApprovals((prev) => [data.approval, ...prev]);
      setForm({ title: "", description: "", requestedBy: "", priority: "normal", dueDate: "" });
      setShowForm(false);
    } catch (err) { alert(err.message); } finally { setSaving(false); }
  }

  return (
    <section>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-xl text-surface-900">Approval Requests<span className="text-surface-400 text-base ml-2">({approvals.length})</span></h2>
        <button onClick={() => setShowForm(!showForm)} className="text-brand-500 hover:text-brand-600 text-sm font-medium transition-colors">{showForm ? "Cancel" : "+ Submit for Approval"}</button>
      </div>
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-brand-200 p-5 mb-4 space-y-3 animate-fade-in">
          <div className="grid grid-cols-2 gap-3">
            <input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="Approval title *" required className="rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
            <input value={form.requestedBy} onChange={(e) => setForm((f) => ({ ...f, requestedBy: e.target.value }))} placeholder="Your name *" required className="rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
          </div>
          <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="Description..." rows={2} className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 resize-none" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value }))} className="rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400">
              <option value="low">Low Priority</option><option value="normal">Normal Priority</option><option value="high">High Priority</option><option value="urgent">Urgent</option>
            </select>
            <input type="date" value={form.dueDate} onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))} className="rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" />
          </div>
          <button type="submit" disabled={saving} className="bg-brand-500 hover:bg-brand-600 disabled:bg-brand-300 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-all">{saving ? "Submitting..." : "Submit"}</button>
        </form>
      )}
      {!loaded ? (<p className="text-surface-400 text-sm py-4">Loading...</p>) : approvals.length === 0 ? (
        <div className="bg-white rounded-xl border border-surface-200 p-6 text-center"><p className="text-surface-400 text-sm">No approval requests for this event yet.</p></div>
      ) : (
        <div className="space-y-2">
          {approvals.map((a) => (
            <Link key={a.id} href={`/approvals/${a.id}`} className="bg-white rounded-xl border border-surface-200 p-4 flex items-center gap-3 hover:border-brand-200 transition-all block">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${APPROVAL_STATUS_COLORS[a.status]}`}>{APPROVAL_STATUS_LABELS[a.status] || a.status.replace("_", " ")}</span>
              <div className="flex-1 min-w-0"><p className="text-sm font-medium text-surface-800 truncate">{a.title}</p><p className="text-xs text-surface-400">By {a.requestedBy} · {a._count?.actions || 0} actions</p></div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-surface-300"><polyline points="9 18 15 12 9 6"/></svg>
            </Link>
          ))}
        </div>
      )}
    </section>
  );
}

// ─── BulkDeadlineSetter ──────────────────────────────────────────────
function BulkDeadlineSetter({ eventId, committees, onDone }) {
  const [deadlines, setDeadlines] = useState(committees.map((c) => ({ committeeId: c.id, name: c.name, proposalDeadline: c.proposalDeadline ? new Date(c.proposalDeadline).toISOString().split("T")[0] : "" })));
  const [saving, setSaving] = useState(false);
  const [sameDate, setSameDate] = useState("");
  const [success, setSuccess] = useState(false);
  const savingRef = useRef(false);

  function applyToAll() { if (!sameDate) return; setDeadlines((prev) => prev.map((d) => ({ ...d, proposalDeadline: sameDate }))); }

  async function handleSave() {
    if (savingRef.current) return;
    const toSave = deadlines.filter((d) => d.proposalDeadline);
    if (toSave.length === 0) return alert("Set at least one due date.");

    savingRef.current = true;
    setSaving(true);
    setSuccess(false);

    try {
      await apiFetch(`/events/${eventId}/set-deadlines`, {
        method: "POST",
        body: JSON.stringify({ deadlines: toSave }),
      });
      setSuccess(true);
      setTimeout(() => onDone(), 800);
    } catch (err) {
      alert("Failed: " + err.message);
    } finally {
      setSaving(false);
      savingRef.current = false;
    }
  }

  return (
    <div className="bg-brand-50/50 border border-brand-200 rounded-xl p-5 mb-6 animate-fade-in">
      <h3 className="font-display text-base text-surface-900 mb-1">Set Committee Due Dates</h3>
      <p className="text-xs text-surface-500 mb-4">Set proposal submission deadlines for each committee. Members will be notified immediately and receive follow-up reminders at 7 days, 3 days, 1 day, and daily when overdue.</p>
      <div className="flex items-center gap-2 mb-4 pb-4 border-b border-brand-100">
        <span className="text-xs text-surface-600 font-medium">Apply to all:</span>
        <input type="date" value={sameDate} onChange={(e) => setSameDate(e.target.value)} className="text-xs rounded-lg border border-surface-200 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400" />
        <button onClick={applyToAll} disabled={!sameDate} className="text-xs bg-brand-500 hover:bg-brand-600 disabled:bg-surface-300 text-white px-3 py-1.5 rounded-lg font-medium transition-all">Apply</button>
      </div>
      <div className="space-y-2">
        {deadlines.map((d, i) => (
          <div key={d.committeeId} className="flex items-center justify-between gap-4 bg-white rounded-lg px-4 py-2.5 border border-surface-100">
            <span className="text-sm font-medium text-surface-800 flex-1">{d.name}</span>
            <input type="date" value={d.proposalDeadline} onChange={(e) => setDeadlines((prev) => prev.map((dd, j) => j === i ? { ...dd, proposalDeadline: e.target.value } : dd))} className="text-sm rounded-lg border border-surface-200 px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400" />
            {d.proposalDeadline && <span className="text-[11px] text-green-600">✓</span>}
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onDone} disabled={saving} className="text-sm px-4 py-2 rounded-lg border border-surface-200 text-surface-500 hover:bg-surface-50 transition-all disabled:opacity-50">Cancel</button>
        <button onClick={handleSave} disabled={saving || success} className="text-sm bg-brand-500 hover:bg-brand-600 disabled:bg-surface-300 text-white font-medium px-6 py-2 rounded-lg transition-all flex items-center gap-2">
          {success ? (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>Done!</>
          ) : saving ? (
            <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</>
          ) : (
            <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>Set Deadlines &amp; Notify Teams</>
          )}
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN EVENT DETAIL PAGE
// ═══════════════════════════════════════════════════════════════════════
export default function EventDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingDetails, setEditingDetails] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [showBulkDeadlines, setShowBulkDeadlines] = useState(false);

  const loadEvent = useCallback(async () => {
    try {
      const data = await api.getEvent(id);
      setEvent(data.event);
      setEditForm({ title: data.event.title, subtitle: data.event.subtitle || "", summary: data.event.summary || "", venue: data.event.venue || "", estimatedBudget: data.event.estimatedBudget || "", estimatedAttendance: data.event.estimatedAttendance || "" });
      return data.event;
    } catch (err) { console.error(err); } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { loadEvent().then((evt) => { if (searchParams.get("setDeadlines") === "true" && evt?.committees?.length > 0) setShowBulkDeadlines(true); }); }, [loadEvent, searchParams]);

  async function handleStatusChange(newStatus) { try { await api.updateEvent(id, { status: newStatus }); setEvent((e) => ({ ...e, status: newStatus })); } catch (err) { alert(err.message); } }
  async function handleSaveDetails(e) { e.preventDefault(); try { const data = await api.updateEvent(id, editForm); setEvent((e) => ({ ...e, ...data.event })); setEditingDetails(false); } catch (err) { alert(err.message); } }
  async function handleDeleteCommittee(committeeId) { if (!confirm("Delete this committee and all its members?")) return; try { await api.deleteCommittee(committeeId); setEvent((e) => ({ ...e, committees: e.committees.filter((c) => c.id !== committeeId) })); } catch (err) { alert(err.message); } }
  function handleCommitteeCreated(committee) { setEvent((e) => ({ ...e, committees: [...(e.committees || []), committee] })); }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-surface-400">Loading event...</div>;
  if (!event) return (<div className="min-h-screen flex items-center justify-center"><div className="text-center"><p className="text-surface-700 font-medium">Event not found</p><button onClick={() => router.push("/events")} className="text-brand-500 text-sm mt-2">← Back to events</button></div></div>);

  const totalMembers = event.committees?.reduce((sum, c) => sum + (c.members?.length || 0), 0) || 0;

  return (
    <main className="min-h-screen">
      <div className="bg-brand-600 text-white px-6 lg:px-10 py-8">
        <button onClick={() => router.push("/events")} className="flex items-center gap-1 text-surface-400 hover:text-white text-sm mb-4 transition-colors">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>All Events
        </button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="font-display text-2xl sm:text-3xl">{event.title}</h1>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[event.status]}`}>{event.status}</span>
            </div>
            {event.subtitle && <p className="text-surface-400 text-lg">{event.subtitle}</p>}
          </div>
          <select value={event.status} onChange={(e) => handleStatusChange(e.target.value)} className="bg-white/10 text-white border border-white/20 rounded-lg px-3 py-2 text-sm focus:outline-none">
            {STATUSES.map((s) => (<option key={s} value={s} className="text-surface-900">{s.charAt(0).toUpperCase() + s.slice(1)}</option>))}
          </select>
        </div>
        <div className="flex flex-wrap gap-6 mt-6 pt-5 border-t border-white/20 text-sm">
          {event.venue && <div><p className="text-white/60 text-xs">Venue</p><p className="text-white">{event.venue}</p></div>}
          {event.estimatedBudget && <div><p className="text-white/60 text-xs">Budget</p><p className="text-white">{event.estimatedBudget}</p></div>}
          {event.estimatedAttendance && <div><p className="text-white/60 text-xs">Attendance</p><p className="text-white">{event.estimatedAttendance}</p></div>}
          <div><p className="text-white/60 text-xs">Committees</p><p className="text-white">{event.committees?.length || 0}</p></div>
          <div><p className="text-white/60 text-xs">Total Members</p><p className="text-white">{totalMembers}</p></div>
        </div>
      </div>

      <div className="px-6 lg:px-10 py-8 space-y-8">
        {/* ─── Event Details (editable) ─── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl text-surface-900">Project Details</h2>
            <button onClick={() => setEditingDetails(!editingDetails)} className="text-brand-500 hover:text-brand-600 text-sm font-medium transition-colors">{editingDetails ? "Cancel" : "Edit Details"}</button>
          </div>
          {editingDetails ? (
            <form onSubmit={handleSaveDetails} className="bg-white rounded-xl border border-surface-200 p-6 space-y-4 animate-fade-in">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-surface-500 mb-1">Title</label><input value={editForm.title} onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))} className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" /></div>
                <div><label className="block text-xs font-medium text-surface-500 mb-1">Subtitle</label><input value={editForm.subtitle} onChange={(e) => setEditForm((f) => ({ ...f, subtitle: e.target.value }))} className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" /></div>
              </div>
              <div><label className="block text-xs font-medium text-surface-500 mb-1">Summary</label><textarea value={editForm.summary} onChange={(e) => setEditForm((f) => ({ ...f, summary: e.target.value }))} rows={3} className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400 resize-none" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div><label className="block text-xs font-medium text-surface-500 mb-1">Venue</label><input value={editForm.venue} onChange={(e) => setEditForm((f) => ({ ...f, venue: e.target.value }))} className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" /></div>
                <div><label className="block text-xs font-medium text-surface-500 mb-1">Budget</label><input value={editForm.estimatedBudget} onChange={(e) => setEditForm((f) => ({ ...f, estimatedBudget: e.target.value }))} className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" /></div>
                <div><label className="block text-xs font-medium text-surface-500 mb-1">Attendance</label><input value={editForm.estimatedAttendance} onChange={(e) => setEditForm((f) => ({ ...f, estimatedAttendance: e.target.value }))} className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand-400" /></div>
              </div>
              <button type="submit" className="bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-6 py-2.5 rounded-lg transition-all">Save Changes</button>
            </form>
          ) : (
            <div className="bg-white rounded-xl border border-surface-200 p-6">
              {event.summary ? <p className="text-surface-600 leading-relaxed">{event.summary}</p> : <p className="text-surface-400 italic text-sm">No summary yet. Click &ldquo;Edit Details&rdquo; to add one.</p>}
            </div>
          )}
        </section>

        {/* ─── Committees ─── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl text-surface-900">Committees<span className="text-surface-400 text-base ml-2">({event.committees?.length || 0})</span></h2>
            {event.committees?.length > 0 && (
              <button onClick={() => setShowBulkDeadlines(!showBulkDeadlines)} className="flex items-center gap-1.5 text-xs font-medium text-brand-500 hover:text-brand-600 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2" /><line x1="16" x2="16" y1="2" y2="6" /><line x1="8" x2="8" y1="2" y2="6" /><line x1="3" x2="21" y1="10" y2="10" /></svg>
                {showBulkDeadlines ? "Hide" : "Set All Due Dates"}
              </button>
            )}
          </div>
          {showBulkDeadlines && event.committees?.length > 0 && (<BulkDeadlineSetter eventId={event.id} committees={event.committees} onDone={() => { setShowBulkDeadlines(false); loadEvent(); }} />)}
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {event.committees?.map((c) => (<CommitteeCard key={c.id} committee={c} onUpdate={loadEvent} onDelete={handleDeleteCommittee} eventStartDate={event.startDate} />))}
            <AddCommitteeForm eventId={event.id} onCreated={handleCommitteeCreated} />
          </div>
        </section>

        {/* ─── Milestone Map ─── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl text-surface-900">Milestone Map</h2>
          </div>
          <MilestoneMap eventId={event.id} userName={event.title} />
        </section>

        {/* ─── Approval Requests ─── */}
        <EventApprovals eventId={event.id} eventTitle={event.title} />

        {/* ─── Director Broadcast Alert ─── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl text-surface-900">Communications</h2>
          </div>
          <BroadcastAlert eventId={event.id} eventTitle={event.title} committees={event.committees || []} />
        </section>

        {/* ─── Committee Status Updates ─── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-xl text-surface-900">Committee Status Updates</h2>
          </div>
          <StatusUpdateTimeline eventId={event.id} isDirector />
        </section>
      </div>
    </main>
  );
}
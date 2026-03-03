"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export default function BroadcastAlert({ eventId, eventTitle, committees = [], onSent }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [selectedCommittees, setSelectedCommittees] = useState([]);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduledFor, setScheduledFor] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [scheduled, setScheduled] = useState([]);
  const [showScheduled, setShowScheduled] = useState(false);

  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  const templates = [
    { label: "Proposal Reminder", subject: "Proposal Submission Reminder", message: `This is a reminder that your committee proposal for ${eventTitle} is due soon. Please submit your proposal in the Committee Portal as soon as possible.` },
    { label: "Status Update Request", subject: "Status Update Needed", message: `Please submit a status update for your committee's progress on ${eventTitle}. Go to your Committee Portal → Updates tab to share your progress.` },
    { label: "Urgent Meeting", subject: "Urgent: Committee Heads Meeting", message: `All committee heads are requested to attend an urgent planning meeting for ${eventTitle}. Details to follow.` },
    { label: "Budget Due", subject: "Budget Submission Due", message: `Please submit your committee's budget breakdown for ${eventTitle} at your earliest convenience. This is needed to finalize the overall event budget.` },
  ];

  function toggleCommittee(id) {
    setSelectedCommittees((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  }

  function selectAllCommittees() {
    if (selectedCommittees.length === committees.length) {
      setSelectedCommittees([]);
    } else {
      setSelectedCommittees(committees.map((c) => c.id));
    }
  }

  async function fetchScheduled() {
    try {
      const res = await fetch(`${API}/events/${eventId}/scheduled-broadcasts`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setScheduled(data.broadcasts || []);
    } catch {}
  }

  async function deleteScheduled(id) {
    try {
      await fetch(`${API}/events/${eventId}/scheduled-broadcasts/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      setScheduled((prev) => prev.filter((b) => b.id !== id));
    } catch (err) {
      alert("Failed to delete: " + err.message);
    }
  }

  async function handleSend() {
    if (!message.trim()) return alert("Please enter a message.");
    if (scheduleMode && !scheduledFor) return alert("Please select a date and time.");
    setSending(true);
    try {
      const res = await fetch(`${API}/events/${eventId}/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          subject,
          message,
          urgency,
          committeeIds: selectedCommittees.length > 0 && selectedCommittees.length < committees.length ? selectedCommittees : undefined,
          scheduledFor: scheduleMode ? scheduledFor : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      if (scheduleMode) fetchScheduled();
      if (onSent) onSent();
    } catch (err) {
      alert("Failed to send: " + err.message);
    } finally {
      setSending(false);
    }
  }

  function applyTemplate(t) {
    setSubject(t.subject);
    setMessage(t.message);
  }

  function resetForm() {
    setResult(null);
    setOpen(false);
    setSubject("");
    setMessage("");
    setSelectedCommittees([]);
    setScheduleMode(false);
    setScheduledFor("");
    setShowScheduled(false);
  }

  if (!open) {
    return (
      <div className="flex items-center gap-2">
        <button onClick={() => setOpen(true)}
          className="flex items-center gap-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 px-4 py-2.5 rounded-xl transition-all shadow-sm">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </svg>
          Send Alert
        </button>
        <button onClick={() => { setOpen(true); setShowScheduled(true); fetchScheduled(); }}
          className="flex items-center gap-1.5 text-sm font-medium text-surface-600 hover:text-brand-600 border border-surface-200 hover:border-brand-300 px-3 py-2.5 rounded-xl transition-all">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          Scheduled
        </button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-5 animate-fade-in">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-green-600 text-lg">{result.scheduled ? "📅" : "✅"}</span>
          <span className="text-sm font-medium text-green-900">{result.message}</span>
        </div>
        <button onClick={resetForm} className="text-xs text-green-600 hover:text-green-700 font-medium mt-1">Done</button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-red-200 p-5 space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="font-display text-base text-surface-900 flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
          Broadcast Alert
        </h3>
        <div className="flex items-center gap-2">
          <button onClick={() => { setShowScheduled(!showScheduled); if (!showScheduled) fetchScheduled(); }}
            className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all ${showScheduled ? "bg-brand-100 text-brand-700 border border-brand-200" : "bg-surface-50 text-surface-500 border border-surface-200"}`}>
            📅 Scheduled
          </button>
          <button onClick={resetForm} className="text-surface-400 hover:text-surface-600">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      {/* Scheduled broadcasts list */}
      {showScheduled && (
        <div className="bg-surface-50 rounded-lg p-3 space-y-2">
          <p className="text-xs font-medium text-surface-500">Scheduled Alerts</p>
          {scheduled.filter((b) => !b.sent).length === 0 ? (
            <p className="text-xs text-surface-400 italic">No scheduled alerts</p>
          ) : (
            scheduled.filter((b) => !b.sent).map((b) => (
              <div key={b.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-surface-100">
                <div>
                  <p className="text-xs font-medium text-surface-700">{b.subject || b.message.substring(0, 40) + "..."}</p>
                  <p className="text-[10px] text-surface-400">📅 {new Date(b.scheduledFor).toLocaleString()} · {b.urgency}</p>
                </div>
                <button onClick={() => deleteScheduled(b.id)} className="text-red-400 hover:text-red-600 text-xs">Cancel</button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Quick templates */}
      <div>
        <p className="text-[11px] text-surface-500 font-medium mb-1.5">Quick Templates:</p>
        <div className="flex flex-wrap gap-1.5">
          {templates.map((t, i) => (
            <button key={i} onClick={() => applyTemplate(t)}
              className="text-[11px] px-2.5 py-1 rounded-full border border-surface-200 text-surface-600 hover:border-brand-300 hover:text-brand-600 transition-all">
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Committee selection */}
      {committees.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[11px] text-surface-500 font-medium">Send to:</p>
            <button onClick={selectAllCommittees} className="text-[10px] text-brand-500 hover:text-brand-600 font-medium">
              {selectedCommittees.length === committees.length ? "Deselect All" : "Select All"}
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {committees.map((c) => (
              <button key={c.id} onClick={() => toggleCommittee(c.id)}
                className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all ${
                  selectedCommittees.includes(c.id)
                    ? "bg-brand-100 text-brand-700 border border-brand-200"
                    : "bg-surface-50 text-surface-500 border border-surface-200"
                }`}>
                {selectedCommittees.includes(c.id) ? "✓ " : ""}{c.name}
              </button>
            ))}
          </div>
          {selectedCommittees.length === 0 && (
            <p className="text-[10px] text-surface-400 mt-1 italic">No selection = all committees</p>
          )}
        </div>
      )}

      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject (optional)"
        className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-1 focus:ring-brand-400" />

      <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your message..." rows={4}
        className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none" />

      {/* Schedule toggle */}
      <div className="flex items-center gap-3 flex-wrap">
        <button onClick={() => setScheduleMode(!scheduleMode)}
          className={`text-[11px] px-3 py-1.5 rounded-full font-medium transition-all flex items-center gap-1.5 ${
            scheduleMode ? "bg-blue-100 text-blue-700 border border-blue-200" : "bg-surface-50 text-surface-500 border border-surface-200"
          }`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          {scheduleMode ? "Scheduled" : "Schedule for later"}
        </button>
        {scheduleMode && (
          <input type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)}
            min={new Date().toISOString().slice(0, 16)}
            className="text-xs border border-surface-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-brand-400" />
        )}
      </div>

      {/* Urgency + Send */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-surface-500">Urgency:</label>
          {["normal", "high", "urgent"].map((u) => (
            <button key={u} onClick={() => setUrgency(u)}
              className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all ${
                urgency === u
                  ? u === "urgent" ? "bg-red-100 text-red-700 border border-red-200" : u === "high" ? "bg-orange-100 text-orange-700 border border-orange-200" : "bg-blue-100 text-blue-700 border border-blue-200"
                  : "bg-surface-50 text-surface-400 border border-surface-100"
              }`}>
              {u}
            </button>
          ))}
        </div>
        <button onClick={handleSend} disabled={sending || !message.trim()}
          className="bg-red-500 hover:bg-red-600 disabled:bg-surface-300 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all flex items-center gap-2">
          {sending ? (
            <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> {scheduleMode ? "Scheduling..." : "Sending..."}</>
          ) : (
            scheduleMode ? "📅 Schedule Alert" : "Send Now"
          )}
        </button>
      </div>
    </div>
  );
}

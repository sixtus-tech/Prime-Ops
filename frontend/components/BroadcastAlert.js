"use client";

import { useState } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export default function BroadcastAlert({ eventId, eventTitle, onSent }) {
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [urgency, setUrgency] = useState("normal");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  // Quick templates
  const templates = [
    { label: "Proposal Reminder", subject: "Proposal Submission Reminder", message: `This is a reminder that your committee proposal for ${eventTitle} is due soon. Please submit your proposal in the Committee Portal as soon as possible.` },
    { label: "Status Update Request", subject: "Status Update Needed", message: `Please submit a status update for your committee's progress on ${eventTitle}. Go to your Committee Portal → Updates tab to share your progress.` },
    { label: "Urgent Meeting", subject: "Urgent: Committee Heads Meeting", message: `All committee heads are requested to attend an urgent planning meeting for ${eventTitle}. Details to follow.` },
    { label: "Budget Due", subject: "Budget Submission Due", message: `Please submit your committee's budget breakdown for ${eventTitle} at your earliest convenience. This is needed to finalize the overall event budget.` },
  ];

  async function handleSend() {
    if (!message.trim()) return alert("Please enter a message.");
    setSending(true);
    try {
      const res = await fetch(`${API}/events/${eventId}/broadcast`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message, urgency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
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

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 px-4 py-2.5 rounded-xl transition-all shadow-sm"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
          <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
        </svg>
        Send Alert to All Committees
      </button>
    );
  }

  if (result) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-5 animate-fade-in">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-green-600 text-lg">✅</span>
          <span className="text-sm font-medium text-green-900">{result.message}</span>
        </div>
        <button onClick={() => { setResult(null); setOpen(false); setSubject(""); setMessage(""); }}
          className="text-xs text-green-600 hover:text-green-700 font-medium mt-1">
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-red-200 p-5 space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="font-display text-base text-surface-900 flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
          </svg>
          Broadcast Alert
        </h3>
        <button onClick={() => setOpen(false)} className="text-surface-400 hover:text-surface-600">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

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

      {/* Subject */}
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="Subject (optional)"
        className="w-full rounded-lg border border-surface-200 px-3 py-2 text-sm text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
      />

      {/* Message */}
      <textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Type your message to all committee heads..."
        rows={4}
        className="w-full rounded-lg border border-surface-200 px-3 py-2.5 text-sm text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none"
      />

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
        <button
          onClick={handleSend}
          disabled={sending || !message.trim()}
          className="bg-red-500 hover:bg-red-600 disabled:bg-surface-300 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all flex items-center gap-2"
        >
          {sending ? (
            <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" /> Sending...</>
          ) : (
            <>Send to All Committee Heads</>
          )}
        </button>
      </div>
    </div>
  );
}

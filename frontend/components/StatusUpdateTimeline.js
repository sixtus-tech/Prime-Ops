"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../lib/auth";

const statusColors = {
  on_track: "bg-green-100 text-green-700",
  at_risk: "bg-amber-100 text-amber-700",
  behind: "bg-red-100 text-red-700",
  ahead: "bg-blue-100 text-blue-700",
  submitted: "bg-blue-100 text-blue-700",
  acknowledged: "bg-green-100 text-green-700",
  flagged: "bg-red-100 text-red-700",
};

function formatBytes(bytes) {
  if (!bytes) return "";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function getMediaIcon(mimeType) {
  if (mimeType?.startsWith("image/")) return "🖼️";
  if (mimeType?.startsWith("video/")) return "🎬";
  if (mimeType?.startsWith("audio/")) return "🎵";
  if (mimeType?.includes("pdf")) return "📄";
  if (mimeType?.includes("spreadsheet") || mimeType?.includes("excel")) return "📊";
  if (mimeType?.includes("word") || mimeType?.includes("document")) return "📝";
  if (mimeType?.includes("presentation")) return "📽️";
  return "📎";
}

export default function StatusUpdateTimeline({ committeeId, eventId, isDirector }) {
  const { authFetch } = useAuth();
  const [updates, setUpdates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [noteText, setNoteText] = useState("");
  const [noting, setNoting] = useState(false);

  const fetchUpdates = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (committeeId) params.set("committeeId", committeeId);
      if (eventId) params.set("eventId", eventId);
      const data = await authFetch(`/status-updates?${params}`);
      setUpdates(data.updates || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [authFetch, committeeId, eventId]);

  useEffect(() => { fetchUpdates(); }, [fetchUpdates]);

  async function handleAcknowledge(id, status) {
    setNoting(true);
    try {
      await authFetch(`/status-updates/${id}/acknowledge`, {
        method: "PUT",
        body: JSON.stringify({ status, notes: noteText }),
      });
      setNoteText("");
      fetchUpdates();
    } catch (err) {
      alert(err.message);
    } finally {
      setNoting(false);
    }
  }

  function safeParse(val) {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch { return []; }
  }

  if (loading) {
    return <div className="flex justify-center py-8"><div className="w-5 h-5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  if (updates.length === 0) {
    return (
      <div className="text-center py-10">
        <div className="text-3xl mb-2">📊</div>
        <p className="text-sm text-surface-500">No status updates yet.</p>
        <p className="text-xs text-surface-400 mt-1">Submit your first update to track progress.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {updates.map((update) => {
        const isExpanded = expandedId === update.id;
        const highlights = safeParse(update.highlights);
        const challenges = safeParse(update.challenges);
        const nextSteps = safeParse(update.nextSteps);
        const metrics = safeParse(update.metrics);
        const evidenceSummary = safeParse(update.evidenceSummary);
        const media = safeParse(update.media);
        const progress = update.progress || 0;

        return (
          <div key={update.id} className="bg-white rounded-xl border border-surface-200 overflow-hidden hover:border-surface-300 transition-colors">
            {/* Header */}
            <div className="p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : update.id)}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {/* Progress circle */}
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="#E2E8F0" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke={progress >= 75 ? "#22c55e" : progress >= 50 ? "#1A8CFF" : progress >= 25 ? "#f59e0b" : "#ef4444"} strokeWidth="3" strokeDasharray={`${(progress / 100) * 94.2} 94.2`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-surface-900">{progress}%</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-surface-900">{update.title || update.committee?.name || "Update"}</p>
                    <p className="text-xs text-surface-400">{update.submittedBy} · {new Date(update.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                    {update.subMilestone && (
                      <span className="inline-flex items-center gap-1 mt-1 text-[10px] bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">
                        🏁 {update.subMilestone.title}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {media.length > 0 && <span className="text-[10px] text-surface-400 bg-surface-100 px-1.5 py-0.5 rounded">📎 {media.length}</span>}
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusColors[update.status] || "bg-gray-100 text-gray-700"}`}>
                    {update.status?.replace(/_/g, " ")}
                  </span>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-surface-400 transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </div>
              </div>
              {/* Summary preview */}
              {update.summary && <p className="text-xs text-surface-500 mt-2 line-clamp-2">{update.summary}</p>}
            </div>

            {/* Expanded content */}
            {isExpanded && (
              <div className="border-t border-surface-100 px-4 py-4 space-y-4">
                {/* Full summary */}
                {update.summary && (
                  <div>
                    <p className="text-xs font-medium text-surface-500 mb-1.5">Executive Summary</p>
                    <p className="text-sm text-surface-700 leading-relaxed">{update.summary}</p>
                  </div>
                )}

                {/* Evidence Analysis */}
                {evidenceSummary.length > 0 && (
                  <div className="bg-indigo-50 rounded-lg p-3">
                    <p className="text-xs font-medium text-indigo-700 mb-1.5">📋 Evidence Analysis</p>
                    {evidenceSummary.map((e, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-indigo-800 mb-1"><span className="text-indigo-500">🔍</span><span>{e}</span></div>
                    ))}
                  </div>
                )}

                {/* Attached Files */}
                {media.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-surface-500 mb-2">Attached Files</p>
                    <div className="flex flex-wrap gap-2">
                      {media.map((m, i) => (
                        <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-50 border border-surface-200 rounded-lg hover:bg-surface-100 text-xs transition-colors">
                          <span>{getMediaIcon(m.mimeType)}</span>
                          <span className="text-surface-700 truncate max-w-[150px]">{m.fileName}</span>
                          {m.sizeBytes && <span className="text-surface-400">{formatBytes(m.sizeBytes)}</span>}
                        </a>
                      ))}
                    </div>
                  </div>
                )}

                {/* Metrics */}
                {metrics.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {metrics.map((m, i) => (
                      <div key={i} className="bg-surface-50 rounded-lg p-3">
                        <p className="text-[10px] text-surface-400 uppercase">{m.label}</p>
                        <p className="text-sm font-bold text-surface-900">{m.value}</p>
                        {m.target && <p className="text-[10px] text-surface-400">Target: {m.target}</p>}
                      </div>
                    ))}
                  </div>
                )}

                {/* Accomplishments */}
                {highlights.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-surface-500 mb-1.5">Key Accomplishments</p>
                    {highlights.map((a, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-surface-700 mb-1"><span className="text-green-500">✓</span><span>{a}</span></div>
                    ))}
                  </div>
                )}

                {/* Challenges */}
                {challenges.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-surface-500 mb-1.5">Challenges</p>
                    {challenges.map((c, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-surface-600 mb-1"><span className="text-orange-500">⚠</span><span>{c}</span></div>
                    ))}
                  </div>
                )}

                {/* Next Steps */}
                {nextSteps.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-surface-500 mb-1.5">Next Steps</p>
                    {nextSteps.map((n, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-surface-600 mb-1"><span className="text-blue-500">→</span><span>{n}</span></div>
                    ))}
                  </div>
                )}

                {/* Director notes */}
                {update.directorNotes && (
                  <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                    <p className="text-[10px] font-medium text-purple-700 uppercase">Director Notes</p>
                    <p className="text-xs text-purple-800 mt-1">{update.directorNotes}</p>
                  </div>
                )}

                {/* Download */}
                <div className="flex justify-end pt-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const lines = [`STATUS UPDATE REPORT`, `${"=".repeat(50)}`, `Committee: ${update.committee?.name || "N/A"}`, `Submitted by: ${update.submittedBy}`, `Date: ${new Date(update.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`, `Progress: ${progress}%`, `Status: ${update.status}`, "", "SUMMARY", update.summary || "N/A", ""];
                      if (evidenceSummary.length > 0) { lines.push("EVIDENCE ANALYSIS"); evidenceSummary.forEach((e) => lines.push(`  🔍 ${e}`)); lines.push(""); }
                      if (highlights.length > 0) { lines.push("KEY ACCOMPLISHMENTS"); highlights.forEach((a) => lines.push(`  ✓ ${a}`)); lines.push(""); }
                      if (challenges.length > 0) { lines.push("CHALLENGES"); challenges.forEach((c) => lines.push(`  ⚠ ${c}`)); lines.push(""); }
                      if (nextSteps.length > 0) { lines.push("NEXT STEPS"); nextSteps.forEach((n) => lines.push(`  → ${n}`)); lines.push(""); }
                      if (metrics.length > 0) { lines.push("METRICS"); metrics.forEach((m) => lines.push(`  ${m.label}: ${m.value}${m.target ? ` (Target: ${m.target})` : ""}`)); lines.push(""); }
                      if (media.length > 0) { lines.push("ATTACHED FILES"); media.forEach((m) => lines.push(`  📎 ${m.fileName}${m.url ? ` — ${m.url}` : ""}`)); lines.push(""); }
                      lines.push(`${"=".repeat(50)}`, "Generated by Prime Ops AI");
                      const blob = new Blob([lines.join("\n")], { type: "text/plain" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url;
                      a.download = `status-update-${update.committee?.name?.replace(/\s+/g, "-") || "report"}-${new Date(update.createdAt).toISOString().slice(0, 10)}.txt`; a.click(); URL.revokeObjectURL(url);
                    }}
                    className="flex items-center gap-1.5 text-[11px] text-surface-500 hover:text-brand-600 font-medium transition-colors"
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                    Download Report
                  </button>
                </div>

                {/* Director actions */}
                {isDirector && (update.status === "on_track" || update.status === "submitted") && (
                  <div className="border-t border-surface-100 pt-3 space-y-2">
                    <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add a note (optional)..." rows={2} className="w-full rounded-lg border border-surface-200 px-3 py-2 text-xs text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-1 focus:ring-brand-400 resize-none" />
                    <div className="flex gap-2">
                      <button onClick={() => handleAcknowledge(update.id, "acknowledged")} disabled={noting} className="text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1.5 rounded-lg font-medium transition-all">✓ Acknowledge</button>
                      <button onClick={() => handleAcknowledge(update.id, "flagged")} disabled={noting} className="text-xs bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-medium transition-all">⚠ Flag Issue</button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

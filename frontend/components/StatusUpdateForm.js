"use client";

import { useState, useRef, useEffect } from "react";
import { useAuth } from "../lib/auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

const FILE_ICONS = { "application/pdf": "📄", "application/msword": "📝", "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📝", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "📊", "application/vnd.openxmlformats-officedocument.presentationml.presentation": "📽️", "text/plain": "📃", "text/csv": "📊" };
function getFileIcon(file) { if (file.type?.startsWith("image/")) return null; if (file.type?.startsWith("video/")) return "🎬"; if (file.type?.startsWith("audio/")) return "🎵"; return FILE_ICONS[file.type] || "📎"; }
function formatBytes(bytes) { if (!bytes) return ""; if (bytes < 1024) return bytes + " B"; if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB"; return (bytes / 1048576).toFixed(1) + " MB"; }
function getMediaIcon(mimeType) { if (mimeType?.startsWith("image/")) return "🖼️"; if (mimeType?.startsWith("video/")) return "🎬"; if (mimeType?.startsWith("audio/")) return "🎵"; if (mimeType?.includes("pdf")) return "📄"; if (mimeType?.includes("spreadsheet") || mimeType?.includes("excel")) return "📊"; if (mimeType?.includes("word") || mimeType?.includes("document")) return "📝"; if (mimeType?.includes("presentation")) return "📽️"; return "📎"; }

const MS_STATUS_DOTS = { not_started: "bg-surface-400", in_progress: "bg-blue-500", completed: "bg-green-500", verified: "bg-emerald-500", pending_approval: "bg-amber-500", at_risk: "bg-red-500" };

function MilestoneTagSelector({ committeeId, value, onChange }) {
  const [milestones, setMilestones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!committeeId) return;
    setLoading(true);
    fetch(`${API_URL}/milestones/committee/${committeeId}`)
      .then((r) => r.json())
      .then((data) => { if (data.subMilestones) setMilestones(data.subMilestones.filter((s) => s.status !== "completed" && s.status !== "verified")); })
      .catch(() => setMilestones([]))
      .finally(() => setLoading(false));
  }, [committeeId]);

  useEffect(() => {
    function h(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false); }
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  if (!loading && milestones.length === 0) return null;
  const selected = milestones.find((m) => m.id === value);
  const grouped = milestones.reduce((acc, sub) => { const phase = sub.milestone?.phase || 0; const t = sub.milestone?.title || "Other"; const k = `${phase}-${t}`; if (!acc[k]) acc[k] = { phase, title: t, subs: [] }; acc[k].subs.push(sub); return acc; }, {});
  const groups = Object.values(grouped).sort((a, b) => a.phase - b.phase);

  return (
    <div ref={ref} className="relative">
      <label className="block text-xs font-medium text-surface-500 mb-1.5">
        <span className="flex items-center gap-1.5">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z" /><line x1="7" y1="7" x2="7.01" y2="7" /></svg>
          Link to milestone <span className="text-surface-300 font-normal">(optional)</span>
        </span>
      </label>
      <button type="button" onClick={() => setOpen(!open)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl border text-left text-sm transition-all ${value ? "border-indigo-300 bg-indigo-50/50 text-indigo-700" : "border-surface-200 bg-white text-surface-500 hover:border-surface-300"}`}>
        {loading ? <span className="flex items-center gap-2 text-surface-400"><div className="w-3 h-3 border-2 border-surface-300 border-t-transparent rounded-full animate-spin" />Loading...</span> : selected ? <span className="flex items-center gap-2 truncate"><span className="text-[10px] font-bold text-indigo-400 bg-indigo-100 px-1.5 py-0.5 rounded flex-shrink-0">P{selected.milestone?.phase || "?"}</span><span className="truncate">{selected.title}</span></span> : <span>Select a milestone...</span>}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`flex-shrink-0 transition-transform ${open ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9" /></svg>
      </button>
      {value && <button type="button" onClick={(e) => { e.stopPropagation(); onChange(null); setOpen(false); }} className="absolute right-8 top-[30px] text-surface-400 hover:text-surface-600 p-0.5"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg></button>}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-surface-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {groups.map((group) => (
            <div key={`${group.phase}-${group.title}`}>
              <div className="px-3 py-2 bg-surface-50 border-b border-surface-100 sticky top-0"><span className="text-[10px] font-bold text-brand-500">Phase {group.phase}</span><span className="text-[10px] text-surface-400 ml-1.5">— {group.title}</span></div>
              {group.subs.map((sub) => (<button key={sub.id} type="button" onClick={() => { onChange(sub.id); setOpen(false); }} className={`w-full px-3 py-2.5 text-left flex items-center gap-2 text-sm hover:bg-surface-50 ${sub.id === value ? "bg-indigo-50 text-indigo-700" : "text-surface-700"}`}><span className={`w-2 h-2 rounded-full flex-shrink-0 ${MS_STATUS_DOTS[sub.status] || "bg-surface-300"}`} /><span className="truncate">{sub.title}</span>{sub.id === value && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="ml-auto text-indigo-500"><polyline points="20 6 9 17 4 12" /></svg>}</button>))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
export default function StatusUpdateForm({ committeeId, committeeName, onSubmitted }) {
  const { authFetch } = useAuth();
  const [text, setText] = useState("");
  const [files, setFiles] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [preview, setPreview] = useState(null); // AI preview before submit
  const [submitted, setSubmitted] = useState(null); // After confirmed submit
  const [milestoneId, setMilestoneId] = useState(null);
  const fileRef = useRef(null);
  const [recording, setRecording] = useState(false);
  const [voiceText, setVoiceText] = useState("");
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder.current = new MediaRecorder(stream);
      audioChunks.current = [];
      mediaRecorder.current.ondataavailable = (e) => audioChunks.current.push(e.data);
      mediaRecorder.current.onstop = async () => {
        const blob = new Blob(audioChunks.current, { type: "audio/webm" });
        stream.getTracks().forEach((t) => t.stop());
        const formData = new FormData();
        formData.append("audio", blob, "voice.webm");
        try { const res = await fetch(`${API_URL}/proposal/transcribe`, { method: "POST", body: formData }); const data = await res.json(); if (data.transcription) setVoiceText(data.transcription); } catch { alert("Failed to transcribe voice."); }
      };
      mediaRecorder.current.start();
      setRecording(true);
    } catch { alert("Microphone access denied."); }
  }
  function stopRecording() { if (mediaRecorder.current?.state === "recording") mediaRecorder.current.stop(); setRecording(false); }
  function handleFileChange(e) { setFiles((prev) => [...prev, ...Array.from(e.target.files)]); }
  function removeFile(idx) { setFiles((prev) => prev.filter((_, i) => i !== idx)); }

  // ── Step 1: Generate Preview ──
  async function handleGenerate() {
    if (!text.trim() && !voiceText && files.length === 0) return alert("Please provide some input.");
    setGenerating(true);
    try {
      const formData = new FormData();
      formData.append("committeeId", committeeId);
      if (text.trim()) formData.append("rawText", text.trim());
      if (voiceText) formData.append("voiceTranscription", voiceText);
      if (milestoneId) formData.append("subMilestoneId", milestoneId);
      files.forEach((f) => formData.append("media", f));

      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/status-updates/preview`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPreview(data.preview);
    } catch (err) {
      alert("Failed to generate: " + err.message);
    } finally {
      setGenerating(false);
    }
  }

  // ── Step 2: Confirm & Submit ──
  async function handleSubmit() {
    if (!preview) return;
    setSubmitting(true);
    try {
      const data = await authFetch("/status-updates/submit", {
        method: "POST",
        body: JSON.stringify({
          committeeId: preview.committeeId,
          eventId: preview.eventId,
          summary: preview.summary,
          progress: preview.progress,
          statusLevel: preview.statusLevel,
          keyAccomplishments: preview.keyAccomplishments,
          challenges: preview.challenges,
          nextSteps: preview.nextSteps,
          metrics: preview.metrics,
          evidenceSummary: preview.evidenceSummary,
          media: preview.media,
          rawContent: preview.rawContent,
          subMilestoneId: preview.subMilestoneId,
        }),
      });
      setSubmitted(data.update);
    } catch (err) {
      alert("Failed to submit: " + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleReset() {
    setText(""); setVoiceText(""); setFiles([]); setPreview(null); setSubmitted(null); setMilestoneId(null);
    if (onSubmitted) onSubmitted();
  }

  function handleBackToEdit() {
    setPreview(null);
  }

  const parse = (val) => { try { return typeof val === "string" ? JSON.parse(val) : (val || []); } catch { return []; } };

  // ═══ SUBMITTED CONFIRMATION ═══
  if (submitted) {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2">
          <span className="text-green-600 text-lg">✅</span>
          <div>
            <span className="text-sm font-medium text-green-900">Status update submitted successfully!</span>
            {submitted.subMilestone && <span className="ml-2 text-xs bg-indigo-100 text-indigo-600 px-2 py-0.5 rounded-full font-medium">Linked to: {submitted.subMilestone.title}</span>}
          </div>
        </div>
        <button onClick={handleReset} className="text-sm text-brand-500 hover:text-brand-600 font-medium">Submit Another Update</button>
      </div>
    );
  }

  // ═══ PREVIEW MODE (before submit) ═══
  if (preview) {
    const accomplishments = parse(preview.keyAccomplishments);
    const challenges = parse(preview.challenges);
    const nextSteps = parse(preview.nextSteps);
    const metrics = parse(preview.metrics);
    const evidenceSummary = parse(preview.evidenceSummary);
    const media = preview.media || [];

    return (
      <div className="space-y-4 animate-fade-in">
        {/* Preview banner */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <span className="text-amber-600 text-lg">👁️</span>
            <div>
              <p className="text-sm font-medium text-amber-900">Preview — Review before submitting</p>
              <p className="text-xs text-amber-700 mt-0.5">This is what your status update will look like. Review it and click Submit when ready.</p>
            </div>
          </div>
        </div>

        {/* Progress */}
        <div className="bg-white rounded-xl border border-surface-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-display text-surface-900">Overall Progress</span>
            <span className="text-2xl font-bold text-brand-500">{preview.progress || 0}%</span>
          </div>
          <div className="w-full h-3 bg-surface-100 rounded-full overflow-hidden">
            <div className="h-full bg-brand-500 rounded-full transition-all duration-1000" style={{ width: `${preview.progress || 0}%` }} />
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-xl border border-surface-200 p-5">
          <h4 className="text-sm font-display text-surface-900 mb-2">Executive Summary</h4>
          <p className="text-sm text-surface-600 leading-relaxed">{preview.summary}</p>
        </div>

        {/* Evidence Analysis */}
        {evidenceSummary.length > 0 && (
          <div className="bg-indigo-50 rounded-xl border border-indigo-200 p-5">
            <h4 className="text-sm font-display text-indigo-900 mb-2">📋 Evidence Analysis</h4>
            {evidenceSummary.map((e, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-indigo-800 mb-2"><span className="text-indigo-500 mt-0.5">🔍</span><span>{e}</span></div>
            ))}
          </div>
        )}

        {/* Attached Files */}
        {media.length > 0 && (
          <div className="bg-white rounded-xl border border-surface-200 p-5">
            <h4 className="text-sm font-display text-surface-900 mb-3">Attached Files ({media.length})</h4>
            <div className="flex flex-wrap gap-3">
              {media.map((m, i) => (
                <a key={i} href={m.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-surface-50 border border-surface-200 rounded-lg hover:bg-surface-100 transition-colors">
                  <span className="text-lg">{getMediaIcon(m.mimeType)}</span>
                  <div><p className="text-xs font-medium text-surface-700 truncate max-w-[200px]">{m.fileName}</p>{m.sizeBytes && <p className="text-[10px] text-surface-400">{formatBytes(m.sizeBytes)}</p>}</div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Metrics */}
        {metrics.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {metrics.map((m, i) => (
              <div key={i} className="bg-white rounded-xl border border-surface-200 p-4">
                <p className="text-[11px] text-surface-400 uppercase tracking-wider">{m.label}</p>
                <p className="text-lg font-bold text-surface-900 mt-0.5">{m.value}</p>
                {m.target && <p className="text-[11px] text-surface-400">Target: {m.target}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Accomplishments */}
        {accomplishments.length > 0 && (
          <div className="bg-white rounded-xl border border-surface-200 p-5">
            <h4 className="text-sm font-display text-surface-900 mb-2">Key Accomplishments</h4>
            {accomplishments.map((a, i) => (<div key={i} className="flex items-start gap-2 text-sm text-surface-700 mb-1.5"><span className="text-green-500 mt-0.5">✓</span><span>{a}</span></div>))}
          </div>
        )}

        {/* Challenges + Next Steps */}
        <div className="grid grid-cols-2 gap-3">
          {challenges.length > 0 && (
            <div className="bg-white rounded-xl border border-surface-200 p-5">
              <h4 className="text-sm font-display text-surface-900 mb-2">Challenges</h4>
              {challenges.map((c, i) => (<div key={i} className="flex items-start gap-2 text-xs text-surface-600 mb-1.5"><span className="text-orange-500 mt-0.5">⚠</span><span>{c}</span></div>))}
            </div>
          )}
          {nextSteps.length > 0 && (
            <div className="bg-white rounded-xl border border-surface-200 p-5">
              <h4 className="text-sm font-display text-surface-900 mb-2">Next Steps</h4>
              {nextSteps.map((n, i) => (<div key={i} className="flex items-start gap-2 text-xs text-surface-600 mb-1.5"><span className="text-blue-500 mt-0.5">→</span><span>{n}</span></div>))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleSubmit} disabled={submitting}
            className="flex-1 bg-green-500 hover:bg-green-600 disabled:bg-surface-300 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2">
            {submitting ? (<><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Submitting...</>) : (<>✓ Submit Update</>)}
          </button>
          <button onClick={handleBackToEdit} className="px-6 py-3 rounded-xl border border-surface-200 text-sm font-medium text-surface-600 hover:bg-surface-50 transition-all">
            ← Edit
          </button>
          <button onClick={() => {
            const lines = [`STATUS UPDATE — ${committeeName || "Committee"}`, `Progress: ${preview.progress || 0}%`, "", "SUMMARY", preview.summary, "", "ACCOMPLISHMENTS", ...accomplishments.map((a) => `  ✓ ${a}`), "", "CHALLENGES", ...challenges.map((c) => `  ⚠ ${c}`), "", "NEXT STEPS", ...nextSteps.map((n) => `  → ${n}`), "", "METRICS", ...metrics.map((m) => `  ${m.label}: ${m.value}${m.target ? ` (Target: ${m.target})` : ""}`)].join("\n");
            const blob = new Blob([lines], { type: "text/plain" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url;
            a.download = `preview-${committeeName?.replace(/\s+/g, "-") || "report"}-${new Date().toISOString().slice(0, 10)}.txt`; a.click(); URL.revokeObjectURL(url);
          }} className="px-4 py-3 rounded-xl border border-surface-200 text-sm font-medium text-surface-500 hover:bg-surface-50 transition-all" title="Download preview">
            ↓
          </button>
        </div>
      </div>
    );
  }

  // ═══ INPUT FORM ═══
  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-sm text-blue-800">Share your progress — type notes, upload photos, documents (PDF, Word, Excel), or record a voice update. Everything will be analyzed to generate a professional, measurable status report for you to review before submitting.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-surface-700 mb-1">What have you been working on?</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. We've confirmed 3 out of 5 vendors, finalized the seating layout for 500 guests..." rows={4} className="w-full rounded-xl border border-surface-200 px-4 py-3 text-sm text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 resize-none" />
      </div>

      <MilestoneTagSelector committeeId={committeeId} value={milestoneId} onChange={setMilestoneId} />

      <div className="flex items-center gap-3">
        <button onClick={recording ? stopRecording : startRecording} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${recording ? "bg-red-500 text-white animate-pulse" : "bg-surface-100 text-surface-600 hover:bg-surface-200"}`}>
          {recording ? <><div className="w-3 h-3 bg-white rounded-full" /> Stop Recording</> : <><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>Voice Update</>}
        </button>
        {voiceText && <div className="flex-1 bg-green-50 border border-green-200 rounded-lg px-3 py-2"><p className="text-xs text-green-700 font-medium">Transcribed:</p><p className="text-xs text-green-600 mt-0.5">{voiceText.substring(0, 150)}...</p></div>}
      </div>

      <div>
        <button onClick={() => fileRef.current?.click()} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface-100 text-surface-600 hover:bg-surface-200 transition-all">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
          Upload Files (Photos, PDFs, Docs, Spreadsheets...)
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.pptx,.ppt" multiple onChange={handleFileChange} className="hidden" />
        {files.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {files.map((f, i) => {
              const icon = getFileIcon(f);
              return (
                <div key={i} className="relative group">
                  <div className="w-20 h-20 rounded-lg bg-surface-100 border border-surface-200 flex items-center justify-center overflow-hidden">
                    {f.type.startsWith("image/") ? <img src={URL.createObjectURL(f)} alt="" className="w-full h-full object-cover" /> : <span className="text-2xl">{icon}</span>}
                  </div>
                  <button onClick={() => removeFile(i)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">×</button>
                  <p className="text-[9px] text-surface-400 mt-0.5 truncate w-20">{f.name}</p>
                  <p className="text-[8px] text-surface-300">{formatBytes(f.size)}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <button onClick={handleGenerate} disabled={generating || (!text.trim() && !voiceText && files.length === 0)}
        className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-surface-300 text-white font-medium py-3 rounded-xl transition-all flex items-center justify-center gap-2">
        {generating ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Analyzing your files...</> : <><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" /></svg>Generate Preview</>}
      </button>
    </div>
  );
}

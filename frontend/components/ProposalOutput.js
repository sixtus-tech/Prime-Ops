"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../lib/api";

// ─── Small helper components ─────────────────────────────────────────

function SectionCard({ title, icon, children, className = "", delay = 0 }) {
  return (
    <div
      className={`bg-white rounded-2xl border border-surface-200 p-6 animate-slide-up opacity-0 ${className}`}
      style={{ animationDelay: `${delay * 0.08}s`, animationFillMode: "forwards" }}
    >
      <h3 className="flex items-center gap-2.5 text-lg font-display text-surface-900 mb-4">
        <span className="text-xl">{icon}</span>
        {title}
      </h3>
      {children}
    </div>
  );
}

function Tag({ children, color = "brand" }) {
  const colors = {
    brand: "bg-brand-100 text-brand-700",
    gray: "bg-surface-100 text-surface-700",
    green: "bg-green-100 text-green-700",
    blue: "bg-blue-100 text-blue-700",
  };
  return (
    <span
      className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${colors[color]}`}
    >
      {children}
    </span>
  );
}

// ─── Main component ──────────────────────────────────────────────────

export default function ProposalOutput({ proposal, proposalId, transcript, onReset }) {
  const printRef = useRef(null);
  const router = useRouter();
  const [creating, setCreating] = useState(false);

  async function handleCreateEvent() {
    setCreating(true);
    try {
      const data = await api.createEventFromProposal({
        proposalId,
        proposal,
      });
      // Redirect to event page with flag to open deadline setter
      router.push(`/events/${data.event.id}?setDeadlines=true`);
    } catch (err) {
      alert("Failed to create event: " + err.message);
      setCreating(false);
    }
  }

  // Handle raw/unparsed response
  if (proposal.parseError) {
    return (
      <section className="mt-10 animate-fade-in">
        <div className="bg-yellow-50 border border-yellow-200 rounded-2xl p-6">
          <p className="text-yellow-800 font-medium mb-2">
            Proposal generated but couldn&apos;t be structured
          </p>
          <pre className="whitespace-pre-wrap text-sm text-surface-700 bg-white rounded-xl p-4 mt-3 border">
            {proposal.raw}
          </pre>
        </div>
        <button onClick={onReset} className="mt-4 text-brand-500 font-medium text-sm">
          ← Start over
        </button>
      </section>
    );
  }

  const p = proposal;

  return (
    <section className="mt-10" ref={printRef}>
      {/* Top bar — actions */}
      <div className="flex items-center justify-between mb-6 no-print">
        <button
          onClick={onReset}
          className="flex items-center gap-2 text-surface-500 hover:text-surface-700 text-sm font-medium transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          New proposal
        </button>
        <div className="flex gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-surface-200 text-surface-600 hover:bg-surface-50 text-sm font-medium transition-all"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 6 2 18 2 18 9" />
              <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
              <rect width="12" height="8" x="6" y="14" />
            </svg>
            Print
          </button>
          {proposalId && (
            <button
              onClick={() => {
                const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
                window.open(`${API}/proposal/${proposalId}/pdf`, "_blank");
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-sm font-medium transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
              Download PDF
            </button>
          )}
          <button
            onClick={() => {
              const json = JSON.stringify(proposal, null, 2);
              const blob = new Blob([json], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = `${p.title?.replace(/\s+/g, "-") || "proposal"}.json`;
              a.click();
              URL.revokeObjectURL(url);
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-900 text-white hover:bg-surface-800 text-sm font-medium transition-all shadow-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" x2="12" y1="15" y2="3" />
            </svg>
            Export JSON
          </button>
          <button
            onClick={handleCreateEvent}
            disabled={creating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white hover:bg-brand-600 disabled:bg-brand-300 text-sm font-medium transition-all shadow-sm"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
              <line x1="16" x2="16" y1="2" y2="6"/>
              <line x1="8" x2="8" y1="2" y2="6"/>
              <line x1="3" x2="21" y1="10" y2="10"/>
              <line x1="12" x2="12" y1="14" y2="18"/>
              <line x1="10" x2="14" y1="16" y2="16"/>
            </svg>
            {creating ? "Creating..." : "Create Event"}
          </button>
        </div>
      </div>

      {/* Transcript (if from voice) */}
      {transcript && (
        <div className="mb-6 bg-surface-100 rounded-xl p-4 animate-fade-in">
          <p className="text-xs font-medium text-surface-500 mb-1 uppercase tracking-wide">
            🎤 Voice transcript
          </p>
          <p className="text-surface-700 text-sm leading-relaxed italic">
            &ldquo;{transcript}&rdquo;
          </p>
        </div>
      )}

      {/* ─── HERO HEADER ─── */}
      <div className="bg-brand-600 text-white rounded-2xl p-8 sm:p-10 mb-6 animate-slide-up opacity-0" style={{ animationFillMode: "forwards" }}>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            {p.eventType && <Tag color="brand">{p.eventType}</Tag>}
            <h2 className="font-display text-3xl sm:text-4xl mt-3 leading-tight">
              {p.title}
            </h2>
            {p.subtitle && (
              <p className="text-white/70 mt-2 text-lg">{p.subtitle}</p>
            )}
          </div>
          {p.targetAudience?.estimatedAttendance && (
            <div className="text-right">
              <p className="text-white/60 text-xs uppercase tracking-wide">
                Est. attendance
              </p>
              <p className="text-2xl font-display text-white mt-1">
                {p.targetAudience.estimatedAttendance}
              </p>
            </div>
          )}
        </div>

        {p.summary && (
          <p className="mt-6 text-white/70 leading-relaxed max-w-3xl">
            {p.summary}
          </p>
        )}

        {/* Quick stats */}
        <div className="flex flex-wrap gap-4 mt-6 pt-6 border-t border-white/10">
          {p.dateRecommendation?.suggestedTimeframe && (
            <div>
              <p className="text-white/60 text-xs">When</p>
              <p className="text-white text-sm font-medium">
                {p.dateRecommendation.suggestedTimeframe}
              </p>
            </div>
          )}
          {p.dateRecommendation?.duration && (
            <div>
              <p className="text-white/60 text-xs">Duration</p>
              <p className="text-white text-sm font-medium">
                {p.dateRecommendation.duration}
              </p>
            </div>
          )}
          {p.budget?.estimatedTotal && (
            <div>
              <p className="text-white/60 text-xs">Budget</p>
              <p className="text-white text-sm font-medium">
                {p.budget.estimatedTotal}
              </p>
            </div>
          )}
          {p.venue?.type && (
            <div>
              <p className="text-white/60 text-xs">Venue type</p>
              <p className="text-white text-sm font-medium">{p.venue.type}</p>
            </div>
          )}
        </div>
      </div>

      {/* ─── CONTENT GRID ─── */}
      <div className="grid gap-6 sm:grid-cols-2">
        {/* Objectives */}
        {p.objectives?.length > 0 && (
          <SectionCard title="Objectives" icon="🎯" delay={1}>
            <ul className="space-y-2.5">
              {p.objectives.map((obj, i) => (
                <li key={i} className="flex gap-2.5 text-sm text-surface-600">
                  <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  {obj}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}

        {/* Target Audience */}
        {p.targetAudience && (
          <SectionCard title="Target Audience" icon="👥" delay={2}>
            <p className="text-sm text-surface-600 leading-relaxed">
              {p.targetAudience.description}
            </p>
          </SectionCard>
        )}

        {/* Venue */}
        {p.venue && (
          <SectionCard title="Venue" icon="📍" delay={3}>
            {p.venue.requirements?.length > 0 && (
              <div className="mb-3">
                <p className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-2">
                  Requirements
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {p.venue.requirements.map((r, i) => (
                    <Tag key={i} color="gray">{r}</Tag>
                  ))}
                </div>
              </div>
            )}
            {p.venue.suggestions?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-2">
                  Suggested venues
                </p>
                <ul className="space-y-1">
                  {p.venue.suggestions.map((s, i) => (
                    <li key={i} className="text-sm text-surface-600">
                      • {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </SectionCard>
        )}

        {/* Date recommendation */}
        {p.dateRecommendation && (
          <SectionCard title="Timing" icon="📅" delay={4}>
            <p className="text-sm text-surface-600 leading-relaxed">
              {p.dateRecommendation.reasoning}
            </p>
          </SectionCard>
        )}
      </div>

      {/* ─── FULL-WIDTH SECTIONS ─── */}

      {/* Agenda */}
      {p.agenda?.length > 0 && (
        <SectionCard title="Agenda" icon="📋" className="mt-6" delay={5}>
          <div className="space-y-6">
            {p.agenda.map((day, di) => (
              <div key={di}>
                <h4 className="text-sm font-bold text-surface-800 mb-3 pb-2 border-b border-surface-100">
                  {day.day}
                </h4>
                <div className="space-y-3">
                  {day.sessions?.map((s, si) => (
                    <div
                      key={si}
                      className="flex gap-4 items-start text-sm"
                    >
                      <span className="text-xs font-mono text-surface-400 w-32 flex-shrink-0 pt-0.5">
                        {s.time}
                      </span>
                      <div>
                        <p className="font-medium text-surface-800">
                          {s.title}
                        </p>
                        <p className="text-surface-500 mt-0.5">
                          {s.description}
                        </p>
                        {s.speaker && (
                          <Tag color="blue">{s.speaker}</Tag>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Budget */}
      {p.budget && (
        <SectionCard title="Budget" icon="💰" className="mt-6" delay={6}>
          <div className="bg-brand-50 rounded-xl p-4 mb-4 flex items-center justify-between">
            <span className="text-sm font-medium text-surface-700">
              Estimated Total
            </span>
            <span className="text-xl font-display text-brand-700">
              {p.budget.estimatedTotal}
            </span>
          </div>

          {p.budget.breakdown?.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-surface-400 uppercase tracking-wide">
                    <th className="pb-2 font-medium">Category</th>
                    <th className="pb-2 font-medium">Estimate</th>
                    <th className="pb-2 font-medium">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {p.budget.breakdown.map((item, i) => (
                    <tr key={i}>
                      <td className="py-2.5 text-surface-700 font-medium">
                        {item.category}
                      </td>
                      <td className="py-2.5 text-surface-600">
                        {item.estimate}
                      </td>
                      <td className="py-2.5 text-surface-400">{item.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {p.budget.revenueStreams?.length > 0 && (
            <div className="mt-4 pt-4 border-t border-surface-100">
              <p className="text-xs font-medium text-surface-500 uppercase tracking-wide mb-2">
                Revenue Streams
              </p>
              <div className="flex flex-wrap gap-1.5">
                {p.budget.revenueStreams.map((r, i) => (
                  <Tag key={i} color="green">{r}</Tag>
                ))}
              </div>
            </div>
          )}
        </SectionCard>
      )}

      {/* Committees */}
      {p.committees?.length > 0 && (
        <SectionCard title="Committees" icon="🤝" className="mt-6" delay={7}>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {p.committees.map((c, i) => (
              <div
                key={i}
                className="rounded-xl border border-surface-200 p-4 hover:border-brand-200 transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <h5 className="font-medium text-surface-800 text-sm">
                    {c.name}
                  </h5>
                  {c.suggestedSize && (
                    <span className="text-xs text-surface-400">
                      {c.suggestedSize}
                    </span>
                  )}
                </div>
                <ul className="space-y-1">
                  {c.responsibilities?.map((r, ri) => (
                    <li key={ri} className="text-xs text-surface-500">
                      • {r}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Timeline */}
      {p.timeline?.length > 0 && (
        <SectionCard title="Timeline" icon="⏱️" className="mt-6" delay={8}>
          <div className="relative">
            <div className="absolute left-[7px] top-2 bottom-2 w-0.5 bg-surface-200" />
            <div className="space-y-6">
              {p.timeline.map((phase, i) => (
                <div key={i} className="relative pl-8">
                  <div className="absolute left-0 top-1 w-[15px] h-[15px] rounded-full bg-brand-500 border-2 border-white shadow-sm" />
                  <div>
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <h5 className="font-medium text-surface-800 text-sm">
                        {phase.phase}
                      </h5>
                      <span className="text-xs text-surface-400">
                        {phase.timeframe}
                      </span>
                    </div>
                    <ul className="mt-1.5 space-y-1">
                      {phase.tasks?.map((t, ti) => (
                        <li key={ti} className="text-xs text-surface-500">
                          • {t}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </SectionCard>
      )}

      {/* Risks & Success Metrics side by side */}
      <div className="grid sm:grid-cols-2 gap-6 mt-6">
        {p.risks?.length > 0 && (
          <SectionCard title="Risks & Mitigation" icon="⚡" delay={9}>
            <div className="space-y-3">
              {p.risks.map((r, i) => (
                <div key={i} className="text-sm">
                  <p className="text-surface-700 font-medium">{r.risk}</p>
                  <p className="text-surface-400 text-xs mt-0.5">
                    → {r.mitigation}
                  </p>
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {p.successMetrics?.length > 0 && (
          <SectionCard title="Success Metrics" icon="📊" delay={10}>
            <ul className="space-y-2">
              {p.successMetrics.map((m, i) => (
                <li key={i} className="flex gap-2 text-sm text-surface-600">
                  <span className="text-green-500 mt-0.5">✓</span>
                  {m}
                </li>
              ))}
            </ul>
          </SectionCard>
        )}
      </div>

      {/* Additional Notes */}
      {p.additionalNotes && (
        <div className="mt-6 bg-brand-50 border border-brand-100 rounded-2xl p-6 animate-slide-up opacity-0" style={{ animationDelay: "0.88s", animationFillMode: "forwards" }}>
          <h3 className="flex items-center gap-2 text-lg font-display text-surface-900 mb-2">
            <span>💡</span> Additional Recommendations
          </h3>
          <p className="text-sm text-surface-600 leading-relaxed">
            {p.additionalNotes}
          </p>
        </div>
      )}
    </section>
  );
}

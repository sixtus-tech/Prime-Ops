"use client";

/**
 * Full proposal preview — shows all sections of an AI-generated proposal.
 * Used for reviewing before submission and viewing submitted proposals.
 */
export default function ProposalPreview({ proposal, compact = false }) {
  if (!proposal) return null;

  const Section = ({ title, children }) => (
    <div className={compact ? "mb-4" : "mb-6"}>
      <h4 className={`font-display ${compact ? "text-sm" : "text-base"} text-surface-900 mb-2`}>
        {title}
      </h4>
      {children}
    </div>
  );

  const textClass = compact ? "text-xs" : "text-sm";

  return (
    <div className="space-y-1">
      {/* Title & Summary */}
      <div className={compact ? "mb-3" : "mb-5"}>
        <h3 className={`font-display ${compact ? "text-lg" : "text-xl"} text-surface-900`}>
          {proposal.title}
        </h3>
        {proposal.subtitle && (
          <p className={`${textClass} text-brand-600 mt-0.5`}>{proposal.subtitle}</p>
        )}
        {proposal.summary && (
          <p className={`${textClass} text-surface-600 mt-2 leading-relaxed`}>{proposal.summary}</p>
        )}
      </div>

      {/* Objectives */}
      {proposal.objectives?.length > 0 && (
        <Section title="Objectives">
          <div className="space-y-1.5">
            {proposal.objectives.map((obj, i) => (
              <div key={i} className={`flex items-start gap-2 ${textClass} text-surface-700`}>
                <span className="text-brand-500 mt-0.5 flex-shrink-0">●</span>
                <span>{obj}</span>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Target Audience */}
      {proposal.targetAudience && (
        <Section title="Target Audience">
          <p className={`${textClass} text-surface-700`}>{proposal.targetAudience.description}</p>
          {proposal.targetAudience.estimatedAttendance && (
            <p className={`${textClass} text-surface-500 mt-1`}>
              Expected: {proposal.targetAudience.estimatedAttendance} attendees
            </p>
          )}
        </Section>
      )}

      {/* Date & Venue */}
      <div className={`grid grid-cols-2 gap-4 ${compact ? "mb-3" : "mb-5"}`}>
        {proposal.dateRecommendation && (
          <div className="bg-surface-50 rounded-lg p-3">
            <p className={`${textClass} font-medium text-surface-900`}>📅 Date</p>
            <p className={`${textClass} text-surface-600 mt-1`}>{proposal.dateRecommendation.suggestedTimeframe}</p>
            {proposal.dateRecommendation.duration && (
              <p className={`text-xs text-surface-400 mt-0.5`}>{proposal.dateRecommendation.duration}</p>
            )}
          </div>
        )}
        {proposal.venue && (
          <div className="bg-surface-50 rounded-lg p-3">
            <p className={`${textClass} font-medium text-surface-900`}>📍 Venue</p>
            <p className={`${textClass} text-surface-600 mt-1`}>{proposal.venue.type}</p>
            {proposal.venue.suggestions?.length > 0 && (
              <p className={`text-xs text-surface-400 mt-0.5`}>{proposal.venue.suggestions.join(", ")}</p>
            )}
          </div>
        )}
      </div>

      {/* Agenda */}
      {proposal.agenda?.length > 0 && (
        <Section title="Agenda">
          <div className="space-y-3">
            {proposal.agenda.map((day, i) => (
              <div key={i} className="bg-surface-50 rounded-lg p-3">
                <p className={`${textClass} font-medium text-surface-900 mb-2`}>{day.day}</p>
                <div className="space-y-1.5">
                  {day.sessions?.map((s, j) => (
                    <div key={j} className="flex gap-3">
                      <span className="text-xs text-surface-400 font-mono w-28 flex-shrink-0">{s.time}</span>
                      <div>
                        <p className={`${textClass} font-medium text-surface-800`}>{s.title}</p>
                        {s.description && <p className="text-xs text-surface-500 mt-0.5">{s.description}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Budget */}
      {proposal.budget && (
        <Section title="Budget">
          {proposal.budget.estimatedTotal && (
            <p className={`${textClass} font-medium text-surface-900 mb-2`}>
              Total: {proposal.budget.estimatedTotal}
            </p>
          )}
          {proposal.budget.breakdown?.length > 0 && (
            <div className="bg-surface-50 rounded-lg overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-surface-200">
                    <th className="text-left px-3 py-2 text-xs font-medium text-surface-500">Category</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-surface-500">Estimate</th>
                    <th className="text-left px-3 py-2 text-xs font-medium text-surface-500">Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {proposal.budget.breakdown.map((b, i) => (
                    <tr key={i} className="border-b border-surface-100 last:border-0">
                      <td className="px-3 py-2 text-xs text-surface-800">{b.category}</td>
                      <td className="px-3 py-2 text-xs text-surface-600">{b.estimate}</td>
                      <td className="px-3 py-2 text-xs text-surface-400">{b.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}

      {/* Committees / Teams */}
      {proposal.committees?.length > 0 && (
        <Section title="Committees / Teams">
          <div className="grid gap-2">
            {proposal.committees.map((c, i) => (
              <div key={i} className="bg-surface-50 rounded-lg p-3">
                <p className={`${textClass} font-medium text-surface-900`}>{c.name}</p>
                {c.suggestedSize && <p className="text-xs text-surface-400">{c.suggestedSize}</p>}
                {c.responsibilities?.length > 0 && (
                  <ul className="mt-1.5 space-y-0.5">
                    {c.responsibilities.map((r, j) => (
                      <li key={j} className="text-xs text-surface-600 flex items-start gap-1.5">
                        <span className="text-surface-300">–</span> {r}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Timeline */}
      {proposal.timeline?.length > 0 && (
        <Section title="Timeline">
          <div className="space-y-2">
            {proposal.timeline.map((phase, i) => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-3 h-3 rounded-full bg-brand-400 mt-1 flex-shrink-0" />
                <div>
                  <p className={`${textClass} font-medium text-surface-900`}>
                    {phase.phase} <span className="font-normal text-surface-400">— {phase.timeframe}</span>
                  </p>
                  {phase.tasks?.length > 0 && (
                    <ul className="mt-1 space-y-0.5">
                      {phase.tasks.map((t, j) => (
                        <li key={j} className="text-xs text-surface-600">• {t}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Risks */}
      {proposal.risks?.length > 0 && (
        <Section title="Risks & Mitigation">
          <div className="space-y-2">
            {proposal.risks.map((r, i) => (
              <div key={i} className="bg-red-50/50 rounded-lg p-3">
                <p className={`${textClass} font-medium text-red-800`}>⚠ {r.risk}</p>
                <p className="text-xs text-red-600 mt-1">Mitigation: {r.mitigation}</p>
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* Success Metrics */}
      {proposal.successMetrics?.length > 0 && (
        <Section title="Success Metrics">
          <div className="space-y-1">
            {proposal.successMetrics.map((m, i) => (
              <div key={i} className={`flex items-start gap-2 ${textClass} text-surface-700`}>
                <span className="text-green-500">✓</span>
                <span>{m}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

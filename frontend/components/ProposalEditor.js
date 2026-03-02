"use client";
import { useState } from "react";

export default function ProposalEditor({ proposal, onSave, onCancel }) {
  const [data, setData] = useState(JSON.parse(JSON.stringify(proposal)));

  function set(path, value) {
    setData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!obj[keys[i]]) obj[keys[i]] = {};
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
  }

  function setArrayItem(path, index, value) {
    setData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = next;
      for (const k of keys) obj = obj[k];
      obj[index] = value;
      return next;
    });
  }

  function addArrayItem(path, defaultValue) {
    setData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = next;
      for (const k of keys) {
        if (!obj[k]) obj[k] = [];
        obj = obj[k];
      }
      obj.push(defaultValue);
      return next;
    });
  }

  function removeArrayItem(path, index) {
    setData((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      const keys = path.split(".");
      let obj = next;
      for (const k of keys) obj = obj[k];
      obj.splice(index, 1);
      return next;
    });
  }

  const inputClass = "w-full px-3 py-2 text-sm border border-surface-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent";
  const textareaClass = inputClass + " resize-none";
  const labelClass = "block text-xs font-medium text-surface-500 mb-1";
  const sectionClass = "bg-white border border-surface-200 rounded-xl p-5 mb-4";
  const sectionTitle = "text-base font-semibold text-surface-900 mb-4 flex items-center gap-2";

  return (
    <div>
      {/* Header Actions */}
      <div className="flex items-center justify-between mb-6 bg-white border border-surface-200 rounded-xl p-4 sticky top-0 z-10">
        <h2 className="text-lg font-semibold text-surface-900">Edit Proposal</h2>
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-surface-600 bg-surface-100 hover:bg-surface-200 rounded-lg transition-colors">
            Cancel
          </button>
          <button onClick={() => onSave(data)} className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">
            Save Changes
          </button>
        </div>
      </div>

      {/* Basic Info */}
      <div className={sectionClass}>
        <h3 className={sectionTitle}>📋 Basic Information</h3>
        <div className="space-y-3">
          <div>
            <label className={labelClass}>Event Title</label>
            <input className={inputClass} value={data.title || ""} onChange={(e) => set("title", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Subtitle</label>
            <input className={inputClass} value={data.subtitle || ""} onChange={(e) => set("subtitle", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Event Type</label>
            <select className={inputClass} value={data.eventType || "general"} onChange={(e) => set("eventType", e.target.value)}>
              <option value="church">Church</option>
              <option value="corporate">Corporate</option>
              <option value="general">General</option>
            </select>
          </div>
          <div>
            <label className={labelClass}>Summary</label>
            <textarea className={textareaClass} rows={3} value={data.summary || ""} onChange={(e) => set("summary", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Objectives */}
      <div className={sectionClass}>
        <h3 className={sectionTitle}>🎯 Objectives</h3>
        <div className="space-y-2">
          {(data.objectives || []).map((obj, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-surface-400 w-5">{i + 1}.</span>
              <input className={inputClass} value={obj} onChange={(e) => setArrayItem("objectives", i, e.target.value)} />
              <button onClick={() => removeArrayItem("objectives", i)} className="text-red-400 hover:text-red-600 text-lg px-1" title="Remove">×</button>
            </div>
          ))}
          <button onClick={() => addArrayItem("objectives", "")} className="text-sm text-brand-600 hover:text-brand-800 font-medium mt-1">+ Add objective</button>
        </div>
      </div>

      {/* Target Audience */}
      <div className={sectionClass}>
        <h3 className={sectionTitle}>👥 Target Audience</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Description</label>
            <textarea className={textareaClass} rows={2} value={data.targetAudience?.description || ""} onChange={(e) => set("targetAudience.description", e.target.value)} />
          </div>
          <div>
            <label className={labelClass}>Expected Attendance</label>
            <input className={inputClass} value={data.targetAudience?.estimatedAttendance || ""} onChange={(e) => set("targetAudience.estimatedAttendance", e.target.value)} />
          </div>
        </div>
      </div>

      {/* Date & Venue */}
      <div className={sectionClass}>
        <h3 className={sectionTitle}>📅 Date & Venue</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Suggested Date/Timeframe</label>
              <input className={inputClass} value={data.dateRecommendation?.suggestedTimeframe || ""} onChange={(e) => set("dateRecommendation.suggestedTimeframe", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Duration</label>
              <input className={inputClass} value={data.dateRecommendation?.duration || ""} onChange={(e) => set("dateRecommendation.duration", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Reasoning</label>
              <textarea className={textareaClass} rows={2} value={data.dateRecommendation?.reasoning || ""} onChange={(e) => set("dateRecommendation.reasoning", e.target.value)} />
            </div>
          </div>
          <div className="space-y-3">
            <div>
              <label className={labelClass}>Venue Type</label>
              <input className={inputClass} value={data.venue?.type || ""} onChange={(e) => set("venue.type", e.target.value)} />
            </div>
            <div>
              <label className={labelClass}>Venue Requirements</label>
              <div className="space-y-1">
                {(data.venue?.requirements || []).map((r, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input className={inputClass} value={r} onChange={(e) => { const arr = [...(data.venue?.requirements || [])]; arr[i] = e.target.value; set("venue.requirements", arr); }} />
                    <button onClick={() => { const arr = [...(data.venue?.requirements || [])]; arr.splice(i, 1); set("venue.requirements", arr); }} className="text-red-400 hover:text-red-600 text-lg px-1">×</button>
                  </div>
                ))}
                <button onClick={() => set("venue.requirements", [...(data.venue?.requirements || []), ""])} className="text-sm text-brand-600 hover:text-brand-800 font-medium">+ Add requirement</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Agenda */}
      <div className={sectionClass}>
        <h3 className={sectionTitle}>📋 Agenda</h3>
        <div className="space-y-4">
          {(data.agenda || []).map((day, di) => (
            <div key={di} className="bg-surface-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <input className="text-sm font-semibold text-surface-900 bg-transparent border-b border-surface-300 focus:border-brand-500 focus:outline-none pb-1 w-64" value={day.day || ""} onChange={(e) => { const arr = [...(data.agenda || [])]; arr[di] = { ...arr[di], day: e.target.value }; set("agenda", arr); }} />
                <button onClick={() => { const arr = [...(data.agenda || [])]; arr.splice(di, 1); set("agenda", arr); }} className="text-xs text-red-400 hover:text-red-600">Remove day</button>
              </div>
              <div className="space-y-2">
                {(day.sessions || []).map((s, si) => (
                  <div key={si} className="grid grid-cols-12 gap-2 items-start bg-white rounded-lg p-2">
                    <div className="col-span-3">
                      <input className="w-full px-2 py-1.5 text-xs border border-surface-200 rounded font-mono" placeholder="Time" value={s.time || ""} onChange={(e) => { const arr = [...(data.agenda || [])]; arr[di].sessions[si] = { ...s, time: e.target.value }; set("agenda", arr); }} />
                    </div>
                    <div className="col-span-4">
                      <input className="w-full px-2 py-1.5 text-xs border border-surface-200 rounded" placeholder="Title" value={s.title || ""} onChange={(e) => { const arr = [...(data.agenda || [])]; arr[di].sessions[si] = { ...s, title: e.target.value }; set("agenda", arr); }} />
                    </div>
                    <div className="col-span-4">
                      <input className="w-full px-2 py-1.5 text-xs border border-surface-200 rounded" placeholder="Description" value={s.description || ""} onChange={(e) => { const arr = [...(data.agenda || [])]; arr[di].sessions[si] = { ...s, description: e.target.value }; set("agenda", arr); }} />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <button onClick={() => { const arr = [...(data.agenda || [])]; arr[di].sessions.splice(si, 1); set("agenda", arr); }} className="text-red-400 hover:text-red-600 text-sm">×</button>
                    </div>
                  </div>
                ))}
                <button onClick={() => { const arr = [...(data.agenda || [])]; arr[di].sessions = [...(arr[di].sessions || []), { time: "", title: "", description: "", speaker: "" }]; set("agenda", arr); }} className="text-xs text-brand-600 hover:text-brand-800 font-medium">+ Add session</button>
              </div>
            </div>
          ))}
          <button onClick={() => set("agenda", [...(data.agenda || []), { day: "New Day", sessions: [] }])} className="text-sm text-brand-600 hover:text-brand-800 font-medium">+ Add day</button>
        </div>
      </div>

      {/* Budget */}
      <div className={sectionClass}>
        <h3 className={sectionTitle}>💰 Budget</h3>
        <div className="mb-3">
          <label className={labelClass}>Estimated Total</label>
          <input className={inputClass + " max-w-xs"} value={data.budget?.estimatedTotal || ""} onChange={(e) => set("budget.estimatedTotal", e.target.value)} />
        </div>
        <label className={labelClass}>Breakdown</label>
        <div className="space-y-2">
          {(data.budget?.breakdown || []).map((b, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <div className="col-span-4">
                <input className="w-full px-2 py-1.5 text-xs border border-surface-200 rounded" placeholder="Category" value={b.category || ""} onChange={(e) => { const arr = [...(data.budget?.breakdown || [])]; arr[i] = { ...arr[i], category: e.target.value }; set("budget.breakdown", arr); }} />
              </div>
              <div className="col-span-3">
                <input className="w-full px-2 py-1.5 text-xs border border-surface-200 rounded" placeholder="Estimate" value={b.estimate || ""} onChange={(e) => { const arr = [...(data.budget?.breakdown || [])]; arr[i] = { ...arr[i], estimate: e.target.value }; set("budget.breakdown", arr); }} />
              </div>
              <div className="col-span-4">
                <input className="w-full px-2 py-1.5 text-xs border border-surface-200 rounded" placeholder="Notes" value={b.notes || ""} onChange={(e) => { const arr = [...(data.budget?.breakdown || [])]; arr[i] = { ...arr[i], notes: e.target.value }; set("budget.breakdown", arr); }} />
              </div>
              <div className="col-span-1 flex justify-center">
                <button onClick={() => { const arr = [...(data.budget?.breakdown || [])]; arr.splice(i, 1); set("budget.breakdown", arr); }} className="text-red-400 hover:text-red-600 text-sm">×</button>
              </div>
            </div>
          ))}
          <button onClick={() => set("budget.breakdown", [...(data.budget?.breakdown || []), { category: "", estimate: "", notes: "" }])} className="text-xs text-brand-600 hover:text-brand-800 font-medium">+ Add budget item</button>
        </div>
      </div>

      {/* Committees */}
      <div className={sectionClass}>
        <h3 className={sectionTitle}>👥 Committees / Teams</h3>
        <div className="space-y-3">
          {(data.committees || []).map((c, i) => (
            <div key={i} className="bg-surface-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>Committee Name</label>
                    <input className={inputClass} value={c.name || ""} onChange={(e) => { const arr = [...(data.committees || [])]; arr[i] = { ...arr[i], name: e.target.value }; set("committees", arr); }} />
                  </div>
                  <div>
                    <label className={labelClass}>Suggested Size</label>
                    <input className={inputClass} value={c.suggestedSize || ""} onChange={(e) => { const arr = [...(data.committees || [])]; arr[i] = { ...arr[i], suggestedSize: e.target.value }; set("committees", arr); }} />
                  </div>
                </div>
                <button onClick={() => { const arr = [...(data.committees || [])]; arr.splice(i, 1); set("committees", arr); }} className="text-red-400 hover:text-red-600 text-sm ml-3 mt-4">Remove</button>
              </div>
              <label className={labelClass}>Responsibilities</label>
              <div className="space-y-1">
                {(c.responsibilities || []).map((r, ri) => (
                  <div key={ri} className="flex items-center gap-2">
                    <input className="flex-1 px-2 py-1.5 text-xs border border-surface-200 rounded" value={r} onChange={(e) => { const arr = [...(data.committees || [])]; const resps = [...(arr[i].responsibilities || [])]; resps[ri] = e.target.value; arr[i] = { ...arr[i], responsibilities: resps }; set("committees", arr); }} />
                    <button onClick={() => { const arr = [...(data.committees || [])]; const resps = [...(arr[i].responsibilities || [])]; resps.splice(ri, 1); arr[i] = { ...arr[i], responsibilities: resps }; set("committees", arr); }} className="text-red-400 hover:text-red-600 text-sm">×</button>
                  </div>
                ))}
                <button onClick={() => { const arr = [...(data.committees || [])]; arr[i] = { ...arr[i], responsibilities: [...(arr[i].responsibilities || []), ""] }; set("committees", arr); }} className="text-xs text-brand-600 hover:text-brand-800 font-medium">+ Add responsibility</button>
              </div>
            </div>
          ))}
          <button onClick={() => set("committees", [...(data.committees || []), { name: "", responsibilities: [], suggestedSize: "" }])} className="text-sm text-brand-600 hover:text-brand-800 font-medium">+ Add committee</button>
        </div>
      </div>

      {/* Timeline */}
      <div className={sectionClass}>
        <h3 className={sectionTitle}>⏱ Timeline</h3>
        <div className="space-y-3">
          {(data.timeline || []).map((phase, i) => (
            <div key={i} className="bg-surface-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex-1 grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClass}>Phase</label>
                    <input className={inputClass} value={phase.phase || ""} onChange={(e) => { const arr = [...(data.timeline || [])]; arr[i] = { ...arr[i], phase: e.target.value }; set("timeline", arr); }} />
                  </div>
                  <div>
                    <label className={labelClass}>Timeframe</label>
                    <input className={inputClass} value={phase.timeframe || ""} onChange={(e) => { const arr = [...(data.timeline || [])]; arr[i] = { ...arr[i], timeframe: e.target.value }; set("timeline", arr); }} />
                  </div>
                </div>
                <button onClick={() => { const arr = [...(data.timeline || [])]; arr.splice(i, 1); set("timeline", arr); }} className="text-red-400 hover:text-red-600 text-sm ml-3 mt-4">Remove</button>
              </div>
              <label className={labelClass}>Tasks</label>
              <div className="space-y-1">
                {(phase.tasks || []).map((t, ti) => (
                  <div key={ti} className="flex items-center gap-2">
                    <input className="flex-1 px-2 py-1.5 text-xs border border-surface-200 rounded" value={t} onChange={(e) => { const arr = [...(data.timeline || [])]; const tasks = [...(arr[i].tasks || [])]; tasks[ti] = e.target.value; arr[i] = { ...arr[i], tasks }; set("timeline", arr); }} />
                    <button onClick={() => { const arr = [...(data.timeline || [])]; const tasks = [...(arr[i].tasks || [])]; tasks.splice(ti, 1); arr[i] = { ...arr[i], tasks }; set("timeline", arr); }} className="text-red-400 hover:text-red-600 text-sm">×</button>
                  </div>
                ))}
                <button onClick={() => { const arr = [...(data.timeline || [])]; arr[i] = { ...arr[i], tasks: [...(arr[i].tasks || []), ""] }; set("timeline", arr); }} className="text-xs text-brand-600 hover:text-brand-800 font-medium">+ Add task</button>
              </div>
            </div>
          ))}
          <button onClick={() => set("timeline", [...(data.timeline || []), { phase: "", timeframe: "", tasks: [] }])} className="text-sm text-brand-600 hover:text-brand-800 font-medium">+ Add phase</button>
        </div>
      </div>

      {/* Risks */}
      <div className={sectionClass}>
        <h3 className={sectionTitle}>⚠️ Risks & Mitigation</h3>
        <div className="space-y-2">
          {(data.risks || []).map((r, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-start">
              <div className="col-span-5">
                <input className="w-full px-2 py-1.5 text-xs border border-surface-200 rounded" placeholder="Risk" value={r.risk || ""} onChange={(e) => { const arr = [...(data.risks || [])]; arr[i] = { ...arr[i], risk: e.target.value }; set("risks", arr); }} />
              </div>
              <div className="col-span-6">
                <input className="w-full px-2 py-1.5 text-xs border border-surface-200 rounded" placeholder="Mitigation" value={r.mitigation || ""} onChange={(e) => { const arr = [...(data.risks || [])]; arr[i] = { ...arr[i], mitigation: e.target.value }; set("risks", arr); }} />
              </div>
              <div className="col-span-1 flex justify-center">
                <button onClick={() => { const arr = [...(data.risks || [])]; arr.splice(i, 1); set("risks", arr); }} className="text-red-400 hover:text-red-600 text-sm">×</button>
              </div>
            </div>
          ))}
          <button onClick={() => set("risks", [...(data.risks || []), { risk: "", mitigation: "" }])} className="text-xs text-brand-600 hover:text-brand-800 font-medium">+ Add risk</button>
        </div>
      </div>

      {/* Success Metrics */}
      <div className={sectionClass}>
        <h3 className={sectionTitle}>✅ Success Metrics</h3>
        <div className="space-y-2">
          {(data.successMetrics || []).map((m, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-xs text-green-500">✓</span>
              <input className={inputClass} value={m} onChange={(e) => setArrayItem("successMetrics", i, e.target.value)} />
              <button onClick={() => removeArrayItem("successMetrics", i)} className="text-red-400 hover:text-red-600 text-lg px-1">×</button>
            </div>
          ))}
          <button onClick={() => addArrayItem("successMetrics", "")} className="text-sm text-brand-600 hover:text-brand-800 font-medium">+ Add metric</button>
        </div>
      </div>

      {/* Additional Notes */}
      <div className={sectionClass}>
        <h3 className={sectionTitle}>📝 Additional Notes</h3>
        <textarea className={textareaClass} rows={4} value={data.additionalNotes || ""} onChange={(e) => set("additionalNotes", e.target.value)} />
      </div>

      {/* Bottom Actions */}
      <div className="flex items-center justify-end gap-3 mt-6 mb-10">
        <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-surface-600 bg-surface-100 hover:bg-surface-200 rounded-lg transition-colors">Cancel</button>
        <button onClick={() => onSave(data)} className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 rounded-lg transition-colors">Save Changes</button>
      </div>
    </div>
  );
}

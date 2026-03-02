"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "../../../lib/api";

export default function NewEventPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    subtitle: "",
    eventType: "church",
    summary: "",
    startDate: "",
    endDate: "",
    venue: "",
    venueType: "",
    estimatedAttendance: "",
    estimatedBudget: "",
  });

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const data = await api.createEvent(form);
      router.push(`/events/${data.event.id}`);
    } catch (err) {
      alert("Failed to create event: " + err.message);
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen">
      <div className="bg-brand-600 text-white px-6 lg:px-10 py-10">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1 text-surface-400 hover:text-white text-sm mb-3 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Back
        </button>
        <h1 className="font-display text-3xl">Create New Event</h1>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              Event Title <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set("title", e.target.value)}
              placeholder="e.g. Annual Youth Conference 2026"
              required
              className="w-full rounded-xl border border-surface-200 px-4 py-3 text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
            />
          </div>

          {/* Subtitle */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Subtitle / Theme</label>
            <input
              type="text"
              value={form.subtitle}
              onChange={(e) => set("subtitle", e.target.value)}
              placeholder='e.g. "Rise & Shine — Igniting the Next Generation"'
              className="w-full rounded-xl border border-surface-200 px-4 py-3 text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
            />
          </div>

          {/* Event Type */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Event Type</label>
            <div className="flex gap-2">
              {[
                { value: "church", label: "⛪ Church" },
                { value: "corporate", label: "🏢 Corporate" },
                { value: "general", label: "🌐 General" },
              ].map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => set("eventType", t.value)}
                  className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    form.eventType === t.value
                      ? "bg-surface-900 text-white shadow-md"
                      : "bg-white text-surface-700 border border-surface-200 hover:border-surface-300"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">Summary</label>
            <textarea
              value={form.summary}
              onChange={(e) => set("summary", e.target.value)}
              placeholder="Brief description of the event..."
              rows={3}
              className="w-full rounded-xl border border-surface-200 px-4 py-3 text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 resize-none"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Start Date</label>
              <input
                type="date"
                value={form.startDate}
                onChange={(e) => set("startDate", e.target.value)}
                className="w-full rounded-xl border border-surface-200 px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">End Date</label>
              <input
                type="date"
                value={form.endDate}
                onChange={(e) => set("endDate", e.target.value)}
                className="w-full rounded-xl border border-surface-200 px-4 py-3 text-surface-900 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
              />
            </div>
          </div>

          {/* Venue */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Venue</label>
              <input
                type="text"
                value={form.venue}
                onChange={(e) => set("venue", e.target.value)}
                placeholder="e.g. Grace Convention Center"
                className="w-full rounded-xl border border-surface-200 px-4 py-3 text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Venue Type</label>
              <input
                type="text"
                value={form.venueType}
                onChange={(e) => set("venueType", e.target.value)}
                placeholder="e.g. Conference center"
                className="w-full rounded-xl border border-surface-200 px-4 py-3 text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
              />
            </div>
          </div>

          {/* Estimates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Est. Attendance</label>
              <input
                type="text"
                value={form.estimatedAttendance}
                onChange={(e) => set("estimatedAttendance", e.target.value)}
                placeholder="e.g. 100-150"
                className="w-full rounded-xl border border-surface-200 px-4 py-3 text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">Est. Budget</label>
              <input
                type="text"
                value={form.estimatedBudget}
                onChange={(e) => set("estimatedBudget", e.target.value)}
                placeholder="e.g. $15,000 - $20,000"
                className="w-full rounded-xl border border-surface-200 px-4 py-3 text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
              />
            </div>
          </div>

          {/* Submit */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-6 py-3 rounded-xl border border-surface-200 text-surface-600 hover:bg-surface-50 text-sm font-medium transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !form.title.trim()}
              className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:bg-surface-300 text-white font-medium px-6 py-3 rounded-xl transition-all shadow-md"
            >
              {saving ? "Creating..." : "Create Event"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

"use client";

import { useState } from "react";
import VoiceRecorder from "./VoiceRecorder";
import ChatMode from "./ChatMode";
import DocumentUpload from "./DocumentUpload";

export default function InputSection({ onTextGenerate, onVoiceGenerate, onChatProposalReady }) {
  const [mode, setMode] = useState("text"); // "text" | "voice" | "chat" | "document"
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("church");

  function handleSubmit(e) {
    e.preventDefault();
    if (description.trim().length < 10) return;
    onTextGenerate(description, eventType);
  }

  const tabs = [
    {
      id: "text",
      label: "Type your idea",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
        </svg>
      ),
    },
    {
      id: "chat",
      label: "Chat with Prime Ops",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      id: "document",
      label: "Upload Document",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" x2="12" y1="3" y2="15" />
        </svg>
      ),
    },
    {
      id: "voice",
      label: "Speak your idea",
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      ),
    },
  ];

  return (
    <section className="mt-10 animate-fade-in">
      {/* Event type selector */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-surface-700 mb-2">
          Event type
        </label>
        <div className="flex gap-2">
          {[
            { value: "church", label: "⛪ Church" },
            { value: "corporate", label: "🏢 Corporate" },
            { value: "general", label: "🌐 General" },
          ].map((t) => (
            <button
              key={t.value}
              onClick={() => setEventType(t.value)}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                eventType === t.value
                  ? "bg-surface-900 text-white shadow-md"
                  : "bg-white text-surface-700 border border-surface-200 hover:border-surface-300 hover:bg-surface-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Mode tabs */}
      <div className="bg-white rounded-2xl border border-surface-200 shadow-sm overflow-hidden">
        <div className="flex border-b border-surface-200">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMode(tab.id)}
              className={`flex-1 px-4 py-4 text-sm font-medium flex items-center justify-center gap-2 transition-all ${
                mode === tab.id
                  ? "text-brand-600 border-b-2 border-brand-500 bg-brand-50/50"
                  : "text-surface-500 hover:text-surface-700 hover:bg-surface-50"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="p-6">
          {mode === "text" && (
            <form onSubmit={handleSubmit}>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your event idea... e.g. 'I want to organize a 3-day youth conference for ages 16-25 with worship sessions, breakout workshops on leadership, and a closing gala dinner.'"
                rows={6}
                className="w-full rounded-xl border border-surface-200 px-4 py-3 text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 resize-none text-[15px] leading-relaxed"
              />

              <div className="flex items-center justify-between mt-4">
                <span className="text-xs text-surface-400">
                  {description.length < 10
                    ? `${10 - description.length} more characters needed`
                    : "✓ Ready to generate"}
                </span>
                <button
                  type="submit"
                  disabled={description.trim().length < 10}
                  className="bg-brand-500 hover:bg-brand-600 disabled:bg-surface-300 disabled:cursor-not-allowed text-white font-medium px-6 py-3 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex items-center gap-2"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Generate Proposal
                </button>
              </div>
            </form>
          )}

          {mode === "chat" && (
            <ChatMode
              eventType={eventType}
              onProposalReady={onChatProposalReady}
            />
          )}

          {mode === "document" && (
            <DocumentUpload
              eventType={eventType}
              onProposalReady={onChatProposalReady}
            />
          )}

          {mode === "voice" && (
            <VoiceRecorder
              eventType={eventType}
              onVoiceGenerate={onVoiceGenerate}
            />
          )}
        </div>
      </div>

      {/* Tips */}
      <div className="mt-6 grid sm:grid-cols-4 gap-3">
        {[
          {
            icon: "💡",
            text: "Be specific about audience size, duration, and goals for better results.",
          },
          {
            icon: "💬",
            text: "Try Chat mode — Prime Ops asks you questions step by step. Great if you're unsure where to start!",
          },
          {
            icon: "📄",
            text: "Upload meeting minutes or a previous proposal and Prime Ops will build from it.",
          },
          {
            icon: "🎤",
            text: "Voice input works great — just describe your event naturally.",
          },
        ].map((tip, i) => (
          <div
            key={i}
            className="flex gap-2.5 items-start bg-white rounded-xl border border-surface-200 p-3.5"
          >
            <span className="text-lg">{tip.icon}</span>
            <span className="text-xs text-surface-500 leading-relaxed">
              {tip.text}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

// ─── Typing indicator dots ──────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1 px-4 py-3">
      <div className="flex gap-1">
        <span className="w-2 h-2 rounded-full bg-surface-400 animate-bounce" style={{ animationDelay: "0ms" }} />
        <span className="w-2 h-2 rounded-full bg-surface-400 animate-bounce" style={{ animationDelay: "150ms" }} />
        <span className="w-2 h-2 rounded-full bg-surface-400 animate-bounce" style={{ animationDelay: "300ms" }} />
      </div>
      <span className="text-xs text-surface-400 ml-2">Prime Ops is thinking...</span>
    </div>
  );
}

// ─── Message bubble ─────────────────────────────────────────────────

function MessageBubble({ role, content, isLatest }) {
  const isAI = role === "assistant";

  return (
    <div
      className={`flex ${isAI ? "justify-start" : "justify-end"} animate-fade-in`}
    >
      <div className={`max-w-[80%] ${isAI ? "order-2" : "order-1"}`}>
        {/* Avatar + name */}
        <div className={`flex items-center gap-2 mb-1 ${isAI ? "" : "justify-end"}`}>
          {isAI && (
            <div className="w-6 h-6 rounded-full bg-brand-500 flex items-center justify-center flex-shrink-0">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
              </svg>
            </div>
          )}
          <span className="text-[10px] font-medium text-surface-400">
            {isAI ? "Prime Ops AI" : "You"}
          </span>
        </div>

        {/* Bubble */}
        <div
          className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
            isAI
              ? "bg-white border border-surface-200 text-surface-800 rounded-tl-md"
              : "bg-brand-500 text-white rounded-tr-md"
          }`}
        >
          {content}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN CHAT MODE COMPONENT
// ═══════════════════════════════════════════════════════════════════════

export default function ChatMode({ eventType, onProposalReady, committeeContext }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [started, setStarted] = useState(false);
  const [generating, setGenerating] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Focus input after AI responds
  useEffect(() => {
    if (!loading && inputRef.current) {
      inputRef.current.focus();
    }
  }, [loading]);

  // ── Start conversation ──────────────────────────────────────────

  async function startConversation() {
    setStarted(true);
    setLoading(true);

    try {
      // Send contextual first message
      const firstMessage = committeeContext
        ? `Hi, I'm the ${committeeContext.committeeName} committee head for the ${committeeContext.eventTitle}. I need to create our committee proposal.`
        : "Hi, I'd like to plan an event.";

      const firstMessages = [
        { role: "user", content: firstMessage },
      ];

      const res = await fetch(`${API}/proposal/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: firstMessages, eventType, committeeContext }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMessages([
        { role: "user", content: "Hi, I'd like to plan an event.", hidden: true },
        { role: "assistant", content: data.reply },
      ]);
    } catch (err) {
      console.error(err);
      setMessages([
        {
          role: "assistant",
          content:
            "Hello! I'm your Prime Ops event planning assistant. Let's create something amazing together! What kind of event are you planning?",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // ── Send message ────────────────────────────────────────────────

  async function handleSend(e) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || loading || generating) return;

    const userMsg = { role: "user", content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      // Build API messages (exclude hidden ones from display, include for context)
      const apiMessages = newMessages
        .filter((m) => m.role === "user" || m.role === "assistant")
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch(`${API}/proposal/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages, eventType, committeeContext }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      const assistantMsg = { role: "assistant", content: data.reply };
      setMessages((prev) => [...prev, assistantMsg]);

      // If AI has enough info → generate proposal
      if (data.readyToGenerate && data.summary) {
        setGenerating(true);
        await generateFromChat(data.summary, [...newMessages, assistantMsg]);
      }
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I had a connection issue. Could you repeat that?",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // ── Generate proposal from gathered info ────────────────────────

  async function generateFromChat(summary, allMessages) {
    try {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "✨ Generating your complete proposal now — this takes a few seconds...",
          isSystem: true,
        },
      ]);

      const res = await fetch(`${API}/proposal/chat/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary,
          eventType,
          committeeContext: committeeContext || null,
          messages: allMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      // Pass proposal up to parent
      if (onProposalReady) {
        onProposalReady(data.proposal, data.proposalId, summary);
      }
    } catch (err) {
      console.error(err);
      setGenerating(false);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I had trouble generating the proposal. Let me try a different approach — could you tell me a bit more about the event?",
        },
      ]);
    }
  }

  // ── Force generate (user clicks button) ─────────────────────────

  async function handleForceGenerate() {
    if (messages.filter((m) => m.role === "user" && !m.hidden).length < 2) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "I need just a little more information to create a good proposal. Could you tell me about the purpose and audience for your event?",
        },
      ]);
      return;
    }

    setLoading(true);
    setGenerating(true);

    // Ask Claude to wrap up
    const wrapUpMessages = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
      {
        role: "user",
        content:
          "That's all the info I have. Please generate the proposal now with whatever details we've discussed.",
      },
    ];

    try {
      const res = await fetch(`${API}/proposal/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: wrapUpMessages, eventType, committeeContext }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (data.readyToGenerate && data.summary) {
        await generateFromChat(data.summary, wrapUpMessages);
      } else {
        // Build summary from user messages if AI didn't generate one
        const userContext = messages
          .filter((m) => m.role === "user" && !m.hidden)
          .map((m) => m.content)
          .join(". ");
        await generateFromChat(userContext, wrapUpMessages);
      }
    } catch (err) {
      console.error(err);
      setGenerating(false);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  }

  // ── Pre-start state ─────────────────────────────────────────────

  if (!started) {
    return (
      <div className="text-center py-10">
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center mx-auto mb-5 shadow-lg">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
        <h3 className="font-display text-xl text-surface-900 mb-2">
          {committeeContext
            ? `Let\u0027s build the ${committeeContext.committeeName} proposal`
            : "Let\u0027s plan your event together"}
        </h3>
        <p className="text-surface-500 text-sm max-w-sm mx-auto mb-6">
          {committeeContext
            ? `I already know about the ${committeeContext.eventTitle} and your committee\u0027s responsibilities. I\u0027ll ask a few targeted questions to build your proposal.`
            : "I\u0027ll ask you a few questions about your event, then generate a complete professional proposal from your answers."}
        </p>
        <button
          onClick={startConversation}
          className="bg-brand-500 hover:bg-brand-600 text-white font-medium px-8 py-3 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex items-center gap-2 mx-auto"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Start Conversation
        </button>
      </div>
    );
  }

  // ── Chat UI ─────────────────────────────────────────────────────

  const visibleMessages = messages.filter((m) => !m.hidden);

  return (
    <div className="flex flex-col" style={{ height: "520px" }}>
      {/* Messages area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-4 px-1 py-4 scroll-smooth"
      >
        {visibleMessages.map((msg, i) => (
          <MessageBubble
            key={i}
            role={msg.role}
            content={msg.content}
            isLatest={i === visibleMessages.length - 1}
          />
        ))}

        {loading && <TypingIndicator />}
      </div>

      {/* Input area */}
      {!generating && (
        <div className="border-t border-surface-200 pt-3 mt-2">
          <form onSubmit={handleSend} className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your answer..."
              disabled={loading || generating}
              className="flex-1 rounded-xl border border-surface-200 px-4 py-3 text-sm text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 disabled:bg-surface-50 disabled:text-surface-400"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading || generating}
              className="bg-brand-500 hover:bg-brand-600 disabled:bg-surface-300 text-white px-4 py-3 rounded-xl transition-all flex-shrink-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" x2="11" y1="2" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </form>

          {/* Quick action row */}
          <div className="flex items-center justify-between mt-2.5">
            <span className="text-[10px] text-surface-400">
              {messages.filter((m) => m.role === "user" && !m.hidden).length} messages
            </span>
            <button
              onClick={handleForceGenerate}
              disabled={loading || generating}
              className="text-xs text-brand-500 hover:text-brand-600 disabled:text-surface-300 font-medium flex items-center gap-1 transition-colors"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
              </svg>
              Generate proposal now
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

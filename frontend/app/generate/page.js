"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import InputSection from "../../components/InputSection";
import ProposalPreview from "../../components/ProposalPreview";
import ProposalEditor from "../../components/ProposalEditor";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export default function GeneratePage() {
  const { token } = useAuth();
  const router = useRouter();
  const [proposal, setProposal] = useState(null);
  const [proposalId, setProposalId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");

  async function handleTextGenerate(description, eventType) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/proposals/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ inputText: description, inputType: "text", eventType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setProposal(data.proposal || data);
      setProposalId(data.proposalId || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  async function handleVoiceGenerate(transcript, voiceEventType) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${API}/proposals/generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ inputText: transcript, inputType: "voice", eventType: voiceEventType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Generation failed");
      setProposal(data.proposal || data);
      setProposalId(data.proposalId || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleChatProposalReady(proposalData) {
    setProposal(proposalData);
  }

  async function handleCreateEvent() {
    if (!proposal) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch(`${API}/events/from-proposal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          proposal,
          proposalId: proposalId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create event");
      router.push(`/events/${data.event?.id || data.id}`);
    } catch (err) {
      setError(err.message);
      setCreating(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-surface-900">Proposal Generator</h1>
        <p className="text-surface-500 mt-1">
          Describe your project idea and we'll generate a complete proposal for you.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-6">
          {error}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-20">
          <div className="text-center">
            <div className="w-10 h-10 border-3 border-brand-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-surface-500 text-sm">Generating your proposal...</p>
          </div>
        </div>
      )}

      {!loading && !proposal && (
        <InputSection
          onTextGenerate={handleTextGenerate}
          onVoiceGenerate={handleVoiceGenerate}
          onChatProposalReady={handleChatProposalReady}
        />
      )}

      {!loading && proposal && !editing && (
        <div>
          <div className="flex items-center justify-between mb-6 bg-white border border-surface-200 rounded-xl p-4">
            <button
              onClick={() => {
                setProposal(null);
                setProposalId(null);
                setError("");
              }}
              className="text-sm text-surface-500 hover:text-surface-700 font-medium"
            >
              ← Generate another
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditing(true)}
                className="px-4 py-2 text-sm font-medium text-surface-700 bg-surface-100 hover:bg-surface-200 rounded-lg transition-colors flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                Edit Proposal
              </button>
              <button
                onClick={handleCreateEvent}
                disabled={creating}
                className="px-5 py-2 text-sm font-medium text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-50 rounded-lg transition-colors flex items-center gap-2"
              >
                {creating ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    Create Project
                  </>
                )}
              </button>
            </div>
          </div>
          <ProposalPreview proposal={proposal} />
        </div>
      )}

      {!loading && proposal && editing && (
        <ProposalEditor
          proposal={proposal}
          onSave={(updated) => {
            setProposal(updated);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  );
}

"use client";

import { useState, useRef } from "react";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

/**
 * Upload a document (PDF, TXT, etc.) and optionally add notes.
 * Generates a proposal from the extracted content.
 */
export default function DocumentUpload({ eventType, onProposalReady, committeeContext }) {
  const [file, setFile] = useState(null);
  const [extractedText, setExtractedText] = useState("");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [step, setStep] = useState("upload"); // upload | review | done
  const fileRef = useRef(null);

  async function handleUpload() {
    if (!file) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("document", file);

      const res = await fetch(`${API}/proposal/upload-document`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setExtractedText(data.extractedText);
      setStep("review");
    } catch (err) {
      alert("Failed to upload: " + err.message);
    } finally {
      setUploading(false);
    }
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const res = await fetch(`${API}/proposal/generate-with-context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: notes || "",
          eventType: eventType || "general",
          documentText: extractedText,
          documentName: file?.name,
          committeeContext: committeeContext || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setStep("done");
      if (onProposalReady) {
        onProposalReady(data.proposal, data.proposalId, `Generated from: ${file.name}`);
      }
    } catch (err) {
      alert("Failed to generate: " + err.message);
    } finally {
      setGenerating(false);
    }
  }

  function reset() {
    setFile(null);
    setExtractedText("");
    setNotes("");
    setStep("upload");
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      {/* Step 1: Upload */}
      {step === "upload" && (
        <div>
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
              file ? "border-brand-400 bg-brand-50/30" : "border-surface-200 hover:border-brand-300 hover:bg-surface-50"
            }`}
            onClick={() => fileRef.current?.click()}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.txt,.md,.rtf,.doc,.docx"
              onChange={(e) => setFile(e.target.files[0] || null)}
              className="hidden"
            />
            <div className="text-3xl mb-2">{file ? "📄" : "📁"}</div>
            {file ? (
              <div>
                <p className="text-sm font-medium text-surface-900">{file.name}</p>
                <p className="text-xs text-surface-400 mt-1">
                  {(file.size / 1024).toFixed(0)} KB — Click to change
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-surface-700">
                  Upload meeting minutes, previous proposals, or reference documents
                </p>
                <p className="text-xs text-surface-400 mt-1">
                  Supports: PDF, TXT, MD (max 10MB)
                </p>
              </div>
            )}
          </div>

          {file && (
            <button
              onClick={handleUpload}
              disabled={uploading}
              className="mt-4 w-full bg-brand-500 hover:bg-brand-600 disabled:bg-surface-300 text-white font-medium px-6 py-3 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Extracting text...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" x2="12" y1="3" y2="15" />
                  </svg>
                  Upload & Extract
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Step 2: Review extracted text + add notes */}
      {step === "review" && (
        <div className="space-y-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2">
            <span className="text-green-600">✅</span>
            <div>
              <p className="text-sm font-medium text-green-900">
                Extracted {extractedText.length.toLocaleString()} characters from {file?.name}
              </p>
              <p className="text-xs text-green-600">This document will be used as reference.</p>
            </div>
          </div>

          {/* Preview */}
          <details className="bg-surface-50 rounded-xl border border-surface-200 overflow-hidden">
            <summary className="px-4 py-3 text-sm font-medium text-surface-700 cursor-pointer hover:bg-surface-100 transition-colors">
              Preview extracted text
            </summary>
            <div className="px-4 pb-4 max-h-48 overflow-y-auto">
              <pre className="text-xs text-surface-600 whitespace-pre-wrap font-sans leading-relaxed">
                {extractedText.substring(0, 3000)}{extractedText.length > 3000 ? "..." : ""}
              </pre>
            </div>
          </details>

          {/* Additional notes */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1">
              Additional notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any extra context, changes, or specific focus areas for the AI..."
              rows={3}
              className="w-full rounded-xl border border-surface-200 px-4 py-3 text-surface-900 placeholder-surface-400 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 resize-none text-sm"
            />
          </div>

          <div className="flex gap-3">
            <button
              onClick={reset}
              className="px-4 py-2.5 rounded-xl border border-surface-200 text-surface-600 hover:bg-surface-50 text-sm transition-all"
            >
              Upload different file
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex-1 bg-brand-500 hover:bg-brand-600 disabled:bg-surface-300 text-white font-medium px-6 py-2.5 rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {generating ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Generating proposal...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83" />
                  </svg>
                  Generate Proposal from Document
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="text-center py-6">
          <p className="text-green-600 font-medium mb-2">✅ Proposal generated!</p>
          <button onClick={reset} className="text-sm text-brand-500 hover:text-brand-600 font-medium">
            Upload another document
          </button>
        </div>
      )}
    </div>
  );
}

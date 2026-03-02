"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../../../lib/auth";

const statusStyle = {
  draft: "bg-gray-100 text-gray-700",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  revision_requested: "bg-orange-100 text-orange-700",
};

export default function MyProposalsPage() {
  const { authFetch } = useAuth();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/portal/proposals")
      .then((data) => setProposals(data.proposals))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authFetch]);

  return (
    <main className="min-h-screen">
      <div className="bg-brand-600 text-white px-6 lg:px-10 py-10">
        <h1 className="font-display text-3xl">My Proposals</h1>
        <p className="mt-2 text-white/70">All proposals across your committees.</p>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : proposals.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-surface-200">
            <div className="text-4xl mb-3">📄</div>
            <h3 className="font-display text-lg text-surface-900 mb-1">No proposals yet</h3>
            <p className="text-surface-500 text-sm">
              Go to one of your committees to create a proposal.
            </p>
            <Link
              href="/portal"
              className="inline-block mt-4 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-all"
            >
              View My Committees
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {proposals.map((p) => {
              let parsed = null;
              try { parsed = JSON.parse(p.proposalJson); } catch {}
              return (
                <div key={p.id} className="bg-white rounded-xl border border-surface-200 p-5 hover:border-surface-300 transition-all">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base text-surface-900">
                        {parsed?.title || "Untitled Proposal"}
                      </h3>
                      <p className="text-sm text-surface-500 mt-0.5">
                        {p.committee?.name} · {p.event?.title}
                      </p>
                      {parsed?.summary && (
                        <p className="text-sm text-surface-400 mt-2 line-clamp-2">{parsed.summary}</p>
                      )}
                    </div>
                    <span className={`text-[11px] px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${statusStyle[p.status] || "bg-gray-100"}`}>
                      {p.status.replace("_", " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 sm:gap-4 mt-3 pt-3 border-t border-surface-100 flex-wrap">
                    <span className="text-xs text-surface-400">
                      Created: {new Date(p.createdAt).toLocaleDateString()}
                    </span>
                    <span className="text-xs text-surface-400">
                      Via: {p.inputType}
                    </span>
                    {p.committee && (
                      <Link
                        href={`/portal/committee/${p.committee.id}`}
                        className="text-xs text-brand-500 hover:text-brand-600 font-medium ml-auto"
                      >
                        View Committee →
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "../../lib/auth";

const statusColors = {
  draft: "bg-gray-100 text-gray-700",
  planning: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  active: "bg-orange-100 text-orange-700",
  completed: "bg-purple-100 text-purple-700",
  cancelled: "bg-red-100 text-red-700",
};

const proposalStatusColors = {
  draft: "bg-gray-100 text-gray-600",
  submitted: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  revision_requested: "bg-orange-100 text-orange-700",
};

export default function PortalPage() {
  const { authFetch, user } = useAuth();
  const [committees, setCommittees] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch("/portal/my-committees")
      .then((data) => setCommittees(data.committees))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [authFetch]);

  if (loading) {
    return (
      <main className="min-h-screen">
        <div className="bg-brand-600 text-white px-6 lg:px-10 py-10">
          <h1 className="font-display text-3xl">My Committees</h1>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-3 border-brand-500 border-t-transparent rounded-full animate-spin" />
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      <div className="bg-brand-600 text-white px-6 lg:px-10 py-10">
        <h1 className="font-display text-3xl">My Committees</h1>
        <p className="mt-2 text-white/70">
          Welcome back, {user?.name}. Here are your committee assignments.
        </p>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {committees.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl border border-surface-200">
            <div className="text-4xl mb-3">📋</div>
            <h3 className="font-display text-lg text-surface-900 mb-1">No committees yet</h3>
            <p className="text-surface-500 text-sm">
              You haven&apos;t been assigned to any committees yet. The Program Director
              will add you when an event is being planned.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {committees.map((c) => {
              const latestProposal = c.proposals?.[0];
              const hasSubmitted = c.proposals?.some((p) => p.status !== "draft");
              const isOverdue = c.proposalDeadline && new Date(c.proposalDeadline) < new Date() && !hasSubmitted;

              return (
                <Link
                  key={c.id}
                  href={`/portal/committee/${c.id}`}
                  className="block bg-white rounded-xl border border-surface-200 hover:border-brand-300 hover:shadow-md transition-all p-6"
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-display text-lg text-surface-900">{c.name}</h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                          c.memberRole === "chair" ? "bg-brand-100 text-brand-700" :
                          c.memberRole === "co-chair" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {c.memberRole}
                        </span>
                      </div>
                      <p className="text-sm text-surface-500">
                        {c.event?.title} — <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded ${statusColors[c.event?.status] || "bg-gray-100"}`}>
                          {c.event?.status}
                        </span>
                      </p>
                      {c.description && (
                        <p className="text-sm text-surface-400 mt-2">{c.description}</p>
                      )}
                    </div>

                    <div className="text-left sm:text-right flex-shrink-0 sm:ml-4">
                      {/* Proposal status */}
                      {latestProposal ? (
                        <span className={`inline-block text-[11px] px-2.5 py-1 rounded-full font-medium ${
                          proposalStatusColors[latestProposal.status] || "bg-gray-100"
                        }`}>
                          Proposal: {latestProposal.status.replace("_", " ")}
                        </span>
                      ) : (
                        <span className="inline-block text-[11px] px-2.5 py-1 rounded-full font-medium bg-yellow-100 text-yellow-700">
                          No proposal yet
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Footer stats */}
                  <div className="flex items-center gap-3 sm:gap-6 mt-4 pt-4 border-t border-surface-100 flex-wrap">
                    <span className="text-xs text-surface-500">
                      👥 {c._count?.members || 0} members
                    </span>
                    <span className="text-xs text-surface-500">
                      📄 {c._count?.proposals || 0} proposals
                    </span>
                    {c.proposalDeadline && (
                      <span className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-surface-500"}`}>
                        📅 Due: {new Date(c.proposalDeadline).toLocaleDateString()}
                        {isOverdue && " — OVERDUE"}
                      </span>
                    )}
                    {c.event?.startDate && (
                      <span className="text-xs text-surface-500">
                        🗓️ Event: {new Date(c.event.startDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

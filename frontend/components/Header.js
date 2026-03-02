"use client";

export default function Header() {
  return (
    <header className="relative overflow-hidden bg-brand-600 text-white">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand-900/40 via-transparent to-brand-800/20" />

      <div className="relative max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-lg bg-brand-500 flex items-center justify-center shadow-lg">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <line x1="10" y1="9" x2="8" y2="9" />
            </svg>
          </div>
          <span className="font-display text-2xl tracking-tight">
            Prime Ops
          </span>
        </div>

        {/* Headline */}
        <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl leading-tight max-w-2xl">
          Proposal Generator
        </h1>
        <p className="mt-3 text-surface-300 text-lg max-w-xl leading-relaxed">
          Describe your event by voice or text — our system builds a complete,
          professional proposal in seconds.
        </p>
      </div>
    </header>
  );
}

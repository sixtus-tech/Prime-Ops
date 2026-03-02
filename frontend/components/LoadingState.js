"use client";

import { useState, useEffect } from "react";

const stages = [
  { icon: "🎯", text: "Analyzing your event description..." },
  { icon: "📋", text: "Structuring the proposal..." },
  { icon: "💰", text: "Estimating budget and resources..." },
  { icon: "📅", text: "Building timeline and agenda..." },
  { icon: "✨", text: "Polishing final details..." },
];

export default function LoadingState({ stage }) {
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentStage((s) => (s < stages.length - 1 ? s + 1 : s));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="mt-16 flex flex-col items-center animate-fade-in">
      {/* Spinner */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-full border-4 border-surface-200" />
        <div className="absolute inset-0 w-20 h-20 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center text-2xl">
          {stages[currentStage].icon}
        </div>
      </div>

      {/* Stage text */}
      <p className="text-surface-700 font-medium text-lg mb-2">{stage}</p>
      <p className="text-surface-400 text-sm animate-pulse">
        {stages[currentStage].text}
      </p>

      {/* Progress dots */}
      <div className="flex gap-2 mt-6">
        {stages.map((_, i) => (
          <div
            key={i}
            className={`w-2 h-2 rounded-full transition-all duration-500 ${
              i <= currentStage ? "bg-brand-500 scale-110" : "bg-surface-300"
            }`}
          />
        ))}
      </div>
    </section>
  );
}

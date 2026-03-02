"use client";

import { useState, useRef, useCallback, useEffect } from "react";

export default function VoiceRecorder({ eventType, onVoiceGenerate }) {
  const [recording, setRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [audioBlob, setAudioBlob] = useState(null);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const streamRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setPermissionDenied(false);

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioBlob(blob);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start(250); // Collect data every 250ms
      setRecording(true);
      setDuration(0);
      setAudioBlob(null);

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } catch (err) {
      console.error("Mic access error:", err);
      setPermissionDenied(true);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) clearInterval(timerRef.current);
    setRecording(false);
  }, []);

  const handleGenerate = () => {
    if (audioBlob) {
      onVoiceGenerate(audioBlob, eventType);
    }
  };

  const handleReset = () => {
    setAudioBlob(null);
    setDuration(0);
  };

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  if (permissionDenied) {
    return (
      <div className="text-center py-8">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="1" y1="1" x2="23" y2="23" />
            <path d="M9 9v3a3 3 0 0 0 5.12 2.12M15 9.34V5a3 3 0 0 0-5.94-.6" />
            <path d="M17 16.95A7 7 0 0 1 5 12v-2m14 0v2c0 .84-.15 1.65-.42 2.4" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
        </div>
        <p className="text-surface-700 font-medium">Microphone access denied</p>
        <p className="text-surface-400 text-sm mt-1">
          Please allow microphone access in your browser settings and try again.
        </p>
        <button
          onClick={startRecording}
          className="mt-4 text-brand-500 hover:text-brand-600 text-sm font-medium"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-4">
      {/* Mic button */}
      <div className="relative mb-6">
        {recording && (
          <div className="absolute inset-0 -m-4 rounded-full bg-red-100 animate-pulse-ring" />
        )}
        <button
          onClick={recording ? stopRecording : startRecording}
          className={`relative z-10 w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg active:scale-95 ${
            recording
              ? "bg-red-500 hover:bg-red-600 recording-pulse"
              : audioBlob
              ? "bg-surface-800 hover:bg-surface-700"
              : "bg-brand-500 hover:bg-brand-600"
          }`}
        >
          {recording ? (
            /* Stop icon */
            <div className="w-6 h-6 bg-white rounded-sm" />
          ) : (
            /* Mic icon */
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          )}
        </button>
      </div>

      {/* Status text */}
      {recording && (
        <div className="flex items-center gap-3 mb-4 animate-fade-in">
          <div className="flex gap-0.5 items-end h-5">
            {[0.2, 0.5, 0.8, 1, 0.7, 0.4, 0.6].map((delay, i) => (
              <div
                key={i}
                className="w-1 bg-red-400 rounded-full audio-bar"
                style={{
                  height: "20px",
                  animationDelay: `${delay * 0.3}s`,
                  animationDuration: `${0.5 + delay * 0.5}s`,
                }}
              />
            ))}
          </div>
          <span className="text-red-500 font-medium text-sm tabular-nums">
            Recording {formatTime(duration)}
          </span>
        </div>
      )}

      {!recording && !audioBlob && (
        <p className="text-surface-400 text-sm">
          Tap the microphone and describe your event
        </p>
      )}

      {/* After recording */}
      {!recording && audioBlob && (
        <div className="animate-fade-in w-full max-w-sm">
          <div className="bg-surface-100 rounded-xl p-4 flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#22c55e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-surface-700 font-medium text-sm">
                Recording captured
              </p>
              <p className="text-surface-400 text-xs">
                {formatTime(duration)} — ready to generate
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="flex-1 py-3 rounded-xl border border-surface-200 text-surface-600 hover:bg-surface-50 text-sm font-medium transition-all"
            >
              Re-record
            </button>
            <button
              onClick={handleGenerate}
              className="flex-1 bg-brand-500 hover:bg-brand-600 text-white font-medium py-3 rounded-xl transition-all shadow-md hover:shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 text-sm"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              Generate
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

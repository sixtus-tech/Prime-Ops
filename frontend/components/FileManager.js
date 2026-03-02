"use client";
import { useState, useRef } from "react";
import { useAuth } from "../lib/auth";

const FILE_ICONS = {
  "application/pdf": "📄",
  "application/msword": "📝",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "📝",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "📊",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": "📽️",
  "image/jpeg": "🖼️",
  "image/png": "🖼️",
  "image/webp": "🖼️",
  "text/plain": "📃",
  "text/csv": "📊",
};

function formatBytes(bytes) {
  if (!bytes) return "—";
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / 1048576).toFixed(1) + " MB";
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return mins + "m ago";
  const hours = Math.floor(mins / 60);
  if (hours < 24) return hours + "h ago";
  const days = Math.floor(hours / 24);
  if (days < 7) return days + "d ago";
  return new Date(dateStr).toLocaleDateString();
}

/**
 * FileManager — Upload, list, download, delete files for a committee
 *
 * Props:
 *   committeeId: string
 *   files: array of file objects from API
 *   onRefresh: () => void — callback to refetch files
 *   canUpload: boolean — whether current user can upload (default true)
 *   canDelete: boolean — whether current user can delete (default false, directors/uploaders)
 */
export default function FileManager({ committeeId, files = [], onRefresh, canUpload = true, canDelete = false }) {
  const { authFetch } = useAuth();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Max 10MB.");
      return;
    }

    setUploading(true);
    setError("");
    setUploadProgress("Uploading " + file.name + "...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = localStorage.getItem("token");
      const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

      const res = await fetch(`${API}/uploads/committee/${committeeId}`, {
        method: "POST",
        headers: { Authorization: "Bearer " + token },
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }

      setUploadProgress("");
      if (onRefresh) onRefresh();
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDownload(fileId, fileName) {
    try {
      const data = await authFetch(`/uploads/download/${fileId}`);
      window.open(data.url, "_blank");
    } catch (err) {
      setError("Download failed: " + err.message);
    }
  }

  async function handleDelete(fileId) {
    if (!confirm("Delete this file? This cannot be undone.")) return;
    try {
      await authFetch(`/uploads/${fileId}`, { method: "DELETE" });
      if (onRefresh) onRefresh();
    } catch (err) {
      setError("Delete failed: " + err.message);
    }
  }

  return (
    <div style={{ marginTop: 16 }}>
      {/* Upload area */}
      {canUpload && (
        <div
          style={{
            border: "2px dashed #d1d5db",
            borderRadius: 12,
            padding: 24,
            textAlign: "center",
            marginBottom: 16,
            background: uploading ? "#f0f4ff" : "#fafafa",
            cursor: uploading ? "wait" : "pointer",
            transition: "all 0.2s",
          }}
          onClick={() => !uploading && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); e.currentTarget.style.borderColor = "#6366f1"; }}
          onDragLeave={(e) => { e.currentTarget.style.borderColor = "#d1d5db"; }}
          onDrop={(e) => {
            e.preventDefault();
            e.currentTarget.style.borderColor = "#d1d5db";
            const dt = e.dataTransfer;
            if (dt.files.length > 0) {
              const input = fileInputRef.current;
              if (input) {
                const dataTransfer = new DataTransfer();
                dataTransfer.items.add(dt.files[0]);
                input.files = dataTransfer.files;
                input.dispatchEvent(new Event("change", { bubbles: true }));
              }
            }
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleUpload}
            style={{ display: "none" }}
            accept=".pdf,.doc,.docx,.xlsx,.pptx,.jpg,.jpeg,.png,.webp,.txt,.csv"
          />
          {uploading ? (
            <p style={{ color: "#6366f1", fontWeight: 500 }}>{uploadProgress}</p>
          ) : (
            <>
              <p style={{ fontSize: 28, marginBottom: 4 }}>📎</p>
              <p style={{ fontWeight: 500, color: "#374151" }}>Click or drag to upload</p>
              <p style={{ fontSize: 13, color: "#9ca3af", marginTop: 4 }}>
                PDF, Word, Excel, PowerPoint, images, CSV — max 10MB
              </p>
            </>
          )}
        </div>
      )}

      {error && (
        <div style={{ background: "#fef2f2", color: "#dc2626", padding: "8px 12px", borderRadius: 8, marginBottom: 12, fontSize: 14 }}>
          {error}
          <button onClick={() => setError("")} style={{ float: "right", background: "none", border: "none", cursor: "pointer", color: "#dc2626" }}>✕</button>
        </div>
      )}

      {/* File list */}
      {files.length === 0 ? (
        <p style={{ color: "#9ca3af", textAlign: "center", padding: 16 }}>No files uploaded yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {files.map((file) => (
            <div
              key={file.id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 14px",
                background: "#fff",
                border: "1px solid #e5e7eb",
                borderRadius: 10,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 22 }}>{FILE_ICONS[file.mimeType] || "📁"}</span>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 500, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {file.fileName}
                  </p>
                  <p style={{ fontSize: 12, color: "#9ca3af" }}>
                    {formatBytes(file.sizeBytes)} · {file.uploadedBy} · {timeAgo(file.createdAt)}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => handleDownload(file.id, file.fileName)}
                  style={{
                    padding: "6px 12px",
                    fontSize: 13,
                    background: "#f3f4f6",
                    border: "1px solid #e5e7eb",
                    borderRadius: 6,
                    cursor: "pointer",
                  }}
                >
                  ⬇ Download
                </button>
                {canDelete && (
                  <button
                    onClick={() => handleDelete(file.id)}
                    style={{
                      padding: "6px 10px",
                      fontSize: 13,
                      background: "#fef2f2",
                      border: "1px solid #fecaca",
                      borderRadius: 6,
                      cursor: "pointer",
                      color: "#dc2626",
                    }}
                  >
                    🗑
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// backend/routes/uploads.js
// ═══════════════════════════════════════════════════════════════════════
// File Upload Routes — Supabase Storage
// ═══════════════════════════════════════════════════════════════════════

const express = require("express");
const router = express.Router();
const multer = require("multer");
const { requireAuth } = require("../middleware/auth");
const { uploadFile, getSignedUrl, deleteFile } = require("../services/storage");
const prisma = require("../services/db");

// Multer config — store in memory, max 10MB
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "image/jpeg",
      "image/png",
      "image/webp",
      "text/plain",
      "text/csv",
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error("File type not allowed. Accepted: PDF, Word, Excel, PowerPoint, images, text, CSV."));
    }
  },
});

// All routes require authentication
router.use(requireAuth);

// ─── Upload file to a committee ──────────────────────────────────────
router.post("/committee/:committeeId", upload.single("file"), async (req, res) => {
  try {
    const { committeeId } = req.params;

    // Verify committee exists and user is a member
    const committee = await prisma.committee.findUnique({
      where: { id: committeeId },
      include: { members: { where: { userId: req.user.id } } },
    });

    if (!committee) return res.status(404).json({ error: "Committee not found" });

    // Directors can upload to any committee; members must belong to it
    if (req.user.role !== "director" && committee.members.length === 0) {
      return res.status(403).json({ error: "Not a member of this committee" });
    }

    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const result = await uploadFile({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      programId: committee.eventId,
      committeeId,
      uploadedBy: req.user.name || req.user.email,
    });

    res.json({
      id: result.fileUpload.id,
      fileName: result.fileUpload.fileName,
      mimeType: result.fileUpload.mimeType,
      sizeBytes: result.fileUpload.sizeBytes,
      url: result.url,
      createdAt: result.fileUpload.createdAt,
    });
  } catch (err) {
    console.error("Upload error:", err);
    if (err.message?.includes("File type not allowed")) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: "Upload failed" });
  }
});

// ─── Upload file to an event/program (director only) ─────────────────
router.post("/event/:eventId", upload.single("file"), async (req, res) => {
  try {
    const { eventId } = req.params;

    if (req.user.role !== "director") {
      return res.status(403).json({ error: "Only directors can upload event files" });
    }

    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: "Event not found" });

    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const result = await uploadFile({
      buffer: req.file.buffer,
      fileName: req.file.originalname,
      mimeType: req.file.mimetype,
      programId: eventId,
      committeeId: null,
      uploadedBy: req.user.name || req.user.email,
    });

    res.json({
      id: result.fileUpload.id,
      fileName: result.fileUpload.fileName,
      mimeType: result.fileUpload.mimeType,
      sizeBytes: result.fileUpload.sizeBytes,
      url: result.url,
      createdAt: result.fileUpload.createdAt,
    });
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Upload failed" });
  }
});

// ─── List files for a committee ──────────────────────────────────────
router.get("/committee/:committeeId", async (req, res) => {
  try {
    const { committeeId } = req.params;

    const committee = await prisma.committee.findUnique({
      where: { id: committeeId },
      include: { members: { where: { userId: req.user.id } } },
    });

    if (!committee) return res.status(404).json({ error: "Committee not found" });
    if (req.user.role !== "director" && committee.members.length === 0) {
      return res.status(403).json({ error: "Not a member of this committee" });
    }

    const files = await prisma.fileUpload.findMany({
      where: { committeeId },
      orderBy: { createdAt: "desc" },
    });

    res.json(files);
  } catch (err) {
    console.error("List files error:", err);
    res.status(500).json({ error: "Failed to list files" });
  }
});

// ─── List files for an event/program ─────────────────────────────────
router.get("/event/:eventId", async (req, res) => {
  try {
    const { eventId } = req.params;

    const files = await prisma.fileUpload.findMany({
      where: { programId: eventId },
      orderBy: { createdAt: "desc" },
    });

    res.json(files);
  } catch (err) {
    console.error("List files error:", err);
    res.status(500).json({ error: "Failed to list files" });
  }
});

// ─── Download file (signed URL) ──────────────────────────────────────
router.get("/download/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;

    const file = await prisma.fileUpload.findUnique({ where: { id: fileId } });
    if (!file) return res.status(404).json({ error: "File not found" });

    // Check access: director or committee member
    if (req.user.role !== "director" && file.committeeId) {
      const member = await prisma.member.findFirst({
        where: { committeeId: file.committeeId, userId: req.user.id },
      });
      if (!member) return res.status(403).json({ error: "Access denied" });
    }

    const signedUrl = await getSignedUrl(file.storagePath);
    res.json({ url: signedUrl, fileName: file.fileName });
  } catch (err) {
    console.error("Download error:", err);
    res.status(500).json({ error: "Download failed" });
  }
});

// ─── Delete file ─────────────────────────────────────────────────────
router.delete("/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;

    const file = await prisma.fileUpload.findUnique({ where: { id: fileId } });
    if (!file) return res.status(404).json({ error: "File not found" });

    // Only director or uploader can delete
    if (req.user.role !== "director" && file.uploadedBy !== req.user.name) {
      return res.status(403).json({ error: "Only the uploader or director can delete files" });
    }

    await deleteFile(fileId);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete error:", err);
    res.status(500).json({ error: "Delete failed" });
  }
});

module.exports = router;

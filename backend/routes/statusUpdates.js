const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const prisma = require("../services/db");
const { requireAuth } = require("../middleware/auth");
const { generateStatusUpdate } = require("../services/claude");
const { transcribeAudio } = require("../services/whisper");
const { notifyDirectors, notifyCommitteeMembers } = require("../services/notifications");
const { notifyCommitteeHeads } = require("../services/notifyCommitteeHeads");
const { logActivity } = require("../services/activity");
const { matchStatusUpdateToMilestones } = require("../services/milestoneGenerator");
const { uploadFile } = require("../services/storage");

const router = express.Router();
router.use(requireAuth);

// Media upload config — accept ALL file types
const uploadsDir = path.join(__dirname, "..", "tmp");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const mediaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".bin";
    cb(null, `media-${uuidv4()}${ext}`);
  },
});

const mediaUpload = multer({
  storage: mediaStorage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|mp4|mov|webm|wav|mp3|m4a|pdf|doc|docx|xls|xlsx|csv|txt|pptx|ppt/;
    const ext = path.extname(file.originalname).toLowerCase().replace(".", "");
    if (
      allowed.test(ext) ||
      file.mimetype.startsWith("image/") ||
      file.mimetype.startsWith("video/") ||
      file.mimetype.startsWith("audio/") ||
      file.mimetype.startsWith("application/") ||
      file.mimetype.startsWith("text/")
    ) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}`));
    }
  },
});

// ─── Helpers ─────────────────────────────────────────────────────────

async function extractTextFromFile(filePath, mimeType, originalName) {
  const ext = path.extname(originalName).toLowerCase();
  try {
    if (ext === ".txt" || ext === ".csv" || mimeType === "text/plain" || mimeType === "text/csv") {
      return fs.readFileSync(filePath, "utf-8").substring(0, 15000);
    }
    if (ext === ".pdf" || mimeType === "application/pdf") {
      try {
        const pdfParse = require("pdf-parse");
        const dataBuffer = fs.readFileSync(filePath);
        const data = await pdfParse(dataBuffer);
        return data.text.substring(0, 15000);
      } catch {
        return `[PDF document: ${originalName} — text extraction unavailable]`;
      }
    }
    if (ext === ".docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      try {
        const mammoth = require("mammoth");
        const result = await mammoth.extractRawText({ path: filePath });
        return result.value.substring(0, 15000);
      } catch {
        return `[Word document: ${originalName} — text extraction unavailable]`;
      }
    }
    if (ext === ".xlsx" || ext === ".xls" || mimeType.includes("spreadsheet")) {
      try {
        const XLSX = require("xlsx");
        const workbook = XLSX.readFile(filePath);
        let text = "";
        for (const sheetName of workbook.SheetNames.slice(0, 3)) {
          const sheet = workbook.Sheets[sheetName];
          const csv = XLSX.utils.sheet_to_csv(sheet);
          text += `\n--- Sheet: ${sheetName} ---\n${csv}`;
        }
        return text.substring(0, 15000);
      } catch {
        return `[Spreadsheet: ${originalName} — text extraction unavailable]`;
      }
    }
    if (ext === ".pptx" || mimeType.includes("presentation")) {
      return `[PowerPoint presentation: ${originalName} — ${(fs.statSync(filePath).size / 1024).toFixed(0)}KB]`;
    }
    return `[Document: ${originalName}]`;
  } catch (err) {
    console.warn("Text extraction error:", err.message);
    return `[File: ${originalName} — could not extract content]`;
  }
}

async function uploadToStorage(filePath, originalName, mimeType, programId, committeeId, uploadedBy) {
  try {
    const buffer = fs.readFileSync(filePath);
    const result = await uploadFile({
      buffer,
      fileName: originalName,
      mimeType,
      programId: programId || "general",
      committeeId,
      uploadedBy,
    });
    return {
      id: result.fileUpload?.id,
      url: result.url,
      fileName: originalName,
      mimeType,
      sizeBytes: buffer.length,
      storagePath: result.storagePath,
    };
  } catch (err) {
    console.warn("Storage upload failed (non-blocking):", err.message);
    return { fileName: originalName, mimeType, error: "Upload failed" };
  }
}

// ---------------------------------------------------------------------------
// GET /api/status-updates?committeeId=...&eventId=...
// ---------------------------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const { committeeId, eventId } = req.query;
    const where = {};
    if (committeeId) where.committeeId = committeeId;
    if (eventId) where.eventId = eventId;

    const updates = await prisma.statusUpdate.findMany({
      where,
      include: {
        committee: { select: { id: true, name: true } },
        subMilestone: {
          select: {
            id: true, title: true, status: true,
            milestone: { select: { id: true, title: true, phase: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ updates });
  } catch (err) {
    console.error("List status updates error:", err);
    res.status(500).json({ error: "Failed to fetch updates." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/status-updates/by-milestone/:subMilestoneId
// ---------------------------------------------------------------------------
router.get("/by-milestone/:subMilestoneId", async (req, res) => {
  try {
    const updates = await prisma.statusUpdate.findMany({
      where: { subMilestoneId: req.params.subMilestoneId },
      include: { committee: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ updates, count: updates.length });
  } catch (err) {
    console.error("Fetch milestone evidence error:", err);
    res.status(500).json({ error: "Failed to fetch milestone evidence." });
  }
});

// ROUTE_ORDER_FIXED
// ---------------------------------------------------------------------------
// GET /api/status-updates/:id
// ---------------------------------------------------------------------------
router.get("/:id", async (req, res) => {
  try {
    const update = await prisma.statusUpdate.findUnique({
      where: { id: req.params.id },
      include: {
        committee: { select: { id: true, name: true } },
        subMilestone: {
          select: {
            id: true, title: true, status: true,
            milestone: { select: { id: true, title: true, phase: true } },
          },
        },
      },
    });
    if (!update) return res.status(404).json({ error: "Status update not found." });
    res.json({ update });
  } catch (err) {
    console.error("Get status update error:", err);
    res.status(500).json({ error: "Failed to fetch update." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/status-updates/preview — AI generates preview (no DB save)
// ---------------------------------------------------------------------------
router.post("/preview", mediaUpload.array("media", 10), async (req, res) => {
  try {
    const { committeeId, rawText, voiceTranscription } = req.body;
    if (!committeeId) return res.status(400).json({ error: "committeeId is required." });

    const committee = await prisma.committee.findUnique({
      where: { id: committeeId },
      include: {
        event: { select: { id: true, title: true } },
        responsibilities: { select: { text: true } },
      },
    });
    if (!committee) return res.status(404).json({ error: "Committee not found." });

    // Process ALL uploaded files
    const imageContents = [];
    const documentTexts = [];
    const storageUploads = [];

    if (req.files?.length > 0) {
      for (const file of req.files) {
        const isImage = file.mimetype.startsWith("image/");
        const isAudio = file.mimetype.startsWith("audio/");
        const isVideo = file.mimetype.startsWith("video/");

        if (isImage) {
          const imageBuffer = fs.readFileSync(file.path);
          const base64 = imageBuffer.toString("base64");
          imageContents.push({
            type: "image",
            source: { type: "base64", media_type: file.mimetype, data: base64 },
          });
        } else if (isAudio) {
          try {
            const transcript = await transcribeAudio(file.path);
            documentTexts.push(`[Voice recording — ${file.originalname}]:\n${transcript}`);
          } catch {
            documentTexts.push(`[Audio file: ${file.originalname} — transcription unavailable]`);
          }
        } else if (isVideo) {
          documentTexts.push(`[Video uploaded: ${file.originalname} — ${(file.size / (1024 * 1024)).toFixed(1)}MB]`);
        } else {
          const extractedText = await extractTextFromFile(file.path, file.mimetype, file.originalname);
          documentTexts.push(`[Document — ${file.originalname}]:\n${extractedText}`);
        }

        // Upload to Supabase Storage
        const uploaded = await uploadToStorage(
          file.path, file.originalname, file.mimetype,
          committee.event?.id, committeeId, req.user.name || req.user.email
        );
        storageUploads.push(uploaded);
      }
    }

    // Combine all text
    let combinedText = "";
    if (rawText) combinedText += rawText;
    if (voiceTranscription) combinedText += `\n\nVoice note: ${voiceTranscription}`;
    if (documentTexts.length > 0) combinedText += `\n\n--- Uploaded Documents ---\n${documentTexts.join("\n\n")}`;

    if (!combinedText && imageContents.length === 0) {
      return res.status(400).json({ error: "Please provide text, voice, documents, or media input." });
    }

    // Generate AI status update with Vision support
    const aiResult = await generateStatusUpdate({
      rawText: combinedText,
      images: imageContents,
      committeeContext: {
        committeeName: committee.name,
        eventTitle: committee.event?.title,
        responsibilities: committee.responsibilities?.map((r) => r.text) || [],
      },
    });

    // Clean up temp files
    if (req.files) {
      for (const file of req.files) {
        try { fs.unlinkSync(file.path); } catch {}
      }
    }

    // Return preview — NOT saved to DB yet
    res.json({
      preview: {
        ...aiResult,
        committeeId,
        eventId: committee.event?.id || null,
        committeeName: committee.name,
        eventTitle: committee.event?.title,
        rawContent: combinedText || null,
        media: storageUploads,
        subMilestoneId: req.body.subMilestoneId || null,
      },
    });
  } catch (err) {
    console.error("Preview status update error:", err);
    if (req.files) {
      for (const file of req.files) {
        try { fs.unlinkSync(file.path); } catch {}
      }
    }
    res.status(500).json({ error: "Failed to generate preview." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/status-updates/submit — Save previewed update to DB
// ---------------------------------------------------------------------------
router.post("/submit", async (req, res) => {
  try {
    const {
      committeeId, eventId, summary, progress, statusLevel,
      keyAccomplishments, challenges, nextSteps, metrics,
      evidenceSummary, media, rawContent, subMilestoneId,
    } = req.body;

    if (!committeeId) return res.status(400).json({ error: "committeeId is required." });

    const committee = await prisma.committee.findUnique({
      where: { id: committeeId },
      include: { event: { select: { id: true, title: true } } },
    });
    if (!committee) return res.status(404).json({ error: "Committee not found." });

    const update = await prisma.statusUpdate.create({
      data: {
        committeeId,
        eventId: eventId || committee.event?.id || null,
        submittedBy: req.user.name,
        title: summary ? summary.substring(0, 100) : `Update from ${committee.name}`,
        summary: summary || null,
        progress: progress || 0,
        content: rawContent || null,
        status: statusLevel || "on_track",
        highlights: keyAccomplishments || [],
        challenges: challenges || [],
        nextSteps: nextSteps || [],
        metrics: metrics || [],
        evidenceSummary: evidenceSummary || [],
        media: media && media.length > 0 ? media : null,
        subMilestoneId: subMilestoneId || null,
      },
      include: {
        committee: { select: { id: true, name: true } },
        subMilestone: { select: { id: true, title: true, milestoneId: true } },
      },
    });

    // ─── MILESTONE MATCHING (non-blocking) ─────────────────────────────
    let milestoneMatches = [];
    try {
      milestoneMatches = await matchStatusUpdateToMilestones(update.id);
      if (milestoneMatches.length > 0) {
        console.log(`[Status Update] Matched to ${milestoneMatches.length} sub-milestones`);
        const pendingApprovals = milestoneMatches.filter((m) => m.newStatus === "pending_approval");
        if (pendingApprovals.length > 0) {
          await notifyCommitteeHeads({
            committeeId,
            type: "milestone_pending_approval",
            title: `Milestone approval needed`,
            message: `${committee.name} has completed ${pendingApprovals.length} critical milestone(s) requiring review: ${pendingApprovals.map((p) => `"${p.title}"`).join(", ")}`,
            link: `/portal/committee/${committeeId}`,
            metadata: { committeeId, statusUpdateId: update.id, pendingSubMilestones: pendingApprovals.map((p) => p.subMilestoneId) },
          });
        }
      }
    } catch (milestoneErr) {
      console.error("[Status Update] Milestone matching error (non-blocking):", milestoneErr.message);
    }

    // Auto-progress linked milestone
    if (update.subMilestoneId) {
      try {
        const sub = await prisma.subMilestone.findUnique({ where: { id: update.subMilestoneId } });
        if (sub && sub.status === "not_started") {
          await prisma.subMilestone.update({ where: { id: update.subMilestoneId }, data: { status: "in_progress" } });
        }
      } catch (progressErr) {
        console.error("Auto-progress milestone failed (non-blocking):", progressErr.message);
      }
    }

    // Notify
    await notifyCommitteeHeads({
      committeeId,
      type: "status_update_submitted",
      title: `Status update: ${committee.name}`,
      message: `${req.user.name} submitted a status update for ${committee.name}.`,
      link: `/portal/committee/${committeeId}`,
      metadata: { statusUpdateId: update.id, committeeId },
    });

    await logActivity({
      action: "status_update",
      description: `${req.user.name} submitted status update for ${committee.name}${media?.length ? ` with ${media.length} file(s)` : ""}`,
      eventId: committee.event?.id,
      performedBy: req.user.name,
    });

    res.status(201).json({
      update,
      milestoneMatches: milestoneMatches.length > 0 ? milestoneMatches : undefined,
    });
  } catch (err) {
    console.error("Submit status update error:", err);
    res.status(500).json({ error: "Failed to submit status update." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/status-updates/generate — LEGACY: AI generates + saves (kept for backward compat)
// ---------------------------------------------------------------------------
router.post("/generate", mediaUpload.array("media", 10), async (req, res) => {
  try {
    const { committeeId, rawText, voiceTranscription } = req.body;
    if (!committeeId) return res.status(400).json({ error: "committeeId is required." });

    const committee = await prisma.committee.findUnique({
      where: { id: committeeId },
      include: {
        event: { select: { id: true, title: true } },
        responsibilities: { select: { text: true } },
      },
    });
    if (!committee) return res.status(404).json({ error: "Committee not found." });

    const imageContents = [];
    const documentTexts = [];
    const storageUploads = [];

    if (req.files?.length > 0) {
      for (const file of req.files) {
        if (file.mimetype.startsWith("image/")) {
          const imageBuffer = fs.readFileSync(file.path);
          imageContents.push({ type: "image", source: { type: "base64", media_type: file.mimetype, data: imageBuffer.toString("base64") } });
        } else if (file.mimetype.startsWith("audio/")) {
          try { const t = await transcribeAudio(file.path); documentTexts.push(`[Voice — ${file.originalname}]:\n${t}`); } catch { documentTexts.push(`[Audio: ${file.originalname}]`); }
        } else if (file.mimetype.startsWith("video/")) {
          documentTexts.push(`[Video: ${file.originalname}]`);
        } else {
          const extracted = await extractTextFromFile(file.path, file.mimetype, file.originalname);
          documentTexts.push(`[Document — ${file.originalname}]:\n${extracted}`);
        }
        const uploaded = await uploadToStorage(file.path, file.originalname, file.mimetype, committee.event?.id, committeeId, req.user.name);
        storageUploads.push(uploaded);
      }
    }

    let combinedText = "";
    if (rawText) combinedText += rawText;
    if (voiceTranscription) combinedText += `\n\nVoice note: ${voiceTranscription}`;
    if (documentTexts.length > 0) combinedText += `\n\n--- Documents ---\n${documentTexts.join("\n\n")}`;

    if (!combinedText && imageContents.length === 0) return res.status(400).json({ error: "Please provide input." });

    const aiResult = await generateStatusUpdate({
      rawText: combinedText, images: imageContents,
      committeeContext: { committeeName: committee.name, eventTitle: committee.event?.title, responsibilities: committee.responsibilities?.map((r) => r.text) || [] },
    });

    const update = await prisma.statusUpdate.create({
      data: {
        committeeId, eventId: committee.event?.id || null, submittedBy: req.user.name,
        title: aiResult.summary ? aiResult.summary.substring(0, 100) : `Update from ${committee.name}`,
        summary: aiResult.summary || null, progress: aiResult.progress || 0,
        content: combinedText || null, status: aiResult.statusLevel || "on_track",
        highlights: aiResult.keyAccomplishments || [], challenges: aiResult.challenges || [],
        nextSteps: aiResult.nextSteps || [], metrics: aiResult.metrics || [],
        evidenceSummary: aiResult.evidenceSummary || [],
        media: storageUploads.length > 0 ? storageUploads : null,
        subMilestoneId: req.body.subMilestoneId || null,
      },
      include: { committee: { select: { id: true, name: true } }, subMilestone: { select: { id: true, title: true, milestoneId: true } } },
    });

    if (req.files) { for (const file of req.files) { try { fs.unlinkSync(file.path); } catch {} } }

    let milestoneMatches = [];
    try { milestoneMatches = await matchStatusUpdateToMilestones(update.id); } catch {}
    if (update.subMilestoneId) { try { const sub = await prisma.subMilestone.findUnique({ where: { id: update.subMilestoneId } }); if (sub?.status === "not_started") await prisma.subMilestone.update({ where: { id: update.subMilestoneId }, data: { status: "in_progress" } }); } catch {} }

    await notifyCommitteeHeads({ committeeId, type: "status_update_submitted", title: `Status update: ${committee.name}`, message: `${req.user.name} submitted a status update for ${committee.name}.`, link: `/portal/committee/${committeeId}`, metadata: { statusUpdateId: update.id, committeeId } });
    await notifyDirectors({ type: "status_update_submitted", title: `📊 Status update: ${committee.name}`, message: `${req.user.name} submitted a status update for ${committee.name}.`, link: `/updates`, metadata: { statusUpdateId: update.id, committeeId } });
    await logActivity({ action: "status_update", description: `${req.user.name} submitted status update for ${committee.name}`, eventId: committee.event?.id, performedBy: req.user.name });

    res.status(201).json({ update: { ...update, ...aiResult, media: storageUploads }, milestoneMatches: milestoneMatches.length > 0 ? milestoneMatches : undefined });
  } catch (err) {
    console.error("Generate status update error:", err);
    if (req.files) { for (const file of req.files) { try { fs.unlinkSync(file.path); } catch {} } }
    res.status(500).json({ error: "Failed to generate status update." });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/status-updates/:id/acknowledge
// ---------------------------------------------------------------------------
router.put("/:id/acknowledge", async (req, res) => {
  try {
    const { notes, status } = req.body;
    const update = await prisma.statusUpdate.update({
      where: { id: req.params.id },
      data: { status: status || "acknowledged" },
      include: { committee: { select: { id: true, name: true } } },
    });
    res.json({ update });
  } catch (err) {
    res.status(500).json({ error: "Failed to acknowledge update." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/status-updates/consolidate
// ---------------------------------------------------------------------------
router.post("/consolidate", async (req, res) => {
  try {
    const { eventId } = req.body;
    if (!eventId) return res.status(400).json({ error: "eventId is required." });

    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { id: true, title: true, startDate: true, venue: true } });
    if (!event) return res.status(404).json({ error: "Event not found." });

    const committees = await prisma.committee.findMany({
      where: { eventId },
      include: { statusUpdates: { orderBy: { createdAt: "desc" }, take: 1 }, responsibilities: { select: { text: true } } },
    });

    const updateData = committees.filter((c) => c.statusUpdates.length > 0).map((c) => {
      const u = c.statusUpdates[0];
      return { committee: c.name, responsibilities: c.responsibilities.map((r) => r.text), title: u.title, summary: u.summary, content: u.content, status: u.status, progress: u.progress, highlights: u.highlights, challenges: u.challenges, nextSteps: u.nextSteps, metrics: u.metrics, submittedBy: u.submittedBy, date: u.createdAt };
    });

    if (updateData.length === 0) return res.status(400).json({ error: "No status updates to consolidate." });

    const { callClaude, extractJSON } = require("../services/claude");

    const systemPrompt = `You are Prime Ops AI. Consolidate multiple committee status updates into ONE comprehensive master status report.
## OUTPUT FORMAT
Respond with ONLY valid JSON (no markdown, no backticks):
{
  "title": "Master Status Report — [Event Name]",
  "date": "${new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}",
  "overallProgress": <weighted average 0-100>,
  "executiveSummary": "3-4 sentence high-level overview",
  "statusLevel": "on_track | at_risk | behind | ahead",
  "committeeBreakdown": [{ "name": "committee", "progress": <0-100>, "status": "on_track|at_risk|behind", "highlight": "1-sentence" }],
  "keyAccomplishments": ["top accomplishments"],
  "criticalIssues": ["issues needing attention"],
  "upcomingMilestones": ["what's next"],
  "consolidatedMetrics": [{ "label": "metric", "value": "current", "target": "goal" }],
  "recommendations": ["AI recommendations"]
}`;

    const response = await callClaude({
      system: systemPrompt,
      messages: [{ role: "user", content: `Event: ${event.title}${event.startDate ? `\nDate: ${new Date(event.startDate).toLocaleDateString()}` : ""}${event.venue ? `\nVenue: ${event.venue}` : ""}\n\nCommittee Updates:\n${JSON.stringify(updateData, null, 2)}` }],
      max_tokens: 3000,
    });

    const text = response.content.filter((b) => b.type === "text").map((b) => b.text).join("");
    let report;
    try { report = extractJSON(text); if (!report) throw new Error(); } catch { report = { title: `Master Report — ${event.title}`, executiveSummary: text, overallProgress: 0, parseError: true }; }
    report.generatedAt = new Date().toISOString();
    report.eventId = eventId;
    report.committeeCount = updateData.length;
    res.json({ report });
  } catch (err) {
    console.error("Consolidate error:", err);
    res.status(500).json({ error: "Failed to consolidate updates." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/status-updates/:id/link-milestone
// ---------------------------------------------------------------------------
router.post("/:id/link-milestone", async (req, res) => {
  try {
    const { subMilestoneId } = req.body;
    if (!subMilestoneId) return res.status(400).json({ error: "subMilestoneId is required." });
    const sub = await prisma.subMilestone.findUnique({ where: { id: subMilestoneId } });
    if (!sub) return res.status(404).json({ error: "Sub-milestone not found." });
    const update = await prisma.statusUpdate.update({
      where: { id: req.params.id }, data: { subMilestoneId },
      include: { committee: { select: { id: true, name: true } }, subMilestone: { select: { id: true, title: true } } },
    });
    if (sub.status === "not_started") await prisma.subMilestone.update({ where: { id: subMilestoneId }, data: { status: "in_progress" } });
    res.json({ update });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Status update not found." });
    console.error("Link milestone error:", err);
    res.status(500).json({ error: "Failed to link milestone." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/status-updates/:id/unlink-milestone
// ---------------------------------------------------------------------------
router.post("/:id/unlink-milestone", async (req, res) => {
  try {
    const update = await prisma.statusUpdate.update({
      where: { id: req.params.id }, data: { subMilestoneId: null },
      include: { committee: { select: { id: true, name: true } } },
    });
    res.json({ update });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Status update not found." });
    res.status(500).json({ error: "Failed to unlink milestone." });
  }
});

module.exports = router;

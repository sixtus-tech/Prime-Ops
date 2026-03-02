const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");
const { transcribeAudio } = require("../services/whisper");
const { generateProposal, chatWithAI, generateCommitteeProposal } = require("../services/claude");
const { generateProposalPDF } = require("../services/pdfGenerator");
const { extractDocumentText } = require("../services/documentExtractor");
const prisma = require("../services/db");

const router = express.Router();

// ---------------------------------------------------------------------------
// Multer config — audio uploads
// ---------------------------------------------------------------------------
const uploadsDir = path.join(__dirname, "..", "tmp");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".webm";
    cb(null, `audio-${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: (process.env.MAX_AUDIO_SIZE_MB || 25) * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = [
      "audio/webm",
      "audio/mp4",
      "audio/mpeg",
      "audio/wav",
      "audio/ogg",
      "audio/flac",
      "audio/x-m4a",
      "video/webm",
    ];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error(`Unsupported audio format: ${file.mimetype}`));
  },
});

// ---------------------------------------------------------------------------
// POST /api/proposal/transcribe
// Accepts an audio file, returns transcribed text via Whisper
// ---------------------------------------------------------------------------
router.post("/transcribe", upload.single("audio"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No audio file provided." });
  }

  try {
    const transcript = await transcribeAudio(req.file.path);

    // Clean up temp file
    fs.unlink(req.file.path, () => {});

    return res.json({ transcript });
  } catch (err) {
    // Clean up on error too
    if (req.file?.path) fs.unlink(req.file.path, () => {});

    console.error("Transcription error:", err);
    return res.status(500).json({
      error: "Failed to transcribe audio. Please try again.",
    });
  }
});

// ---------------------------------------------------------------------------
// GET /api/proposal — list saved proposals
// ---------------------------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const proposals = await prisma.proposal.findMany({
      include: { event: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ proposals });
  } catch (err) {
    console.error("List proposals error:", err);
    res.status(500).json({ error: "Failed to fetch proposals." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/proposal/generate
// Accepts event description text, returns structured AI proposal
// Body: { description: string, eventType?: string, additionalContext?: string }
// ---------------------------------------------------------------------------
router.post("/generate", async (req, res) => {
  const { description: desc, inputText, eventType, additionalContext } = req.body;
  const description = desc || inputText;

  if (!description || description.trim().length < 10) {
    return res.status(400).json({
      error: "Please provide a description of at least 10 characters.",
    });
  }

  try {
    const proposal = await generateProposal({
      description: description.trim(),
      eventType: eventType || "general",
      additionalContext: additionalContext?.trim() || "",
    });

    // Save to database
    const saved = await prisma.proposal.create({
      data: {
        inputText: description.trim(),
        inputType: "text",
        proposalJson: JSON.stringify(proposal),
        status: "draft",
      },
    });

    return res.json({ proposal, proposalId: saved.id });
  } catch (err) {
    console.error("Proposal generation error:", err);
    return res.status(500).json({
      error: "Failed to generate proposal. Please try again.",
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/proposal/generate-committee
// Generate a committee-specific work plan based on committee + event context
// ---------------------------------------------------------------------------
router.post("/generate-committee", async (req, res) => {
  const { description, committeeContext } = req.body;

  if (!committeeContext?.committeeName) {
    return res.status(400).json({ error: "Committee context is required." });
  }

  try {
    const proposal = await generateCommitteeProposal({
      description: description?.trim() || "",
      committeeContext,
    });

    // Save to database
    const saved = await prisma.proposal.create({
      data: {
        inputText: description?.trim() || `Auto-generated for ${committeeContext.committeeName}`,
        inputType: "text",
        proposalJson: JSON.stringify(proposal),
        status: "draft",
      },
    });

    return res.json({ proposal, proposalId: saved.id });
  } catch (err) {
    console.error("Committee proposal generation error:", err);
    return res.status(500).json({
      error: "Failed to generate committee proposal. Please try again.",
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/proposal/voice-to-proposal
// Combined: transcribe audio → generate proposal in one call
// ---------------------------------------------------------------------------
router.post(
  "/voice-to-proposal",
  upload.single("audio"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided." });
    }

    try {
      // Step 1: Transcribe
      const transcript = await transcribeAudio(req.file.path);
      fs.unlink(req.file.path, () => {});

      if (!transcript || transcript.trim().length < 10) {
        return res.status(400).json({
          error:
            "Could not get enough content from the audio. Please speak clearly and try again.",
          transcript,
        });
      }

      // Step 2: Generate proposal from transcript
      const eventType = req.body?.eventType || "general";
      const additionalContext = req.body?.additionalContext || "";

      const proposal = await generateProposal({
        description: transcript,
        eventType,
        additionalContext,
      });

      // Save to database
      const saved = await prisma.proposal.create({
        data: {
          inputText: transcript,
          inputType: "voice",
          proposalJson: JSON.stringify(proposal),
          status: "draft",
        },
      });

      return res.json({ transcript, proposal, proposalId: saved.id });
    } catch (err) {
      if (req.file?.path) fs.unlink(req.file.path, () => {});
      console.error("Voice-to-proposal error:", err);
      return res.status(500).json({
        error: "Failed to process voice input. Please try again.",
      });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/proposal/chat
// Conversational mode — send message history, get AI's next response
// Body: { messages: [{role,content}], eventType?: string }
// ---------------------------------------------------------------------------
router.post("/chat", async (req, res) => {
  const { messages, eventType, committeeContext } = req.body;

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "Messages array is required." });
  }

  // Validate message structure
  const valid = messages.every(
    (m) =>
      m &&
      typeof m.role === "string" &&
      typeof m.content === "string" &&
      ["user", "assistant"].includes(m.role)
  );

  if (!valid) {
    return res.status(400).json({
      error: "Each message must have a role (user/assistant) and content.",
    });
  }

  try {
    const result = await chatWithAI({
      messages,
      eventType: eventType || "general",
      committeeContext: committeeContext || null,
    });

    return res.json(result);
  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({
      error: "Failed to get AI response. Please try again.",
    });
  }
});

// ---------------------------------------------------------------------------
// POST /api/proposal/chat/generate
// Final step: take the chat summary and generate a full proposal
// Body: { summary: string, eventType?: string, messages?: [{role,content}] }
// ---------------------------------------------------------------------------
router.post("/chat/generate", async (req, res) => {
  const { summary, eventType, messages, committeeContext } = req.body;

  if (!summary || summary.trim().length < 10) {
    return res.status(400).json({
      error: "Chat summary is required.",
    });
  }

  try {
    let proposal;

    // Use committee-specific generation if context is provided
    if (committeeContext?.committeeName) {
      proposal = await generateCommitteeProposal({
        description: summary.trim(),
        committeeContext,
      });
    } else {
      proposal = await generateProposal({
        description: summary.trim(),
        eventType: eventType || "general",
        additionalContext: "",
      });
    }

    // Build a readable input text from the conversation
    const inputText = messages?.length
      ? messages
          .filter((m) => m.role === "user")
          .map((m) => m.content)
          .join("\n")
      : summary;

    // Save to database
    const saved = await prisma.proposal.create({
      data: {
        inputText,
        inputType: "chat",
        proposalJson: JSON.stringify(proposal),
        status: "draft",
      },
    });

    return res.json({ proposal, proposalId: saved.id });
  } catch (err) {
    console.error("Chat generate error:", err);
    return res.status(500).json({
      error: "Failed to generate proposal from chat. Please try again.",
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PDF DOWNLOAD
// ═══════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------------------
// GET /api/proposal/:id/pdf — download proposal as PDF
// ---------------------------------------------------------------------------
router.get("/:id/pdf", async (req, res) => {
  try {
    const proposal = await prisma.proposal.findUnique({
      where: { id: req.params.id },
      include: {
        committee: { select: { name: true } },
        event: { select: { title: true } },
      },
    });

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found." });
    }

    let parsed;
    try {
      parsed = JSON.parse(proposal.proposalJson);
    } catch {
      return res.status(400).json({ error: "Invalid proposal data." });
    }

    const pdfStream = generateProposalPDF(parsed, {
      committeeName: proposal.committee?.name,
      eventTitle: proposal.event?.title,
      submittedBy: proposal.submittedBy,
    });

    const filename = `${(parsed.title || "proposal").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    pdfStream.pipe(res);
  } catch (err) {
    console.error("PDF generation error:", err);
    res.status(500).json({ error: "Failed to generate PDF." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/proposal/pdf-preview — generate PDF from proposal JSON (no save)
// ---------------------------------------------------------------------------
router.post("/pdf-preview", async (req, res) => {
  try {
    const { proposalJson, meta } = req.body;
    if (!proposalJson) {
      return res.status(400).json({ error: "proposalJson is required." });
    }

    const parsed = typeof proposalJson === "string" ? JSON.parse(proposalJson) : proposalJson;
    const pdfStream = generateProposalPDF(parsed, meta || {});

    const filename = `${(parsed.title || "proposal").replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    pdfStream.pipe(res);
  } catch (err) {
    console.error("PDF preview error:", err);
    res.status(500).json({ error: "Failed to generate PDF." });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// DOCUMENT UPLOAD — extract text from uploaded docs for AI context
// ═══════════════════════════════════════════════════════════════════════

const docStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".txt";
    cb(null, `doc-${uuidv4()}${ext}`);
  },
});

const docUpload = multer({
  storage: docStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    const allowed = [".pdf", ".txt", ".doc", ".docx", ".md", ".rtf"];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext) || file.mimetype === "application/pdf" || file.mimetype.startsWith("text/")) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Supported: ${allowed.join(", ")}`));
    }
  },
});

// ---------------------------------------------------------------------------
// POST /api/proposal/upload-document — upload a document, extract text
// ---------------------------------------------------------------------------
router.post("/upload-document", docUpload.single("document"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded." });
  }

  try {
    const filePath = req.file.path;
    const text = await extractDocumentText(filePath);

    // Clean up file
    fs.unlink(filePath, () => {});

    res.json({
      filename: req.file.originalname,
      extractedText: text,
      charCount: text.length,
    });
  } catch (err) {
    // Clean up on error
    if (req.file?.path) fs.unlink(req.file.path, () => {});
    console.error("Document extraction error:", err);
    res.status(500).json({ error: `Failed to extract text: ${err.message}` });
  }
});

// ---------------------------------------------------------------------------
// POST /api/proposal/generate-with-context — generate proposal with uploaded doc context
// ---------------------------------------------------------------------------
router.post("/generate-with-context", async (req, res) => {
  try {
    const { description, eventType, documentText, documentName, committeeContext } = req.body;

    if (!description && !documentText) {
      return res.status(400).json({ error: "Either description or document text is required." });
    }

    // Build enhanced description with document context
    let enhancedDescription = "";
    if (documentText) {
      enhancedDescription += `=== REFERENCE DOCUMENT: "${documentName || "Uploaded Document"}" ===\n`;
      enhancedDescription += documentText.substring(0, 8000); // Cap at 8000 chars
      enhancedDescription += "\n=== END REFERENCE DOCUMENT ===\n\n";
    }
    if (description) {
      enhancedDescription += `=== USER'S ADDITIONAL NOTES ===\n${description}\n`;
    }

    let proposal;

    // Use committee-specific generation if committee context is provided
    if (committeeContext?.committeeName) {
      proposal = await generateCommitteeProposal({
        description: enhancedDescription,
        committeeContext,
      });
    } else {
      proposal = await generateProposal({
        description: enhancedDescription,
        eventType: eventType || "general",
      });
    }

    // Save to DB
    const saved = await prisma.proposal.create({
      data: {
        inputText: description || `Generated from: ${documentName}`,
        inputType: "document",
        proposalJson: JSON.stringify(proposal),
        status: "draft",
      },
    });

    res.json({ proposal, proposalId: saved.id });
  } catch (err) {
    console.error("Generate with context error:", err);
    res.status(500).json({ error: "Failed to generate proposal." });
  }
});

module.exports = router;

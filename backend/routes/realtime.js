// backend/routes/realtime.js
// ═══════════════════════════════════════════════════════════════════════
// Realtime Routes — Server-Sent Events (SSE)
// ═══════════════════════════════════════════════════════════════════════

const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const prisma = require("../services/db");
const { requireAuth } = require("../middleware/auth");
const { addConnection, getStats } = require("../services/realtime");

// SSE auth middleware — EventSource can't send headers, so accept token as query param
async function sseAuth(req, res, next) {
  try {
    const token = req.query.token;
    if (!token) return res.status(401).json({ error: "Token required" });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) return res.status(401).json({ error: "User not found" });

    req.user = user;
    next();
  } catch (err) {
    res.status(401).json({ error: "Invalid token" });
  }
}

// ─── SSE Subscribe — live notification stream ────────────────────────
router.get("/subscribe", sseAuth, (req, res) => {
  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  // Send initial connection event
  res.write(`event: connected\ndata: ${JSON.stringify({ userId: req.user.id, timestamp: new Date().toISOString() })}\n\n`);

  // Register connection
  addConnection(req.user.id, res);

  // Keep alive every 30s
  const keepAlive = setInterval(() => {
    try {
      res.write(": keepalive\n\n");
    } catch {
      clearInterval(keepAlive);
    }
  }, 30000);

  // Clean up on disconnect
  req.on("close", () => {
    clearInterval(keepAlive);
  });
});

// ─── Connection stats (director only) ────────────────────────────────
router.get("/stats", requireAuth, (req, res) => {
  if (req.user.role !== "director") {
    return res.status(403).json({ error: "Director access required" });
  }
  res.json(getStats());
});

module.exports = router;

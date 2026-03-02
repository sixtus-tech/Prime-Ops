const express = require("express");
const prisma = require("../services/db");
const { requireAuth } = require("../middleware/auth");
const { sendKcNotification, sendKcToCommittee, sendKcToDirectors } = require("../services/kcMessenger");

const router = express.Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/notifications — get user's notifications
// ---------------------------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const { unreadOnly } = req.query;
    const where = { userId: req.user.id };
    if (unreadOnly === "true") where.read = false;

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: { userId: req.user.id, read: false },
    });

    res.json({ notifications, unreadCount });
  } catch (err) {
    console.error("Notifications error:", err);
    res.status(500).json({ error: "Failed to fetch notifications." });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/notifications/read-all — mark all as read (MUST be before :id/read)
// ---------------------------------------------------------------------------
router.put("/read-all", async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user.id, read: false },
      data: { read: true },
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to update notifications." });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/notifications/:id/read — mark one as read
// ---------------------------------------------------------------------------
router.put("/:id/read", async (req, res) => {
  try {
    const notif = await prisma.notification.update({
      where: { id: req.params.id },
      data: { read: true },
    });
    res.json({ notification: notif });
  } catch (err) {
    res.status(500).json({ error: "Failed to update notification." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/notifications/kc-send — send a KingsChat message to a user
// Director only
// ---------------------------------------------------------------------------
router.post("/kc-send", async (req, res) => {
  try {
    if (req.user.role !== "director") {
      return res.status(403).json({ error: "Only directors can send KC messages." });
    }

    const { userId, message } = req.body;
    if (!userId || !message) {
      return res.status(400).json({ error: "userId and message are required." });
    }

    const sent = await sendKcNotification(userId, `📋 Prime Ops\n\n${message}`);
    res.json({ sent, message: sent ? "Message sent to KingsChat" : "Could not send — user may not have KC linked or tokens expired" });
  } catch (err) {
    console.error("KC send error:", err);
    res.status(500).json({ error: "Failed to send KC message." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/notifications/kc-status — check KC messaging status
// ---------------------------------------------------------------------------
router.get("/kc-status", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { kcId: true, kcAccessToken: true, kcRefreshToken: true, kcTokenExpiresAt: true },
    });

    const hasKc = !!user?.kcId;
    const hasToken = !!user?.kcAccessToken;
    const hasRefresh = !!user?.kcRefreshToken;
    const tokenExpired = user?.kcTokenExpiresAt ? new Date(user.kcTokenExpiresAt) < new Date() : true;

    res.json({
      kcLinked: hasKc,
      messagingEnabled: hasKc && hasToken && (hasRefresh || !tokenExpired),
      tokenStatus: hasToken ? (tokenExpired ? "expired" : "valid") : "none",
      hasRefreshToken: hasRefresh,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to check KC status." });
  }
});

module.exports = router;

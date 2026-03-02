// backend/services/notify.js
// ═══════════════════════════════════════════════════════════════════════
// Unified Notification Service — DB + Realtime
// Creates a notification record AND pushes it live via SSE
// ═══════════════════════════════════════════════════════════════════════

const prisma = require("./db");
const { sendToUser, sendToCommittee, sendToDirectors } = require("./realtime");

/**
 * Send notification to a specific user (DB + live push)
 */
async function notifyUser(userId, { type, title, message, link, metadata }) {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type: type || "general",
        title,
        message,
        link: link || null,
        metadata: metadata || null,
      },
    });

    // Also push via SSE (fire and forget)
    sendToUser(userId, "notification", {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      link: notification.link,
      read: false,
      createdAt: notification.createdAt,
    });

    return notification;
  } catch (err) {
    console.warn("[Notify] Failed to notify user:", userId, err.message);
    return null;
  }
}

/**
 * Notify all members of a committee
 */
async function notifyCommittee(committeeId, { type, title, message, link, metadata, excludeUserId }) {
  try {
    const members = await prisma.member.findMany({
      where: { committeeId, userId: { not: null } },
      select: { userId: true },
    });

    const results = [];
    for (const member of members) {
      if (member.userId === excludeUserId) continue;
      const n = await notifyUser(member.userId, { type, title, message, link, metadata });
      if (n) results.push(n);
    }
    return results;
  } catch (err) {
    console.warn("[Notify] Failed to notify committee:", committeeId, err.message);
    return [];
  }
}

/**
 * Notify all directors
 */
async function notifyDirectors({ type, title, message, link, metadata, excludeUserId }) {
  try {
    const directors = await prisma.user.findMany({
      where: { role: "director" },
      select: { id: true },
    });

    const results = [];
    for (const director of directors) {
      if (director.id === excludeUserId) continue;
      const n = await notifyUser(director.id, { type, title, message, link, metadata });
      if (n) results.push(n);
    }
    return results;
  } catch (err) {
    console.warn("[Notify] Failed to notify directors:", err.message);
    return [];
  }
}

/**
 * Broadcast a custom event to committee members (no DB, just live push)
 */
function broadcastToCommittee(committeeId, event, data) {
  sendToCommittee(committeeId, event, data, prisma);
}

/**
 * Broadcast a custom event to directors (no DB, just live push)
 */
function broadcastToDirectors(event, data) {
  sendToDirectors(event, data, prisma);
}

module.exports = {
  notifyUser,
  notifyCommittee,
  notifyDirectors,
  broadcastToCommittee,
  broadcastToDirectors,
};

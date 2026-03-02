// backend/services/realtime.js
// ═══════════════════════════════════════════════════════════════════════
// Realtime Notification Service — Supabase Realtime + SSE fallback
// ═══════════════════════════════════════════════════════════════════════
//
// Provides server-sent events (SSE) for live notifications.
// The frontend subscribes to /api/realtime/subscribe and receives
// events as they happen (new comments, status changes, approvals, etc.)
// ═══════════════════════════════════════════════════════════════════════

const { supabase } = require("./supabase");

// Active SSE connections keyed by userId
const connections = new Map();

/**
 * Register an SSE connection for a user
 */
function addConnection(userId, res) {
  if (!connections.has(userId)) {
    connections.set(userId, new Set());
  }
  connections.get(userId).add(res);

  // Clean up on close
  res.on("close", () => {
    const userConns = connections.get(userId);
    if (userConns) {
      userConns.delete(res);
      if (userConns.size === 0) connections.delete(userId);
    }
  });
}

/**
 * Send a realtime event to a specific user
 */
function sendToUser(userId, event, data) {
  const userConns = connections.get(userId);
  if (!userConns || userConns.size === 0) return false;

  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of userConns) {
    try {
      res.write(payload);
    } catch (err) {
      console.warn("[Realtime] Failed to send to user:", userId, err.message);
      userConns.delete(res);
    }
  }
  return true;
}

/**
 * Send a realtime event to all members of a committee
 */
async function sendToCommittee(committeeId, event, data, prisma) {
  try {
    const members = await prisma.member.findMany({
      where: { committeeId, userId: { not: null } },
      select: { userId: true },
    });

    let sent = 0;
    for (const member of members) {
      if (sendToUser(member.userId, event, data)) sent++;
    }
    return sent;
  } catch (err) {
    console.warn("[Realtime] sendToCommittee error:", err.message);
    return 0;
  }
}

/**
 * Send a realtime event to all directors
 */
async function sendToDirectors(event, data, prisma) {
  try {
    const directors = await prisma.user.findMany({
      where: { role: "director" },
      select: { id: true },
    });

    let sent = 0;
    for (const director of directors) {
      if (sendToUser(director.id, event, data)) sent++;
    }
    return sent;
  } catch (err) {
    console.warn("[Realtime] sendToDirectors error:", err.message);
    return 0;
  }
}

/**
 * Initialize Supabase Realtime listener for notifications table
 * Watches for new inserts and pushes them to connected users
 */
function initRealtimeListener() {
  try {
    const channel = supabase
      .channel("notifications-changes")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Notification" },
        (payload) => {
          const notification = payload.new;
          if (notification.userId) {
            sendToUser(notification.userId, "notification", {
              id: notification.id,
              type: notification.type,
              title: notification.title,
              message: notification.message,
              link: notification.link,
              read: notification.read,
              createdAt: notification.createdAt,
            });
          }
        }
      )
      .subscribe((status) => {
        console.log("[Realtime] Notification listener:", status);
      });

    return channel;
  } catch (err) {
    console.warn("[Realtime] Failed to init listener:", err.message);
    return null;
  }
}

/**
 * Get connection stats
 */
function getStats() {
  let totalConnections = 0;
  for (const conns of connections.values()) {
    totalConnections += conns.size;
  }
  return {
    activeUsers: connections.size,
    totalConnections,
  };
}

module.exports = {
  addConnection,
  sendToUser,
  sendToCommittee,
  sendToDirectors,
  initRealtimeListener,
  getStats,
};

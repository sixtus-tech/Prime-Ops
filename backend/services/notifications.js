const prisma = require("./db");
const { sendKcNotification, sendKcMessageToKcId, sendKcToCommittee, sendKcToDirectors } = require("./kcMessenger");

// Strip leading emojis for cleaner KC messages
function cleanForKc(text) {
  return text.replace(/^[\u{1F300}-\u{1FAD6}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]+\s*/gu, "").trim();
}

/**
 * Send a notification to a user (in-app + KingsChat).
 * @param {{ userId: string, type: string, title: string, message: string, link?: string, metadata?: object }}
 */
async function notify({ userId, type, title, message, link, metadata, senderUserId }) {
  try {
    // 1. In-app notification
    await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        link: link || null,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });

    // 2. KingsChat message (fire-and-forget)
    const kcMsg = `📋 Prime Ops\n\n${cleanForKc(title)}\n${cleanForKc(message)}`;
    sendKcNotification(userId, kcMsg, senderUserId).catch(() => {});
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}

/**
 * Notify all members of a committee (who have linked user accounts OR KingsChat IDs).
 * In-app notifications go to members with userId.
 * KingsChat messages go to ALL members with kcId (via sendKcToCommittee).
 */
async function notifyCommitteeMembers({ committeeId, type, title, message, link, metadata, excludeUserId, senderUserId }) {
  try {
    const members = await prisma.member.findMany({
      where: { committeeId },
      select: { userId: true, kcId: true },
    });

    // In-app notifications — only for members with a linked User account
    const userIds = members
      .map((m) => m.userId)
      .filter((uid) => uid && uid !== excludeUserId);

    for (const uid of userIds) {
      await prisma.notification.create({
        data: {
          userId: uid,
          type,
          title,
          message,
          link: link || null,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });
    }

    // KingsChat messages — reaches members with kcId even without User accounts
    const kcMsg = `📋 Prime Ops\n\n${cleanForKc(title)}\n${cleanForKc(message)}`;
    sendKcToCommittee(committeeId, kcMsg, excludeUserId, senderUserId).catch(() => {});

    // Also send KC messages to members who have kcId on the Member record
    // but NO linked userId (these are KC-only members not yet registered).
    // sendKcToCommittee already handles this, so no extra work needed here.
  } catch (err) {
    console.error("Failed to notify committee:", err);
  }
}

/**
 * Notify all directors.
 */
async function notifyDirectors({ type, title, message, link, metadata, senderUserId }) {
  try {
    const directors = await prisma.user.findMany({
      where: { role: "director" },
      select: { id: true },
    });

    // In-app notifications
    for (const d of directors) {
      await prisma.notification.create({
        data: {
          userId: d.id,
          type,
          title,
          message,
          link: link || null,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });
    }

    // KingsChat messages (fire-and-forget)
    const kcMsg = `📋 Prime Ops\n\n${cleanForKc(title)}\n${cleanForKc(message)}`;
    sendKcToDirectors(kcMsg).catch(() => {});
  } catch (err) {
    console.error("Failed to notify directors:", err);
  }
}

module.exports = { notify, notifyCommitteeMembers, notifyDirectors };

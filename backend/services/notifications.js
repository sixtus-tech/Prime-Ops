const prisma = require("./db");
const { sendKcNotification, sendKcMessageToKcId, sendKcToCommittee, sendKcToDirectors } = require("./kcMessenger");

// Strip leading emojis for cleaner KC messages
function cleanForKc(text) {
  return text.replace(/^[\u{1F300}-\u{1FAD6}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]+\s*/gu, "").trim();
}

/**
 * Send a notification to a user (in-app + KingsChat).
 */
async function notify({ userId, type, title, message, link, metadata, senderUserId }) {
  try {
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
    const kcMsg = `📋 Prime Ops\n\n${cleanForKc(title)}\n${cleanForKc(message)}`;
    sendKcNotification(userId, kcMsg, senderUserId).catch(() => {});
  } catch (err) {
    console.error("Failed to create notification:", err);
  }
}

/**
 * Notify all members of a committee (who have linked user accounts OR KingsChat IDs).
 */
async function notifyCommitteeMembers({ committeeId, type, title, message, link, metadata, excludeUserId, senderUserId }) {
  try {
    const members = await prisma.member.findMany({
      where: { committeeId },
      select: { userId: true, kcId: true },
    });
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
    const kcMsg = `📋 Prime Ops\n\n${cleanForKc(title)}\n${cleanForKc(message)}`;
    sendKcToCommittee(committeeId, kcMsg, excludeUserId, senderUserId).catch(() => {});
  } catch (err) {
    console.error("Failed to notify committee:", err);
  }
}

/**
 * Notify only the director who owns a specific event.
 * Falls back to notifyDirectors if no eventId or no createdById.
 */
async function notifyEventDirector({ eventId, type, title, message, link, metadata, senderUserId }) {
  try {
    let directorId = null;

    if (eventId) {
      const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { createdById: true },
      });
      directorId = event?.createdById;
    }

    if (directorId) {
      await prisma.notification.create({
        data: {
          userId: directorId,
          type,
          title,
          message,
          link: link || null,
          metadata: metadata ? JSON.stringify(metadata) : null,
        },
      });
      const kcMsg = `📋 Prime Ops\n\n${cleanForKc(title)}\n${cleanForKc(message)}`;
      sendKcNotification(directorId, kcMsg, senderUserId).catch(() => {});
    } else {
      await notifyDirectors({ type, title, message, link, metadata, senderUserId });
    }
  } catch (err) {
    console.error("Failed to notify event director:", err);
  }
}

/**
 * Notify all directors. Use notifyEventDirector instead when you know the event.
 */
async function notifyDirectors({ type, title, message, link, metadata, senderUserId }) {
  try {
    const directors = await prisma.user.findMany({
      where: { role: "director" },
      select: { id: true },
    });
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
    const kcMsg = `📋 Prime Ops\n\n${cleanForKc(title)}\n${cleanForKc(message)}`;
    sendKcToDirectors(kcMsg, senderUserId).catch(() => {});
  } catch (err) {
    console.error("Failed to notify directors:", err);
  }
}

module.exports = { notify, notifyCommitteeMembers, notifyDirectors, notifyEventDirector };

// services/notifyCommitteeHeads.js
const prisma = require("./db");
const { sendKcNotification } = require("./kcMessenger");

function cleanForKc(text) {
  return text.replace(/^[\u{1F300}-\u{1FAD6}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}]+\s*/gu, "").trim();
}

/**
 * Notify all heads of a specific committee (in-app + KingsChat)
 */
async function notifyCommitteeHeads({ committeeId, type, title, message, link, metadata }) {
  try {
    const heads = await prisma.member.findMany({
      where: {
        committeeId,
        role: "head",
        userId: { not: null },
      },
      select: { userId: true },
    });
    if (heads.length === 0) return 0;

    // In-app notifications
    await prisma.notification.createMany({
      data: heads.map((h) => ({
        userId: h.userId,
        type: type || "status_update",
        title,
        message,
        link: link || `/portal/committee/${committeeId}`,
        metadata: metadata ? JSON.stringify(metadata) : null,
      })),
    });

    // KingsChat messages (fire-and-forget)
    const kcMsg = `📋 Prime Ops\n\n${cleanForKc(title)}\n${cleanForKc(message)}`;
    for (const h of heads) {
      sendKcNotification(h.userId, kcMsg).catch(() => {});
    }

    return heads.length;
  } catch (err) {
    console.error("Notify committee heads error:", err.message);
    return 0;
  }
}

module.exports = { notifyCommitteeHeads };

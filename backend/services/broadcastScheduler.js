const prisma = require("./db");
const { notify } = require("./notifications");

async function processScheduledBroadcasts() {
  try {
    const due = await prisma.scheduledBroadcast.findMany({
      where: { sent: false, scheduledFor: { lte: new Date() } },
      include: {
        event: {
          include: {
            committees: {
              include: { members: { where: { userId: { not: null } }, select: { userId: true } } },
            },
          },
        },
      },
    });

    for (const broadcast of due) {
      const targetCommittees = broadcast.committeeIds?.length
        ? broadcast.event.committees.filter((c) => broadcast.committeeIds.includes(c.id))
        : broadcast.event.committees;

      const notifiedIds = new Set();
      let count = 0;

      for (const committee of targetCommittees) {
        for (const member of committee.members) {
          if (member.userId && !notifiedIds.has(member.userId)) {
            notifiedIds.add(member.userId);
            await notify({
              userId: member.userId,
              type: "director_broadcast",
              title: broadcast.subject || "Alert from Project Director",
              message: broadcast.message,
              link: "/portal",
              metadata: { eventId: broadcast.eventId, urgency: broadcast.urgency },
            });
            count++;
          }
        }
      }

      await prisma.scheduledBroadcast.update({
        where: { id: broadcast.id },
        data: { sent: true, sentAt: new Date() },
      });

      console.log(`[Scheduler] Broadcast "${broadcast.subject || broadcast.id}" sent to ${count} members`);
    }
  } catch (err) {
    console.error("[Scheduler] Error processing broadcasts:", err.message);
  }
}

// Run every 60 seconds
function startBroadcastScheduler() {
  console.log("[Scheduler] Broadcast scheduler started (checking every 60s)");
  setInterval(processScheduledBroadcasts, 60000);
  // Also run immediately on start
  processScheduledBroadcasts();
}

module.exports = { startBroadcastScheduler };

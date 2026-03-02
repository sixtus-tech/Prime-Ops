const prisma = require("./db");
const { notifyCommitteeMembers, notifyDirectors } = require("./notifications");

/**
 * Check all committee deadlines and send reminder notifications.
 * Should be called on a schedule (e.g., every hour or daily).
 *
 * Sends reminders at: 7 days, 3 days, 1 day before deadline,
 * and daily after the deadline until submission.
 */
async function checkDeadlineReminders() {
  try {
    const now = new Date();

    // Get all committees with deadlines that haven't had all proposals submitted
    const committees = await prisma.committee.findMany({
      where: {
        proposalDeadline: { not: null },
      },
      include: {
        event: { select: { id: true, title: true } },
        proposals: { select: { id: true, status: true } },
        members: { select: { userId: true, name: true, role: true } },
      },
    });

    for (const committee of committees) {
      const deadline = new Date(committee.proposalDeadline);

      // Skip if committee already has a submitted/approved proposal
      const hasSubmitted = committee.proposals.some(
        (p) => ["submitted", "approved"].includes(p.status)
      );
      if (hasSubmitted) continue;

      // Calculate days until/since deadline
      const diffMs = deadline.getTime() - now.getTime();
      const daysUntil = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

      // Determine reminder type based on days
      let reminderType = null;
      let urgency = "normal";

      if (daysUntil === 7) {
        reminderType = "7_day_reminder";
        urgency = "normal";
      } else if (daysUntil === 3) {
        reminderType = "3_day_reminder";
        urgency = "high";
      } else if (daysUntil === 1) {
        reminderType = "1_day_reminder";
        urgency = "urgent";
      } else if (daysUntil === 0) {
        reminderType = "due_today";
        urgency = "urgent";
      } else if (daysUntil < 0 && daysUntil >= -14) {
        // Overdue — remind daily for up to 14 days
        reminderType = "overdue";
        urgency = "urgent";
      }

      if (!reminderType) continue;

      // Check if we already sent this reminder today (avoid duplicates)
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const existingReminder = await prisma.notification.findFirst({
        where: {
          type: `deadline_${reminderType}`,
          metadata: { string_contains: committee.id },
          createdAt: { gte: todayStart },
        },
      });
      if (existingReminder) continue;

      // Build reminder message
      const messages = {
        "7_day_reminder": {
          title: `📅 7 days until deadline — ${committee.name}`,
          message: `Your proposal for ${committee.name} (${committee.event?.title}) is due in 7 days on ${deadline.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}. Start working on it if you haven't already!`,
        },
        "3_day_reminder": {
          title: `⚠️ 3 days left — ${committee.name}`,
          message: `Only 3 days until the ${committee.name} proposal is due! Deadline: ${deadline.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}. Please finalize and submit your proposal.`,
        },
        "1_day_reminder": {
          title: `🚨 Tomorrow is the deadline — ${committee.name}`,
          message: `The ${committee.name} proposal is due TOMORROW (${deadline.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}). Submit your proposal today to avoid missing the deadline.`,
        },
        "due_today": {
          title: `🔴 Due TODAY — ${committee.name}`,
          message: `The ${committee.name} proposal is due TODAY. Please submit immediately.`,
        },
        "overdue": {
          title: `❗ OVERDUE (${Math.abs(daysUntil)} day${Math.abs(daysUntil) > 1 ? "s" : ""}) — ${committee.name}`,
          message: `The ${committee.name} proposal was due ${Math.abs(daysUntil)} day${Math.abs(daysUntil) > 1 ? "s" : ""} ago on ${deadline.toLocaleDateString("en-US", { month: "long", day: "numeric" })}. Please submit as soon as possible.`,
        },
      };

      const msg = messages[reminderType];
      if (!msg) continue;

      // Notify committee members
      await notifyCommitteeMembers({
        committeeId: committee.id,
        type: `deadline_${reminderType}`,
        title: msg.title,
        message: msg.message,
        link: `/portal/committee/${committee.id}`,
        metadata: { committeeId: committee.id, reminderType, daysUntil },
      });

      // Notify directors if overdue
      if (reminderType === "overdue") {
        const chairNames = committee.members
          .filter((m) => m.role === "chair" || m.role === "co-chair")
          .map((m) => m.name)
          .join(", ") || "No chair assigned";

        await notifyDirectors({
          type: "committee_overdue",
          title: `Committee overdue: ${committee.name}`,
          message: `${committee.name} (${committee.event?.title}) proposal is ${Math.abs(daysUntil)} day${Math.abs(daysUntil) > 1 ? "s" : ""} overdue. Chair(s): ${chairNames}.`,
          link: `/events/${committee.event?.id}`,
          metadata: { committeeId: committee.id, eventId: committee.event?.id, daysOverdue: Math.abs(daysUntil) },
        });
      }

      console.log(`[Reminders] Sent ${reminderType} for ${committee.name}`);
    }
  } catch (err) {
    console.error("[Reminders] Error checking deadlines:", err);
  }
}

/**
 * Start the deadline reminder scheduler.
 * Checks every hour.
 */
function startDeadlineReminders() {
  // Run immediately on start
  checkDeadlineReminders();

  // Then check every hour
  const interval = setInterval(checkDeadlineReminders, 60 * 60 * 1000);

  console.log("[Reminders] Deadline reminder scheduler started (hourly checks)");
  return interval;
}

module.exports = { checkDeadlineReminders, startDeadlineReminders };

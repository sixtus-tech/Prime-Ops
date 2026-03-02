const prisma = require("./db");

async function logActivity({ action, description, eventId, performedBy }) {
  try {
    await prisma.activity.create({
      data: {
        action,
        description,
        eventId: eventId || null,
        performedBy: performedBy || "system",
      },
    });
  } catch (err) {
    console.error("Activity log error:", err.message);
  }
}

module.exports = { logActivity };

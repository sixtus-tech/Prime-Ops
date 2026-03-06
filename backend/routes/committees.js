const { requireAuth } = require("../middleware/auth");
const express = require("express");
const path = require("path");
const prisma = require("../services/db");
const { notifyCommitteeMembers, notifyDirectors } = require("../services/notifications");
const { logActivity } = require("../services/activity");
const { generateAppointmentLetter, getLetterDownloadPath, LETTERS_DIR } = require("../services/appointmentLetter");
const { sendKcMessageToKcId } = require("../services/kcMessenger");

const router = express.Router();

// ---------------------------------------------------------------------------
// Static: serve appointment letter PDFs
// GET /api/committees/appointment-letters/:filename
// ---------------------------------------------------------------------------
router.use("/appointment-letters", express.static(LETTERS_DIR));

// ---------------------------------------------------------------------------
// GET /api/committees — list all committees (optionally filter by event)
// ---------------------------------------------------------------------------
router.get("/", requireAuth, async (req, res) => {
  try {
    const { eventId } = req.query;
    const where = eventId ? { eventId } : {};
    if (req.user?.id) where.event = { createdById: req.user.id };

    const committees = await prisma.committee.findMany({
      where,
      include: {
        members: true,
        responsibilities: true,
        event: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    res.json({ committees });
  } catch (err) {
    console.error("List committees error:", err);
    res.status(500).json({ error: "Failed to fetch committees." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/committees/:id — get single committee with all details
// ---------------------------------------------------------------------------
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const committee = await prisma.committee.findUnique({
      where: { id: req.params.id },
      include: {
        members: { orderBy: { createdAt: "asc" } },
        responsibilities: true,
        event: { select: { id: true, title: true, status: true, eventType: true } },
      },
    });

    if (!committee) return res.status(404).json({ error: "Committee not found." });

    res.json({ committee });
  } catch (err) {
    console.error("Get committee error:", err);
    res.status(500).json({ error: "Failed to fetch committee." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/committees — create committee for an event
// ---------------------------------------------------------------------------
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, description, suggestedSize, eventId, responsibilities, proposalDeadline } = req.body;

    if (!name || !eventId) {
      return res
        .status(400)
        .json({ error: "Committee name and eventId are required." });
    }

    // Verify event exists
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: "Event not found." });

    const committee = await prisma.committee.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        
        proposalDeadline: proposalDeadline ? new Date(proposalDeadline) : null,
        eventId,
        responsibilities: responsibilities?.length
          ? { create: responsibilities.map((r) => ({ text: r })) }
          : undefined,
      },
      include: { members: true, responsibilities: true },
    });

    res.status(201).json({ committee });
  } catch (err) {
    console.error("Create committee error:", err);
    res.status(500).json({ error: "Failed to create committee." });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/committees/:id — update committee
// ---------------------------------------------------------------------------
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { name, description, suggestedSize, responsibilities, proposalDeadline } = req.body;

    // If responsibilities are provided, replace them all
    if (responsibilities !== undefined) {
      await prisma.responsibility.deleteMany({
        where: { committeeId: req.params.id },
      });
      if (responsibilities.length > 0) {
        await prisma.responsibility.createMany({
          data: responsibilities.map((r) => ({
            text: r,
            committeeId: req.params.id,
          })),
        });
      }
    }

    const committee = await prisma.committee.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(suggestedSize !== undefined && { suggestedSize }),
        ...(proposalDeadline !== undefined && { proposalDeadline: proposalDeadline ? new Date(proposalDeadline) : null }),
      },
      include: { members: true, responsibilities: true },
    });

    res.json({ committee });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Committee not found." });
    }
    console.error("Update committee error:", err);
    res.status(500).json({ error: "Failed to update committee." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/committees/:id/set-deadline — set proposal deadline + create tasks + notify
// ---------------------------------------------------------------------------
router.post("/:id/set-deadline", requireAuth, async (req, res) => {
  try {
    const { proposalDeadline } = req.body;

    if (!proposalDeadline) {
      return res.status(400).json({ error: "proposalDeadline is required." });
    }

    const deadline = new Date(proposalDeadline);

    // Update committee deadline
    const committee = await prisma.committee.update({
      where: { id: req.params.id },
      data: { proposalDeadline: deadline },
      include: {
        event: { select: { id: true, title: true, startDate: true } },
        members: { select: { userId: true, name: true } },
      },
    });

    // Auto-create key tasks for this committee if none exist
    const existingTasks = await prisma.task.count({ where: { committeeId: committee.id } });
    if (existingTasks === 0) {
      const eventDate = committee.event?.startDate;
      const tasksToCreate = [
        {
          title: `Submit ${committee.name} Workplan`,
          description: `Create and submit the committee workplan for director review.`,
          priority: "high",
          dueDate: deadline,
        },
        {
          title: `${committee.name} — Finalize Budget`,
          description: `Prepare detailed budget breakdown for committee activities.`,
          priority: "normal",
          dueDate: new Date(deadline.getTime() + 3 * 86400000),
        },
        {
          title: `${committee.name} — Confirm Team Members`,
          description: `Ensure all committee members are confirmed and roles assigned.`,
          priority: "normal",
          dueDate: new Date(deadline.getTime() - 3 * 86400000),
        },
      ];

      if (eventDate) {
        tasksToCreate.push({
          title: `${committee.name} — Final Setup Check`,
          description: `Complete all setup and preparations for the event.`,
          priority: "high",
          dueDate: new Date(new Date(eventDate).getTime() - 86400000),
        });
      }

      for (const t of tasksToCreate) {
        await prisma.task.create({
          data: { ...t, eventId: committee.event?.id, committeeId: committee.id, createdBy: "System", status: "pending" },
        });
      }
    }

    // Notify all committee members about the deadline
    await notifyCommitteeMembers({
      committeeId: committee.id,
      type: "deadline_set",
      title: "Due date set for your committee",
      message: `Workplan for ${committee.name} is due by ${deadline.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}. Make sure to submit before the due date.`,
      link: `/portal/committee/${committee.id}`,
      metadata: { committeeId: committee.id, deadline: proposalDeadline },
    });

    await logActivity({
      action: "deadline_set",
      description: `Workplan due date set for ${committee.name}: ${deadline.toLocaleDateString()}`,
      eventId: committee.event?.id,
      performedBy: "Director",
    });

    res.json({ committee });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Committee not found." });
    console.error("Set deadline error:", err);
    res.status(500).json({ error: "Failed to set deadline." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/committees/:id/send-reminder — director manually sends a reminder
// ---------------------------------------------------------------------------
router.post("/:id/send-reminder", requireAuth, async (req, res) => {
  try {
    const committee = await prisma.committee.findUnique({
      where: { id: req.params.id },
      include: { event: { select: { title: true } } },
    });
    if (!committee) return res.status(404).json({ error: "Committee not found." });

    const deadlineStr = committee.proposalDeadline
      ? new Date(committee.proposalDeadline).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : "not yet set";

    await notifyCommitteeMembers({
      committeeId: committee.id,
      type: "deadline_manual_reminder",
      title: `Reminder from Project Director — ${committee.name}`,
      message: `The Project Director is following up on the ${committee.name} workplan for ${committee.event?.title}. Due date: ${deadlineStr}. Please submit your workplan as soon as possible.`,
      link: `/portal/committee/${committee.id}`,
      metadata: { committeeId: committee.id, manual: true },
    });

    res.json({ sent: true });
  } catch (err) {
    console.error("Send reminder error:", err);
    res.status(500).json({ error: "Failed to send reminder." });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/committees/:id — delete committee
// ---------------------------------------------------------------------------
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await prisma.committee.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Committee not found." });
    }
    console.error("Delete committee error:", err);
    res.status(500).json({ error: "Failed to delete committee." });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// MEMBER ENDPOINTS (nested under committees)
// ═══════════════════════════════════════════════════════════════════════

// ---------------------------------------------------------------------------
// POST /api/committees/:id/members — add member to committee
//   ✓ Creates member record (with optional kcId / kcUsername)
//   ✓ Generates appointment letter PDF
//   ✓ Sends KingsChat notification with portal login link
// ---------------------------------------------------------------------------
router.post("/:id/members", requireAuth, async (req, res) => {
  try {
    const { name, email, phone, role, kcUsername, kcId } = req.body;

    console.log("[Events Add Member] kcId from request:", kcId, "| kcUsername:", kcUsername);

    if (!name) {
      return res.status(400).json({ error: "Member name is required." });
    }

    // Verify committee exists — include event for the appointment letter
    const committee = await prisma.committee.findUnique({
      where: { id: req.params.id },
      include: {
        event: {
          select: {
            id: true,
            title: true,
            startDate: true,
            endDate: true,
            venue: true,
          },
        },
      },
    });
    if (!committee) return res.status(404).json({ error: "Committee not found." });

    // Auto-link to user if email matches
    let userId = null;
    if (email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
      });
      if (existingUser) userId = existingUser.id;
    }

    // Also try linking by kcId → User.kcId
    if (!userId && kcId) {
      const kcUser = await prisma.user.findFirst({
        where: { kcId },
        select: { id: true },
      });
      if (kcUser) userId = kcUser.id;
    }

    const member = await prisma.member.create({
      data: {
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        role: role || "member",
        userId,
        kcId: kcId || null,
        kcUsername: kcUsername?.trim() || null,
        committeeId: req.params.id,
      },
    });

    // ── Generate Appointment Letter PDF (fire-and-forget, don't block response) ──
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";
    const portalLink = `${frontendUrl}/portal/committee/${committee.id}`;

    const roleLabel =
      role === "chair" ? "Team Lead" : role === "co-chair" ? "Co-Team Lead" : "Team Member";

    // Format event date
    let eventDateStr = null;
    if (committee.event?.startDate) {
      eventDateStr = new Date(committee.event.startDate).toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }

    // Generate PDF asynchronously — don't fail the add-member if PDF fails
    generateAppointmentLetter({
      memberName: name.trim(),
      role: role || "member",
      committeeName: committee.name,
      eventTitle: committee.event?.title || "Upcoming Event",
      eventDate: eventDateStr,
      eventVenue: committee.event?.venue || null,
      portalLink,
      memberId: member.id,
    })
      .then(({ fileName }) => {
        console.log(`[Appointment] PDF generated: ${fileName}`);
      })
      .catch((err) => {
        console.error("[Appointment] PDF generation failed:", err.message);
      });

    // ── Send KingsChat notification ─────────────────────────────────────
    const memberKcId = kcId || member.kcId;
    console.log("[Events Add Member] memberKcId:", memberKcId, "| kcId from body:", kcId, "| member.kcId:", member.kcId);
      const kcMessage = [
        `📋 ${committee.event?.title?.toUpperCase() || "PRIME OPS"} — *Appointment as ${roleLabel} of the ${committee.name}*`,
        ``,
        `Dear Esteemed ${name.trim()},`,
        ``,
        `Warm greetings in Jesus name.`,
        `This is to kindly inform you that you have been appointed as ${roleLabel} of the ${committee.name} for "${committee.event?.title || "a project"}". Congratulations!`,
        ``,
        `Kindly proceed to:`,
        `🔗 Access your Committee Portal:`,
        `${portalLink}`,
        ``,
        `📄 Download your Appointment Letter:`,
        `${backendUrl}${getLetterDownloadPath(`appointment-${member.id}.pdf`)}`,
        ``,
        `Also, kindly log in to view your responsibilities, tasks, and collaborate with your team.`,
        ``,
        `Thank you and congratulations once again`,
        ``,
        `Office of the CEO`,
      ].join("\n");
    if (memberKcId) {














      sendKcMessageToKcId(memberKcId, kcMessage, req.user?.id)
        .then((sent) => {
          if (sent) {
            console.log(`[KC] Appointment notification sent to kcId ${memberKcId}`);
          } else {
            console.warn(`[KC] Failed to send appointment notification to kcId ${memberKcId}`);
          }
        })
        .catch((err) => {
          console.error("[KC] Error sending appointment notification:", err.message);
        });
    }

    // ── Also create an in-app notification if member is linked to a User ──
    // Note: we only create the in-app notification here (no KC message),
    // because the KC message is already sent directly above via sendKcMessageToKcId.
    if (userId) {
      try {
        await prisma.notification.create({
          data: {
            userId,
            type: "committee_appointment",
            title: `You've been appointed as ${roleLabel}`,
            message: `Congratulations! You have been appointed to the ${committee.name} committee for "${committee.event?.title}". Kindly log in to view your responsibilities and download your appointment letter.`,
            link: `/portal/committee/${committee.id}`,
            metadata: JSON.stringify({
              committeeId: committee.id,
              memberId: member.id,
              role: role || "member",
              appointmentLetter: getLetterDownloadPath(`appointment-${member.id}.pdf`),
            }),
          },
        });
      } catch (notifErr) {
        console.error("[Notification] Failed to create in-app notification:", notifErr.message);
      }
    }

    // Return the member with the appointment letter download path
    res.status(201).json({
      member,
      appointmentLetter: getLetterDownloadPath(`appointment-${member.id}.pdf`),
    });
  } catch (err) {
    console.error("Add member error:", err);
    res.status(500).json({ error: "Failed to add member." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/committees/:committeeId/members/:memberId/appointment-letter
// Download the appointment letter for a specific member
// ---------------------------------------------------------------------------
router.get("/:committeeId/members/:memberId/appointment-letter", requireAuth, async (req, res) => {
  try {
    const member = await prisma.member.findUnique({
      where: { id: req.params.memberId },
      include: { committee: { select: { name: true } } },
    });

    if (!member || member.committeeId !== req.params.committeeId) {
      return res.status(404).json({ error: "Member not found." });
    }

    const fileName = `appointment-${member.id}.pdf`;
    const filePath = path.join(LETTERS_DIR, fileName);

    const fs = require("fs");
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "Appointment letter not yet generated." });
    }

    const downloadName = `Appointment_Letter_${member.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`;
    res.download(filePath, downloadName);
  } catch (err) {
    console.error("Download appointment letter error:", err);
    res.status(500).json({ error: "Failed to download letter." });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/committees/:committeeId/members/:memberId — update member
// ---------------------------------------------------------------------------
router.put("/:committeeId/members/:memberId", requireAuth, async (req, res) => {
  try {
    const { name, email, phone, role, kcUsername, kcId } = req.body;

    const member = await prisma.member.update({
      where: { id: req.params.memberId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(email !== undefined && { email: email?.trim() || null }),
        ...(phone !== undefined && { phone: phone?.trim() || null }),
        ...(role !== undefined && { role }),
        ...(kcUsername !== undefined && { kcUsername: kcUsername?.trim() || null }),
        ...(kcId !== undefined && { kcId: kcId || null }),
      },
    });

    res.json({ member });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Member not found." });
    }
    console.error("Update member error:", err);
    res.status(500).json({ error: "Failed to update member." });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/committees/:committeeId/members/:memberId — remove member
// ---------------------------------------------------------------------------
router.delete("/:committeeId/members/:memberId", requireAuth, async (req, res) => {
  try {
    await prisma.member.delete({ where: { id: req.params.memberId } });
    res.json({ deleted: true });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Member not found." });
    }
    console.error("Delete member error:", err);
    res.status(500).json({ error: "Failed to remove member." });
  }
});

module.exports = router;

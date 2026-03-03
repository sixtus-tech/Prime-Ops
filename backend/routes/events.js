const { requireAuth } = require("../middleware/auth");
const express = require("express");
const prisma = require("../services/db");
const { logActivity } = require("../services/activity");
const { notifyCommitteeMembers } = require("../services/notifications");

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/events — list all events (with optional filters)
// ---------------------------------------------------------------------------
router.get("/", requireAuth, async (req, res) => {
  try {
    const { status, eventType, search, sort = "updatedAt", order = "desc" } = req.query;

    const where = {};
    if (req.user?.id) where.createdById = req.user.id;
    if (status) where.status = status;
    if (eventType) where.eventType = eventType;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { summary: { contains: search } },
      ];
    }

    const events = await prisma.event.findMany({
      where,
      include: {
        committees: { include: { members: true } },
        proposals: { select: { id: true, status: true, createdAt: true } },
      },
      orderBy: { [sort]: order },
    });

    res.json({ events });
  } catch (err) {
    console.error("List events error:", err);
    res.status(500).json({ error: "Failed to fetch events." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/events/:id — get single event with all related data
// ---------------------------------------------------------------------------
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        committees: {
          include: {
            members: true,
            responsibilities: true,
            proposals: { select: { id: true, status: true } },
          },
        },
        proposals: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!event) return res.status(404).json({ error: "Event not found." });

    res.json({ event });
  } catch (err) {
    console.error("Get event error:", err);
    res.status(500).json({ error: "Failed to fetch event." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/events — create new event
// ---------------------------------------------------------------------------
router.post("/", requireAuth, async (req, res) => {
  try {
    const {
      title,
      subtitle,
      eventType,
      summary,
      startDate,
      endDate,
      venue,
      estimatedAttendance,
      estimatedBudget,
      status,
    } = req.body;

    if (!title || title.trim().length < 2) {
      return res.status(400).json({ error: "Event title is required." });
    }

    const event = await prisma.event.create({
      data: {
        title: title.trim(),
        subtitle: subtitle?.trim() || null,
        eventType: eventType || "general",
        summary: summary?.trim() || null,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        venue: venue?.trim() || null,
        estimatedAttendance: estimatedAttendance || null,
        estimatedBudget: estimatedBudget || null,
        status: status || "draft",
        createdById: req.user?.id || null,
      },
      include: {
        committees: true,
        proposals: true,
      },
    });

    logActivity({
      action: "event_created",
      description: `Event "${event.title}" created`,
      eventId: event.id,
    }).catch(() => {});

    res.status(201).json({ event });
  } catch (err) {
    console.error("Create event error:", err);
    res.status(500).json({ error: "Failed to create event." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/events/from-proposal — create event + committees from proposal JSON
// ---------------------------------------------------------------------------
router.post("/from-proposal", requireAuth, async (req, res) => {
  try {
    const { proposalId, proposal } = req.body;

    if (!proposal) {
      return res.status(400).json({ error: "Proposal data is required." });
    }

    const p = typeof proposal === "string" ? JSON.parse(proposal) : proposal;

    const event = await prisma.event.create({
      data: {
        title: p.title || "Untitled Event",
        subtitle: p.subtitle || null,
        eventType: p.eventType || "general",
        summary: p.summary || null,
        venue: p.venue?.suggestions?.[0] || p.venue?.type || null,
        estimatedAttendance: p.targetAudience?.estimatedAttendance || null,
        estimatedBudget: p.budget?.estimatedTotal || null,
        status: "draft",
        createdById: req.user?.id || null,
        committees: p.committees?.length
          ? {
              create: p.committees.map((c) => ({
                name: c.name,
                description: c.responsibilities?.join("; ") || null,
                responsibilities: c.responsibilities?.length
                  ? { create: c.responsibilities.map((r) => ({ text: r })) }
                  : undefined,
              })),
            }
          : undefined,
      },
      include: {
        committees: { include: { responsibilities: true, members: true } },
      },
    });

    if (proposalId) {
      await prisma.proposal
        .update({ where: { id: proposalId }, data: { eventId: event.id } })
        .catch(() => {});
    }

    logActivity({
      action: "event_created",
      description: `Event "${event.title}" created from AI proposal with ${event.committees?.length || 0} committees`,
      eventId: event.id,
    }).catch(() => {});

    res.status(201).json({ event });
  } catch (err) {
    console.error("Create from proposal error:", err);
    res.status(500).json({ error: "Failed to create event from proposal." });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/events/:id — update event
// ---------------------------------------------------------------------------
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const {
      title,
      subtitle,
      eventType,
      summary,
      startDate,
      endDate,
      venue,
      estimatedAttendance,
      estimatedBudget,
      status,
    } = req.body;

    const event = await prisma.event.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(subtitle !== undefined && { subtitle: subtitle?.trim() || null }),
        ...(eventType !== undefined && { eventType }),
        ...(summary !== undefined && { summary: summary?.trim() || null }),
        ...(startDate !== undefined && { startDate: startDate ? new Date(startDate) : null }),
        ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
        ...(venue !== undefined && { venue: venue?.trim() || null }),
        ...(estimatedAttendance !== undefined && { estimatedAttendance }),
        ...(estimatedBudget !== undefined && { estimatedBudget }),
        ...(status !== undefined && { status }),
      },
      include: {
        committees: { include: { members: true } },
      },
    });

    if (status !== undefined) {
      logActivity({
        action: "status_changed",
        description: `Event "${event.title}" status changed to ${status}`,
        eventId: event.id,
      }).catch(() => {});
    } else {
      logActivity({
        action: "event_updated",
        description: `Event "${event.title}" details updated`,
        eventId: event.id,
      }).catch(() => {});
    }

    res.json({ event });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Event not found." });
    }
    console.error("Update event error:", err);
    res.status(500).json({ error: "Failed to update event." });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/events/:id — delete event and cascade
// ---------------------------------------------------------------------------
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Event not found." });
    }
    console.error("Delete event error:", err);
    res.status(500).json({ error: "Failed to delete event." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/events/:id/set-deadlines — bulk set deadlines for all committees
// ---------------------------------------------------------------------------
router.post("/:id/set-deadlines", requireAuth, async (req, res) => {
  try {
    const { deadlines } = req.body;
    if (!deadlines || !Array.isArray(deadlines)) {
      return res.status(400).json({ error: "deadlines array is required." });
    }

    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      select: { id: true, startDate: true },
    });
    if (!event) return res.status(404).json({ error: "Event not found." });

    // Update all committee deadlines in parallel
    const validDeadlines = deadlines.filter((d) => d.committeeId && d.proposalDeadline);

    // Step 1: Batch update all deadlines at once using a transaction
    const updatePromises = validDeadlines.map((d) =>
      prisma.committee.update({
        where: { id: d.committeeId },
        data: { proposalDeadline: new Date(d.proposalDeadline) },
        select: { id: true, name: true },
      })
    );
    const committees = await Promise.all(updatePromises);

    // Step 2: Check which committees need tasks and create them in bulk
    const allTasksToCreate = [];
    for (let i = 0; i < committees.length; i++) {
      const committee = committees[i];
      const deadline = new Date(validDeadlines[i].proposalDeadline);
      const existingTasks = await prisma.task.count({ where: { committeeId: committee.id } });
      if (existingTasks === 0) {
        allTasksToCreate.push(
          { title: `Submit ${committee.name} Proposal`, priority: "high", dueDate: deadline, eventId: event.id, committeeId: committee.id, createdBy: "System", status: "pending" },
          { title: `${committee.name} — Finalize Budget`, priority: "normal", dueDate: new Date(deadline.getTime() + 3 * 86400000), eventId: event.id, committeeId: committee.id, createdBy: "System", status: "pending" },
          { title: `${committee.name} — Confirm Team`, priority: "normal", dueDate: new Date(deadline.getTime() - 3 * 86400000), eventId: event.id, committeeId: committee.id, createdBy: "System", status: "pending" }
        );
        if (event.startDate) {
          allTasksToCreate.push({
            title: `${committee.name} — Final Setup`,
            priority: "high",
            dueDate: new Date(new Date(event.startDate).getTime() - 86400000),
            eventId: event.id,
            committeeId: committee.id,
            createdBy: "System",
            status: "pending",
          });
        }
      }
    }

    // Single bulk insert for ALL tasks across ALL committees
    if (allTasksToCreate.length > 0) {
      await prisma.task.createMany({ data: allTasksToCreate });
    }

    const results = committees.map((c, i) => ({
      committeeId: c.id,
      name: c.name,
      deadline: new Date(validDeadlines[i].proposalDeadline),
    }));

    // Fire-and-forget: notifications + activity log
    logActivity({
      action: "deadlines_set",
      description: `Deadlines set for ${results.length} committees`,
      eventId: event.id,
      performedBy: "Director",
    }).catch(() => {});

    // Notify committee members in background (don't block response)
    for (const d of validDeadlines) {
      const deadline = new Date(d.proposalDeadline);
      notifyCommitteeMembers({
        committeeId: d.committeeId,
        type: "deadline_set",
        title: "Deadline set for your committee",
        message: `Your committee proposal is due by ${deadline.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}.`,
        link: `/portal/committee/${d.committeeId}`,
        metadata: { committeeId: d.committeeId, deadline: d.proposalDeadline },
      }).catch(() => {});
    }

    res.json({ updated: results });
  } catch (err) {
    console.error("Bulk set deadlines error:", err);
    res.status(500).json({ error: "Failed to set deadlines." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/events/:id/broadcast — send or schedule alert
router.post("/:id/broadcast", requireAuth, async (req, res) => {
  try {
    const { subject, message, urgency, committeeIds, scheduledFor } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required." });

    const event = await prisma.event.findUnique({
      where: { id: req.params.id },
      include: {
        committees: {
          include: { members: { where: { userId: { not: null } }, select: { userId: true } } },
        },
      },
    });
    if (!event) return res.status(404).json({ error: "Event not found." });

    // Schedule for later
    if (scheduledFor && new Date(scheduledFor) > new Date()) {
      const scheduled = await prisma.scheduledBroadcast.create({
        data: {
          eventId: event.id,
          subject: subject || null,
          message,
          urgency: urgency || "normal",
          committeeIds: committeeIds?.length ? committeeIds : null,
          scheduledFor: new Date(scheduledFor),
          createdBy: req.user?.name || "Director",
        },
      });
      return res.json({ scheduled: true, id: scheduled.id, scheduledFor: scheduled.scheduledFor, message: "Alert scheduled for " + new Date(scheduledFor).toLocaleString() });
    }

    // Send immediately — filter committees if specified
    const targetCommittees = committeeIds?.length
      ? event.committees.filter((c) => committeeIds.includes(c.id))
      : event.committees;

    const { notify } = require("../services/notifications");
    const notifiedIds = new Set();
    let notifCount = 0;

    for (const committee of targetCommittees) {
      for (const member of committee.members) {
        if (member.userId && !notifiedIds.has(member.userId)) {
          notifiedIds.add(member.userId);
          await notify({
            userId: member.userId,
            type: "director_broadcast",
            title: subject || "Alert from Program Director",
            message,
            link: "/portal",
            metadata: { eventId: event.id, urgency: urgency || "normal" },
            senderUserId: req.user?.id,
          });
          notifCount++;
        }
      }
    }

    const committeeNames = targetCommittees.map((c) => c.name).join(", ");
    logActivity({
      action: "director_broadcast",
      description: "Broadcast to " + committeeNames + ": " + (subject || message.substring(0, 50)) + "... sent to " + notifCount + " members",
      eventId: event.id,
      performedBy: req.user?.name || "Director",
    }).catch(() => {});

    res.json({ sent: notifCount, message: "Alert sent to " + notifCount + " members across " + targetCommittees.length + " committee(s)." });
  } catch (err) {
    console.error("Broadcast error:", err);
    res.status(500).json({ error: "Failed to send broadcast." });
  }
});

// GET /api/events/:id/scheduled-broadcasts
router.get("/:id/scheduled-broadcasts", requireAuth, async (req, res) => {
  try {
    const broadcasts = await prisma.scheduledBroadcast.findMany({
      where: { eventId: req.params.id },
      orderBy: { scheduledFor: "asc" },
    });
    res.json({ broadcasts });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch scheduled broadcasts." });
  }
});

// DELETE /api/events/:id/scheduled-broadcasts/:broadcastId
router.delete("/:id/scheduled-broadcasts/:broadcastId", requireAuth, async (req, res) => {
  try {
    await prisma.scheduledBroadcast.delete({ where: { id: req.params.broadcastId } });
    res.json({ deleted: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete scheduled broadcast." });
  }
});

module.exports = router;

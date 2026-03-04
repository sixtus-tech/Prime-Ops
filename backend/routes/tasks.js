const express = require("express");
const prisma = require("../services/db");
const { requireAuth } = require("../middleware/auth");
const { logActivity } = require("../services/activity");
const { notify, notifyCommitteeMembers } = require("../services/notifications");

const router = express.Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// GET /api/tasks — list tasks (filterable by eventId, committeeId, status, assignedToId)
// ---------------------------------------------------------------------------
router.get("/", async (req, res) => {
  try {
    const { eventId, committeeId, status, assignedToId, myTasks } = req.query;
    const where = {};

    if (eventId) where.eventId = eventId;
    if (committeeId) where.committeeId = committeeId;
    if (status) where.status = status;
    if (assignedToId) where.assignedToId = assignedToId;

    // "myTasks" — get tasks assigned to current user or their committees
    if (myTasks === "true") {
      const memberships = await prisma.member.findMany({
        where: { userId: req.user.id },
        select: { committeeId: true },
      });
      const committeeIds = memberships.map((m) => m.committeeId);

      where.OR = [
        { assignedToId: req.user.id },
        { committeeId: { in: committeeIds } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      include: {
        event: { select: { id: true, title: true } },

      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }, { createdAt: "desc" }],
    });

    // Auto-mark overdue tasks
    const now = new Date();
    const updated = tasks.map((t) => {
      if (t.dueDate && new Date(t.dueDate) < now && t.status === "pending") {
        return { ...t, status: "overdue" };
      }
      return t;
    });

    res.json({ tasks: updated });
  } catch (err) {
    console.error("List tasks error:", err);
    res.status(500).json({ error: "Failed to fetch tasks." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tasks — create a task
// ---------------------------------------------------------------------------
router.post("/", async (req, res) => {
  try {
    const { title, description, type, priority, dueDate, assignedTo, assignedToId, eventId, committeeId } = req.body;

    if (!title) {
      return res.status(400).json({ error: "Task title is required." });
    }

    const task = await prisma.task.create({
      data: {
        title: title.trim(),
        description: description?.trim() || null,
        type: type || "general",
        priority: priority || "normal",
        dueDate: dueDate ? new Date(dueDate) : null,
        assignedTo: assignedTo?.trim() || null,
        assignedToId: assignedToId || null,
        eventId: eventId || null,
        committeeId: committeeId || null,
        createdBy: req.user.name,
      },
      include: {
        event: { select: { id: true, title: true } },

      },
    });

    // Notify assigned user
    if (assignedToId) {
      await notify({
        userId: assignedToId,
        type: "task_assigned",
        title: "New task assigned",
        message: `"${title}" has been assigned to you${dueDate ? ` — due ${new Date(dueDate).toLocaleDateString()}` : ""}.`,
        link: committeeId ? `/portal/committee/${committeeId}` : "/portal",
        metadata: { taskId: task.id },
      });
    }

    // Notify committee if task is committee-scoped
    if (committeeId && !assignedToId) {
      await notifyCommitteeMembers({
        committeeId,
        type: "task_assigned",
        title: "New task for your committee",
        message: `"${title}"${dueDate ? ` — due ${new Date(dueDate).toLocaleDateString()}` : ""}`,
        link: `/portal/committee/${committeeId}`,
        metadata: { taskId: task.id },
        excludeUserId: req.user.id,
      });
    }

    if (eventId) {
      await logActivity({
        action: "task_created",
        description: `Task "${title}" created by ${req.user.name}`,
        eventId,
        performedBy: req.user.name,
      });
    }

    res.status(201).json({ task });
  } catch (err) {
    console.error("Create task error:", err);
    res.status(500).json({ error: "Failed to create task." });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/tasks/:id — update task
// ---------------------------------------------------------------------------
router.put("/:id", async (req, res) => {
  try {
    const { title, description, type, status, priority, dueDate, assignedTo, assignedToId } = req.body;

    const data = {};
    if (title !== undefined) data.title = title.trim();
    if (description !== undefined) data.description = description?.trim() || null;
    if (type !== undefined) data.type = type;
    if (status !== undefined) data.status = status;
    if (priority !== undefined) data.priority = priority;
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    if (assignedTo !== undefined) data.assignedTo = assignedTo?.trim() || null;
    if (assignedToId !== undefined) data.assignedToId = assignedToId || null;

    // If marking as completed, set completedAt
    if (status === "completed") data.completedAt = new Date();
    if (status === "pending" || status === "in_progress") data.completedAt = null;

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data,
      include: {
        event: { select: { id: true, title: true } },

      },
    });

    res.json({ task });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Task not found." });
    console.error("Update task error:", err);
    res.status(500).json({ error: "Failed to update task." });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:id
// ---------------------------------------------------------------------------
router.delete("/:id", async (req, res) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Task not found." });
    console.error("Delete task error:", err);
    res.status(500).json({ error: "Failed to delete task." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/tasks/auto-create — auto-create standard tasks for a committee
// ---------------------------------------------------------------------------
router.post("/auto-create", async (req, res) => {
  try {
    const { eventId, committeeId, proposalDeadline } = req.body;

    if (!eventId || !committeeId) {
      return res.status(400).json({ error: "eventId and committeeId are required." });
    }

    const committee = await prisma.committee.findUnique({
      where: { id: committeeId },
      include: { event: { select: { title: true, startDate: true } } },
    });
    if (!committee) return res.status(404).json({ error: "Committee not found." });

    const deadline = proposalDeadline ? new Date(proposalDeadline) : committee.proposalDeadline;
    const eventDate = committee.event?.startDate;

    const tasksToCreate = [
      {
        title: `Submit ${committee.name} Proposal`,
        description: `Create and submit the committee proposal for review by the Project Director.`,
        type: "proposal_submission",
        priority: "high",
        dueDate: deadline || null,
      },
      {
        title: `${committee.name} — Finalize Budget`,
        description: `Prepare detailed budget breakdown for committee activities.`,
        type: "budget_review",
        priority: "normal",
        dueDate: deadline ? new Date(deadline.getTime() + 3 * 24 * 60 * 60 * 1000) : null, // 3 days after proposal
      },
      {
        title: `${committee.name} — Confirm Team Members`,
        description: `Ensure all committee members are confirmed and roles assigned.`,
        type: "general",
        priority: "normal",
        dueDate: deadline ? new Date(deadline.getTime() - 3 * 24 * 60 * 60 * 1000) : null, // 3 days before proposal
      },
    ];

    if (eventDate) {
      tasksToCreate.push({
        title: `${committee.name} — Final Setup Check`,
        description: `Complete all setup and preparations for the event.`,
        type: "setup",
        priority: "high",
        dueDate: new Date(new Date(eventDate).getTime() - 24 * 60 * 60 * 1000), // Day before event
      });
    }

    const created = [];
    for (const t of tasksToCreate) {
      const task = await prisma.task.create({
        data: {
          ...t,
          eventId,
          committeeId,
          createdBy: req.user.name,
          status: "pending",
        },
      });
      created.push(task);
    }

    res.status(201).json({ tasks: created });
  } catch (err) {
    console.error("Auto-create tasks error:", err);
    res.status(500).json({ error: "Failed to create tasks." });
  }
});

module.exports = router;

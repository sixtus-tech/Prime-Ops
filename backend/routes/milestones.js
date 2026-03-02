const express = require("express");
const prisma = require("../services/db");
const {
  generateMasterMilestones,
  generateSubMilestones,
  recalculateMilestoneProgress,
} = require("../services/milestoneGenerator");
const { logActivity } = require("../services/activity");

const router = express.Router();

// ═══════════════════════════════════════════════════════════════════════
// GET /api/milestones/committee/:committeeId — get sub-milestones for portal
// (Must be above /:eventId catch-all)
// ═══════════════════════════════════════════════════════════════════════

router.get("/committee/:committeeId", async (req, res) => {
  try {
    const subMilestones = await prisma.subMilestone.findMany({
      where: { committeeId: req.params.committeeId },
      include: {
        milestone: { select: { id: true, title: true, phase: true, targetDate: true, status: true } },
      },
      orderBy: [{ milestone: { phase: "asc" } }, { sortOrder: "asc" }],
    });

    const total = subMilestones.length;
    const completed = subMilestones.filter(
      (s) => s.status === "completed" || s.status === "verified"
    ).length;

    res.json({
      subMilestones,
      stats: {
        total,
        completed,
        progress: total > 0 ? Math.round((completed / total) * 100) : 0,
        pendingApproval: subMilestones.filter((s) => s.status === "pending_approval").length,
      },
    });
  } catch (err) {
    console.error("Get committee sub-milestones error:", err);
    res.status(500).json({ error: "Failed to fetch sub-milestones." });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GET /api/milestones/pending-approvals/:eventId — get all pending approvals
// (Must be above /:eventId catch-all)
// ═══════════════════════════════════════════════════════════════════════

router.get("/pending-approvals/:eventId", async (req, res) => {
  try {
    const pending = await prisma.subMilestone.findMany({
      where: {
        status: "pending_approval",
        milestone: { eventId: req.params.eventId },
      },
      include: {
        milestone: { select: { id: true, title: true, phase: true } },
        committee: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    res.json({ pendingApprovals: pending });
  } catch (err) {
    console.error("Get pending approvals error:", err);
    res.status(500).json({ error: "Failed to fetch pending approvals." });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// GET /api/milestones/:eventId — get full milestone map for an event
// (Catch-all — must be AFTER specific routes above)
// ═══════════════════════════════════════════════════════════════════════

router.get("/:eventId", async (req, res) => {
  try {
    const milestones = await prisma.milestone.findMany({
      where: { eventId: req.params.eventId },
      include: {
        subMilestones: {
          include: {
            committee: { select: { id: true, name: true } },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { phase: "asc" },
    });

    // Calculate overall event progress
    const totalSubs = milestones.reduce((sum, m) => sum + m.subMilestones.length, 0);
    const completedSubs = milestones.reduce(
      (sum, m) =>
        sum +
        m.subMilestones.filter(
          (s) => s.status === "completed" || s.status === "verified"
        ).length,
      0
    );
    const overallProgress = totalSubs > 0 ? Math.round((completedSubs / totalSubs) * 100) : 0;

    res.json({
      milestones,
      stats: {
        total: milestones.length,
        completed: milestones.filter((m) => m.status === "completed").length,
        inProgress: milestones.filter((m) => m.status === "in_progress").length,
        atRisk: milestones.filter((m) => m.status === "at_risk").length,
        notStarted: milestones.filter((m) => m.status === "not_started").length,
        overallProgress,
        totalSubMilestones: totalSubs,
        completedSubMilestones: completedSubs,
      },
    });
  } catch (err) {
    console.error("Get milestones error:", err);
    res.status(500).json({ error: "Failed to fetch milestones." });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /api/milestones/:eventId/generate — generate master milestones
// Called when event proposal is created (Phase 1)
// ═══════════════════════════════════════════════════════════════════════

router.post("/:eventId/generate", async (req, res) => {
  try {
    // Check if milestones already exist
    const existing = await prisma.milestone.count({
      where: { eventId: req.params.eventId },
    });

    if (existing > 0) {
      return res.status(400).json({
        error: "Milestones already exist for this event. Delete them first or use the edit endpoints.",
      });
    }

    const milestones = await generateMasterMilestones(req.params.eventId);

    await logActivity({
      eventId: req.params.eventId,
      action: "milestones_generated",
      description: `Generated ${milestones.length} master milestones`,
      performedBy: req.body.performedBy || "System",
    });

    res.status(201).json({ milestones });
  } catch (err) {
    console.error("Generate milestones error:", err);
    res.status(500).json({ error: "Failed to generate milestones." });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /api/milestones/:eventId/generate-sub/:committeeId
// Generate sub-milestones for a committee (Phase 2)
// Called when a committee proposal is approved
// ═══════════════════════════════════════════════════════════════════════

router.post("/:eventId/generate-sub/:committeeId", async (req, res) => {
  try {
    const { proposalJson } = req.body;
    if (!proposalJson) {
      return res.status(400).json({ error: "proposalJson is required." });
    }

    const subs = await generateSubMilestones(req.params.committeeId, proposalJson);

    const committee = await prisma.committee.findUnique({
      where: { id: req.params.committeeId },
      select: { name: true },
    });

    await logActivity({
      eventId: req.params.eventId,
      action: "sub_milestones_generated",
      description: `Generated ${subs.length} sub-milestones for ${committee?.name || "committee"}`,
      performedBy: req.body.performedBy || "System",
    });

    res.status(201).json({ subMilestones: subs });
  } catch (err) {
    console.error("Generate sub-milestones error:", err);
    res.status(500).json({ error: "Failed to generate sub-milestones." });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// PUT /api/milestones/master/:id — edit a master milestone (director)
// ═══════════════════════════════════════════════════════════════════════

router.put("/master/:id", async (req, res) => {
  try {
    const { title, description, targetDate, requiresApproval, phase } = req.body;

    const milestone = await prisma.milestone.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(targetDate !== undefined && { targetDate: targetDate ? new Date(targetDate) : null }),
        ...(requiresApproval !== undefined && { requiresApproval }),
        ...(phase !== undefined && { phase }),
      },
      include: {
        subMilestones: {
          include: { committee: { select: { id: true, name: true } } },
        },
      },
    });

    res.json({ milestone });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Milestone not found." });
    }
    console.error("Update milestone error:", err);
    res.status(500).json({ error: "Failed to update milestone." });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// POST /api/milestones/master — add a new master milestone manually
// ═══════════════════════════════════════════════════════════════════════

router.post("/master", async (req, res) => {
  try {
    const { eventId, title, description, targetDate, requiresApproval, phase } = req.body;
    if (!eventId || !title) {
      return res.status(400).json({ error: "eventId and title are required." });
    }

    // Auto-determine phase if not provided
    let phaseNum = phase;
    if (!phaseNum) {
      const maxPhase = await prisma.milestone.findFirst({
        where: { eventId },
        orderBy: { phase: "desc" },
        select: { phase: true },
      });
      phaseNum = (maxPhase?.phase || 0) + 1;
    }

    const milestone = await prisma.milestone.create({
      data: {
        eventId,
        title,
        description: description || null,
        targetDate: targetDate ? new Date(targetDate) : null,
        requiresApproval: requiresApproval || false,
        phase: phaseNum,
      },
    });

    res.status(201).json({ milestone });
  } catch (err) {
    console.error("Create milestone error:", err);
    res.status(500).json({ error: "Failed to create milestone." });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// DELETE /api/milestones/master/:id — delete a milestone + its subs
// ═══════════════════════════════════════════════════════════════════════

router.delete("/master/:id", async (req, res) => {
  try {
    await prisma.milestone.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Milestone not found." });
    }
    console.error("Delete milestone error:", err);
    res.status(500).json({ error: "Failed to delete milestone." });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// DELETE /api/milestones/:eventId/all — delete all milestones for event
// (for regeneration)
// ═══════════════════════════════════════════════════════════════════════

router.delete("/:eventId/all", async (req, res) => {
  try {
    const deleted = await prisma.milestone.deleteMany({
      where: { eventId: req.params.eventId },
    });
    res.json({ success: true, deletedCount: deleted.count });
  } catch (err) {
    console.error("Delete all milestones error:", err);
    res.status(500).json({ error: "Failed to delete milestones." });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// SUB-MILESTONE ACTIONS
// ═══════════════════════════════════════════════════════════════════════

// ── Committee head marks sub-milestone complete ──────────────────────

router.post("/sub/:id/complete", async (req, res) => {
  try {
    const sub = await prisma.subMilestone.findUnique({
      where: { id: req.params.id },
      include: { milestone: true },
    });

    if (!sub) return res.status(404).json({ error: "Sub-milestone not found." });

    if (sub.requiresApproval) {
      // Critical: goes to pending_approval
      await prisma.subMilestone.update({
        where: { id: sub.id },
        data: { status: "pending_approval" },
      });
    } else {
      // Operational: auto-complete
      await prisma.subMilestone.update({
        where: { id: sub.id },
        data: {
          status: "completed",
          completedAt: new Date(),
        },
      });
    }

    await recalculateMilestoneProgress(sub.milestoneId);

    const updated = await prisma.subMilestone.findUnique({
      where: { id: sub.id },
      include: {
        milestone: true,
        committee: { select: { id: true, name: true } },
      },
    });

    res.json({ subMilestone: updated });
  } catch (err) {
    console.error("Complete sub-milestone error:", err);
    res.status(500).json({ error: "Failed to complete sub-milestone." });
  }
});

// ── Director approves a critical sub-milestone ───────────────────────

router.post("/sub/:id/approve", async (req, res) => {
  try {
    const { approvedBy } = req.body;

    const sub = await prisma.subMilestone.findUnique({
      where: { id: req.params.id },
    });

    if (!sub) return res.status(404).json({ error: "Sub-milestone not found." });
    if (sub.status !== "pending_approval") {
      return res.status(400).json({ error: "Sub-milestone is not pending approval." });
    }

    await prisma.subMilestone.update({
      where: { id: sub.id },
      data: {
        status: "completed",
        completedAt: new Date(),
        approvedAt: new Date(),
        approvedBy: approvedBy || "Director",
        verified: true,
      },
    });

    await recalculateMilestoneProgress(sub.milestoneId);

    const updated = await prisma.subMilestone.findUnique({
      where: { id: sub.id },
      include: {
        milestone: true,
        committee: { select: { id: true, name: true } },
      },
    });

    res.json({ subMilestone: updated });
  } catch (err) {
    console.error("Approve sub-milestone error:", err);
    res.status(500).json({ error: "Failed to approve sub-milestone." });
  }
});

// ── Director reverts a sub-milestone ─────────────────────────────────

router.post("/sub/:id/revert", async (req, res) => {
  try {
    const sub = await prisma.subMilestone.findUnique({
      where: { id: req.params.id },
    });

    if (!sub) return res.status(404).json({ error: "Sub-milestone not found." });

    await prisma.subMilestone.update({
      where: { id: sub.id },
      data: {
        status: "in_progress",
        completedAt: null,
        approvedAt: null,
        approvedBy: null,
        verified: false,
      },
    });

    await recalculateMilestoneProgress(sub.milestoneId);

    const updated = await prisma.subMilestone.findUnique({
      where: { id: sub.id },
      include: {
        milestone: true,
        committee: { select: { id: true, name: true } },
      },
    });

    res.json({ subMilestone: updated });
  } catch (err) {
    console.error("Revert sub-milestone error:", err);
    res.status(500).json({ error: "Failed to revert sub-milestone." });
  }
});

// ── Update sub-milestone status manually ─────────────────────────────

router.put("/sub/:id", async (req, res) => {
  try {
    const { title, description, status, requiresApproval, sortOrder } = req.body;

    const sub = await prisma.subMilestone.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(status !== undefined && { status }),
        ...(requiresApproval !== undefined && { requiresApproval }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(status === "completed" && { completedAt: new Date() }),
      },
      include: {
        milestone: true,
        committee: { select: { id: true, name: true } },
      },
    });

    await recalculateMilestoneProgress(sub.milestoneId);

    res.json({ subMilestone: sub });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Sub-milestone not found." });
    }
    console.error("Update sub-milestone error:", err);
    res.status(500).json({ error: "Failed to update sub-milestone." });
  }
});

// ── Delete a sub-milestone ───────────────────────────────────────────

router.delete("/sub/:id", async (req, res) => {
  try {
    const sub = await prisma.subMilestone.findUnique({
      where: { id: req.params.id },
      select: { milestoneId: true },
    });

    if (!sub) return res.status(404).json({ error: "Sub-milestone not found." });

    await prisma.subMilestone.delete({ where: { id: req.params.id } });
    await recalculateMilestoneProgress(sub.milestoneId);

    res.json({ success: true });
  } catch (err) {
    console.error("Delete sub-milestone error:", err);
    res.status(500).json({ error: "Failed to delete sub-milestone." });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// (committee route moved above /:eventId catch-all)

module.exports = router;
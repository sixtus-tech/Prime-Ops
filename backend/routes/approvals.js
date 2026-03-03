const { requireAuth } = require("../middleware/auth");
const express = require("express");
const prisma = require("../services/db");
const { logActivity } = require("../services/activity");
const { notifyCommitteeMembers, notifyDirectors } = require("../services/notifications");
const {
  generateMasterMilestones,
  generateSubMilestones,
} = require("../services/milestoneGenerator");

const router = express.Router();

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:4000";

// ---------------------------------------------------------------------------
// GET /api/approvals — list all approval requests (with filters)
// ---------------------------------------------------------------------------
router.get("/", requireAuth, async (req, res) => {
  try {
    const { status, priority, eventId, sort = "createdAt", order = "desc" } = req.query;

    const where = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (eventId) where.eventId = eventId;
    if (req.user?.id) where.event = { createdById: req.user.id };

    const approvals = await prisma.approvalRequest.findMany({
      where,
      include: {
        event: { select: { id: true, title: true, eventType: true, status: true } },
        actions: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
        _count: { select: { actions: true } },
      },
      orderBy: { [sort]: order },
    });

    res.json({ approvals });
  } catch (err) {
    console.error("List approvals error:", err);
    res.status(500).json({ error: "Failed to fetch approvals." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/approvals/stats — counts by status for dashboard
// ---------------------------------------------------------------------------
router.get("/stats", requireAuth, async (req, res) => {
  try {
    const [pending, underReview, approved, rejected, revisionRequested] =
      await Promise.all([
        prisma.approvalRequest.count({ where: { status: "pending" } }),
        prisma.approvalRequest.count({ where: { status: "under_review" } }),
        prisma.approvalRequest.count({ where: { status: "approved" } }),
        prisma.approvalRequest.count({ where: { status: "rejected" } }),
        prisma.approvalRequest.count({ where: { status: "revision_requested" } }),
      ]);

    res.json({
      stats: { pending, underReview, approved, rejected, revisionRequested },
      total: pending + underReview + approved + rejected + revisionRequested,
    });
  } catch (err) {
    console.error("Approval stats error:", err);
    res.status(500).json({ error: "Failed to fetch approval stats." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/approvals/:id — get single approval with full action history
// ---------------------------------------------------------------------------
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const approval = await prisma.approvalRequest.findUnique({
      where: { id: req.params.id },
      include: {
        event: {
          select: { id: true, title: true, eventType: true, status: true, estimatedBudget: true },
        },
        actions: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!approval) return res.status(404).json({ error: "Approval request not found." });

    // Fetch the linked proposal if exists
    let proposal = null;
    if (approval.proposalId) {
      proposal = await prisma.proposal.findUnique({
        where: { id: approval.proposalId },
        select: {
          id: true,
          proposalJson: true,
          status: true,
          inputType: true,
          submittedBy: true,
          createdAt: true,
          committee: { select: { id: true, name: true } },
        },
      });
    }

    res.json({ approval, proposal });
  } catch (err) {
    console.error("Get approval error:", err);
    res.status(500).json({ error: "Failed to fetch approval." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/approvals — create / submit a new approval request
// ---------------------------------------------------------------------------
router.post("/", requireAuth, async (req, res) => {
  try {
    const { eventId, title, description, requestedBy, priority, dueDate } = req.body;

    if (!eventId || !title || !requestedBy) {
      return res
        .status(400)
        .json({ error: "eventId, title, and requestedBy are required." });
    }

    // Verify event exists
    const event = await prisma.event.findUnique({ where: { id: eventId } });
    if (!event) return res.status(404).json({ error: "Event not found." });

    const approval = await prisma.approvalRequest.create({
      data: {
        eventId,
        title: title.trim(),
        description: description?.trim() || null,
        requestedBy: requestedBy.trim(),
        priority: priority || "normal",
        dueDate: dueDate ? new Date(dueDate) : null,
        status: "pending",
        actions: {
          create: {
            action: "submitted",
            performedBy: requestedBy.trim(),
            comment: "Approval request submitted.",
          },
        },
      },
      include: {
        event: { select: { id: true, title: true } },
        actions: true,
      },
    });

    await logActivity({
      action: "approval_submitted",
      description: `"${title}" submitted for approval by ${requestedBy}`,
      eventId,
      performedBy: requestedBy,
    });

    res.status(201).json({ approval });
  } catch (err) {
    console.error("Create approval error:", err);
    res.status(500).json({ error: "Failed to create approval request." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/approvals/:id/action — perform an action (approve, reject, etc.)
// ---------------------------------------------------------------------------
router.post("/:id/action", requireAuth, async (req, res) => {
  try {
    const { action, performedBy, comment } = req.body;

    const validActions = [
      "approved",
      "rejected",
      "commented",
      "revision_requested",
      "under_review",
      "reassigned",
    ];

    if (!action || !validActions.includes(action)) {
      return res.status(400).json({
        error: `Invalid action. Must be one of: ${validActions.join(", ")}`,
      });
    }

    if (!performedBy) {
      return res.status(400).json({ error: "performedBy is required." });
    }

    // Get current approval
    const existing = await prisma.approvalRequest.findUnique({
      where: { id: req.params.id },
      include: { event: { select: { id: true, title: true } } },
    });
    if (!existing) return res.status(404).json({ error: "Approval request not found." });

    // Determine new status based on action
    const statusMap = {
      approved: "approved",
      rejected: "rejected",
      revision_requested: "revision_requested",
      under_review: "under_review",
      commented: existing.status,
      reassigned: existing.status,
    };

    const newStatus = statusMap[action];

    // Update approval status + add action record
    const approval = await prisma.approvalRequest.update({
      where: { id: req.params.id },
      data: {
        status: newStatus,
        actions: {
          create: {
            action,
            performedBy: performedBy.trim(),
            comment: comment?.trim() || null,
          },
        },
      },
      include: {
        event: { select: { id: true, title: true } },
        actions: { orderBy: { createdAt: "asc" } },
      },
    });

    // ═══════════════════════════════════════════════════════════════════
    // APPROVED — update statuses + generate milestones
    // ═══════════════════════════════════════════════════════════════════
    if (action === "approved") {
      await prisma.event.update({
        where: { id: existing.eventId },
        data: { status: "approved" },
      });
      if (existing.proposalId) {
        await prisma.proposal.update({
          where: { id: existing.proposalId },
          data: { status: "approved" },
        }).catch(() => {});
      }

      // ─── MILESTONE GENERATION (non-blocking) ────────────────────────
      if (!existing.committeeId) {
        // PHASE 1: Event-level approval → generate master milestones
        try {
          const existingMilestones = await prisma.milestone.count({
            where: { eventId: existing.eventId },
          });
          if (existingMilestones === 0) {
            const milestones = await generateMasterMilestones(existing.eventId);
            console.log(`[Approval] Generated ${milestones.length} master milestones for "${existing.event.title}"`);
            await logActivity({
              eventId: existing.eventId,
              action: "milestones_generated",
              description: `Generated ${milestones.length} master milestones upon event approval`,
              performedBy,
            });
          }
        } catch (milestoneErr) {
          console.error("[Approval] Milestone generation error (non-blocking):", milestoneErr.message);
        }
      } else {
        // PHASE 2: Committee proposal approved → generate sub-milestones
        try {
          const masterCount = await prisma.milestone.count({
            where: { eventId: existing.eventId },
          });

          if (masterCount > 0 && existing.proposalId) {
            const proposal = await prisma.proposal.findUnique({
              where: { id: existing.proposalId },
              select: { proposalJson: true },
            });

            if (proposal?.proposalJson) {
              const subs = await generateSubMilestones(
                existing.committeeId,
                proposal.proposalJson
              );

              const committee = await prisma.committee.findUnique({
                where: { id: existing.committeeId },
                select: { name: true },
              });

              console.log(`[Approval] Generated ${subs.length} sub-milestones for ${committee?.name}`);
              await logActivity({
                eventId: existing.eventId,
                action: "sub_milestones_generated",
                description: `Generated ${subs.length} sub-milestones for ${committee?.name || "committee"} upon proposal approval`,
                performedBy,
              });
            }
          } else if (masterCount === 0) {
            console.warn("[Approval] No master milestones — sub-milestones skipped. Generate master milestones first.");
          }
        } catch (milestoneErr) {
          console.error("[Approval] Sub-milestone generation error (non-blocking):", milestoneErr.message);
        }
      }
    }

    // ═══════════════════════════════════════════════════════════════════
    // REJECTED
    // ═══════════════════════════════════════════════════════════════════
    if (action === "rejected" && existing.proposalId) {
      await prisma.proposal.update({
        where: { id: existing.proposalId },
        data: { status: "rejected" },
      }).catch(() => {});
    }

    // ═══════════════════════════════════════════════════════════════════
    // REVISION REQUESTED
    // ═══════════════════════════════════════════════════════════════════
    if (action === "revision_requested" && existing.proposalId) {
      await prisma.proposal.update({
        where: { id: existing.proposalId },
        data: { status: "revision_requested" },
      }).catch(() => {});
    }

    // ═══════════════════════════════════════════════════════════════════
    // NOTIFICATIONS
    // ═══════════════════════════════════════════════════════════════════
    const pdfLink = existing.proposalId
      ? `${BACKEND_URL}/api/proposal/${existing.proposalId}/pdf`
      : null;

    if (existing.committeeId && ["approved", "rejected", "revision_requested", "commented"].includes(action)) {
      const actionLabels = {
        approved: "approved",
        rejected: "rejected",
        revision_requested: "sent back for revisions",
        commented: "commented on",
      };

      let kcMessage = `Your proposal "${existing.title}" has been ${actionLabels[action]} by ${performedBy}.`;
      if (comment) kcMessage += `\n\nDirector's note: "${comment}"`;
      if (pdfLink && action === "approved") kcMessage += `\n\nDownload approved proposal: ${pdfLink}`;
      if (action === "revision_requested") kcMessage += `\n\nPlease review the feedback and resubmit your proposal.`;

      await notifyCommitteeMembers({
        committeeId: existing.committeeId,
        type: action === "commented" ? "proposal_comment" : `proposal_${action}`,
        title: `Proposal ${actionLabels[action]}`,
        message: kcMessage,
        link: `/portal/proposals/${existing.proposalId || ""}`,
        metadata: { approvalId: existing.id, proposalId: existing.proposalId, action, pdfLink },
      });
    }

    await logActivity({
      action: `approval_${action}`,
      description: `"${existing.title}" ${action} by ${performedBy}${comment ? `: ${comment}` : ""}`,
      eventId: existing.eventId,
      performedBy,
    });

    res.json({ approval });
  } catch (err) {
    console.error("Approval action error:", err);
    res.status(500).json({ error: "Failed to perform approval action." });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/approvals/:id — delete approval request
// ---------------------------------------------------------------------------
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    await prisma.approvalRequest.delete({ where: { id: req.params.id } });
    res.json({ deleted: true });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Approval request not found." });
    }
    console.error("Delete approval error:", err);
    res.status(500).json({ error: "Failed to delete approval request." });
  }
});

module.exports = router;

const express = require("express");
const prisma = require("../services/db");
const { requireAuth } = require("../middleware/auth");
const { logActivity } = require("../services/activity");
const { notifyEventDirector } = require("../services/notifications");

const router = express.Router();
router.use(requireAuth);

// ── Helper: check if user is chair/co-chair/head in THIS committee ───
function isCommitteeChair(membership, userRole) {
  if (userRole === "director") return true;
  if (!membership) return false;
  return ["chair", "co-chair", "head"].includes(membership.role);
}

// ---------------------------------------------------------------------------
// GET /api/portal/my-committees
// ---------------------------------------------------------------------------
router.get("/my-committees", async (req, res) => {
  try {
    const members = await prisma.member.findMany({
      where: { userId: req.user.id },
      include: {
        committee: {
          include: {
            event: {
              select: {
                id: true, title: true, subtitle: true, status: true,
                eventType: true, startDate: true, endDate: true,
                venue: true, estimatedBudget: true,
              },
            },
            responsibilities: true,
            _count: { select: { members: true, proposals: true } },
          },
        },
      },
    });

    const committees = members.map((m) => ({
      memberRole: m.role,
      memberId: m.id,
      ...m.committee,
    }));

    res.json({ committees });
  } catch (err) {
    console.error("My committees error:", err);
    res.status(500).json({ error: "Failed to fetch committees." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/portal/committee/:id
// ---------------------------------------------------------------------------
router.get("/committee/:id", async (req, res) => {
  try {
    const [membership, committee] = await Promise.all([
      prisma.member.findFirst({
        where: { committeeId: req.params.id, userId: req.user.id },
      }),
      prisma.committee.findUnique({
        where: { id: req.params.id },
        include: {
          event: true,
          responsibilities: true,
          members: {
            select: { id: true, name: true, email: true, role: true, userId: true },
          },
          proposals: { orderBy: { createdAt: "desc" } },
          fileUploads: { orderBy: { createdAt: "desc" } },
        },
      }),
    ]);

    const isEventOwner = req.user.role === "director" && committee?.event?.createdById === req.user.id;
    if (!membership && !isEventOwner) {
      return res.status(403).json({ error: "You are not a member of this committee." });
    }
    if (!committee) {
      return res.status(404).json({ error: "Committee not found." });
    }

    res.json({ committee, memberRole: membership?.role });
  } catch (err) {
    console.error("Get committee error:", err);
    res.status(500).json({ error: "Failed to fetch committee." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/portal/committee/:id/proposal  — CHAIR/CO-CHAIR ONLY
// ---------------------------------------------------------------------------
router.post("/committee/:id/proposal", async (req, res) => {
  try {
    const { inputText, inputType, proposalJson } = req.body;

    const [membership, committee] = await Promise.all([
      prisma.member.findFirst({
        where: { committeeId: req.params.id, userId: req.user.id },
      }),
      prisma.committee.findUnique({
        where: { id: req.params.id },
        select: { id: true, name: true, eventId: true },
      }),
    ]);

    if (!isCommitteeChair(membership, req.user.role)) {
      return res.status(403).json({ error: "Only committee heads can create proposals." });
    }
    if (!committee) {
      return res.status(404).json({ error: "Committee not found." });
    }

    const proposal = await prisma.proposal.create({
      data: {
        eventId: committee.eventId,
        committeeId: committee.id,
        inputText: inputText || "",
        inputType: inputType || "text",
        proposalJson: typeof proposalJson === "string" ? proposalJson : JSON.stringify(proposalJson),
        status: "draft",
        submittedBy: req.user.name,
      },
    });

    logActivity({
      action: "proposal_generated",
      description: `${req.user.name} created a workplan for ${committee.name}`,
      eventId: committee.eventId,
      performedBy: req.user.name,
    }).catch(() => {});

    res.status(201).json({ proposal });
  } catch (err) {
    console.error("Save committee proposal error:", err);
    res.status(500).json({ error: "Failed to save proposal." });
  }
});

// ---------------------------------------------------------------------------
// PATCH /api/portal/committee/:id/proposals/:proposalId  — CHAIR/CO-CHAIR ONLY
// Update proposalJson (edit before submitting)
// ---------------------------------------------------------------------------
router.patch("/committee/:id/proposals/:proposalId", async (req, res) => {
  try {
    const { proposalJson } = req.body;

    if (!proposalJson) {
      return res.status(400).json({ error: "proposalJson is required." });
    }

    const [membership, proposal] = await Promise.all([
      prisma.member.findFirst({
        where: { committeeId: req.params.id, userId: req.user.id },
      }),
      prisma.proposal.findFirst({
        where: { id: req.params.proposalId, committeeId: req.params.id },
      }),
    ]);

    if (!isCommitteeChair(membership, req.user.role)) {
      return res.status(403).json({ error: "Only committee heads can edit proposals." });
    }
    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found in this committee." });
    }

    // Only allow editing draft or revision_requested proposals
    if (!["draft", "revision_requested"].includes(proposal.status)) {
      return res.status(400).json({ error: "Can only edit draft or revision-requested proposals." });
    }

    const updated = await prisma.proposal.update({
      where: { id: req.params.proposalId },
      data: {
        proposalJson: typeof proposalJson === "string" ? proposalJson : JSON.stringify(proposalJson),
      },
    });

    logActivity({
      action: "proposal_edited",
      description: `${req.user.name} edited a workplan`,
      eventId: proposal.eventId,
      performedBy: req.user.name,
    }).catch(() => {});

    res.json({ proposal: updated });
  } catch (err) {
    console.error("Update proposal error:", err);
    res.status(500).json({ error: "Failed to update proposal." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/portal/committee/:id/submit  — CHAIR/CO-CHAIR ONLY
// ---------------------------------------------------------------------------
router.post("/committee/:id/submit", async (req, res) => {
  try {
    const { proposalId } = req.body;

    const [membership, committee] = await Promise.all([
      prisma.member.findFirst({
        where: { committeeId: req.params.id, userId: req.user.id },
      }),
      prisma.committee.findUnique({
        where: { id: req.params.id },
        include: { event: { select: { id: true, title: true, createdById: true } } },
      }),
    ]);

    if (!isCommitteeChair(membership, req.user.role)) {
      return res.status(403).json({ error: "Only committee heads can submit proposals." });
    }

    const [proposal, approval] = await Promise.all([
      prisma.proposal.update({
        where: { id: proposalId },
        data: { status: "submitted", submittedBy: req.user.name },
      }),
      prisma.approvalRequest.create({
        data: {
          eventId: committee.eventId,
          committeeId: committee.id,
          title: `${committee.name} Workplan — ${committee.event.title}`,
          description: `Committee workplan submitted by ${req.user.name} for review.`,
          requestedBy: req.user.name,
          priority: "normal",
          status: "pending",
          proposalId: proposalId,
          dueDate: committee.proposalDeadline,
          actions: {
            create: {
              action: "submitted",
              performedBy: req.user.name,
              comment: "Committee workplan submitted for director review.",
            },
          },
        },
      }),
    ]);

    // Non-blocking notifications
    Promise.all([
      logActivity({
        action: "approval_submitted",
        description: `${req.user.name} submitted ${committee.name} workplan for approval`,
        eventId: committee.eventId,
        performedBy: req.user.name,
      }),
      notifyEventDirector({ eventId: committee.eventId,
        type: "proposal_submitted",
        title: "New workplan submitted",
        message: `${req.user.name} submitted a workplan for ${committee.name} (${committee.event.title}). Review it in Approvals.`,
        link: `/approvals/${approval.id}`,
        metadata: { proposalId, committeeId: committee.id, approvalId: approval.id },
      }),
    ]).catch(() => {});

    res.json({ proposal, approval });
  } catch (err) {
    console.error("Submit proposal error:", err);
    res.status(500).json({ error: "Failed to submit proposal." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/portal/committee/:id/members  — CHAIR ONLY
// ---------------------------------------------------------------------------
router.post("/committee/:id/members", async (req, res) => {
  try {
    const { name, email, role } = req.body;

    const membership = await prisma.member.findFirst({
      where: { committeeId: req.params.id, userId: req.user.id },
    });

    if (!isCommitteeChair(membership, req.user.role)) {
      return res.status(403).json({ error: "Only committee heads can add members." });
    }

    if (!name || name.trim().length < 2) {
      return res.status(400).json({ error: "Member name is required." });
    }

    let userId = null;
    if (email) {
      const existingUser = await prisma.user.findUnique({
        where: { email: email.toLowerCase().trim() },
      });
      if (existingUser) userId = existingUser.id;
    }

    const member = await prisma.member.create({
      data: {
        name: name.trim(),
        email: email?.toLowerCase().trim() || null,
        role: role || "member",
        committeeId: req.params.id,
        userId,
      },
    });

    res.status(201).json({ member });
  } catch (err) {
    console.error("Add member error:", err);
    res.status(500).json({ error: "Failed to add member." });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/portal/committee/:id/members/:memberId  — CHAIR ONLY
// ---------------------------------------------------------------------------
router.delete("/committee/:id/members/:memberId", async (req, res) => {
  try {
    const membership = await prisma.member.findFirst({
      where: { committeeId: req.params.id, userId: req.user.id },
    });

    if (!isCommitteeChair(membership, req.user.role)) {
      return res.status(403).json({ error: "Only committee heads can remove members." });
    }

    await prisma.member.delete({ where: { id: req.params.memberId } });
    res.json({ deleted: true });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Member not found." });
    }
    console.error("Remove member error:", err);
    res.status(500).json({ error: "Failed to remove member." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/portal/proposals/:id
// ---------------------------------------------------------------------------
router.get("/proposals/:id", async (req, res) => {
  try {
    const proposal = await prisma.proposal.findUnique({
      where: { id: req.params.id },
      include: {
        committee: { select: { id: true, name: true } },
        event: { select: { id: true, title: true, eventType: true, createdById: true } },
      },
    });

    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found." });
    }

    if (proposal.committeeId && !(req.user.role === "director" && proposal.event?.createdById === req.user.id)) {
      const membership = await prisma.member.findFirst({
        where: { committeeId: proposal.committeeId, userId: req.user.id },
      });
      if (!membership) {
        return res.status(403).json({ error: "Access denied." });
      }
    }

    const approval = await prisma.approvalRequest.findFirst({
      where: { proposalId: proposal.id },
      include: { actions: { orderBy: { createdAt: "asc" } } },
    });

    res.json({ proposal, approval });
  } catch (err) {
    console.error("Get proposal error:", err);
    res.status(500).json({ error: "Failed to fetch proposal." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/portal/proposals
// ---------------------------------------------------------------------------
router.get("/proposals", async (req, res) => {
  try {
    const memberships = await prisma.member.findMany({
      where: { userId: req.user.id },
      select: { committeeId: true },
    });
    const committeeIds = memberships.map((m) => m.committeeId);

    const proposals = await prisma.proposal.findMany({
      where: { committeeId: { in: committeeIds } },
      include: {
        committee: { select: { id: true, name: true } },
        event: { select: { id: true, title: true, createdById: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ proposals });
  } catch (err) {
    console.error("My proposals error:", err);
    res.status(500).json({ error: "Failed to fetch proposals." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/portal/committee/:id/proposals/:proposalId/comments
// ---------------------------------------------------------------------------
router.get("/committee/:id/proposals/:proposalId/comments", async (req, res) => {
  try {
    const [member, comments] = await Promise.all([
      prisma.member.findFirst({
        where: { committeeId: req.params.id, userId: req.user.id },
      }),
      prisma.proposalComment.findMany({
        where: {
          proposalId: req.params.proposalId,
          committeeId: req.params.id,
          status: "visible",
        },
        orderBy: { createdAt: "asc" },
      }),
    ]);

    const cmtCheck1 = await prisma.committee.findUnique({ where: { id: req.params.id }, select: { event: { select: { createdById: true } } } });
    if (!member && !(req.user.role === "director" && cmtCheck1?.event?.createdById === req.user.id)) {
      return res.status(403).json({ error: "Not a member of this committee." });
    }

    res.json({ comments });
  } catch (err) {
    console.error("Get proposal comments error:", err);
    res.status(500).json({ error: "Failed to fetch comments." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/portal/committee/:id/proposals/:proposalId/comments
// Any committee member (members AND chairs) can comment
// ---------------------------------------------------------------------------
router.post("/committee/:id/proposals/:proposalId/comments", async (req, res) => {
  try {
    const { content } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: "Comment content is required." });
    }

    const [member, proposal] = await Promise.all([
      prisma.member.findFirst({
        where: { committeeId: req.params.id, userId: req.user.id },
      }),
      prisma.proposal.findFirst({
        where: { id: req.params.proposalId, committeeId: req.params.id },
      }),
    ]);

    const cmtCheck2 = await prisma.committee.findUnique({ where: { id: req.params.id }, select: { event: { select: { createdById: true } } } });
    if (!member && !(req.user.role === "director" && cmtCheck2?.event?.createdById === req.user.id)) {
      return res.status(403).json({ error: "Not a member of this committee." });
    }
    if (!proposal) {
      return res.status(404).json({ error: "Proposal not found." });
    }

    const comment = await prisma.proposalComment.create({
      data: {
        proposalId: req.params.proposalId,
        committeeId: req.params.id,
        authorId: req.user.id,
        authorName: req.user.name || "Unknown",
        authorRole: member?.role || req.user.role || "member",
        content: content.trim(),
      },
    });

    // Notify heads when a regular member comments
    if (member?.role === "member") {
      prisma.member.findMany({
        where: {
          committeeId: req.params.id,
          role: { in: ["chair", "co-chair", "head"] },
          userId: { not: null },
        },
      }).then((heads) => {
        const notifications = heads.filter(h => h.userId).map((h) =>
          prisma.notification.create({
            data: {
              userId: h.userId,
              type: "proposal_comment",
              title: "New comment on workplan",
              message: `${comment.authorName} commented: "${content.trim().substring(0, 80)}${content.trim().length > 80 ? "..." : ""}"`,
              link: `/portal/committee/${req.params.id}`,
              metadata: { proposalId: req.params.proposalId, commentId: comment.id },
            },
          })
        );
        return Promise.all(notifications);
      }).catch(() => {});
    }

    // Notify members when a chair/head replies
    if (member && ["chair", "co-chair", "head"].includes(member.role)) {
      prisma.member.findMany({
        where: {
          committeeId: req.params.id,
          role: "member",
          userId: { not: null },
        },
      }).then((members) => {
        const notifications = members.filter(m => m.userId).map((m) =>
          prisma.notification.create({
            data: {
              userId: m.userId,
              type: "proposal_comment",
              title: "Committee head replied",
              message: `${comment.authorName} replied: "${content.trim().substring(0, 80)}${content.trim().length > 80 ? "..." : ""}"`,
              link: `/portal/committee/${req.params.id}`,
              metadata: { proposalId: req.params.proposalId, commentId: comment.id },
            },
          })
        );
        return Promise.all(notifications);
      }).catch(() => {});
    }

    res.status(201).json({ comment });
  } catch (err) {
    console.error("Create proposal comment error:", err);
    res.status(500).json({ error: "Failed to create comment." });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/portal/committee/:id/proposals/:proposalId/comments/:commentId
// ---------------------------------------------------------------------------
router.delete("/committee/:id/proposals/:proposalId/comments/:commentId", async (req, res) => {
  try {
    const member = await prisma.member.findFirst({
      where: { committeeId: req.params.id, userId: req.user.id },
    });

    if (!isCommitteeChair(member, req.user.role)) {
      return res.status(403).json({ error: "Only the committee head can remove comments." });
    }

    await prisma.proposalComment.update({
      where: { id: req.params.commentId },
      data: { status: "hidden" },
    });

    res.json({ deleted: true });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Comment not found." });
    }
    console.error("Delete comment error:", err);
    res.status(500).json({ error: "Failed to delete comment." });
  }
});

module.exports = router;
const express = require("express");
const prisma = require("../services/db");
const { requireAuth } = require("../middleware/auth");

const router = express.Router();
router.use(requireAuth);

// ---------------------------------------------------------------------------
// Helper: Check if user is director of the program this committee belongs to
// ---------------------------------------------------------------------------
async function isDirectorOf(userId, committeeId) {
  const committee = await prisma.committee.findUnique({
    where: { id: committeeId },
    include: { event: { select: { createdById: true } } },
  });
  return committee?.event?.createdById === userId;
}

// ---------------------------------------------------------------------------
// Helper: Check if user is head of this specific committee
// ---------------------------------------------------------------------------
async function isHeadOf(userId, committeeId) {
  const member = await prisma.member.findFirst({
    where: { committeeId, userId, role: "head" },
  });
  return !!member;
}

// ---------------------------------------------------------------------------
// GET /api/members/committee/:committeeId — list members of a committee
// ---------------------------------------------------------------------------
router.get("/committee/:committeeId", async (req, res) => {
  try {
    const members = await prisma.member.findMany({
      where: { committeeId: req.params.committeeId },
      include: {
        user: { select: { id: true, email: true, name: true, avatarUrl: true, lastLoginAt: true } },
      },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    });

    res.json({ members });
  } catch (err) {
    console.error("List members error:", err);
    res.status(500).json({ error: "Failed to fetch members." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/members — add a member to a committee
// Who can do this: program director OR committee head of that committee
// ---------------------------------------------------------------------------
router.post("/", async (req, res) => {
  try {
    const { committeeId, name, email, role = "member" } = req.body;

    if (!committeeId || !name || !email) {
      return res.status(400).json({ error: "committeeId, name, and email are required." });
    }

    // Validate role
    const validRoles = ["head", "member"];
    const assignRole = validRoles.includes(role) ? role : "member";

    // Permission check: must be director of program OR head of this committee
    const director = await isDirectorOf(req.user.id, committeeId);
    const head = await isHeadOf(req.user.id, committeeId);

    if (!director && !head) {
      return res.status(403).json({ error: "Only program directors and committee heads can add members." });
    }

    // Committee heads can only add members, not other heads
    if (head && !director && assignRole === "head") {
      return res.status(403).json({ error: "Only program directors can assign committee heads." });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if already a member of this committee
    const existing = await prisma.member.findFirst({
      where: { committeeId, email: cleanEmail },
    });
    if (existing) {
      return res.status(409).json({ error: "This person is already a member of this committee." });
    }

    // Check if user account exists for this email
    const existingUser = await prisma.user.findUnique({ where: { email: cleanEmail } });

    // Create member record
    const member = await prisma.member.create({
      data: {
        committeeId,
        name: name.trim(),
        email: cleanEmail,
        role: assignRole,
        userId: existingUser?.id || null,
      },
      include: {
        committee: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Notify the person if they have an account
    if (existingUser) {
      try {
        await prisma.notification.create({
          data: {
            userId: existingUser.id,
            type: "committee_added",
            title: `Added to ${member.committee.name}`,
            message: `You've been added as ${assignRole} of ${member.committee.name}.`,
            link: `/portal/committee/${committeeId}`,
          },
        });
      } catch { /* non-blocking */ }
    }

    res.status(201).json({
      member,
      activated: !!existingUser,
      message: existingUser
        ? `${name} added and linked to their account.`
        : `${name} added. They can activate their account at the portal login.`,
    });
  } catch (err) {
    console.error("Add member error:", err);
    res.status(500).json({ error: "Failed to add member." });
  }
});

// ---------------------------------------------------------------------------
// PUT /api/members/:memberId/role — change member role (director only)
// ---------------------------------------------------------------------------
router.put("/:memberId/role", async (req, res) => {
  try {
    const { role } = req.body;

    if (!["head", "member"].includes(role)) {
      return res.status(400).json({ error: "Role must be 'head' or 'member'." });
    }

    const member = await prisma.member.findUnique({
      where: { id: req.params.memberId },
    });

    if (!member) {
      return res.status(404).json({ error: "Member not found." });
    }

    // Only directors can change roles
    const director = await isDirectorOf(req.user.id, member.committeeId);
    if (!director) {
      return res.status(403).json({ error: "Only program directors can change member roles." });
    }

    const updated = await prisma.member.update({
      where: { id: req.params.memberId },
      data: { role },
      include: {
        committee: { select: { id: true, name: true } },
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Notify the member
    if (updated.userId) {
      try {
        await prisma.notification.create({
          data: {
            userId: updated.userId,
            type: "role_changed",
            title: role === "head" ? `Promoted to Committee Head` : `Role changed`,
            message: role === "head"
              ? `You are now the head of ${updated.committee.name}.`
              : `Your role in ${updated.committee.name} has been changed to member.`,
            link: `/portal/committee/${updated.committeeId}`,
          },
        });
      } catch { /* non-blocking */ }
    }

    res.json({ member: updated });
  } catch (err) {
    console.error("Change role error:", err);
    res.status(500).json({ error: "Failed to change role." });
  }
});

// ---------------------------------------------------------------------------
// DELETE /api/members/:memberId — remove member from committee
// Director or committee head can do this (head can't remove other heads)
// ---------------------------------------------------------------------------
router.delete("/:memberId", async (req, res) => {
  try {
    const member = await prisma.member.findUnique({
      where: { id: req.params.memberId },
      include: { committee: { select: { name: true } } },
    });

    if (!member) {
      return res.status(404).json({ error: "Member not found." });
    }

    const director = await isDirectorOf(req.user.id, member.committeeId);
    const head = await isHeadOf(req.user.id, member.committeeId);

    if (!director && !head) {
      return res.status(403).json({ error: "Only program directors and committee heads can remove members." });
    }

    // Heads can't remove other heads
    if (head && !director && member.role === "head") {
      return res.status(403).json({ error: "Only program directors can remove committee heads." });
    }

    // Can't remove yourself
    if (member.userId === req.user.id) {
      return res.status(400).json({ error: "You can't remove yourself. Ask a director to do this." });
    }

    await prisma.member.delete({ where: { id: req.params.memberId } });

    res.json({ message: `${member.name} removed from ${member.committee.name}.` });
  } catch (err) {
    console.error("Remove member error:", err);
    res.status(500).json({ error: "Failed to remove member." });
  }
});

module.exports = router;

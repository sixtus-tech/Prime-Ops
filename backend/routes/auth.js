const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../services/db");
const { requireAuth, generateToken } = require("../middleware/auth");

const router = express.Router();

// ---------------------------------------------------------------------------
// POST /api/auth/register — create director/admin account
// ---------------------------------------------------------------------------
router.post("/register", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      return res.status(400).json({ error: "Email, password, and name are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (existing) {
      return res.status(409).json({ error: "An account with this email already exists." });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        password: hashed,
        name: name.trim(),
        role: "user",
        globalRole: "user",
      },
    });

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    console.error("Register error:", err);
    res.status(500).json({ error: "Registration failed." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/login — sign in (works for both directors and members)
// ---------------------------------------------------------------------------
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase().trim() },
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    if (!user.password) {
      return res.status(401).json({ error: "Account not activated yet. Click 'First time? Set up your account' to create your password." });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password." });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        globalRole: user.globalRole || "user",
        kcUsername: user.kcUsername,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/activate-member — member self-activation
// Director adds them to a committee → they come here to set their password
// ---------------------------------------------------------------------------
router.post("/activate-member", async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters." });
    }

    const cleanEmail = email.toLowerCase().trim();

    // Check if this email exists in any committee (was invited by a director)
    const memberRecords = await prisma.member.findMany({
      where: { email: cleanEmail },
      include: { committee: { select: { name: true } } },
    });

    if (memberRecords.length === 0) {
      return res.status(403).json({
        error: "This email hasn't been added to any committee yet. Ask your program director to add you first.",
      });
    }

    const hashed = await bcrypt.hash(password, 10);

    // Check if user account already exists
    let user = await prisma.user.findUnique({ where: { email: cleanEmail } });

    if (user) {
      if (user.password) {
        return res.status(409).json({ error: "This account is already activated. Please sign in instead." });
      }

      // User exists but has no password (e.g. created via KingsChat) — set password
      user = await prisma.user.update({
        where: { id: user.id },
        data: {
          password: hashed,
          name: name?.trim() || user.name,
        },
      });
    } else {
      // Create new user account
      user = await prisma.user.create({
        data: {
          email: cleanEmail,
          password: hashed,
          name: name?.trim() || memberRecords[0].name,
          role: "user",
          globalRole: "user",
        },
      });
    }

    // Link all member records to this user
    await prisma.member.updateMany({
      where: { email: cleanEmail, userId: null },
      data: { userId: user.id },
    });

    const committeeNames = memberRecords.map((m) => m.committee.name).join(", ");

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
      message: `Account activated! You've been added to: ${committeeNames}`,
    });
  } catch (err) {
    console.error("Activate member error:", err);
    res.status(500).json({ error: "Activation failed." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/me — get current user + their committee assignments
// ---------------------------------------------------------------------------
router.get("/me", requireAuth, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        globalRole: true,
        kcId: true,
        kcUsername: true,
        avatarUrl: true,
        createdAt: true,
        members: {
          include: {
            committee: {
              include: {
                event: { select: { id: true, title: true, status: true, eventType: true, startDate: true, endDate: true } },
                responsibilities: true,
                _count: { select: { members: true, proposals: true } },
              },
            },
          },
        },
        createdEvents: {
          select: { id: true, title: true, status: true, eventType: true, startDate: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found." });
    }

    res.json({ user });
  } catch (err) {
    console.error("Get me error:", err);
    res.status(500).json({ error: "Failed to fetch user." });
  }
});

module.exports = router;

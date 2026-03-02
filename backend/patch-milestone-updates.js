#!/usr/bin/env node
/**
 * Patch: Add optional sub-milestone linking to status updates
 *
 * Changes:
 * 1. Accept `subMilestoneId` in POST /generate — links update to a milestone
 * 2. Include subMilestone relation in GET queries
 * 3. Add GET /api/status-updates/by-milestone/:subMilestoneId — fetch evidence
 * 4. Add POST /api/status-updates/:id/link-milestone — link existing update to milestone
 *
 * Run from backend root:  node patch-milestone-updates.js
 */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "routes", "statusUpdates.js");

let src = fs.readFileSync(FILE, "utf-8");
let changes = 0;

// ── 1. Add subMilestoneId to the generate endpoint's create data ──────
// Find the create data block and add subMilestoneId
const createAnchor = `        status: "submitted",
      },
      include: {
        committee: { select: { id: true, name: true } },
      },`;

const createReplacement = `        status: "submitted",
        subMilestoneId: req.body.subMilestoneId || null,
      },
      include: {
        committee: { select: { id: true, name: true } },
        subMilestone: { select: { id: true, title: true, milestoneId: true } },
      },`;

if (!src.includes("subMilestoneId: req.body.subMilestoneId")) {
  src = src.replace(createAnchor, createReplacement);
  changes++;
  console.log("✅ 1/5  Added subMilestoneId to generate create data");
} else {
  console.log("⏭  1/5  subMilestoneId already in generate endpoint");
}

// ── 2. After saving update, auto-progress the linked milestone ────────
const afterCreateAnchor = `    // Notify directors
    await notifyDirectors({
      type: "status_update_submitted",`;

const milestoneProgressHook = `    // If linked to a milestone, auto-progress it to "in_progress"
    if (update.subMilestoneId) {
      try {
        const sub = await prisma.subMilestone.findUnique({
          where: { id: update.subMilestoneId },
        });
        if (sub && sub.status === "not_started") {
          await prisma.subMilestone.update({
            where: { id: update.subMilestoneId },
            data: { status: "in_progress" },
          });
        }
      } catch (progressErr) {
        console.error("Auto-progress milestone failed (non-blocking):", progressErr.message);
      }
    }

    // Notify directors
    await notifyDirectors({
      type: "status_update_submitted",`;

if (!src.includes("Auto-progress milestone")) {
  src = src.replace(afterCreateAnchor, milestoneProgressHook);
  changes++;
  console.log("✅ 2/5  Added auto-progress hook for linked milestones");
} else {
  console.log("⏭  2/5  Auto-progress hook already exists");
}

// ── 3. Include subMilestone in GET list endpoint ────────────────────
const listInclude = `      include: {
        committee: { select: { id: true, name: true } },
        event: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },`;

const listIncludeReplacement = `      include: {
        committee: { select: { id: true, name: true } },
        event: { select: { id: true, title: true } },
        subMilestone: { select: { id: true, title: true, status: true, milestone: { select: { id: true, title: true, phase: true } } } },
      },
      orderBy: { createdAt: "desc" },`;

if (!src.includes("subMilestone: { select: { id: true, title: true, status: true")) {
  src = src.replace(listInclude, listIncludeReplacement);
  changes++;
  console.log("✅ 3/5  Added subMilestone include to GET list");
} else {
  console.log("⏭  3/5  subMilestone already in GET list include");
}

// ── 4. Add evidence endpoint + link endpoint before module.exports ──
const exportAnchor = `module.exports = router;`;

const newEndpoints = `// ---------------------------------------------------------------------------
// GET /api/status-updates/by-milestone/:subMilestoneId — evidence for a milestone
// ---------------------------------------------------------------------------
router.get("/by-milestone/:subMilestoneId", async (req, res) => {
  try {
    const updates = await prisma.statusUpdate.findMany({
      where: { subMilestoneId: req.params.subMilestoneId },
      include: {
        committee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ updates, count: updates.length });
  } catch (err) {
    console.error("Fetch milestone evidence error:", err);
    res.status(500).json({ error: "Failed to fetch milestone evidence." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/status-updates/:id/link-milestone — link existing update to milestone
// ---------------------------------------------------------------------------
router.post("/:id/link-milestone", async (req, res) => {
  try {
    const { subMilestoneId } = req.body;

    if (!subMilestoneId) {
      return res.status(400).json({ error: "subMilestoneId is required." });
    }

    // Verify sub-milestone exists
    const sub = await prisma.subMilestone.findUnique({
      where: { id: subMilestoneId },
    });
    if (!sub) return res.status(404).json({ error: "Sub-milestone not found." });

    const update = await prisma.statusUpdate.update({
      where: { id: req.params.id },
      data: { subMilestoneId },
      include: {
        committee: { select: { id: true, name: true } },
        subMilestone: { select: { id: true, title: true } },
      },
    });

    // Auto-progress if not started
    if (sub.status === "not_started") {
      await prisma.subMilestone.update({
        where: { id: subMilestoneId },
        data: { status: "in_progress" },
      });
    }

    res.json({ update });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Status update not found." });
    }
    console.error("Link milestone error:", err);
    res.status(500).json({ error: "Failed to link milestone." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/status-updates/:id/unlink-milestone — remove milestone link
// ---------------------------------------------------------------------------
router.post("/:id/unlink-milestone", async (req, res) => {
  try {
    const update = await prisma.statusUpdate.update({
      where: { id: req.params.id },
      data: { subMilestoneId: null },
      include: {
        committee: { select: { id: true, name: true } },
      },
    });

    res.json({ update });
  } catch (err) {
    if (err.code === "P2025") {
      return res.status(404).json({ error: "Status update not found." });
    }
    res.status(500).json({ error: "Failed to unlink milestone." });
  }
});

module.exports = router;`;

if (!src.includes("by-milestone")) {
  src = src.replace(exportAnchor, newEndpoints);
  changes++;
  console.log("✅ 4/5  Added evidence + link/unlink endpoints");
} else {
  console.log("⏭  4/5  Evidence endpoints already exist");
}

// ── 5. Fix route ordering: move by-milestone BEFORE /:id to avoid conflict ──
// The "by-milestone" route must come before "/:id" to avoid Express matching
// "by-milestone" as an :id param. Check if we need to reorder.
if (src.includes("by-milestone") && !src.includes("ROUTE_ORDER_FIXED")) {
  // Find the by-milestone route block
  const byMilestoneBlock = `// ---------------------------------------------------------------------------
// GET /api/status-updates/by-milestone/:subMilestoneId — evidence for a milestone
// ---------------------------------------------------------------------------
router.get("/by-milestone/:subMilestoneId", async (req, res) => {
  try {
    const updates = await prisma.statusUpdate.findMany({
      where: { subMilestoneId: req.params.subMilestoneId },
      include: {
        committee: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    res.json({ updates, count: updates.length });
  } catch (err) {
    console.error("Fetch milestone evidence error:", err);
    res.status(500).json({ error: "Failed to fetch milestone evidence." });
  }
});`;

  // Check if by-milestone is AFTER /:id
  const byMilestonePos = src.indexOf("by-milestone/:subMilestoneId");
  const paramIdPos = src.indexOf('router.get("/:id"');

  if (byMilestonePos > paramIdPos && paramIdPos > -1) {
    // Remove from current location and insert before /:id
    src = src.replace(byMilestoneBlock + "\n\n", "");
    src = src.replace(
      '// ---------------------------------------------------------------------------\n// GET /api/status-updates/:id',
      byMilestoneBlock + '\n\n// ROUTE_ORDER_FIXED\n// ---------------------------------------------------------------------------\n// GET /api/status-updates/:id'
    );
    changes++;
    console.log("✅ 5/5  Fixed route ordering (by-milestone before /:id)");
  } else {
    console.log("⏭  5/5  Route order already correct");
  }
} else {
  console.log("⏭  5/5  Route order check skipped");
}

if (changes > 0) {
  fs.writeFileSync(FILE, src);
  console.log(`\n✅ Done — ${changes} change(s) applied to ${FILE}`);
} else {
  console.log("\n⏭  No changes needed.");
}

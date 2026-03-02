#!/usr/bin/env node
/**
 * Patch: Include linked status updates (evidence) in milestone endpoints
 *
 * Changes to routes/milestones.js:
 * 1. Include _count.statusUpdates and latest linked updates when returning sub-milestones
 * 2. Add GET /api/milestones/sub/:id/evidence endpoint
 *
 * Run from backend root:  node patch-milestone-evidence.js
 */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "routes", "milestones.js");

if (!fs.existsSync(FILE)) {
  console.error("❌ Could not find routes/milestones.js");
  process.exit(1);
}

let src = fs.readFileSync(FILE, "utf-8");
let changes = 0;

// ── 1. Find where sub-milestones are queried for committee endpoint ──────
// Look for the committee milestones endpoint and add _count + statusUpdates include
// Common patterns: findMany where committeeId, include milestone relation

// Strategy: Find subMilestone.findMany and add statusUpdates to the include
// We look for `include:` blocks that have `milestone:` (the parent milestone relation)

// Approach: Add _count for statusUpdates to subMilestone queries
const subMilestoneInclude = /include:\s*\{[^}]*milestone:\s*\{[^}]*\}[^}]*\}/g;

// More targeted: find the committee endpoint specifically
if (src.includes("committee/:committeeId") || src.includes("committee/${")) {
  // Try to add evidence count to the sub-milestone query
  // Look for the select/include pattern in sub-milestone findMany

  // Pattern 1: Direct include with milestone relation
  if (!src.includes("_count: { select: { statusUpdates: true } }")) {
    // Find subMilestone findMany calls and add _count
    const patterns = [
      // Pattern: include: { milestone: { select: {...} } }
      {
        find: /(\bsubMilestones?\b.*?include:\s*\{[^}]*milestone:\s*\{[^}]*\})/s,
        description: "subMilestone include block",
      },
    ];

    // Simpler approach: just add the include after any `milestone:` include in subMilestone queries
    // Since the file structure varies, let's use a targeted text replacement

    // Find: `milestone: { select:` or `milestone: {` within subMilestone contexts
    // Replace by adding _count and statusUpdates

    // Let's try a more robust approach - add _count to the findMany for committee endpoint
    const committeeEndpointMatch = src.match(
      /(\/api\/milestones\/committee\/|milestones\/committee\/)/
    );

    if (committeeEndpointMatch) {
      console.log("  Found committee milestones endpoint");

      // Try adding _count after milestone include
      const milestoneIncludePattern = /(milestone:\s*\{[^}]+\})(,?\s*\})/;
      const milestoneMatch = src.match(milestoneIncludePattern);

      if (milestoneMatch && !src.includes("statusUpdates: {")) {
        // Add evidence includes after the milestone include
        src = src.replace(
          milestoneIncludePattern,
          `$1,
          _count: { select: { statusUpdates: true } },
          statusUpdates: {
            select: { id: true, summary: true, createdAt: true, submittedBy: true },
            orderBy: { createdAt: "desc" },
            take: 3,
          }$2`
        );
        changes++;
        console.log("✅ 1/2  Added evidence counts + latest updates to sub-milestone query");
      } else if (src.includes("statusUpdates: {")) {
        console.log("⏭  1/2  statusUpdates include already exists");
      } else {
        console.log("⚠  1/2  Could not find milestone include pattern — manual edit needed");
        console.log("  Add to subMilestone findMany include:");
        console.log('    _count: { select: { statusUpdates: true } },');
        console.log("    statusUpdates: {");
        console.log('      select: { id: true, summary: true, createdAt: true, submittedBy: true },');
        console.log('      orderBy: { createdAt: "desc" },');
        console.log("      take: 3,");
        console.log("    }");
      }
    } else {
      console.log("⚠  1/2  Could not find committee milestones endpoint — manual edit needed");
    }
  } else {
    console.log("⏭  1/2  Evidence count already in subMilestone queries");
  }
} else {
  console.log("⚠  1/2  No committee endpoint found in milestones.js — manual edit may be needed");
}

// ── 2. Add evidence endpoint: GET /api/milestones/sub/:id/evidence ──────
const exportLine = "module.exports = router;";

if (!src.includes("/sub/:id/evidence")) {
  const evidenceEndpoint = `
// ---------------------------------------------------------------------------
// GET /api/milestones/sub/:id/evidence — all linked status updates for a sub-milestone
// ---------------------------------------------------------------------------
router.get("/sub/:id/evidence", async (req, res) => {
  try {
    const sub = await prisma.subMilestone.findUnique({
      where: { id: req.params.id },
      include: {
        statusUpdates: {
          include: {
            committee: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
        milestone: { select: { id: true, title: true, phase: true } },
      },
    });

    if (!sub) return res.status(404).json({ error: "Sub-milestone not found." });

    res.json({
      subMilestone: {
        id: sub.id,
        title: sub.title,
        description: sub.description,
        status: sub.status,
        parentMilestone: sub.milestone,
      },
      evidence: sub.statusUpdates,
      evidenceCount: sub.statusUpdates.length,
    });
  } catch (err) {
    console.error("Fetch evidence error:", err);
    res.status(500).json({ error: "Failed to fetch milestone evidence." });
  }
});

`;

  src = src.replace(exportLine, evidenceEndpoint + exportLine);
  changes++;
  console.log("✅ 2/2  Added GET /sub/:id/evidence endpoint");
} else {
  console.log("⏭  2/2  Evidence endpoint already exists");
}

if (changes > 0) {
  fs.writeFileSync(FILE, src);
  console.log(`\n✅ Done — ${changes} change(s) applied to ${FILE}`);
} else {
  console.log("\n⏭  No changes needed.");
}

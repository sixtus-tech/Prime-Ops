#!/usr/bin/env node
/**
 * Patch: Add sub-milestone generation hook to approvals route
 * when a committee proposal is approved.
 *
 * Run from backend root:  node patch-approval-milestones.js
 */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "routes", "approvals.js");

let src = fs.readFileSync(FILE, "utf-8");
let changes = 0;

// ── 1. Add import for milestone generator ────────────────────────
const importAnchor = `const { notifyCommitteeMembers } = require("../services/notifications");`;
const importAdd = `const {
  generateSubMilestones,
  recalculateMilestoneProgress,
} = require("../services/milestoneGenerator");`;

if (!src.includes("generateSubMilestones")) {
  src = src.replace(importAnchor, `${importAnchor}\n${importAdd}`);
  changes++;
  console.log("✅ 1/2  Added milestoneGenerator imports");
} else {
  console.log("⏭  1/2  Import already exists");
}

// ── 2. Add sub-milestone generation after proposal approval ──────
// Insert right after the proposal status is set to "approved" (inside the if (action === "approved") block)
const approvalAnchor = `    // If rejected, update proposal status
    if (action === "rejected" && existing.proposalId) {`;

const milestoneHook = `    // If a COMMITTEE proposal was approved → generate sub-milestones
    if (action === "approved" && existing.committeeId && existing.proposalId) {
      try {
        const proposal = await prisma.proposal.findUnique({
          where: { id: existing.proposalId },
          select: { proposalJson: true },
        });

        if (proposal?.proposalJson) {
          const subs = await generateSubMilestones(existing.committeeId, proposal.proposalJson);
          console.log(\`✅ Generated \${subs.length} sub-milestones for committee \${existing.committeeId}\`);

          await logActivity({
            eventId: existing.eventId,
            action: "sub_milestones_generated",
            description: \`Generated \${subs.length} sub-milestones for \${existing.title}\`,
            performedBy: performedBy || "System",
          });
        }
      } catch (milestoneErr) {
        console.error("Sub-milestone generation failed (non-blocking):", milestoneErr.message);
      }
    }

    `;

if (!src.includes("sub_milestones_generated")) {
  src = src.replace(approvalAnchor, `${milestoneHook}${approvalAnchor}`);
  changes++;
  console.log("✅ 2/2  Added sub-milestone generation hook on approval");
} else {
  console.log("⏭  2/2  Milestone hook already exists");
}

if (changes > 0) {
  fs.writeFileSync(FILE, src);
  console.log(`\n✅ Done — ${changes} change(s) applied to ${FILE}`);
} else {
  console.log("\n⏭  No changes needed.");
}

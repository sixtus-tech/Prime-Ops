#!/usr/bin/env node
/**
 * Backfill: Generate sub-milestones for committees with approved proposals
 * that don't yet have any sub-milestones.
 *
 * Run from backend root:  node backfill-sub-milestones.js
 */

const prisma = require("./services/db");
const { generateSubMilestones } = require("./services/milestoneGenerator");

async function backfill() {
  console.log("🔍 Finding approved committee proposals without sub-milestones...\n");

  // Find all approved proposals that belong to a committee
  const approvedProposals = await prisma.proposal.findMany({
    where: {
      status: "approved",
      committeeId: { not: null },
    },
    include: {
      committee: {
        select: {
          id: true,
          name: true,
          eventId: true,
          _count: { select: { subMilestones: true } },
        },
      },
    },
  });

  const needsBackfill = approvedProposals.filter(
    (p) => p.committee && p.committee._count.subMilestones === 0
  );

  if (needsBackfill.length === 0) {
    console.log("✅ All approved committees already have sub-milestones. Nothing to do.");
    process.exit(0);
  }

  console.log(`Found ${needsBackfill.length} committee(s) needing sub-milestones:\n`);

  for (const proposal of needsBackfill) {
    const { committee } = proposal;
    console.log(`  → ${committee.name} (committee: ${committee.id})`);

    try {
      // First check that master milestones exist for this event
      const masterCount = await prisma.milestone.count({
        where: { eventId: committee.eventId },
      });

      if (masterCount === 0) {
        console.log(`    ⚠ No master milestones for event ${committee.eventId} — skipping`);
        continue;
      }

      const subs = await generateSubMilestones(committee.id, proposal.proposalJson);
      console.log(`    ✅ Generated ${subs.length} sub-milestones`);
    } catch (err) {
      console.error(`    ❌ Failed: ${err.message}`);
    }
  }

  console.log("\n✅ Backfill complete.");
  process.exit(0);
}

backfill().catch((err) => {
  console.error("Backfill error:", err);
  process.exit(1);
});

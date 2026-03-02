const Anthropic = require("@anthropic-ai/sdk");
const prisma = require("./db");

const client = new Anthropic();

// ═══════════════════════════════════════════════════════════════════════
// PHASE 1: Generate master milestones from event proposal
// Called when the director's event proposal is created/approved
// ═══════════════════════════════════════════════════════════════════════

async function generateMasterMilestones(eventId) {
  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      committees: {
        include: { responsibilities: true },
      },
    },
  });

  if (!event) throw new Error("Event not found");

  const committeeSummary = event.committees
    .map(
      (c) =>
        `- ${c.name}: ${c.responsibilities.map((r) => r.text).join("; ") || c.description || "No responsibilities defined"}`
    )
    .join("\n");

  const prompt = `You are a project management expert. Based on this event, generate a milestone map — the master milestones that represent major phases/checkpoints from planning to completion.

EVENT DETAILS:
- Title: ${event.title}
- Type: ${event.eventType}
- Start Date: ${event.startDate ? new Date(event.startDate).toLocaleDateString() : "TBD"}
- End Date: ${event.endDate ? new Date(event.endDate).toLocaleDateString() : "TBD"}
- Venue: ${event.venue || "TBD"}
- Attendance: ${event.estimatedAttendance || "TBD"}
- Budget: ${event.estimatedBudget || "TBD"}
- Summary: ${event.summary || "N/A"}

COMMITTEES:
${committeeSummary || "No committees yet"}

INSTRUCTIONS:
- Generate 5-8 master milestones covering the full lifecycle (planning → execution → wrap-up)
- Each milestone should be a meaningful checkpoint the director cares about
- Order them chronologically by phase number
- Set targetDate relative to the event start date (or reasonable defaults if no date)
- Flag 2-3 critical milestones that require director approval (high-stakes decisions like budget sign-off, venue confirmation, final run-of-show)
- Keep titles concise (3-6 words) and descriptions actionable

Respond with ONLY valid JSON, no markdown:
{
  "milestones": [
    {
      "title": "string",
      "description": "string",
      "phase": 1,
      "targetDate": "YYYY-MM-DD or null",
      "requiresApproval": true/false
    }
  ]
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].text.trim();
  const parsed = JSON.parse(text);

  // Save milestones to database
  const created = [];
  for (const m of parsed.milestones) {
    const milestone = await prisma.milestone.create({
      data: {
        eventId,
        title: m.title,
        description: m.description,
        phase: m.phase,
        targetDate: m.targetDate ? new Date(m.targetDate) : null,
        requiresApproval: m.requiresApproval || false,
      },
    });
    created.push(milestone);
  }

  console.log(`[Milestones] Generated ${created.length} master milestones for event ${event.title}`);
  return created;
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE 2: Generate sub-milestones when a committee proposal is approved
// Maps committee deliverables to existing master milestones
// ═══════════════════════════════════════════════════════════════════════

async function generateSubMilestones(committeeId, proposalJson) {
  const committee = await prisma.committee.findUnique({
    where: { id: committeeId },
    include: {
      event: true,
      responsibilities: true,
    },
  });

  if (!committee) throw new Error("Committee not found");

  // Get existing master milestones for the event
  const milestones = await prisma.milestone.findMany({
    where: { eventId: committee.eventId },
    orderBy: { phase: "asc" },
  });

  if (milestones.length === 0) {
    console.warn(`[Milestones] No master milestones found for event ${committee.eventId}. Generate them first.`);
    return [];
  }

  // Parse the committee proposal
  let proposal;
  try {
    proposal = typeof proposalJson === "string" ? JSON.parse(proposalJson) : proposalJson;
  } catch {
    console.error("[Milestones] Failed to parse proposal JSON");
    return [];
  }

  const milestoneList = milestones
    .map((m) => `  [ID: ${m.id}] Phase ${m.phase}: "${m.title}" — ${m.description || "No description"} (Due: ${m.targetDate ? new Date(m.targetDate).toLocaleDateString() : "TBD"})`)
    .join("\n");

  const prompt = `You are a project management expert. A committee has submitted their approved proposal. Generate specific sub-milestones for this committee and map each one to an existing master milestone.

EVENT: ${committee.event.title}
COMMITTEE: ${committee.name}
RESPONSIBILITIES: ${committee.responsibilities.map((r) => r.text).join("; ") || "General"}

COMMITTEE PROPOSAL (APPROVED):
${JSON.stringify(proposal, null, 2).substring(0, 3000)}

EXISTING MASTER MILESTONES:
${milestoneList}

INSTRUCTIONS:
- Generate 3-6 concrete, actionable sub-milestones for this committee
- Each sub-milestone MUST map to one of the existing master milestones by ID
- Choose the most relevant master milestone for each sub-milestone
- Sub-milestones should be specific deliverables this committee must complete
- Flag sub-milestones as requiresApproval if they involve budget decisions, contracts, or critical deliverables
- Keep titles concise and measurable

Respond with ONLY valid JSON, no markdown:
{
  "subMilestones": [
    {
      "milestoneId": "uuid-of-parent-milestone",
      "title": "string",
      "description": "string",
      "requiresApproval": true/false,
      "sortOrder": 1
    }
  ]
}`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].text.trim();
  const parsed = JSON.parse(text);

  // Validate milestone IDs exist
  const validIds = new Set(milestones.map((m) => m.id));

  const created = [];
  for (const sm of parsed.subMilestones) {
    if (!validIds.has(sm.milestoneId)) {
      console.warn(`[Milestones] Sub-milestone "${sm.title}" references invalid milestone ID: ${sm.milestoneId}, skipping`);
      continue;
    }

    const subMilestone = await prisma.subMilestone.create({
      data: {
        milestoneId: sm.milestoneId,
        committeeId,
        title: sm.title,
        description: sm.description || null,
        requiresApproval: sm.requiresApproval || false,
        sortOrder: sm.sortOrder || 0,
      },
    });
    created.push(subMilestone);
  }

  // Recalculate parent milestone progress
  for (const milestoneId of new Set(created.map((s) => s.milestoneId))) {
    await recalculateMilestoneProgress(milestoneId);
  }

  console.log(`[Milestones] Generated ${created.length} sub-milestones for ${committee.name}`);
  return created;
}

// ═══════════════════════════════════════════════════════════════════════
// PROGRESS RECALCULATION
// Rolls up sub-milestone completion to master milestone progress
// ═══════════════════════════════════════════════════════════════════════

async function recalculateMilestoneProgress(milestoneId) {
  const subs = await prisma.subMilestone.findMany({
    where: { milestoneId },
  });

  if (subs.length === 0) {
    await prisma.milestone.update({
      where: { id: milestoneId },
      data: { progress: 0, status: "not_started" },
    });
    return;
  }

  const completedCount = subs.filter(
    (s) => s.status === "completed" || s.status === "verified"
  ).length;
  const inProgressCount = subs.filter(
    (s) => s.status === "in_progress" || s.status === "pending_approval"
  ).length;

  const progress = Math.round((completedCount / subs.length) * 100);

  let status = "not_started";
  if (progress === 100) status = "completed";
  else if (completedCount > 0 || inProgressCount > 0) status = "in_progress";

  // Check if any sub-milestones are at risk (overdue parent target date with incomplete subs)
  const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId } });
  if (
    milestone?.targetDate &&
    new Date(milestone.targetDate) < new Date() &&
    progress < 100
  ) {
    status = "at_risk";
  }

  await prisma.milestone.update({
    where: { id: milestoneId },
    data: { progress, status },
  });

  return { progress, status };
}

// ═══════════════════════════════════════════════════════════════════════
// STATUS UPDATE MATCHING
// When a status update comes in, check if it relates to any sub-milestones
// ═══════════════════════════════════════════════════════════════════════

async function matchStatusUpdateToMilestones(statusUpdateId) {
  const update = await prisma.statusUpdate.findUnique({
    where: { id: statusUpdateId },
    include: { committee: true },
  });

  if (!update) return [];

  // Get this committee's pending sub-milestones
  const pendingSubs = await prisma.subMilestone.findMany({
    where: {
      committeeId: update.committeeId,
      status: { in: ["not_started", "in_progress"] },
    },
    include: { milestone: true },
  });

  if (pendingSubs.length === 0) return [];

  // Build context for AI matching
  const subsText = pendingSubs
    .map((s) => `  [ID: ${s.id}] "${s.title}" — ${s.description || "No description"} (Parent: ${s.milestone.title})`)
    .join("\n");

  const updateContent = [
    update.summary,
    update.keyAccomplishments,
    update.nextSteps,
  ]
    .filter(Boolean)
    .join("\n");

  const prompt = `Analyze this committee status update and determine which sub-milestones it relates to. Only match sub-milestones where the update provides clear evidence of progress or completion.

STATUS UPDATE FROM: ${update.committee.name}
${updateContent}

PENDING SUB-MILESTONES FOR THIS COMMITTEE:
${subsText}

For each matched sub-milestone, indicate whether the update suggests it's:
- "in_progress" — work has started but not complete
- "completed" — the deliverable appears to be done based on the update

Respond with ONLY valid JSON, no markdown:
{
  "matches": [
    {
      "subMilestoneId": "uuid",
      "suggestedStatus": "in_progress" or "completed",
      "reason": "brief explanation"
    }
  ]
}

If no sub-milestones match, return: { "matches": [] }`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content[0].text.trim();
  const parsed = JSON.parse(text);

  // Apply matches
  const validSubIds = new Set(pendingSubs.map((s) => s.id));
  const updated = [];

  for (const match of parsed.matches) {
    if (!validSubIds.has(match.subMilestoneId)) continue;

    const sub = pendingSubs.find((s) => s.id === match.subMilestoneId);
    if (!sub) continue;

    if (match.suggestedStatus === "completed") {
      if (sub.requiresApproval) {
        // Critical: mark as pending_approval instead of completed
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
            verified: true,
          },
        });
      }
    } else {
      await prisma.subMilestone.update({
        where: { id: sub.id },
        data: { status: "in_progress" },
      });
    }

    updated.push({
      subMilestoneId: sub.id,
      title: sub.title,
      newStatus: sub.requiresApproval && match.suggestedStatus === "completed"
        ? "pending_approval"
        : match.suggestedStatus,
      reason: match.reason,
    });
  }

  // Recalculate progress for affected milestones
  const affectedMilestoneIds = new Set(
    updated.map((u) => pendingSubs.find((s) => s.id === u.subMilestoneId)?.milestoneId).filter(Boolean)
  );

  for (const mid of affectedMilestoneIds) {
    await recalculateMilestoneProgress(mid);
  }

  if (updated.length > 0) {
    console.log(`[Milestones] Matched status update to ${updated.length} sub-milestones`);
  }

  return updated;
}

module.exports = {
  generateMasterMilestones,
  generateSubMilestones,
  recalculateMilestoneProgress,
  matchStatusUpdateToMilestones,
};

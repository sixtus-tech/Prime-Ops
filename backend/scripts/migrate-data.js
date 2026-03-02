// scripts/migrate-data.js — FIXED: handles null foreign keys
const { PrismaClient: PgPrisma } = require("@prisma/client");
const Database = require("better-sqlite3");
const path = require("path");

const SQLITE_PATH = path.join(__dirname, "..", "prisma", "dev.db");
const pg = new PgPrisma();
const sqlite = new Database(SQLITE_PATH, { readonly: true });

function getAll(table) {
  try { return sqlite.prepare(`SELECT * FROM ${table}`).all(); }
  catch { console.warn(`  ⚠ Table "${table}" not found, skipping`); return []; }
}
function parseDate(val) { if (!val) return null; const d = new Date(val); return isNaN(d.getTime()) ? null : d; }
function parseJson(val) { if (!val) return null; try { return JSON.parse(val); } catch { return null; } }
function parseBool(val) { return val === true || val === 1 || val === "true"; }

async function migrate() {
  console.log("═══════════════════════════════════════════════════════════");
  console.log("  SQLite → PostgreSQL Data Migration");
  console.log("═══════════════════════════════════════════════════════════\n");

  // ── 1. Users ─────────────────────────────────────────────────────
  const users = getAll("User");
  console.log(`[1/12] Migrating ${users.length} users...`);
  for (const u of users) {
    try {
      await pg.user.upsert({
        where: { id: u.id },
        create: {
          id: u.id, email: u.email, password: u.password || null,
          name: u.name, username: u.username || null,
          role: u.role || "user", globalRole: "user",
          avatarUrl: u.avatarUrl || null, kcId: u.kcId || null, kcUsername: u.kcUsername || null,
          lastLoginAt: parseDate(u.lastLoginAt),
          createdAt: parseDate(u.createdAt) || new Date(), updatedAt: parseDate(u.updatedAt) || new Date(),
        },
        update: {},
      });
    } catch (err) { console.warn(`  ⚠ Skipped user ${u.id}: ${err.message.substring(0, 80)}`); }
  }
  console.log(`  ✓ ${users.length} users`);

  // ── 2. Events ────────────────────────────────────────────────────
  const events = getAll("Event");
  console.log(`\n[2/12] Migrating ${events.length} events...`);
  for (const e of events) {
    try {
      await pg.event.upsert({
        where: { id: e.id },
        create: {
          id: e.id, title: e.title, subtitle: e.subtitle || null,
          description: e.description || null, summary: e.summary || null,
          eventType: e.eventType || "general",
          startDate: parseDate(e.startDate), endDate: parseDate(e.endDate),
          venue: e.venue || null, estimatedBudget: e.estimatedBudget || null,
          estimatedAttendance: e.estimatedAttendance || null,
          status: e.status || "draft", createdById: e.createdById || null,
          createdAt: parseDate(e.createdAt) || new Date(), updatedAt: parseDate(e.updatedAt) || new Date(),
        },
        update: {},
      });
    } catch (err) { console.warn(`  ⚠ Skipped event ${e.id}: ${err.message.substring(0, 80)}`); }
  }
  console.log(`  ✓ ${events.length} events`);

  // ── 3. Committees ────────────────────────────────────────────────
  const committees = getAll("Committee");
  console.log(`\n[3/12] Migrating ${committees.length} committees...`);
  for (const c of committees) {
    if (!c.eventId) continue;
    try {
      await pg.committee.upsert({
        where: { id: c.id },
        create: {
          id: c.id, eventId: c.eventId, name: c.name,
          description: c.description || null, proposalDeadline: parseDate(c.proposalDeadline),
          createdAt: parseDate(c.createdAt) || new Date(), updatedAt: parseDate(c.updatedAt) || new Date(),
        },
        update: {},
      });
    } catch (err) { console.warn(`  ⚠ Skipped committee ${c.id}: ${err.message.substring(0, 80)}`); }
  }
  console.log(`  ✓ ${committees.length} committees`);

  // ── 4. Members ───────────────────────────────────────────────────
  const members = getAll("Member");
  console.log(`\n[4/12] Migrating ${members.length} members...`);
  let memberSkipped = 0;
  for (const m of members) {
    if (!m.committeeId) { memberSkipped++; continue; }
    try {
      await pg.member.upsert({
        where: { id: m.id },
        create: {
          id: m.id, committeeId: m.committeeId, userId: m.userId || null,
          kcId: m.kcId || null, kcUsername: m.kcUsername || null,
          name: m.name, email: m.email || null, phone: m.phone || null,
          role: m.role || "member",
          createdAt: parseDate(m.createdAt) || new Date(), updatedAt: parseDate(m.updatedAt) || new Date(),
        },
        update: {},
      });
    } catch (err) { memberSkipped++; }
  }
  console.log(`  ✓ ${members.length - memberSkipped} members${memberSkipped ? ` (${memberSkipped} skipped)` : ""}`);

  // ── 5. Responsibilities ──────────────────────────────────────────
  const responsibilities = getAll("Responsibility");
  console.log(`\n[5/12] Migrating ${responsibilities.length} responsibilities...`);
  for (const r of responsibilities) {
    if (!r.committeeId) continue;
    try {
      await pg.responsibility.upsert({
        where: { id: r.id },
        create: {
          id: r.id, committeeId: r.committeeId, text: r.text,
          createdAt: parseDate(r.createdAt) || new Date(),
        },
        update: {},
      });
    } catch (err) { console.warn(`  ⚠ Skipped responsibility: ${err.message.substring(0, 60)}`); }
  }
  console.log(`  ✓ ${responsibilities.length} responsibilities`);

  // ── 6. Proposals ─────────────────────────────────────────────────
  const proposals = getAll("Proposal");
  console.log(`\n[6/12] Migrating ${proposals.length} proposals...`);
  let proposalOk = 0;
  for (const p of proposals) {
    if (!p.eventId || !p.committeeId) continue;
    try {
      await pg.proposal.upsert({
        where: { id: p.id },
        create: {
          id: p.id, eventId: p.eventId, committeeId: p.committeeId,
          inputText: p.inputText || null, inputType: p.inputType || "text",
          proposalJson: p.proposalJson, status: p.status || "draft",
          submittedBy: p.submittedBy || null, version: p.version || 1,
          createdAt: parseDate(p.createdAt) || new Date(), updatedAt: parseDate(p.updatedAt) || new Date(),
        },
        update: {},
      });
      proposalOk++;
    } catch (err) { console.warn(`  ⚠ Skipped proposal: ${err.message.substring(0, 60)}`); }
  }
  console.log(`  ✓ ${proposalOk} proposals migrated (${proposals.length - proposalOk} skipped)`);

  // ── 7. Approval Requests + Actions ───────────────────────────────
  const approvals = getAll("ApprovalRequest");
  console.log(`\n[7/12] Migrating ${approvals.length} approval requests...`);
  let approvalOk = 0;
  for (const a of approvals) {
    if (!a.eventId) continue;
    try {
      await pg.approvalRequest.upsert({
        where: { id: a.id },
        create: {
          id: a.id, eventId: a.eventId, committeeId: a.committeeId || null,
          proposalId: a.proposalId || null, title: a.title,
          description: a.description || null, requestedBy: a.requestedBy,
          priority: a.priority || "normal", status: a.status || "pending",
          dueDate: parseDate(a.dueDate),
          createdAt: parseDate(a.createdAt) || new Date(), updatedAt: parseDate(a.updatedAt) || new Date(),
        },
        update: {},
      });
      approvalOk++;
    } catch (err) { console.warn(`  ⚠ Skipped approval: ${err.message.substring(0, 60)}`); }
  }

  const actions = getAll("ApprovalAction");
  let actionOk = 0;
  for (const a of actions) {
    if (!a.approvalRequestId) continue;
    try {
      await pg.approvalAction.upsert({
        where: { id: a.id },
        create: {
          id: a.id, approvalRequestId: a.approvalRequestId,
          action: a.action, performedBy: a.performedBy,
          comment: a.comment || null, createdAt: parseDate(a.createdAt) || new Date(),
        },
        update: {},
      });
      actionOk++;
    } catch (err) { /* skip orphaned actions */ }
  }
  console.log(`  ✓ ${approvalOk} approvals + ${actionOk} actions`);

  // ── 8. Milestones ────────────────────────────────────────────────
  const milestones = getAll("Milestone");
  console.log(`\n[8/12] Migrating ${milestones.length} milestones...`);
  for (const m of milestones) {
    if (!m.eventId) continue;
    try {
      await pg.milestone.upsert({
        where: { id: m.id },
        create: {
          id: m.id, eventId: m.eventId, title: m.title,
          description: m.description || null, phase: m.phase,
          targetDate: parseDate(m.targetDate), status: m.status || "not_started",
          progress: m.progress || 0, requiresApproval: parseBool(m.requiresApproval),
          createdAt: parseDate(m.createdAt) || new Date(), updatedAt: parseDate(m.updatedAt) || new Date(),
        },
        update: {},
      });
    } catch (err) { console.warn(`  ⚠ Skipped milestone: ${err.message.substring(0, 60)}`); }
  }
  console.log(`  ✓ ${milestones.length} milestones`);

  // ── 9. Sub-Milestones ────────────────────────────────────────────
  const subMilestones = getAll("SubMilestone");
  console.log(`\n[9/12] Migrating ${subMilestones.length} sub-milestones...`);
  let subOk = 0;
  for (const s of subMilestones) {
    if (!s.milestoneId || !s.committeeId) continue;
    try {
      await pg.subMilestone.upsert({
        where: { id: s.id },
        create: {
          id: s.id, milestoneId: s.milestoneId, committeeId: s.committeeId,
          title: s.title, description: s.description || null,
          sortOrder: s.sortOrder || 0, status: s.status || "not_started",
          requiresApproval: parseBool(s.requiresApproval),
          completedAt: parseDate(s.completedAt), completedBy: s.completedBy || null,
          approvedAt: parseDate(s.approvedAt), approvedBy: s.approvedBy || null,
          createdAt: parseDate(s.createdAt) || new Date(), updatedAt: parseDate(s.updatedAt) || new Date(),
        },
        update: {},
      });
      subOk++;
    } catch (err) { console.warn(`  ⚠ Skipped sub-milestone: ${err.message.substring(0, 60)}`); }
  }
  console.log(`  ✓ ${subOk} sub-milestones`);

  // ── 10. Status Updates ───────────────────────────────────────────
  const updates = getAll("StatusUpdate");
  console.log(`\n[10/12] Migrating ${updates.length} status updates...`);
  let updateOk = 0;
  for (const u of updates) {
    if (!u.committeeId) continue;
    try {
      await pg.statusUpdate.upsert({
        where: { id: u.id },
        create: {
          id: u.id, committeeId: u.committeeId, eventId: u.eventId || null,
          subMilestoneId: u.subMilestoneId || null, title: u.title,
          content: u.content || null, status: u.status || "on_track",
          highlights: parseJson(u.highlights), challenges: parseJson(u.challenges),
          nextSteps: parseJson(u.nextSteps), metrics: parseJson(u.metrics),
          submittedBy: u.submittedBy,
          createdAt: parseDate(u.createdAt) || new Date(), updatedAt: parseDate(u.updatedAt) || new Date(),
        },
        update: {},
      });
      updateOk++;
    } catch (err) { console.warn(`  ⚠ Skipped status update: ${err.message.substring(0, 60)}`); }
  }
  console.log(`  ✓ ${updateOk} status updates`);

  // ── 11. Tasks ────────────────────────────────────────────────────
  const tasks = getAll("Task");
  console.log(`\n[11/12] Migrating ${tasks.length} tasks...`);
  let taskOk = 0;
  for (const t of tasks) {
    if (!t.eventId) continue;
    try {
      await pg.task.upsert({
        where: { id: t.id },
        create: {
          id: t.id, eventId: t.eventId, committeeId: t.committeeId || null,
          title: t.title, description: t.description || null,
          assignedTo: t.assignedTo || null, priority: t.priority || "medium",
          status: t.status || "pending", dueDate: parseDate(t.dueDate),
          completedAt: parseDate(t.completedAt), createdBy: t.createdBy || null,
          createdAt: parseDate(t.createdAt) || new Date(), updatedAt: parseDate(t.updatedAt) || new Date(),
        },
        update: {},
      });
      taskOk++;
    } catch (err) { console.warn(`  ⚠ Skipped task: ${err.message.substring(0, 60)}`); }
  }
  console.log(`  ✓ ${taskOk} tasks`);

  // ── 12. Notifications + Activities ───────────────────────────────
  const notifications = getAll("Notification");
  console.log(`\n[12/12] Migrating ${notifications.length} notifications...`);
  let notifOk = 0;
  for (const n of notifications) {
    if (!n.userId) continue;
    try {
      await pg.notification.upsert({
        where: { id: n.id },
        create: {
          id: n.id, userId: n.userId, type: n.type, title: n.title,
          message: n.message, link: n.link || null,
          read: parseBool(n.read), metadata: parseJson(n.metadata),
          createdAt: parseDate(n.createdAt) || new Date(), updatedAt: parseDate(n.updatedAt) || new Date(),
        },
        update: {},
      });
      notifOk++;
    } catch (err) { /* skip */ }
  }

  const activities = getAll("Activity");
  let actOk = 0;
  for (const a of activities) {
    try {
      await pg.activity.upsert({
        where: { id: a.id },
        create: {
          id: a.id, eventId: a.eventId || null, action: a.action,
          description: a.description, performedBy: a.performedBy,
          createdAt: parseDate(a.createdAt) || new Date(),
        },
        update: {},
      });
      actOk++;
    } catch (err) { /* skip */ }
  }
  console.log(`  ✓ ${notifOk} notifications + ${actOk} activities`);

  // ── Summary ──────────────────────────────────────────────────────
  console.log("\n═══════════════════════════════════════════════════════════");
  console.log("  ✅ Migration complete!");
  console.log("═══════════════════════════════════════════════════════════\n");
}

migrate()
  .then(() => { sqlite.close(); pg.$disconnect(); process.exit(0); })
  .catch((err) => { console.error("\n❌ Migration failed:", err); sqlite.close(); pg.$disconnect(); process.exit(1); });

#!/usr/bin/env node
/**
 * Migration: Add optional subMilestoneId to StatusUpdate model
 * Links status updates to specific sub-milestones as "evidence"
 *
 * Run from backend root:  node migrate-milestone-updates.js
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const SCHEMA = path.join(__dirname, "prisma", "schema.prisma");

let schema = fs.readFileSync(SCHEMA, "utf-8");
let changes = 0;

// ── 1. Add subMilestoneId field + relation to StatusUpdate model ──────────
const statusUpdateModel = /model StatusUpdate \{([^}]+)\}/s;
const match = schema.match(statusUpdateModel);

if (!match) {
  console.error("❌ Could not find model StatusUpdate in schema.prisma");
  process.exit(1);
}

if (match[1].includes("subMilestoneId")) {
  console.log("⏭  1/2  subMilestoneId already exists in StatusUpdate model");
} else {
  // Add before the closing brace of StatusUpdate
  const modelContent = match[1];

  // Find a good insertion point — after the last field before closing brace
  const newFields = `
  // Optionally link this update to a specific sub-milestone (evidence)
  subMilestoneId  String?
  subMilestone    SubMilestone?  @relation(fields: [subMilestoneId], references: [id])
`;

  const updatedModel = `model StatusUpdate {${modelContent}${newFields}}`;
  schema = schema.replace(match[0], updatedModel);
  changes++;
  console.log("✅ 1/2  Added subMilestoneId + relation to StatusUpdate");
}

// ── 2. Add statusUpdates relation to SubMilestone model ──────────────
const subMilestoneModel = /model SubMilestone \{([^}]+)\}/s;
const subMatch = schema.match(subMilestoneModel);

if (!subMatch) {
  console.error("❌ Could not find model SubMilestone in schema.prisma");
  process.exit(1);
}

if (subMatch[1].includes("statusUpdates")) {
  console.log("⏭  2/2  statusUpdates relation already exists in SubMilestone");
} else {
  const subContent = subMatch[1];
  const newRelation = `
  // Status updates linked as evidence for this sub-milestone
  statusUpdates   StatusUpdate[]
`;
  const updatedSub = `model SubMilestone {${subContent}${newRelation}}`;
  schema = schema.replace(subMatch[0], updatedSub);
  changes++;
  console.log("✅ 2/2  Added statusUpdates[] relation to SubMilestone");
}

if (changes > 0) {
  fs.writeFileSync(SCHEMA, schema);
  console.log(`\n✅ Schema updated with ${changes} change(s)`);
  console.log("\nRunning prisma generate + migrate...\n");

  try {
    execSync("npx prisma generate", { stdio: "inherit", cwd: __dirname });
    execSync(
      'npx prisma migrate dev --name add_milestone_update_link --create-only',
      { stdio: "inherit", cwd: __dirname }
    );
    console.log("\n✅ Migration created. Review it, then run:");
    console.log("   npx prisma migrate deploy");
  } catch (err) {
    console.log("\n⚠  Auto-migrate failed. Run manually:");
    console.log("   npx prisma generate");
    console.log("   npx prisma migrate dev --name add_milestone_update_link");
  }
} else {
  console.log("\n⏭  No schema changes needed.");
}

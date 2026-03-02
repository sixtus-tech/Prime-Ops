#!/usr/bin/env node
/**
 * Patch: Add Milestones tab to /app/portal/committee/[id]/page.js
 * 
 * Run:  node patch-committee-milestones.js
 */

const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "app", "portal", "committee", "[id]", "page.js");

let src = fs.readFileSync(FILE, "utf-8");
let changes = 0;

// ── 1. Add import for CommitteeMilestones ─────────────────────────
const importAnchor = `import StatusUpdateTimeline from "../../../../components/StatusUpdateTimeline";`;
const importAdd = `import CommitteeMilestones from "../../../../components/CommitteeMilestones";`;

if (!src.includes("CommitteeMilestones")) {
  src = src.replace(importAnchor, `${importAnchor}\n${importAdd}`);
  changes++;
  console.log("✅ 1/3  Added CommitteeMilestones import");
} else {
  console.log("⏭  1/3  Import already exists");
}

// ── 2. Add "Milestones" to tab list (between Updates and Tasks) ──
const tabAnchor = `{ id: "tasks", label: "Tasks & Due Dates" },`;
const tabAdd = `{ id: "milestones", label: "Milestones" },\n            `;

if (!src.includes(`id: "milestones"`)) {
  src = src.replace(tabAnchor, `${tabAdd}${tabAnchor}`);
  changes++;
  console.log("✅ 2/3  Added Milestones tab to tab bar");
} else {
  console.log("⏭  2/3  Milestones tab already exists");
}

// ── 3. Add Milestones tab content (between Updates and Tasks tab content) ──
const contentAnchor = `{/* ═══ TASKS TAB ═══ */}`;
const contentAdd = `{/* ═══ MILESTONES TAB ═══ */}
        {activeTab === "milestones" && (
          <CommitteeMilestones
            committeeId={committee.id}
            isChair={isChair}
          />
        )}

        `;

if (!src.includes("MILESTONES TAB")) {
  src = src.replace(contentAnchor, `${contentAdd}${contentAnchor}`);
  changes++;
  console.log("✅ 3/3  Added Milestones tab content section");
} else {
  console.log("⏭  3/3  Milestones content already exists");
}

if (changes > 0) {
  fs.writeFileSync(FILE, src);
  console.log(`\n✅ Done — ${changes} change(s) applied to ${FILE}`);
} else {
  console.log("\n⏭  No changes needed — milestones already integrated.");
}

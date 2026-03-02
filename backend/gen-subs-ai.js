const prisma = require('./services/db');
const { generateSubMilestones } = require('./services/milestoneGenerator');

async function run() {
  const committeeId = '059019da-5db1-4140-99f0-4818745c097a';

  // Check if sub-milestones already exist
  const existing = await prisma.subMilestone.count({ where: { committeeId } });
  if (existing > 0) {
    console.log('Already have ' + existing + ' sub-milestones. Delete them first if you want to regenerate.');
    return;
  }

  // Get the approved proposal
  const proposal = await prisma.proposal.findFirst({
    where: {
      committee: { id: committeeId },
      status: 'approved',
    },
  });

  if (!proposal) {
    console.log('No approved proposal found for this committee');
    return;
  }

  console.log('Found approved proposal:', proposal.id);
  console.log('Calling AI to generate sub-milestones...');

  const subs = await generateSubMilestones(committeeId, proposal.proposalJson);

  console.log('Created ' + subs.length + ' sub-milestones:');
  subs.forEach((s) => {
    console.log('  - ' + s.title + ' (Phase: ' + (s.milestone ? 'linked' : 'unknown') + ')');
  });
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error:', err.message || err);
    process.exit(1);
  });

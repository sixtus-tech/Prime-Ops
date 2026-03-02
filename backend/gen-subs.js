const prisma = require('./services/db');

async function run() {
  const proposal = await prisma.proposal.findFirst({
    where: {
      committee: { id: '059019da-5db1-4140-99f0-4818745c097a' },
      status: 'approved'
    }
  });

  if (!proposal) {
    console.log('No approved proposal found for this committee');
    process.exit(1);
  }

  console.log('Found proposal:', proposal.id);

  const res = await fetch(
    'http://localhost:4000/api/milestones/7f6932b1-13c2-4873-b606-94cc75f878a4/generate-sub/059019da-5db1-4140-99f0-4818745c097a',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ proposalJson: proposal.proposalJson })
    }
  );

  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}

run().then(() => process.exit());

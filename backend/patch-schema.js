const fs = require('fs');
const path = require('path');

const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
let schema = fs.readFileSync(schemaPath, 'utf-8');

// 1. Add relation field to Proposal model (if not already there)
if (!schema.includes('ProposalComment[]')) {
  // Find the Proposal model and add the relation before its closing brace
  schema = schema.replace(
    /(model Proposal \{[\s\S]*?)(^\})/m,
    '$1  comments        ProposalComment[]\n$2'
  );

  // Find the Committee model and add the relation before its closing brace
  schema = schema.replace(
    /(model Committee \{[\s\S]*?)(^\})/m,
    '$1  proposalComments ProposalComment[]\n$2'
  );
}

// 2. Add ProposalComment model at the end (if not already there)
if (!schema.includes('model ProposalComment')) {
  schema += `

// ─── Proposal Comments (member feedback on proposals) ────────────────
model ProposalComment {
  id          String   @id @default(uuid())
  proposalId  String
  committeeId String
  authorId    String?
  authorName  String
  authorRole  String
  content     String
  status      String   @default("visible")
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  proposal  Proposal  @relation(fields: [proposalId], references: [id], onDelete: Cascade)
  committee Committee @relation(fields: [committeeId], references: [id], onDelete: Cascade)
}
`;
}

fs.writeFileSync(schemaPath, schema);
console.log('Schema updated successfully.');
console.log('Now run: npx prisma migrate dev --name add-proposal-comments');

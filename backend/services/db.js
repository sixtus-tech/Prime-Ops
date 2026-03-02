const { PrismaClient } = require("@prisma/client");

let prisma;

const prismaOptions = {
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
  // Log slow queries in dev
  log: process.env.NODE_ENV !== "production" ? ["warn", "error"] : ["error"],
};

if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient(prismaOptions);
} else {
  if (!global.__prisma) {
    global.__prisma = new PrismaClient(prismaOptions);
  }
  prisma = global.__prisma;
}

// Eagerly connect on startup — eliminates 1.2s cold start on first query
prisma.$connect().then(() => {
  console.log("[DB] Connected to PostgreSQL");
}).catch((err) => {
  console.error("[DB] Connection failed:", err.message);
});

module.exports = prisma;
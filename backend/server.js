require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const proposalRoutes = require("./routes/proposal");
const eventRoutes = require("./routes/events");
const committeeRoutes = require("./routes/committees");
const approvalRoutes = require("./routes/approvals");
const dashboardRoutes = require("./routes/dashboard");
const authRoutes = require("./routes/auth");
const kcAuthRoutes = require("./routes/kcAuth");
const portalRoutes = require("./routes/portal");
const notificationRoutes = require("./routes/notifications");
const taskRoutes = require("./routes/tasks");
const statusUpdateRoutes = require("./routes/statusUpdates");
const uploadRoutes = require("./routes/uploads");
const realtimeRoutes = require("./routes/realtime");

const app = express();
const PORT = process.env.PORT || 4000;

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  })
);
app.use(express.json({ limit: "10mb" }));

// Rate limiting — 60 requests per minute per IP
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests. Please try again in a minute." },
});
app.use("/api/", limiter);

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use("/api/auth", authRoutes);
app.use("/api/auth", kcAuthRoutes);
app.use("/api/proposal", proposalRoutes);
app.use("/api/proposals", proposalRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/committees", committeeRoutes);
app.use("/api/approvals", approvalRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/portal", portalRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/status-updates", statusUpdateRoutes);
app.use("/api/milestones", require("./routes/milestones"));
app.use("/api/members", require("./routes/members"));
app.use("/api/uploads", uploadRoutes);
app.use("/api/realtime", realtimeRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", service: "Prime Ops Platform" });
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "Internal server error" });
});

const { startDeadlineReminders } = require("./services/deadlineReminders");

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
const { startBroadcastScheduler } = require("./services/broadcastScheduler");
startBroadcastScheduler();
  console.log(`\n🚀 Prime Ops API running on http://localhost:${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/api/health\n`);

  // Start deadline reminder scheduler
  startDeadlineReminders();

  // Start realtime notification listener
  const { initRealtimeListener } = require("./services/realtime");
  // initRealtimeListener(); // TODO: enable when Supabase Realtime works
});

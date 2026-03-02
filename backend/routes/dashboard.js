const express = require("express");
const prisma = require("../services/db");

const router = express.Router();

// ---------------------------------------------------------------------------
// GET /api/dashboard/stats — aggregate stats for the dashboard
// ---------------------------------------------------------------------------
router.get("/stats", async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Run ALL queries in parallel
    const [
      eventsByStatus,
      eventsByType,
      totalEvents,
      totalCommittees,
      totalMembers,
      totalProposals,
      pendingApprovals,
      totalApprovals,
      approvalsByStatus,
      recentEvents,
      upcomingEvents,
      pendingRequests,
      recentlyCreatedEvents,
      topCommittees,
    ] = await Promise.all([
      prisma.event.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.event.groupBy({ by: ["eventType"], _count: { id: true } }),
      prisma.event.count(),
      prisma.committee.count(),
      prisma.member.count(),
      prisma.proposal.count(),
      prisma.approvalRequest.count({ where: { status: { in: ["pending", "under_review"] } } }),
      prisma.approvalRequest.count(),
      prisma.approvalRequest.groupBy({ by: ["status"], _count: { id: true } }),
      prisma.event.findMany({
        take: 5, orderBy: { updatedAt: "desc" },
        select: { id: true, title: true, status: true, eventType: true, updatedAt: true, _count: { select: { committees: true } } },
      }),
      prisma.event.findMany({
        where: { startDate: { gte: new Date() }, status: { notIn: ["cancelled", "completed"] } },
        take: 5, orderBy: { startDate: "asc" },
        select: { id: true, title: true, status: true, eventType: true, startDate: true, estimatedAttendance: true },
      }),
      prisma.approvalRequest.findMany({
        where: { status: { in: ["pending", "under_review"] } },
        take: 10, orderBy: { createdAt: "desc" },
        include: { event: { select: { id: true, title: true } } },
      }),
      prisma.event.findMany({
        where: { createdAt: { gte: thirtyDaysAgo } },
        select: { createdAt: true }, orderBy: { createdAt: "asc" },
      }),
      prisma.committee.findMany({
        take: 5, orderBy: { members: { _count: "desc" } },
        select: { id: true, name: true, event: { select: { id: true, title: true } }, _count: { select: { members: true } } },
      }),
    ]);

    // Group by day for chart data
    const eventsByDay = {};
    recentlyCreatedEvents.forEach((e) => {
      const day = e.createdAt.toISOString().split("T")[0];
      eventsByDay[day] = (eventsByDay[day] || 0) + 1;
    });
    const chartData = Object.entries(eventsByDay).map(([date, count]) => ({ date, count }));

    res.json({
      totals: {
        events: totalEvents,
        committees: totalCommittees,
        members: totalMembers,
        proposals: totalProposals,
        pendingApprovals,
        totalApprovals,
      },
      eventsByStatus: eventsByStatus.reduce((acc, e) => ({ ...acc, [e.status]: e._count.id }), {}),
      eventsByType: eventsByType.reduce((acc, e) => ({ ...acc, [e.eventType]: e._count.id }), {}),
      approvalsByStatus: approvalsByStatus.reduce((acc, a) => ({ ...acc, [a.status]: a._count.id }), {}),
      recentEvents,
      upcomingEvents,
      pendingRequests,
      chartData,
      topCommittees,
    });
  } catch (err) {
    console.error("Dashboard stats error:", err);
    res.status(500).json({ error: "Failed to fetch dashboard stats." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/dashboard/activity — activity feed
// ---------------------------------------------------------------------------
router.get("/activity", async (req, res) => {
  try {
    const { limit = 30, offset = 0 } = req.query;

    const [activities, total] = await Promise.all([
      prisma.activity.findMany({
        take: parseInt(limit),
        skip: parseInt(offset),
        orderBy: { createdAt: "desc" },
        include: { event: { select: { id: true, title: true } } },
      }),
      prisma.activity.count(),
    ]);

    res.json({ activities, total });
  } catch (err) {
    console.error("Activity feed error:", err);
    res.status(500).json({ error: "Failed to fetch activity feed." });
  }
});

module.exports = router;

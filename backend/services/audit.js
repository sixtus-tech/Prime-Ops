// backend/services/audit.js
// ═══════════════════════════════════════════════════════════════════════
// Audit Log Service — immutable record of all platform actions
// ═══════════════════════════════════════════════════════════════════════

const prisma = require("./db");

/**
 * Log an audit event
 * @param {Object} params
 * @param {string} params.userId - Who performed the action
 * @param {string} params.programId - Which program (optional)
 * @param {string} params.action - What happened: "create", "update", "delete", "login", etc.
 * @param {string} params.entityType - What type: "proposal", "milestone", "member", etc.
 * @param {string} params.entityId - Which entity (optional)
 * @param {Object} params.metadata - Extra context (before/after state, etc.)
 * @param {string} params.ipAddress - Request IP (optional)
 */
async function logAudit({ userId, programId, action, entityType, entityId, metadata, ipAddress }) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId || null,
        programId: programId || null,
        action,
        entityType: entityType || "unknown",
        entityId: entityId || null,
        metadata: metadata || null,
        ipAddress: ipAddress || null,
      },
    });
  } catch (err) {
    // Never let audit logging break the main flow
    console.error("[Audit] Failed to log:", err.message);
  }
}

/**
 * Express middleware to auto-log API requests
 * Attach to routes that need audit trails
 */
function auditMiddleware(entityType) {
  return (req, res, next) => {
    // Capture the original res.json to log after response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Log successful mutations (POST, PUT, DELETE)
      if (["POST", "PUT", "DELETE"].includes(req.method) && res.statusCode < 400) {
        const action = req.method === "POST" ? "create" :
                       req.method === "PUT" ? "update" : "delete";

        logAudit({
          userId: req.user?.id,
          programId: req.params?.eventId || body?.eventId || null,
          action,
          entityType,
          entityId: req.params?.id || body?.id || null,
          metadata: {
            path: req.originalUrl,
            method: req.method,
          },
          ipAddress: req.ip,
        });
      }
      return originalJson(body);
    };
    next();
  };
}

module.exports = { logAudit, auditMiddleware };

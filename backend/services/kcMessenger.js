const prisma = require("./db");

// ---------------------------------------------------------------------------
// KingsChat Messaging Service
// Uses the KingsChat API to send direct messages to users.
// Replicates the kingschat-web-sdk sendMessage functionality server-side.
// ---------------------------------------------------------------------------

const KC_BASE_URL = "https://connect.kingsch.at";
const KC_CLIENT_ID = process.env.KC_CLIENT_ID || "com.kingschat";

/**
 * Send a message to a KingsChat user.
 * @param {string} recipientKcId - The KingsChat user_id of the recipient
 * @param {string} message - The message text to send
 * @param {string} accessToken - A valid KC access token with send_chat_message scope
 * @returns {Promise<boolean>} true if sent successfully
 */
async function sendKcMessage(recipientKcId, message, accessToken) {
  try {
    const res = await fetch(`${KC_BASE_URL}/api/users/${recipientKcId}/new_message`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        message: {
          body: {
            text: {
              body: message,
            },
          },
        },
      }),
    });

    if (res.ok) {
      return true;
    }

    // If 401, token might be expired
    if (res.status === 401) {
      console.warn("[KC Messenger] Access token expired or invalid");
      return false;
    }

    const errorBody = await res.text().catch(() => "");
    console.error(`[KC Messenger] Send failed (${res.status}):`, errorBody);
    return false;
  } catch (err) {
    console.error("[KC Messenger] Network error:", err.message);
    return false;
  }
}

/**
 * Refresh a KingsChat access token using the refresh token.
 * @param {string} refreshToken
 * @returns {Promise<{accessToken: string, expiresInMillis: number, refreshToken: string}|null>}
 */
async function refreshKcToken(refreshToken) {
  try {
    const res = await fetch(`${KC_BASE_URL}/oauth2/token`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: KC_CLIENT_ID,
        grant_type: "refresh_token",
        refresh_token: refreshToken,
      }),
    });

    if (!res.ok) {
      console.error("[KC Messenger] Token refresh failed:", res.status);
      return null;
    }

    const data = await res.json();
    return {
      accessToken: data.accessToken || data.access_token,
      expiresInMillis: data.expiresInMillis || data.expires_in_millis || 3600000,
      refreshToken: data.refreshToken || data.refresh_token || refreshToken,
    };
  } catch (err) {
    console.error("[KC Messenger] Token refresh error:", err.message);
    return null;
  }
}

/**
 * Get a valid KC access token for a user, refreshing if needed.
 * Updates the stored tokens in the database.
 * @param {object} user - User record with kcAccessToken, kcRefreshToken, kcTokenExpiresAt
 * @returns {Promise<string|null>} valid access token or null
 */
async function getValidToken(user) {
  if (!user.kcAccessToken) return null;

  // Check if token is still valid (with 5min buffer)
  const now = new Date();
  const buffer = 5 * 60 * 1000; // 5 minutes
  const expiresAt = user.kcTokenExpiresAt ? new Date(user.kcTokenExpiresAt) : null;

  if (expiresAt && expiresAt.getTime() - buffer > now.getTime()) {
    return user.kcAccessToken;
  }

  // Token expired or no expiry info — try refreshing
  if (!user.kcRefreshToken) {
    console.warn(`[KC Messenger] No refresh token for user ${user.id}`);
    return null;
  }

  const refreshed = await refreshKcToken(user.kcRefreshToken);
  if (!refreshed) {
    // Clear invalid tokens
    await prisma.user.update({
      where: { id: user.id },
      data: { kcAccessToken: null, kcRefreshToken: null, kcTokenExpiresAt: null },
    });
    return null;
  }

  // Save new tokens
  const newExpiry = new Date(Date.now() + refreshed.expiresInMillis);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      kcAccessToken: refreshed.accessToken,
      kcRefreshToken: refreshed.refreshToken,
      kcTokenExpiresAt: newExpiry,
    },
  });

  return refreshed.accessToken;
}

/**
 * Send a KingsChat notification to a user by their Prime Ops user ID.
 * Automatically handles token refresh.
 * @param {string} userId - Prime Ops user ID
 * @param {string} message - Message to send
 * @returns {Promise<boolean>}
 */
async function sendKcNotification(userId, message) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        kcId: true,
        kcAccessToken: true,
        kcRefreshToken: true,
        kcTokenExpiresAt: true,
      },
    });

    if (!user?.kcId) {
      // User doesn't have KingsChat linked
      return false;
    }

    // We need a sender's token — use any director's token or a service token
    // For now, we use the system approach: find any user with a valid token to send from
    const sender = await getSystemSender();
    if (!sender) {
      console.warn("[KC Messenger] No sender with valid KC token available");
      return false;
    }

    const token = await getValidToken(sender);
    if (!token) {
      console.warn("[KC Messenger] Could not get valid token for sender");
      return false;
    }

    const sent = await sendKcMessage(user.kcId, message, token);

    if (!sent) {
      // Try one more time after force-refresh
      if (sender.kcRefreshToken) {
        const refreshed = await refreshKcToken(sender.kcRefreshToken);
        if (refreshed) {
          await prisma.user.update({
            where: { id: sender.id },
            data: {
              kcAccessToken: refreshed.accessToken,
              kcRefreshToken: refreshed.refreshToken,
              kcTokenExpiresAt: new Date(Date.now() + refreshed.expiresInMillis),
            },
          });
          return await sendKcMessage(user.kcId, message, refreshed.accessToken);
        }
      }
    }

    return sent;
  } catch (err) {
    console.error("[KC Messenger] Error sending notification:", err.message);
    return false;
  }
}

/**
 * Send a KingsChat message directly to a kcId (KingsChat user_id).
 * Used when the member has a kcId but may not have a linked User account.
 * This is the main function for committee appointment notifications.
 *
 * @param {string} recipientKcId - The KingsChat user_id of the recipient
 * @param {string} message - Message to send
 * @returns {Promise<boolean>}
 */
async function sendKcMessageToKcId(recipientKcId, message) {
  try {
    if (!recipientKcId) return false;

    const sender = await getSystemSender();
    if (!sender) {
      console.warn("[KC Messenger] No sender with valid KC token available for direct kcId message");
      return false;
    }

    const token = await getValidToken(sender);
    if (!token) {
      console.warn("[KC Messenger] Could not get valid token for sender");
      return false;
    }

    const sent = await sendKcMessage(recipientKcId, message, token);

    if (!sent && sender.kcRefreshToken) {
      // Retry once with a fresh token
      const refreshed = await refreshKcToken(sender.kcRefreshToken);
      if (refreshed) {
        await prisma.user.update({
          where: { id: sender.id },
          data: {
            kcAccessToken: refreshed.accessToken,
            kcRefreshToken: refreshed.refreshToken,
            kcTokenExpiresAt: new Date(Date.now() + refreshed.expiresInMillis),
          },
        });
        return await sendKcMessage(recipientKcId, message, refreshed.accessToken);
      }
    }

    return sent;
  } catch (err) {
    console.error("[KC Messenger] Error sending direct kcId message:", err.message);
    return false;
  }
}

/**
 * Find the best "system sender" — a director or the first user with valid KC tokens.
 * The app sends notifications as this user's KC account.
 */
async function getSystemSender() {
  // Prefer directors first
  let sender = await prisma.user.findFirst({
    where: {
      role: "director",
      kcAccessToken: { not: null },
      kcId: { not: null },
    },
    select: {
      id: true,
      kcId: true,
      kcAccessToken: true,
      kcRefreshToken: true,
      kcTokenExpiresAt: true,
    },
  });

  if (sender) return sender;

  // Fallback: any user with tokens
  return await prisma.user.findFirst({
    where: {
      kcAccessToken: { not: null },
      kcId: { not: null },
    },
    select: {
      id: true,
      kcId: true,
      kcAccessToken: true,
      kcRefreshToken: true,
      kcTokenExpiresAt: true,
    },
  });
}

/**
 * Send KC messages to all members of a committee.
 * @param {string} committeeId
 * @param {string} message
 * @param {string} [excludeUserId] - optional user to exclude
 */
async function sendKcToCommittee(committeeId, message, excludeUserId) {
  try {
    const members = await prisma.member.findMany({
      where: { committeeId },
      select: { userId: true, kcId: true },
    });

    const sender = await getSystemSender();
    if (!sender) {
      console.warn("[KC Messenger] No sender for committee broadcast");
      return;
    }

    const token = await getValidToken(sender);
    if (!token) return;

    let sentCount = 0;

    for (const m of members) {
      // Try member's direct kcId first, then fall back to user's kcId
      let targetKcId = m.kcId;
      if (!targetKcId && m.userId && m.userId !== excludeUserId) {
        const user = await prisma.user.findUnique({
          where: { id: m.userId },
          select: { kcId: true },
        });
        targetKcId = user?.kcId;
      }

      if (targetKcId) {
        const sent = await sendKcMessage(targetKcId, message, token);
        if (sent) sentCount++;
      }
    }

    if (sentCount > 0) {
      console.log(`[KC Messenger] Sent to ${sentCount}/${members.length} committee members`);
    }
  } catch (err) {
    console.error("[KC Messenger] Error sending to committee:", err.message);
  }
}

/**
 * Send KC messages to all directors.
 * @param {string} message
 */
async function sendKcToDirectors(message) {
  try {
    const directors = await prisma.user.findMany({
      where: { role: "director", kcId: { not: null } },
      select: { id: true },
    });

    let sentCount = 0;
    for (const d of directors) {
      const sent = await sendKcNotification(d.id, message);
      if (sent) sentCount++;
    }

    if (sentCount > 0) {
      console.log(`[KC Messenger] Sent to ${sentCount}/${directors.length} directors`);
    }
  } catch (err) {
    console.error("[KC Messenger] Error sending to directors:", err.message);
  }
}

module.exports = {
  sendKcMessage,
  refreshKcToken,
  getValidToken,
  sendKcNotification,
  sendKcMessageToKcId,
  sendKcToCommittee,
  sendKcToDirectors,
};

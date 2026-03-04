const prisma = require("./db");

const KC_BASE_URL = "https://connect.kingsch.at";
const KC_CLIENT_ID = process.env.KC_CLIENT_ID || "com.kingschat";

// Rate limit: minimum ms between KC API calls
const SEND_DELAY_MS = 1500;
let lastSendTime = 0;

/**
 * Wait to respect rate limits before sending
 */
async function rateLimitWait() {
  const now = Date.now();
  const elapsed = now - lastSendTime;
  if (elapsed < SEND_DELAY_MS) {
    await new Promise((resolve) => setTimeout(resolve, SEND_DELAY_MS - elapsed));
  }
  lastSendTime = Date.now();
}

/**
 * Send a message to a KingsChat user.
 */
async function sendKcMessage(recipientKcId, message, accessToken) {
  try {
    if (!recipientKcId || !accessToken) return false;

    await rateLimitWait();

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

    if (res.status === 401) {
      console.warn("[KC Messenger] Access token expired or invalid");
      return false;
    }

    if (res.status === 429) {
      console.warn("[KC Messenger] Rate limited — will retry after delay");
      await new Promise((resolve) => setTimeout(resolve, 5000));
      lastSendTime = Date.now();
      const retry = await fetch(`${KC_BASE_URL}/api/users/${recipientKcId}/new_message`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: { body: { text: { body: message } } },
        }),
      });
      if (retry.ok) return true;
      const retryBody = await retry.text().catch(() => "");
      console.error(`[KC Messenger] Retry failed (${retry.status}):`, retryBody);
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
 */
async function getValidToken(user) {
  if (!user.kcAccessToken) return null;

  const now = new Date();
  const buffer = 5 * 60 * 1000;
  const expiresAt = user.kcTokenExpiresAt ? new Date(user.kcTokenExpiresAt) : null;

  if (expiresAt && expiresAt.getTime() - buffer > now.getTime()) {
    return user.kcAccessToken;
  }

  if (!user.kcRefreshToken) {
    console.warn(`[KC Messenger] No refresh token for user ${user.id}`);
    return null;
  }

  const refreshed = await refreshKcToken(user.kcRefreshToken);
  if (!refreshed) {
    await prisma.user.update({
      where: { id: user.id },
      data: { kcAccessToken: null, kcRefreshToken: null, kcTokenExpiresAt: null },
    });
    return null;
  }

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
 * Find the best sender — prefer the specified user, then any director, then any user.
 */
async function getSystemSender(preferredUserId) {
  if (preferredUserId) {
    const preferred = await prisma.user.findFirst({
      where: { id: preferredUserId, kcAccessToken: { not: null }, kcId: { not: null } },
      select: { id: true, kcId: true, kcAccessToken: true, kcRefreshToken: true, kcTokenExpiresAt: true },
    });
    if (preferred) return preferred;
  }

  let sender = await prisma.user.findFirst({
    where: { role: "director", kcAccessToken: { not: null }, kcId: { not: null } },
    select: { id: true, kcId: true, kcAccessToken: true, kcRefreshToken: true, kcTokenExpiresAt: true },
  });
  if (sender) return sender;

  return await prisma.user.findFirst({
    where: { kcAccessToken: { not: null }, kcId: { not: null } },
    select: { id: true, kcId: true, kcAccessToken: true, kcRefreshToken: true, kcTokenExpiresAt: true },
  });
}

/**
 * Send a KingsChat notification to a user by their Prime Ops user ID.
 */
async function sendKcNotification(userId, message, senderUserId) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, kcId: true, kcAccessToken: true, kcRefreshToken: true, kcTokenExpiresAt: true },
    });

    if (!user?.kcId) return false;

    const sender = await getSystemSender(senderUserId);
    if (!sender) {
      console.warn("[KC Messenger] No sender with valid KC token available");
      return false;
    }

    // Don't send to yourself
    if (sender.kcId === user.kcId) return false;

    const token = await getValidToken(sender);
    if (!token) {
      console.warn("[KC Messenger] Could not get valid token for sender");
      return false;
    }

    const sent = await sendKcMessage(user.kcId, message, token);

    if (!sent && sender.kcRefreshToken) {
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

    return sent;
  } catch (err) {
    console.error("[KC Messenger] Error sending notification:", err.message);
    return false;
  }
}

/**
 * Send a KingsChat message directly to a kcId.
 */
async function sendKcMessageToKcId(recipientKcId, message, senderUserId) {
  try {
    if (!recipientKcId) return false;

    const sender = await getSystemSender(senderUserId);
    if (!sender) {
      console.warn("[KC Messenger] No sender for direct kcId message");
      return false;
    }

    // Don't send to yourself
    if (sender.kcId === recipientKcId) return false;

    const token = await getValidToken(sender);
    if (!token) {
      console.warn("[KC Messenger] Could not get valid token for sender");
      return false;
    }

    const sent = await sendKcMessage(recipientKcId, message, token);

    if (!sent && sender.kcRefreshToken) {
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
 * Send KC messages to all members of a committee.
 */
async function sendKcToCommittee(committeeId, message, excludeUserId, senderUserId) {
  try {
    const members = await prisma.member.findMany({
      where: { committeeId },
      select: { userId: true, kcId: true },
    });

    const sender = await getSystemSender(senderUserId);
    if (!sender) {
      console.warn("[KC Messenger] No sender for committee broadcast");
      return;
    }

    const token = await getValidToken(sender);
    if (!token) return;

    let sentCount = 0;
    const sentKcIds = new Set();

    for (const m of members) {
      let targetKcId = m.kcId;
      if (!targetKcId && m.userId && m.userId !== excludeUserId) {
        const user = await prisma.user.findUnique({
          where: { id: m.userId },
          select: { kcId: true },
        });
        targetKcId = user?.kcId;
      }

      // Skip: no kcId, already sent, or sending to self
      if (!targetKcId || sentKcIds.has(targetKcId) || targetKcId === sender.kcId) continue;

      sentKcIds.add(targetKcId);
      const sent = await sendKcMessage(targetKcId, message, token);
      if (sent) sentCount++;
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
 */
async function sendKcToDirectors(message, senderUserId) {
  try {
    const directors = await prisma.user.findMany({
      where: { role: "director", kcId: { not: null } },
      select: { id: true, kcId: true },
    });

    const sender = await getSystemSender(senderUserId);
    if (!sender) return;

    let sentCount = 0;
    for (const d of directors) {
      // Don't send to self
      if (d.kcId === sender.kcId) continue;
      const sent = await sendKcNotification(d.id, message, senderUserId);
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

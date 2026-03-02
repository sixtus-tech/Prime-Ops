const express = require("express");
const jwt = require("jsonwebtoken");
const prisma = require("../services/db");
const { generateToken } = require("../middleware/auth");

const router = express.Router();
router.use(express.urlencoded({ extended: true }));
router.all("/kingschat/callback-redirect", (req, res, next) => { console.log("[KC CALLBACK]", req.method, "Body:", JSON.stringify(req.body), "Query:", JSON.stringify(req.query)); next(); });

const KC_API_BASE = "https://connect.kingsch.at/api";
const KC_PROFILE_URL = `${KC_API_BASE}/profile`;
const KC_CLIENT_ID = process.env.KC_CLIENT_ID || "com.kingschat";

// ---------------------------------------------------------------------------
// Helper: fetch KC profile and upsert user
// ---------------------------------------------------------------------------
async function upsertKcUser({ accessToken, refreshToken, expiresInMillis }) {
  const profileRes = await fetch(KC_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!profileRes.ok) {
    throw new Error(`KC profile fetch failed: ${profileRes.status}`);
  }

  const profileData = await profileRes.json();
  const profile = profileData.profile;

  if (!profile?.user?.user_id) {
    throw new Error("KC profile missing user_id");
  }

  const kcUser = profile.user;
  const kcId = String(kcUser.user_id);
  const username = kcUser.username;
  const name = kcUser.name || username;
  const avatarUrl = kcUser.avatar_url || null;
  const email = profile.email?.address || null;

  // Calculate token expiry
  const kcTokenExpiresAt = expiresInMillis
    ? new Date(Date.now() + expiresInMillis)
    : new Date(Date.now() + 3600000);

  // Skip KC token storage - not in schema
  const tokenData = { kcAccessToken: accessToken, kcRefreshToken: refreshToken || null, kcTokenExpiresAt: expiresInMillis ? new Date(Date.now() + expiresInMillis) : new Date(Date.now() + 3600000) };
  // Find existing user by kcId or email
  let user = await prisma.user.findFirst({
    where: { OR: [{ kcId }, ...(email ? [{ email }] : [])] },
  });

  if (user) {
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        kcId,
        kcUsername: username,
        avatarUrl,
        name: user.name || name,
        ...(email && user.email.includes("@kc-") ? { email } : {}),
        ...tokenData,
        lastLoginAt: new Date(),
      },
    });
  } else {
    user = await prisma.user.create({
      data: {
        email: email || `${username}@kc-user.kingschat`,
        name,
        role: "user",
        globalRole: "user",
        kcId,
        kcUsername: username,
        avatarUrl,
        ...tokenData,
      },
    });
  }

  return user;
}

// ---------------------------------------------------------------------------
// Helper: Extract readable strings from protobuf buffer
// ---------------------------------------------------------------------------
function extractStringsFromBuffer(buf) {
  const strings = [];
  let current = "";
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] >= 32 && buf[i] < 127) {
      current += String.fromCharCode(buf[i]);
    } else {
      if (current.length >= 3) strings.push(current.trim());
      current = "";
    }
  }
  if (current.length >= 3) strings.push(current.trim());
  return strings.filter((s) => s.length >= 2);
}

// ---------------------------------------------------------------------------
// Helper: Parse KC user profile from protobuf binary response
// ---------------------------------------------------------------------------
function parseKcUserFromProtobuf(buf, expectedUsername) {
  const strings = extractStringsFromBuffer(buf);
  if (strings.length === 0) return null;

  const kcId = strings.find((s) => /^[0-9a-f]{24}$/.test(s));
  const usernameMatch = strings.find(
    (s) => s.toLowerCase() === expectedUsername.toLowerCase()
  );

  if (!kcId && !usernameMatch) return null;

  let name = null;
  const usernameIdx = strings.indexOf(usernameMatch);
  if (usernameIdx > 0) {
    for (let i = usernameIdx - 1; i >= 0; i--) {
      const candidate = strings[i];
      if (
        candidate !== kcId &&
        !candidate.includes("@") &&
        !candidate.includes("/") &&
        !candidate.includes(".com") &&
        !candidate.includes("http") &&
        !/^[0-9a-f]{24}$/.test(candidate)
      ) {
        name = candidate;
        break;
      }
    }
  }

  const avatar =
    strings.find(
      (s) =>
        s.startsWith("http") &&
        (s.includes("avatar") || s.includes("cloudfront") || s.includes("image"))
    ) || null;

  return {
    kcId: kcId || null,
    username: usernameMatch || expectedUsername,
    name: name || usernameMatch || expectedUsername,
    avatar,
  };
}

// ---------------------------------------------------------------------------
// POST /api/auth/kingschat/lookup — look up a KingsChat user by username
// ---------------------------------------------------------------------------
router.post("/kingschat/lookup", async (req, res) => {
  try {
    const { username } = req.body;
    if (!username || !username.trim()) {
      return res.status(400).json({ error: "Username is required." });
    }

    const cleanUsername = username.trim().replace(/^@/, "");

    // Check local DB first
    const localUser = await prisma.user.findFirst({
      where: { kcUsername: { equals: cleanUsername } },
      select: { id: true, name: true, kcId: true, kcUsername: true, avatarUrl: true, email: true },
    });

    if (localUser) {
      return res.json({
        found: true,
        source: "local",
        profile: {
          kcId: localUser.kcId,
          username: localUser.kcUsername,
          name: localUser.name,
          avatar: localUser.avatarUrl,
          userId: localUser.id,
        },
      });
    }

    // Look up via KC API
    const { getValidToken } = require("../services/kcMessenger");

    const sender = await prisma.user.findFirst({
      where: { kcAccessToken: { not: null }, kcId: { not: null } },
      select: { id: true, kcId: true, kcAccessToken: true, kcRefreshToken: true, kcTokenExpiresAt: true },
    });

    if (!sender) {
      return res.json({
        found: false,
        message: "No KingsChat session available. The member can be added and linked when they log in.",
      });
    }

    const token = await getValidToken(sender);
    if (!token) {
      return res.json({
        found: false,
        message: "KingsChat session expired. The member can be added and linked later.",
      });
    }

    const userUrl = `${KC_API_BASE}/users/${encodeURIComponent(cleanUsername)}`;
    const userRes = await fetch(userUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (userRes.ok) {
      const arrayBuf = await userRes.arrayBuffer();
      const buf = Buffer.from(arrayBuf);

      // Try JSON first
      try {
        const jsonData = JSON.parse(buf.toString("utf-8"));
        const user = jsonData.user || jsonData;
        if (user?.user_id || user?.id) {
          return res.json({
            found: true,
            source: "kingschat",
            profile: {
              kcId: String(user.user_id || user.id),
              username: user.username || cleanUsername,
              name: user.name || user.username || cleanUsername,
              avatar: user.avatar_url || user.avatar || null,
            },
          });
        }
      } catch { /* Not JSON — parse as protobuf */ }

      const parsed = parseKcUserFromProtobuf(buf, cleanUsername);
      if (parsed && (parsed.kcId || parsed.username)) {
        return res.json({
          found: true,
          source: "kingschat",
          profile: parsed,
        });
      }
    }

    res.json({ found: false, message: `Username "${cleanUsername}" not found on KingsChat.` });
  } catch (err) {
    console.error("KC lookup error:", err);
    res.status(500).json({ error: "Failed to look up KingsChat user." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/kingschat/callback — direct API: receives accessToken, returns JWT
// ---------------------------------------------------------------------------
router.post("/kingschat/callback", async (req, res) => {
  try {
    const { accessToken, refreshToken, expiresInMillis } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: "Missing accessToken from KingsChat." });
    }

    const user = await upsertKcUser({ accessToken, refreshToken, expiresInMillis });
    const token = generateToken(user);

    res.json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email,
        role: user.role, kcUsername: user.kcUsername, avatarUrl: user.avatarUrl,
      },
    });
  } catch (err) {
    console.error("KingsChat auth error:", err);
    res.status(500).json({ error: "Authentication failed. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// POST /api/auth/kingschat/sdk-login — from frontend SDK login()
// ---------------------------------------------------------------------------
router.post("/kingschat/sdk-login", async (req, res) => {
  try {
    const { accessToken, refreshToken, expiresInMillis } = req.body;
    if (!accessToken) {
      return res.status(400).json({ error: "Missing accessToken." });
    }

    const user = await upsertKcUser({ accessToken, refreshToken, expiresInMillis });
    const token = generateToken(user);

    // Link any existing member records with this user's email
    if (user.email && !user.email.includes("@kc-")) {
      await prisma.member.updateMany({
        where: { email: user.email, userId: null },
        data: { userId: user.id },
      }).catch(() => {});
    }

    res.json({
      token,
      user: {
        id: user.id, name: user.name, email: user.email,
        role: user.role, kcUsername: user.kcUsername, avatarUrl: user.avatarUrl,
        hasKcMessaging: !!refreshToken,
      },
    });
  } catch (err) {
    console.error("KingsChat SDK login error:", err);
    res.status(500).json({ error: "Authentication failed. Please try again." });
  }
});

// ---------------------------------------------------------------------------
// GET /api/auth/kingschat/config — frontend gets KC config
// ---------------------------------------------------------------------------
router.get("/kingschat/config", (_req, res) => {
  const backendUrl = process.env.BACKEND_URL || "http://localhost:4000";
  res.json({
    clientId: KC_CLIENT_ID,
    authUrl: "https://accounts.kingsch.at/",
    redirectUri: `${backendUrl}/api/auth/kingschat/callback-redirect`,
    scopes: ["profile", "send_chat_message"],
  });
});

// ---------------------------------------------------------------------------
// POST /api/auth/kingschat/callback-redirect — redirect-based flow
// ---------------------------------------------------------------------------
router.post("/kingschat/callback-redirect", async (req, res) => {
  try {
    const accessToken = req.body.accessToken || req.body.access_token;
    if (!accessToken) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return res.redirect(`${frontendUrl}/auth/kingschat?error=no_token`);
    }

    const user = await upsertKcUser({
      accessToken,
      refreshToken: req.body.refreshToken || req.body.refresh_token || null,
      expiresInMillis: req.body.expiresInMillis || req.body.expires_in_millis || null,
    });

    const token = generateToken(user);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(
      `${frontendUrl}/auth/kingschat?token=${token}&name=${encodeURIComponent(user.name)}&role=${user.role}`
    );
  } catch (err) {
    console.error("KingsChat callback-redirect error:", err);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(`${frontendUrl}/auth/kingschat?error=server_error`);
  }
});

module.exports = router;

router.get("/kingschat/callback-redirect", async (req, res) => {
  try {
    const accessToken = req.query.accessToken || req.query.access_token;
    if (!accessToken) {
      const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
      return res.redirect(frontendUrl + "/auth/kingschat?error=no_token");
    }
    const user = await upsertKcUser({
      accessToken,
      refreshToken: req.query.refreshToken || req.query.refresh_token || null,
      expiresInMillis: req.query.expiresInMillis || req.query.expires_in_millis || null,
    });
    const { generateToken } = require("../middleware/auth");
    const token = generateToken(user);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(frontendUrl + "/auth/kingschat?token=" + token + "&name=" + encodeURIComponent(user.name) + "&role=" + user.role);
  } catch (err) {
    console.error("KingsChat GET callback error:", err);
    const frontendUrl = process.env.FRONTEND_URL || "http://localhost:3000";
    res.redirect(frontendUrl + "/auth/kingschat?error=server_error");
  }
});

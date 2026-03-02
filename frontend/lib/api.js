const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

// ─── Simple in-memory cache ────────────────────────────────────────
const cache = new Map();
const CACHE_TTL = 30000; // 30 seconds — serve cached data, refresh in background

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  return { data: entry.data, stale: Date.now() - entry.time > CACHE_TTL };
}

function setCache(key, data) {
  cache.set(key, { data, time: Date.now() });
}

function clearCache(pattern) {
  for (const key of cache.keys()) {
    if (!pattern || key.includes(pattern)) cache.delete(key);
  }
}

// ─── Auth token ────────────────────────────────────────────────────
function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

// ─── Core fetch ────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

// ─── Cached GET — returns cached data instantly, refreshes in background ───
async function cachedGet(path) {
  const cached = getCached(path);

  // Fresh cache — return immediately
  if (cached && !cached.stale) {
    return cached.data;
  }

  // Stale cache — return it now, refresh in background
  if (cached && cached.stale) {
    apiFetch(path).then((fresh) => setCache(path, fresh)).catch(() => {});
    return cached.data;
  }

  // No cache — fetch and cache
  const data = await apiFetch(path);
  setCache(path, data);
  return data;
}

// ─── Mutating fetch (POST/PUT/DELETE) — clears relevant cache ─────
async function mutatingFetch(path, options, invalidate) {
  const data = await apiFetch(path, options);
  if (invalidate) {
    invalidate.forEach((pattern) => clearCache(pattern));
  }
  return data;
}

export const api = {
  // Events (cached reads)
  listEvents: (params) => {
    const q = new URLSearchParams(params).toString();
    return cachedGet(`/events${q ? `?${q}` : ""}`);
  },
  getEvent: (id) => cachedGet(`/events/${id}`),
  createEvent: (data) =>
    mutatingFetch("/events", { method: "POST", body: JSON.stringify(data) }, ["/events"]),
  createEventFromProposal: (data) =>
    mutatingFetch("/events/from-proposal", { method: "POST", body: JSON.stringify(data) }, ["/events"]),
  updateEvent: (id, data) =>
    mutatingFetch(`/events/${id}`, { method: "PUT", body: JSON.stringify(data) }, ["/events"]),
  deleteEvent: (id) =>
    mutatingFetch(`/events/${id}`, { method: "DELETE" }, ["/events"]),

  // Committees (cached reads)
  listCommittees: (eventId) =>
    cachedGet(`/committees${eventId ? `?eventId=${eventId}` : ""}`),
  getCommittee: (id) => cachedGet(`/committees/${id}`),
  createCommittee: (data) =>
    mutatingFetch("/committees", { method: "POST", body: JSON.stringify(data) }, ["/committees", "/events"]),
  updateCommittee: (id, data) =>
    mutatingFetch(`/committees/${id}`, { method: "PUT", body: JSON.stringify(data) }, ["/committees"]),
  deleteCommittee: (id) =>
    mutatingFetch(`/committees/${id}`, { method: "DELETE" }, ["/committees", "/events"]),

  // Members
  addMember: (committeeId, data) =>
    mutatingFetch(`/committees/${committeeId}/members`, {
      method: "POST", body: JSON.stringify(data),
    }, ["/committees"]),
  updateMember: (committeeId, memberId, data) =>
    mutatingFetch(`/committees/${committeeId}/members/${memberId}`, {
      method: "PUT", body: JSON.stringify(data),
    }, ["/committees"]),
  removeMember: (committeeId, memberId) =>
    mutatingFetch(`/committees/${committeeId}/members/${memberId}`, {
      method: "DELETE",
    }, ["/committees"]),

  // Proposals
  listProposals: () => cachedGet("/proposal"),

  // Approvals (cached reads)
  listApprovals: (params) => {
    const q = params ? new URLSearchParams(params).toString() : "";
    return cachedGet(`/approvals${q ? `?${q}` : ""}`);
  },
  getApproval: (id) => cachedGet(`/approvals/${id}`),
  createApproval: (data) =>
    mutatingFetch("/approvals", { method: "POST", body: JSON.stringify(data) }, ["/approvals"]),
  approvalAction: (id, data) =>
    mutatingFetch(`/approvals/${id}/action`, { method: "POST", body: JSON.stringify(data) }, ["/approvals"]),
  deleteApproval: (id) =>
    mutatingFetch(`/approvals/${id}`, { method: "DELETE" }, ["/approvals"]),
  approvalStats: () => cachedGet("/approvals/stats"),

  // Dashboard (cached)
  dashboardStats: () => cachedGet("/dashboard/stats"),
  activityFeed: (limit = 30) => cachedGet(`/dashboard/activity?limit=${limit}`),

  // KingsChat
  lookupKcUser: (username) =>
    apiFetch("/auth/kingschat/lookup", { method: "POST", body: JSON.stringify({ username }) }),

  // Utils
  clearCache,
};

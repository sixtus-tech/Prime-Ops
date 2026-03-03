"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const savedToken = localStorage.getItem("token");
    const savedUser = localStorage.getItem("user");
    if (savedToken && savedUser) {
      setToken(savedToken);
      try { setUser(JSON.parse(savedUser)); } catch { localStorage.removeItem("user"); }
    }
    setLoading(false);
  }, []);
  function saveAuth(data) {
    setToken(data.token);
    setUser(data.user);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user));
  }
  async function register(nameOrObj, emailArg, passwordArg) {
    const name = typeof nameOrObj === "object" ? nameOrObj.name : nameOrObj;
    const email = typeof nameOrObj === "object" ? nameOrObj.email : emailArg;
    const password = typeof nameOrObj === "object" ? nameOrObj.password : passwordArg;
    const res = await fetch(API + "/auth/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, name }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Registration failed");
    saveAuth(data);
    return data;
  }
  async function login(emailOrObj, passwordArg) {
    const email = typeof emailOrObj === "object" ? emailOrObj.email : emailOrObj;
    const password = typeof emailOrObj === "object" ? emailOrObj.password : passwordArg;
    const res = await fetch(API + "/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Login failed");
    saveAuth(data);
    return data;
  }
  async function loginWithKingsChat() {
    var configRes = await fetch(API + "/auth/kingschat/config");
    var config = await configRes.json();
    var kcUrl = "https://accounts.kingsch.at/?client_id=" + encodeURIComponent(config.clientId) + "&scopes=" + encodeURIComponent(JSON.stringify(config.scopes || ["profile"])) + "&post_redirect=true&redirect_uri=" + encodeURIComponent(config.redirectUri);

    // Mobile detection — use full redirect instead of popup
    var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;

    if (isMobile) {
      // Save where to return after login
      localStorage.setItem("kc_login_return", window.location.pathname);
      localStorage.setItem("kc_flow", "redirect");
      localStorage.removeItem("kc_auth_result");
      // Full page redirect — no popup needed
      window.location.href = kcUrl;
      // Return a promise that never resolves (page is navigating away)
      return new Promise(function() {});
    }

    // Desktop — use popup as before
    localStorage.setItem("kc_flow", "popup");
    localStorage.removeItem("kc_auth_result");
    var w = Math.min(Math.floor(window.outerWidth * 0.8), 900);
    var h = Math.min(Math.floor(window.outerHeight * 0.8), 600);
    var left = Math.floor(window.screenX + (window.outerWidth - w) / 2);
    var top = Math.floor(window.screenY + (window.outerHeight - h) / 4);
    var popup = window.open(kcUrl, "kc_auth", "toolbar=0,scrollbars=1,status=1,resizable=1,location=1,menuBar=0,width=" + w + ",height=" + h + ",left=" + left + ",top=" + top);
    if (!popup) throw new Error("Popup blocked");
    return new Promise(function(resolve, reject) {
      var done = false;
      function finish(result) {
        if (done) return;
        done = true;
        clearInterval(poll);
        window.removeEventListener("storage", onStorage);
        localStorage.removeItem("kc_auth_result");
        try { popup.close(); } catch(e) {}
        if (result.error) { reject(new Error(result.error)); return; }
        if (result.token && result.user) { saveAuth(result); resolve(result); return; }
        reject(new Error("KingsChat login failed"));
      }
      function checkLS() {
        var raw = localStorage.getItem("kc_auth_result");
        if (raw) { try { finish(JSON.parse(raw)); } catch(e) { finish({ error: "Bad response" }); } }
      }
      function onStorage(e) {
        if (e.key === "kc_auth_result" && e.newValue) {
          try { finish(JSON.parse(e.newValue)); } catch(e2) { finish({ error: "Bad response" }); }
        }
      }
      window.addEventListener("storage", onStorage);
      var poll = setInterval(checkLS, 300);
      setTimeout(function() { if (!done) finish({ error: "Login timed out (2 min)" }); }, 120000);
    });
  }
  function logout() {
    setUser(null); setToken(null);
    localStorage.removeItem("token"); localStorage.removeItem("user"); localStorage.removeItem("loginType");
  }
  var authFetch = useCallback(async function(path, options) {
    options = options || {};
    var currentToken = token || localStorage.getItem("token");
    if (!currentToken) throw new Error("Not authenticated");
    var url = path.startsWith("http") ? path : API + path;
    var res = await fetch(url, { ...options, headers: { "Content-Type": "application/json", Authorization: "Bearer " + currentToken, ...options.headers } });
    if (res.status === 401) { logout(); throw new Error("Session expired."); }
    if (!res.ok) { var err = await res.json().catch(function() { return {}; }); throw new Error(err.error || "Request failed: " + res.status); }
    return res.json();
  }, [token]);
  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout, loginWithKingsChat, authFetch, isAuthenticated: !!user, isDirector: user?.role === "director", isAdmin: user?.globalRole === "admin" }}>
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  var ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

const MobileContext = createContext({
  isMobile: false,
  sidebarOpen: false,
  setSidebarOpen: () => {},
  toggleSidebar: () => {},
});

export function MobileProvider({ children }) {
  const [isMobile, setIsMobile] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    function check() {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (!mobile) setSidebarOpen(false);
    }
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const toggleSidebar = useCallback(() => setSidebarOpen((v) => !v), []);

  return (
    <MobileContext.Provider value={{ isMobile, sidebarOpen, setSidebarOpen, toggleSidebar }}>
      {children}
    </MobileContext.Provider>
  );
}

export function useMobile() {
  return useContext(MobileContext);
}

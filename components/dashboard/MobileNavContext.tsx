"use client";

import { createContext, useContext } from "react";

const MobileNavContext = createContext<(() => void) | null>(null);

export function MobileNavProvider({
  onNavigate,
  children,
}: {
  onNavigate: () => void;
  children: React.ReactNode;
}) {
  return (
    <MobileNavContext.Provider value={onNavigate}>{children}</MobileNavContext.Provider>
  );
}

export function useCloseMobileNav() {
  return useContext(MobileNavContext);
}

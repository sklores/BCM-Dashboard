"use client";

import { createContext, useContext, type ReactNode } from "react";

export type Role = "owner" | "pm" | "apm" | "super";

const RoleContext = createContext<Role>("owner");

export function RoleProvider({
  children,
  role = "owner",
}: {
  children: ReactNode;
  role?: Role;
}) {
  return <RoleContext.Provider value={role}>{children}</RoleContext.Provider>;
}

export function useRole(): Role {
  return useContext(RoleContext);
}

export function canEdit(role: Role): boolean {
  return role === "owner" || role === "pm";
}

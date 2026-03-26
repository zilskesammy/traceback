// app/(app)/layout.tsx — Layout für alle authentifizierten App-Routen
// Auth-Check wird bereits im middleware.ts abgefangen.

import type { ReactNode } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  return <div className="h-screen flex flex-col overflow-hidden">{children}</div>;
}

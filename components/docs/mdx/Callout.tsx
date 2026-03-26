"use client";
// components/docs/mdx/Callout.tsx — Info/Warning/Danger Callout-Boxen

import type { ReactNode } from "react";

type CalloutType = "info" | "warning" | "danger" | "tip";

const STYLES: Record<CalloutType, { border: string; bg: string; icon: ReactNode; label: string; labelColor: string }> = {
  info: {
    border: "border-blue-500/30",
    bg: "bg-blue-500/5",
    labelColor: "text-blue-400",
    label: "Info",
    icon: (
      <svg className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  tip: {
    border: "border-emerald-500/30",
    bg: "bg-emerald-500/5",
    labelColor: "text-emerald-400",
    label: "Tipp",
    icon: (
      <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  warning: {
    border: "border-amber-500/30",
    bg: "bg-amber-500/5",
    labelColor: "text-amber-400",
    label: "Hinweis",
    icon: (
      <svg className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  danger: {
    border: "border-red-500/30",
    bg: "bg-red-500/5",
    labelColor: "text-red-400",
    label: "Achtung",
    icon: (
      <svg className="w-4 h-4 text-red-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
};

export function Callout({ type = "info", children }: { type?: CalloutType; children: ReactNode }) {
  const style = STYLES[type];
  return (
    <div className={`my-5 flex gap-3 rounded-xl border ${style.border} ${style.bg} px-4 py-3.5`}>
      {style.icon}
      <div className="flex-1 text-sm leading-relaxed text-zinc-300 [&>p]:m-0">
        <span className={`font-semibold ${style.labelColor} mr-1.5`}>{style.label}:</span>
        {children}
      </div>
    </div>
  );
}

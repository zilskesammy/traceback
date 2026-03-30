"use client";
// components/planning/AgentBadge.tsx — compact agent avatar + status dot

export type DelegateStatus = "IDLE" | "WORKING" | "COMPLETED" | "ERROR";

interface AgentBadgeProps {
  agentId: string;
  agentName: string;
  status: DelegateStatus | null;
  size?: "sm" | "md";
}

const STATUS_DOT: Record<DelegateStatus, string> = {
  IDLE:      "bg-zinc-500",
  WORKING:   "bg-amber-400",
  COMPLETED: "bg-emerald-500",
  ERROR:     "bg-red-500",
};

const STATUS_PULSE: Record<DelegateStatus, boolean> = {
  IDLE: false, WORKING: true, COMPLETED: false, ERROR: false,
};

const AGENT_COLOR: Record<string, string> = {
  "claude-code":  "bg-amber-700/30 text-amber-300",
  "devin":        "bg-blue-700/30 text-blue-300",
  "cursor-agent": "bg-violet-700/30 text-violet-300",
};

export function AgentBadge({ agentId, agentName, status, size = "sm" }: AgentBadgeProps) {
  const colorClass = AGENT_COLOR[agentId] ?? "bg-zinc-700/30 text-zinc-300";
  const dotColor = status ? STATUS_DOT[status] : "bg-zinc-500";
  const pulse = status ? STATUS_PULSE[status] : false;
  const initial = agentName[0]?.toUpperCase() ?? "A";
  const sz = size === "sm" ? "w-5 h-5 text-xs" : "w-7 h-7 text-sm";

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="relative inline-flex flex-shrink-0">
        <span
          className={`${sz} rounded-md flex items-center justify-center font-semibold font-mono ${colorClass}`}
        >
          {initial}
        </span>
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-zinc-900 ${dotColor} ${pulse ? "animate-pulse" : ""}`}
        />
      </span>
      {size === "md" && (
        <span className="text-xs text-zinc-400 font-medium">{agentName}</span>
      )}
    </span>
  );
}

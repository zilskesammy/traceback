"use client";
// components/planning/SessionViewer.tsx — Timeline of agent session steps

import { useState, useEffect } from "react";

interface SessionStep {
  id: string;
  sequence: number;
  type: "THINKING" | "REASONING" | "ACTION" | "CODE" | "RESULT" | "ERROR";
  content: string;
  metadata: {
    filesChanged?: string[];
    tokensUsed?: number;
    durationMs?: number;
    toolName?: string;
  };
  agentId: string;
  createdAt: string;
}

const STEP_CONFIG: Record<
  SessionStep["type"],
  { icon: string; color: string; bg: string; label: string }
> = {
  THINKING:  { icon: "🧠", color: "#5e6ad2", bg: "rgba(94,106,210,0.12)",  label: "thinking"  },
  REASONING: { icon: "✦",  color: "#a17cf7", bg: "rgba(161,124,247,0.12)", label: "reasoning" },
  ACTION:    { icon: "⚡",  color: "#f7a135", bg: "rgba(247,161,53,0.12)",  label: "action"    },
  CODE:      { icon: "{ }",color: "#4cce68", bg: "rgba(76,206,104,0.12)",  label: "code"      },
  RESULT:    { icon: "✓",  color: "#d4a27a", bg: "rgba(212,162,122,0.12)", label: "result"    },
  ERROR:     { icon: "✗",  color: "#f76659", bg: "rgba(247,102,89,0.12)",  label: "error"     },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function StepCard({ step }: { step: SessionStep }) {
  const [expanded, setExpanded] = useState(step.type !== "THINKING");
  const cfg = STEP_CONFIG[step.type];
  const isLong = step.content.length > 200;

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div
          className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-mono flex-shrink-0 mt-0.5"
          style={{ background: cfg.bg, color: cfg.color }}
        >
          {cfg.icon}
        </div>
        <div className="w-px flex-1 bg-zinc-800 mt-1" />
      </div>

      <div className="flex-1 pb-4 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span className="text-xs font-mono font-semibold" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
          <span className="text-xs text-zinc-600">#{step.sequence}</span>
          <span className="text-xs text-zinc-600">{formatTime(step.createdAt)}</span>
          {step.metadata?.toolName && (
            <span className="text-xs font-mono bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
              {step.metadata.toolName}
            </span>
          )}
          {step.metadata?.durationMs && (
            <span className="text-xs text-zinc-600">{step.metadata.durationMs}ms</span>
          )}
        </div>

        {step.type === "CODE" ? (
          <pre className="text-xs font-mono bg-zinc-900 border border-zinc-800 rounded-md p-3 text-zinc-300 overflow-x-auto whitespace-pre-wrap leading-relaxed">
            {step.content}
          </pre>
        ) : (
          <div>
            <p
              className={`text-xs text-zinc-400 leading-relaxed ${
                !expanded && isLong ? "line-clamp-3" : ""
              }`}
            >
              {step.content}
            </p>
            {isLong && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-zinc-600 hover:text-zinc-400 mt-1 transition-colors"
              >
                {expanded ? "Show less" : "Show more"}
              </button>
            )}
          </div>
        )}

        {step.metadata?.filesChanged && step.metadata.filesChanged.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {step.metadata.filesChanged.map((f) => (
              <span
                key={f}
                className="text-xs font-mono bg-zinc-800/60 text-zinc-500 px-1.5 py-0.5 rounded"
              >
                {f.split("/").pop()}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface SessionViewerProps {
  taskId: string;
}

export function SessionViewer({ taskId }: SessionViewerProps) {
  const [steps, setSteps] = useState<SessionStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    if (!taskId) return;
    setLoading(true);
    fetch(`/api/tasks/${taskId}/session`)
      .then((r) => r.json())
      .then((data) => setSteps(Array.isArray(data) ? data : []))
      .catch(() => setSteps([]))
      .finally(() => setLoading(false));
  }, [taskId]);

  if (loading) {
    return (
      <div className="py-8 text-center text-xs text-zinc-600">
        Loading session log...
      </div>
    );
  }

  if (steps.length === 0) {
    return (
      <div className="py-8 text-center">
        <p className="text-xs text-zinc-600">No session steps yet.</p>
        <p className="text-xs text-zinc-700 mt-1">Assign an agent and it will log its reasoning here.</p>
      </div>
    );
  }

  const COLLAPSE_AT = 8;
  const visibleSteps = collapsed && steps.length > COLLAPSE_AT ? steps.slice(-3) : steps;

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
          Session Trail — {steps.length} steps
        </span>
        {steps.length > COLLAPSE_AT && (
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="text-xs text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            {collapsed ? `Show all ${steps.length} steps` : "Collapse"}
          </button>
        )}
      </div>

      {collapsed && steps.length > COLLAPSE_AT && (
        <div className="text-xs text-zinc-600 text-center py-2 border border-dashed border-zinc-800 rounded mb-3">
          {steps.length - 3} earlier steps hidden
        </div>
      )}

      <div>
        {visibleSteps.map((step) => (
          <StepCard key={step.id} step={step} />
        ))}
      </div>
    </div>
  );
}

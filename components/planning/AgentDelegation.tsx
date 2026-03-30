"use client";
// components/planning/AgentDelegation.tsx — assign/remove agent delegate

import { useState, useEffect } from "react";
import { AgentBadge } from "./AgentBadge";
import type { DelegateStatus } from "./AgentBadge";

interface Agent {
  id: string;
  name: string;
  provider: string;
  capabilities: string[];
}

interface AgentDelegationProps {
  taskId: string;
  currentDelegateId: string | null;
  currentStatus: DelegateStatus | null;
  onChanged: () => void;
}

export function AgentDelegation({
  taskId,
  currentDelegateId,
  currentStatus,
  onChanged,
}: AgentDelegationProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/agents")
      .then((r) => r.json())
      .then((data) => setAgents(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const currentAgent = agents.find((a) => a.id === currentDelegateId);

  async function assign(agentId: string) {
    setLoading(true);
    setOpen(false);
    try {
      await fetch(`/api/tasks/${taskId}/delegate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId }),
      });
      onChanged();
    } finally {
      setLoading(false);
    }
  }

  async function remove() {
    setLoading(true);
    setOpen(false);
    try {
      await fetch(`/api/tasks/${taskId}/delegate`, { method: "DELETE" });
      onChanged();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-zinc-500 font-medium w-12 flex-shrink-0">Agent</span>

        {currentAgent ? (
          <>
            <AgentBadge
              agentId={currentAgent.id}
              agentName={currentAgent.name}
              status={currentStatus}
              size="md"
            />
            {currentStatus && (
              <span className="text-xs text-zinc-600 capitalize">
                {currentStatus.toLowerCase()}
              </span>
            )}
          </>
        ) : (
          <span className="text-xs text-zinc-600">Unassigned</span>
        )}

        <button
          onClick={() => setOpen(!open)}
          disabled={loading}
          className="text-xs text-zinc-600 hover:text-zinc-300 px-2 py-0.5 rounded border border-zinc-800 hover:border-zinc-700 transition-colors disabled:opacity-50 ml-auto"
        >
          {loading ? "..." : currentAgent ? "Change" : "Assign"}
        </button>

        {currentAgent && !loading && (
          <button
            onClick={remove}
            className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
          >
            Remove
          </button>
        )}
      </div>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-50 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-64 overflow-hidden">
            {agents.length === 0 && (
              <div className="px-3 py-4 text-xs text-zinc-500 text-center">
                No agents available
              </div>
            )}
            {agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => assign(agent.id)}
                className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-zinc-800 transition-colors text-left border-b border-zinc-800 last:border-0"
              >
                <AgentBadge agentId={agent.id} agentName={agent.name} status={null} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-zinc-200">{agent.name}</div>
                  <div className="text-xs text-zinc-500">{agent.provider}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {agent.capabilities.slice(0, 3).map((c) => (
                      <span key={c} className="text-xs bg-zinc-800 text-zinc-500 px-1.5 rounded">
                        {c}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

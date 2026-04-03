"use client";
// components/changelog/TaskPanel.tsx

import { useState, useRef, useEffect } from "react";
import { SendHorizontal, Loader2, CheckCircle, XCircle, Bot } from "lucide-react";

interface Chunk {
  id: string;
  content: string;
  chunkType: string;
}

interface Message {
  role: "user" | "agent";
  taskId?: string;
  text?: string;
  chunks?: Chunk[];
  status?: "running" | "done" | "error";
}

export function TaskPanel({
  projectId,
  agentOnline: initialAgentOnline,
}: {
  projectId: string;
  agentOnline: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [agentOnline, setAgentOnline] = useState(initialAgentOnline);
  const sendingRef = useRef(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll agent status every 5s
  useEffect(() => {
    async function checkStatus() {
      try {
        const res = await fetch(`/api/agent-tunnel/status?projectId=${projectId}`);
        if (res.ok) {
          const data = await res.json();
          setAgentOnline(data.online);
        }
      } catch {
        setAgentOnline(false);
      }
    }
    checkStatus();
    const id = setInterval(checkStatus, 5_000);
    return () => clearInterval(id);
  }, [projectId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function sendTask() {
    const prompt = input.trim();
    if (!prompt || sendingRef.current) return;
    sendingRef.current = true;

    setInput("");
    setSending(true);

    // Add user message
    setMessages((prev) => [...prev, { role: "user", text: prompt }]);

    // Create task
    const res = await fetch("/api/agent-tunnel/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId, prompt }),
    });
    if (!res.ok) {
      setMessages((prev) => [
        ...prev,
        { role: "agent", chunks: [], status: "error" },
      ]);
      sendingRef.current = false;
      setSending(false);
      return;
    }
    const task = await res.json();
    const taskId: string = task.id;

    // Add agent placeholder
    setMessages((prev) => [
      ...prev,
      { role: "agent", taskId, chunks: [], status: "running" },
    ]);

    sendingRef.current = false;
    setSending(false);

    // Start polling for chunks
    let lastId: string | null = null;
    pollRef.current = setInterval(async () => {
      const url = `/api/agent-tunnel/chunks?taskId=${taskId}${lastId ? `&after=${lastId}` : ""}`;
      const r = await fetch(url);
      const data = await r.json();

      if (data.chunks?.length > 0) {
        lastId = data.chunks[data.chunks.length - 1].id;
        setMessages((prev) =>
          prev.map((m) =>
            m.taskId === taskId
              ? { ...m, chunks: [...(m.chunks ?? []), ...data.chunks] }
              : m
          )
        );
      }

      if (data.taskStatus === "done" || data.taskStatus === "error") {
        setMessages((prev) =>
          prev.map((m) =>
            m.taskId === taskId
              ? { ...m, status: data.taskStatus }
              : m
          )
        );
        stopPolling();
      }
    }, 1000);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendTask();
    }
  }

  return (
    <div className="flex flex-col h-full border-l border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 w-72 flex-shrink-0">
      {/* Header */}
      <div className="flex-shrink-0 h-10 flex items-center justify-between px-3 border-b border-gray-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-indigo-500" />
          <span className="text-xs font-semibold text-gray-900 dark:text-slate-100">Task Creator</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
              agentOnline ? "bg-emerald-500" : "bg-gray-300 dark:bg-slate-600"
            }`}
          />
          <span className="text-[10px] text-gray-400 dark:text-slate-500">
            {agentOnline ? "online" : "offline"}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center gap-2 py-8">
            <Bot className="w-8 h-8 text-gray-200 dark:text-slate-700" />
            <p className="text-xs text-gray-400 dark:text-slate-500">
              {agentOnline
                ? "Beschreibe eine Aufgabe für den Agent."
                : "Starte den lokalen Agent mit:\nnpx traceback-agent"}
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i}>
            {msg.role === "user" && (
              <div className="flex justify-end">
                <div className="max-w-[85%] bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900 rounded-xl px-3 py-2 text-xs text-indigo-900 dark:text-indigo-200">
                  {msg.text}
                </div>
              </div>
            )}

            {msg.role === "agent" && (
              <div className="space-y-1">
                {(msg.chunks ?? []).map((chunk) => (
                  <div
                    key={chunk.id}
                    className={`text-xs font-mono rounded-lg px-3 py-1.5 ${
                      chunk.chunkType === "tool_use"
                        ? "bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border border-amber-100 dark:border-amber-900/50"
                        : chunk.chunkType === "tool_result"
                        ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-300 border border-emerald-100 dark:border-emerald-900/50"
                        : "bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-slate-300 border border-gray-100 dark:border-slate-700"
                    }`}
                  >
                    {chunk.content}
                  </div>
                ))}

                {msg.status === "running" && (
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-400 dark:text-slate-500 px-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    läuft…
                  </div>
                )}
                {msg.status === "done" && (
                  <div className="flex items-center gap-1.5 text-[10px] text-emerald-600 dark:text-emerald-400 px-1">
                    <CheckCircle className="w-3 h-3" />
                    Abgeschlossen
                  </div>
                )}
                {msg.status === "error" && (
                  <div className="flex items-center gap-1.5 text-[10px] text-red-500 dark:text-red-400 px-1">
                    <XCircle className="w-3 h-3" />
                    Fehler
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex-shrink-0 p-2 border-t border-gray-200 dark:border-slate-800">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={agentOnline ? "Aufgabe beschreiben…" : "Agent offline"}
            disabled={!agentOnline || sending}
            rows={2}
            className="flex-1 resize-none bg-gray-50 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg px-3 py-2 text-xs text-gray-900 dark:text-slate-100 placeholder-gray-400 dark:placeholder-slate-500 outline-none focus:border-indigo-400 dark:focus:border-indigo-600 disabled:opacity-50 transition-colors"
          />
          <button
            onClick={sendTask}
            disabled={!agentOnline || !input.trim() || sending}
            className="mb-0.5 flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <SendHorizontal className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
        <p className="mt-1 text-[10px] text-gray-300 dark:text-slate-600 px-1">
          claude-sonnet-4-6 · ↵ senden
        </p>
      </div>
    </div>
  );
}

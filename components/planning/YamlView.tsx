"use client";
// components/planning/YamlView.tsx — Machine-readable YAML Ansicht aller Features
// Schlüssel: blau | Werte: standard | null: gelb | Dateipfade: grün

import { useState } from "react";
import type { PlanningFeature, PlanningTask } from "@/types/planning";

// ─── YAML SYNTAX RENDERER ────────────────────────────────────────────────────

// Rendert eine YAML-Zeile mit Syntax-Highlighting als JSX
function YamlLine({
  indent,
  keyName,
  value,
}: {
  indent: number;
  keyName?: string;
  value?: string | null;
}) {
  const pad = "  ".repeat(indent);
  return (
    <div className="leading-5">
      <span className="text-zinc-600">{pad}</span>
      {keyName !== undefined && (
        <span className="text-blue-400">{keyName}:</span>
      )}
      {value !== undefined && value !== null && (
        <span className="text-zinc-300"> {value}</span>
      )}
      {value === null && <span className="text-amber-400"> null</span>}
    </div>
  );
}

function YamlString({ indent, keyName, value }: { indent: number; keyName: string; value: string | null }) {
  const pad = "  ".repeat(indent);
  if (value === null) {
    return (
      <div className="leading-5">
        <span className="text-zinc-600">{pad}</span>
        <span className="text-blue-400">{keyName}:</span>
        <span className="text-amber-400"> null</span>
      </div>
    );
  }
  return (
    <div className="leading-5">
      <span className="text-zinc-600">{pad}</span>
      <span className="text-blue-400">{keyName}:</span>
      <span className="text-zinc-300"> &quot;{value}&quot;</span>
    </div>
  );
}

function YamlStatus({ indent, value }: { indent: number; value: string }) {
  const COLOR: Record<string, string> = {
    BACKLOG: "text-zinc-400",
    TODO: "text-blue-300",
    IN_PROGRESS: "text-amber-300",
    IN_REVIEW: "text-violet-300",
    DONE: "text-emerald-400",
    CANCELLED: "text-red-400",
  };
  const pad = "  ".repeat(indent);
  return (
    <div className="leading-5">
      <span className="text-zinc-600">{pad}</span>
      <span className="text-blue-400">status:</span>
      <span className={` ${COLOR[value] ?? "text-zinc-300"}`}> {value}</span>
    </div>
  );
}

function YamlFileList({ indent, keyName, files }: { indent: number; keyName: string; files: string[] }) {
  const pad = "  ".repeat(indent);
  const itemPad = "  ".repeat(indent + 1);
  if (files.length === 0) {
    return (
      <div className="leading-5">
        <span className="text-zinc-600">{pad}</span>
        <span className="text-blue-400">{keyName}:</span>
        <span className="text-zinc-500"> []</span>
      </div>
    );
  }
  return (
    <>
      <div className="leading-5">
        <span className="text-zinc-600">{pad}</span>
        <span className="text-blue-400">{keyName}:</span>
      </div>
      {files.map((f, i) => (
        <div key={i} className="leading-5">
          <span className="text-zinc-600">{itemPad}</span>
          <span className="text-zinc-500">- </span>
          <span className="text-emerald-400">{f}</span>
        </div>
      ))}
    </>
  );
}

// ─── TASK YAML BLOCK ─────────────────────────────────────────────────────────

function TaskYaml({ task, indent }: { task: PlanningTask; indent: number }) {
  const pad = "  ".repeat(indent);
  return (
    <>
      <div className="leading-5">
        <span className="text-zinc-600">{pad}</span>
        <span className="text-zinc-500">- </span>
        <span className="text-blue-400">id:</span>
        <span className="text-zinc-400"> {task.id}</span>
      </div>
      <YamlString indent={indent + 1} keyName="title" value={task.title} />
      <YamlStatus indent={indent + 1} value={task.status} />
      <YamlString indent={indent + 1} keyName="assignee" value={task.assignee} />
      <YamlFileList indent={indent + 1} keyName="contextFiles" files={task.contextFiles} />
      <YamlFileList indent={indent + 1} keyName="changedFiles" files={task.changedFiles} />
      <div className="leading-5">
        <span className="text-zinc-600">{"  ".repeat(indent + 1)}</span>
        <span className="text-blue-400">diffRef:</span>
        {task.diffRef ? (
          <span className="text-zinc-400 font-mono"> {task.diffRef.slice(0, 7)}</span>
        ) : (
          <span className="text-amber-400"> null</span>
        )}
      </div>
    </>
  );
}

// ─── FEATURE YAML BLOCK ──────────────────────────────────────────────────────

function FeatureYamlBlock({
  feature,
}: {
  feature: PlanningFeature;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = buildYamlText(feature);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API nicht verfügbar (z.B. unsicheres Kontexte)
    }
  };

  return (
    <div className="bg-zinc-950 border border-[0.5px] border-zinc-800 rounded-xl overflow-hidden">
      {/* Block Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[0.5px] border-zinc-800 bg-zinc-900/60">
        <span className="text-xs font-mono text-zinc-400">{feature.id}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition-colors px-2 py-1 rounded hover:bg-zinc-800"
        >
          {copied ? (
            <>
              <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-emerald-400">Kopiert</span>
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Kopieren
            </>
          )}
        </button>
      </div>

      {/* YAML Content */}
      <div className="p-4 text-[11px] font-mono overflow-x-auto">
        <YamlLine indent={0} keyName="id" value={feature.id} />
        <YamlString indent={0} keyName="title" value={feature.title} />
        <YamlStatus indent={0} value={feature.status} />
        <YamlString indent={0} keyName="assignee" value={feature.assignee} />
        <YamlString indent={0} keyName="description" value={feature.description} />
        <YamlFileList indent={0} keyName="contextFiles" files={feature.contextFiles} />
        <YamlFileList indent={0} keyName="changedFiles" files={feature.changedFiles} />

        {/* diffRef */}
        <div className="leading-5">
          <span className="text-blue-400">diffRef:</span>
          {feature.diffRef ? (
            <span className="text-zinc-400 font-mono"> {feature.diffRef.slice(0, 7)}</span>
          ) : (
            <span className="text-amber-400"> null</span>
          )}
        </div>

        <YamlString indent={0} keyName="changedBy" value={feature.changedBy} />
        <YamlString indent={0} keyName="changedAt" value={feature.changedAt} />

        {/* Tasks */}
        {feature.tasks.length > 0 ? (
          <>
            <div className="leading-5 mt-1">
              <span className="text-blue-400">tasks:</span>
            </div>
            {feature.tasks.map((task) => (
              <TaskYaml key={task.id} task={task} indent={1} />
            ))}
          </>
        ) : (
          <div className="leading-5">
            <span className="text-blue-400">tasks:</span>
            <span className="text-zinc-500"> []</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── YAML TEXT BUILDER (für Copy) ────────────────────────────────────────────

function buildYamlText(feature: PlanningFeature): string {
  const lines: string[] = [
    `id: ${feature.id}`,
    `title: "${feature.title}"`,
    `status: ${feature.status}`,
    `assignee: ${feature.assignee ?? "null"}`,
    `description: ${feature.description ? `"${feature.description}"` : "null"}`,
    `contextFiles:`,
    ...feature.contextFiles.map((f) => `  - ${f}`),
    `changedFiles:`,
    ...feature.changedFiles.map((f) => `  - ${f}`),
    `diffRef: ${feature.diffRef?.slice(0, 7) ?? "null"}`,
    `changedBy: ${feature.changedBy ?? "null"}`,
    `changedAt: ${feature.changedAt ?? "null"}`,
    `tasks:`,
    ...feature.tasks.flatMap((t) => [
      `  - id: ${t.id}`,
      `    title: "${t.title}"`,
      `    status: ${t.status}`,
      `    assignee: ${t.assignee ?? "null"}`,
      `    diffRef: ${t.diffRef?.slice(0, 7) ?? "null"}`,
    ]),
  ];
  return lines.join("\n");
}

// ─── YAML VIEW ────────────────────────────────────────────────────────────────

export function YamlView({
  features,
  epicTitle,
}: {
  features: PlanningFeature[];
  epicTitle: string;
}) {
  if (features.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-zinc-500">Keine Features in &quot;{epicTitle}&quot;</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 dark:text-zinc-600 mb-4">
        Machine View — {features.length} Features
      </p>
      {features.map((feature) => (
        <FeatureYamlBlock key={feature.id} feature={feature} />
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";

const TABS = ["Architecture", "MCP Tools", "Data Model", "Session Log Schema", "Setup & Flow", "Implementation"];

// ── Architecture Data ────────────────────────────────────────────────
const MCP_TOOLS = [
  {
    name: "traceback_list_tickets",
    category: "read",
    description: "List tickets from a project, optionally filtered by status, priority, assignee, or label.",
    params: [
      { name: "project_id", type: "string", required: true, desc: "Project identifier" },
      { name: "status", type: "string?", required: false, desc: "Filter: backlog | todo | in_progress | in_review | done | cancelled" },
      { name: "priority", type: "number?", required: false, desc: "Filter: 0-4 (0=none, 1=urgent, 4=low)" },
      { name: "assignee_id", type: "string?", required: false, desc: "Filter by human assignee" },
      { name: "delegate_id", type: "string?", required: false, desc: "Filter by agent delegate" },
      { name: "label", type: "string?", required: false, desc: "Filter by label slug" },
      { name: "limit", type: "number?", required: false, desc: "Max results (default 50)" },
    ],
    returns: "Array of ticket summaries with id, title, status, priority, assignee, delegate, labels, created_at",
    example: `// Claude Code asks: "What urgent tickets need work?"
→ traceback_list_tickets({ project_id: "trb", priority: 1, status: "todo" })
→ [{ id: "TRB-103", title: "Fix ticket ordering...", priority: 1, delegate: null }]`,
  },
  {
    name: "traceback_get_ticket",
    category: "read",
    description: "Get full ticket detail including description, comments, linked PRs, and agent session history.",
    params: [
      { name: "ticket_id", type: "string", required: true, desc: "Ticket identifier (e.g. TRB-103)" },
      { name: "include_session", type: "boolean?", required: false, desc: "Include agent session log (default true)" },
    ],
    returns: "Full ticket object with description, comments[], linked_prs[], session_log[], metadata",
    example: `// Claude Code starts working on a ticket
→ traceback_get_ticket({ ticket_id: "TRB-103", include_session: true })
→ { id: "TRB-103", title: "...", description: "...", session_log: [...] }`,
  },
  {
    name: "traceback_update_ticket",
    category: "write",
    description: "Update ticket fields: status, priority, assignee, labels, or description.",
    params: [
      { name: "ticket_id", type: "string", required: true, desc: "Ticket identifier" },
      { name: "status", type: "string?", required: false, desc: "New status" },
      { name: "priority", type: "number?", required: false, desc: "New priority" },
      { name: "assignee_id", type: "string?", required: false, desc: "New assignee" },
      { name: "delegate_id", type: "string?", required: false, desc: "Assign/remove agent delegate" },
      { name: "labels", type: "string[]?", required: false, desc: "Replace labels" },
      { name: "description", type: "string?", required: false, desc: "Updated description (markdown)" },
    ],
    returns: "Updated ticket object",
    example: `// Agent picks up a ticket
→ traceback_update_ticket({ ticket_id: "TRB-103", status: "in_progress", delegate_id: "claude-code" })`,
  },
  {
    name: "traceback_log_session_step",
    category: "write",
    description: "Append a reasoning/action step to a ticket's agent session log. This is the core traceability function — every decision, search, code change, and result gets logged here.",
    params: [
      { name: "ticket_id", type: "string", required: true, desc: "Ticket this step belongs to" },
      { name: "type", type: "string", required: true, desc: "thinking | reasoning | action | code | result | error" },
      { name: "content", type: "string", required: true, desc: "What happened — the actual reasoning, command, code, or result" },
      { name: "metadata", type: "object?", required: false, desc: "Optional structured data: { files_changed, tokens_used, duration_ms, tool_name }" },
    ],
    returns: "Created session step with id, timestamp, sequence number",
    example: `// Agent logs its reasoning before making a change
→ traceback_log_session_step({
    ticket_id: "TRB-103",
    type: "reasoning",
    content: "Found no existing DnD library. Evaluating @dnd-kit vs pragmatic-drag-and-drop...",
    metadata: { tool_name: "codebase_search", duration_ms: 1200 }
  })`,
  },
  {
    name: "traceback_get_session",
    category: "read",
    description: "Get the full session log for a ticket — the complete reasoning trail from start to finish.",
    params: [
      { name: "ticket_id", type: "string", required: true, desc: "Ticket identifier" },
      { name: "types", type: "string[]?", required: false, desc: "Filter by step types (e.g. ['reasoning', 'code'])" },
      { name: "since", type: "string?", required: false, desc: "ISO timestamp — only steps after this time" },
    ],
    returns: "Ordered array of session steps with type, content, metadata, timestamp",
    example: `// Human reviews what the agent did
→ traceback_get_session({ ticket_id: "TRB-103", types: ["reasoning", "result"] })`,
  },
  {
    name: "traceback_create_ticket",
    category: "write",
    description: "Create a new ticket in a project.",
    params: [
      { name: "project_id", type: "string", required: true, desc: "Project identifier" },
      { name: "title", type: "string", required: true, desc: "Ticket title" },
      { name: "description", type: "string?", required: false, desc: "Markdown description" },
      { name: "status", type: "string?", required: false, desc: "Initial status (default: todo)" },
      { name: "priority", type: "number?", required: false, desc: "Priority level 0-4" },
      { name: "assignee_id", type: "string?", required: false, desc: "Human assignee" },
      { name: "delegate_id", type: "string?", required: false, desc: "Agent delegate" },
      { name: "labels", type: "string[]?", required: false, desc: "Label slugs" },
    ],
    returns: "Created ticket object with generated ID",
    example: `// Agent discovers a bug while working and creates a follow-up ticket
→ traceback_create_ticket({
    project_id: "trb",
    title: "Race condition in drag reorder when multiple users edit simultaneously",
    priority: 2, labels: ["bug"],
    description: "Discovered while implementing TRB-103. Two concurrent reorders can corrupt position field."
  })`,
  },
  {
    name: "traceback_link_pr",
    category: "write",
    description: "Link a pull request or branch to a ticket.",
    params: [
      { name: "ticket_id", type: "string", required: true, desc: "Ticket identifier" },
      { name: "url", type: "string", required: true, desc: "PR or branch URL" },
      { name: "type", type: "string?", required: false, desc: "pr | branch | commit (default: pr)" },
      { name: "title", type: "string?", required: false, desc: "Display title for the link" },
    ],
    returns: "Link object with id",
    example: `// Agent finishes and links its PR
→ traceback_link_pr({
    ticket_id: "TRB-103",
    url: "https://github.com/traceback/app/pull/47",
    title: "fix: ticket ordering with stable sort"
  })`,
  },
  {
    name: "traceback_add_comment",
    category: "write",
    description: "Add a comment to a ticket — from human or agent.",
    params: [
      { name: "ticket_id", type: "string", required: true, desc: "Ticket identifier" },
      { name: "content", type: "string", required: true, desc: "Comment body (markdown)" },
      { name: "author_type", type: "string?", required: false, desc: "human | agent (auto-detected if omitted)" },
    ],
    returns: "Comment object with id, timestamp, author",
    example: `// Agent leaves a summary after completing work
→ traceback_add_comment({
    ticket_id: "TRB-103",
    content: "Fixed ordering with stable sort. Root cause: Array.sort is not stable in V8 < 70. Added explicit position comparison as tiebreaker. See PR #47."
  })`,
  },
];

const DATA_MODEL = [
  {
    name: "Ticket",
    fields: [
      { name: "id", type: "string", desc: "Auto-generated (TRB-XXX)" },
      { name: "project_id", type: "string", desc: "FK to Project" },
      { name: "title", type: "string", desc: "Ticket title" },
      { name: "description", type: "text", desc: "Markdown body" },
      { name: "status", type: "enum", desc: "backlog | todo | in_progress | in_review | done | cancelled" },
      { name: "priority", type: "int", desc: "0=none, 1=urgent, 2=high, 3=medium, 4=low" },
      { name: "assignee_id", type: "string?", desc: "FK to Member (human owner)" },
      { name: "delegate_id", type: "string?", desc: "FK to Agent (AI contributor)" },
      { name: "delegate_status", type: "enum?", desc: "idle | working | completed | error" },
      { name: "labels", type: "string[]", desc: "Array of label slugs" },
      { name: "position", type: "float", desc: "Sort order within status group" },
      { name: "created_at", type: "timestamp", desc: "Creation time" },
      { name: "updated_at", type: "timestamp", desc: "Last modification" },
    ],
  },
  {
    name: "SessionStep",
    fields: [
      { name: "id", type: "string", desc: "UUID" },
      { name: "ticket_id", type: "string", desc: "FK to Ticket" },
      { name: "agent_id", type: "string", desc: "Which agent produced this step" },
      { name: "sequence", type: "int", desc: "Ordering within session (auto-increment)" },
      { name: "type", type: "enum", desc: "thinking | reasoning | action | code | result | error" },
      { name: "content", type: "text", desc: "The actual reasoning/action/code content" },
      { name: "metadata", type: "jsonb", desc: "{ files_changed, tokens_used, duration_ms, tool_name, model }" },
      { name: "timestamp", type: "timestamp", desc: "When this step occurred" },
    ],
  },
  {
    name: "Agent",
    fields: [
      { name: "id", type: "string", desc: "Unique agent identifier (e.g. claude-code)" },
      { name: "name", type: "string", desc: "Display name" },
      { name: "provider", type: "string", desc: "Anthropic | Cognition | Anysphere | ..." },
      { name: "model", type: "string", desc: "Model identifier" },
      { name: "capabilities", type: "string[]", desc: "What this agent can do" },
      { name: "avatar_url", type: "string?", desc: "Avatar image" },
      { name: "guidance", type: "text?", desc: "Standing instructions for this agent (workspace-level)" },
    ],
  },
  {
    name: "LinkedPR",
    fields: [
      { name: "id", type: "string", desc: "UUID" },
      { name: "ticket_id", type: "string", desc: "FK to Ticket" },
      { name: "url", type: "string", desc: "PR / branch / commit URL" },
      { name: "type", type: "enum", desc: "pr | branch | commit" },
      { name: "title", type: "string?", desc: "Display title" },
      { name: "status", type: "enum?", desc: "open | merged | closed" },
      { name: "created_at", type: "timestamp", desc: "When linked" },
    ],
  },
];

const SESSION_STEP_TYPES = [
  { type: "thinking", color: "#5e6ad2", icon: "🧠", desc: "Internal reasoning before acting. 'What approach should I take?'" },
  { type: "reasoning", color: "#a17cf7", icon: "✦", desc: "Evaluating options, comparing tradeoffs. 'Library A vs B because...'" },
  { type: "action", color: "#f7a135", icon: "⚡", desc: "Executing a command: search, install, run tests, API call." },
  { type: "code", color: "#4cce68", icon: "{ }", desc: "Writing or modifying code. File path + diff or content." },
  { type: "result", color: "#d4a27a", icon: "✓", desc: "Outcome of work: tests passing, PR created, summary." },
  { type: "error", color: "#f76659", icon: "✗", desc: "Something failed: test failure, build error, API timeout." },
];

// ── Styles ──────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap');
  .mcp-doc *, .mcp-doc *::before, .mcp-doc *::after { box-sizing: border-box; }
  .mcp-doc {
    --bg: #08080c;
    --surface: #0e0e14;
    --elevated: #14141c;
    --hover: #1a1a26;
    --active: #222234;
    --border: #1e1e32;
    --border-s: #161628;
    --t1: #e4e4ef;
    --t2: #8888a4;
    --t3: #55556a;
    --accent: #5e6ad2;
    --accent2: #6e7bef;
    --agent: #d4a27a;
    --agent-g: rgba(212,162,122,0.1);
    --green: #4cce68;
    --orange: #f7a135;
    --red: #f76659;
    --purple: #a17cf7;
    --font: 'DM Sans', sans-serif;
    --mono: 'JetBrains Mono', monospace;
    --r: 8px;
    font-family: var(--font);
    background: var(--bg);
    color: var(--t1);
    min-height: 100vh;
  }

  .mcp-doc .doc { max-width: 960px; margin: 0 auto; padding: 32px 20px 80px; }

  .mcp-doc .doc-header { margin-bottom: 40px; padding-bottom: 32px; border-bottom: 1px solid var(--border); }
  .mcp-doc .doc-logo { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .mcp-doc .doc-logo-mark { width: 36px; height: 36px; border-radius: 8px; background: linear-gradient(135deg, var(--agent), #e8c4a0); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 16px; color: #0e0e14; }
  .mcp-doc .doc-logo-text { font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
  .mcp-doc .doc-logo-text span { color: var(--agent); }
  .mcp-doc .doc-subtitle { font-size: 14px; color: var(--t2); line-height: 1.6; max-width: 640px; }

  .mcp-doc .tabs { display: flex; gap: 2px; margin-bottom: 32px; overflow-x: auto; border-bottom: 1px solid var(--border); padding-bottom: 0; }
  .mcp-doc .tab { padding: 8px 16px; font-size: 13px; font-weight: 500; color: var(--t3); cursor: pointer; border-bottom: 2px solid transparent; transition: all 0.12s; white-space: nowrap; font-family: var(--font); background: none; border-top: none; border-left: none; border-right: none; }
  .mcp-doc .tab:hover { color: var(--t2); }
  .mcp-doc .tab.on { color: var(--t1); border-bottom-color: var(--accent); }

  .mcp-doc .section { margin-bottom: 36px; animation: mcpFadeUp 0.25s ease; }
  @keyframes mcpFadeUp { from { opacity: 0; transform: translateY(8px); } }
  .mcp-doc .section h2 { font-size: 17px; font-weight: 700; margin-bottom: 6px; letter-spacing: -0.3px; }
  .mcp-doc .section h3 { font-size: 14px; font-weight: 600; margin-bottom: 4px; color: var(--t2); }
  .mcp-doc .section p { font-size: 13.5px; color: var(--t2); line-height: 1.6; margin-bottom: 14px; }

  .mcp-doc .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 16px 18px; margin-bottom: 10px; }
  .mcp-doc .card-agent { border-color: rgba(212,162,122,0.2); background: linear-gradient(135deg, var(--surface), rgba(212,162,122,0.03)); }

  .mcp-doc .tool-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); margin-bottom: 12px; overflow: hidden; transition: border-color 0.12s; }
  .mcp-doc .tool-card:hover { border-color: #2a2a44; }
  .mcp-doc .tool-head { display: flex; align-items: center; gap: 10px; padding: 12px 16px; cursor: pointer; }
  .mcp-doc .tool-name { font-family: var(--mono); font-size: 13px; font-weight: 600; color: var(--agent); }
  .mcp-doc .tool-cat { font-size: 10px; font-family: var(--mono); padding: 2px 7px; border-radius: 8px; }
  .mcp-doc .tool-cat.read { background: rgba(94,106,210,0.12); color: var(--accent2); }
  .mcp-doc .tool-cat.write { background: var(--agent-g); color: var(--agent); }
  .mcp-doc .tool-desc { font-size: 12.5px; color: var(--t2); flex: 1; margin-left: 8px; }
  .mcp-doc .tool-chevron { color: var(--t3); transition: transform 0.15s; font-size: 14px; }
  .mcp-doc .tool-chevron.open { transform: rotate(90deg); }
  .mcp-doc .tool-body { padding: 0 16px 16px; border-top: 1px solid var(--border-s); }
  .mcp-doc .tool-params { margin-top: 12px; }
  .mcp-doc .param-row { display: grid; grid-template-columns: 160px 80px 1fr; gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--border-s); font-size: 12px; align-items: baseline; }
  .mcp-doc .param-row:last-child { border-bottom: none; }
  .mcp-doc .param-name { font-family: var(--mono); color: var(--t1); font-weight: 500; }
  .mcp-doc .param-name .req { color: var(--red); }
  .mcp-doc .param-type { font-family: var(--mono); color: var(--t3); font-size: 11px; }
  .mcp-doc .param-desc { color: var(--t2); }
  .mcp-doc .tool-returns { margin-top: 10px; font-size: 12px; color: var(--t2); }
  .mcp-doc .tool-returns strong { color: var(--green); font-family: var(--mono); font-weight: 500; }
  .mcp-doc .tool-example { margin-top: 12px; background: var(--elevated); border: 1px solid var(--border-s); border-radius: 6px; padding: 12px 14px; font-family: var(--mono); font-size: 11.5px; color: var(--t2); line-height: 1.55; white-space: pre-wrap; overflow-x: auto; }

  .mcp-doc .model-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  .mcp-doc .model-table th { text-align: left; font-size: 11px; font-weight: 600; color: var(--t3); text-transform: uppercase; letter-spacing: 0.5px; padding: 8px 10px; border-bottom: 1px solid var(--border); }
  .mcp-doc .model-table td { font-size: 12.5px; padding: 7px 10px; border-bottom: 1px solid var(--border-s); }
  .mcp-doc .model-table td:first-child { font-family: var(--mono); color: var(--agent); font-weight: 500; }
  .mcp-doc .model-table td:nth-child(2) { font-family: var(--mono); color: var(--t3); font-size: 11.5px; }
  .mcp-doc .model-name { font-size: 14px; font-weight: 600; color: var(--t1); margin-bottom: 12px; display: flex; align-items: center; gap: 8px; }
  .mcp-doc .model-name .dot { width: 8px; height: 8px; border-radius: 2px; background: var(--agent); flex-shrink: 0; }

  .mcp-doc .step-type { display: flex; align-items: flex-start; gap: 12px; padding: 12px 0; border-bottom: 1px solid var(--border-s); }
  .mcp-doc .step-type:last-child { border-bottom: none; }
  .mcp-doc .step-icon { width: 32px; height: 32px; border-radius: 6px; display: flex; align-items: center; justify-content: center; font-size: 15px; flex-shrink: 0; }
  .mcp-doc .step-label { font-family: var(--mono); font-size: 13px; font-weight: 600; }
  .mcp-doc .step-desc { font-size: 12.5px; color: var(--t2); margin-top: 2px; }

  .mcp-doc .code-block { background: var(--elevated); border: 1px solid var(--border); border-radius: 6px; padding: 14px 16px; font-family: var(--mono); font-size: 12px; line-height: 1.6; color: var(--t2); overflow-x: auto; margin: 12px 0; white-space: pre-wrap; }
  .mcp-doc .code-block .kw { color: var(--purple); }
  .mcp-doc .code-block .str { color: var(--green); }
  .mcp-doc .code-block .fn { color: var(--agent); }
  .mcp-doc .code-block .cm { color: var(--t3); }
  .mcp-doc .code-block .num { color: var(--orange); }

  .mcp-doc .flow-step { display: flex; gap: 14px; margin-bottom: 8px; }
  .mcp-doc .flow-num { width: 28px; height: 28px; border-radius: 50%; background: var(--elevated); border: 1px solid var(--border); display: flex; align-items: center; justify-content: center; font-family: var(--mono); font-size: 12px; font-weight: 600; color: var(--accent2); flex-shrink: 0; margin-top: 2px; }
  .mcp-doc .flow-content { flex: 1; padding-bottom: 12px; border-bottom: 1px solid var(--border-s); }
  .mcp-doc .flow-content h4 { font-size: 13.5px; font-weight: 600; margin-bottom: 3px; }
  .mcp-doc .flow-content p { font-size: 12.5px; color: var(--t2); line-height: 1.5; margin: 0; }

  .mcp-doc .arch-box { display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: center; margin: 20px 0; }
  .mcp-doc .arch-node { background: var(--surface); border: 1px solid var(--border); border-radius: var(--r); padding: 16px; text-align: center; }
  .mcp-doc .arch-node.highlight { border-color: var(--agent); background: var(--agent-g); }
  .mcp-doc .arch-node h4 { font-size: 13px; font-weight: 600; margin-bottom: 4px; }
  .mcp-doc .arch-node p { font-size: 11.5px; color: var(--t3); margin: 0; }
  .mcp-doc .arch-arrow { color: var(--t3); font-size: 20px; }

  .mcp-doc .badge { display: inline-flex; align-items: center; gap: 4px; font-size: 10.5px; font-family: var(--mono); padding: 2px 8px; border-radius: 10px; }
  .mcp-doc .badge-agent { background: var(--agent-g); color: var(--agent); }
  .mcp-doc .badge-read { background: rgba(94,106,210,0.1); color: var(--accent2); }
  .mcp-doc .badge-write { background: rgba(247,161,53,0.1); color: var(--orange); }

  @media (max-width: 640px) {
    .mcp-doc .param-row { grid-template-columns: 1fr; gap: 2px; }
    .mcp-doc .arch-box { grid-template-columns: 1fr; }
    .mcp-doc .arch-arrow { transform: rotate(90deg); text-align: center; }
  }
`;

interface Tool {
  name: string;
  category: string;
  description: string;
  params: { name: string; type: string; required: boolean; desc: string }[];
  returns: string;
  example: string;
}

function ToolCard({ tool }: { tool: Tool }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="tool-card">
      <div className="tool-head" onClick={() => setOpen(!open)}>
        <span className={`tool-chevron ${open ? "open" : ""}`}>▶</span>
        <span className="tool-name">{tool.name}</span>
        <span className={`tool-cat ${tool.category}`}>{tool.category}</span>
        <span className="tool-desc">{tool.description.slice(0, 80)}...</span>
      </div>
      {open && (
        <div className="tool-body">
          <p style={{ fontSize: 12.5, color: "var(--t2)", margin: "12px 0 0" }}>{tool.description}</p>
          <div className="tool-params">
            <div className="param-row" style={{ fontWeight: 600, color: "var(--t3)", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5 }}>
              <div>Parameter</div><div>Type</div><div>Description</div>
            </div>
            {tool.params.map(p => (
              <div key={p.name} className="param-row">
                <div className="param-name">{p.name} {p.required && <span className="req">*</span>}</div>
                <div className="param-type">{p.type}</div>
                <div className="param-desc">{p.desc}</div>
              </div>
            ))}
          </div>
          <div className="tool-returns"><strong>Returns → </strong>{tool.returns}</div>
          <div className="tool-example">{tool.example}</div>
        </div>
      )}
    </div>
  );
}

export default function TracebackMCPDoc() {
  const [tab, setTab] = useState(0);
  const readTools = MCP_TOOLS.filter(t => t.category === "read");
  const writeTools = MCP_TOOLS.filter(t => t.category === "write");

  return (
    <div className="mcp-doc">
      <style>{CSS}</style>
      <div className="doc">
        {/* Header */}
        <div className="doc-header">
          <div className="doc-logo">
            <div className="doc-logo-mark">T</div>
            <div className="doc-logo-text">Traceback <span>MCP Server</span></div>
          </div>
          <p className="doc-subtitle">
            Das MCP-Server-Schema für Traceback — die Transparenzschicht, die jeden Schritt eines AI-Agenten nachvollziehbar macht.
            Dieses Dokument definiert die Tools, das Datenmodell und die Architektur für{" "}
            <code style={{ fontFamily: "var(--mono)", color: "var(--agent)", background: "var(--agent-g)", padding: "1px 5px", borderRadius: 3, fontSize: 12.5 }}>
              traceback-hazel.vercel.app/api/mcp
            </code>
          </p>
        </div>

        {/* Tabs */}
        <div className="tabs">
          {TABS.map((t, i) => (
            <button key={t} className={`tab ${tab === i ? "on" : ""}`} onClick={() => setTab(i)}>{t}</button>
          ))}
        </div>

        {/* ─── Architecture ─── */}
        {tab === 0 && (
          <div className="section">
            <h2>System Architecture</h2>
            <p>Traceback wird als MCP-Server deployed, den jeder AI-Coding-Agent (Claude Code, Cursor, Codex, etc.) direkt anbinden kann. Der Agent liest Tickets, arbeitet daran und schreibt jeden Reasoning-Schritt zurück.</p>

            <div className="arch-box">
              <div className="arch-node">
                <h4>📋 Traceback UI</h4>
                <p>traceback-hazel.vercel.app</p>
                <p style={{ marginTop: 4 }}>Tickets, Board, Session Viewer</p>
              </div>
              <div className="arch-arrow">⟷</div>
              <div className="arch-node highlight">
                <h4>⚡ Traceback MCP Server</h4>
                <p>/api/mcp</p>
                <p style={{ marginTop: 4 }}>8 Tools · Vercel Edge</p>
              </div>
            </div>
            <div style={{ textAlign: "center", color: "var(--t3)", fontSize: 20, margin: "4px 0" }}>⟷</div>
            <div className="arch-box" style={{ gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
              <div className="arch-node"><h4>🤖 Claude Code</h4><p>Scheduled Tasks + MCP</p></div>
              <div className="arch-node"><h4>🖱️ Cursor Agent</h4><p>MCP Integration</p></div>
              <div className="arch-node"><h4>📦 Codex / Devin</h4><p>MCP Integration</p></div>
            </div>

            <div className="card" style={{ marginTop: 24 }}>
              <h3>Der Flow</h3>
              <div style={{ marginTop: 12 }}>
                {[
                  { t: "Ticket wird erstellt", d: "In Traceback UI oder via traceback_create_ticket Tool" },
                  { t: "Scheduled Task triggert Claude Code", d: "Cloud Task pollt: 'Check Traceback for unworked tickets with priority ≥ 2'" },
                  { t: "Agent liest Ticket-Kontext", d: "traceback_get_ticket → bekommt Beschreibung, History, vorherige Session-Logs" },
                  { t: "Agent arbeitet & loggt jeden Schritt", d: "traceback_log_session_step für jede Entscheidung, jeden Command, jede Code-Änderung" },
                  { t: "Agent schließt ab", d: "traceback_link_pr + traceback_update_ticket(status: 'in_review') + traceback_add_comment mit Summary" },
                  { t: "Mensch reviewt den Trail", d: "Traceback UI zeigt den vollständigen Reasoning-Trail: Warum diese Library? Warum dieser Ansatz?" },
                ].map((s, i) => (
                  <div key={i} className="flow-step">
                    <div className="flow-num">{i + 1}</div>
                    <div className="flow-content"><h4>{s.t}</h4><p>{s.d}</p></div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card card-agent" style={{ marginTop: 16 }}>
              <h3 style={{ color: "var(--agent)" }}>USP vs. Linear</h3>
              <p style={{ marginTop: 6 }}>Linear zeigt: "Agent hat PR erstellt." — Traceback zeigt den gesamten Weg dahin. Jede Evaluation, jede Abwägung, jeder Fehler und jede Entscheidung wird nachvollziehbar gespeichert. Das ist nicht nur Logging — es ist institutionelles Wissen über wie dein Code entstanden ist.</p>
            </div>
          </div>
        )}

        {/* ─── MCP Tools ─── */}
        {tab === 1 && (
          <div className="section">
            <h2>MCP Tool Definitions</h2>
            <p>8 Tools, aufgeteilt in <span className="badge badge-read">read</span> und <span className="badge badge-write">write</span>. Jedes Tool ist so designed, dass es eine Sache gut macht — Agents können sie frei verketten.</p>

            <h3 style={{ marginTop: 20, marginBottom: 10 }}>Read Tools ({readTools.length})</h3>
            {readTools.map(t => <ToolCard key={t.name} tool={t} />)}

            <h3 style={{ marginTop: 24, marginBottom: 10 }}>Write Tools ({writeTools.length})</h3>
            {writeTools.map(t => <ToolCard key={t.name} tool={t} />)}
          </div>
        )}

        {/* ─── Data Model ─── */}
        {tab === 2 && (
          <div className="section">
            <h2>Data Model</h2>
            <p>4 Kerntabellen in Supabase/Postgres. Das SessionStep-Modell ist das Herzstück — hier lebt der Reasoning Trail.</p>
            {DATA_MODEL.map(model => (
              <div key={model.name} style={{ marginBottom: 24 }}>
                <div className="model-name"><div className="dot" /> {model.name}</div>
                <table className="model-table">
                  <thead><tr><th>Field</th><th>Type</th><th>Description</th></tr></thead>
                  <tbody>
                    {model.fields.map(f => (
                      <tr key={f.name}>
                        <td>{f.name}</td>
                        <td>{f.type}</td>
                        <td style={{ color: "var(--t2)" }}>{f.desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}

        {/* ─── Session Log Schema ─── */}
        {tab === 3 && (
          <div className="section">
            <h2>Session Step Types</h2>
            <p>Jeder Schritt, den ein Agent ausführt, wird als SessionStep gespeichert. Die 6 Typen decken den gesamten Reasoning-Lifecycle ab:</p>

            <div className="card" style={{ marginTop: 16 }}>
              {SESSION_STEP_TYPES.map(s => (
                <div key={s.type} className="step-type">
                  <div className="step-icon" style={{ background: s.color + "18", color: s.color }}>{s.icon}</div>
                  <div>
                    <div className="step-label" style={{ color: s.color }}>{s.type}</div>
                    <div className="step-desc">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            <h3 style={{ marginTop: 28 }}>Beispiel: Kompletter Session Trail für ein Bug-Fix</h3>
            <div className="code-block">{`[
  { seq: 1, type: "thinking",   content: "Reading ticket TRB-103: ordering inconsistency after drag..." },
  { seq: 2, type: "action",     content: "rg 'sort\\|order' src/components/board/ --json", meta: { tool: "bash" } },
  { seq: 3, type: "reasoning",  content: "Array.sort() is not stable in older V8. Current code sorts by
    status only — ties between same-status items lose their position." },
  { seq: 4, type: "action",     content: "git log --oneline -10 src/components/board/BoardColumn.tsx" },
  { seq: 5, type: "reasoning",  content: "Last change was 3 days ago: 'feat: add drag reorder'. The sort
    comparator doesn't use position as tiebreaker. Fix: add secondary
    sort on position field." },
  { seq: 6, type: "code",       content: "// BoardColumn.tsx L42-48\\n- issues.sort((a, b) => ...)\\n+
    issues.sort((a, b) => {\\n+   if (a.status !== b.status) return ...;\\n+
    return a.position - b.position;\\n+ })",
    meta: { files_changed: ["src/components/board/BoardColumn.tsx"] } },
  { seq: 7, type: "action",     content: "npm test -- --filter board", meta: { tool: "bash" } },
  { seq: 8, type: "result",     content: "All 8 tests passing. Created PR #47: fix/ticket-ordering-stable-sort.
    Root cause: unstable sort without position tiebreaker.",
    meta: { files_changed: 1, tokens_used: 4200 } }
]`}</div>
          </div>
        )}

        {/* ─── Setup & Flow ─── */}
        {tab === 4 && (
          <div className="section">
            <h2>Setup: Agent verbinden</h2>

            <h3>1. Claude Code anbinden</h3>
            <div className="code-block">
              <span className="cm"># Traceback MCP Server zu Claude Code hinzufügen</span>{"\n"}
              <span className="fn">claude mcp add</span> --transport http traceback https://traceback-hazel.vercel.app/api/mcp \{"\n"}
              {"  "}--header <span className="str">"Authorization: Bearer YOUR_TRACEBACK_API_KEY"</span>{"\n\n"}
              <span className="cm"># Auth-Flow starten</span>{"\n"}
              <span className="fn">/mcp</span>
            </div>

            <h3 style={{ marginTop: 20 }}>2. Scheduled Cloud Task erstellen</h3>
            <div className="code-block">
              <span className="cm"># Auf claude.ai/code/scheduled oder direkt im Chat:</span>{"\n\n"}
              <span className="str">{"\"Every weekday at 9am, check Traceback for unworked tickets\nwith priority 1 or 2. For each ticket:\n1. Read the full context with traceback_get_ticket\n2. Analyze the codebase to understand the issue\n3. Log every reasoning step via traceback_log_session_step\n4. Implement the fix\n5. Create a PR and link it via traceback_link_pr\n6. Update ticket status to in_review\n7. Leave a summary comment\""}</span>
            </div>

            <h3 style={{ marginTop: 20 }}>3. Cursor / andere Agents</h3>
            <div className="code-block">
              <span className="cm">{"// .cursor/mcp.json oder globale MCP config"}</span>{"\n"}
              {"{"}{"\n"}
              {"  "}<span className="str">"mcpServers"</span>: {"{"}{"\n"}
              {"    "}<span className="str">"traceback"</span>: {"{"}{"\n"}
              {"      "}<span className="str">"command"</span>: <span className="str">"npx"</span>,{"\n"}
              {"      "}<span className="str">"args"</span>: [<span className="str">"-y"</span>, <span className="str">"mcp-remote"</span>, <span className="str">"https://traceback-hazel.vercel.app/api/mcp"</span>]{"\n"}
              {"    }"}{"\n"}
              {"  }"}{"\n"}
              {"}"}
            </div>

            <div className="card card-agent" style={{ marginTop: 24 }}>
              <h3 style={{ color: "var(--agent)" }}>API Key Auth</h3>
              <p style={{ marginTop: 6 }}>Dein bestehendes API-Key-System aus Traceback wird direkt genutzt. Der MCP-Server prüft den{" "}
                <code style={{ fontFamily: "var(--mono)", fontSize: 12 }}>Authorization: Bearer</code> Header gegen die gleiche Auth-Logik wie deine REST-Endpoints.
              </p>
            </div>
          </div>
        )}

        {/* ─── Implementation ─── */}
        {tab === 5 && (
          <div className="section">
            <h2>Implementation Guide</h2>
            <p>Der MCP-Server ist eine Vercel Edge Function, die das offizielle TypeScript SDK nutzt und deine bestehenden Supabase-Queries wrapped.</p>

            <h3>Dateistruktur</h3>
            <div className="code-block">{`traceback/
├── app/
│   └── api/
│       └── mcp/
│           └── route.ts          ← MCP Server entry point
├── lib/
│   ├── mcp/
│   │   ├── server.ts             ← McpServer setup + tool registration
│   │   ├── tools/
│   │   │   ├── tickets.ts        ← list, get, create, update ticket tools
│   │   │   ├── sessions.ts       ← log_session_step, get_session tools
│   │   │   ├── links.ts          ← link_pr tool
│   │   │   └── comments.ts       ← add_comment tool
│   │   └── auth.ts               ← API key validation middleware
│   └── db/
│       ├── tickets.ts            ← Existing Supabase queries
│       └── sessions.ts           ← New session step queries
├── ...`}</div>

            <h3 style={{ marginTop: 20 }}>MCP Server Entry Point</h3>
            <div className="code-block">
              <span className="cm">{"// app/api/mcp/route.ts"}</span>{"\n"}
              <span className="kw">import</span> {"{  McpServer  }"} <span className="kw">from</span> <span className="str">"@modelcontextprotocol/sdk"</span>;{"\n"}
              <span className="kw">import</span> {"{ registerTicketTools }"} <span className="kw">from</span> <span className="str">"@/lib/mcp/tools/tickets"</span>;{"\n"}
              <span className="kw">import</span> {"{ registerSessionTools }"} <span className="kw">from</span> <span className="str">"@/lib/mcp/tools/sessions"</span>;{"\n"}
              <span className="kw">import</span> {"{ registerLinkTools }"} <span className="kw">from</span> <span className="str">"@/lib/mcp/tools/links"</span>;{"\n"}
              <span className="kw">import</span> {"{ registerCommentTools }"} <span className="kw">from</span> <span className="str">"@/lib/mcp/tools/comments"</span>;{"\n\n"}
              <span className="kw">const</span> <span className="fn">server</span> = <span className="kw">new</span> <span className="fn">McpServer</span>({"{"}{"\n"}
              {"  "}name: <span className="str">"traceback"</span>,{"\n"}
              {"  "}version: <span className="str">"1.0.0"</span>,{"\n"}
              {"  "}description: <span className="str">"Traceback — transparent AI agent session tracking"</span>{"\n"}
              {"}"});{"\n\n"}
              <span className="fn">registerTicketTools</span>(server);{"\n"}
              <span className="fn">registerSessionTools</span>(server);{"\n"}
              <span className="fn">registerLinkTools</span>(server);{"\n"}
              <span className="fn">registerCommentTools</span>(server);{"\n\n"}
              <span className="cm">{"// Vercel Edge: export HTTP handler"}</span>{"\n"}
              <span className="kw">export</span> {"{ GET, POST }"} = server.httpHandler();
            </div>

            <h3 style={{ marginTop: 20 }}>Beispiel Tool Registration</h3>
            <div className="code-block">
              <span className="cm">{"// lib/mcp/tools/sessions.ts"}</span>{"\n"}
              <span className="kw">import</span> {"{ z }"} <span className="kw">from</span> <span className="str">"zod"</span>;{"\n\n"}
              <span className="kw">export function</span> <span className="fn">registerSessionTools</span>(server{"{"}) {"{"}{"\n"}
              {"  "}server.<span className="fn">tool</span>({"\n"}
              {"    "}<span className="str">"traceback_log_session_step"</span>,{"\n"}
              {"    "}<span className="str">"Append a reasoning/action step to a ticket's agent session log"</span>,{"\n"}
              {"    "}{"{"}{"\n"}
              {"      "}ticket_id: z.string().<span className="fn">describe</span>(<span className="str">"Ticket ID (e.g. TRB-103)"</span>),{"\n"}
              {"      "}type: z.enum([<span className="str">"thinking"</span>, <span className="str">"reasoning"</span>, <span className="str">"action"</span>, <span className="str">"code"</span>, <span className="str">"result"</span>, <span className="str">"error"</span>]),{"\n"}
              {"      "}content: z.string().<span className="fn">describe</span>(<span className="str">"What happened"</span>),{"\n"}
              {"      "}metadata: z.object({"{"}{"\n"}
              {"        "}files_changed: z.array(z.string()).optional(),{"\n"}
              {"        "}tokens_used: z.number().optional(),{"\n"}
              {"        "}duration_ms: z.number().optional(),{"\n"}
              {"        "}tool_name: z.string().optional(),{"\n"}
              {"      }"}).optional(),{"\n"}
              {"    }"},{"\n"}
              {"    "}<span className="kw">async</span> {"({ ticket_id, type, content, metadata })"} {"=>"} {"{"}{"\n"}
              {"      "}<span className="kw">const</span> step = <span className="kw">await</span> db.<span className="fn">insertSessionStep</span>({"{"}{"\n"}
              {"        "}ticket_id, type, content,{"\n"}
              {"        "}agent_id: <span className="str">"claude-code"</span>, <span className="cm">{"// from auth context"}</span>{"\n"}
              {"        "}metadata,{"\n"}
              {"      }"});{"\n"}
              {"      "}<span className="kw">return</span> {"{"} content: [{"{"} type: <span className="str">"text"</span>, text: JSON.stringify(step) {"}"}] {"}"};{"\n"}
              {"    }"}{"\n"}
              {"  "});{"\n"}
              {"}"}
            </div>

            <div className="card" style={{ marginTop: 24 }}>
              <h3>Nächste Schritte</h3>
              <div style={{ marginTop: 8, fontSize: 13, color: "var(--t2)", lineHeight: 1.6 }}>
                <strong style={{ color: "var(--t1)" }}>Phase 1:</strong> MCP route + auth middleware auf Vercel deployen<br />
                <strong style={{ color: "var(--t1)" }}>Phase 2:</strong> SessionStep Tabelle in Supabase anlegen + Insert-Queries<br />
                <strong style={{ color: "var(--t1)" }}>Phase 3:</strong> Ticket-Tools wrappen (deine GET endpoints → MCP tools)<br />
                <strong style={{ color: "var(--t1)" }}>Phase 4:</strong> Claude Code anbinden + ersten Scheduled Task testen<br />
                <strong style={{ color: "var(--t1)" }}>Phase 5:</strong> Session Viewer in Traceback UI einbauen
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

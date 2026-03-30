// types/agents.ts — Serialised types for Agent, SessionStep, LinkedPR, TaskComment

export type DelegateStatus = "IDLE" | "WORKING" | "COMPLETED" | "ERROR";

export type SessionStepType =
  | "THINKING"
  | "REASONING"
  | "ACTION"
  | "CODE"
  | "RESULT"
  | "ERROR";

export type LinkType = "PR" | "BRANCH" | "COMMIT";
export type PRStatus = "OPEN" | "MERGED" | "CLOSED";
export type AuthorType = "HUMAN" | "AGENT";

export interface Agent {
  id: string;
  name: string;
  provider: string;
  model: string | null;
  capabilities: string[];
  avatarUrl: string | null;
  guidance: string | null;
  createdAt: string;
}

export interface SessionStep {
  id: string;
  ticketId: string;
  agentId: string;
  sequence: number;
  type: SessionStepType;
  content: string;
  metadata: {
    filesChanged?: string[];
    tokensUsed?: number;
    durationMs?: number;
    toolName?: string;
    model?: string;
  };
  createdAt: string;
}

export interface LinkedPR {
  id: string;
  ticketId: string;
  url: string;
  type: LinkType;
  title: string | null;
  status: PRStatus;
  createdAt: string;
}

export interface TaskComment {
  id: string;
  ticketId: string;
  content: string;
  authorType: AuthorType;
  authorId: string;
  createdAt: string;
}

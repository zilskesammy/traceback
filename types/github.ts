// types/github.ts — TypeScript-Typen für GitHub Webhook Payloads

// ─── PUSH EVENT ──────────────────────────────────────────────────────────────

export interface GitHubPushPayload {
  ref: string; // z.B. "refs/heads/main"
  before: string; // SHA des vorherigen Commits
  after: string; // SHA des HEAD nach dem Push
  repository: GitHubRepository;
  pusher: {
    name: string;
    email: string | null;
  };
  commits: GitHubCommit[];
  head_commit: GitHubCommit | null;
  installation?: {
    id: number;
  };
}

export interface GitHubCommit {
  id: string; // Commit SHA
  message: string;
  timestamp: string; // ISO 8601
  author: {
    name: string;
    email: string;
    username?: string;
  };
  added: string[];
  removed: string[];
  modified: string[];
  url: string;
}

// ─── PULL REQUEST EVENT ───────────────────────────────────────────────────────

export interface GitHubPullRequestPayload {
  action: "opened" | "closed" | "synchronize" | "reopened" | "edited";
  number: number;
  pull_request: {
    id: number;
    number: number;
    title: string;
    state: "open" | "closed";
    merged: boolean;
    head: {
      sha: string;
      ref: string;
    };
    base: {
      sha: string;
      ref: string;
    };
    user: {
      login: string;
    };
    html_url: string;
  };
  repository: GitHubRepository;
  installation?: {
    id: number;
  };
}

// ─── SHARED ───────────────────────────────────────────────────────────────────

export interface GitHubRepository {
  id: number;
  name: string;
  full_name: string; // "owner/repo"
  private: boolean;
  owner: {
    login: string;
  };
  default_branch: string;
  html_url: string;
}

// ─── GITHUB API RESPONSE: CREATE WEBHOOK ─────────────────────────────────────

export interface GitHubWebhookCreateResponse {
  id: number;
  type: string;
  name: string;
  active: boolean;
  events: string[];
  config: {
    url: string;
    content_type: string;
    insecure_ssl: string;
  };
  created_at: string;
  updated_at: string;
}

// ─── GITHUB API RESPONSE: ERROR ───────────────────────────────────────────────

export interface GitHubApiError {
  message: string;
  errors?: Array<{
    resource: string;
    code: string;
    message?: string;
  }>;
  documentation_url?: string;
}

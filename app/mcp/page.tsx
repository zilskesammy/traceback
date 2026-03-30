import TracebackMCPDoc from "@/components/mcp-doc/TracebackMCPDoc";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "MCP Server — Traceback",
  description: "Das MCP-Server-Schema für Traceback — Tools, Datenmodell und Architektur für AI-Agent-Integration.",
};

export default function MCPDocPage() {
  return <TracebackMCPDoc />;
}

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const agents = [
    {
      id: "claude-code",
      name: "Claude Code",
      provider: "Anthropic",
      model: "claude-sonnet-4-20250514",
      capabilities: ["code-gen", "refactor", "debug", "test", "pr-creation"],
    },
    {
      id: "devin",
      name: "Devin",
      provider: "Cognition",
      model: "devin-2.0",
      capabilities: ["code-gen", "planning", "pr-creation", "testing"],
    },
    {
      id: "cursor-agent",
      name: "Cursor Agent",
      provider: "Anysphere",
      model: "cursor-agent",
      capabilities: ["code-gen", "refactor", "multi-file"],
    },
  ];

  for (const agent of agents) {
    await db.agent.upsert({
      where: { id: agent.id },
      update: agent,
      create: agent,
    });
    console.log(`Seeded agent: ${agent.id}`);
  }
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());

# Changelog Sync — Design Spec

**Datum:** 2026-03-31
**Status:** Approved

---

## Ziel

Die lokalen `.agent-changelog/` Dateien (human YAML + machine JSONL), die von Agents und Menschen ins Git gepusht werden, sollen in Tracebacks PostgreSQL-DB gespiegelt und dort sichtbar gemacht werden. Traceback wird damit zum einheitlichen Memory-System für Mensch und Maschine — über mehrere Projekte hinweg.

Spätere Ausbaustufe (außer Scope dieses Plans): Features in Traceback anlegen und an Claude pushen zur Ausführung.

---

## Datenfluss

```
Agent/Mensch
  → schreibt .agent-changelog/human/ und /machine/
  → Git Push → GitHub
  → GitHub Push-Webhook (existiert bereits: /api/webhook/github)
      erkennt Änderungen in .agent-changelog/**
      → ruft Sync-Logik auf
  → DB Upsert (via ID aus Changelog-YAML/JSONL)
  → Traceback UI (Multi-Project · Feature-Liste · Entry-Timeline)
```

Zusätzlich: manueller "Sync" Button in der UI, der `POST /api/projects/[id]/changelog/sync` aufruft. Dieser liest die Changelog-Dateien direkt aus der GitHub API (kein lokaler Dateizugriff nötig — funktioniert für alle verbundenen Repos).

---

## DB-Schema

### Neue Modelle

#### ChangelogFeature

Entspricht einem Feature- oder Bugfix-Eintrag aus dem Changelog (`meta` Block in YAML).

```prisma
model ChangelogFeature {
  id                 String              @id  // z.B. "feat-20260330-001" aus YAML
  projectId          String
  parentId           String?             // self-referential für Hierarchie (spätere Planung)
  type               ChangelogItemType
  status             ChangelogStatus
  priority           ChangelogPriority
  title              String
  summary            String              @db.Text
  businessContext    String?             @db.Text
  rootCause          String?             @db.Text  // nur bugfix
  impact             String?             @db.Text  // nur bugfix
  resolution         String?             @db.Text  // nur bugfix
  regressionRisk     String?             @db.Text  // nur bugfix
  affectedComponents String[]
  affectedUsers      String?             @db.Text
  acceptanceCriteria String[]
  tags               String[]
  source             ChangelogSource     @default(CHANGELOG)
  sourceFile         String?             // z.B. "human/features/mcp-extension-foundation.yaml"
  createdAt          DateTime            @default(now())
  updatedAt          DateTime            @updatedAt

  project  Project            @relation(fields: [projectId], references: [id], onDelete: Cascade)
  parent   ChangelogFeature?  @relation("FeatureHierarchy", fields: [parentId], references: [id])
  children ChangelogFeature[] @relation("FeatureHierarchy")
  entries  ChangelogEntry[]

  @@index([projectId])
  @@index([parentId])
  @@index([type])
  @@index([status])
}
```

#### ChangelogEntry

Entspricht einem Entry-Objekt innerhalb eines Features (ein Agent-Arbeitsschritt).

```prisma
model ChangelogEntry {
  id              String             @id  // z.B. "entry-20260330-120000-be02"
  featureId       String
  timestamp       DateTime
  agentType       ChangelogAgentType
  agentName       String
  action          ChangelogAction
  summary         String             @db.Text
  what            String?            @db.Text
  why             String?            @db.Text
  technicalDetails String?           @db.Text
  sideEffects     String?            @db.Text
  dependencies    String[]
  relatedEntryIds String[]
  linesAdded      Int                @default(0)
  linesRemoved    Int                @default(0)
  createdAt       DateTime           @default(now())

  feature     ChangelogFeature @relation(fields: [featureId], references: [id], onDelete: Cascade)
  codeChanges CodeChange[]

  @@index([featureId])
  @@index([timestamp])
  @@index([agentType])
}
```

#### CodeChange

Entspricht einem Eintrag in `code_changes` eines Entry.

```prisma
model CodeChange {
  id          String         @id @default(cuid())
  entryId     String
  file        String
  changeType  CodeChangeType
  linesAdded  Int            @default(0)
  linesRemoved Int           @default(0)
  diffSummary String?        @db.Text

  entry ChangelogEntry @relation(fields: [entryId], references: [id], onDelete: Cascade)

  @@index([entryId])
  @@index([file])
}
```

### Neue Enums

```prisma
enum ChangelogItemType {
  FEATURE
  BUGFIX
  EPIC
  TASK
}

enum ChangelogStatus {
  PLANNED
  IN_PROGRESS
  COMPLETED
}

enum ChangelogPriority {
  HIGH
  MEDIUM
  LOW
}

enum ChangelogSource {
  CHANGELOG   // aus .agent-changelog/ Dateien
  UI          // direkt in Traceback angelegt (spätere Ausbaustufe)
}

enum ChangelogAgentType {
  FRONTEND
  BACKEND
  QA
  DEVOPS
  FULLSTACK
  ARCHITEKT
  PROJEKTLEITER
  DOKUMENTATION
  SECURITY
  HUMAN
}

enum ChangelogAction {
  CREATED
  MODIFIED
  FIXED
  PLANNED
}

enum CodeChangeType {
  ADDED
  MODIFIED
  REMOVED
}
```

### Gelöschte Modelle

Die folgenden Modelle werden entfernt (sie werden durch das Changelog-Schema ersetzt):

- `Epic`
- `Feature`
- `Task`
- `TaskComment` (Kommentare gehen in `ChangelogEntry` auf)

Ebenfalls geprüft auf Abhängigkeiten und bereinigt:
- `SessionStep.ticketId` → wird zu `SessionStep.featureId` (FK auf `ChangelogFeature`)
- `LinkedPR.ticketId` → wird zu `LinkedPR.featureId`
- Alle bestehenden API-Routen unter `/api/projects/[id]/epics/...` werden entfernt

### Bestehende Modelle bleiben unverändert

`Project`, `User`, `Agent`, `SessionStep`, `LinkedPR`, `Commit`, `ApiKey`, `ProjectMember`, `ProjectInvitation`, `Account`, `Session`, `VerificationToken`

---

## Sync-Mechanismus

### Parser: `lib/changelog/parser.ts`

Liest GitHub-API-Response und wandelt YAML/JSONL in DB-Objekte um.

**Input-Quellen:**
- `machine/entries.jsonl` — flache Liste aller Entries (primäre Quelle, enthält alle Felder)
- `machine/index.json` — Index mit Feature-Metadaten
- `human/index.yaml` — Human-readable Index (Fallback/Ergänzung)

**Logik:**
1. Lese `machine/entries.jsonl` zeilenweise
2. Für jeden Entry: upsert `ChangelogFeature` (via `parent_id` aus JSONL)
3. Upsert `ChangelogEntry` (via `id`)
4. Upsert `CodeChange`s (via `entryId + file` Kombination — kein stabiler ID, daher `deleteMany` + `createMany` pro Entry)

### Webhook-Erweiterung: `app/api/webhook/github/route.ts`

Bestehender Push-Webhook wird erweitert:

```
if (pushedFiles.some(f => f.startsWith('.agent-changelog/'))) {
  await syncChangelog(projectId)
}
```

### Sync-Endpoint: `app/api/projects/[id]/changelog/sync` (POST)

- Auth: `resolveAuth()` (API-Key + Session)
- Liest `.agent-changelog/machine/entries.jsonl` und `machine/index.json` via GitHub API (`GET /repos/{owner}/{repo}/contents/{path}`)
- Parst und upserted alle Einträge
- Gibt `{ synced: N, skipped: M }` zurück

---

## API-Routen

### Neue Routen

| Methode | Pfad | Funktion |
|---|---|---|
| `POST` | `/api/projects/[id]/changelog/sync` | Manueller Sync aus GitHub |
| `GET` | `/api/projects/[id]/changelog` | Liste aller Features (mit Entry-Count) |
| `GET` | `/api/projects/[id]/changelog/[featureId]` | Feature + alle Entries + CodeChanges |

### Entfernte Routen

Alle Routen unter:
- `/api/projects/[id]/epics/...`
- `/api/tasks/[taskId]/...` (session, delegate, linked-prs, implement)
- `/api/tasks/[taskId]/route.ts`

---

## UI

### Multi-Project View — `/` (Dashboard)

- Sidebar: alle verbundenen Projekte (via `Project` Tabelle)
- Pro Projekt: ChangelogFeature-Liste mit Filter (Type, Status, AgentType, Tags)
- "Sync" Button pro Projekt

### Changelog-View — `/projects/[id]`

Ersetzt die bestehende Board/Kanban/Commits-View.

**Layout:**
- Links: Filter-Panel (Type, Status, Priority, AgentType, Tags, Datum)
- Rechts: Feature-Liste, expandierbar
  - Jedes Feature zeigt: Type-Badge · Titel · Status · Priority · Entry-Count · letztes Datum
  - Aufgeklappt: Entry-Timeline (chronologisch)
    - Pro Entry: AgentType-Badge · AgentName · Action · Summary · linesAdded/Removed
    - Aufgeklappt: what / why / technicalDetails / sideEffects · CodeChange-Liste

### Bestehende Komponenten

- `CommitsView` bleibt (Commits sind weiterhin ein eigener Tab)
- `AgentBadge`, `SessionViewer`, `AgentDelegation` bleiben (für zukünftige Planung)
- `PlanningLayout` wird zu `ProjectLayout` umgebaut
- `FeatureCard`, `TaskModal`, `EpicModal`, `FeatureModal`, `TaskModal` werden entfernt

---

## Feldmapping: JSONL → DB

| JSONL-Feld | DB-Feld | Modell |
|---|---|---|
| `parent_id` | `id` | `ChangelogFeature` |
| `parent_title` | `title` | `ChangelogFeature` |
| `category` | `type` (FEATURE/BUGFIX) | `ChangelogFeature` |
| `status` (aus machine/index.json) | `status` | `ChangelogFeature` |
| `priority` (aus machine/index.json) | `priority` | `ChangelogFeature` |
| `tags` (aus machine/index.json) | `tags` | `ChangelogFeature` |
| `id` | `id` | `ChangelogEntry` |
| `timestamp` | `timestamp` | `ChangelogEntry` |
| `agent_type` | `agentType` | `ChangelogEntry` |
| `agent_name` | `agentName` | `ChangelogEntry` |
| `action` | `action` | `ChangelogEntry` |
| `summary` | `summary` | `ChangelogEntry` |
| `what` | `what` | `ChangelogEntry` |
| `why` | `why` | `ChangelogEntry` |
| `technical_details` | `technicalDetails` | `ChangelogEntry` |
| `side_effects` | `sideEffects` | `ChangelogEntry` |
| `dependencies` | `dependencies` | `ChangelogEntry` |
| `related_entries` | `relatedEntryIds` | `ChangelogEntry` |
| `lines_added` (Summe aus code_changes) | `linesAdded` | `ChangelogEntry` |
| `lines_removed` (Summe aus code_changes) | `linesRemoved` | `ChangelogEntry` |
| `files_changed[].file` | `file` | `CodeChange` |
| `files_changed[].change_type` | `changeType` | `CodeChange` |
| `files_changed[].lines_added` | `linesAdded` | `CodeChange` |
| `files_changed[].lines_removed` | `linesRemoved` | `CodeChange` |
| `files_changed[].diff_summary` | `diffSummary` | `CodeChange` |

**Feature-Metadaten** (summary, businessContext, rootCause etc.) kommen aus den individuellen YAML-Dateien (`human/features/*.yaml` / `human/bugfixes/*.yaml`), nicht aus der JSONL. Der Sync liest beide Quellen.

---

## Nicht in Scope dieses Plans

- Features in Traceback-UI anlegen und an Claude pushen
- Diff-Ansicht für CodeChanges
- Full-Text-Suche über Entries
- Export / Reporting

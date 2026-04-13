# GSD — Getting $#!+ Done
## Claude Code Build Spec
### `sbozzone.github.io/gsd-app`

---

## How to Use This File

Open Claude Code in your terminal from a fresh folder:

```bash
mkdir gsd-app && cd gsd-app
claude
```

Feed prompts **one at a time, in order.** Do not combine them.  
Each prompt is scoped to one concern. Finish and verify each before moving on.

Reference this file at the start of each session:
> "I'm building the GSD app. Here's my spec: [paste relevant phase]"

---

## Architecture Overview

```
CAPTURE          TRIAGE              EXECUTE
─────────        ──────────          ──────────────────
Siri / Voice  →  AI suggests:    →   Focus Mode
Apple Reminders  Bucket               MITs (3-5 max)
  [Inbox]        Project              Active tasks
                 Now/Next/Later       Zoom levels
                 you confirm          Weekly Reset
```

**Stack:**
- Frontend: Vanilla JS ES modules, no framework, no build step
- Backend: Cloudflare Worker + D1 (new, separate from Command Flow)
- Deploy: GitHub Pages (`sbozzone.github.io/gsd-app`)
- Capture bridge: Apple Reminders → Shortcut → Worker API → D1 inbox

**5 Life Buckets:**
| Key | Label |
|---|---|
| `career` | Career |
| `craft` | Craft (YourStory) |
| `leverage` | Leverage (Content + Apps) |
| `infra` | Life Infrastructure |
| `relation` | Relationships |

---

## PHASE 1 — Project Scaffold

### Prompt 1 — Init repo structure

```
Create a new project called gsd-app with this structure:

index.html        ← main app shell
css/
  app.css         ← all styles
js/
  app.js          ← main entry point
  config.js       ← API base URL and auth token
  data.js         ← all API calls (no logic)
  render.js       ← all DOM rendering (no logic)
  state.js        ← in-memory state management
  drag.js         ← drag and drop engine
  triage.js       ← triage panel logic
worker/
  index.js        ← Cloudflare Worker (API)
  schema.sql      ← D1 schema
.github/
  workflows/
    deploy.yml    ← GitHub Pages deploy on push to main
README.md

No frameworks. Vanilla JS ES modules. No build step required.
```

---

### Prompt 2 — D1 schema

```
Write worker/schema.sql for a D1 database called gsd-db with these tables:

tasks:
  id INTEGER PRIMARY KEY AUTOINCREMENT
  title TEXT NOT NULL
  bucket TEXT NOT NULL        -- career | craft | leverage | infra | relation
  project_id INTEGER REFERENCES projects(id)
  status TEXT DEFAULT 'backlog'  -- backlog | active | blocked | done
  horizon TEXT DEFAULT 'now'     -- now | next | later
  size TEXT DEFAULT 'M'          -- S | M | L
  is_mit INTEGER DEFAULT 0
  sort_order INTEGER DEFAULT 0
  created_at TEXT DEFAULT (datetime('now'))
  updated_at TEXT DEFAULT (datetime('now'))

projects:
  id INTEGER PRIMARY KEY AUTOINCREMENT
  title TEXT NOT NULL
  bucket TEXT NOT NULL
  status TEXT DEFAULT 'active'
  sort_order INTEGER DEFAULT 0

ideas:
  id INTEGER PRIMARY KEY AUTOINCREMENT
  title TEXT NOT NULL
  bucket TEXT NOT NULL
  type TEXT DEFAULT 'idea'  -- idea | someday
  note TEXT
  created_at TEXT DEFAULT (datetime('now'))

inbox:
  id INTEGER PRIMARY KEY AUTOINCREMENT
  text TEXT NOT NULL
  source TEXT DEFAULT 'manual'   -- manual | reminders
  reminders_id TEXT              -- Apple Reminders external ID for dedup
  created_at TEXT DEFAULT (datetime('now'))

Include CREATE INDEX statements for bucket, status, horizon, and is_mit on the tasks table.
```

---

### Prompt 3 — Cloudflare Worker API

```
Write worker/index.js as a Cloudflare Worker REST API for the gsd-db D1 database.

Endpoints needed:

GET    /api/tasks              → all non-done tasks, ordered by sort_order
GET    /api/tasks?status=done  → done tasks (separate call)
POST   /api/tasks              → create task
PATCH  /api/tasks/:id          → update any fields
DELETE /api/tasks/:id          → delete task

GET    /api/projects           → all projects
POST   /api/projects           → create project
PATCH  /api/projects/:id       → update project

GET    /api/ideas              → all ideas
POST   /api/ideas              → create idea
DELETE /api/ideas/:id          → delete idea
PATCH  /api/ideas/:id/promote  → convert idea to task (creates task, deletes idea)

GET    /api/inbox              → all inbox items, newest first
POST   /api/inbox              → add item (check reminders_id for dedup)
DELETE /api/inbox/:id          → delete inbox item
POST   /api/inbox/:id/file     → file inbox item:
                                  accepts { bucket, project_id, horizon, type }
                                  if type is task → insert into tasks, delete from inbox
                                  if type is idea/someday → insert into ideas, delete from inbox

All responses: { data, error }
CORS headers required for github.io origin.
Add a bearer token check on all write operations using an AUTH_TOKEN environment variable.
```

---

### Prompt 4 — wrangler.toml + deploy script

```
Write wrangler.toml for a Cloudflare Worker called gsd-worker with:
- D1 database binding named DB pointing to gsd-db
- An AUTH_TOKEN secret (not hardcoded)
- Routes configured for production
- Compatibility date set to today

Also write a deploy.sh script that:
1. Runs wrangler d1 execute gsd-db --file=worker/schema.sql
2. Runs wrangler deploy
```

---

## PHASE 2 — Frontend Core

### Prompt 5 — State module

```
Write js/state.js as the single source of truth for the GSD app.

It should hold:
- tasks: []
- projects: []
- ideas: []
- inbox: []
- ui: { currentTab, activeFilter, focusMode, triageItemId }

Export:
- getState()         → full state snapshot
- setState(patch)    → merge patch, trigger re-render
- loadAll()          → fetch tasks, projects, ideas, inbox from API in
                       parallel, populate state
- subscribe(fn)      → register a render callback
- unsubscribe(fn)    → remove a render callback

The API base URL and auth token should be read from js/config.js (not hardcoded).
```

---

### Prompt 6 — Data module

```
Write js/data.js with one exported async function per API endpoint.

Functions:
  fetchTasks()
  createTask(payload)
  updateTask(id, patch)
  deleteTask(id)

  fetchProjects()
  createProject(payload)
  updateProject(id, patch)

  fetchIdeas()
  createIdea(payload)
  deleteIdea(id)
  promoteIdea(id)

  fetchInbox()
  addToInbox(text, source, remindersId)
  deleteInboxItem(id)
  fileInboxItem(id, payload)

All functions:
- Read API_BASE and AUTH_TOKEN from js/config.js
- Include Authorization: Bearer header on write operations
- Return parsed { data, error }
- Log errors to console, never throw
```

---

### Prompt 7 — Render module

```
Write js/render.js with these exported functions, each taking state as
input and returning HTML strings (no direct DOM mutation except a single
mount point):

  renderToday(state)   → MIT column (5 slots max) + Active tasks column
  renderBoard(state)   → 4-column Kanban (backlog/active/blocked/done)
  renderTriage(state)  → inbox queue + AI suggestion panel
  renderIdeas(state)   → filtered idea shelf (ideas vs someday/maybe)
  renderWeekly(state)  → promote/prune weekly review

Each task card must render with:
- data-id and data-type attributes for the drag engine
- data-bucket for color theming
- Correct action buttons per context (MIT button, done button, etc.)

Bucket tint colors (soft background, muted text — no solid fills):
  career:   bg rgba(107,143,168,.13)  text #4a7a96
  craft:    bg rgba(196,98,45,.12)    text #a84f22
  leverage: bg rgba(122,110,138,.12)  text #635878
  infra:    bg rgba(106,143,114,.13)  text #456b4e
  relation: bg rgba(160,96,112,.12)   text #8a4a5a

No inline styles except these dynamic bucket tint colors.
Use CSS class names from css/app.css.
```

---

### Prompt 8 — Drag engine

```
Write js/drag.js as a self-contained drag and drop engine.

Desktop (HTML5 drag API):
- Draggable elements: [data-type="task-card"] and [data-type="mit-card"]
- Drop zones:
    [data-type="mit-slot"]  → promote to MIT
    #active-list            → demote from MIT
    .kanban-col-body        → change task status

- On drop to mit-slot:
    updateTask(id, { is_mit: 1, status: 'active', horizon: 'now' })
- On drop to #active-list from MIT:
    updateTask(id, { is_mit: 0 })
- On drop to .kanban-col-body:
    updateTask(id, { status: col.dataset.col })
    if status === 'done': also set is_mit: 0
    if status === 'active': also set horizon: 'now'

Show a styled drag ghost with the task title during drag.

Mobile (touch events):
- Long press 500ms → open context menu
- Long press 700ms → enter drag mode with ghost element
- Drop detection via elementFromPoint on touchend
- Haptic feedback via navigator.vibrate where available
- Clear timers on touchcancel

Export attachDragListeners() — call after every render.
```

---

### Prompt 9 — Triage AI suggestions

```
Write js/triage.js with a function suggestTriage(text) that calls the
Anthropic API to suggest how to file an inbox item.

Input:  raw text string from inbox
Output: { bucket, horizon, type }

Use this exact system prompt:
"You are a personal productivity assistant. The user has these life
buckets: career (IU Health data analytics work), craft (YourStory Home
Design woodworking business), leverage (Retooling Retirement YouTube
channel and digital products), infra (health, systems, home projects),
relation (marriage and personal life). Given an inbox item, respond with
ONLY valid JSON with no markdown: { bucket, horizon, type } where bucket
is one of the five keys above, horizon is now/next/later, and type is
task/idea/someday."

Implementation:
- Cache suggestions in sessionStorage keyed by a hash of the text
  (so repeated triage of the same item doesn't re-call the API)
- Return null if the API call fails — the UI falls back to manual selection
- Never throw, always handle errors gracefully
```

---

## PHASE 3 — Integration & Deploy

### Prompt 10 — Wire app.js

```
Write js/app.js as the main entry point. Keep it under 150 lines.
All logic lives in the other modules — app.js only wires things together.

On DOMContentLoaded:
1. Call state.loadAll()
2. Subscribe render functions to state changes
3. Wire tab navigation (Today / Board / Triage / Ideas / Weekly)
4. Wire Add Task modal:
     - form submit → data.createTask(payload) → state.loadAll()
     - Cmd+K (or Ctrl+K) → open modal
     - Escape → close modal
5. Wire Focus Mode toggle (show only MITs, hide everything else)
6. Wire context menu:
     - right-click on task card → show menu
     - menu actions call data module then state.loadAll()
7. Call drag.attachDragListeners() after every render cycle
8. Wire sidebar bucket/horizon/project filters → setState({ activeFilter })
```

---

### Prompt 11 — GitHub Pages deploy

```
Set up GitHub Pages deployment for gsd-app.

Create .github/workflows/deploy.yml:
- Trigger: push to main branch
- Deploy index.html, css/, and js/ to GitHub Pages
- Inject API_BASE and AUTH_TOKEN from GitHub Actions secrets into index.html
  at deploy time using sed or envsubst

Create js/config.js:
- Export API_BASE and AUTH_TOKEN read from window.__GSD_CONFIG
- window.__GSD_CONFIG is set by a <script> block in index.html

Create config.example.js showing the shape with placeholder values.

The auth token must never be hardcoded in source files.
```

---

### Prompt 12 — Apple Reminders Shortcut

```
Write step-by-step instructions for building an Apple Shortcut that syncs
Apple Reminders to the GSD inbox.

The Shortcut should:
1. Run on demand ("Hey Siri, sync my inbox") or on a schedule
2. Get all incomplete reminders from a list called "GSD Inbox"
3. For each reminder:
   a. POST to https://gsd-worker.YOUR_SUBDOMAIN.workers.dev/api/inbox
      Body:    { "text": reminder.title, "source": "reminders",
                 "reminders_id": reminder.identifier }
      Headers: { "Authorization": "Bearer YOUR_AUTH_TOKEN",
                 "Content-Type": "application/json" }
   b. If the POST returns success (status 200):
      mark the reminder complete in Apple Reminders
4. Show a notification: "Synced X items to GSD inbox"

Format the output as numbered Shortcut actions exactly as they appear
in the iOS Shortcuts app. Include the exact JSON body structure.

Note: The reminders_id field prevents duplicate imports if the Shortcut
runs more than once before triage.
```

---

## PHASE 4 — Polish

*Run these prompts after Phase 3 is deployed and working.*

### Prompt 13 — Completion animation

```
Add a task completion animation to js/render.js and js/app.js.

When markDone(id) is called:
1. Find the card in the DOM by data-id
2. Strikethrough the title, fade text color to muted (#a8957e)
3. Flash the card border sage green (#6a8f72)
4. Pop a ✓ checkmark overlay using CSS keyframe animation: checkPop
   (scale from .6 → 1.15 → 1, opacity 0 → 1)
5. After 420ms: fade card opacity to 0, scale to .95
6. After 570ms: collapse card height and padding to 0
7. After 750ms: call data.updateTask(id, { status: 'done' }), then
   state.loadAll()

Total animation duration: ~750ms
```

---

### Prompt 14 — Empty states

```
Add empty state components to js/render.js for each view.

Today — no MITs:
  "Nothing promoted yet — drag a task here or right-click to Set as MIT"

Today — no active tasks:
  "All clear. Add a task or promote something from your backlog."

Board — empty column:
  Subtle dashed placeholder card, no text

Triage — inbox empty:
  Large ✓ icon and "Inbox zero — you're all caught up"

Ideas — no ideas:
  "No ideas yet. They'll land here during triage."

Weekly — nothing to promote:
  "Horizons are balanced. Check back after a busy week."

Style rules:
- Warm, calm copy
- No exclamation points except on "Inbox zero"
- Muted text color (var(--text3))
- Centered, generous padding
```

---

## Build Sequence & Estimated Sessions

| Phase | Prompts | Sessions |
|---|---|---|
| Phase 1 — Scaffold + Worker | 1–4 | 1–2 |
| Phase 2 — Frontend modules | 5–9 | 2 |
| Phase 3 — Integration + Deploy | 10–12 | 1 |
| Phase 4 — Polish | 13–14 | 1 |

**Total: 4–6 Claude Code sessions**

---

## Key Design Decisions (reference these if Claude Code asks)

- **Views are filters, not data.** One task exists once. Views are lenses.
- **Only `Now` tasks can enter Active status.**
- **MIT hard cap is 5.** Enforce in both UI and API.
- **AI triage suggests, never decides.** User always confirms.
- **Apple Reminders is capture only.** D1 is the system of record.
- **No calendar integration yet.** No notifications yet. No dependencies yet.
- **The goal is a clarity engine, not a life OS.**

---

## Prototype Reference

The validated HTML prototype lives at:
`sbozzone.github.io/gsd-app/prototype/gsd.html`

Copy `css/app.css` class names directly from the prototype.
Do not redesign — the aesthetic is locked in.

---

*GSD v1.0 spec — built for Stephen Bozzone*

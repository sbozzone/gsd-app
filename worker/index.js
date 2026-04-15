// worker/index.js — Cloudflare Worker REST API for gsd-db

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  'https://sbozzone.github.io',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

function json(data, status = 200) {
  return new Response(JSON.stringify({ data, error: null }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function err(message, status = 400) {
  return new Response(JSON.stringify({ data: null, error: message }), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function authorized(request, env) {
  const header = request.headers.get('Authorization') || '';
  return header === `Bearer ${env.AUTH_TOKEN}`;
}

function requireAuth(request, env) {
  if (!authorized(request, env)) return err('Unauthorized', 401);
  return null;
}

// ── ROUTER ──────────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const url    = new URL(request.url);
    const method = request.method;
    const path   = url.pathname;

    // Preflight
    if (method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    try {
      // ── TASKS ──
      if (path === '/api/tasks') {
        if (method === 'GET')  return handleGetTasks(url, env);
        if (method === 'POST') return handleCreateTask(request, env);
      }
      const taskMatch = path.match(/^\/api\/tasks\/(\d+)$/);
      if (taskMatch) {
        const id = Number(taskMatch[1]);
        if (method === 'PATCH')  return handleUpdateTask(id, request, env);
        if (method === 'DELETE') return handleDeleteTask(id, request, env);
      }

      // ── PROJECTS ──
      if (path === '/api/projects') {
        if (method === 'GET')  return handleGetProjects(env);
        if (method === 'POST') return handleCreateProject(request, env);
      }
      const projMatch = path.match(/^\/api\/projects\/(\d+)$/);
      if (projMatch) {
        const id = Number(projMatch[1]);
        if (method === 'PATCH') return handleUpdateProject(id, request, env);
      }

      // ── IDEAS ──
      if (path === '/api/ideas') {
        if (method === 'GET')  return handleGetIdeas(env);
        if (method === 'POST') return handleCreateIdea(request, env);
      }
      const ideaMatch = path.match(/^\/api\/ideas\/(\d+)$/);
      if (ideaMatch) {
        const id = Number(ideaMatch[1]);
        if (method === 'DELETE') return handleDeleteIdea(id, request, env);
      }
      const ideaPromoteMatch = path.match(/^\/api\/ideas\/(\d+)\/promote$/);
      if (ideaPromoteMatch) {
        const id = Number(ideaPromoteMatch[1]);
        if (method === 'PATCH') return handlePromoteIdea(id, request, env);
      }

      // ── INBOX ──
      if (path === '/api/inbox') {
        if (method === 'GET')  return handleGetInbox(env);
        if (method === 'POST') return handleAddInbox(request, env);
      }
      const inboxMatch = path.match(/^\/api\/inbox\/(\d+)$/);
      if (inboxMatch) {
        const id = Number(inboxMatch[1]);
        if (method === 'DELETE') return handleDeleteInbox(id, request, env);
      }
      const inboxFileMatch = path.match(/^\/api\/inbox\/(\d+)\/file$/);
      if (inboxFileMatch) {
        const id = Number(inboxFileMatch[1]);
        if (method === 'POST') return handleFileInbox(id, request, env);
      }

      // ── AI SUGGEST ──
      if (path === '/api/suggest' && method === 'POST') return handleSuggest(request, env);

      return err('Not found', 404);
    } catch (e) {
      return err(e.message || 'Internal error', 500);
    }
  },
};

// ── AI TRIAGE SUGGEST ────────────────────────────────────────────────────────

async function handleSuggest(request, env) {
  const deny = requireAuth(request, env);
  if (deny) return deny;

  const { text } = await request.json();
  if (!text) return err('text is required');

  if (!env.ANTHROPIC_API_KEY) return err('AI not configured', 503);

  const system = `You are a personal productivity assistant. The user has these life buckets: career (IU Health data analytics work), craft (YourStory Home Design woodworking business), leverage (Retooling Retirement YouTube channel and digital products), infra (health, systems, home projects), relation (marriage and personal life). Given an inbox item, respond with ONLY valid JSON with no markdown: { bucket, horizon, type } where bucket is one of the five keys above, horizon is now/next/later, and type is task/idea/someday.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model:      'claude-haiku-4-5',
      max_tokens: 128,
      system,
      messages: [{ role: 'user', content: text }],
    }),
  });

  if (!res.ok) return err('AI request failed', 502);

  const ai   = await res.json();
  const raw  = ai.content?.[0]?.text?.trim();
  try {
    const parsed = JSON.parse(raw);
    return json(parsed);
  } catch {
    return err('AI returned unparseable response', 502);
  }
}

// ── TASKS ───────────────────────────────────────────────────────────────────

async function handleGetTasks(url, env) {
  const status = url.searchParams.get('status');
  let query, rows;

  if (status === 'done') {
    rows = await env.DB.prepare(
      `SELECT * FROM tasks WHERE status = 'done' ORDER BY updated_at DESC`
    ).all();
  } else {
    rows = await env.DB.prepare(
      `SELECT * FROM tasks WHERE status != 'done' ORDER BY sort_order ASC, id ASC`
    ).all();
  }
  return json(rows.results);
}

async function handleCreateTask(request, env) {
  const deny = requireAuth(request, env);
  if (deny) return deny;

  const body = await request.json();
  const { title, bucket, project_id, status, horizon, size, is_mit, sort_order } = body;
  if (!title || !bucket) return err('title and bucket are required');

  const result = await env.DB.prepare(
    `INSERT INTO tasks (title, bucket, project_id, status, horizon, size, is_mit, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    title,
    bucket,
    project_id ?? null,
    status     ?? 'backlog',
    horizon    ?? 'now',
    size       ?? 'M',
    is_mit     ?? 0,
    sort_order ?? 0,
  ).run();

  const row = await env.DB.prepare(`SELECT * FROM tasks WHERE id = ?`)
    .bind(result.meta.last_row_id).first();
  return json(row, 201);
}

async function handleUpdateTask(id, request, env) {
  const deny = requireAuth(request, env);
  if (deny) return deny;

  const body  = await request.json();
  const fields = ['title','bucket','project_id','status','horizon','size','is_mit','sort_order'];
  const updates = [];
  const values  = [];

  for (const f of fields) {
    if (f in body) { updates.push(`${f} = ?`); values.push(body[f]); }
  }
  if (updates.length === 0) return err('No fields to update');

  updates.push(`updated_at = datetime('now')`);
  values.push(id);

  await env.DB.prepare(
    `UPDATE tasks SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const row = await env.DB.prepare(`SELECT * FROM tasks WHERE id = ?`).bind(id).first();
  if (!row) return err('Not found', 404);
  return json(row);
}

async function handleDeleteTask(id, request, env) {
  const deny = requireAuth(request, env);
  if (deny) return deny;

  await env.DB.prepare(`DELETE FROM tasks WHERE id = ?`).bind(id).run();
  return json({ deleted: id });
}

// ── PROJECTS ────────────────────────────────────────────────────────────────

async function handleGetProjects(env) {
  const rows = await env.DB.prepare(
    `SELECT * FROM projects WHERE status = 'active' ORDER BY sort_order ASC, id ASC`
  ).all();
  return json(rows.results);
}

async function handleCreateProject(request, env) {
  const deny = requireAuth(request, env);
  if (deny) return deny;

  const body = await request.json();
  const { title, bucket, sort_order } = body;
  if (!title || !bucket) return err('title and bucket are required');

  const result = await env.DB.prepare(
    `INSERT INTO projects (title, bucket, sort_order) VALUES (?, ?, ?)`
  ).bind(title, bucket, sort_order ?? 0).run();

  const row = await env.DB.prepare(`SELECT * FROM projects WHERE id = ?`)
    .bind(result.meta.last_row_id).first();
  return json(row, 201);
}

async function handleUpdateProject(id, request, env) {
  const deny = requireAuth(request, env);
  if (deny) return deny;

  const body   = await request.json();
  const fields = ['title','bucket','status','sort_order'];
  const updates = [];
  const values  = [];

  for (const f of fields) {
    if (f in body) { updates.push(`${f} = ?`); values.push(body[f]); }
  }
  if (updates.length === 0) return err('No fields to update');

  values.push(id);
  await env.DB.prepare(
    `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`
  ).bind(...values).run();

  const row = await env.DB.prepare(`SELECT * FROM projects WHERE id = ?`).bind(id).first();
  if (!row) return err('Not found', 404);
  return json(row);
}

// ── IDEAS ───────────────────────────────────────────────────────────────────

async function handleGetIdeas(env) {
  const rows = await env.DB.prepare(
    `SELECT * FROM ideas ORDER BY created_at DESC`
  ).all();
  return json(rows.results);
}

async function handleCreateIdea(request, env) {
  const deny = requireAuth(request, env);
  if (deny) return deny;

  const body = await request.json();
  const { title, bucket, type, note } = body;
  if (!title || !bucket) return err('title and bucket are required');

  const result = await env.DB.prepare(
    `INSERT INTO ideas (title, bucket, type, note) VALUES (?, ?, ?, ?)`
  ).bind(title, bucket, type ?? 'idea', note ?? null).run();

  const row = await env.DB.prepare(`SELECT * FROM ideas WHERE id = ?`)
    .bind(result.meta.last_row_id).first();
  return json(row, 201);
}

async function handleDeleteIdea(id, request, env) {
  const deny = requireAuth(request, env);
  if (deny) return deny;

  await env.DB.prepare(`DELETE FROM ideas WHERE id = ?`).bind(id).run();
  return json({ deleted: id });
}

async function handlePromoteIdea(id, request, env) {
  const deny = requireAuth(request, env);
  if (deny) return deny;

  const idea = await env.DB.prepare(`SELECT * FROM ideas WHERE id = ?`).bind(id).first();
  if (!idea) return err('Idea not found', 404);

  const result = await env.DB.prepare(
    `INSERT INTO tasks (title, bucket, status, horizon, size)
     VALUES (?, ?, 'backlog', 'now', 'M')`
  ).bind(idea.title, idea.bucket).run();

  await env.DB.prepare(`DELETE FROM ideas WHERE id = ?`).bind(id).run();

  const task = await env.DB.prepare(`SELECT * FROM tasks WHERE id = ?`)
    .bind(result.meta.last_row_id).first();
  return json(task);
}

// ── INBOX ───────────────────────────────────────────────────────────────────

async function handleGetInbox(env) {
  const rows = await env.DB.prepare(
    `SELECT * FROM inbox ORDER BY created_at DESC`
  ).all();
  return json(rows.results);
}

async function handleAddInbox(request, env) {
  const deny = requireAuth(request, env);
  if (deny) return deny;

  const body = await request.json();
  const { text, source, reminders_id } = body;
  if (!text) return err('text is required');

  // Dedup by reminders_id
  if (reminders_id) {
    const existing = await env.DB.prepare(
      `SELECT id FROM inbox WHERE reminders_id = ?`
    ).bind(reminders_id).first();
    if (existing) return json(existing); // already imported
  }

  const result = await env.DB.prepare(
    `INSERT INTO inbox (text, source, reminders_id) VALUES (?, ?, ?)`
  ).bind(text, source ?? 'manual', reminders_id ?? null).run();

  const row = await env.DB.prepare(`SELECT * FROM inbox WHERE id = ?`)
    .bind(result.meta.last_row_id).first();
  return json(row, 201);
}

async function handleDeleteInbox(id, request, env) {
  const deny = requireAuth(request, env);
  if (deny) return deny;

  await env.DB.prepare(`DELETE FROM inbox WHERE id = ?`).bind(id).run();
  return json({ deleted: id });
}

async function handleFileInbox(id, request, env) {
  const deny = requireAuth(request, env);
  if (deny) return deny;

  const item = await env.DB.prepare(`SELECT * FROM inbox WHERE id = ?`).bind(id).first();
  if (!item) return err('Inbox item not found', 404);

  const body = await request.json();
  const { bucket, project_id, horizon, type } = body;
  if (!bucket) return err('bucket is required');

  let result;

  if (type === 'task') {
    result = await env.DB.prepare(
      `INSERT INTO tasks (title, bucket, project_id, status, horizon, size)
       VALUES (?, ?, ?, 'backlog', ?, 'M')`
    ).bind(item.text, bucket, project_id ?? null, horizon ?? 'now').run();

    const task = await env.DB.prepare(`SELECT * FROM tasks WHERE id = ?`)
      .bind(result.meta.last_row_id).first();
    await env.DB.prepare(`DELETE FROM inbox WHERE id = ?`).bind(id).run();
    return json(task);
  }

  // idea or someday
  result = await env.DB.prepare(
    `INSERT INTO ideas (title, bucket, type) VALUES (?, ?, ?)`
  ).bind(item.text, bucket, type ?? 'idea').run();

  const idea = await env.DB.prepare(`SELECT * FROM ideas WHERE id = ?`)
    .bind(result.meta.last_row_id).first();
  await env.DB.prepare(`DELETE FROM inbox WHERE id = ?`).bind(id).run();
  return json(idea);
}

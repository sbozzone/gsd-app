// js/render.js — all DOM rendering, no business logic.
// Each function reads state and updates its own panel containers.

// ── Constants ──────────────────────────────────────────────────────────────
const BUCKET_TINTS = {
  career:   { bg: 'rgba(107,143,168,.13)', color: '#4a7a96' },
  craft:    { bg: 'rgba(196,98,45,.12)',   color: '#a84f22' },
  leverage: { bg: 'rgba(122,110,138,.12)', color: '#635878' },
  infra:    { bg: 'rgba(106,143,114,.13)', color: '#456b4e' },
  relation: { bg: 'rgba(160,96,112,.12)',  color: '#8a4a5a' },
};
const BUCKET_LABEL = {
  career: 'Career', craft: 'Craft', leverage: 'Leverage',
  infra: 'Life Infra', relation: 'Relationships',
};
const HORIZON_COLOR = { now: '#b05520', next: '#5a7e96', later: '#b0a090' };
const KANBAN_COLS   = ['backlog','active','blocked','done'];
const KANBAN_INDICATOR = { backlog:'#b0a090', active:'#6a8f72', blocked:'#b04040', done:'#6b8fa8' };

// ── Helpers ────────────────────────────────────────────────────────────────
function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function bucketTag(b) {
  const t = BUCKET_TINTS[b] || { bg: 'rgba(0,0,0,.07)', color: '#666' };
  return `<span class="tag tag-bucket" style="background:${t.bg};color:${t.color}">${BUCKET_LABEL[b] || b}</span>`;
}
function horizonTag(h) {
  const c = HORIZON_COLOR[h] || '#555';
  return `<span class="tag tag-horizon" style="border-color:${c};color:${c}">${h.toUpperCase()}</span>`;
}
function sizeTag(s) {
  return `<span class="tag tag-size">${esc(s)}</span>`;
}
function projectTag(projectId, projects) {
  const p = projects.find(x => x.id === projectId);
  return p ? `<span class="tag tag-project">↳ ${esc(p.title)}</span>` : '';
}

function applyFilter(tasks, filter) {
  if (!filter || filter.value === 'all') return tasks;
  if (filter.type === 'bucket')  return tasks.filter(t => t.bucket     === filter.value);
  if (filter.type === 'horizon') return tasks.filter(t => t.horizon    === filter.value);
  if (filter.type === 'project') return tasks.filter(t => String(t.project_id) === String(filter.value));
  return tasks;
}

function taskCard(task, projects, { showMitBtn = false } = {}) {
  const mitBtn  = showMitBtn ? `<button class="task-action-btn" data-action="mit" data-id="${task.id}">⚡ MIT</button>` : '';
  const editBtn = `<button class="task-action-btn" data-action="edit-task" data-id="${task.id}">✎</button>`;
  const doneBtn = `<button class="task-action-btn" data-action="done" data-id="${task.id}">✓</button>`;
  const isMit   = task.is_mit ? ' is-mit' : '';
  return `<div class="task-card${isMit}" draggable="true"
              data-id="${task.id}" data-type="task-card" data-bucket="${esc(task.bucket)}">
    <div class="task-card-left">
      <div class="task-card-title">${esc(task.title)}</div>
      <div class="task-card-meta">
        ${bucketTag(task.bucket)}
        ${horizonTag(task.horizon)}
        ${sizeTag(task.size)}
        ${projectTag(task.project_id, projects)}
      </div>
    </div>
    <div class="task-card-actions">${mitBtn}${editBtn}${doneBtn}</div>
  </div>`;
}

function emptyState(icon, msg) {
  return `<div class="empty-state">
    <div class="empty-state-icon">${icon}</div>
    <div>${msg}</div>
  </div>`;
}

function el(id) { return document.getElementById(id); }

// ── TODAY ──────────────────────────────────────────────────────────────────
export function renderToday(state) {
  const { tasks, projects, ui } = state;
  const mits   = tasks.filter(t => t.is_mit && t.status !== 'done');
  const active = applyFilter(tasks.filter(t => !t.is_mit && t.status !== 'done'), ui.activeFilter);

  // Date header
  const dateEl = el('today-date');
  if (dateEl) {
    const d = new Date();
    dateEl.textContent = d.toLocaleDateString('en-US',
      { weekday:'short', month:'short', day:'numeric', year:'numeric' }).toUpperCase();
  }

  // MIT slots (5)
  let mitHtml = '';
  for (let i = 0; i < 5; i++) {
    const t = mits[i];
    if (t) {
      mitHtml += `<div class="mit-slot filled" draggable="true"
          data-id="${t.id}" data-type="mit-card" data-bucket="${esc(t.bucket)}">
        <div class="mit-slot-num">${i + 1}</div>
        <div class="mit-task-content">
          <div class="mit-task-title">${esc(t.title)}</div>
          <div class="mit-task-meta">${bucketTag(t.bucket)}${sizeTag(t.size)}</div>
        </div>
        <button class="mit-remove" data-action="unmit" data-id="${t.id}">✕</button>
      </div>`;
    } else {
      mitHtml += `<div class="mit-slot" data-slot="${i}" data-type="mit-slot">
        <div class="mit-slot-num">${i + 1}</div>
        <div class="mit-empty-text">drop a task here</div>
      </div>`;
    }
  }
  el('mit-list').innerHTML = mitHtml;

  // WIP bar
  const pct = Math.round((mits.length / 5) * 100);
  el('mit-fill').style.width = pct + '%';
  el('mit-wip-label').textContent = `${mits.length} / 5 COMMITTED`;

  // Active list
  el('active-list').innerHTML = active.length
    ? active.map(t => taskCard(t, projects, { showMitBtn: true })).join('')
    : emptyState('', 'All clear. Add a task or promote something from your backlog.');

  // Populate project dropdown in modal
  _populateProjectSelect(projects);
}

function _populateProjectSelect(projects) {
  const sel = el('new-project');
  if (!sel) return;
  const current = sel.value;
  sel.innerHTML = '<option value="">— none —</option>' +
    projects.map(p => `<option value="${p.id}">${esc(p.title)}</option>`).join('');
  if (current) sel.value = current;
}

// ── BOARD ──────────────────────────────────────────────────────────────────
export function renderBoard(state) {
  const { tasks, projects, ui } = state;
  const filtered = applyFilter(tasks, ui.activeFilter);

  const subtitle = el('board-subtitle');
  if (subtitle) {
    subtitle.textContent = ui.activeFilter?.value === 'all'
      ? 'ALL BUCKETS'
      : (BUCKET_LABEL[ui.activeFilter?.value] || ui.activeFilter?.value || 'ALL BUCKETS').toUpperCase();
  }

  el('kanban-layout').innerHTML = KANBAN_COLS.map(col => {
    const colTasks = filtered.filter(t => t.status === col);
    return `<div class="kanban-col">
      <div class="kanban-col-header">
        <div class="kanban-col-indicator" style="background:${KANBAN_INDICATOR[col]}"></div>
        <div class="kanban-col-title">${col}</div>
        <div class="kanban-col-count">${colTasks.length}</div>
      </div>
      <div class="kanban-col-body" data-col="${col}" data-type="kanban-col">
        ${colTasks.length
          ? colTasks.map(t => taskCard(t, projects)).join('')
          : `<div class="mit-slot empty-state-dashed" style="min-height:54px;margin:4px 0"></div>`}
      </div>
    </div>`;
  }).join('');
}

// ── TRIAGE ─────────────────────────────────────────────────────────────────
export function renderTriage(state) {
  const { inbox, ui } = state;

  // Inbox badge
  const badge = el('inbox-count');
  if (badge) badge.textContent = inbox.length;

  // Queue
  el('inbox-list').innerHTML = inbox.length
    ? inbox.map(item => `<div class="inbox-item${ui.triageItemId === item.id ? ' active-triage' : ''}"
          data-action="triage-select" data-id="${item.id}">
        ${esc(item.text)}
        <div class="inbox-item-time">${_relativeTime(item.created_at)}</div>
      </div>`).join('')
    : emptyState('✓', 'Inbox zero — you\'re all caught up!');

  // Main panel
  const mainEl = el('triage-main');
  if (!ui.triageItemId || !inbox.length) {
    mainEl.innerHTML = inbox.length
      ? `<div class="empty-state" style="margin:auto">← Select an item to triage</div>`
      : '';
    return;
  }
  const item = inbox.find(x => x.id === ui.triageItemId);
  if (!item) { mainEl.innerHTML = ''; return; }

  mainEl.innerHTML = `<div class="triage-card" id="triage-card-inner">
    <div class="triage-item-title">${esc(item.text)}</div>

    <div>
      <div class="triage-section-label">
        BUCKET <span class="ai-badge" id="ai-badge" style="display:none">AI</span>
      </div>
      <div class="option-grid" id="triage-buckets">
        ${Object.entries(BUCKET_LABEL).map(([k, v]) => {
          const t = BUCKET_TINTS[k];
          return `<button class="option-pill" data-triage-field="bucket" data-value="${k}">
            <span class="pill-dot" style="background:${t.color}"></span>${v}
          </button>`;
        }).join('')}
      </div>
    </div>

    <div>
      <div class="triage-section-label">HORIZON</div>
      <div class="option-grid">
        ${[['now','NOW','#b05520'],['next','NEXT','#5a7e96'],['later','LATER','#b0a090']].map(([k,l,c]) =>
          `<button class="option-pill" data-triage-field="horizon" data-value="${k}">
            <span class="pill-dot" style="background:${c}"></span>${l}
          </button>`).join('')}
      </div>
    </div>

    <div>
      <div class="triage-section-label">FILE AS</div>
      <div class="option-grid">
        ${[['task','Task'],['idea','Idea'],['someday','Someday / Maybe']].map(([k,l]) =>
          `<button class="option-pill" data-triage-field="type" data-value="${k}">${l}</button>`
        ).join('')}
      </div>
    </div>
  </div>
  <div class="triage-actions">
    <button class="btn btn-ghost" data-action="triage-skip" data-id="${item.id}">Skip</button>
    <button class="btn btn-primary" data-action="triage-file" data-id="${item.id}" style="margin-left:auto">
      File →
    </button>
  </div>`;
}

export function applyTriageSuggestion(suggestion) {
  if (!suggestion) return;
  ['bucket','horizon','type'].forEach(field => {
    const val = suggestion[field];
    if (!val) return;
    const pill = document.querySelector(`[data-triage-field="${field}"][data-value="${val}"]`);
    if (pill) pill.classList.add('selected');
  });
  const badge = el('ai-badge');
  if (badge) badge.style.display = 'inline';
}

// ── IDEAS ──────────────────────────────────────────────────────────────────
export function renderIdeas(state) {
  const { ideas, ui } = state;
  const f = ui.ideasFilter || 'all';

  const filtered = ideas.filter(i => {
    if (f === 'all')     return true;
    if (f === 'idea')    return i.type === 'idea';
    if (f === 'someday') return i.type === 'someday';
    return i.bucket === f;
  });

  el('ideas-list').innerHTML = filtered.length
    ? filtered.map(i => `<div class="idea-card" data-id="${i.id}" data-bucket="${esc(i.bucket)}">
        <div class="idea-card-header">
          <div class="idea-card-title">${esc(i.title)}</div>
          <span class="idea-type-badge idea-type-${i.type === 'someday' ? 'someday' : 'idea'}">
            ${i.type === 'someday' ? 'someday' : 'idea'}
          </span>
        </div>
        ${i.note ? `<div style="font-size:12px;color:var(--text3)">${esc(i.note)}</div>` : ''}
        <div class="idea-card-footer">
          ${bucketTag(i.bucket)}
          <button class="task-action-btn" data-action="edit-idea" data-id="${i.id}"
            style="margin-left:auto">✎</button>
          <button class="task-action-btn" data-action="promote-idea" data-id="${i.id}">→ Task</button>
          <button class="task-action-btn" data-action="delete-idea" data-id="${i.id}">✕</button>
        </div>
      </div>`).join('')
    : emptyState('💡', 'No ideas yet. They\'ll land here during triage.');
}

// ── WEEKLY ─────────────────────────────────────────────────────────────────
export function renderWeekly(state) {
  const { tasks, projects } = state;

  const promote = tasks.filter(t => t.horizon === 'next' && t.status !== 'done');
  const pipeline= tasks.filter(t => t.horizon === 'later' && t.status !== 'done');
  const mits    = tasks.filter(t => t.is_mit  && t.status !== 'done');

  function section(title, items, action, actionLabel) {
    return `<div class="week-section">
      <div class="week-section-title">${title}</div>
      ${items.length
        ? items.map(t => `<div style="display:flex;align-items:center;gap:8px">
            ${taskCard(t, projects)}
            <button class="task-action-btn" data-action="${action}" data-id="${t.id}"
              style="flex-shrink:0;opacity:1">${actionLabel}</button>
          </div>`).join('')
        : emptyState('', action === 'promote-now'
            ? 'Horizons are balanced. Check back after a busy week.'
            : 'Pipeline is clear.')}
    </div>`;
  }

  el('weekly-layout').innerHTML =
    section('PROMOTE TO NOW — Next horizon tasks ready to activate', promote, 'promote-now', '→ Now') +
    section('PIPELINE — Later horizon',                               pipeline,'promote-next','→ Next') +
    `<div class="week-section">
      <div class="week-section-title">COMMITTED MITs THIS WEEK</div>
      ${mits.length
        ? mits.map(t => taskCard(t, projects)).join('')
        : emptyState('', 'No MITs set yet this week.')}
    </div>`;
}

// ── FOCUS MODE ─────────────────────────────────────────────────────────────
export function renderFocusMode(state) {
  const mits = state.tasks.filter(t => t.is_mit && t.status !== 'done');
  el('focus-tasks').innerHTML = mits.length
    ? mits.map((t, i) => `<div class="focus-task" data-id="${t.id}">
        <div class="focus-num">${i + 1}</div>
        <div class="focus-task-title">${esc(t.title)}</div>
        <button class="task-action-btn" data-action="done" data-id="${t.id}"
          style="opacity:1">✓ Done</button>
      </div>`).join('')
    : emptyState('⚡', 'No MITs set. Add tasks and promote them to MIT first.');
}

// ── SIDEBAR ────────────────────────────────────────────────────────────────
export function renderSidebar(state) {
  const { tasks, projects, ui } = state;

  // Counts
  const setBucketCount = (val, tasks) => {
    const el2 = document.getElementById(`count-bucket-${val}`);
    if (el2) el2.textContent = tasks.filter(t => val === 'all' || t.bucket === val).length;
  };
  ['all','career','craft','leverage','infra','relation'].forEach(v => setBucketCount(v, tasks));

  ['now','next','later'].forEach(v => {
    const el2 = document.getElementById(`count-horizon-${v}`);
    if (el2) el2.textContent = tasks.filter(t => t.horizon === v).length;
  });

  // Projects
  const projContainer = el('sidebar-projects');
  if (projContainer) {
    projContainer.innerHTML = projects.map(p => `
      <button class="sidebar-item${ui.activeFilter?.type === 'project' && String(ui.activeFilter.value) === String(p.id) ? ' active' : ''}"
        data-filter-type="project" data-filter-value="${p.id}">
        <span class="dot" style="background:${BUCKET_TINTS[p.bucket]?.color || '#555'}"></span>
        ${esc(p.title)}
        <span class="count">${tasks.filter(t => t.project_id === p.id).length}</span>
      </button>`).join('');
  }

  // Highlight active sidebar filter
  document.querySelectorAll('[data-filter-type]').forEach(btn => {
    const isActive = ui.activeFilter?.type  === btn.dataset.filterType &&
                     String(ui.activeFilter?.value) === String(btn.dataset.filterValue);
    btn.classList.toggle('active', isActive);
  });
}

// ── Triage badge ───────────────────────────────────────────────────────────
export function renderBadge(state) {
  const badge = el('triage-badge');
  if (badge) badge.textContent = state.inbox.length || '';
}

// ── Utility ────────────────────────────────────────────────────────────────
function _relativeTime(iso) {
  if (!iso) return '';
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m    = Math.floor(diff / 60000);
    if (m < 1)   return 'just now';
    if (m < 60)  return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  } catch { return ''; }
}

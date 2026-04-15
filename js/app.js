// js/app.js — main entry point. Wires all modules. ~150 lines.
import * as state  from './state.js';
import * as data   from './data.js';
import * as render from './render.js';
import { attachDragListeners } from './drag.js';
import { suggestTriage }       from './triage.js';

// ── Render cycle ───────────────────────────────────────────────────────────
function renderAll(s) {
  render.renderToday(s);
  render.renderBoard(s);
  render.renderTriage(s);
  render.renderIdeas(s);
  render.renderWeekly(s);
  render.renderSidebar(s);
  render.renderBadge(s);
  if (s.ui.focusMode) render.renderFocusMode(s);
  attachDragListeners();
}

// ── Tab switching ──────────────────────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.nav-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.panel').forEach(p => p.classList.toggle('active', p.id === `panel-${tab}`));
  state.setState({ ui: { currentTab: tab } });
}

// ── Add Task Modal ─────────────────────────────────────────────────────────
const openModal  = () => { document.getElementById('modal-overlay').classList.add('active'); document.getElementById('new-title').focus(); };
const closeModal = () => document.getElementById('modal-overlay').classList.remove('active');

// ── Capture Modal ──────────────────────────────────────────────────────────
const openCapture  = () => { document.getElementById('capture-overlay').classList.add('active'); document.getElementById('capture-text').focus(); };
const closeCapture = () => { document.getElementById('capture-overlay').classList.remove('active'); document.getElementById('capture-text').value = ''; };

// ── Toast ──────────────────────────────────────────────────────────────────
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

// ── Completion animation (Prompt 13) ──────────────────────────────────────
async function markDone(id) {
  const card = document.querySelector(`[data-id="${id}"][data-type="task-card"], [data-id="${id}"][data-type="mit-card"]`);
  if (card) {
    const title = card.querySelector('.task-card-title, .mit-task-title, .focus-task-title');
    if (title) { title.style.textDecoration = 'line-through'; title.style.color = '#a8957e'; }
    card.style.borderColor = '#6a8f72';
    const check = document.createElement('div');
    Object.assign(check.style, { position:'absolute', inset:'0', display:'flex', alignItems:'center',
      justifyContent:'center', fontSize:'28px', animation:'checkPop .3s ease forwards', pointerEvents:'none' });
    check.textContent = '✓'; card.style.position = 'relative'; card.appendChild(check);
    setTimeout(() => { card.style.transition = 'opacity .15s, transform .15s'; card.style.opacity = '0'; card.style.transform = 'scale(.95)'; }, 420);
    setTimeout(() => { card.style.transition = 'max-height .18s, padding .18s'; card.style.maxHeight = '0'; card.style.padding = '0'; card.style.overflow = 'hidden'; }, 570);
  }
  setTimeout(async () => {
    await data.updateTask(id, { status: 'done', is_mit: 0 });
    await state.loadAll();
  }, 750);
}

// ── Context menu ───────────────────────────────────────────────────────────
let ctxId = null;
const ctxMenu = () => document.getElementById('ctx-menu');
const hideCtx = () => ctxMenu().classList.remove('active');

function showCtx(e, id) {
  e.preventDefault(); ctxId = id;
  const m = ctxMenu(); m.classList.add('active');
  const x = Math.min(e.clientX, window.innerWidth  - m.offsetWidth  - 8);
  const y = Math.min(e.clientY, window.innerHeight - m.offsetHeight - 8);
  m.style.left = x + 'px'; m.style.top = y + 'px';
}

// ── Search ─────────────────────────────────────────────────────────────────
const BUCKET_TINTS_SEARCH = {
  career:   '#4a7a96', craft: '#a84f22', leverage: '#635878',
  infra:    '#456b4e', relation: '#8a4a5a',
};

function highlight(text, term) {
  if (!term) return text;
  const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi');
  return text.replace(re, '<mark>$1</mark>');
}

function renderSearchResults(query) {
  const resultsEl = document.getElementById('search-results');
  if (!query.trim()) { resultsEl.classList.remove('open'); return; }

  const q   = query.trim().toLowerCase();
  const s   = state.getState();
  const tasks = s.tasks.filter(t => t.title.toLowerCase().includes(q)).slice(0, 8);
  const ideas = s.ideas.filter(i => i.title.toLowerCase().includes(q)).slice(0, 4);

  if (!tasks.length && !ideas.length) {
    resultsEl.innerHTML = `<div class="search-empty">No results for "${query}"</div>`;
    resultsEl.classList.add('open');
    return;
  }

  let html = '';
  if (tasks.length) {
    html += `<div class="search-group-label">Tasks</div>`;
    html += tasks.map((t, i) => `
      <div class="search-result-item" data-search-type="task" data-search-id="${t.id}" data-search-idx="${i}">
        <span style="width:8px;height:8px;border-radius:50%;background:${BUCKET_TINTS_SEARCH[t.bucket]||'#555'};flex-shrink:0"></span>
        <span class="search-result-title">${highlight(t.title, query)}</span>
        <span class="search-result-type">${t.status}</span>
      </div>`).join('');
  }
  if (tasks.length && ideas.length) html += `<div class="search-divider"></div>`;
  if (ideas.length) {
    html += `<div class="search-group-label">Ideas</div>`;
    html += ideas.map((i, idx) => `
      <div class="search-result-item" data-search-type="idea" data-search-id="${i.id}" data-search-idx="${tasks.length + idx}">
        <span style="width:8px;height:8px;border-radius:50%;background:${BUCKET_TINTS_SEARCH[i.bucket]||'#555'};flex-shrink:0"></span>
        <span class="search-result-title">${highlight(i.title, query)}</span>
        <span class="search-result-type">${i.type}</span>
      </div>`).join('');
  }

  resultsEl.innerHTML = html;
  resultsEl.classList.add('open');
  focusedSearchIdx = -1;
}

let focusedSearchIdx = -1;

function navigateSearchResult(dir) {
  const items = document.querySelectorAll('.search-result-item');
  if (!items.length) return;
  items[focusedSearchIdx]?.classList.remove('focused');
  focusedSearchIdx = (focusedSearchIdx + dir + items.length) % items.length;
  items[focusedSearchIdx]?.classList.add('focused');
  items[focusedSearchIdx]?.scrollIntoView({ block: 'nearest' });
}

function selectSearchResult(el) {
  if (!el) return;
  const { searchType, searchId } = el.dataset;
  document.getElementById('search-input').value = '';
  document.getElementById('search-results').classList.remove('open');
  if (searchType === 'task') {
    switchTab('board');
    setTimeout(() => {
      const card = document.querySelector(`[data-id="${searchId}"][data-type="task-card"]`);
      if (card) { card.scrollIntoView({ behavior:'smooth', block:'center' }); card.style.outline = '2px solid var(--accent)'; setTimeout(() => card.style.outline = '', 1500); }
    }, 100);
  } else {
    switchTab('ideas');
    setTimeout(() => {
      const card = document.querySelector(`.idea-card[data-id="${searchId}"]`);
      if (card) { card.scrollIntoView({ behavior:'smooth', block:'center' }); card.style.outline = '2px solid var(--accent)'; setTimeout(() => card.style.outline = '', 1500); }
    }, 100);
  }
}

// ── Triage state ───────────────────────────────────────────────────────────
const triageSel = {};  // { bucket, horizon, type } for current item

// ── DOMContentLoaded ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  state.subscribe(renderAll);
  await state.loadAll();

  // Tab nav
  document.querySelectorAll('.nav-tab').forEach(b =>
    b.addEventListener('click', () => switchTab(b.dataset.tab)));

  // Add task modal
  document.getElementById('add-task-btn').addEventListener('click', openModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeModal(); });
  document.addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); openModal(); }
    if ((e.metaKey || e.ctrlKey) && e.key === 'i') { e.preventDefault(); openCapture(); }
    if (e.key === 'Escape') { closeModal(); closeCapture(); hideCtx(); }
  });
  document.getElementById('modal-submit').addEventListener('click', async () => {
    const title = document.getElementById('new-title').value.trim();
    if (!title) return;
    await data.createTask({ title,
      bucket:     document.getElementById('new-bucket').value,
      horizon:    document.getElementById('new-horizon').value,
      status:     document.getElementById('new-status').value,
      size:       document.getElementById('new-size').value,
      project_id: document.getElementById('new-project').value || null,
    });
    closeModal(); document.getElementById('new-title').value = '';
    await state.loadAll();
  });

  // Capture modal
  document.getElementById('capture-btn').addEventListener('click', openCapture);
  document.getElementById('capture-cancel').addEventListener('click', closeCapture);
  document.getElementById('capture-overlay').addEventListener('click', e => { if (e.target === e.currentTarget) closeCapture(); });
  document.getElementById('capture-submit').addEventListener('click', async () => {
    const text = document.getElementById('capture-text').value.trim();
    if (!text) return;
    await data.addToInbox(text, 'manual', null);
    closeCapture();
    await state.loadAll();
    toast('Captured ✓');
  });
  document.getElementById('capture-text').addEventListener('keydown', async e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('capture-submit').click();
    }
  });

  // Focus mode
  document.getElementById('focus-toggle').addEventListener('click', () => {
    const on = !state.getState().ui.focusMode;
    state.setState({ ui: { focusMode: on } });
    document.getElementById('focus-overlay').classList.toggle('active', on);
    document.getElementById('focus-toggle').classList.toggle('active', on);
    if (on) render.renderFocusMode(state.getState());
  });
  document.getElementById('focus-exit').addEventListener('click', () => {
    state.setState({ ui: { focusMode: false } });
    document.getElementById('focus-overlay').classList.remove('active');
    document.getElementById('focus-toggle').classList.remove('active');
  });

  // Sidebar filters (event delegation — includes dynamically rendered project buttons)
  document.getElementById('sidebar-projects').addEventListener('click', e => handleFilterClick(e));
  document.querySelector('.sidebar').addEventListener('click', e => handleFilterClick(e));
  function handleFilterClick(e) {
    const btn = e.target.closest('[data-filter-type]');
    if (!btn) return;
    state.setState({ ui: { activeFilter: { type: btn.dataset.filterType, value: btn.dataset.filterValue } } });
  }

  // Ideas filter chips
  document.getElementById('ideas-filters').addEventListener('click', e => {
    const chip = e.target.closest('[data-ideas-filter]');
    if (!chip) return;
    document.querySelectorAll('[data-ideas-filter]').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.setState({ ui: { ideasFilter: chip.dataset.ideasFilter } });
  });

  // Global event delegation for action buttons & context menu trigger
  document.addEventListener('click', async e => {
    if (!e.target.closest('#ctx-menu')) hideCtx();
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;

    if (action === 'done')         { await markDone(id); return; }
    if (action === 'mit')          { const mits = state.getState().tasks.filter(t => t.is_mit && t.status !== 'done'); if (mits.length >= 5) { toast('MIT limit is 5 — remove one first'); return; } await data.updateTask(id, { is_mit: 1, status: 'active', horizon: 'now' }); await state.loadAll(); return; }
    if (action === 'unmit')        { await data.updateTask(id, { is_mit: 0 }); await state.loadAll(); return; }
    if (action === 'promote-idea') { await data.promoteIdea(id); await state.loadAll(); toast('Promoted to task'); return; }
    if (action === 'delete-idea')  { if (confirm('Delete this idea?')) { await data.deleteIdea(id); await state.loadAll(); } return; }
    if (action === 'promote-now')  { await data.updateTask(id, { horizon: 'now' });  await state.loadAll(); return; }
    if (action === 'promote-next') { await data.updateTask(id, { horizon: 'next' }); await state.loadAll(); return; }
    if (action === 'triage-skip')  { state.setState({ ui: { triageItemId: null } }); return; }
    if (action === 'triage-file')  { await doFileInbox(id); return; }
    if (action === 'triage-select') { await doSelectTriageItem(id); return; }
    if (action === 'triage-field') return; // handled below via pill clicks
  });

  // Triage option pills
  document.getElementById('triage-main').addEventListener('click', e => {
    const pill = e.target.closest('[data-triage-field]');
    if (!pill) return;
    const { triageField, value } = pill.dataset;
    const field = pill.dataset.triageField;
    document.querySelectorAll(`[data-triage-field="${field}"]`).forEach(p => p.classList.remove('selected'));
    pill.classList.add('selected');
    triageSel[field] = value;
  });

  // Context menu actions
  document.getElementById('ctx-mit').addEventListener('click',          async () => { hideCtx(); if (!ctxId) return; const mits = state.getState().tasks.filter(t => t.is_mit); if (mits.length >= 5) { toast('MIT limit is 5'); return; } await data.updateTask(ctxId, { is_mit: 1, status: 'active', horizon: 'now' }); await state.loadAll(); });
  document.getElementById('ctx-active').addEventListener('click',       async () => { hideCtx(); if (ctxId) { await data.updateTask(ctxId, { status: 'active', horizon: 'now' }); await state.loadAll(); } });
  document.getElementById('ctx-blocked').addEventListener('click',      async () => { hideCtx(); if (ctxId) { await data.updateTask(ctxId, { status: 'blocked' }); await state.loadAll(); } });
  document.getElementById('ctx-done').addEventListener('click',         async () => { hideCtx(); if (ctxId) await markDone(ctxId); });
  document.getElementById('ctx-horizon-now').addEventListener('click',  async () => { hideCtx(); if (ctxId) { await data.updateTask(ctxId, { horizon: 'now' });   await state.loadAll(); } });
  document.getElementById('ctx-horizon-next').addEventListener('click', async () => { hideCtx(); if (ctxId) { await data.updateTask(ctxId, { horizon: 'next' });  await state.loadAll(); } });
  document.getElementById('ctx-horizon-later').addEventListener('click',async () => { hideCtx(); if (ctxId) { await data.updateTask(ctxId, { horizon: 'later' }); await state.loadAll(); } });
  document.getElementById('ctx-delete').addEventListener('click',       async () => { hideCtx(); if (ctxId && confirm('Delete this task?')) { await data.deleteTask(ctxId); await state.loadAll(); } });

  // Right-click on task cards (event delegation)
  document.addEventListener('contextmenu', e => {
    const card = e.target.closest('[data-type="task-card"], [data-type="mit-card"]');
    if (!card) return;
    showCtx(e, card.dataset.id);
  });

  // Search
  const searchInput   = document.getElementById('search-input');
  const searchResults = document.getElementById('search-results');
  searchInput.addEventListener('input',   e => renderSearchResults(e.target.value));
  searchInput.addEventListener('keydown', e => {
    if (e.key === 'ArrowDown')  { e.preventDefault(); navigateSearchResult(1); }
    if (e.key === 'ArrowUp')    { e.preventDefault(); navigateSearchResult(-1); }
    if (e.key === 'Enter')      { selectSearchResult(document.querySelector('.search-result-item.focused') || document.querySelector('.search-result-item')); }
    if (e.key === 'Escape')     { searchInput.value = ''; searchResults.classList.remove('open'); searchInput.blur(); }
  });
  searchResults.addEventListener('click', e => {
    const item = e.target.closest('.search-result-item');
    if (item) selectSearchResult(item);
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-wrap')) searchResults.classList.remove('open');
  });
  // Press '/' to focus search (when not typing elsewhere)
  document.addEventListener('keydown', e => {
    if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
      e.preventDefault(); searchInput.focus();
    }
  });
});

async function doSelectTriageItem(id) {
  Object.keys(triageSel).forEach(k => delete triageSel[k]);
  state.setState({ ui: { triageItemId: Number(id) } });
  const item = state.getState().inbox.find(x => x.id === Number(id));
  if (item) {
    const suggestion = await suggestTriage(item.text);
    if (suggestion) {
      Object.assign(triageSel, suggestion);
      render.applyTriageSuggestion(suggestion);
    }
  }
}

async function doFileInbox(id) {
  const { bucket, horizon, type } = triageSel;
  if (!bucket) { toast('Please select a bucket'); return; }
  await data.fileInboxItem(Number(id), { bucket, horizon: horizon || 'now', type: type || 'task' });
  Object.keys(triageSel).forEach(k => delete triageSel[k]);
  state.setState({ ui: { triageItemId: null } });
  await state.loadAll();
  toast('Filed ✓');
}

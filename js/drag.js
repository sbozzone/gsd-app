// js/drag.js — drag and drop engine (desktop HTML5 + mobile touch).
// Call attachDragListeners() after every render cycle.
import { updateTask } from './data.js';
import { loadAll }    from './state.js';

let ghost = null;
let dragId = null;
let dragType = null;  // 'task-card' | 'mit-card'

// ── Desktop — HTML5 Drag API ───────────────────────────────────────────────

export function attachDragListeners() {
  // Draggables
  document.querySelectorAll('[data-type="task-card"], [data-type="mit-card"]').forEach(el => {
    el.addEventListener('dragstart', onDragStart);
    el.addEventListener('dragend',   onDragEnd);
  });

  // Drop zones
  document.querySelectorAll('[data-type="mit-slot"]').forEach(zone => {
    zone.addEventListener('dragover',  onDragOverZone);
    zone.addEventListener('dragleave', onDragLeaveZone);
    zone.addEventListener('drop',      onDropMitSlot);
  });

  const activeList = document.getElementById('active-list');
  if (activeList) {
    activeList.addEventListener('dragover',  onDragOverZone);
    activeList.addEventListener('dragleave', onDragLeaveZone);
    activeList.addEventListener('drop',      onDropActiveList);
  }

  document.querySelectorAll('.kanban-col-body').forEach(col => {
    col.addEventListener('dragover',  onDragOverZone);
    col.addEventListener('dragleave', onDragLeaveZone);
    col.addEventListener('drop',      onDropKanban);
  });

  // Mobile touch
  document.querySelectorAll('[data-type="task-card"], [data-type="mit-card"]').forEach(el => {
    el.addEventListener('touchstart', onTouchStart,  { passive: true });
    el.addEventListener('touchmove',  onTouchMove,   { passive: false });
    el.addEventListener('touchend',   onTouchEnd);
    el.addEventListener('touchcancel',onTouchCancel);
  });
}

function onDragStart(e) {
  dragId   = e.currentTarget.dataset.id;
  dragType = e.currentTarget.dataset.type;
  e.currentTarget.classList.add('dragging');

  // Ghost label
  ghost = document.createElement('div');
  ghost.className = 'drag-ghost';
  ghost.textContent = e.currentTarget.querySelector('.task-card-title, .mit-task-title')?.textContent || '';
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 0, 0);
  e.dataTransfer.effectAllowed = 'move';
}

function onDragEnd(e) {
  e.currentTarget.classList.remove('dragging');
  ghost?.remove();
  ghost = null;
  dragId = null;
  dragType = null;
  document.querySelectorAll('.drag-over, .drag-over-zone').forEach(el => {
    el.classList.remove('drag-over','drag-over-zone');
  });
}

function onDragOverZone(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  e.currentTarget.classList.add('drag-over');
}
function onDragLeaveZone(e) {
  if (!e.currentTarget.contains(e.relatedTarget)) {
    e.currentTarget.classList.remove('drag-over');
  }
}

async function onDropMitSlot(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!dragId) return;
  // Check MIT cap (5)
  const filled = document.querySelectorAll('[data-type="mit-card"]').length;
  if (dragType !== 'mit-card' && filled >= 5) {
    showToast('MIT limit is 5 — remove one first');
    return;
  }
  await updateTask(dragId, { is_mit: 1, status: 'active', horizon: 'now' });
  await loadAll();
}

async function onDropActiveList(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!dragId || dragType !== 'mit-card') return;
  await updateTask(dragId, { is_mit: 0 });
  await loadAll();
}

async function onDropKanban(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  if (!dragId) return;
  const col    = e.currentTarget.dataset.col;
  const patch  = { status: col };
  if (col === 'done')   patch.is_mit  = 0;
  if (col === 'active') patch.horizon = 'now';
  await updateTask(dragId, patch);
  await loadAll();
}

// ── Mobile — Touch Events ──────────────────────────────────────────────────

let touchTimer  = null;
let touchGhost  = null;
let touchId     = null;
let touchEl     = null;
let touchDragging = false;

function onTouchStart(e) {
  const card = e.currentTarget;
  touchId = card.dataset.id;
  touchEl = card;

  // Long-press 500ms → context menu
  touchTimer = setTimeout(() => {
    if (!touchDragging) {
      navigator.vibrate?.(40);
      card.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true, clientX: e.touches[0].clientX, clientY: e.touches[0].clientY,
      }));
    }
  }, 500);

  // Long-press 700ms → drag mode
  touchTimer2 = setTimeout(() => {
    touchDragging = true;
    navigator.vibrate?.(60);
    touchGhost = document.createElement('div');
    touchGhost.className = 'drag-ghost';
    touchGhost.textContent = card.querySelector('.task-card-title, .mit-task-title')?.textContent || '';
    document.body.appendChild(touchGhost);
    _moveTouchGhost(e.touches[0]);
    card.classList.add('dragging');
  }, 700);
}

let touchTimer2 = null;

function onTouchMove(e) {
  if (!touchDragging) return;
  e.preventDefault();
  _moveTouchGhost(e.touches[0]);
}

function _moveTouchGhost(touch) {
  if (!touchGhost) return;
  touchGhost.style.left = (touch.clientX + 12) + 'px';
  touchGhost.style.top  = (touch.clientY - 20) + 'px';
}

async function onTouchEnd(e) {
  clearTimeout(touchTimer);
  clearTimeout(touchTimer2);
  touchEl?.classList.remove('dragging');
  touchGhost?.remove();
  touchGhost = null;

  if (touchDragging && touchId) {
    const touch = e.changedTouches[0];
    const target = document.elementFromPoint(touch.clientX, touch.clientY);
    const mitSlot    = target?.closest('[data-type="mit-slot"]');
    const activeList = target?.closest('#active-list');
    const kanbanCol  = target?.closest('.kanban-col-body');

    if (mitSlot) {
      const filled = document.querySelectorAll('[data-type="mit-card"]').length;
      if (filled < 5) {
        await updateTask(touchId, { is_mit: 1, status: 'active', horizon: 'now' });
        await loadAll();
      } else {
        showToast('MIT limit is 5 — remove one first');
      }
    } else if (activeList && touchEl?.dataset.type === 'mit-card') {
      await updateTask(touchId, { is_mit: 0 });
      await loadAll();
    } else if (kanbanCol) {
      const col   = kanbanCol.dataset.col;
      const patch = { status: col };
      if (col === 'done')   patch.is_mit  = 0;
      if (col === 'active') patch.horizon = 'now';
      await updateTask(touchId, patch);
      await loadAll();
    }
  }

  touchDragging = false;
  touchId = null;
  touchEl = null;
}

function onTouchCancel() {
  clearTimeout(touchTimer);
  clearTimeout(touchTimer2);
  touchEl?.classList.remove('dragging');
  touchGhost?.remove();
  touchGhost    = null;
  touchDragging = false;
  touchId       = null;
  touchEl       = null;
}

// ── Toast helper (used by drag engine) ────────────────────────────────────
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}

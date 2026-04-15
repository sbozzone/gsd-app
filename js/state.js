// js/state.js — single source of truth for the GSD app.
import { fetchTasks, fetchProjects, fetchIdeas, fetchInbox } from './data.js';

let state = {
  tasks:     [],
  projects:  [],
  ideas:     [],
  inbox:     [],
  ui: {
    currentTab:   'today',
    activeFilter: { type: 'bucket', value: 'all' },
    ideasFilter:  'all',
    focusMode:    false,
    triageItemId: null,
  },
};

const listeners = new Set();

/** Full state snapshot. */
export function getState() {
  return state;
}

/**
 * Merge a shallow patch into state.
 * ui patch is deep-merged so callers can pass { ui: { currentTab: 'board' } }
 * without wiping other ui keys.
 */
export function setState(patch) {
  const next = { ...state, ...patch };
  if (patch.ui) next.ui = { ...state.ui, ...patch.ui };
  state = next;
  listeners.forEach(fn => fn(state));
}

/** Fetch all collections in parallel and replace state, then notify. */
export async function loadAll() {
  try {
    const [t, p, i, ib] = await Promise.all([
      fetchTasks(),
      fetchProjects(),
      fetchIdeas(),
      fetchInbox(),
    ]);
    state = {
      ...state,
      tasks:    t.data    || [],
      projects: p.data    || [],
      ideas:    i.data    || [],
      inbox:    ib.data   || [],
    };
    listeners.forEach(fn => fn(state));
  } catch (e) {
    console.error('[state] loadAll failed', e);
  }
}

export function subscribe(fn)   { listeners.add(fn);    }
export function unsubscribe(fn) { listeners.delete(fn); }

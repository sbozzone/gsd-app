// js/data.js — one exported async function per API endpoint.
// No business logic — pure API calls.
import { API_BASE, AUTH_TOKEN } from './config.js';

async function req(method, path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (method !== 'GET') headers['Authorization'] = `Bearer ${AUTH_TOKEN}`;
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const payload = await res.json();
    if (!res.ok) console.error(`[data] ${method} ${path} →`, res.status, payload.error);
    return payload;
  } catch (e) {
    console.error(`[data] ${method} ${path}`, e);
    return { data: null, error: e.message };
  }
}

// ── Tasks ──────────────────────────────────────────────────────────────────
export const fetchTasks      = ()          => req('GET',    '/api/tasks');
export const fetchDoneTasks  = ()          => req('GET',    '/api/tasks?status=done');
export const createTask      = (payload)   => req('POST',   '/api/tasks', payload);
export const updateTask      = (id, patch) => req('PATCH',  `/api/tasks/${id}`, patch);
export const deleteTask      = (id)        => req('DELETE', `/api/tasks/${id}`);

// ── Projects ───────────────────────────────────────────────────────────────
export const fetchProjects   = ()          => req('GET',    '/api/projects');
export const createProject   = (payload)   => req('POST',   '/api/projects', payload);
export const updateProject   = (id, patch) => req('PATCH',  `/api/projects/${id}`, patch);

// ── Ideas ──────────────────────────────────────────────────────────────────
export const fetchIdeas      = ()          => req('GET',    '/api/ideas');
export const createIdea      = (payload)   => req('POST',   '/api/ideas', payload);
export const deleteIdea      = (id)        => req('DELETE', `/api/ideas/${id}`);
export const promoteIdea     = (id)        => req('PATCH',  `/api/ideas/${id}/promote`);

// ── Inbox ──────────────────────────────────────────────────────────────────
export const fetchInbox      = ()                          => req('GET',    '/api/inbox');
export const addToInbox      = (text, source, remindersId) => req('POST',   '/api/inbox', { text, source, reminders_id: remindersId });
export const deleteInboxItem = (id)                        => req('DELETE', `/api/inbox/${id}`);
export const fileInboxItem   = (id, payload)               => req('POST',   `/api/inbox/${id}/file`, payload);

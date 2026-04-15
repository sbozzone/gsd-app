// js/config.js — reads runtime config injected by index.html at deploy time.
// See config.example.js for the expected shape.
const cfg = window.__GSD_CONFIG || {};

export const API_BASE        = cfg.API_BASE        || '';
export const AUTH_TOKEN      = cfg.AUTH_TOKEN      || '';

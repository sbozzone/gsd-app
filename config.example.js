// config.example.js — shape of the runtime config injected into index.html.
// Copy this block into the index.html <script> for local dev.
// NEVER commit real values. All three are injected from GitHub Actions secrets at deploy time.

window.__GSD_CONFIG = {
  API_BASE:   'https://gsd-worker.YOUR_SUBDOMAIN.workers.dev',
  AUTH_TOKEN: 'your-secret-token-here',
};

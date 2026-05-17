// ── Centralized API Configuration ──────────────────────────────
// All frontend fetch calls import from here instead of hardcoding URLs.
// Set VITE_API_URL in .env to override for production deployment.
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';

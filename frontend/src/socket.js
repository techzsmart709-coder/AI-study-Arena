import { io } from 'socket.io-client';
import { API_BASE } from './lib/api';

/**
 * Socket.IO client — configured with JWT auth support and auto-reconnection.
 *
 * Features:
 * - Sends Supabase JWT token on connection (for server-side verification)
 * - Sends lastSocketId for session reconnection after page refresh
 * - WebSocket-first transport for reliability
 * - Auto-reconnect with exponential backoff
 */
function createSocket() {
  // Get auth token if available (Supabase stores it in localStorage)
  let authToken = null;
  try {
    const storageKey = Object.keys(localStorage).find(k => k.startsWith('sb-') && k.endsWith('-auth-token'));
    if (storageKey) {
      const session = JSON.parse(localStorage.getItem(storageKey));
      authToken = session?.access_token || null;
    }
  } catch { /* Guest mode — no token */ }

  const lastSocketId = sessionStorage.getItem('lastSocketId');

  const s = io(API_BASE, {
    autoConnect: true,
    transports: ['websocket'],
    auth: {
      token: authToken,
      lastSocketId: lastSocketId || undefined,
    },
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  // Store socket ID for reconnection on page refresh
  s.on('connect', () => {
    sessionStorage.setItem('lastSocketId', s.id);
    console.log(`[Socket] Connected: ${s.id}`);
  });

  s.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected: ${reason}`);
  });

  s.on('reconnect', (attempt) => {
    console.log(`[Socket] Reconnected after ${attempt} attempts`);
  });

  return s;
}

export const socket = createSocket();

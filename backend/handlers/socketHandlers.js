/**
 * Socket Handler Registry — Thin delegation layer.
 * 
 * Each socket event is a one-liner that delegates to the appropriate service.
 * This keeps the handler file readable and all business logic in services.
 * 
 * Also handles:
 * - JWT-verified socket authentication (via Supabase token)
 * - Session reconnection on connect
 * - Unified disconnect cleanup across all services
 */
import { supabase } from '../config/database.js';

/**
 * Socket.IO authentication middleware.
 * Verifies Supabase JWT if provided; allows guest connections without token.
 */
export function socketAuthMiddleware(socket, next) {
  const token = socket.handshake.auth?.token;

  if (token && supabase) {
    supabase.auth.getUser(token)
      .then(({ data, error }) => {
        if (!error && data?.user) {
          socket.user = data.user;
          socket.isAuthenticated = true;
          console.log(`[Auth] Verified socket: ${data.user.email}`);
        } else {
          socket.user = null;
          socket.isAuthenticated = false;
        }
        next();
      })
      .catch(() => {
        socket.user = null;
        socket.isAuthenticated = false;
        next(); // Allow connection even if verification fails
      });
  } else {
    // Guest mode — no token required
    socket.user = null;
    socket.isAuthenticated = false;
    next();
  }
}

/**
 * Register all socket event handlers.
 * @param {Server} io - Socket.IO server instance
 * @param {object} services - { matchmaking, battle, chat, coach }
 */
export function registerSocketHandlers(io, services) {
  const { matchmaking, battle, chat, coach } = services;

  io.on('connection', (socket) => {
    console.log(`[Socket] Connected: ${socket.id} (auth: ${socket.isAuthenticated || false})`);

    // ── Auto-Reconnection Check ────────────────────────────
    const lastSocketId = socket.handshake.auth?.lastSocketId;
    if (lastSocketId) {
      battle.reconnectSession(socket, { oldSocketId: lastSocketId });
    }

    // ── Matchmaking Events ─────────────────────────────────
    socket.on('find_match', (data) => matchmaking.findMatch(socket, data));
    socket.on('leave_matchmaking', (data) => matchmaking.leaveMatchmaking(socket, data));
    socket.on('get_nearby_seekers', (data) => matchmaking.getNearbySeekers(socket, data));
    socket.on('join_seeker', (data) => matchmaking.joinSeeker(socket, data));

    // ── Battle Events ──────────────────────────────────────
    socket.on('join_room', (data) => battle.joinRoom(socket, data));
    socket.on('start_quiz_gen', (data) => battle.startQuizGen(socket, data));
    socket.on('battle_ready', (data) => battle.battleReady(socket, data));
    socket.on('timer_ended', (data) => battle.handleTimerEnded(socket, data));
    socket.on('update_score', (data) => battle.updateScore(socket, data));
    socket.on('complete_battle', (data) => battle.completeBattle(socket, data));
    socket.on('abandon_battle', (data) => battle.abandonBattle(socket, data));

    // ── Chat Events ────────────────────────────────────────
    socket.on('send_message', async (data) => {
      const room = battle.getRoom(data.roomId);
      await chat.handleMessage(socket, data, room);
    });

    // ── Spectator Events ───────────────────────────────────
    socket.on('spectate_battle', (data) => battle.spectateRoom(socket, data));
    socket.on('leave_spectate', (data) => battle.leaveSpectate(socket, data));
    socket.on('get_active_battles', () => {
      socket.emit('active_battles', { battles: battle.getActiveBattles() });
    });

    // ── Coach Events ───────────────────────────────────────
    socket.on('request_coaching', async ({ topic, wrongAnswers, score, totalQuestions, username }) => {
      const insight = await coach.generateInsight(topic, wrongAnswers, score, totalQuestions);

      // Also get difficulty suggestion and accuracy trend
      const difficulty = coach.getSuggestedDifficulty(username, topic);
      const trend = coach.getAccuracyTrend(username, topic);

      socket.emit('coaching_insight', { ...insight, suggestedDifficulty: difficulty, trend });
    });

    // ── Session Reconnection ───────────────────────────────
    socket.on('reconnect_session', (data) => battle.reconnectSession(socket, data));

    // ── Disconnect — Unified Cleanup ───────────────────────
    socket.on('disconnect', () => {
      console.log(`[Socket] Disconnected: ${socket.id}`);
      matchmaking.handleDisconnect(socket);
      battle.handleDisconnect(socket);
    });
  });
}

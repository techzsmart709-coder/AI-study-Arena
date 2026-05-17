import { supabase } from '../config/database.js';

/**
 * BattleService — Room lifecycle, scoring, bot simulation, spectator mode, session reconnection.
 * 
 * Owns: rooms Map, userTopicPlayCount Map, disconnectedSessions Map
 * Dependencies: orchestrator, chatService, eloService, coachService
 */
export class BattleService {
  constructor(io, orchestrator, chatService, eloService, coachService) {
    this.io = io;
    this.orchestrator = orchestrator;
    this.chatService = chatService;
    this.eloService = eloService;
    this.coachService = coachService;

    this.rooms = new Map();                    // roomId → room state
    this.userTopicPlayCount = new Map();        // "user:topic" → count
    this.disconnectedSessions = new Map();     // oldSocketId → { roomId, username, timeout }
    this.spectatorCounts = new Map();          // roomId → count

    // Periodic GC every 5 minutes
    this._gcInterval = setInterval(() => this._garbageCollect(), 5 * 60 * 1000);
  }

  // ── Room Lifecycle ──────────────────────────────────────────

  getRoom(roomId) {
    return this.rooms.get(roomId);
  }

  createRoom(roomId, data) {
    this.rooms.set(roomId, { ...data, createdAt: Date.now() });
  }

  /**
   * Player joins a room. Creates tracking entry if needed.
   */
  joinRoom(socket, { roomId, username, topic, players }) {
    socket.join(roomId);

    if (!this.rooms.has(roomId)) {
      console.log(`[Room] Creating tracking entry for ${roomId}`);
      this.rooms.set(roomId, { topic, lastActivity: Date.now(), players: players || [username], createdAt: Date.now() });
    }

    const room = this.rooms.get(roomId);

    // Sync player list
    if (players && Array.isArray(players)) {
      players.forEach(p => { if (!room.players.includes(p)) room.players.push(p); });
    } else if (!room.players.includes(username)) {
      room.players.push(username);
    }

    console.log(`[Room] ${username} joined ${roomId}. Players:`, room.players);
    socket.to(roomId).emit('player_joined', { username });

    // Notify spectators
    this.io.to(`spectate_${roomId}`).emit('spectate_player_joined', { username, players: room.players });
  }

  /**
   * Background quiz generation (starts during study room phase).
   */
  async startQuizGen(socket, { roomId }) {
    const room = this.rooms.get(roomId);
    if (!room || room.isGenerating || room.questions) return;

    room.isGenerating = true;
    console.log(`[Orchestrator] Background generation for room ${roomId}...`);

    try {
      const isBotMatch = roomId.startsWith('room_bot_');
      const history = this.chatService.getHistory(roomId);
      const chatContext = history.map(m => `${m.sender || m.role}: ${m.message || '...'}`).join('\n');
      const maxPlayCount = this._getPlayCount(room.players || [], room.topic);
      const questions = await this.orchestrator.getTrialQuestions(room.topic, isBotMatch, chatContext, room.numQuestions || 5, maxPlayCount);
      room.questions = questions;
      console.log(`[Orchestrator] Generation COMPLETE for ${roomId}.`);
    } catch (err) {
      console.error(`[Orchestrator] Generation failed:`, err.message);
    } finally {
      room.isGenerating = false;
    }
  }

  /**
   * Timer ended — emit questions and start bot simulation.
   */
  async handleTimerEnded(socket, { roomId }) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    const startAt = Date.now() + 2000;

    if (room.questions) {
      this.io.to(roomId).emit('quiz_starting', { questions: room.questions, startAt });
    } else {
      try {
        const isBotMatch = roomId.startsWith('room_bot_');
        const history = this.chatService.getHistory(roomId);
        const chatContext = history.map(m => `${m.sender || m.role}: ${m.message || '...'}`).join('\n');
        const maxPlayCount = this._getPlayCount(room.players || [], room.topic);
        const questions = await this.orchestrator.getTrialQuestions(room.topic, isBotMatch, chatContext, room.numQuestions || 5, maxPlayCount);
        room.questions = questions;
        this.io.to(roomId).emit('quiz_starting', { questions, startAt });
      } catch (err) {
        console.error('[Game] Orchestrator failed:', err.message);
        this.io.to(roomId).emit('quiz_starting', { questions: [], startAt });
      }
    }

    // Spectator notification
    this.io.to(`spectate_${roomId}`).emit('spectate_quiz_starting', { topic: room.topic, numQuestions: room.numQuestions || 5 });

    // Bot score simulation
    if (roomId.startsWith('room_bot_') && !room.botSimStarted) {
      room.botSimStarted = true;
      this._simulateBotScoring(roomId, room);
    }
  }

  /**
   * Update score — broadcast to room and spectators.
   */
  updateScore(socket, { roomId, score, answered }) {
    socket.to(roomId).emit('opponent_update', { score, answered });
    this.io.to(`spectate_${roomId}`).emit('spectate_score_update', { socketId: socket.id, score, answered });
  }

  /**
   * Battle completion — ELO update, coach insight, cleanup.
   */
  async completeBattle(socket, { roomId, score, stats }) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    if (!room.results) room.results = {};
    room.results[socket.id] = { username: stats?.username || 'Player', score };

    socket.to(roomId).emit('opponent_finished', { score, stats });
    socket.to(roomId).emit('opponent_update', { score, answered: room.numQuestions || 5 });

    const isBotMatch = roomId.startsWith('room_bot_');

    if (isBotMatch) {
      const botName = room.players[1] || 'AI Scholar';
      room.results['bot_socket_id'] = { username: botName, score: room.botScore || 0 };
      this.io.to(roomId).emit('battle_concluded', { results: room.results });
    } else if (Object.keys(room.results).length >= 2) {
      this.io.to(roomId).emit('battle_concluded', { results: room.results });
    }

    // ── ELO Update ──
    if (Object.keys(room.results).length >= 2) {
      const players = Object.values(room.results);
      const [p1, p2] = players;
      if (p1.score !== p2.score) {
        const winner = p1.score > p2.score ? p1.username : p2.username;
        const loser = p1.score > p2.score ? p2.username : p1.username;
        await this.eloService.updateRatings(winner, loser);
      } else {
        await this.eloService.updateRatings(p1.username, p2.username, true);
      }
    }

    // ── Coach: Track Accuracy ──
    if (stats?.username && stats?.correctCount !== undefined) {
      this.coachService.trackAccuracy(stats.username, room.topic, stats.correctCount, room.numQuestions || 5);
    }

    // ── Spectator Notification ──
    this.io.to(`spectate_${roomId}`).emit('spectate_battle_concluded', { results: room.results });

    // ── Deferred Cleanup ──
    if (isBotMatch || Object.keys(room.results).length >= 2) {
      setTimeout(() => {
        this.rooms.delete(roomId);
        this.chatService.cleanup(roomId);
        this.spectatorCounts.delete(roomId);
        console.log(`[GC] Cleaned room ${roomId}`);
      }, 60000);
    }
  }

  /**
   * Player explicitly abandons battle.
   */
  abandonBattle(socket, { roomId }) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    console.log(`[Game] ${socket.id} abandoned room ${roomId}`);
    socket.to(roomId).emit('opponent_abandoned', { socketId: socket.id });

    if (!room.results) room.results = {};
    if (!room.results[socket.id]) {
      room.results[socket.id] = { username: 'Abandoned', score: 0 };
    }

    if (Object.keys(room.results).length >= 2) {
      this.io.to(roomId).emit('battle_concluded', { results: room.results });
      setTimeout(() => {
        this.rooms.delete(roomId);
        this.chatService.cleanup(roomId);
      }, 60000);
    }
  }

  /**
   * Battle ready notification.
   */
  battleReady(socket, { roomId, username }) {
    socket.to(roomId).emit('opponent_ready', { username });
  }

  // ── Spectator Mode ─────────────────────────────────────────

  /**
   * Join a room as a read-only spectator.
   */
  spectateRoom(socket, { roomId }) {
    const room = this.rooms.get(roomId);
    if (!room) {
      socket.emit('spectate_error', { message: 'Battle not found or already ended.' });
      return;
    }

    socket.join(`spectate_${roomId}`);
    this.spectatorCounts.set(roomId, (this.spectatorCounts.get(roomId) || 0) + 1);

    socket.emit('spectate_joined', {
      topic: room.topic,
      players: room.players,
      scores: room.results || {},
      botScore: room.botScore || 0,
      botAnswered: room.botAnswered || 0,
      spectators: this.spectatorCounts.get(roomId)
    });

    // Notify room that a spectator joined
    this.io.to(roomId).emit('spectator_count', { count: this.spectatorCounts.get(roomId) });
    console.log(`[Spectator] Socket ${socket.id} watching room ${roomId}`);
  }

  /**
   * Leave spectator mode.
   */
  leaveSpectate(socket, { roomId }) {
    socket.leave(`spectate_${roomId}`);
    const count = Math.max(0, (this.spectatorCounts.get(roomId) || 1) - 1);
    this.spectatorCounts.set(roomId, count);
    this.io.to(roomId).emit('spectator_count', { count });
  }

  /**
   * Get list of active rooms available for spectating.
   */
  getActiveBattles() {
    const battles = [];
    for (const [roomId, room] of this.rooms.entries()) {
      if (!room.results && room.players?.length >= 2) {
        battles.push({
          roomId,
          topic: room.topic,
          players: room.players,
          spectators: this.spectatorCounts.get(roomId) || 0
        });
      }
    }
    return battles.slice(0, 20);
  }

  // ── Session Reconnection ────────────────────────────────────

  /**
   * Store a disconnected session for 30s grace period.
   */
  handleDisconnect(socket) {
    // Check all rooms for this socket
    for (const [roomId, room] of this.rooms.entries()) {
      if (!room.results && room.players) {
        // Check if this socket was in the room
        const socketRooms = [...(socket.rooms || [])];
        if (socketRooms.includes(roomId) || roomId.startsWith('room_manual_') || (!roomId.startsWith('room_bot_') && !room.results)) {
          // Mark as disconnected with 30s grace period
          const timeout = setTimeout(() => {
            this.disconnectedSessions.delete(socket.id);
            // After grace period, treat as abandon
            console.log(`[Reconnect] Grace period expired for ${socket.id} in ${roomId}`);
            socket.to(roomId).emit('opponent_abandoned', { socketId: socket.id });

            // Auto-conclude if other player finished
            if (room.results && Object.keys(room.results).length > 0) {
              room.results[socket.id] = { username: 'Disconnected', score: 0 };
              if (Object.keys(room.results).length >= 2) {
                this.io.to(roomId).emit('battle_concluded', { results: room.results });
              }
            }
          }, 30000);

          this.disconnectedSessions.set(socket.id, {
            roomId,
            username: room.players.find(p => p !== room.players[1]) || 'Player',
            disconnectedAt: Date.now(),
            timeout
          });

          console.log(`[Reconnect] Stored session for ${socket.id} → ${roomId} (30s grace)`);
        }
      }
    }
  }

  /**
   * Attempt to reconnect a player to their previous session.
   */
  reconnectSession(socket, { oldSocketId }) {
    const session = this.disconnectedSessions.get(oldSocketId);
    if (!session) {
      socket.emit('reconnect_failed', { reason: 'No active session found.' });
      return;
    }

    clearTimeout(session.timeout);
    this.disconnectedSessions.delete(oldSocketId);

    const room = this.rooms.get(session.roomId);
    if (!room) {
      socket.emit('reconnect_failed', { reason: 'Room no longer exists.' });
      return;
    }

    // Rejoin the room with the new socket
    socket.join(session.roomId);
    socket.emit('reconnect_success', {
      roomId: session.roomId,
      topic: room.topic,
      players: room.players,
      questions: room.questions || null,
      botScore: room.botScore || 0,
      botAnswered: room.botAnswered || 0
    });

    socket.to(session.roomId).emit('opponent_reconnected', { username: session.username });
    console.log(`[Reconnect] ${socket.id} reconnected to room ${session.roomId}`);
  }

  // ── Live Battle API (for Landing page) ─────────────────────

  getLiveBattle() {
    const active = [];
    for (const [, room] of this.rooms.entries()) {
      if (!room.results && room.players?.length >= 2) active.push(room);
    }
    if (active.length === 0) return null;
    const room = active[Math.floor(Math.random() * active.length)];
    return { topic: room.topic, players: room.players, isReal: true };
  }

  // ── Private Methods ─────────────────────────────────────────

  /**
   * Simulate bot scoring during battle.
   */
  _simulateBotScoring(roomId, room) {
    const botName = room.players[1] || 'AI Scholar';
    const total = room.numQuestions || 5;
    room.botScore = 0;
    room.botAnswered = 0;

    const interval = setInterval(() => {
      if (!this.rooms.has(roomId)) { clearInterval(interval); return; }

      room.botAnswered++;
      if (Math.random() > 0.25) {
        room.botScore += Math.floor(Math.random() * 40) + 60;
      }

      this.io.to(roomId).emit('opponent_update', { score: room.botScore, answered: room.botAnswered });
      this.io.to(`spectate_${roomId}`).emit('spectate_score_update', { socketId: 'bot', score: room.botScore, answered: room.botAnswered });
      console.log(`[Bot] ${botName} answered ${room.botAnswered}/${total}. Score: ${room.botScore}`);

      if (room.botAnswered >= total) clearInterval(interval);
    }, 4000 + Math.random() * 8000);
  }

  /**
   * Get and increment play count for a topic (for question rotation).
   */
  _getPlayCount(players, topic) {
    let maxCount = 0;
    for (const p of players) {
      if (!p || p === 'AI Scholar' || p.includes('_')) continue;

      // Memory management
      if (this.userTopicPlayCount.size > 5000) {
        const oldest = this.userTopicPlayCount.keys().next().value;
        this.userTopicPlayCount.delete(oldest);
      }

      const key = `${p}:${topic}`;
      const count = (this.userTopicPlayCount.get(key) || 0) + 1;
      this.userTopicPlayCount.set(key, count);
      if (count > maxCount) maxCount = count;
    }
    return maxCount || 1;
  }

  /**
   * Periodic garbage collection — purge stale rooms.
   */
  _garbageCollect() {
    const now = Date.now();
    const STALE = 15 * 60 * 1000;
    let purged = 0;

    for (const [roomId, room] of this.rooms.entries()) {
      if (now - (room.createdAt || 0) > STALE) {
        this.rooms.delete(roomId);
        this.chatService.cleanup(roomId);
        this.spectatorCounts.delete(roomId);
        purged++;
      }
    }

    this.chatService.pruneCache();

    // Expired reconnection sessions
    for (const [sid, session] of this.disconnectedSessions.entries()) {
      if (now - session.disconnectedAt > 35000) {
        clearTimeout(session.timeout);
        this.disconnectedSessions.delete(sid);
      }
    }

    if (purged > 0) console.log(`[GC] Purged ${purged} stale rooms.`);
  }
}

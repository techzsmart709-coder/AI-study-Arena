import { BOT_NAMES, BOT_PERSONAS, pick } from '../data/constants.js';
import { areRelated, getCategory } from '../data/taxonomy.js';

/**
 * MatchmakingService — ELO-aware, taxonomy-aware matchmaking with bot fallback.
 * 
 * Match priority:
 * 1. Exact topic + exact question count + ELO range
 * 2. Exact topic + exact question count (any ELO)
 * 3. Related topic (same category via taxonomy) + ELO range
 * 4. Bot fallback after 10s
 * 
 * Owns: matchmakingQueue Map
 * Dependencies: battleService, eloService
 */
export class MatchmakingService {
  constructor(io, battleService, eloService) {
    this.io = io;
    this.battleService = battleService;
    this.eloService = eloService;

    // topic → Array<QueueEntry>
    // QueueEntry: { socket, username, numQuestions, botTimeout, joinedAt, rating }
    this.queue = new Map();
  }

  /**
   * Find a match for a player. Checks exact → taxonomy → queue with bot timeout.
   */
  async findMatch(socket, { username, topic, numQuestions = 5 }) {
    numQuestions = parseInt(numQuestions) || 5;
    console.log(`[Match] ${username} searching for "${topic}" (Q: ${numQuestions})`);

    // Remove from any existing queues
    this._removeFromAllQueues(socket.id);

    // Get player's ELO
    const playerData = await this.eloService.getRating(username);
    const playerRating = playerData.rating;

    // 1. Try exact topic + exact question count
    const exactMatch = this._findInQueue(topic, numQuestions, socket.id, playerRating);
    if (exactMatch) {
      this._executeMatch(socket, exactMatch, username, topic, numQuestions);
      return;
    }

    // 2. Try taxonomy match (related topics in same category)
    const relatedMatch = this._findRelatedMatch(topic, numQuestions, socket.id, playerRating);
    if (relatedMatch) {
      // Use the seeker's topic (the one already waiting)
      this._executeMatch(socket, relatedMatch.entry, username, relatedMatch.matchTopic, numQuestions);
      return;
    }

    // 3. No match found — add to queue with bot timeout
    const entry = { socket, username, numQuestions, joinedAt: Date.now(), rating: playerRating };
    if (!this.queue.has(topic)) this.queue.set(topic, []);
    this.queue.get(topic).push(entry);

    // Bot fallback after 10 seconds
    entry.botTimeout = setTimeout(() => {
      const currentQueue = this.queue.get(topic) || [];
      const idx = currentQueue.indexOf(entry);
      if (idx === -1) return; // Already matched

      currentQueue.splice(idx, 1);
      if (currentQueue.length === 0) this.queue.delete(topic);

      // Create bot match
      const botName = pick(BOT_NAMES);
      const persona = pick(BOT_PERSONAS);
      const roomId = `room_bot_${Math.random().toString(36).substring(7)}`;

      const roomData = {
        roomId, topic,
        players: [username, botName],
        opponent: botName,
        persona,
        numQuestions
      };

      this.battleService.createRoom(roomId, { topic, players: [username, botName], numQuestions });
      socket.emit('match_found', roomData);
      console.log(`[Match] ${username} → BOT ${botName} (timeout)`);
    }, 10000);

    console.log(`[Match] ${username} queued. Waiting...`);
  }

  /**
   * Remove player from matchmaking queue.
   */
  leaveMatchmaking(socket, { topic }) {
    const queue = this.queue.get(topic);
    if (!queue) return;

    const idx = queue.findIndex(u => u.socket.id === socket.id);
    if (idx !== -1) {
      if (queue[idx].botTimeout) clearTimeout(queue[idx].botTimeout);
      queue.splice(idx, 1);
    }
    if (queue.length === 0) this.queue.delete(topic);
  }

  /**
   * Get nearby seekers for discovery UI.
   */
  getNearbySeekers(socket, { topic, numQuestions }) {
    const waiting = this.queue.get(topic) || [];
    const nearby = waiting
      .filter(u => u.socket.id !== socket.id)
      .sort((a, b) => Math.abs(a.numQuestions - numQuestions) - Math.abs(b.numQuestions - numQuestions))
      .slice(0, 3)
      .map(u => ({
        username: u.username,
        numQuestions: u.numQuestions,
        socketId: u.socket.id,
        rating: u.rating || 1200
      }));

    socket.emit('nearby_seekers', { seekers: nearby });
  }

  /**
   * Join a specific seeker directly.
   */
  joinSeeker(socket, { targetSocketId, topic, username }) {
    const queue = this.queue.get(topic) || [];
    const targetIdx = queue.findIndex(u => u.socket.id === targetSocketId);

    if (targetIdx === -1) {
      socket.emit('join_failed', { reason: 'Player no longer available.' });
      return;
    }

    const target = queue.splice(targetIdx, 1)[0];
    if (queue.length === 0) this.queue.delete(topic);
    if (target.botTimeout) clearTimeout(target.botTimeout);

    const roomId = `room_manual_${Math.random().toString(36).substring(7)}`;
    const agreedQuestions = target.numQuestions;

    const matchData = {
      roomId, topic,
      players: [username, target.username],
      numQuestions: agreedQuestions
    };

    target.socket.emit('match_found', { ...matchData, opponent: username, persona: 'The Challenger' });
    socket.emit('match_found', { ...matchData, opponent: target.username, persona: 'Real Student' });

    this.battleService.createRoom(roomId, { topic, players: [username, target.username], numQuestions: agreedQuestions });
    console.log(`[Match] ${username} joined ${target.username} via discovery`);
  }

  /**
   * Clean up when a player disconnects during matchmaking.
   */
  handleDisconnect(socket) {
    this._removeFromAllQueues(socket.id);
  }

  // ── Private Methods ─────────────────────────────────────────

  /**
   * Search a specific topic's queue for an ELO-compatible match.
   */
  _findInQueue(topic, numQuestions, excludeSocketId, playerRating) {
    const queue = this.queue.get(topic) || [];
    
    // First pass: exact count + ELO range
    for (let i = 0; i < queue.length; i++) {
      const entry = queue[i];
      if (entry.socket.id === excludeSocketId) continue;
      if (parseInt(entry.numQuestions) !== numQuestions) continue;

      const waitTime = Date.now() - entry.joinedAt;
      if (this.eloService.isInRange(playerRating, entry.rating || 1200, waitTime)) {
        queue.splice(i, 1);
        if (queue.length === 0) this.queue.delete(topic);
        return entry;
      }
    }

    // Second pass: exact count, any ELO (fallback for small player pools)
    for (let i = 0; i < queue.length; i++) {
      const entry = queue[i];
      if (entry.socket.id === excludeSocketId) continue;
      if (parseInt(entry.numQuestions) !== numQuestions) continue;

      queue.splice(i, 1);
      if (queue.length === 0) this.queue.delete(topic);
      return entry;
    }

    return null;
  }

  /**
   * Search across all queues for a taxonomy-related match.
   */
  _findRelatedMatch(topic, numQuestions, excludeSocketId, playerRating) {
    for (const [queueTopic, queue] of this.queue.entries()) {
      if (queueTopic === topic) continue;
      if (!areRelated(topic, queueTopic)) continue;

      for (let i = 0; i < queue.length; i++) {
        const entry = queue[i];
        if (entry.socket.id === excludeSocketId) continue;
        if (parseInt(entry.numQuestions) !== numQuestions) continue;

        const waitTime = Date.now() - entry.joinedAt;
        if (this.eloService.isInRange(playerRating, entry.rating || 1200, waitTime)) {
          queue.splice(i, 1);
          if (queue.length === 0) this.queue.delete(queueTopic);
          return { entry, matchTopic: queueTopic };
        }
      }
    }
    return null;
  }

  /**
   * Execute a match between two players.
   */
  _executeMatch(socket, sibling, username, topic, numQuestions) {
    if (sibling.botTimeout) clearTimeout(sibling.botTimeout);

    const agreedQuestions = sibling.numQuestions || numQuestions;
    const roomId = `room_${Math.random().toString(36).substring(7)}`;

    const roomDataForUser = {
      roomId, topic,
      players: [username, sibling.username],
      opponent: sibling.username,
      persona: 'Real Student',
      numQuestions: agreedQuestions
    };

    const roomDataForSibling = {
      roomId, topic,
      players: [username, sibling.username],
      opponent: username,
      persona: 'Real Student',
      numQuestions: agreedQuestions
    };

    this.battleService.createRoom(roomId, { topic, players: [username, sibling.username], numQuestions: agreedQuestions });

    socket.emit('match_found', roomDataForUser);
    sibling.socket.emit('match_found', roomDataForSibling);

    console.log(`[Match] ${username} ↔ ${sibling.username} in ${roomId}`);
  }

  /**
   * Remove a socket from all queues.
   */
  _removeFromAllQueues(socketId) {
    for (const [topic, queue] of this.queue.entries()) {
      const idx = queue.findIndex(u => u.socket.id === socketId);
      if (idx !== -1) {
        if (queue[idx].botTimeout) clearTimeout(queue[idx].botTimeout);
        queue.splice(idx, 1);
        if (queue.length === 0) this.queue.delete(topic);
      }
    }
  }
}

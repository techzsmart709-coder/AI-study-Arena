import { openai, modelName } from '../config/ai.js';
import { supabase } from '../config/database.js';
import { pick } from '../data/constants.js';

/**
 * ChatService — Manages study room chat, AI bot replies, and the 5-in-2 caching system.
 * 
 * Extracted from server.js to follow Single Responsibility Principle.
 * Owns: chatHistories Map, globalChatCache Map
 */
export class ChatService {
  constructor(io) {
    this.io = io;
    this.histories = new Map();     // roomId → chat history array
    this.globalCache = new Map();   // normalizedMsg → { count, replies[] }
  }

  /**
   * Handle an incoming chat message.
   * Broadcasts to room, archives to DB, generates bot reply if needed.
   */
  async handleMessage(socket, { roomId, message, sender }, room) {
    // 1. Broadcast to all participants in the room
    const timestamp = new Date().toISOString();
    this.io.to(roomId).emit('receive_message', { sender, message, timestamp });

    // 2. Forward to spectators
    this.io.to(`spectate_${roomId}`).emit('spectate_message', { sender, message, timestamp });

    // 3. Archive to database (fire-and-forget)
    if (supabase) {
      supabase.from('chat_messages')
        .insert([{ room_id: roomId, sender, message }])
        .then(({ error }) => { if (error) console.error('[ChatDB] Save failed:', error.message); });
    }

    // 4. Generate bot reply if this is a bot room and the sender isn't the bot
    if (room && sender !== 'AI Scholar' && roomId.startsWith('room_bot_')) {
      this.io.to(roomId).emit('bot_typing');

      try {
        const botName = room.players[1] || 'AI Scholar';
        const reply = await this._generateBotReply(message, roomId, room.topic, botName);

        // Archive bot reply
        if (supabase) {
          supabase.from('chat_messages')
            .insert([{ room_id: roomId, sender: botName, message: reply }])
            .then(({ error }) => { if (error) console.error('[ChatDB] Bot save failed:', error.message); });
        }

        // Human-like delay (800ms-2000ms)
        const delay = 800 + Math.random() * 1200;
        setTimeout(() => {
          this.io.to(roomId).emit('receive_message', {
            sender: botName, message: reply, timestamp: new Date().toISOString()
          });

          // Forward to spectators
          this.io.to(`spectate_${roomId}`).emit('spectate_message', {
            sender: botName, message: reply, timestamp: new Date().toISOString()
          });
        }, delay);
      } catch (err) {
        console.error('[Chat] Bot reply flow failed:', err.message);
      }
    }
  }

  /**
   * Get the chat history for a room (used by quiz generation for context).
   */
  getHistory(roomId) {
    return this.histories.get(roomId) || [];
  }

  /**
   * Clean up chat data for a room.
   */
  cleanup(roomId) {
    this.histories.delete(roomId);
  }

  /**
   * Prune oversized caches (called by periodic GC).
   */
  pruneCache() {
    if (this.globalCache.size > 500) this.globalCache.clear();
  }

  // ── Private Methods ─────────────────────────────────────────

  /**
   * AI bot reply generation with 5-in-2 caching system.
   * - Personal questions always go to AI (no cache)
   * - Non-personal: every 4th-5th request serves cached reply
   * - Reduces API calls by ~40%
   */
  async _generateBotReply(message, roomId, topic, personaName) {
    if (!this.histories.has(roomId)) this.histories.set(roomId, []);
    const history = this.histories.get(roomId);
    const cleanMsg = message.toLowerCase().trim();

    // 1. Personal question detection (must always generate fresh)
    const isPersonal = /who are you|what (do |are )?you do|your name|are you (an )?ai|real|bot|who made you|creator|identify/i.test(cleanMsg);

    // 2. 5-in-2 caching rule
    if (!isPersonal) {
      if (this.globalCache.size > 2000) {
        const oldest = this.globalCache.keys().next().value;
        this.globalCache.delete(oldest);
      }

      if (!this.globalCache.has(cleanMsg)) {
        this.globalCache.set(cleanMsg, { count: 0, replies: [] });
      }
      const cacheEntry = this.globalCache.get(cleanMsg);
      cacheEntry.count += 1;
      const inCachePhase = (cacheEntry.count % 5 === 4 || cacheEntry.count % 5 === 0);

      if (inCachePhase && cacheEntry.replies.length > 0) {
        const reply = pick(cacheEntry.replies);
        this._updateHistory(history, message, reply);
        return reply;
      }
    }

    // 3. AI generation via OpenRouter/NVIDIA/Nexum
    try {
      const slicedHistory = history.slice(-4).map(h => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: h.parts[0].text
      }));

      const response = await openai.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: `You are ${personaName}, a student studying ${topic}. Talk like a Gen Z student (lowercase, slang). Keep replies UNDER 15 WORDS. Be human. NO AI mentions.` },
          ...slicedHistory,
          { role: 'user', content: message }
        ],
        max_tokens: 50,
        temperature: 0.8
      }, { timeout: 10000 });

      const reply = response.choices[0].message.content.trim();

      // Save to cache
      if (!isPersonal) {
        const entry = this.globalCache.get(cleanMsg);
        if (entry && !entry.replies.includes(reply)) entry.replies.push(reply);
      }

      this._updateHistory(history, message, reply);
      return reply;

    } catch (err) {
      console.warn(`[Chat] AI failed for ${roomId}:`, err.message);
      const reply = this._fallbackReply(message);
      this._updateHistory(history, message, reply);
      return reply;
    }
  }

  /**
   * Fallback replies when AI is unavailable.
   */
  _fallbackReply(message) {
    const lower = message.toLowerCase();
    if (/hi|hello|hey|yo/.test(lower)) {
      return pick(['hey!', 'hellooo', 'yo, ready for the quiz?', 'hi! staying focused?']);
    }
    return pick(['interesting...', 'idk about that one', "let's stick to the topic lol", 'fair point', "tbh i'm just ready to battle"]);
  }

  /**
   * Append to conversation history (Gemini-compatible format).
   */
  _updateHistory(history, msg, reply) {
    history.push({ role: 'user', sender: 'Student', message: msg, parts: [{ text: msg }] });
    history.push({ role: 'model', sender: 'AI Scholar', message: reply, parts: [{ text: reply }] });
  }
}

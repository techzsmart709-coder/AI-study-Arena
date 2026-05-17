/**
 * EloService — God-tier ELO Rating System
 * 
 * - Starting rating: 1200
 * - K-factor: 32 (new, <10 games) → 16 (experienced)
 * - Matchmaking prefers ±200 ELO range, widens by 50 every 3 seconds
 * - Hybrid persistence: in-memory Map + async Supabase write-through
 */
export class EloService {
  constructor(supabase) {
    this.supabase = supabase;
    this.ratings = new Map(); // username → { rating, gamesPlayed, lastActive }
    this.DEFAULT_RATING = 1200;
    this.K_NEW = 32;
    this.K_EXPERIENCED = 16;
    this.GAMES_THRESHOLD = 10;

    // Periodic cache eviction (clear inactive players from memory)
    setInterval(() => {
      const now = Date.now();
      const EVICT_AFTER = 30 * 60 * 1000; // 30 minutes
      for (const [username, data] of this.ratings.entries()) {
        if (now - (data.lastActive || 0) > EVICT_AFTER) {
          this.ratings.delete(username);
        }
      }
    }, 10 * 60 * 1000);
  }

  /**
   * Get a player's rating. Checks memory → DB → default.
   */
  async getRating(username) {
    if (this.ratings.has(username)) {
      const data = this.ratings.get(username);
      data.lastActive = Date.now();
      return data;
    }

    // Try DB
    if (this.supabase) {
      try {
        const { data } = await this.supabase
          .from('player_ratings')
          .select('rating, games_played')
          .eq('username', username)
          .single();

        if (data) {
          const entry = { rating: data.rating, gamesPlayed: data.games_played, lastActive: Date.now() };
          this.ratings.set(username, entry);
          return entry;
        }
      } catch (err) {
        // Table might not exist yet — graceful fallback
        if (!err.message?.includes('does not exist')) {
          console.warn('[ELO] DB lookup failed:', err.message);
        }
      }
    }

    // Default
    const entry = { rating: this.DEFAULT_RATING, gamesPlayed: 0, lastActive: Date.now() };
    this.ratings.set(username, entry);
    return entry;
  }

  /**
   * Calculate expected score (probability of winning).
   */
  expectedScore(ratingA, ratingB) {
    return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  }

  /**
   * Update ratings after a match.
   * @param {string} winner - Winner's username (or null for draw)
   * @param {string} loser - Loser's username
   * @param {boolean} isDraw - True if the match was a draw
   * @returns {{ winner: object, loser: object }} Updated ratings
   */
  async updateRatings(winner, loser, isDraw = false) {
    const winnerData = await this.getRating(winner);
    const loserData = await this.getRating(loser);

    const expectedWin = this.expectedScore(winnerData.rating, loserData.rating);
    const expectedLose = 1 - expectedWin;

    const kWin = winnerData.gamesPlayed < this.GAMES_THRESHOLD ? this.K_NEW : this.K_EXPERIENCED;
    const kLose = loserData.gamesPlayed < this.GAMES_THRESHOLD ? this.K_NEW : this.K_EXPERIENCED;

    const actualWin = isDraw ? 0.5 : 1;
    const actualLose = isDraw ? 0.5 : 0;

    winnerData.rating = Math.round(winnerData.rating + kWin * (actualWin - expectedWin));
    loserData.rating = Math.round(loserData.rating + kLose * (actualLose - expectedLose));

    // Floor at 100 to prevent negative spirals
    winnerData.rating = Math.max(100, winnerData.rating);
    loserData.rating = Math.max(100, loserData.rating);

    winnerData.gamesPlayed++;
    loserData.gamesPlayed++;

    // Async persist
    this._persist(winner, winnerData);
    this._persist(loser, loserData);

    console.log(`[ELO] ${winner}: ${winnerData.rating} | ${loser}: ${loserData.rating}`);
    return { winner: { ...winnerData }, loser: { ...loserData } };
  }

  /**
   * Check if two players are within acceptable ELO range.
   * Range starts at ±200 and widens by 50 for every 3 seconds waited.
   */
  isInRange(ratingA, ratingB, waitTimeMs = 0) {
    const baseRange = 200;
    const expansion = Math.floor(waitTimeMs / 3000) * 50;
    const range = baseRange + expansion;
    return Math.abs(ratingA - ratingB) <= range;
  }

  /**
   * Persist to Supabase (fire-and-forget).
   */
  _persist(username, data) {
    if (!this.supabase) return;
    this.supabase.from('player_ratings').upsert({
      username,
      rating: data.rating,
      games_played: data.gamesPlayed
    }, { onConflict: 'username' }).then(({ error }) => {
      if (error && !error.message?.includes('does not exist')) {
        console.warn('[ELO] Persist failed:', error.message);
      }
    });
  }
}

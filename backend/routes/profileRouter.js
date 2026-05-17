import express from 'express';
import { supabase } from '../config/database.js';

const router = express.Router();

/**
 * GET /api/profile/:userId
 * Fetch battle history and aggregate stats for a user.
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!supabase) {
      return res.json({
        history: [],
        stats: { totalBattles: 0, wins: 0, losses: 0, draws: 0, bestScore: 0, avgScore: 0, username: userId }
      });
    }

    let data = [];
    try {
      const response = await supabase
        .from('leaderboard')
        .select('*')
        .or(`username.eq.${userId},user_id.eq.${userId}`)
        .order('created_at', { ascending: false })
        .limit(50);

      if (response.error) {
        // Fallback if user_id column is missing
        const fallback = await supabase
          .from('leaderboard')
          .select('*')
          .eq('username', userId)
          .order('created_at', { ascending: false })
          .limit(50);
        data = fallback.data || [];
      } else {
        data = response.data || [];
      }
    } catch (dbErr) {
      console.warn('[Profile] DB fallback active:', dbErr.message);
    }

    const history = data || [];
    const scores = history.map(r => r.score || 0);
    const stats = {
      totalBattles: history.length,
      wins: history.filter(r => r.outcome === 'win').length,
      losses: history.filter(r => r.outcome === 'loss').length,
      draws: history.filter(r => r.outcome === 'draw').length,
      bestScore: scores.length ? Math.max(...scores) : 0,
      avgScore: scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : 0,
      username: (history[0]?.username) || userId
    };

    res.json({ history, stats });
  } catch (err) {
    console.error('[Profile] Error:', err.message);
    res.json({
      history: [],
      stats: { totalBattles: 0, wins: 0, losses: 0, draws: 0, bestScore: 0, avgScore: 0, username: req.params.userId }
    });
  }
});

export default router;

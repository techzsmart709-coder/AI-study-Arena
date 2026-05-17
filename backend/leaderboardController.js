import 'dotenv/config';
import { supabase } from './config/database.js';

// Re-export for backward compatibility with routes
export { supabase };

let inMemoryLeaderboard = [
  { username: 'AI_Master', topic: 'Computer Science', score: 95 },
  { username: 'Quantum_Guru', topic: 'Physics', score: 88 },
  { username: 'CodeNinja', topic: 'React Hooks', score: 85 }
];

export const saveScore = async (req, res) => {
  try {
    const { username, topic, score, outcome, opponent, user_id } = req.body;
    let finalUsername = username || 'Scholar';
    
    // If logged in, ensure we have a unique discriminator if it doesn't already have one
    if (user_id && !finalUsername.includes('#')) {
      // Check if user already has a name in history
      const { data: existing } = await supabase
        .from('leaderboard')
        .select('username')
        .eq('user_id', user_id)
        .limit(1);

      if (existing && existing.length > 0) {
        finalUsername = existing[0].username;
      } else {
        // Generate new with random 4-digit discriminator
        const discriminator = Math.floor(1000 + Math.random() * 9000);
        finalUsername = `${finalUsername.split('#')[0]}#${discriminator}`;
      }
    }

    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('dummy')) {
      inMemoryLeaderboard.push({ username: finalUsername, topic, score, outcome, opponent });
      return res.status(200).json({ success: true, data: [{ username: finalUsername, topic, score }] });
    }

    const record = { username: finalUsername, topic, score };
    if (outcome) record.outcome = outcome;
    if (opponent) record.opponent = opponent;
    if (user_id) record.user_id = user_id;

    const { data, error } = await supabase
      .from('leaderboard')
      .insert([record]);
      
    if (error) throw error;
    
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error saving score:', error);
    res.status(500).json({ error: 'Failed to save score' });
  }
};


export const getLeaderboard = async (req, res) => {
  try {
    if (!process.env.SUPABASE_URL || process.env.SUPABASE_URL.includes('dummy')) {
      const aggregated = {};
      inMemoryLeaderboard.forEach(row => {
        const key = `${row.username}:::${row.topic}`;
        if (!aggregated[key]) {
          aggregated[key] = { username: row.username, topic: row.topic, score: 0 };
        }
        aggregated[key].score += row.score;
      });
      const data = Object.values(aggregated)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      return res.status(200).json(data);
    }

    // Fetch top scores to aggregate (Limit to prevent memory crashes on large databases)
    const { data, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(2000);
      
    if (error) throw error;
    
    // Group and sum up the scores
    const aggregated = {};
    if (data) {
      data.forEach(row => {
        const key = `${row.username}:::${row.topic}`;
        if (!aggregated[key]) {
          aggregated[key] = {
            username: row.username,
            topic: row.topic,
            score: 0
          };
        }
        aggregated[key].score += row.score;
      });
    }

    const finalData = Object.values(aggregated)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);
    
    res.status(200).json(finalData);
  } catch (error) {
    console.error('Error fetching leaderboard:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
};

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Home, Loader2 } from 'lucide-react';
import { API_BASE } from '../lib/api';

export default function Leaderboard() {
  const navigate = useNavigate();
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/leaderboard`)
      .then(res => res.json())
      .then(data => {
        // Guard: API must return an array
        setLeaders(Array.isArray(data) ? data : []);
        setLoading(false);
      })
      .catch(err => {
        console.error('[Leaderboard] Fetch error:', err);
        setError(true);
        setLoading(false);
      });
  }, []);

  return (
    <div className="w-full max-w-2xl glass-panel p-8 animate-slide-up relative overflow-hidden">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary-500/10 blur-[80px] rounded-full pointer-events-none" />
      
      <div className="flex items-center gap-4 mb-8 border-b border-gray-700/50 pb-6">
        <div className="w-12 h-12 rounded-xl bg-primary-500/20 text-primary-400 flex items-center justify-center ring-2 ring-primary-500/30">
          <Trophy size={24} />
        </div>
        <div>
          <h1 className="text-3xl font-black tracking-tight text-white">Global Leaderboard</h1>
          <p className="text-gray-400">Top scholars in the arena</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={32} className="animate-spin text-primary-500" />
        </div>
      ) : error ? (
        <div className="text-center py-12 text-red-400">
          Failed to load leaderboard. Is the backend running?
        </div>
      ) : leaders.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No battles fought yet. Be the first!
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {leaders.map((leader, i) => (
            <div
              key={leader.id ?? `leader-${i}`}
              className={`flex items-center justify-between p-4 rounded-xl border ${
                i === 0 ? 'bg-yellow-500/10 border-yellow-500/30' :
                i === 1 ? 'bg-gray-300/10 border-gray-300/20' :
                i === 2 ? 'bg-orange-700/10 border-orange-700/20' :
                'bg-gray-800/50 border-gray-700/50'
              }`}
            >
              <div className="flex items-center gap-4">
                <div className={`font-bold w-6 text-center ${
                  i === 0 ? 'text-yellow-400' :
                  i === 1 ? 'text-gray-300' :
                  i === 2 ? 'text-orange-400' :
                  'text-gray-500'
                }`}>
                  #{i + 1}
                </div>
                <div>
                  <div className="font-bold text-white tracking-wide">{leader.username}</div>
                  <div className="text-xs text-gray-400">{leader.topic}</div>
                </div>
              </div>
              <div className="text-xl font-mono font-bold text-primary-400">
                {leader.score}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => navigate('/')}
        className="mt-8 w-full bg-gray-800 hover:bg-gray-700 text-white font-bold py-4 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 border border-gray-700 hover:border-gray-600"
      >
        <Home size={20} /> Back to Home
      </button>
    </div>
  );
}

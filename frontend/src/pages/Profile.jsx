import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trophy, Swords, BookOpen, LogOut, ChevronRight, Star, TrendingUp, Clock, Crown, Shield, Target } from 'lucide-react';
import { supabase } from '../supabase';
import { API_BASE } from '../lib/api';

/* ── Mini stat card ──────────────────────────────────── */
// eslint-disable-next-line no-unused-vars
function MiniStat({ icon: Icon, label, value, color }) {
  return (
    <div className="mini-stat-card">
      <Icon size={18} className={color} />
      <div>
        <div className="font-serif text-xl font-bold text-on-surface">{value}</div>
        <div className="font-sans text-[10px] uppercase tracking-widest text-on-surface-variant">{label}</div>
      </div>
    </div>
  );
}

/* ── Outcome badge ───────────────────────────────────── */
function OutcomeBadge({ outcome }) {
  const cfg = {
    win: { icon: Crown, cls: 'badge-win', label: 'Win' },
    loss: { icon: Shield, cls: 'badge-loss', label: 'Loss' },
    draw: { icon: Swords, cls: 'badge-draw', label: 'Draw' },
  }[outcome] || { icon: Swords, cls: 'badge-draw', label: '–' };
  const Icon = cfg.icon;
  return (
    <span className={`outcome-badge ${cfg.cls}`}>
      <Icon size={11} /> {cfg.label}
    </span>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [stats, setStats] = useState({ totalBattles: 0, wins: 0, losses: 0, draws: 0, bestScore: 0, avgScore: 0, username: '' });
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUsername, setNewUsername] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const { data } = await supabase?.auth.getUser() || { data: {} };
        if (!mounted) return;
        
        if (!data?.user) { 
          navigate('/'); 
          return; 
        }
        setUser(data.user);

        // Fetch stats from backend
        const identifier = data.user.email || data.user.id;
        const res = await fetch(`${API_BASE}/api/profile/${encodeURIComponent(identifier)}`);
        if (res.ok) {
          const d = await res.json();
          if (mounted) {
            setHistory(d.history || []);
            setStats(d.stats || { totalBattles: 0, wins: 0, losses: 0, draws: 0, bestScore: 0, avgScore: 0, username: '' });
          }
        }
      } catch (e) {
        console.error('[Profile] Load error:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    load();
    return () => { mounted = false; };
  }, [navigate]);

  const handleSignOut = async () => {
    await supabase?.auth.signOut();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="profile-loading bg-surface-container-lowest min-h-screen flex flex-col items-center justify-center">
        <div className="loading-spinner border-primary" style={{ borderTopColor: 'transparent' }} />
        <p className="font-body text-on-surface-variant mt-4 animate-pulse">Consulting the Scriptorium…</p>
      </div>
    );
  }

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'Scholar';
  const avatar = user?.user_metadata?.avatar_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=f2ca50&color=3c2f00&size=128`;
  const winRate = stats?.totalBattles > 0 ? Math.round((stats.wins / stats.totalBattles) * 100) : 0;

  if (!user) return <div className="min-h-screen bg-black" />; // Fallback to black instead of true null

  const handleUpdateName = async () => {
    if (!newName.trim()) return;
    const { error } = await supabase.auth.updateUser({
      data: { 
        full_name: newName.trim(),
        username: newUsername.trim()
      }
    });
    if (error) {
      alert('Failed: ' + error.message);
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="profile-root animate-slide-up bg-surface-container-lowest min-h-screen p-6 overflow-x-hidden">
      <div className="ambient-glow glow-gold" style={{ opacity: 0.2 }} />

      <button onClick={() => navigate('/home')} className="profile-back hover:text-primary transition-colors mb-8 inline-flex items-center gap-2">
        <ChevronRight size={16} className="rotate-180" /> Back to Arena
      </button>

      <div className="profile-header flex flex-col md:flex-row items-center gap-8 mb-12">
        <div className="profile-avatar-wrap relative">
          <img src={avatar} alt={displayName} className="profile-avatar w-24 h-24 md:w-32 md:h-32 rounded-full border-2 border-primary/20 p-1" />
          <div className="profile-badge absolute bottom-0 right-0 bg-primary rounded-full p-2 shadow-lg">
            <Star size={14} className="text-on-primary" />
          </div>
        </div>
        
        <div className="profile-info text-center md:text-left flex-1">
          {editingName ? (
            <div className="flex flex-col gap-3 mb-2">
              <input
                type="text"
                className="bg-surface-variant/20 border border-primary/30 rounded-lg px-4 py-2 text-on-surface font-serif text-2xl focus:border-primary outline-none"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                autoFocus
                placeholder="Full Name..."
              />
              <input
                type="text"
                className="bg-surface-variant/20 border border-primary/30 rounded-lg px-4 py-2 text-on-surface font-sans text-sm focus:border-primary outline-none"
                value={newUsername}
                onChange={(e) => setNewUsername(e.target.value)}
                placeholder="Gamer Tag / Username..."
              />
              <div className="flex gap-4">
                <button onClick={handleUpdateName} className="text-xs font-sans uppercase tracking-[0.2em] text-primary hover:brightness-125">Confirm</button>
                <button onClick={() => setEditingName(false)} className="text-xs font-sans uppercase tracking-[0.2em] text-on-surface-variant">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="group relative">
              <h1 className="font-serif text-3xl md:text-4xl font-bold text-on-surface flex items-center justify-center md:justify-start gap-2">
                {displayName.split('#')[0]}
                <button onClick={() => { 
                  setEditingName(true); 
                  setNewName(displayName.split('#')[0]);
                  setNewUsername(user?.user_metadata?.username || ((stats?.username || '').split('#')[0]) || '');
                }} className="opacity-0 group-hover:opacity-100 transition-opacity ml-4 text-[10px] text-primary border border-primary/20 px-2 rounded">Edit</button>
              </h1>
              <p className="font-sans text-sm text-primary mb-1 mt-1">
                @{user?.user_metadata?.username || ((stats?.username || '').split('#')[0]) || user?.email?.split('@')[0]}
                <span className="opacity-50">#{ ((stats?.username || '').toString()).includes('#') ? stats.username.split('#')[1] : '0000'}</span>
              </p>
            </div>
          )}
          <p className="font-sans text-sm text-on-surface-variant mb-3">{user?.email}</p>
          <div className="profile-rank inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full border border-primary/20">
            <Trophy size={14} className="text-primary" />
            <span className="font-sans text-[10px] uppercase tracking-widest text-primary font-bold">
              {stats?.bestScore >= 400 ? 'Grand Master' : stats?.bestScore >= 250 ? 'Master' : 'Initiate'}
            </span>
          </div>
        </div>


        <button onClick={handleSignOut} className="btn-signout mt-4 md:mt-0 flex items-center gap-2 text-on-surface-variant hover:text-red-400 transition-colors">
          <LogOut size={18} /> <span className="text-xs uppercase tracking-widest">Withdraw</span>
        </button>
      </div>

      {/* ── Stats Grid ── */}
      <div className="profile-stats-grid">
        <MiniStat icon={Swords} label="Total Battles" value={stats.totalBattles} color="text-primary" />
        <MiniStat icon={Crown} label="Wins" value={stats.wins} color="text-yellow-400" />
        <MiniStat icon={Shield} label="Losses" value={stats.losses} color="text-blue-400" />
        <MiniStat icon={Target} label="Win Rate" value={`${winRate}%`} color="text-green-400" />
        <MiniStat icon={TrendingUp} label="Best Score" value={stats.bestScore} color="text-purple-400" />
        <MiniStat icon={Star} label="Avg Score" value={stats.avgScore} color="text-orange-400" />
      </div>

      {/* ── Win Rate bar ── */}
      <div className="win-rate-section">
        <div className="flex justify-between items-center mb-2">
          <span className="font-sans text-xs uppercase tracking-widest text-on-surface-variant">Win Rate</span>
          <span className="font-serif text-lg font-bold text-on-surface">{winRate}%</span>
        </div>
        <div className="win-rate-bar">
          <div className="win-rate-fill" style={{ width: `${winRate}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[10px] font-sans text-yellow-400">{stats.wins} W</span>
          <span className="text-[10px] font-sans text-on-surface-variant">{stats.draws} D</span>
          <span className="text-[10px] font-sans text-blue-400">{stats.losses} L</span>
        </div>
      </div>

      {/* ── Battle History ── */}
      <div className="history-section">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-serif text-xl font-semibold text-on-surface flex items-center gap-2">
            <Clock size={18} className="text-primary" /> Battle History
          </h2>
          <span className="font-sans text-xs text-on-surface-variant">{history.length} entries</span>
        </div>

        {history.length === 0 ? (
          <div className="history-empty">
            <BookOpen size={40} className="text-on-surface-variant/40 mb-3" />
            <p className="font-body text-on-surface-variant italic">No battles recorded yet.</p>
            <p className="font-sans text-xs text-on-surface-variant/60 mt-1">Play your first battle to see results here.</p>
          </div>
        ) : (
          <div className="history-list">
            {history.slice(0, 20).map((entry, i) => (
              <div key={i} className="history-row">
                <div className="history-row-left">
                  <OutcomeBadge outcome={entry.outcome} />
                  <div>
                    <div className="font-body text-on-surface text-sm font-medium">{entry.topic || 'General Knowledge'}</div>
                    <div className="font-sans text-[10px] text-on-surface-variant">vs {entry.opponent || 'Unknown'} · {entry.created_at ? new Date(entry.created_at).toLocaleDateString() : 'Recently'}</div>
                  </div>
                </div>
                <div className="history-row-right">
                  <span className="font-serif text-lg font-bold text-primary">{entry.score}</span>
                  <span className="font-sans text-[10px] text-on-surface-variant">pts</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Play Again CTA ── */}
      <button onClick={() => navigate('/home')} className="profile-play-btn">
        <Swords size={18} /> Enter Another Battle
        <span className="btn-shimmer" />
      </button>
    </div>
  );
}

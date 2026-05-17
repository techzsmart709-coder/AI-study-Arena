import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, BookOpen, Trophy, Zap, Users, Star, ChevronRight, LogIn, Play, Brain, Target, Clock, Shield } from 'lucide-react';
import { supabase } from '../supabase';
import { API_BASE } from '../lib/api';

/* ── Particle Canvas ─────────────────────────────────────────── */
function ParticleCanvas() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let w = (canvas.width = window.innerWidth);
    let h = (canvas.height = window.innerHeight);
    const particles = Array.from({ length: 70 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      r: Math.random() * 1.5 + 0.3,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      alpha: Math.random() * 0.5 + 0.1,
    }));

    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = w;
        if (p.x > w) p.x = 0;
        if (p.y < 0) p.y = h;
        if (p.y > h) p.y = 0;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(242,202,80,${p.alpha})`;
        ctx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: 0, opacity: 0.6 }}
    />
  );
}

/* ── Stat Card ─────────────────────────────────────────────── */
// eslint-disable-next-line no-unused-vars
function StatCard({ icon: Icon, value, label, delay }) {
  const [count, setCount] = useState(0);
  const target = parseInt(value.replace(/\D/g, ''));

  useEffect(() => {
    const timer = setTimeout(() => {
      let start = 0;
      const step = Math.ceil(target / 60);
      const interval = setInterval(() => {
        start += step;
        if (start >= target) { setCount(target); clearInterval(interval); }
        else setCount(start);
      }, 16);
      return () => clearInterval(interval);
    }, delay);
    return () => clearTimeout(timer);
  }, [target, delay]);

  return (
    <div className="stat-card group">
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3 mx-auto group-hover:bg-primary/20 transition-colors">
        <Icon size={22} className="text-primary" />
      </div>
      <div className="font-serif text-3xl font-bold text-on-surface mb-1">
        {count.toLocaleString()}{value.includes('+') ? '+' : value.includes('%') ? '%' : ''}
      </div>
      <div className="font-sans text-xs uppercase tracking-widest text-on-surface-variant">{label}</div>
    </div>
  );
}

/* ── Feature Card ──────────────────────────────────────────── */
// eslint-disable-next-line no-unused-vars
function FeatureCard({ icon: Icon, title, desc, color }) {
  return (
    <div className="feature-card group">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-4 ${color} group-hover:scale-110 transition-transform`}>
        <Icon size={20} className="text-on-surface" />
      </div>
      <h3 className="font-serif text-lg font-semibold text-on-surface mb-2">{title}</h3>
      <p className="font-body text-sm text-on-surface-variant leading-relaxed">{desc}</p>
    </div>
  );
}

/* ── Main Landing ──────────────────────────────────────────── */
export default function Landing() {
  const navigate = useNavigate();
  const [authLoading, setAuthLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [scrolled, setScrolled] = useState(false);

  const [liveBattle, setLiveBattle] = useState({
    topic: 'Quantum Mechanics',
    players: ['Ishita Verma', 'Aarav Sharma'],
    scores: [720, 580]
  });

  const fetchLiveBattle = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/battles/live`);
      if (res.ok) {
        const data = await res.json();
        setLiveBattle({
          topic: data.topic,
          players: data.players,
          scores: [Math.floor(Math.random() * 300) + 600, Math.floor(Math.random() * 300) + 400]
        });
      }
    } catch (e) {
      console.error('Failed to fetch live battle:', e);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line
    fetchLiveBattle();
    const interval = setInterval(fetchLiveBattle, 120000); // 2 minutes
    supabase?.auth.getUser().then(({ data }) => {
      if (data?.user) setUser(data.user);
    });
    const { data: listener } = supabase?.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user || null);
    }) || { data: null };
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll);
    return () => {
      clearInterval(interval);
      listener?.subscription?.unsubscribe();
      window.removeEventListener('scroll', onScroll);
    };
  }, []);


  const handleGoogleLogin = async () => {
    if (!supabase) return alert('Auth not configured. Check SUPABASE env vars.');
    setAuthLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/home` },
    });
    if (error) { alert('Login failed: ' + error.message); setAuthLoading(false); }
  };

  const handlePlayAsGuest = () => {
    sessionStorage.setItem('isGuest', 'true');
    navigate('/home');
  };

  const handlePlayAsUser = () => {
    navigate('/home');
  };

  return (
    <div className="landing-root">
      <ParticleCanvas />

      {/* ── Ambient glows ── */}
      <div className="ambient-glow glow-gold" />
      <div className="ambient-glow glow-blue" />
      <div className="ambient-glow glow-purple" />

      {/* ── Navbar ── */}
      <nav className={`landing-nav ${scrolled ? 'nav-scrolled' : ''}`}>
        <div className="nav-inner">
          <div className="flex items-center gap-3">
            <div className="nav-logo-icon">
              <BookOpen size={18} className="text-primary" />
            </div>
            <span className="font-serif text-lg font-semibold text-on-surface">AI Study Arena</span>
          </div>
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <button onClick={() => navigate('/profile')} className="btn-ghost">
                  <img
                    src={user.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.user_metadata?.full_name || 'U')}&background=f2ca50&color=3c2f00`}
                    alt="avatar"
                    className="w-7 h-7 rounded-full object-cover"
                  />
                  <span className="hidden md:inline">{user.user_metadata?.full_name?.split(' ')[0] || 'Profile'}</span>
                </button>
                <button onClick={handlePlayAsUser} className="btn-primary-sm">
                  Enter Arena <ChevronRight size={16} />
                </button>
              </>
            ) : (
              <>
                <button onClick={handleGoogleLogin} disabled={authLoading} className="btn-ghost">
                  <LogIn size={16} />
                  {authLoading ? 'Redirecting…' : 'Sign In'}
                </button>
                <button onClick={handlePlayAsGuest} className="btn-primary-sm">
                  Play Now <Play size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="hero-section">
        <div className="hero-badge">
          <Zap size={12} className="text-primary" />
          <span>Powered by AI · Real-Time · Free to Play</span>
        </div>

        <h1 className="hero-title">
          The Ultimate<br />
          <span className="hero-title-accent">Scholar Arena</span>
        </h1>

        <p className="hero-subtitle">
          Challenge your intellect. Battle real opponents. Defeat an AI rival.<br className="hidden md:block" />
          Compete across 200+ academic domains — from Quantum Mechanics to Ancient Rome.
        </p>

        {/* ── CTA Buttons ── */}
        <div className="hero-cta">
          {user ? (
            <button onClick={handlePlayAsUser} id="cta-enter-arena" className="btn-hero-primary">
              <Swords size={20} />
              Enter the Arena
              <span className="btn-shimmer" />
            </button>
          ) : (
            <>
              <button onClick={handleGoogleLogin} disabled={authLoading} id="cta-google-login" className="btn-hero-primary">
                <svg width="20" height="20" viewBox="0 0 48 48" className="shrink-0">
                  <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                  <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                  <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                  <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                </svg>
                {authLoading ? 'Signing In…' : 'Sign In with Google'}
                <span className="btn-shimmer" />
              </button>
              <button onClick={handlePlayAsGuest} id="cta-play-guest" className="btn-hero-secondary">
                <Play size={18} />
                Play Without Login
              </button>
            </>
          )}
        </div>

        <p className="hero-note">
          {user ? `Welcome back, ${user.user_metadata?.full_name?.split(' ')[0] || 'Scholar'}! Your progress is saved.` 
                 : 'Guest play is free — sign in to save progress, track history & climb the leaderboard.'}
        </p>

        {/* ── Floating badge row ── */}
        <div className="hero-badges">
          {['No Ads', 'Free Forever', 'AI-Powered', '200+ Topics'].map((b) => (
            <span key={b} className="badge-pill">{b}</span>
          ))}
        </div>

        {/* ── Hero arena preview card ── */}
        <div className="arena-preview">
          <div className="arena-preview-header">
            <div className="arena-player">
              <div className="player-avatar player-you">{liveBattle.players[0][0]}</div>
              <div>
                <div className="text-xs font-sans text-on-surface-variant uppercase tracking-widest text-left">Scholar</div>
                <div className="font-serif text-on-surface font-semibold text-left">{liveBattle.players[0]}</div>
              </div>
            </div>
            <div className="arena-vs">
              <Swords size={28} className="text-primary" />
              <span className="text-xs font-sans text-on-surface-variant mt-1">LIVE BATTLE</span>
            </div>
            <div className="arena-player arena-player-right">
              <div>
                <div className="text-xs font-sans text-on-surface-variant uppercase tracking-widest text-right">Rival</div>
                <div className="font-serif text-on-surface font-semibold text-right">{liveBattle.players[1]}</div>
              </div>
              <div className="player-avatar player-ai">{liveBattle.players[1][0]}</div>
            </div>
          </div>
          <div className="arena-preview-body">
            <div className="quiz-question-mock">
              <span className="text-primary font-sans text-xs uppercase tracking-widest">Ongoing Trial · {liveBattle.topic}</span>
              <p className="font-body text-on-surface mt-2 text-sm text-left">What is the fundamental principle that determines the outcome of this scholarly duel?</p>
            </div>
            <div className="score-bars">
              <div className="score-bar-row">
                <span className="text-xs text-on-surface-variant font-sans w-16 text-left truncate">{liveBattle.players[0].split(' ')[0]}</span>
                <div className="score-bar"><div className="score-bar-fill" style={{ width: `${(liveBattle.scores[0] / 1000) * 100}%` }} /></div>
                <span className="text-xs text-primary font-serif font-bold w-10 text-right">{liveBattle.scores[0]}</span>
              </div>
              <div className="score-bar-row">
                <span className="text-xs text-on-surface-variant font-sans w-16 text-left truncate">{liveBattle.players[1].split(' ')[0]}</span>
                <div className="score-bar"><div className="score-bar-fill score-bar-ai" style={{ width: `${(liveBattle.scores[1] / 1000) * 100}%` }} /></div>
                <span className="text-xs text-blue-400 font-serif font-bold w-10 text-right">{liveBattle.scores[1]}</span>
              </div>
            </div>
          </div>
        </div>

      </section>

      {/* ── STATS ── */}
      <section className="section">
        <div className="section-label">By The Numbers</div>
        <div className="stats-grid">
          <StatCard icon={Users} value="12000+" label="Active Scholars" delay={0} />
          <StatCard icon={Trophy} value="5800+" label="Battles Won" delay={150} />
          <StatCard icon={BookOpen} value="200+" label="Study Domains" delay={300} />
          <StatCard icon={Star} value="98%" label="Accuracy Rate" delay={450} />
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="section section-dark">
        <div className="section-label">The Ordeal</div>
        <h2 className="section-title">How the Arena Works</h2>
        <div className="steps-grid">
          {[
            { n: 'I', title: 'Declare Your Domain', desc: 'Choose from 200+ subjects — Physics, History, Code, Philosophy, and beyond.' },
            { n: 'II', title: 'Enter the Study Room', desc: 'A 30-second pre-battle deliberation chamber with your matched opponent.' },
            { n: 'III', title: 'Survive the Trial', desc: 'Answer 5 AI-generated questions. Speed and accuracy both score points.' },
            { n: 'IV', title: 'Claim Your Glory', desc: 'See results, climb the leaderboard, and track your scholarly evolution.' },
          ].map((step) => (
            <div key={step.n} className="step-card">
              <div className="step-number">{step.n}</div>
              <h3 className="font-serif text-lg font-semibold text-on-surface mb-2">{step.title}</h3>
              <p className="font-body text-sm text-on-surface-variant">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section className="section">
        <div className="section-label">What We Offer</div>
        <h2 className="section-title">Built for Scholars, Powered by AI</h2>
        <div className="features-grid">
          <FeatureCard icon={Brain} title="AI-Powered Questions" desc="Every battle generates fresh, domain-specific questions via Gemini & GPT — no repeats." color="bg-primary/20" />
          <FeatureCard icon={Users} title="Real-Time Matchmaking" desc="Match against real students worldwide. No human? An AI challenger steps in instantly." color="bg-blue-500/20" />
          <FeatureCard icon={Target} title="Score by Speed" desc="Faster correct answers earn more points. Precision meets agility in every round." color="bg-purple-500/20" />
          <FeatureCard icon={Clock} title="30s Study Room" desc="Pre-battle deliberation phase to warm up, strategize, and talk strategy with your opponent." color="bg-green-500/20" />
          <FeatureCard icon={Trophy} title="Global Leaderboard" desc="Climb the all-time rankings. Your username, your legacy — persistent across sessions." color="bg-orange-500/20" />
          <FeatureCard icon={Shield} title="Guest Friendly" desc="No account required to start. Jump in immediately and decide to register later." color="bg-red-500/20" />
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section className="section final-cta-section">
        <div className="final-cta-card">
          <div className="ambient-glow glow-final" />
          <div className="section-label" style={{ marginBottom: '1rem' }}>Ready?</div>
          <h2 className="font-serif text-4xl md:text-5xl font-bold text-on-surface mb-4 relative">
            The Arena Awaits
          </h2>
          <p className="font-body text-on-surface-variant text-lg mb-8 max-w-md mx-auto relative">
            Join thousands of scholars competing in real-time academic battles. Your domain. Your glory.
          </p>
          <div className="hero-cta relative">
            {user ? (
              <button onClick={handlePlayAsUser} className="btn-hero-primary">
                <Swords size={20} /> Enter the Arena <span className="btn-shimmer" />
              </button>
            ) : (
              <>
                <button onClick={handleGoogleLogin} disabled={authLoading} className="btn-hero-primary">
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
                    <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
                    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
                    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
                  </svg>
                  {authLoading ? 'Signing In…' : 'Sign In & Save Progress'}
                  <span className="btn-shimmer" />
                </button>
                <button onClick={handlePlayAsGuest} className="btn-hero-secondary">
                  <Play size={18} /> Play as Guest
                </button>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="landing-footer">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen size={16} className="text-primary" />
          <span className="font-serif text-on-surface font-semibold">AI Study Arena</span>
        </div>
        <p className="text-on-surface-variant text-xs font-sans">
          Built with ❤️ for curious minds · {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}

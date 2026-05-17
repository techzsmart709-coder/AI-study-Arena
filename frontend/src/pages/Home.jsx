import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Swords, BookOpen, User } from 'lucide-react';
import { socket } from '../socket';
import { supabase } from '../supabase';

export default function Home() {
  const [username, setUsername] = useState('');
  const [topic, setTopic] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [authUser, setAuthUser] = useState(null);
  const [matchType, setMatchType] = useState('rapid'); // rapid or custom
  const [customCount, setCustomCount] = useState(5); // default 5 for custom
  const navigate = useNavigate();

  useEffect(() => {
    supabase?.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setAuthUser(data.user);
        // Prioritize Full Name as requested
        const name = data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || '';
        setUsername(name);
      }
    });

  }, []);

  // DISK-LESS DATASET: Hundreds of subjects embedded directly in the frontend for instant, zero-API filtering
  const scholarDomains = useMemo(() => [
    // --- SCIENCE ---
    "Physics", "Astrophysics", "Quantum Mechanics", "Nuclear Physics", "Particle Physics", "Theoretical Physics", "Thermodynamics",
    "Chemistry", "Organic Chemistry", "Inorganic Chemistry", "Physical Chemistry", "Biochemistry", "Molecular Biology", "Genetics",
    "Biology", "Marine Biology", "Evolutionary Biology", "Microbiology", "Botany", "Zoology", "Neuroscience", "Pharmacology",
    "Earth Science", "Geology", "Paleontology", "Meteorology", "Oceanography", "Environmental Science", "Ecology", "Astronomy",
    "Forensic Science", "Kinesiology", "Virology", "Immunology", "Biotechnology", "Nanotechnology",

    // --- ENGINEERING ---
    "Electrical Engineering", "Electronics", "Mechanical Engineering", "Civil Engineering", "Aerospace Engineering", "Chemical Engineering",
    "Industrial Engineering", "Software Engineering", "Computer Science", "Bioengineering", "Materials Science", "Robotics", 
    "Artificial Intelligence", "Cybersecurity", "Blockchain Technology", "Data Science", "Information Technology", "System Engineering",
    "Environmental Engineering", "Structural Engineering", "Telecommunications", "Fluid Mechanics", "Mechatronics", "Automotive Engineering",
    "Petroleum Engineering", "Energy Engineering", "Biomedical Engineering", "Embedded Systems",

    // --- HISTORY ---
    "Ancient History", "Medieval History", "Modern History", "World History", "Political History", "Military History", "Economic History",
    "Art History", "History of Science", "Classical Civilizations", "Archaeology", "Anthropology", "Cultural Heritage", 
    "Renaissance Studies", "Colonial History", "Contemporary History", "Intellectual History",

    // --- GEOGRAPHY & SOCIAL ---
    "Geography", "Human Geography", "Physical Geography", "Geopolitics", "Urban Planning", "Demography", "Climatology", "Cartography",
    "Psychology", "Social Psychology", "Cognitive Science", "Developmental Psychology", "Sociology", "Social Work", "Criminology",
    "Political Science", "International Relations", "Public Administration", "Economics", "Microeconomics", "Macroeconomics", "Econometrics",

    // --- HUMANITIES & ARTS ---
    "Philosophy", "Ethics", "Logic", "Epistemology", "Linguistics", "Literature", "English Literature", "Comparative Literature",
    "Classical Literature", "Media Studies", "Communication Studies", "Film Studies", "Journalism", "Music Theory", "Visual Arts",
    "Graphic Design", "Architecture", "Religious Studies", "Theology", "Education", "Pedagogy",

    // --- MATHEMATICS ---
    "Mathematics", "Pure Mathematics", "Applied Mathematics", "Calculus", "Linear Algebra", "Discrete Mathematics", "Topology",
    "Probability and Statistics", "Number Theory", "Algebraic Geometry", "Game Theory", "Differential Equations",

    // --- MEDICINE & LAW ---
    "Medicine", "Anatomy", "Physiology", "Pathology", "Nursing", "Public Health", "Epidemiology", "Law", "International Law", "Constitutional Law"
  ], []);

  // Filter instantly from our embedded dataset - Derived state avoids cascading renders
  const filteredTopics = useMemo(() => {
    if (topic.trim().length < 1 || !showDropdown) return [];
    return scholarDomains
      .filter(d => d.toLowerCase().includes(topic.toLowerCase()))
      .sort((a, b) => a.toLowerCase().indexOf(topic.toLowerCase()) - b.toLowerCase().indexOf(topic.toLowerCase())) // Better relevance
      .slice(0, 8);
  }, [topic, showDropdown, scholarDomains]);

  const handleTopicChange = (e) => {
    setTopic(e.target.value);
    setShowDropdown(true);
  };

  const selectTopic = (t) => {
    setTopic(t);
    setShowDropdown(false);
  };

  const handleStart = (e) => {
    e.preventDefault();
    if (!username || !topic) return;

    // Store match preferences
    sessionStorage.setItem('username', username);
    sessionStorage.setItem('topic', topic);
    sessionStorage.setItem('matchType', matchType);
    sessionStorage.setItem('numQuestions', matchType === 'custom' ? customCount : 5);

    // Connect socket if not connected
    if (!socket.connected) {
      socket.connect();
    }

    navigate('/matchmaking');
  };

  return (
    <div className="w-full max-w-lg animate-slide-up mx-auto">
      {/* Profile / back link */}
      <div className="flex justify-between items-center mb-6">
        <button onClick={() => navigate('/')} className="text-on-surface-variant hover:text-primary text-xs font-sans uppercase tracking-widest transition-colors">
          ← Landing
        </button>
        {authUser ? (
          <button onClick={() => navigate('/profile')} className="flex items-center gap-2 text-xs font-sans text-on-surface-variant hover:text-primary transition-colors">
            <img src={authUser.user_metadata?.avatar_url || ''} alt="" className="w-6 h-6 rounded-full" />
            <span>{authUser.user_metadata?.full_name?.split(' ')[0] || 'Profile'}</span>
            <User size={14} />
          </button>
        ) : (
          <button onClick={() => navigate('/')} className="text-on-surface-variant hover:text-primary text-xs font-sans uppercase tracking-widest transition-colors">
            Sign In →
          </button>
        )}
      </div>
      <div className="text-center mb-10">
        <div className="mb-6">
          <BookOpen strokeWidth={1} size={56} className="text-primary mx-auto opacity-80" />
        </div>
        <h1 className="font-serif text-5xl md:text-6xl tracking-[-0.02em] mb-3 text-on-surface">
          AI Study Arena
        </h1>
        <p className="font-body text-on-surface-variant text-xl italic mb-8">
          Enter the Digital Scriptorium. Match. Confer. Battle.
        </p>
        
        {/* How It Works Guide */}
        <div className="scholar-card border border-outline-variant/20 rounded-sm p-6 text-left mx-auto max-w-md">
          <h2 className="font-sans text-xs font-semibold text-primary uppercase tracking-widest mb-4 flex items-center gap-2">
             The Ordeal
          </h2>
          <ol className="font-body text-on-surface-variant space-y-4">
            <li className="flex items-start gap-4">
              <span className="font-serif text-primary font-bold">I.</span>
              <span>Declare your scholarly intent and domain of study.</span>
            </li>
            <li className="flex items-start gap-4">
              <span className="font-serif text-primary font-bold">II.</span>
              <span>Match dynamically into a 30-second deliberation room.</span>
            </li>
            <li className="flex items-start gap-4">
              <span className="font-serif text-primary font-bold">III.</span>
              <span>Survive the ensuing trial to establish your dominance.</span>
            </li>
          </ol>
        </div>
      </div>

      <form onSubmit={handleStart} className="glass-panel border border-outline-variant/40 p-8 space-y-8 rounded-sm mx-auto max-w-md scholar-shadow relative overflow-hidden">
        {/* Subtle decorative top border */}
        <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary-container to-transparent opacity-50"></div>

        <div className="space-y-2">
          <label className="font-sans text-xs font-semibold tracking-wider text-on-surface uppercase flex items-center gap-2">
            Scholar Identity
          </label>
          <input
            type="text"
            className={`w-full bg-transparent border-b border-outline-variant/50 px-0 py-3 text-on-surface font-body text-lg focus:border-primary focus:ring-0 outline-none transition-colors placeholder:text-surface-container-highest placeholder:italic ${authUser ? 'opacity-50 cursor-not-allowed italic' : ''}`}
            placeholder="e.g., Scholar Vane"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={!!authUser}
            required
          />
          {authUser && <p className="text-[10px] font-sans text-primary/60 mt-1 italic">Identity managed in Profile</p>}
        </div>


        <div className="space-y-2 relative">
          <label className="font-sans text-xs font-semibold tracking-wider text-on-surface uppercase flex items-center gap-2">
            Domain of Focus
          </label>
          <input
            type="text"
            className="w-full bg-transparent border-b border-outline-variant/50 px-0 py-3 text-on-surface font-body text-lg focus:border-primary focus:ring-0 outline-none transition-colors placeholder:text-surface-container-highest placeholder:italic"
            placeholder="e.g., Quantum Mechanics, Ancient History"
            value={topic}
            onChange={handleTopicChange}
            onFocus={() => topic.trim() && setShowDropdown(true)}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
            required
          />
          
          {showDropdown && filteredTopics.length > 0 && (
            <div className="absolute z-50 w-full mt-2 bg-surface-container-high border border-outline-variant/30 rounded-sm shadow-2xl overflow-hidden font-body">
              {filteredTopics.map((t, i) => (
                <div 
                  key={i}
                  className="px-4 py-3 hover:bg-surface-container-highest cursor-pointer text-on-surface transition-colors border-b last:border-b-0 border-outline-variant/20"
                  onClick={() => selectTopic(t)}
                >
                  {t}
                </div>
              ))}
            </div>
          )}
          
          {showDropdown && topic.trim().length >= 2 && filteredTopics.length === 0 && (
            <div className="absolute z-50 w-full mt-2 bg-primary/10 border border-primary/30 rounded-sm shadow-xl px-4 py-3 text-on-surface font-body text-sm italic">
              A unique domain. The Arena will adapt to your choice.
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex gap-4">
            <button type="button" onClick={() => setMatchType('rapid')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest border ${matchType === 'rapid' ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant text-on-surface-variant'}`}>Rapid</button>
            <button type="button" onClick={() => setMatchType('custom')} className={`flex-1 py-2 text-xs font-bold uppercase tracking-widest border ${matchType === 'custom' ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant text-on-surface-variant'}`}>Custom</button>
          </div>
          {matchType === 'custom' && (
            <div className="flex items-center gap-4">
              <label className="text-xs text-on-surface-variant">Questions:</label>
              <input type="number" min="3" max="20" value={customCount} onChange={(e) => setCustomCount(e.target.value)} className="w-16 bg-transparent border-b border-outline-variant text-on-surface text-center" />
            </div>
          )}
        </div>

        <button
          type="submit"
          className="w-full group bg-gradient-to-r from-primary-fixed to-primary-container hover:from-primary hover:to-primary-fixed-dim text-on-primary font-serif font-bold tracking-wide text-lg py-4 rounded-sm transition-all shadow-[0_0_15px_rgba(212,175,55,0.2)] hover:shadow-[0_0_25px_rgba(212,175,55,0.4)] flex justify-center items-center gap-3"
        >
          <span>Begin Trial</span>
          <Swords size={20} className="opacity-80 group-hover:opacity-100 transition-opacity" />
        </button>
      </form>
    </div>
  );
}

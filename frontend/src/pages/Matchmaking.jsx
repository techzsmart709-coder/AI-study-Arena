import { useEffect, useState } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { Search } from 'lucide-react';
import { socket } from '../socket';

export default function Matchmaking() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Searching for an opponent...');
  const [countdown, setCountdown] = useState(30);
  const [nearbySeekers, setNearbySeekers] = useState([]);
  const [showNearby, setShowNearby] = useState(false);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (nextLocation.pathname === '/study') return false; // Allowed transition
    return currentLocation.pathname !== nextLocation.pathname;
  });

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const wantToQuit = window.confirm("Are you sure you want to quit? This will terminate your matchmaking session.");
      if (wantToQuit) {
        socket.emit('leave_matchmaking', { topic: sessionStorage.getItem('topic') });
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);


  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  useEffect(() => {
    const username = sessionStorage.getItem('username');
    const topic = sessionStorage.getItem('topic');
    const numQuestions = sessionStorage.getItem('numQuestions') || 5;

    if (!username || !topic) {
      navigate('/');
      return;
    }

    // Ping the server to find a match
    socket.emit('find_match', { username, topic, numQuestions });

    // Listen for match (backend handles bot fallback after 10s automatically)
    function handleMatch(roomData) {
      // Small artificial delay for immersion
      setTimeout(() => {
        setStatus('Match Found!');
        sessionStorage.setItem('roomData', JSON.stringify(roomData));
        
        // Delay so user can see "Match Found!" before jumping
        setTimeout(() => {
          navigate('/study');
        }, 800);
      }, 1000); 
    }

    socket.on('match_found', handleMatch);
    socket.on('nearby_seekers', ({ seekers }) => {
      setNearbySeekers(seekers);
    });

    // Discovery Loop: After 5 seconds, start looking for others on same topic
    const discoveryTimer = setTimeout(() => {
      socket.emit('get_nearby_seekers', { topic, numQuestions });
      setShowNearby(true);
    }, 5000);

    const discoveryInterval = setInterval(() => {
      if (showNearby) {
        socket.emit('get_nearby_seekers', { topic, numQuestions });
      }
    }, 5000);

    return () => {
      clearTimeout(discoveryTimer);
      clearInterval(discoveryInterval);
      socket.off('match_found', handleMatch);
      socket.off('nearby_seekers');
    };
  }, [navigate]);

  const handleJoinSeeker = (seeker) => {
    const topic = sessionStorage.getItem('topic');
    const username = sessionStorage.getItem('username');
    setStatus(`Joining ${seeker.username}'s trial...`);
    socket.emit('join_seeker', { targetSocketId: seeker.socketId, topic, username });
  };

  return (
    <div className="flex flex-col items-center justify-center animate-slide-up">
      <div className="relative">
        {/* Radar Ping Animation */}
        <div className="absolute inset-0 border-4 border-primary-500 rounded-full animate-ping opacity-20" />
        <div className="absolute inset-0 -m-8 border-2 border-blue-500 rounded-full animate-ping opacity-10 animation-delay-500" />
        
        <div className="relative z-10 bg-bg-panel border border-gray-700/50 w-32 h-32 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(139,92,246,0.2)]">
          <Search size={40} className="text-primary-400 animate-pulse" />
        </div>
      </div>
      
      <div className="mt-8 text-center space-y-4 max-w-sm px-6">
        <h2 className="font-serif text-2xl text-on-surface leading-tight">
          {status}
        </h2>
        
        {countdown > 0 && status !== 'Match Found!' && (
          <p className="font-body text-on-surface-variant text-sm italic">
            Searching for a worthy opponent... {countdown}s
          </p>
        )}

        {/* Nearby Seekers Section */}
        {showNearby && nearbySeekers.length > 0 && (
          <div className="mt-8 animate-fade-in space-y-3 bg-surface-container/30 p-4 border border-outline-variant/20 rounded-sm">
            <div className="font-sans text-[10px] uppercase tracking-widest text-primary mb-2 flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
              Other Scholars on this Topic
            </div>
            {nearbySeekers.map((s, idx) => (
              <div key={idx} className="flex items-center justify-between bg-surface-container/50 border border-outline-variant/30 p-3 rounded-sm hover:border-primary/40 transition-colors">
                <div className="text-left">
                  <div className="text-sm font-bold text-on-surface">{s.username}</div>
                  <div className="text-[10px] text-on-surface-variant uppercase tracking-wider">{s.numQuestions} Questions</div>
                </div>
                <button 
                  onClick={() => handleJoinSeeker(s)}
                  className="px-4 py-1.5 bg-primary/10 hover:bg-primary text-primary-200 hover:text-on-primary border border-primary/30 text-[10px] font-bold uppercase tracking-widest transition-all rounded-sm"
                >
                  Join
                </button>
              </div>
            ))}
            <p className="text-[9px] text-on-surface-variant italic">Join them to start the trial immediately with their question count.</p>
          </div>
        )}

        {(!showNearby || nearbySeekers.length === 0) && (
          <p className="mt-8 text-on-surface-variant opacity-60 text-xs italic">
            Scanning the neural net for a worthy challenger... Finding the best match for your domain of focus.
          </p>
        )}
      </div>
    </div>
  );
}

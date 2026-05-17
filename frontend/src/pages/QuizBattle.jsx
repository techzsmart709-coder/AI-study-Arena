import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { BrainCircuit, Loader2, CheckCircle2, XCircle, UserX } from 'lucide-react';
import { socket } from '../socket';

export default function QuizBattle() {
  const navigate = useNavigate();
  const [roomData] = useState(() => JSON.parse(sessionStorage.getItem('roomData') || 'null'));
  const [questions] = useState(() => JSON.parse(sessionStorage.getItem('roomQuestions') || '[]'));
  const [currentIdx, setCurrentIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(() => {
    const qAt = parseInt(sessionStorage.getItem('quizStartAt') || '0', 10);
    return qAt > Date.now();
  });
  const [timeLeft, setTimeLeft] = useState(10);
  const [selectedOption, setSelectedOption] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [opponentStats, setOpponentStats] = useState({ score: 0, answered: 0 });
  const [waitingForConclude, setWaitingForConclude] = useState(false);
  
  const [syncCountdown, setSyncCountdown] = useState(() => {
    const startAt = parseInt(sessionStorage.getItem('quizStartAt') || '0', 10);
    const delay = startAt - Date.now();
    return delay > 0 ? Math.ceil(delay / 1000) : null;
  });
  
  const isConcluded = useRef(false);
  const [opponentAbandoned, setOpponentAbandoned] = useState(false);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (nextLocation.pathname === '/result') return false;
    return currentLocation.pathname !== nextLocation.pathname;
  });

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const wantToQuit = window.confirm("Are you sure you want to quit? This will forfeit the match and terminate the session.");
      if (wantToQuit) {
        if (roomData?.roomId && !isConcluded.current) {
           socket.emit('abandon_battle', { roomId: roomData.roomId });
        }
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker, roomData]);


  // 1. Wrap in useCallback to avoid changing dependencies
  const handleAnswer = useCallback((option) => {
    if (!questions[currentIdx] || waitingForConclude) return;
    setSelectedOption(option);
    setShowAnswer(true);

    const isCorrect = option === questions[currentIdx].correctAnswer;
    const pointsEarned = isCorrect ? Math.max(10, timeLeft * 10) : 0;
    const newScore = score + pointsEarned;
    if (isCorrect) setScore(newScore);

    // REAL-TIME SYNC: Tell opponent our current progress
    if (roomData?.roomId) {
      socket.emit('update_score', { 
        roomId: roomData.roomId, 
        score: newScore, 
        answered: currentIdx + 1 
      });
    }

    setTimeout(() => {
      if (currentIdx + 1 < questions.length) {
        setCurrentIdx(i => i + 1);
        setSelectedOption(null);
        setShowAnswer(false);
        setTimeLeft(10);
      } else {
        // End of local quiz
        sessionStorage.setItem('finalScore', newScore);
        setWaitingForConclude(true); 

        // Tell server we are finished
        if (roomData?.roomId) {
          socket.emit('complete_battle', { 
            roomId: roomData.roomId, 
            score: newScore,
            stats: { username: sessionStorage.getItem('username'), answered: questions.length }
          });
        }
      }
    }, 2000);
  }, [currentIdx, questions, roomData, score, timeLeft, waitingForConclude]);


  // Effect 1: Join the room on mount (always)
  useEffect(() => {
    if (!roomData) {
      navigate('/');
      return;
    }
    socket.emit('join_room', { 
      roomId: roomData.roomId, 
      username: sessionStorage.getItem('username'), 
      topic: roomData.topic,
      players: roomData.players
    });
  }, [navigate, roomData]);

  // Effect 2: Countdown timer to show quiz at the right moment
  useEffect(() => {
    if (!questions || questions.length === 0) return;
    const startAt = parseInt(sessionStorage.getItem('quizStartAt') || '0', 10);
    const delay = startAt - Date.now();
    if (delay > 0) {
      const timer = setTimeout(() => {
        setLoading(false);
        setSyncCountdown(null);
      }, delay);
      return () => clearTimeout(timer);
    } else {
      setTimeout(() => {
        setLoading(false);
        setSyncCountdown(null);
      }, 0);
    }
  }, [questions]);

  // Effect 3: Socket listeners — ALWAYS registered, never blocked by early returns
  useEffect(() => {
    const handleOpponentUpdate = ({ score: opScore, answered }) => {
      setOpponentStats({ score: opScore, answered });
      sessionStorage.setItem('opponentStats', JSON.stringify({ score: opScore, answered }));
    };

    const handleBattleConcluded = (data) => {
      isConcluded.current = true;
      if (data?.results) {
        sessionStorage.setItem('battleResults', JSON.stringify(data.results));
      }
      navigate('/result');
    };

    const handleOpponentAbandoned = () => {
       setOpponentAbandoned(true);
    };

    socket.on('opponent_update', handleOpponentUpdate);
    socket.on('battle_concluded', handleBattleConcluded);
    socket.on('opponent_abandoned', handleOpponentAbandoned);

    return () => {
      socket.off('opponent_update', handleOpponentUpdate);
      socket.off('battle_concluded', handleBattleConcluded);
      socket.off('opponent_abandoned', handleOpponentAbandoned);
      
      // Cleanup: If the user hits "Back" button avoiding natural conclusion
      if (!isConcluded.current && roomData?.roomId) {
         socket.emit('abandon_battle', { roomId: roomData.roomId });
      }
    };
  }, [navigate, roomData]);


  useEffect(() => {
    if (loading || showAnswer || currentIdx >= questions.length || waitingForConclude) return;

    const timer = setInterval(() => {
      setTimeLeft(t => {
        if (t <= 1) {
          clearInterval(timer);
          handleAnswer(null);
          return 0;
        }
        return t - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [loading, showAnswer, currentIdx, questions, waitingForConclude, handleAnswer]);


  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center animate-slide-up h-[60vh]">
        <BrainCircuit size={64} strokeWidth={1} className={`text-primary mb-8 opacity-80 ${syncCountdown ? '' : 'animate-pulse'}`} />
        <h2 className="font-serif text-3xl font-bold text-on-surface mb-4">
          {syncCountdown ? `Trial Commencing in ${syncCountdown}...` : 'Consulting the Grand Archives...'}
        </h2>
        <p className="font-body text-on-surface-variant text-lg italic flex items-center gap-3">
          {syncCountdown ? 'Steady your mind; the arena awaits.' : 'Synthesizing trial bounds from deliberation'}
          {!syncCountdown && <Loader2 size={18} className="animate-spin text-primary" />}
        </p>
      </div>
    );
  }

  // Guard: no questions loaded (e.g. backend error)
  if (!questions || questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center animate-slide-up h-[60vh] gap-6">
        <BrainCircuit size={64} strokeWidth={1} className="text-error-container opacity-80" />
        <h2 className="font-serif text-3xl font-bold text-on-surface">The Archives Are Silent</h2>
        <p className="font-body text-on-surface-variant text-lg italic">Failed to load quiz questions. Please try again.</p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 px-8 py-3 border border-primary text-primary font-serif hover:bg-primary/10 transition-colors rounded-sm"
        >
          Return to Scriptorium
        </button>
      </div>
    );
  }

  const question = questions[currentIdx];

  return (
    <div className={`w-full max-w-3xl glass-panel border border-outline-variant/30 p-10 animate-slide-up scholar-shadow relative ${waitingForConclude ? 'opacity-60 pointer-events-none' : ''}`}>
      
      {/* Waiting Overlay */}
      {waitingForConclude && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-surface/60 backdrop-blur-sm">
          <div className="bg-surface-container border border-primary/50 p-8 rounded-sm shadow-2xl text-center max-w-sm">
             {opponentAbandoned ? (
                <>
                  <UserX size={48} className="text-secondary mx-auto mb-6" />
                  <h3 className="font-serif text-2xl font-bold text-on-surface mb-2">Opponent Fled</h3>
                  <p className="font-body text-on-surface-variant italic mb-6">You win by default. The system is finalizing your victory...</p>
                </>
             ) : (
                <>
                  <Loader2 size={48} className="animate-spin text-primary mx-auto mb-6" />
                  <h3 className="font-serif text-2xl font-bold text-on-surface mb-2">Finalizing Archives</h3>
                  <p className="font-body text-on-surface-variant italic">Waiting for your rival to finish their trial...</p>
                </>
             )}
             <div className="mt-6 flex justify-center gap-4 border-t border-outline-variant/30 pt-4">
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-tighter text-outline mb-1">Your Score</div>
                  <div className="font-serif text-xl font-bold text-primary">{score}</div>
                </div>
                <div className="w-[1px] bg-outline-variant/30" />
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-tighter text-outline mb-1">Opponent Score</div>
                  <div className="font-serif text-xl font-bold text-outline">{opponentStats.score}</div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Decorative Top Border */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary-container to-transparent opacity-40"></div>


      {/* Header */}
      <div className="flex justify-between items-end mb-10 pb-6 border-b border-outline-variant/30">
        <div>
          <div className="font-sans text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">
            Trial Progress
          </div>
          <div className="font-serif font-bold text-on-surface tracking-wide">
            TEST {currentIdx + 1} OF {questions.length}
          </div>
        </div>

        {/* Competitor Status */}
        <div className="flex gap-8">
           <div className="text-right">
            <div className="font-sans text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">
              {opponentStats.answered >= 5 ? 'Final Rank' : 'Opponent Score'}
            </div>
            <div className="font-serif text-2xl font-bold text-outline tracking-wider">{opponentStats.score}</div>
          </div>
          <div className="text-right">
            <div className="font-sans text-[10px] uppercase tracking-widest text-on-surface-variant mb-1">
              Your Prestige
            </div>
            <div className="font-serif text-3xl font-bold text-primary tracking-wider">{score}</div>
          </div>
        </div>
      </div>



      {/* Progress & Timer (Scholar's Scroll) */}
      <div className="relative w-full h-1 bg-surface-container-highest mb-12 shadow-inner">
        <div 
          className="absolute inset-y-0 left-0 bg-primary transition-all duration-1000 ease-linear shadow-[0_0_8px_#d4af37]"
          style={{ width: `${(timeLeft / 10) * 100}%` }}
        />
      </div>

      {(() => {
        let metadata = null;
        let displayQuestion = question.question || '';
        
        // Extract metadata if formatted like "[Easy] Mathematics (Functions): Question text"
        const metaMatch = displayQuestion.match(/^\[(.*?)\](.*?):\s*(.*)$/);
        if (metaMatch) {
          metadata = `${metaMatch[1]} • ${metaMatch[2].trim()}`;
          displayQuestion = metaMatch[3];
        }
        
        // Clean trailing "(Question X)" if present as it is redundant
        displayQuestion = displayQuestion.replace(/\s*\(Question\s*\d+\)\s*$/i, '');

        return (
          <div className="mb-12">
            {metadata && (
              <div className="font-sans text-xs font-bold uppercase tracking-widest text-primary mb-3 opacity-90 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                {metadata}
              </div>
            )}
            <h2 className="font-serif text-3xl font-medium leading-relaxed text-on-surface tracking-[-0.01em]">
              {displayQuestion}
            </h2>
          </div>
        );
      })()}

      {/* Options */}
      <div className="space-y-4">
        {question.options.map((opt, i) => {
          let stateClass = "bg-surface-container-low border-outline-variant/30 hover:bg-surface-container-high hover:border-primary/50 text-on-surface";
          let Icon = null;

          if (showAnswer) {
            const isCorrect = opt === question.correctAnswer;
            const isSelected = opt === selectedOption;

            if (isCorrect) {
              stateClass = "bg-primary/10 border-primary text-primary-fixed shadow-[0_0_15px_rgba(212,175,55,0.1)]";
              Icon = CheckCircle2;
            } else if (isSelected && !isCorrect) {
              stateClass = "bg-error-container/10 border-error-container text-on-error-container opacity-90";
              Icon = XCircle;
            } else {
              stateClass = "opacity-40 border-outline-variant/20 bg-surface-container";
            }
          }

          return (
            <button
              key={i}
              disabled={showAnswer}
              onClick={() => handleAnswer(opt)}
              className={`w-full text-left p-5 rounded-sm border transition-all duration-300 flex justify-between items-center active:scale-[0.99] font-body text-lg ${stateClass}`}
            >
              <span>{opt}</span>
              {Icon && <Icon size={22} className={opt === question.correctAnswer ? "text-primary" : "text-error-container"} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

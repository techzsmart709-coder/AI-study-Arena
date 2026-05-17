import { useEffect, useState, useRef } from 'react';
import { useNavigate, useBlocker } from 'react-router-dom';
import { Send, Clock, Users, PlayCircle } from 'lucide-react';
import { socket } from '../socket';

export default function StudyRoom() {
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);

  const [roomData] = useState(() => JSON.parse(sessionStorage.getItem('roomData') || 'null'));
  const [messages, setMessages] = useState(() => {
    const d = JSON.parse(sessionStorage.getItem('roomData') || '{}');
    return [
      { sender: 'System', message: `Welcome to the Study Room: ${d.topic}. You have ${d.duration || 30} seconds to discuss and learn before facing ${d.numQuestions || 5} questions!`, timestamp: Date.now(), isSystem: true }
    ];
  });
  const [input, setInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(() => {
    const data = JSON.parse(sessionStorage.getItem('roomData') || 'null');
    return data?.duration || 30;
  });
  const [isBotTyping, setIsBotTyping] = useState(false);

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (nextLocation.pathname === '/battle') return false;
    return currentLocation.pathname !== nextLocation.pathname;
  });

  useEffect(() => {
    if (blocker.state === 'blocked') {
      const wantToQuit = window.confirm("Are you sure you want to quit? This will forfeit the match and terminate the session.");
      if (wantToQuit) {
        if (roomData?.roomId) {
           socket.emit('abandon_battle', { roomId: roomData.roomId });
        }
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker, roomData]);


  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  useEffect(() => {
    if (!roomData) {
      navigate('/');
      return;
    }

    // CRITICAL: Join the socket room so we can send/receive messages
    socket.emit('join_room', { 
      roomId: roomData.roomId, 
      username: sessionStorage.getItem('username'), 
      topic: roomData.topic,
      players: roomData.players // CRITICAL: Pass full list so server knows bot identity
    });

    // START Generation in background during discussion
    socket.emit('start_quiz_gen', { roomId: roomData.roomId });

    socket.on('receive_message', (msg) => {
      setIsBotTyping(false); // Clear typing when message arrives
      setMessages(prev => {
        const newMsgs = [...prev, msg];
        sessionStorage.setItem('chatHistory', JSON.stringify(newMsgs));
        return newMsgs;
      });
      scrollToBottom();
    });

    socket.on('bot_typing', () => {
      setIsBotTyping(true);
      setTimeout(() => setIsBotTyping(false), 3000); // Auto-hide after 3s
    });

    socket.on('quiz_starting', ({ questions, startAt }) => {
      if (questions) {
        sessionStorage.setItem('roomQuestions', JSON.stringify(questions));
      }
      if (startAt) {
        sessionStorage.setItem('quizStartAt', startAt.toString());
      }
      navigate('/battle');
    });

    return () => {
      socket.off('receive_message');
      socket.off('bot_typing');
      socket.off('quiz_starting');
    };

  }, [navigate, roomData]);

  useEffect(() => {
    if (timeLeft <= 0) {
      // Trigger Quiz Phase
      if (roomData) {
        socket.emit('timer_ended', { roomId: roomData.roomId });
      }
      return;
    }
    const timerId = setInterval(() => {
      setTimeLeft(t => t - 1);
    }, 1000);
    return () => clearInterval(timerId);
  }, [timeLeft, roomData]);


  const sendMessage = (e) => {
    e.preventDefault();
    if (!input.trim() || !roomData) return;

    socket.emit('send_message', {
      roomId: roomData.roomId,
      message: input,
      sender: sessionStorage.getItem('username')
    });
    setInput('');
  };

  if (!roomData) return null;

  const currentUsername = sessionStorage.getItem('username');
  const players = roomData.players || [currentUsername, 'Alex_Starlight'];
  const opponent = players.find(p => p !== currentUsername) || 'Alex_Starlight';

  return (
    <div className="w-full max-w-4xl h-[80vh] flex flex-col glass-panel animate-slide-up overflow-hidden border border-outline-variant/30 scholar-shadow">
      
      {/* Header */}
      <div className="flex items-center justify-between p-4 px-6 border-b border-outline-variant/30 bg-surface-container-high/50">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="font-serif text-xl font-bold text-on-surface tracking-wide">Vs. {opponent}</h2>
            <p className="font-sans text-xs text-primary uppercase tracking-widest mt-1">Subject of Focus: {roomData.topic}</p>
          </div>
        </div>
        
        {/* Timer */}
        <div className={`flex flex-col items-center justify-center px-6 py-2 rounded-sm border ${timeLeft <= 10 ? 'text-error-container border-error-container/50 bg-error-container/10 animate-pulse' : 'text-primary border-primary/30 bg-primary/5'}`}>
          <span className="font-sans text-[10px] uppercase tracking-widest opacity-80 mb-1">Time Remaining</span>
          <div className="flex items-center gap-2 font-serif text-2xl font-bold">
            <Clock size={20} className="opacity-80" />
            {timeLeft}s
          </div>
        </div>
      </div>

      {/* Guide Banner */}
      <div className="bg-surface-container-lowest border-b border-outline-variant/30 px-6 py-4">
        <p className="font-serif text-primary font-medium mb-2 text-lg italic border-b border-outline-variant/20 inline-block pb-1">
          Deliberation Protocol
        </p>
        <p className="font-body text-on-surface-variant text-sm mt-2 leading-relaxed max-w-2xl">
          Confer and build context before the trial. The archives are watching. Establish your mastery of <span className="text-on-surface font-semibold">{roomData.topic}</span>. The trial begins when the glass empties.
        </p>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-surface">
        {messages.map((msg, idx) => {
          const isMe = msg.sender === sessionStorage.getItem('username');
          const isSystem = msg.isSystem;

          if (isSystem) {
            return (
              <div key={idx} className="flex justify-center my-6">
                <span className="font-sans text-[10px] text-on-surface-variant bg-surface-container px-4 py-2 border border-outline-variant/20 uppercase tracking-widest rounded-sm">
                  {msg.message}
                </span>
              </div>
            )
          }

          return (
            <div key={idx} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] px-5 py-4 font-body text-base leading-relaxed ${
                isMe 
                ? 'bg-surface-container-highest text-on-surface border-l-2 border-primary' 
                : 'bg-surface-container-low text-on-surface border-r-2 border-outline-variant/50'
              }`}>
                {!isMe && <div className="font-serif text-sm text-primary mb-2 italic">{msg.sender}</div>}
                <p>{msg.message}</p>
              </div>
            </div>
          )
        })}
        {isBotTyping && (
          <div className="flex justify-start">
            <div className="bg-surface-container-low text-on-surface-variant px-5 py-3 italic text-sm animate-pulse border-r-2 border-outline-variant/30 font-body">
              {opponent} is composing a thought...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />

      </div>

      {/* Input Area */}
      <form onSubmit={sendMessage} className="p-4 px-6 bg-surface-container-low border-t border-outline-variant/30 relative">
        <div className="flex gap-4 items-center">
          <input
            type="text"
            className="flex-1 bg-transparent border-b border-outline-variant/50 px-2 py-3 text-on-surface font-body text-lg focus:border-primary focus:ring-0 outline-none transition-colors placeholder:text-surface-container-highest placeholder:italic"
            placeholder="Discuss the domain..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
          <button
            type="submit"
            className="text-primary hover:text-primary-fixed transition-colors p-2"
          >
            <Send size={24} strokeWidth={1.5} />
          </button>
        </div>
      </form>
    </div>
  );
}

import { createContext, useContext, useReducer, useCallback, useEffect } from 'react';

/**
 * GameContext — Centralized game session state with sessionStorage bridge.
 *
 * Replaces scattered sessionStorage.get/set calls across all game pages.
 * The bridge pattern ensures backward compatibility: context is the source of truth
 * but also mirrors changes to sessionStorage so existing pages still work
 * during the incremental migration.
 */
const GameContext = createContext(null);

// ── Initial State (hydrated from sessionStorage) ─────────
function getInitialState() {
  return {
    topic: sessionStorage.getItem('topic') || null,
    username: sessionStorage.getItem('username') || null,
    numQuestions: parseInt(sessionStorage.getItem('numQuestions')) || 5,
    roomData: JSON.parse(sessionStorage.getItem('roomData') || 'null'),
    finalScore: parseInt(sessionStorage.getItem('finalScore')) || 0,
    opponentStats: JSON.parse(sessionStorage.getItem('opponentStats') || 'null'),
    matchType: sessionStorage.getItem('matchType') || null,
    chatHistory: [],
    questions: [],
    coachInsight: null,
  };
}

// ── Reducer ──────────────────────────────────────────────
function gameReducer(state, action) {
  switch (action.type) {
    case 'SET_MATCH_CONFIG':
      return { ...state, ...action.payload };
    case 'SET_ROOM_DATA':
      return { ...state, roomData: action.payload };
    case 'SET_SCORE':
      return { ...state, finalScore: action.payload };
    case 'SET_OPPONENT_STATS':
      return { ...state, opponentStats: action.payload };
    case 'SET_QUESTIONS':
      return { ...state, questions: action.payload };
    case 'ADD_CHAT_MESSAGE':
      return { ...state, chatHistory: [...state.chatHistory, action.payload] };
    case 'SET_COACH_INSIGHT':
      return { ...state, coachInsight: action.payload };
    case 'RESET':
      return { ...getInitialState(), username: state.username }; // Preserve username across games
    default:
      return state;
  }
}

// ── Provider ─────────────────────────────────────────────
export function GameProvider({ children }) {
  const [state, dispatch] = useReducer(gameReducer, null, getInitialState);

  // ── SessionStorage Bridge ──────────────────────────────
  // Auto-sync context changes to sessionStorage for backward compat
  useEffect(() => {
    if (state.topic) sessionStorage.setItem('topic', state.topic);
    if (state.username) sessionStorage.setItem('username', state.username);
    if (state.numQuestions) sessionStorage.setItem('numQuestions', String(state.numQuestions));
    if (state.roomData) sessionStorage.setItem('roomData', JSON.stringify(state.roomData));
    if (state.finalScore) sessionStorage.setItem('finalScore', String(state.finalScore));
    if (state.opponentStats) sessionStorage.setItem('opponentStats', JSON.stringify(state.opponentStats));
    if (state.matchType) sessionStorage.setItem('matchType', state.matchType);
  }, [state.topic, state.username, state.numQuestions, state.roomData, state.finalScore, state.opponentStats, state.matchType]);

  // ── Actions ────────────────────────────────────────────
  const setMatchConfig = useCallback((config) => {
    dispatch({ type: 'SET_MATCH_CONFIG', payload: config });
  }, []);

  const setRoomData = useCallback((data) => {
    dispatch({ type: 'SET_ROOM_DATA', payload: data });
  }, []);

  const setScore = useCallback((score) => {
    dispatch({ type: 'SET_SCORE', payload: score });
  }, []);

  const setOpponentStats = useCallback((stats) => {
    dispatch({ type: 'SET_OPPONENT_STATS', payload: stats });
  }, []);

  const setQuestions = useCallback((q) => {
    dispatch({ type: 'SET_QUESTIONS', payload: q });
  }, []);

  const addChatMessage = useCallback((msg) => {
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: msg });
  }, []);

  const setCoachInsight = useCallback((insight) => {
    dispatch({ type: 'SET_COACH_INSIGHT', payload: insight });
  }, []);

  const resetGame = useCallback(() => {
    // Clear game-specific sessionStorage
    ['topic', 'roomData', 'finalScore', 'opponentStats', 'matchType'].forEach(k => sessionStorage.removeItem(k));
    dispatch({ type: 'RESET' });
  }, []);

  return (
    <GameContext.Provider value={{
      // State
      ...state,
      // Actions
      setMatchConfig, setRoomData, setScore,
      setOpponentStats, setQuestions, addChatMessage,
      setCoachInsight, resetGame,
    }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used within <GameProvider>');
  return ctx;
}

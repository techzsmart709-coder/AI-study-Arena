import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import 'dotenv/config';

import quizRouter from './routes/quizRoutes.js';
import leaderboardRouter from './routes/leaderboardRouter.js';
import profileRouter from './routes/profileRouter.js';
import { orchestrator } from './TrialOrchestrator.js';
import { INDIAN_NAMES, FAKE_TOPICS, pick } from './data/constants.js';

import { ChatService } from './services/ChatService.js';
import { BattleService } from './services/BattleService.js';
import { MatchmakingService } from './services/MatchmakingService.js';
import { EloService } from './services/EloService.js';
import { CoachService } from './services/CoachService.js';
import { registerSocketHandlers, socketAuthMiddleware } from './handlers/socketHandlers.js';
import { supabase } from './config/database.js';

// ── Express + Socket.IO Setup ──────────────────────────────
const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json());

// ── REST Routes ────────────────────────────────────────────
app.use('/api/quiz', quizRouter);
app.use('/api/leaderboard', leaderboardRouter);
app.use('/api/profile', profileRouter);

// ── Service Initialization ─────────────────────────────────
const eloService = new EloService(supabase);
const chatService = new ChatService(io);
const coachService = new CoachService();
const battleService = new BattleService(io, orchestrator, chatService, eloService, coachService);
const matchmakingService = new MatchmakingService(io, battleService, eloService);

// ── Live Battles API (needs BattleService) ─────────────────
app.get('/api/battles/live', (req, res) => {
  const live = battleService.getLiveBattle();
  if (live) return res.json(live);
  const p1 = pick(INDIAN_NAMES);
  let p2 = pick(INDIAN_NAMES);
  while (p2 === p1) p2 = pick(INDIAN_NAMES);
  res.json({ topic: pick(FAKE_TOPICS), players: [p1, p2], isReal: false });
});

app.get('/api/battles/active', (req, res) => {
  res.json({ battles: battleService.getActiveBattles() });
});

// ── Socket.IO Auth + Handlers ──────────────────────────────
io.use(socketAuthMiddleware);
registerSocketHandlers(io, { matchmaking: matchmakingService, battle: battleService, chat: chatService, coach: coachService });

// ── Global Error Handler ───────────────────────────────────
app.use((err, req, res, _next) => {
  console.error('[Server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ──────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
httpServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') { console.error(`Port ${PORT} busy. Exiting...`); process.exit(1); }
  else { console.error('[Server] Fatal:', err); process.exit(1); }
});
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));

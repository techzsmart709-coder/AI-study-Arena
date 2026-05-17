import express from 'express';
import { getLeaderboard, saveScore } from '../leaderboardController.js';
import { validateScoreSave } from '../middleware/validation.js';

const router = express.Router();

router.get('/', getLeaderboard);
router.post('/update', validateScoreSave, saveScore);

export default router;

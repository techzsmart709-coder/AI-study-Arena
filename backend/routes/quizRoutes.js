import express from 'express';
import { generateQuiz, suggestTopics } from '../quizController.js';
import { validateQuizGenerate, validateTopicSuggest } from '../middleware/validation.js';

const router = express.Router();

router.post('/generate', validateQuizGenerate, generateQuiz);
router.post('/suggest', validateTopicSuggest, suggestTopics);

export default router;

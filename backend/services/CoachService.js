import { openai, modelName } from '../config/ai.js';

/**
 * CoachService — AI Performance Coach
 * 
 * Generates post-battle micro-lessons based on wrong answers.
 * Identifies weak areas, provides targeted study tips,
 * and tracks accuracy trends for the Adaptive Difficulty Engine.
 */
export class CoachService {
  constructor() {
    // Accuracy tracking for Adaptive Difficulty Engine
    // username → { topic → { correct, total, recentAccuracy[] } }
    this.accuracyLog = new Map();
  }

  /**
   * Generate a coaching insight after a battle.
   * @param {string} topic - The quiz topic
   * @param {Array} wrongAnswers - [{question, userAnswer, correctAnswer}]
   * @param {number} score - Player's score
   * @param {number} totalQuestions - Total questions in the battle
   * @returns {object} Coaching insight with weakArea, lesson, tips, encouragement
   */
  async generateInsight(topic, wrongAnswers, score, totalQuestions) {
    // Perfect score — no coaching needed
    if (!wrongAnswers || wrongAnswers.length === 0) {
      return {
        type: 'perfect',
        weakArea: 'None',
        lesson: 'Flawless performance! You demonstrated mastery of this topic.',
        tips: ['Challenge yourself with a harder related topic', 'Try teaching this material to solidify your knowledge'],
        encouragement: 'You are among the top scholars in this domain. Keep pushing boundaries!',
        difficulty: 'mastered'
      };
    }

    // Generate AI-powered insight
    try {
      const wrongSummary = wrongAnswers
        .slice(0, 5) // Limit to 5 for token efficiency
        .map((q, i) => `${i + 1}. Q: "${q.question}" — Answered: "${q.userAnswer}" — Correct: "${q.correctAnswer}"`)
        .join('\n');

      const prompt = `A student completed a quiz on "${topic}" and got ${totalQuestions - wrongAnswers.length}/${totalQuestions} correct.

Wrong answers:
${wrongSummary}

Generate a SHORT coaching insight (max 120 words) as JSON:
{
  "weakArea": "specific sub-topic they struggled with",
  "lesson": "2-3 sentence micro-lesson explaining the key concept they missed",
  "tips": ["actionable study tip 1", "actionable study tip 2", "actionable study tip 3"],
  "encouragement": "1 sentence of genuine encouragement",
  "difficulty": "needs_review|developing|proficient"
}`;

      const response = await openai.chat.completions.create({
        model: modelName,
        messages: [
          { role: 'system', content: 'You are a concise, friendly study coach. Return ONLY valid JSON. No markdown.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 400
      });

      const insight = JSON.parse(response.choices[0].message.content);
      insight.type = 'coaching';
      return insight;

    } catch (err) {
      console.warn('[Coach] AI insight generation failed:', err.message);
      return this._fallbackInsight(topic, wrongAnswers, totalQuestions);
    }
  }

  /**
   * Track accuracy for the Adaptive Difficulty Engine.
   * Records how well a user performs on specific topics over time.
   */
  trackAccuracy(username, topic, correctCount, totalCount) {
    if (!username || username.includes('_')) return; // Skip bots

    if (!this.accuracyLog.has(username)) {
      this.accuracyLog.set(username, new Map());
    }
    const userLog = this.accuracyLog.get(username);

    if (!userLog.has(topic)) {
      userLog.set(topic, { correct: 0, total: 0, recentAccuracy: [] });
    }
    const topicLog = userLog.get(topic);

    topicLog.correct += correctCount;
    topicLog.total += totalCount;

    // Track last 10 games for trend analysis
    const accuracy = totalCount > 0 ? correctCount / totalCount : 0;
    topicLog.recentAccuracy.push(accuracy);
    if (topicLog.recentAccuracy.length > 10) topicLog.recentAccuracy.shift();

    // Memory management
    if (this.accuracyLog.size > 3000) {
      const oldest = this.accuracyLog.keys().next().value;
      this.accuracyLog.delete(oldest);
    }
  }

  /**
   * Get suggested difficulty for a user on a topic.
   * Used by the Adaptive Difficulty Engine to adjust question selection.
   * 
   * Target: ~65% accuracy (challenging but not discouraging)
   * Returns: 'easy' | 'medium' | 'hard'
   */
  getSuggestedDifficulty(username, topic) {
    if (!this.accuracyLog.has(username)) return 'medium';
    const userLog = this.accuracyLog.get(username);
    if (!userLog.has(topic)) return 'medium';

    const topicLog = userLog.get(topic);
    const recent = topicLog.recentAccuracy;
    if (recent.length < 2) return 'medium';

    // Average recent accuracy
    const avgAccuracy = recent.reduce((a, b) => a + b, 0) / recent.length;

    if (avgAccuracy > 0.85) return 'hard';      // Too easy, ramp up
    if (avgAccuracy < 0.45) return 'easy';       // Struggling, ease down
    return 'medium';                              // Sweet spot
  }

  /**
   * Get accuracy trend for a user on a topic.
   */
  getAccuracyTrend(username, topic) {
    if (!this.accuracyLog.has(username)) return null;
    const userLog = this.accuracyLog.get(username);
    if (!userLog.has(topic)) return null;

    const log = userLog.get(topic);
    const recent = log.recentAccuracy;
    if (recent.length < 3) return 'insufficient_data';

    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    if (avgSecond - avgFirst > 0.1) return 'improving';
    if (avgFirst - avgSecond > 0.1) return 'declining';
    return 'stable';
  }

  /**
   * Fallback when AI is unavailable.
   */
  _fallbackInsight(topic, wrongAnswers, totalCount) {
    const correctCount = totalCount - wrongAnswers.length;
    const accuracy = correctCount / totalCount;

    return {
      type: 'coaching',
      weakArea: topic,
      lesson: `You answered ${correctCount} out of ${totalCount} correctly. Review the incorrect answers above and study the underlying concepts in your textbook or notes.`,
      tips: [
        'Re-read the relevant chapter on this topic',
        'Practice with flashcards for the concepts you missed',
        'Try explaining these answers to someone else'
      ],
      encouragement: accuracy >= 0.6
        ? 'Good foundation! A bit more practice and you\'ll master this.'
        : 'Every wrong answer is a learning opportunity. Keep pushing!',
      difficulty: accuracy >= 0.8 ? 'proficient' : accuracy >= 0.5 ? 'developing' : 'needs_review'
    };
  }
}

import { generateWithAI, getFallbackQuiz, QuestionTree } from './quizController.js';
import { supabase } from './config/database.js';

/**
 * TrialOrchestrator
 * 
 * Manages the "Load" of quiz generation. 
 * Prevents API overload, prioritizes real-user battles, and optimizes costs.
 */
class TrialOrchestrator {
  constructor() {
    this.activeRequests = 0;
    this.MAX_CONCURRENT_API = 3; // Limit simultaneous AI calls to prevent rate hits
    this.requestQueue = [];
  }

  /**
   * getTrialQuestions
   * The single entry point for getting questions.
   * Handles priority, caching, and load management.
   */
  async getTrialQuestions(topic, isBotMatch = false, chatContext = '', numQuestions = 5, playCount = 1) {
    console.log(`[Orchestrator] Request for "${topic}" (isBot: ${isBotMatch}, count: ${numQuestions})`);

    const topicKey = topic.toLowerCase();

    // 1. STRATEGY: MEMORY TREE CACHE FIRST (Fastest, $0 Cost, minimal system load)
    if (QuestionTree[topicKey] && QuestionTree[topicKey].length >= numQuestions) {
      const branch = QuestionTree[topicKey];
      const count = branch.length;
      let maxOffset = Math.max(0, count - numQuestions);
      let offset = (playCount - 1) * numQuestions;
      
      if (playCount >= 3 || offset > maxOffset) {
        offset = Math.floor(Math.random() * (maxOffset + 1));
      }

      console.log(`[Orchestrator] Memory Tree Hit: ${count} nodes under branch "${topic}". Offset: ${offset}`);
      const slice = [...branch].slice(offset, offset + numQuestions);
      return slice.sort(() => 0.5 - Math.random());
    }

    // 1.5. STRATEGY: BUILD TREE BRANCH FROM DB CACHE (Only done once per topic)
    if (supabase) {
      try {
        console.log(`[Orchestrator] Fetching branch for "${topic}" from DB to load into Memory Tree...`);
        const { data, error } = await supabase
          .from('quiz_questions')
          .select('question, options, correctAnswer')
          .ilike('topic', topic);

        if (!error && data && data.length > 0) {
          QuestionTree[topicKey] = data; // Form the branch
          const count = data.length;

          if (count >= numQuestions) {
            let maxOffset = Math.max(0, count - numQuestions);
            let offset = (playCount - 1) * numQuestions;
            
            if (playCount >= 3 || offset > maxOffset) {
              offset = Math.floor(Math.random() * (maxOffset + 1));
            }

            console.log(`[Orchestrator] Constructed Tree Branch for "${topic}" (${count} nodes).`);
            const slice = [...data].slice(offset, offset + numQuestions);
            return slice.sort(() => 0.5 - Math.random());
          }
        }
      } catch (err) {
        console.warn('[Orchestrator] DB Cache error during tree construction:', err.message);
      }
    }

    // 2. STRATEGY: BOT MATCHES -> PREFER FALLBACK ON HIGH LOAD
    // If it's a bot match and we are busy, don't waste API units.
    if (isBotMatch && (this.activeRequests >= this.MAX_CONCURRENT_API)) {
      console.log(`[Orchestrator] High load + Bot match. Using fallback to save costs.`);
      return getFallbackQuiz(topic, numQuestions);
    }

    // 3. STRATEGY: QUEUED AI GENERATION
    return new Promise((resolve) => {
      this.requestQueue.push({ topic, chatContext, isBotMatch, resolve, numQuestions });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.activeRequests >= this.MAX_CONCURRENT_API || this.requestQueue.length === 0) {
      return;
    }

    // Prioritize Real-User matches in the queue
    this.requestQueue.sort((a, b) => (a.isBotMatch === b.isBotMatch ? 0 : a.isBotMatch ? 1 : -1));

    const { topic, chatContext, isBotMatch, resolve, numQuestions } = this.requestQueue.shift();
    this.activeRequests++;

    try {
      console.log(`[Orchestrator] Generating fresh trial for "${topic}" (Current Active: ${this.activeRequests})`);
      const questions = await generateWithAI(topic, chatContext, numQuestions);
      
      // Asynchronously cache new questions if they came from AI
      if (supabase && questions.length > 0) {
        const insertData = questions.map(q => ({
          topic: topic.toLowerCase(),
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer
        }));
        supabase.from('quiz_questions').insert(insertData).then(() => {
          console.log(`[Orchestrator] New trial for "${topic}" cached to database.`);
           // Update in-memory tree branch
           const topicKey = topic.toLowerCase();
           if (!QuestionTree[topicKey]) QuestionTree[topicKey] = [];
           QuestionTree[topicKey].push(...insertData);
        });
      }

      resolve(questions);
    } catch (err) {
      console.error(`[Orchestrator] AI Generation failed for "${topic}":`, err.message);
      resolve(getFallbackQuiz(topic, numQuestions));
    } finally {
      this.activeRequests--;
      this.processQueue(); // Check for next in line
    }
  }
}

export const orchestrator = new TrialOrchestrator();

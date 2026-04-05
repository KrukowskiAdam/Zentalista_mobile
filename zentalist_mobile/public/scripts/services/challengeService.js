// challengeService.js - Service for handling knowledge challenges

import { languageService } from './languageService.js';

class ChallengeService {
  constructor() {
    this.currentChallenge = null;
    this.questions = [];
    this.currentQuestionIndex = 0;
    this.correctAnswers = 0;
    this.PASS_THRESHOLD = 0.9; // >90% required to pass
  }

  /**
   * Generate challenge questions for a category
   * @param {Array} categoryWords - Array of word objects from the category
   * @param {string} categoryName - Name of the category
   * @param {string} source - Source identifier (e.g., 'es_en_01')
   * @returns {Object} Challenge object
   */
  generateChallenge(categoryWords, categoryName, source, language) {
    if (!categoryWords || categoryWords.length < 4) {
      throw new Error('Category must have at least 4 words for a challenge');
    }

    // Shuffle words and create questions
    const shuffledWords = [...categoryWords].sort(() => Math.random() - 0.5);
    const questions = shuffledWords.map((word) => {
      // Get 3 random wrong answers from the same category
      const wrongAnswers = this._getRandomWrongAnswers(
        word,
        categoryWords,
        3,
        language
      );

      const { foreignText, romanization } = this._getForeignDisplay(
        word,
        language
      );

      // Combine correct and wrong answers, then shuffle
      const allAnswers = [word.en, ...wrongAnswers].sort(
        () => Math.random() - 0.5
      );

      return {
        foreign: foreignText,
        romanization,
        correctAnswer: word.en,
        answers: allAnswers,
        word: word, // Store full word object for reference
      };
    });

    this.currentChallenge = {
      categoryName,
      source,
      language: language || languageService.getCurrentLanguage(),
      questions,
      totalQuestions: questions.length,
      startTime: Date.now(),
    };

    this.questions = questions;
    this.currentQuestionIndex = 0;
    this.correctAnswers = 0;

    return this.currentChallenge;
  }

  /**
   * Get random wrong answers from the same category
   * @param {Object} correctWord - The correct word object
   * @param {Array} allWords - All words in the category
   * @param {number} count - Number of wrong answers needed
   * @param {string} language - Current language code
   * @returns {Array} Array of wrong answer strings
   */
  _getRandomWrongAnswers(correctWord, allWords, count, language) {
    // Get the foreign text of the correct word to filter out duplicates
    const correctForeignText = this._getForeignTextForWord(correctWord, language);
    
    const wrongAnswers = allWords
      .filter((w) => {
        // Filter out words with same English OR same foreign text
        if (w.en === correctWord.en) return false;
        const wForeignText = this._getForeignTextForWord(w, language);
        if (wForeignText === correctForeignText) return false;
        return true;
      })
      .map((w) => w.en)
      .sort(() => Math.random() - 0.5)
      .slice(0, count);

    // If not enough unique words, fill with duplicates (shouldn't happen with proper data)
    while (wrongAnswers.length < count) {
      wrongAnswers.push(
        allWords[Math.floor(Math.random() * allWords.length)].en
      );
    }

    return wrongAnswers;
  }

  /**
   * Get foreign text for a word based on language
   * @param {Object} word - Word object
   * @param {string} language - Language code
   * @returns {string} Foreign text
   */
  _getForeignTextForWord(word, language) {
    const lang = language || languageService.getCurrentLanguage();
    switch (lang) {
      case 'es': return word.es || '';
      case 'de': return word.de || '';
      case 'fr': return word.fr || '';
      case 'ru': return word.ru || '';
      case 'zh': return word.zh || '';
      case 'ja': return word.ja || '';
      case 'ko': return word.ko || '';
      case 'it': return word.it || '';
      default: return word.en || '';
    }
  }

  _getForeignDisplay(word, languageOverride) {
    const currentLang =
      languageOverride || languageService.getCurrentLanguage();
    let foreignText = "";
    let romanization = "";

    if (currentLang === "es") {
      foreignText = word.es || "";
    } else if (currentLang === "de") {
      foreignText = word.de || "";
    } else if (currentLang === "fr") {
      foreignText = word.fr || "";
    } else if (currentLang === "ru") {
      foreignText = word.ru || "";
    } else if (currentLang === "zh") {
      foreignText = word.zh || "";
      romanization = word.pinyin || "";
    } else if (currentLang === "ja") {
      foreignText = word.ja || "";
      romanization = word.romaji || "";
    } else if (currentLang === "ko") {
      foreignText = word.ko || "";
      romanization = word.romaja || "";
    } else if (currentLang === "it") {
      foreignText = word.it || "";
    }

    if (!foreignText) {
      foreignText = word.en || "";
    }

    return { foreignText, romanization };
  }

  /**
   * Get current question
   * @returns {Object|null} Current question object or null if challenge complete
   */
  getCurrentQuestion() {
    if (
      !this.currentChallenge ||
      this.currentQuestionIndex >= this.questions.length
    ) {
      return null;
    }
    return this.questions[this.currentQuestionIndex];
  }

  /**
   * Submit answer and move to next question
   * @param {string} selectedAnswer - The answer selected by the user
   * @returns {Object} Result object with isCorrect, nextQuestion, and challengeComplete flags
   */
  submitAnswer(selectedAnswer) {
    const currentQuestion = this.getCurrentQuestion();
    if (!currentQuestion) {
      return {
        isCorrect: false,
        nextQuestion: null,
        challengeComplete: true,
      };
    }

    const isCorrect = selectedAnswer === currentQuestion.correctAnswer;
    if (isCorrect) {
      this.correctAnswers++;
    }

    this.currentQuestionIndex++;
    const challengeComplete = this.currentQuestionIndex >= this.questions.length;
    const nextQuestion = challengeComplete ? null : this.getCurrentQuestion();

    return {
      isCorrect,
      correctAnswer: currentQuestion.correctAnswer,
      nextQuestion,
      challengeComplete,
      progress: {
        current: this.currentQuestionIndex,
        total: this.questions.length,
        correct: this.correctAnswers,
      },
    };
  }

  /**
   * Get challenge results
   * @returns {Object} Results object with score, passed status, and stats
   */
  getResults() {
    if (!this.currentChallenge) {
      return null;
    }

    const score = this.correctAnswers / this.questions.length;
    const passed = score >= this.PASS_THRESHOLD;
    const timeSpent = Date.now() - this.currentChallenge.startTime;
    const perfectScore = this.correctAnswers === this.questions.length;
    const scorePercent = Math.round(score * 100);

    // Get previous best score to calculate bonus points correctly
    const currentLang = this.currentChallenge.language ||
      localStorage.getItem('selectedLanguage') || 'es';
    const completionKey = `${this.currentChallenge.source}::${this.currentChallenge.categoryName}`;
    const storageKey = `categoryCompletionDates_${currentLang}`;
    
    let previousBestScore = 0;
    let previousBonusPoints = 0;
    let previousPointsAwarded = false;
    try {
      const existing = JSON.parse(localStorage.getItem(storageKey) || '{}');
      if (existing[completionKey]) {
        previousBestScore = existing[completionKey].bestScore || existing[completionKey].score || 0;
        previousBonusPoints = existing[completionKey].totalBonusPoints || existing[completionKey].bonusPoints || 0;
        previousPointsAwarded = Boolean(existing[completionKey].pointsAwarded || previousBonusPoints > 0);
      }
    } catch (e) {
      console.error('Error reading previous challenge data', e);
    }

    // One-time reward logic:
    // - First success (>=90%): award 50 points if 100%, else 20 points
    // - After any success, subsequent attempts give 0 points
    const isFirstAttempt = previousBestScore === 0;
    let bonusPoints = 0;
    if (passed && !previousPointsAwarded) {
      bonusPoints = perfectScore ? 50 : 20;
    }
    const isImprovement = scorePercent > previousBestScore;
    const pointsAwarded = previousPointsAwarded || bonusPoints > 0;

    return {
      categoryName: this.currentChallenge.categoryName,
      source: this.currentChallenge.source,
      language: this.currentChallenge.language,
      totalQuestions: this.questions.length,
      correctAnswers: this.correctAnswers,
      wrongAnswers: this.questions.length - this.correctAnswers,
      score: scorePercent,
      passed,
      perfectScore,
      timeSpent: Math.round(timeSpent / 1000), // in seconds
      bonusPoints,
      previousBestScore,
      isImprovement,
      isFirstAttempt,
      totalBonusPoints: previousBonusPoints + bonusPoints,
      pointsAwarded,
    };
  }

  /**
   * Reset challenge state
   */
  resetChallenge() {
    this.currentChallenge = null;
    this.questions = [];
    this.currentQuestionIndex = 0;
    this.correctAnswers = 0;
  }

  /**
   * Get progress info
   * @returns {Object} Progress object
   */
  getProgress() {
    if (!this.currentChallenge) {
      return { current: 0, total: 0, percentage: 0 };
    }

    return {
      current: this.currentQuestionIndex,
      total: this.questions.length,
      percentage: Math.round(
        (this.currentQuestionIndex / this.questions.length) * 100
      ),
    };
  }

  /**
   * Save challenge completion to state
   * @param {Object} results - Challenge results
   */
  saveChallengeCompletion(results) {
    if (!results.passed) return;

    const currentLang = results.language ||
      localStorage.getItem('selectedLanguage') ||
      'es';
    const completionKey = `${results.source}::${results.categoryName}`;
    const storageKey = `categoryCompletionDates_${currentLang}`;
    
    // Get existing data
    const existing = JSON.parse(localStorage.getItem(storageKey) || '{}');
    const previousData = existing[completionKey] || {};
    const previousBestScore = previousData.bestScore || previousData.score || 0;
    const previousTotalBonus = previousData.totalBonusPoints || previousData.bonusPoints || 0;
    const previousPointsAwarded = Boolean(previousData.pointsAwarded || previousTotalBonus > 0);

    // Award points only once on the first successful pass
    if (results.bonusPoints > 0) {
      const currentPoints = parseInt(localStorage.getItem('totalPoints') || '0');
      localStorage.setItem('totalPoints', (currentPoints + results.bonusPoints).toString());
    }

    // Update challenge data - keep track of best score
    existing[completionKey] = {
      completedAt: new Date().toISOString(),
      firstCompletedAt: previousData.firstCompletedAt || new Date().toISOString(),
      score: results.score,
      bestScore: Math.max(results.score, previousBestScore),
      bonusPoints: results.bonusPoints,
      totalBonusPoints: previousTotalBonus + results.bonusPoints,
      pointsAwarded: previousPointsAwarded || results.bonusPoints > 0,
      attempts: (previousData.attempts || 0) + 1,
      perfectScore: results.perfectScore,
    };
    localStorage.setItem(storageKey, JSON.stringify(existing));

    // CRITICAL: Force sync to cloud after challenge completion
    if (window.syncService) {
      window.syncService.forceSyncNow();
      if (typeof window.syncService.updateLeaderboard === 'function') {
        window.syncService.updateLeaderboard();
      }
    }

    const message = results.perfectScore 
      ? (results.bonusPoints > 0
          ? `Perfect score! +${results.bonusPoints} points.`
          : `Perfect score! No more points available for this category.`)
      : results.bonusPoints > 0 
        ? `✅ Challenge passed! +${results.bonusPoints} points.`
        : `✅ Challenge passed! Play again for practice (no more points).`;
    
  }

  /**
   * Reset button states for a category so user must complete it again
   * @private
   */
  _resetCategoryButtonStates(source, categoryName, language) {
    try {
      const buttonStatesKey = `buttonStates_${language}`;
      const buttonStates = JSON.parse(localStorage.getItem(buttonStatesKey) || '{}');

      Object.entries(buttonStates).forEach(([key, state]) => {
        if (state?.source === source && state?.category === categoryName) {
          state.locked = false;
          state.count = 0;
          state.clicks = [];
          state.lastClicked = null;
          state.wasReset = true;
          state.resetTime = Date.now();
        }
      });

      localStorage.setItem(buttonStatesKey, JSON.stringify(buttonStates));
    } catch (error) {
      console.error('Error resetting category button states:', error);
    }
  }
}

// Create singleton instance
const challengeService = new ChallengeService();

// Export for ES6 modules
export { challengeService };

// Also make available globally for EJS templates
if (typeof window !== 'undefined') {
  window.challengeService = challengeService;
}

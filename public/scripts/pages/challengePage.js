// challengePage.js - Challenge page controller

import { auth } from '../auth.js';
import { challengeService } from '../services/challengeService.js';
import { dataService } from '../services/dataService.js';
import { stateService } from '../services/stateService.js';
import { languageService } from '../services/languageService.js';

let authStateResolved = false;
const languageCategoryCache = new Map();
const languageButtonStateCache = new Map();
let multiLanguageCategories = [];
const CHALLENGE_SESSION_KEY = 'activeChallengeSession';

const SOURCE_MAIN_CATEGORY_TITLES = {
  free: 'Greetings & Introductions',
  premium1: 'Numbers & Time',
  premium2: 'Food & Dining',
  premium3: 'Travel & Tourism',
  premium4: 'Daily Life & Shopping',
  premium5: 'Family & Relationships',
  premium6: 'Health & Body',
  premium7: 'Education & Work',
  premium8: 'Hobbies & Interests'
};

function setChallengePageStatus(message, tone = 'info') {
  const statusEl = document.getElementById('challenge-page-status');
  if (!statusEl) return;

  const toneClass =
    tone === 'error'
      ? 'border-red-500/30 bg-red-500/10 text-red-300'
      : tone === 'success'
      ? 'border-green-500/30 bg-green-500/10 text-green-300'
      : 'border-dark-border bg-dark-card/40 text-gray-200';

  statusEl.className = `mb-4 rounded-lg border px-4 py-3 text-sm ${toneClass}`;
  statusEl.textContent = message;
  statusEl.classList.remove('hidden');
}

function clearChallengePageStatus() {
  const statusEl = document.getElementById('challenge-page-status');
  statusEl?.classList.add('hidden');
}

/**
 * Initialize Challenge Page
 */
export async function initChallengePageNew() {
  console.log('🎯 Initializing Challenge Page');
  challengeService.resetChallenge();
  const hadInterruptedChallenge = recoverInterruptedChallenge();
  setChallengePageStatus('Loading challenge categories...', 'info');

  // Ensure local progress state is loaded (not auto-run outside /learn)
  if (typeof stateService.init === 'function') {
    stateService.init();
  } else if (typeof stateService.loadButtonStates === 'function') {
    stateService.loadButtonStates();
  }

  // Ensure data is loaded
  try {
    if (!dataService.categories || dataService.categories.length === 0) {
      await dataService.fetchAllCards();
    }
  } catch (error) {
    console.error('❌ Failed to load challenge data', error);
    setChallengePageStatus('Could not load challenge data. Please refresh and try again.', 'error');
    const container = document.getElementById('categories-list');
    if (container) {
      container.innerHTML = `
        <div class="text-center py-8 border border-red-500/30 bg-red-500/10 text-red-300 rounded-lg">
          Challenge categories are unavailable right now.
        </div>
      `;
    }
    return;
  }

  // Get current language (dataService already returns data for the chosen language)
  const currentLang = languageService.getCurrentLanguage();
  let allCategories = [];
  try {
    allCategories = await loadAllLanguageCategories();
  } catch (error) {
    console.error('❌ Failed to load language challenge categories', error);
    setChallengePageStatus('Could not sync challenge categories for selected language.', 'error');
    return;
  }
  multiLanguageCategories = allCategories;

  console.log(
    `📚 Loaded ${allCategories.length} categories across ${languageCategoryCache.size} languages (current: ${currentLang})`
  );

  // Render category selection view
  renderCategorySelection(allCategories);
  if (hadInterruptedChallenge) {
    setChallengePageStatus('Previous challenge was interrupted. Start again when ready.', 'info');
  } else {
    clearChallengePageStatus();
  }
  toggleLoginAlert();

  // Setup event listeners
  setupEventListeners();

  // Auto start a challenge if user arrived from /learn celebration
  maybeStartPendingChallenge();

  // Fallback timeout - if auth doesn't resolve in 3 seconds, assume logged out
  setTimeout(() => {
    if (!authStateResolved) {
      console.log('⏱️ Auth timeout - assuming logged out');
      authStateResolved = true;
      toggleLoginAlert();
      renderCategorySelection(multiLanguageCategories);
    }
  }, 3000);

  window.addEventListener('authStateChanged', () => {
    authStateResolved = true;
    toggleLoginAlert();
    // Don't re-render yet - wait for cloud sync
  });
  
  // Listen for cloud sync complete to get fresh data
  window.addEventListener('cloudSyncComplete', () => {
    console.log('☁️ Challenge page: Cloud sync complete, refreshing button states');
    languageButtonStateCache.clear(); // Clear cache to force reload from localStorage
    if (isQuizActive()) {
      return;
    }
    renderCategorySelection(multiLanguageCategories);
  });

  // If auth already resolved before listener registration, update immediately
  // Check for null explicitly - null means logged out, undefined means not yet resolved
  if (window.currentUser !== undefined || auth.currentUser) {
    authStateResolved = true;
    toggleLoginAlert();
    // Re-render to update button states now that auth is resolved
    renderCategorySelection(multiLanguageCategories);
  }
}

/**
 * Load categories (and words) for every available language
 */
async function loadAllLanguageCategories() {
  const languages = languageService.getAllLanguages();
  const currentLang = languageService.getCurrentLanguage();
  languageCategoryCache.clear();
  languageButtonStateCache.clear();

  const results = await Promise.all(
    languages.map(async (lang) => {
      try {
        if (lang.code === currentLang && dataService.categories?.length) {
          const categoriesClone = (dataService.categories || []).map((category) => ({
            ...category,
            language: category.language || lang.code,
          }));
          const wordsClone = (dataService.allWords || []).map((word) => ({
            ...word,
            language: word.language || lang.code,
          }));
          languageCategoryCache.set(lang.code, {
            categories: categoriesClone,
            allWords: wordsClone,
          });
          return categoriesClone;
        }

        const bundle = await dataService.fetchLanguageBundle(lang.code);
        languageCategoryCache.set(lang.code, bundle);
        return bundle.categories || [];
      } catch (error) {
        console.error(`❌ Failed to load categories for ${lang.code}`, error);
        languageCategoryCache.set(lang.code, { categories: [], allWords: [] });
        return [];
      }
    })
  );

  return results.flat();
}

/**
 * Render category selection view
 */
function renderCategorySelection(categories) {
  const container = document.getElementById('categories-list');
  if (!container) return;

  container.innerHTML = '';

  const languages = languageService.getAllLanguages();
  let readyCategoriesCount = 0;
  let pendingRetryCount = 0;

  languages.forEach((lang) => {
    const categoriesForLanguage = categories.filter(
      (category) => category.language === lang.code
    );

    if (categoriesForLanguage.length === 0) {
      return;
    }

    const groupedBySource = {};
    const pendingRetryBySource = {};

    categoriesForLanguage.forEach((cat) => {
      const source = cat.source || 'free';
      const status = getCategoryStatus(cat, source, lang.code);
      
      if (status.canStartChallenge) {
        // Ready to challenge now
        readyCategoriesCount++;
        if (!groupedBySource[source]) {
          groupedBySource[source] = [];
        }
        groupedBySource[source].push({ category: cat, status });
      } else if (status.bestChallengeScore > 0 && !status.isCurrentlyComplete) {
        // Has previous challenge but category not complete yet (needs review first)
        pendingRetryCount++;
        if (!pendingRetryBySource[source]) {
          pendingRetryBySource[source] = [];
        }
        pendingRetryBySource[source].push({ category: cat, status });
      }
    });

    const hasContent = Object.keys(groupedBySource).length > 0 || Object.keys(pendingRetryBySource).length > 0;
    if (!hasContent) {
      return;
    }

    const languageSection = document.createElement('div');
    languageSection.className = 'mb-8';
    languageSection.innerHTML = renderLanguageHeader(lang);
    const contentContainer = languageSection.querySelector('.language-section-content');

    // Ready challenges
    Object.keys(groupedBySource).forEach((source) => {
      const sourceCategories = groupedBySource[source];
      const cardsHtml = sourceCategories
        .map(({ category, status }) =>
          renderCategoryCard(category, source, lang.code, status)
        )
        .join('');
      const wrapper = document.createElement('div');
      wrapper.className = 'space-y-2';
      wrapper.innerHTML = cardsHtml;
      contentContainer.appendChild(wrapper);
    });

    // Pending retry challenges (need to complete category first)
    if (Object.keys(pendingRetryBySource).length > 0) {
      const pendingHeader = document.createElement('div');
      pendingHeader.className = 'mt-4 mb-2';
      pendingHeader.innerHTML = `
        <p class="text-xs uppercase tracking-wide text-gray-500">Complete category to retry</p>
      `;
      contentContainer.appendChild(pendingHeader);
      
      Object.keys(pendingRetryBySource).forEach((source) => {
        const sourceCategories = pendingRetryBySource[source];
        const cardsHtml = sourceCategories
          .map(({ category, status }) =>
            renderPendingRetryCard(category, source, lang.code, status)
          )
          .join('');
        const wrapper = document.createElement('div');
        wrapper.className = 'space-y-2';
        wrapper.innerHTML = cardsHtml;
        contentContainer.appendChild(wrapper);
      });
    }

    container.appendChild(languageSection);
  });

  if (readyCategoriesCount === 0 && pendingRetryCount === 0) {
    setChallengePageStatus('No challenge is ready yet. Complete a category in Learn first.', 'info');
    container.innerHTML = `
      <div class="text-center py-8 text-gray-400 border border-dashed border-dark-border rounded-lg">
        Complete a category in any language to unlock a challenge. Once every word is mastered, it will appear here automatically.
      </div>
    `;
    return;
  }

  clearChallengePageStatus();

  // Setup category click handlers
  setupCategoryClickHandlers();
}

/**
 * Render pending retry card (category needs to be completed first)
 */
function renderPendingRetryCard(category, source, language, status) {
  const categoryName = category.name;
  const { totalWords, completedWords, bestChallengeScore } = status;
  const mainCategoryTitle = getMainCategoryTitle(source);
  const progressPercent = totalWords > 0 ? Math.round((completedWords / totalWords) * 100) : 0;

  return `
    <div class="challenge-category-card bg-dark-card/50 border border-dark-border/50 rounded-lg p-4 opacity-75">
      <div class="challenge-card-layout flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="challenge-card-info flex-1 w-full">
          <p class="text-xs uppercase tracking-wide text-gray-500 mb-1">${mainCategoryTitle}</p>
          <h4 class="font-semibold text-gray-400">${categoryName}</h4>
          <div class="flex items-center gap-2 mt-1">
            <div class="w-20 bg-dark-bg rounded-full h-1.5">
              <div class="bg-blue-500 h-1.5 rounded-full" style="width: ${progressPercent}%"></div>
            </div>
            <span class="text-xs text-gray-500">${progressPercent}%</span>
          </div>
        </div>
        <div class="challenge-card-actions flex w-full sm:w-auto items-center gap-3">
          <span class="badge badge-ghost badge-sm">Best: ${bestChallengeScore}%</span>
          <a href="/learn?source=${source}&category=${encodeURIComponent(categoryName)}&lang=${language}" 
             class="touch-target inline-flex w-full sm:w-auto items-center justify-center rounded-lg bg-dark-border text-gray-300 px-4 py-2 text-sm font-medium transition-colors hover:bg-dark-card">
            Continue
          </a>
        </div>
      </div>
    </div>
  `;
}

function renderLanguageHeader(langDetails) {
  const details = langDetails || {};
  const flag = details.flag || '';
  const name = details.name || details.code?.toUpperCase() || 'Language';
  const nativeName = details.nativeName || '';

  return `
    <div class="flex items-center gap-3 mb-3">
      <span class="inline-flex items-center justify-center w-10 h-10 rounded-full overflow-hidden border border-dark-border bg-dark-bg">
        ${flag}
      </span>
      <div>
        <p class="text-base font-semibold text-gray-100">${name}</p>
        <p class="text-xs uppercase tracking-wide text-gray-500">${nativeName || details.code?.toUpperCase() || ''}</p>
      </div>
    </div>
    <div class="language-section-content space-y-4"></div>
  `;
}

/**
 * Render individual category card
 */
function renderCategoryCard(
  category,
  source,
  language,
  status = getCategoryStatus(category, source, language)
) {
  const categoryName = category.name;
  const { totalWords, canStartChallenge, bestChallengeScore, hasPerfectChallenge } = status;
  const languageCode = language || category.language || languageService.getCurrentLanguage();
  const mainCategoryTitle = getMainCategoryTitle(source);
  const loginState = getLoginState();
  const loggedIn = loginState === 'logged-in';
  const awaitingAuth = loginState === 'unknown';
  const canStartForUser = loggedIn && canStartChallenge;
  const isSuccess = bestChallengeScore >= 90;
  const isRetry = bestChallengeScore > 0 && !hasPerfectChallenge;

  let buttonClass = '';
  if (canStartForUser) {
    if (hasPerfectChallenge) {
      buttonClass = 'inline-flex items-center justify-center rounded-lg bg-level-expert text-white px-4 py-2 text-sm font-semibold transition-colors hover:bg-level-expert-dark';
    } else if (isSuccess) {
      buttonClass = 'inline-flex items-center justify-center rounded-lg bg-blue-600 text-white px-4 py-2 text-sm font-semibold transition-colors hover:bg-blue-700';
    } else {
      buttonClass = 'inline-flex items-center justify-center rounded-lg bg-level-expert text-white px-4 py-2 text-sm font-semibold transition-colors hover:bg-level-expert-dark';
    }
  } else if (awaitingAuth) {
    buttonClass = 'inline-flex items-center justify-center rounded-lg bg-dark-border text-gray-400 px-4 py-2 text-sm font-semibold cursor-wait';
  } else if (loggedIn) {
    buttonClass = 'btn btn-disabled btn-sm';
  } else {
    // Not logged in - show disabled style
    buttonClass = 'inline-flex items-center justify-center rounded-lg bg-dark-border text-gray-500 px-4 py-2 text-sm font-semibold cursor-not-allowed opacity-60';
  }

  let buttonLabel = '';
  if (loggedIn) {
    if (hasPerfectChallenge) {
      buttonLabel = 'Play again';
    } else if (isSuccess) {
      buttonLabel = 'Success 90%+';
    } else if (isRetry) {
      buttonLabel = 'Retry Challenge';
    } else {
      buttonLabel = 'Start Challenge';
    }
  } else if (awaitingAuth) {
    buttonLabel = 'Checking…';
  } else {
    buttonLabel = 'Challenge';
  }

  // Status badge shows different info based on state
  let statusBadge = '';
  if (hasPerfectChallenge) {
    statusBadge = '<span class="badge badge-success badge-sm">Success • 100%</span>';
  } else if (isSuccess) {
    statusBadge = `<span class="badge badge-info badge-sm">Success • ${bestChallengeScore}%</span>`;
  } else if (isRetry) {
    statusBadge = `<span class="badge badge-info badge-sm">Best: ${bestChallengeScore}%</span>`;
  } else {
    statusBadge = `<span class="badge badge-warning badge-sm">Ready • ${totalWords} words</span>`;
  }

  return `
    <div class="challenge-category-card bg-dark-card border border-dark-border rounded-lg p-4 hover:shadow-md transition-shadow">
      <div class="challenge-card-layout flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div class="challenge-card-info flex-1 w-full">
          <p class="text-xs uppercase tracking-wide text-gray-500 mb-1">${mainCategoryTitle}</p>
          <h4 class="font-semibold text-gray-200">${categoryName}</h4>
        </div>
        <div class="challenge-card-actions flex w-full sm:w-auto items-center gap-3">
          ${statusBadge}
          <button 
            class="start-challenge-btn touch-target w-full sm:w-auto ${buttonClass}" 
            data-source="${source}"
            data-category="${categoryName}"
            data-language="${languageCode}"
            data-requires-login="${loggedIn ? 'false' : 'true'}"
            ${canStartForUser ? '' : 'disabled'}
          >
            ${buttonLabel}
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Get count of completed words in a category
 */
function getCompletedWordsCount(category, source, language) {
  if (!category.words) return 0;

  let completed = 0;

  const bundle = languageCategoryCache.get(language);
  const allWords = bundle?.allWords || [];
  const buttonStates = getLanguageButtonStates(language);

  category.words.forEach((word) => {
    const wordInData = allWords.find(
      (w) =>
        w.en === word.en &&
        w.category === category.name &&
        (w.source || 'free') === source
    );

    if (wordInData && wordInData.globalIndex !== undefined) {
      const key = `${wordInData.globalIndex}-${source}`;
      const buttonState = buttonStates[key];

      if (buttonState && buttonState.locked) {
        completed++;
      }
    }
  });

  return completed;
}

function getCategoryStatus(category, source, language) {
  const totalWords = category.words ? category.words.length : 0;
  const languageCode = language || category.language || languageService.getCurrentLanguage();
  const completedWords = getCompletedWordsCount(category, source, languageCode);
  const isCurrentlyComplete = totalWords > 0 && completedWords === totalWords;
  
  // Check challenge history for this category
  const completionKey = `${source}::${category.name}`;
  let wasEverCompleted = false;
  let bestChallengeScore = 0;
  let hasPerfectChallenge = false;
  
  try {
    const completionDates = JSON.parse(
      localStorage.getItem(`categoryCompletionDates_${languageCode}`) || '{}'
    );
    const categoryData = completionDates[completionKey];
    if (categoryData) {
      wasEverCompleted = true;
      bestChallengeScore = categoryData.bestScore || categoryData.score || 0;
      hasPerfectChallenge = bestChallengeScore === 100;
    }
  } catch (e) {
    console.error('Error reading categoryCompletionDates', e);
  }
  
  // Challenge is available if category is currently complete (all words locked)
  // User can retry even after 100% (no extra points will be awarded)
  const canStartChallenge = isCurrentlyComplete;

  return {
    totalWords,
    completedWords,
    isCurrentlyComplete,
    isComplete: isCurrentlyComplete || wasEverCompleted,
    canStartChallenge,
    bestChallengeScore,
    hasPerfectChallenge,
  };
}

function getLanguageButtonStates(language) {
  if (!language) return {};

  if (!languageButtonStateCache.has(language)) {
    try {
      const stored = JSON.parse(
        localStorage.getItem(`buttonStates_${language}`) || '{}'
      );
      languageButtonStateCache.set(language, stored);
    } catch (error) {
      console.error(`Error reading button states for ${language}`, error);
      languageButtonStateCache.set(language, {});
    }
  }

  return languageButtonStateCache.get(language) || {};
}

function getLockKey(source, categoryName, language) {
  return `${language || 'unknown'}::${source}::${categoryName}::locked`;
}

function getMainCategoryTitle(source) {
  if (SOURCE_MAIN_CATEGORY_TITLES[source]) {
    return SOURCE_MAIN_CATEGORY_TITLES[source];
  }
  // Fallback for unknown sources
  if (source === 'free') return 'Free Content';
  if (source.includes('premium')) {
    const num = source.replace(/\D/g, '');
    return `Premium Pack ${num}`;
  }
  return source.toUpperCase();
}

/**
 * Setup category click handlers
 */
function setupCategoryClickHandlers() {
  const buttons = document.querySelectorAll('.start-challenge-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      // Button is already disabled for non-logged-in users, but double-check
      if (!isUserLoggedIn()) {
        promptLogin();
        return;
      }

      const target = e.currentTarget;
      const source = target.dataset.source;
      const categoryName = target.dataset.category;
      const language = target.dataset.language;
      startChallenge(source, categoryName, language);
    });
  });
}

/**
 * Start a challenge for a category
 */
function startChallenge(source, categoryName, language) {
  if (!isUserLoggedIn()) {
    setChallengePageStatus('Sign in to start challenges and sync your progress.', 'error');
    promptLogin();
    return;
  }

  const targetLanguage = language || languageService.getCurrentLanguage();
  console.log(`🎯 Starting challenge: ${targetLanguage} | ${source} - ${categoryName}`);

  // Find the category in the language bundle
  const languageBundle = languageCategoryCache.get(targetLanguage);
  if (!languageBundle) {
    setChallengePageStatus('Language data is still loading. Please try again in a moment.', 'error');
    return;
  }
  const category = languageBundle?.categories.find(
    (cat) =>
      cat.name === categoryName && (cat.source || 'free') === source
  );

  if (!category || !category.words) {
    setChallengePageStatus('Selected category was not found. Please refresh this page.', 'error');
    return;
  }

  // Generate challenge
  try {
    const challenge = challengeService.generateChallenge(
      category.words,
      categoryName,
      source,
      targetLanguage
    );
    setActiveChallengeSession({
      source,
      categoryName,
      language: targetLanguage,
      startedAt: Date.now(),
    });

    console.log(`✅ Challenge generated: ${challenge.totalQuestions} questions`);
    clearChallengePageStatus();

    // Hide category selection, show quiz view
    document.getElementById('category-selection-view').classList.add('hidden');
    document.getElementById('challenge-quiz-view').classList.remove('hidden');

    // Render first question
    renderQuestion();
  } catch (error) {
    console.error('❌ Error starting challenge:', error);
    setChallengePageStatus('Failed to start challenge. Please try again.', 'error');
  }
}

/**
 * Render current question
 */
function renderQuestion() {
  const question = challengeService.getCurrentQuestion();
  if (!question) {
    showResults();
    return;
  }

  // Update progress
  const progress = challengeService.getProgress();
  document.getElementById('quiz-progress').textContent = 
    `${progress.current}/${progress.total}`;
  document.getElementById('quiz-progress-bar').style.width = 
    `${progress.percentage}%`;
  
  // Update category name
  if (challengeService.currentChallenge) {
    document.getElementById('quiz-category-name').textContent = 
      challengeService.currentChallenge.categoryName;
  }

  // Update question
  const questionTextEl = document.getElementById('quiz-question');
  const romanizationEl = document.getElementById('quiz-question-romanization');
  const audioBtn = document.getElementById('quiz-audio-btn');
  const questionText = question.foreign || question.word?.en || '';
  questionTextEl.textContent = questionText;

  if (romanizationEl) {
    if (question.romanization) {
      romanizationEl.textContent = question.romanization;
      romanizationEl.classList.remove('hidden');
    } else {
      romanizationEl.textContent = '';
      romanizationEl.classList.add('hidden');
    }
  }

  if (audioBtn) {
    const audioUrl = question.word?.audio;
    if (audioUrl) {
      audioBtn.classList.remove('hidden');
      audioBtn.onclick = () => {
        try {
          new Audio(audioUrl).play();
        } catch (err) {
          console.error('Audio playback failed', err);
        }
      };
    } else {
      audioBtn.classList.add('hidden');
      audioBtn.onclick = null;
    }
  }

  // Render answer buttons
  const answersContainer = document.getElementById('quiz-answers');
  answersContainer.innerHTML = question.answers.map(answer => `
    <button 
      class="answer-btn btn btn-outline touch-target text-base sm:text-lg py-4 sm:py-6 h-auto hover:btn-primary transition-all"
      data-answer="${answer}"
    >
      ${answer}
    </button>
  `).join('');

  // Setup answer click handlers
  setupAnswerClickHandlers();
}

/**
 * Setup answer button click handlers
 */
function setupAnswerClickHandlers() {
  const buttons = document.querySelectorAll('.answer-btn');
  buttons.forEach(btn => {
    btn.addEventListener('click', handleAnswerClick);
  });
}

/**
 * Handle answer button click
 */
function handleAnswerClick(e) {
  const selectedAnswer = e.target.dataset.answer;
  const result = challengeService.submitAnswer(selectedAnswer);

  // Visual feedback
  if (result.isCorrect) {
    e.target.classList.add('btn-success');
  } else {
    e.target.classList.add('btn-error');
    // Highlight correct answer
    const buttons = document.querySelectorAll('.answer-btn');
    buttons.forEach(btn => {
      if (btn.dataset.answer === result.correctAnswer) {
        btn.classList.add('btn-success');
      }
    });
  }

  // Disable all buttons
  document.querySelectorAll('.answer-btn').forEach(btn => {
    btn.disabled = true;
  });

  // Move to next question after brief delay (just enough to see feedback)
  setTimeout(() => {
    if (result.challengeComplete) {
      showResults();
    } else {
      renderQuestion();
    }
  }, 300);
}

/**
 * Show challenge results
 */
function showResults() {
  const results = challengeService.getResults();
  if (!results) return;
  clearActiveChallengeSession();

  console.log('📊 Challenge results:', results);

  // Save if passed
  if (results.passed) {
    challengeService.saveChallengeCompletion(results);
  }

  // Hide quiz view, show results view
  document.getElementById('challenge-quiz-view').classList.add('hidden');
  document.getElementById('challenge-results-view').classList.remove('hidden');

  // Render results
  const iconContainer = document.getElementById('results-icon');
  const titleElement = document.getElementById('results-title');
  const scoreElement = document.getElementById('results-score');
  const messageElement = document.getElementById('results-message');

  if (results.passed) {
    if (results.perfectScore) {
      // Perfect score - category mastered!
      iconContainer.innerHTML = `<svg class="w-16 h-16 text-level-expert" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14V17M12 14C9.58104 14 7.56329 12.2822 7.10002 10M12 14C14.419 14 16.4367 12.2822 16.9 10M17 5H19.75C19.9823 5 20.0985 5 20.1951 5.01921C20.5918 5.09812 20.9019 5.40822 20.9808 5.80491C21 5.90151 21 6.01767 21 6.25C21 6.94698 21 7.29547 20.9424 7.58527C20.7056 8.77534 19.7753 9.70564 18.5853 9.94236C18.2955 10 17.947 10 17.25 10H17H16.9M7 5H4.25C4.01767 5 3.90151 5 3.80491 5.01921C3.40822 5.09812 3.09812 5.40822 3.01921 5.80491C3 5.90151 3 6.01767 3 6.25C3 6.94698 3 7.29547 3.05764 7.58527C3.29436 8.77534 4.22466 9.70564 5.41473 9.94236C5.70453 10 6.05302 10 6.75 10H7H7.10002M12 17C12.93 17 13.395 17 13.7765 17.1022C14.8117 17.3796 15.6204 18.1883 15.8978 19.2235C16 19.605 16 20.07 16 21H8C8 20.07 8 19.605 8.10222 19.2235C8.37962 18.1883 9.18827 17.3796 10.2235 17.1022C10.605 17 11.07 17 12 17ZM7.10002 10C7.03443 9.67689 7 9.34247 7 9V4.57143C7 4.03831 7 3.77176 7.09903 3.56612C7.19732 3.36201 7.36201 3.19732 7.56612 3.09903C7.77176 3 8.03831 3 8.57143 3H15.4286C15.9617 3 16.2282 3 16.4339 3.09903C16.638 3.19732 16.8027 3.36201 16.901 3.56612C17 3.77176 17 4.03831 17 4.57143V9C17 9.34247 16.9656 9.67689 16.9 10"/></svg>`;
      titleElement.textContent = 'Perfect Score!';
      titleElement.className = 'text-2xl font-bold mb-2 text-warning';
      scoreElement.textContent = `Score: ${results.score}% (${results.correctAnswers}/${results.totalQuestions})`;
      
      const pointsMessage = results.bonusPoints > 0 
        ? `You earned +${results.bonusPoints} points!`
        : 'No more points available for this category.';
      
      messageElement.innerHTML = `
        <div class="bg-amber-900/30 border-l-4 border-amber-500 p-4">
          <p class="text-amber-200">
            <strong>Category Mastered!</strong> ${pointsMessage}
            <br><span class="text-sm text-amber-300/80">You can play again for practice, but points are capped.</span>
          </p>
        </div>
      `;
    } else {
      // Passed but not perfect - can retry
      iconContainer.innerHTML = `<div class="text-6xl">🎉</div>`;
      titleElement.textContent = results.isFirstAttempt ? 'Challenge Passed!' : 'Challenge Complete!';
      titleElement.className = 'text-2xl font-bold mb-2 text-success';
      scoreElement.textContent = `Score: ${results.score}% (${results.correctAnswers}/${results.totalQuestions})`;
      
      let pointsInfo = '';
      if (results.bonusPoints > 0) {
        pointsInfo = `You earned +${results.bonusPoints} points!`;
      } else {
        pointsInfo = `Points are only awarded once. Play again for practice.`;
      }
      
      messageElement.innerHTML = `
        <div class="bg-green-900/30 border-l-4 border-green-500 p-4">
          <p class="text-green-200">
            <strong>Great job!</strong> ${pointsInfo}
            <br><span class="text-sm text-green-300/80">You can replay anytime, but points are capped after the first success.</span>
          </p>
        </div>
      `;
    }
  } else {
    iconContainer.innerHTML = `<div class="text-6xl">😔</div>`;
    titleElement.textContent = 'Challenge Failed';
    titleElement.className = 'text-2xl font-bold mb-2 text-error';
    scoreElement.textContent = `Score: ${results.score}% (${results.correctAnswers}/${results.totalQuestions})`;
    messageElement.innerHTML = `
      <div class="bg-red-900/30 border-l-4 border-red-500 p-4">
        <p class="text-red-200">
          You need to score above 90% to pass. Review the words and try again!
        </p>
      </div>
    `;
  }
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
  // Exit quiz button
  const exitBtn = document.getElementById('exit-quiz-btn');
  if (exitBtn) {
    exitBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to exit? Your progress will be lost.')) {
        clearActiveChallengeSession();
        challengeService.resetChallenge();
        location.reload();
      }
    });
  }

  const loginCta = document.getElementById('challenge-login-cta');
  if (loginCta) {
    loginCta.addEventListener('click', () => {
      promptLogin();
    });
  }
}

function maybeStartPendingChallenge() {
  let payload = null;
  try {
    const raw = localStorage.getItem("pendingChallenge");
    if (raw) {
      payload = JSON.parse(raw);
    }
  } catch (error) {
    console.error("Error reading pending challenge", error);
  }

  if (!payload || !payload.category) {
    return;
  }

  const tryLaunch = () => {
    if (!isUserLoggedIn()) {
      return false;
    }

    // Delay slightly to ensure DOM is ready before switching view
    setTimeout(() => {
      startChallenge(payload.source, payload.category, payload.language);
    }, 150);

    localStorage.removeItem("pendingChallenge");
    payload = null;
    return true;
  };

  if (tryLaunch()) {
    return;
  }

  // Wait for auth state to be ready, then try again
  const authHandler = () => {
    if (tryLaunch()) {
      window.removeEventListener("authStateChanged", authHandler);
    }
  };

  window.addEventListener("authStateChanged", authHandler);
}

function setActiveChallengeSession(sessionData) {
  try {
    localStorage.setItem(CHALLENGE_SESSION_KEY, JSON.stringify(sessionData));
  } catch (error) {
    console.error('Error saving active challenge session', error);
  }
}

function clearActiveChallengeSession() {
  try {
    localStorage.removeItem(CHALLENGE_SESSION_KEY);
  } catch (error) {
    console.error('Error clearing active challenge session', error);
  }
}

function recoverInterruptedChallenge() {
  try {
    const raw = localStorage.getItem(CHALLENGE_SESSION_KEY);
    if (!raw) {
      return false;
    }

    // Any leftover session means previous challenge was not cleanly completed.
    localStorage.removeItem(CHALLENGE_SESSION_KEY);
    challengeService.resetChallenge();
    return true;
  } catch (error) {
    console.error('Error recovering interrupted challenge', error);
    localStorage.removeItem(CHALLENGE_SESSION_KEY);
    challengeService.resetChallenge();
    return false;
  }
}

function isUserLoggedIn() {
  return getLoginState() === 'logged-in';
}

function getLoginState() {
  if (auth.currentUser || (window.currentUser && window.currentUser.uid)) {
    return 'logged-in';
  }
  if (!authStateResolved) {
    return 'unknown';
  }
  return 'logged-out';
}

function toggleLoginAlert() {
  const alertEl = document.getElementById('challenge-login-alert');
  if (!alertEl) return;

  if (!authStateResolved && !isUserLoggedIn()) {
    alertEl.classList.add('hidden');
    return;
  }

  if (isUserLoggedIn()) {
    alertEl.classList.add('hidden');
  } else {
    alertEl.classList.remove('hidden');
  }
}

function promptLogin() {
  const modal = document.getElementById('modal-login');
  if (modal) {
    modal.checked = true;
  } else {
    alert('Log in to take challenges and track your progress.');
  }
}

function isQuizActive() {
  const quizView = document.getElementById('challenge-quiz-view');
  return quizView && !quizView.classList.contains('hidden');
}

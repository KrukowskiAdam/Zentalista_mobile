// /public/scripts/services/stateService.js
// Application state management service

import { CONFIG } from "../utils/config.js";
import { premiumService } from "./premiumService.js";

class StateService {
  constructor() {
    this.cardsData = [];
    this.buttonStates = {};
    this.repeatCounts = {};
    this.categoryCompletionDates = {};
    this.categoryCompleted = {};
    this.lastCardId = null;
    this.lastButtonKey = null;
    this.lastClickedButtonKey = null;
    this.lastClickedPerCategory = {};  // Track last clicked button per category
    this.groupId = 1;
    this.totalWordCount = 0;
    this.categoryFilter = null;
    this.premiumCategories = new Set();
    this.categoryCache = null;
    this.lastCategoryFetchTime = 0;
    this._blockRerender = false;
  }

  init() {
    this.loadButtonStates();
    
    // Listen for settings changes to recalculate locked states
    window.addEventListener("settingsChanged", () => {
      this.recalculateLockedStates();
    });
    // console.log('🔍 StateService initialized');
  }

  resetCardSelection() {
    if (this.lastCardId) {
      const element = document.getElementById(this.lastCardId);
      if (element) {
        const primaryLangText = element.querySelector(".primary-lang-text");
        const audioButton = element.querySelector(".fc-audio-button");
        if (primaryLangText) primaryLangText.textContent = "";
        if (audioButton) audioButton.style.display = "none";
      }
    }
    this.lastCardId = this.lastButtonKey = null;
    // Note: Do NOT reset lastClickedButtonKey here - it will be restored from per-category state
  }

  /**
   * Get last clicked button for current category
   */
  getLastClickedForCategory(category) {
    return this.lastClickedPerCategory[category] || null;
  }

  /**
   * Set last clicked button for a category
   */
  setLastClickedForCategory(category, buttonKey) {
    this.lastClickedPerCategory[category] = buttonKey;
    this.lastClickedButtonKey = buttonKey;
    // Note: saveButtonStates() is called separately in updateButtonState()
  }

  updateButtonState(key, increment = true, wordInfo = {}) {
    const cleanKey = key.replace(/^word-/, "");
    const now = Date.now();

    if (increment) {
      if (this.buttonStates[cleanKey]) {
        this.buttonStates[cleanKey].count += 1;
        this.buttonStates[cleanKey].lastClicked = now;
        this.buttonStates[cleanKey].clicks =
          this.buttonStates[cleanKey].clicks || [];
        this.buttonStates[cleanKey].clicks.push({
          timestamp: Date.now(),
          date: new Date(now).toISOString().split("T")[0],
        });
        if (
          this.buttonStates[cleanKey].count >= CONFIG.cards.clicksToComplete
        ) {
          this.buttonStates[cleanKey].locked = true;
          
          // Check if entire card is completed
          this.checkCardCompletion(cleanKey);
          
          window.dispatchEvent(
            new CustomEvent("checkCategoryCompletion", {
              detail: {
                source: this.buttonStates[cleanKey].source,
                category: this.buttonStates[cleanKey].category,
                language:
                  this.buttonStates[cleanKey].language ||
                  localStorage.getItem("selectedLanguage") ||
                  "es",
              },
            })
          );
        }
      } else {
        this.buttonStates[cleanKey] = {
          count: 1,
          locked: false,
          ...wordInfo,
          lastClicked: now,
          clicks: [
            {
              timestamp: Date.now(),
              date: new Date(now).toISOString().split("T")[0],
            },
          ],
        };
      }
    } else {
      if (this.buttonStates[cleanKey]) {
        this.buttonStates[cleanKey].count = 0;
        this.buttonStates[cleanKey].locked = false;
        this.buttonStates[cleanKey].clicks = [];
      }
    }

    this.saveButtonStates();
    return this.buttonStates[cleanKey];
  }

  /**
   * Reset learning progress for all words in a category and source
   */
  resetCategoryProgress(source, category) {
    if (!source || !category) return;

    Object.entries(this.buttonStates).forEach(([key, state]) => {
      if (state?.source === source && state?.category === category) {
        state.locked = false;
        state.count = 0;
        state.clicks = [];
        state.lastClicked = null;
        state.wasReset = true;
        state.resetTime = Date.now();
      }
    });

    const progressKey = `${source}::${category}`;
    if (this.categoryCompleted && this.categoryCompleted[progressKey]) {
      this.categoryCompleted[progressKey] = false;
    }

    // Clear last clicked for this category so user can click any word after reset
    if (this.lastClickedPerCategory && this.lastClickedPerCategory[category]) {
      delete this.lastClickedPerCategory[category];
    }

    this.saveButtonStates();
  }

  /**
   * Recalculate locked states based on fixed 5 clicks requirement.
   * Used to migrate data from users who had different settings before.
   */
  recalculateLockedStates() {
    const clicksToComplete = 5; // Fixed value
    let changed = false;

    Object.entries(this.buttonStates).forEach(([key, state]) => {
      if (!state) return;
      
      const shouldBeLocked = state.count >= clicksToComplete;
      
      if (state.locked !== shouldBeLocked) {
        state.locked = shouldBeLocked;
        changed = true;
      }
    });

    // Reset categoryCompleted flags so celebrations can trigger again
    // for categories that are now complete with new settings
    if (changed) {
      this.categoryCompleted = {};
      this.saveButtonStates();
    }

    return changed;
  }

  /**
   * Check if all words on a card are completed
   * Called when a word is locked to trigger card celebration
   */
  checkCardCompletion(wordKey) {
    // Find which card this word belongs to
    const card = this.cardsData.find(c => 
      c.words?.some(w => `${w.globalIndex}-${w.source}` === wordKey)
    );
    
    if (!card || !card.words) return;
    
    // Check if all words on this card are locked
    const allWordsLocked = card.words.every(word => {
      const key = `${word.globalIndex}-${word.source}`;
      return this.buttonStates[key]?.locked === true;
    });
    
    if (allWordsLocked) {
      // Track completed cards to avoid duplicate celebrations
      if (!this.completedCards) this.completedCards = new Set();
      
      const cardKey = `card-${card.id}`;
      if (!this.completedCards.has(cardKey)) {
        this.completedCards.add(cardKey);
        
        window.dispatchEvent(
          new CustomEvent("cardCompleted", {
            detail: { cardId: card.id }
          })
        );
      }
    }
  }

  isButtonLocked(key) {
    const cleanKey = key.replace(/^word-/, "");
    return this.buttonStates[cleanKey]?.locked || false;
  }

  getButtonProgress(key) {
    const cleanKey = key.replace(/^word-/, "");
    return this.buttonStates[cleanKey]?.count || 0;
  }

  getButtonState(key) {
    const cleanKey = key.replace(/^word-/, "");
    return this.buttonStates[cleanKey] || null;
  }

  saveButtonStates() {
    try {
      const currentLang = localStorage.getItem("selectedLanguage") || "es";
      localStorage.setItem(
        `buttonStates_${currentLang}`,
        JSON.stringify(this.buttonStates)
      );
      localStorage.setItem(
        `repeatCounts_${currentLang}`,
        JSON.stringify(this.repeatCounts || {})
      );
      localStorage.setItem(
        `categoryCompletionDates_${currentLang}`,
        JSON.stringify(this.categoryCompletionDates || {})
      );
      localStorage.setItem(
        `lastClickedPerCategory_${currentLang}`,
        JSON.stringify(this.lastClickedPerCategory || {})
      );

      // Trigger cloud sync if available
      if (window.syncService) {
        window.syncService.syncToCloud();
      }
    } catch (error) {
      console.error("Error saving button states:", error);
    }
  }

  loadButtonStates() {
    try {
      const currentLang = localStorage.getItem("selectedLanguage") || "es";
      
      // CRITICAL: Verify data belongs to current user
      const storedUserId = localStorage.getItem("mc_current_user_id");
      const currentUser = window.auth?.currentUser || window.currentUser;
      const currentUserId = currentUser?.uid;
      
      // If there's stored data but it's from a different user, clear it
      if (storedUserId && currentUserId && storedUserId !== currentUserId) {
        console.warn("⚠️ loadButtonStates: Data belongs to different user, clearing...");
        this.buttonStates = {};
        this.repeatCounts = {};
        this.categoryCompletionDates = {};
        this.lastClickedPerCategory = {};
        this.categoryCompleted = {};
        return;
      }
      
      this.buttonStates = JSON.parse(
        localStorage.getItem(`buttonStates_${currentLang}`) || "{}"
      );
      this.repeatCounts = JSON.parse(
        localStorage.getItem(`repeatCounts_${currentLang}`) || "{}"
      );
      this.categoryCompletionDates = JSON.parse(
        localStorage.getItem(`categoryCompletionDates_${currentLang}`) || "{}"
      );
      this.lastClickedPerCategory = JSON.parse(
        localStorage.getItem(`lastClickedPerCategory_${currentLang}`) || "{}"
      );
      
      // Rebuild categoryCompleted from repeatCounts to know which categories
      // have been completed at least once (prevents duplicate celebrations)
      this.categoryCompleted = {};
      Object.keys(this.repeatCounts).forEach(key => {
        if (this.repeatCounts[key] > 0) {
          this.categoryCompleted[key] = true;
        }
      });
      
    } catch (error) {
      console.error("Error loading button states:", error);
      this.buttonStates = {};
      this.repeatCounts = {};
      this.categoryCompletionDates = {};
      this.categoryCompleted = {};
    }
  }

  isWordAccessible(word) {
    if (!word) return true;
    const isPremiumCategory = this.premiumCategories.has(word.category);
    return !isPremiumCategory || premiumService.getPremiumStatus();
  }

  isCategoryPremium(categoryName) {
    return this.premiumCategories.has(categoryName);
  }

  getStatsNavigationTarget() {
    try {
      const savedTarget = localStorage.getItem("openCategory");
      if (savedTarget) {
        localStorage.removeItem("openCategory");
        return JSON.parse(savedTarget);
      }
    } catch (e) {
      console.error("Error reading stats navigation target:", e);
    }
    return null;
  }

  checkCategoryCompletion(source, category, allWords, language) {
    const languageCode =
      language || localStorage.getItem("selectedLanguage") || "es";
    const allWordsInCategory = allWords.filter(
      (w) =>
        w.source === source &&
        w.category === category &&
        (!w.language || w.language === languageCode)
    );

    const statesInCategory = allWordsInCategory
      .map((word) => {
        const key = `${word.globalIndex}-${word.source}`;
        return this.buttonStates[key];
      })
      .filter(Boolean);

    const allLocked =
      statesInCategory.length === allWordsInCategory.length &&
      statesInCategory.length > 0 &&
      statesInCategory.every((s) => s.locked);

    const key = `${source}::${category}`;

    if (!this.repeatCounts) this.repeatCounts = {};
    if (!this.categoryCompletionDates) this.categoryCompletionDates = {};
    if (!this.categoryCompleted) this.categoryCompleted = {};

    if (allLocked) {
      if (!this.categoryCompleted[key]) {
        const nowIso = new Date().toISOString();
        const existingMeta = this.categoryCompletionDates[key] || {};

        this.repeatCounts[key] = (this.repeatCounts[key] || 0) + 1;
        this.categoryCompletionDates[key] = {
          firstCompletedAt: existingMeta.firstCompletedAt || nowIso,
          previousCompletedAt: existingMeta.lastCompletedAt || null,
          lastCompletedAt: nowIso,
        };
        this.categoryCompleted[key] = true;
        this.saveButtonStates();

        // CRITICAL: Force sync to cloud immediately when category is completed
        // This ensures user's progress is saved even if they close the browser
        if (window.syncService) {
          window.syncService.forceSyncNow();
          window.syncService.updateLeaderboard();
        }

        window.dispatchEvent(
          new CustomEvent("categoryCompleted", {
            detail: {
              source,
              category,
              repeatCount: this.repeatCounts[key],
              language: languageCode,
            },
          })
        );
      }
    } else {
      if (this.categoryCompleted[key]) {
        this.categoryCompleted[key] = false;
      }
    }
  }
}

export const stateService = new StateService();

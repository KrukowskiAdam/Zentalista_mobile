// /public/scripts/main.js
// Main application orchestrator

import { auth } from "./auth.js";
import { stateService } from "./services/stateService.js";
import { dataService } from "./services/dataService.js";
import { premiumService } from "./services/premiumService.js";
import { uiService } from "./services/uiService.js";
import { languageService } from "./services/languageService.js";
import { syncService } from "./services/syncService.js";
import { celebrationService } from "./services/celebrationService.js";

class MainApp {
  constructor() {
    this.isAppInitialized = false;
    this.authStateReady = false;
    this.pendingInit = false;
  }

  /**
   * Wait for auth state to be ready
   */
  async waitForAuthState(maxWait = 3000) {
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      if (this.authStateReady || typeof window.isPremiumUser === "boolean") {
        // console.log('🔍 Auth state ready, premium status:', window.isPremiumUser);
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    console.log("🔍 Auth state timeout, proceeding with default");
    return false;
  }

  /**
   * Initialize the entire application
   */
  async initApp() {
    if (this.isAppInitialized) return;
    if (this.pendingInit) {
      // console.log('🔍 Init already pending, skipping');
      return;
    }

    this.pendingInit = true;

    try {
      if (
        languageService &&
        typeof languageService.initializeUI === "function"
      ) {
        // console.log('🔍 [main.js] Calling languageService.initializeUI()');
        languageService.initializeUI();
      } else {
        console.warn(
          "🔍 [main.js] languageService not available or not a function"
        );
      }

      // Wait for auth state to be determined
      await this.waitForAuthState();

      // Double-check premium status if needed
      if (auth.currentUser && typeof window.isPremiumUser !== "boolean") {
        await premiumService.checkPremiumStatus(auth.currentUser);
        window.isPremiumUser = premiumService.isPremiumUser;
      }

      // If we're coming from stats navigation, wait extra time for status to stabilize
      const targetCategoryInfo = localStorage.getItem("openCategory");
      if (targetCategoryInfo) {
        await new Promise((resolve) => setTimeout(resolve, 800));
        await premiumService.checkPremiumStatus(auth.currentUser);
        window.isPremiumUser = premiumService.isPremiumUser;
      }

      // Initialize services
      stateService.init();

      // Load data
      const dataLoaded = await dataService.fetchAllCards();

      if (!dataLoaded) {
        console.error("Failed to load card data!");
        alert("Nie znaleziono żadnych danych kart!");
        return;
      }

      // Set default category BEFORE any UI rendering
      if (!stateService.categoryFilter) {
        let firstCategory = null;
        if (window.isPremiumUser) {
          if (dataService.allWords.length > 0) {
            firstCategory = dataService.allWords[0].category;
          }
        } else {
          // Only free words
          const freeWords = dataService.allWords.filter(
            (w) => w.source === "free"
          );
          if (freeWords.length > 0) {
            firstCategory = freeWords[0].category;
          }
        }
        if (firstCategory) {
          stateService.categoryFilter = firstCategory;
        }
      }

      // Setup UI
      await uiService.renderCards();
      uiService.renderPremiumBanner();
      await uiService.initCategorySidebar();
      uiService.updateAllProgressBars();

      // Force render cards and sidebar if categoryFilter is set (after refresh)
      if (stateService.categoryFilter) {
        uiService.updateCategorySidebar();
        await uiService.renderAllCards();
      }

      this.setupEventListeners();

    } catch (error) {
      console.error("Error initializing app:", error);
      alert("App initialization error! Check the console.");
    } finally {
      this.isAppInitialized = true;
      this.pendingInit = false;
    }
  }

  /**
   * Setup global event listeners
   */
  setupEventListeners() {
    // Listen for auth state changes from setupUI
    window.addEventListener("authStateChanged", async (event) => {
      const { user, isPremium } = event.detail;
      // console.log('🔍 Auth state changed:', { user: !!user, isPremium });

      this.authStateReady = true;

      // Initialize sync service if user is logged in
      if (user) {
        await syncService.init(user);
      }

      // If app is not initialized yet and we're on /learn page, trigger init
      if (
        !this.isAppInitialized &&
        (window.location.pathname === "/learn" ||
          window.location.pathname === "/home")
      ) {
        // console.log('🔍 Triggering app init after auth state change');
        setTimeout(() => this.initApp(), 100);
      }
    });

    // Re-render home after cloud sync delivers fresh data
    // (fixes race where initApp renders before sync completes)
    window.addEventListener("cloudSyncComplete", async () => {
      if (
        window.location.pathname === "/home" ||
        window.location.pathname === "/learn"
      ) {
        stateService.loadButtonStates();
        await uiService.renderCards();
      }
    });

    // Listen for category changes
    window.addEventListener("categoryChanged", async (event) => {
      if (!stateService._blockRerender) {
        await uiService.renderAllCards();
      }
    });

    // Listen for premium status changes
    window.addEventListener("premiumStatusChanged", async (event) => {
      if (this.isAppInitialized && !stateService._blockRerender) {
        await dataService.fetchAllCards();
        await uiService.renderCards();
        uiService.renderPremiumBanner();
        await uiService.initCategorySidebar();
      }
    });

    // Listen for category completion
    window.addEventListener("checkCategoryCompletion", (event) => {
      const { source, category, language } = event.detail;
      stateService.checkCategoryCompletion(
        source,
        category,
        dataService.allWords,
        language
      );
    });

    window.addEventListener("categoryCompleted", (event) => {
      celebrationService.showCelebration(event.detail);
    });

    // Listen for card completion (all 4 words on a card)
    // TODO: re-enable when better animation is found
    // window.addEventListener("cardCompleted", (event) => {
    //   celebrationService.showCardCelebration(event.detail);
    // });

    // Listen for settings changes to re-render cards with updated progress
    window.addEventListener("settingsChanged", async () => {
      if (this.isAppInitialized && !stateService._blockRerender) {
        await uiService.renderCards();
        await uiService.initCategorySidebar();
      }
    });
  }
}

// Create singleton instance
const mainApp = new MainApp();

// Setup event listeners immediately
mainApp.setupEventListeners();

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  if (
    window.location.pathname === "/learn" ||
    window.location.pathname === "/home"
  ) {
    // Don't init immediately, wait for auth state
    // console.log('🔍 DOM ready, waiting for auth state...');
  }
});

// Exports for global access
window.initApp = () => mainApp.initApp();
window.cardsScriptLoaded = true;
document.dispatchEvent(new CustomEvent("cardsScriptLoaded"));

// Export services for compatibility
window.AppState = stateService;
window.DataService = dataService;
window.UIService = uiService;

// /public/scripts/services/syncService.js
// Firebase synchronization service for user progress

import { auth } from "../auth.js";
import { db } from "../auth.js";
import {
  doc,
  setDoc,
  getDoc,
  getDocFromServer,
  updateDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class SyncService {
  constructor() {
    this.syncInterval = null;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.SYNC_INTERVAL_MS = 15000;
    this.LANGUAGES = ["es", "de", "fr", "ru", "zh", "ja", "ko", "it"];
    this.initPromise = null;
    this.currentUserId = null;
  }

  /**
   * Safely read and parse a JSON value from localStorage.
   * Returns fallback if the key is missing or the value is corrupt.
   * Removes the corrupt entry so it doesn't block future writes.
   */
  _safeParseLocalStorage(key, fallback = {}) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : fallback;
    } catch {
      localStorage.removeItem(key);
      return fallback;
    }
  }

  /**
   * Retry an async function with exponential backoff.
   * Throws the last error if all attempts fail.
   */
  async _withRetry(fn, maxRetries = 3, baseDelayMs = 1000) {
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt < maxRetries - 1) {
          await new Promise((resolve) =>
            setTimeout(resolve, baseDelayMs * Math.pow(2, attempt))
          );
        }
      }
    }
    throw lastError;
  }

  /**
   * Initialize sync service
   * @returns {Promise} - Promise that resolves when initial sync is complete
   */
  async init(user) {
    if (!user) return false;

    const previousUserId = localStorage.getItem("mc_current_user_id");
    if (previousUserId && previousUserId !== user.uid) {
      this.clearLocalUserData();
    }

    this.currentUserId = user.uid;
    localStorage.setItem("mc_current_user_id", user.uid);

    this.initPromise = this._performInitialSync();
    const result = await this.initPromise;

    this.startAutoSync();

    window.addEventListener("beforeunload", () => {
      this.syncOnUnload();
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        this.syncToCloud(true);
      }
    });

    return result;
  }
  
  /**
   * Sync on page unload - uses sendBeacon for reliability
   */
  syncOnUnload() {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const syncData = this.collectSyncData(user);
      if (syncData && navigator.sendBeacon) {
        localStorage.setItem("pendingCloudSync", JSON.stringify({
          data: syncData,
          timestamp: Date.now(),
          userId: user.uid,
        }));
      }
    } catch (error) {
      console.error("Error in syncOnUnload:", error);
    }

    this.syncToCloud(true);
  }
  
  /**
   * Collect sync data for current user
   */
  collectSyncData(user) {
    const languages = {};

    this.LANGUAGES.forEach((lang) => {
      const buttonStates = this._safeParseLocalStorage(`buttonStates_${lang}`);
      const repeatCounts = this._safeParseLocalStorage(`repeatCounts_${lang}`);
      const categoryCompletionDates = this._safeParseLocalStorage(`categoryCompletionDates_${lang}`);

      languages[lang] = {
        buttonStates,
        repeatCounts,
        categoryCompletionDates,
        wordCount: Object.keys(buttonStates).length,
        completedWords: Object.values(buttonStates).filter((s) => s.locked).length,
      };
    });
    
    return {
      userId: user.uid,
      email: user.email,
      displayName: user.displayName || user.email?.split("@")[0] || "Anonymous",
      lastSyncTime: new Date().toISOString(),
      languages,
      stats: this.calculateStats(languages)
    };
  }
  
  /**
   * Perform initial sync from cloud - awaitable
   */
  async _performInitialSync() {
    try {
      await this.processPendingSync();
      const success = await this.syncFromCloud(true);
      window.dispatchEvent(new CustomEvent("cloudSyncComplete", { detail: { success } }));
      return success;
    } catch (error) {
      console.error("❌ Initial sync failed:", error);
      return false;
    }
  }
  
  /**
   * Process any pending sync data from previous session
   */
  async processPendingSync() {
    try {
      const pending = this._safeParseLocalStorage("pendingCloudSync", null);
      if (!pending) return;

      const user = auth.currentUser;
      if (!user || pending.userId !== user.uid) {
        localStorage.removeItem("pendingCloudSync");
        return;
      }

      const ageHours = (Date.now() - pending.timestamp) / (1000 * 60 * 60);
      if (ageHours > 24) {
        localStorage.removeItem("pendingCloudSync");
        return;
      }

      await this.syncToCloud(true);
      localStorage.removeItem("pendingCloudSync");
    } catch (error) {
      console.error("Error processing pending sync:", error);
      localStorage.removeItem("pendingCloudSync");
    }
  }
  
  /**
   * Wait for initial sync to complete (for other services to use)
   */
  async waitForInitialSync(timeoutMs = 5000) {
    if (!this.initPromise) {
      return false;
    }
    
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Sync timeout")), timeoutMs)
      );
      return await Promise.race([this.initPromise, timeoutPromise]);
    } catch (error) {
      console.warn("🔄 Wait for sync timed out or failed:", error.message);
      return false;
    }
  }

  /**
   * Clear all user-specific data from localStorage
   * Called when a different user logs in to prevent data mixing
   */
  clearLocalUserData() {
    this.LANGUAGES.forEach((lang) => {
      localStorage.removeItem(`buttonStates_${lang}`);
      localStorage.removeItem(`repeatCounts_${lang}`);
      localStorage.removeItem(`categoryCompletionDates_${lang}`);
      localStorage.removeItem(`lastClickedPerCategory_${lang}`);
    });

    localStorage.removeItem("lastSyncTime");
    localStorage.removeItem("pendingCloudSync");
    localStorage.removeItem("mc_premium_status_cache");
    localStorage.removeItem("openCategory");

    if (window.AppState) {
      window.AppState.buttonStates = {};
      window.AppState.repeatCounts = {};
      window.AppState.categoryCompletionDates = {};
      window.AppState.categoryCompleted = {};
      window.AppState.lastClickedPerCategory = {};
    }
  }

  /**
   * Start automatic sync interval
   */
  startAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }
    this.syncInterval = setInterval(() => {
      this.syncToCloud();
    }, this.SYNC_INTERVAL_MS);
  }

  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  /**
   * Sync local data to Firestore
   */
  async syncToCloud(force = false) {
    const user = auth.currentUser;
    if (!user) return;

    if (this.isSyncing && !force) return;

    const storedUserId = localStorage.getItem("mc_current_user_id");
    if (storedUserId && storedUserId !== user.uid) {
      console.warn("⚠️ Cannot sync - localStorage data belongs to different user:", storedUserId);
      this.clearLocalUserData();
      localStorage.setItem("mc_current_user_id", user.uid);
      await this.syncFromCloud(true);
      return;
    }

    let hasAnyLocalData = false;
    this.LANGUAGES.forEach((lang) => {
      if (Object.keys(this._safeParseLocalStorage(`buttonStates_${lang}`)).length > 0) {
        hasAnyLocalData = true;
      }
    });

    if (!hasAnyLocalData) return;

    this.isSyncing = true;

    try {
      const userData = {
        userId: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split("@")[0] || "Anonymous",
        lastSyncTime: new Date().toISOString(),
        languages: {},
      };

      this.LANGUAGES.forEach((lang) => {
        const buttonStates = this._safeParseLocalStorage(`buttonStates_${lang}`);
        const repeatCounts = this._safeParseLocalStorage(`repeatCounts_${lang}`);
        const categoryCompletionDates = this._safeParseLocalStorage(`categoryCompletionDates_${lang}`);

        userData.languages[lang] = {
          buttonStates,
          repeatCounts,
          categoryCompletionDates,
          wordCount: Object.keys(buttonStates).length,
          completedWords: Object.values(buttonStates).filter((s) => s.locked).length,
        };
      });

      userData.stats = this.calculateStats(userData.languages);

      const userRef = doc(db, "users", user.uid);
      const syncTime = Date.now();

      await this._withRetry(() =>
        setDoc(userRef, { ...userData, updatedAt: serverTimestamp() }, { merge: true })
      );

      this.lastSyncTime = syncTime;
      localStorage.setItem("lastSyncTime", syncTime.toString());

    } catch (error) {
      console.error("❌ Error syncing to cloud:", error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync cloud data to local storage
   */
  async syncFromCloud(forceServerFetch = true) {
    const user = auth.currentUser;
    if (!user) return false;

    try {
      const userRef = doc(db, "users", user.uid);

      let docSnap;
      if (forceServerFetch) {
        try {
          docSnap = await this._withRetry(() => getDocFromServer(userRef));
        } catch (serverError) {
          console.warn("🔄 Server fetch failed, trying cache:", serverError.message);
          docSnap = await getDoc(userRef);
        }
      } else {
        docSnap = await this._withRetry(() => getDoc(userRef));
      }

      if (!docSnap.exists()) {
        await this.syncToCloud(true);
        return true;
      }

      const cloudData = docSnap.data();
      const cloudSyncTime = new Date(cloudData.lastSyncTime || 0).getTime();
      const localSyncTime = parseInt(localStorage.getItem("lastSyncTime") || "0");

      if (forceServerFetch || cloudSyncTime > localSyncTime) {
        this.LANGUAGES.forEach((lang) => {
          if (cloudData.languages && cloudData.languages[lang]) {
            const cloudLang = cloudData.languages[lang];
            const localButtonStates = this._safeParseLocalStorage(`buttonStates_${lang}`);
            const merged = this.mergeButtonStates(localButtonStates, cloudLang.buttonStates, cloudSyncTime, localSyncTime);
            localStorage.setItem(`buttonStates_${lang}`, JSON.stringify(merged));

            if (cloudLang.repeatCounts) {
              const localRepeatCounts = this._safeParseLocalStorage(`repeatCounts_${lang}`);
              const mergedRepeatCounts = this.mergeRepeatCounts(localRepeatCounts, cloudLang.repeatCounts);
              localStorage.setItem(`repeatCounts_${lang}`, JSON.stringify(mergedRepeatCounts));
            }

            if (cloudLang.categoryCompletionDates) {
              const localCompletionDates = this._safeParseLocalStorage(`categoryCompletionDates_${lang}`);
              const mergedCompletions = this.mergeCategoryCompletions(localCompletionDates, cloudLang.categoryCompletionDates);
              localStorage.setItem(`categoryCompletionDates_${lang}`, JSON.stringify(mergedCompletions));
            }
          }
        });

        localStorage.setItem("lastSyncTime", cloudSyncTime.toString());
      }

      if (window.stateService) {
        window.stateService.loadButtonStates();
      }

      return true;
    } catch (error) {
      console.error("❌ Error syncing from cloud:", error);
      return false;
    }
  }

  /**
   * Merge button states - newer timestamp wins for each word
   */
  mergeButtonStates(local, cloud, cloudSyncTime, localSyncTime) {
    // ALWAYS merge - never just overwrite with cloud data
    // This prevents data loss when cloud has old/empty data
    const merged = { ...(cloud || {}) };

    Object.keys(local || {}).forEach((key) => {
      if (!merged[key]) {
        // Local has data that cloud doesn't - keep local
        merged[key] = local[key];
      } else {
        // Both have data - compare timestamps and locked status
        const localTime = local[key].lastClicked || 0;
        const cloudTime = merged[key].lastClicked || 0;
        const localLocked = local[key].locked || false;
        const cloudLocked = merged[key].locked || false;

        // If local is locked but cloud isn't, always prefer local (progress shouldn't be lost)
        if (localLocked && !cloudLocked) {
          merged[key] = local[key];
        } else if (localTime > cloudTime) {
          // Local is newer
          merged[key] = local[key];
        }
        // Otherwise keep cloud data (already in merged)
      }
    });

    return merged;
  }

  /**
   * Merge repeatCounts - take the HIGHER value for each category
   * Stars should never decrease!
   */
  mergeRepeatCounts(local, cloud) {
    const merged = { ...cloud };
    
    Object.keys(local).forEach((key) => {
      const localCount = local[key] || 0;
      const cloudCount = merged[key] || 0;
      merged[key] = Math.max(localCount, cloudCount);
    });

    return merged;
  }

  /**
   * Merge categoryCompletionDates - keep best scores and most bonus points
   */
  mergeCategoryCompletions(local, cloud) {
    const merged = { ...cloud };
    
    Object.keys(local).forEach((key) => {
      const localEntry = local[key];
      const cloudEntry = merged[key];
      
      if (!cloudEntry) {
        // Local has data that cloud doesn't - keep local
        merged[key] = localEntry;
      } else if (localEntry && typeof localEntry === 'object') {
        // Both have data - keep the one with higher totalBonusPoints or bestScore
        const localBonus = localEntry.totalBonusPoints || localEntry.bonusPoints || 0;
        const cloudBonus = cloudEntry.totalBonusPoints || cloudEntry.bonusPoints || 0;
        const localBest = localEntry.bestScore || localEntry.score || 0;
        const cloudBest = cloudEntry.bestScore || cloudEntry.score || 0;
        
        // Merge: take the best of both
        merged[key] = {
          ...cloudEntry,
          ...localEntry,
          bestScore: Math.max(localBest, cloudBest),
          totalBonusPoints: Math.max(localBonus, cloudBonus),
          attempts: Math.max(localEntry.attempts || 0, cloudEntry.attempts || 0),
        };
        
        // Keep earliest firstCompletedAt
        if (cloudEntry.firstCompletedAt && localEntry.firstCompletedAt) {
          merged[key].firstCompletedAt = new Date(cloudEntry.firstCompletedAt) < new Date(localEntry.firstCompletedAt)
            ? cloudEntry.firstCompletedAt
            : localEntry.firstCompletedAt;
        }
      }
    });
    
    return merged;
  }

  /**
   * Calculate aggregate statistics
   */
  calculateStats(languages) {
    const POINTS = {
      CATEGORY_COMPLETION: 5,  // 5 points per category completion (star)
      POINTS_PER_LEVEL: 100,   // Smaller levels for new point system
    };

    let totalWords = 0;
    let totalCategories = 0;
    let totalStars = 0;
    let totalPoints = 0;

    Object.values(languages).forEach((langData) => {
      // Count completed words (for stats display, not points)
      if (langData.buttonStates) {
        const completed = Object.values(langData.buttonStates).filter(
          (s) => s.locked
        ).length;
        totalWords += completed;
      }

      // Count category completions (stars) - each completion = 5 points
      if (langData.repeatCounts) {
        const stars = Object.values(langData.repeatCounts).reduce(
          (sum, count) => sum + (count || 0),
          0
        );
        totalStars += stars;
        totalPoints += stars * POINTS.CATEGORY_COMPLETION;
      }

      // Add challenge bonus points (10 for 90%+, 20 for 100%)
      if (langData.categoryCompletionDates) {
        const entries = Object.values(langData.categoryCompletionDates).filter(
          (entry) => entry && typeof entry === "object" && "totalBonusPoints" in entry
        );
        totalCategories += entries.length;
        totalPoints += entries.reduce(
          (sum, entry) => sum + (entry.totalBonusPoints || entry.bonusPoints || 0),
          0
        );
      }
    });

    const level = Math.floor(totalPoints / POINTS.POINTS_PER_LEVEL) + 1;
    const levelProgress = (
      ((totalPoints % POINTS.POINTS_PER_LEVEL) / POINTS.POINTS_PER_LEVEL) *
      100
    ).toFixed(1);

    return {
      totalWords,
      challengesCompleted: totalCategories,
      totalStars,
      totalPoints,
      level,
      levelProgress,
    };
  }

  /**
   * Force immediate sync (call when user completes a word/category)
   */
  forceSyncNow() {
    this.syncToCloud(true);
  }

  /**
   * Update leaderboard entry
   */
  async updateLeaderboard() {
    const user = auth.currentUser;
    if (!user) return;

    try {
      const languages = {};
      this.LANGUAGES.forEach((lang) => {
        const buttonStates = this._safeParseLocalStorage(`buttonStates_${lang}`);
        const repeatCounts = this._safeParseLocalStorage(`repeatCounts_${lang}`);
        const categoryCompletionDates = this._safeParseLocalStorage(`categoryCompletionDates_${lang}`);
        const validCompletions = Object.values(categoryCompletionDates).filter(
          (entry) => entry && typeof entry === "object" && "totalBonusPoints" in entry
        );
        languages[lang] = {
          buttonStates,
          repeatCounts,
          categoryCompletionDates,
          completedWords: Object.values(buttonStates).filter((s) => s.locked)
            .length,
          challengeCompletions: validCompletions.length,
        };
      });

      const stats = this.calculateStats(languages);

      // Get avatar URL from user profile or Firestore
      let avatarUrl = user.photoURL || null;
      
      // If no photoURL, try to get from Firestore user document
      if (!avatarUrl) {
        try {
          const userRef = doc(db, "users", user.uid);
          const userDoc = await getDoc(userRef);
          if (userDoc.exists()) {
            avatarUrl = userDoc.data().avatarUrl || null;
          }
        } catch (e) {
          console.warn("Could not fetch avatar from Firestore:", e.message);
        }
      }

      const leaderboardRef = doc(db, "leaderboard", user.uid);
      await setDoc(
        leaderboardRef,
        {
          userId: user.uid,
          displayName:
            user.displayName || user.email?.split("@")[0] || "Anonymous",
          email: user.email,
          avatarUrl: avatarUrl,
          totalPoints: stats.totalPoints,
          level: stats.level,
          starsEarned: stats.totalStars,
          challengesCompleted: stats.challengesCompleted,
          languageBreakdown: languages,
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );

      console.log("✅ Leaderboard updated:", stats);
    } catch (error) {
      console.error("❌ Error updating leaderboard:", error);
    }
  }
}

export const syncService = new SyncService();
window.syncService = syncService;

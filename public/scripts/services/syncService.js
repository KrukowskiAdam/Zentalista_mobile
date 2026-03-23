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
    this.SYNC_INTERVAL_MS = 15000; // Sync every 15 seconds (more frequent to minimize data loss)
    this.LANGUAGES = ["es", "de", "fr", "ru", "zh", "ja", "ko", "it"];
    this.initPromise = null;
    this.currentUserId = null; // Track current user for data isolation
  }

  /**
   * Initialize sync service
   * @returns {Promise} - Promise that resolves when initial sync is complete
   */
  async init(user) {
    if (!user) {
      console.log("🔄 No user - sync disabled");
      return false;
    }

    // CRITICAL: Check if user has changed - if so, clear local data first
    const previousUserId = localStorage.getItem("mc_current_user_id");
    if (previousUserId && previousUserId !== user.uid) {
      console.log("🔄 Different user detected! Clearing previous user data...");
      this.clearLocalUserData();
    }
    
    // Store current user ID for future checks
    this.currentUserId = user.uid;
    localStorage.setItem("mc_current_user_id", user.uid);

    console.log("🔄 Initializing sync service for user:", user.uid);

    // Store the init promise so other parts of app can await it
    this.initPromise = this._performInitialSync();
    
    const result = await this.initPromise;

    // Auto-sync every 15 seconds (more frequent to minimize data loss)
    this.startAutoSync();

    // Sync before page unload using multiple strategies
    window.addEventListener("beforeunload", (event) => {
      this.syncOnUnload();
    });
    
    // Also sync when page becomes hidden (more reliable than beforeunload)
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        console.log("🔄 Page hidden - syncing to cloud");
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
    
    console.log("🔄 Page unloading - attempting final sync");
    
    // Strategy 1: Use sendBeacon to queue data for background send
    // This is the most reliable way to send data on page close
    try {
      const syncData = this.collectSyncData(user);
      if (syncData && navigator.sendBeacon) {
        // Save to localStorage as backup (will be synced on next load)
        localStorage.setItem("pendingCloudSync", JSON.stringify({
          data: syncData,
          timestamp: Date.now(),
          userId: user.uid
        }));
        console.log("💾 Saved pending sync data to localStorage");
      }
    } catch (error) {
      console.error("Error in syncOnUnload:", error);
    }
    
    // Strategy 2: Also try regular sync (may or may not complete)
    this.syncToCloud(true);
  }
  
  /**
   * Collect sync data for current user
   */
  collectSyncData(user) {
    const languages = {};
    
    this.LANGUAGES.forEach((lang) => {
      const buttonStates = JSON.parse(
        localStorage.getItem(`buttonStates_${lang}`) || "{}"
      );
      const repeatCounts = JSON.parse(
        localStorage.getItem(`repeatCounts_${lang}`) || "{}"
      );
      const categoryCompletionDates = JSON.parse(
        localStorage.getItem(`categoryCompletionDates_${lang}`) || "{}"
      );

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
      // First, check if there's pending sync data from a previous session
      await this.processPendingSync();
      
      // ALWAYS fetch fresh data from server on startup
      const success = await this.syncFromCloud(true);
      console.log("🔄 Initial cloud sync completed:", success ? "success" : "failed");
      
      // Dispatch event to notify app that sync is complete
      window.dispatchEvent(new CustomEvent("cloudSyncComplete", {
        detail: { success }
      }));
      
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
      const pendingRaw = localStorage.getItem("pendingCloudSync");
      if (!pendingRaw) return;
      
      const pending = JSON.parse(pendingRaw);
      const user = auth.currentUser;
      
      // Only process if it's for the current user and less than 24 hours old
      if (!user || pending.userId !== user.uid) {
        localStorage.removeItem("pendingCloudSync");
        return;
      }
      
      const ageHours = (Date.now() - pending.timestamp) / (1000 * 60 * 60);
      if (ageHours > 24) {
        console.log("🔄 Pending sync data too old, discarding");
        localStorage.removeItem("pendingCloudSync");
        return;
      }
      
      console.log("🔄 Found pending sync data from previous session, uploading...");
      
      // Push the pending data to cloud first
      await this.syncToCloud(true);
      
      // Clear the pending sync
      localStorage.removeItem("pendingCloudSync");
      console.log("✅ Pending sync data processed successfully");
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
    console.log("🧹 SyncService: Clearing local user data...");
    
    // Clear all language-specific progress data
    this.LANGUAGES.forEach((lang) => {
      localStorage.removeItem(`buttonStates_${lang}`);
      localStorage.removeItem(`repeatCounts_${lang}`);
      localStorage.removeItem(`categoryCompletionDates_${lang}`);
      localStorage.removeItem(`lastClickedPerCategory_${lang}`);
    });
    
    // Clear sync-related data
    localStorage.removeItem("lastSyncTime");
    localStorage.removeItem("pendingCloudSync");
    localStorage.removeItem("mc_premium_status_cache");
    localStorage.removeItem("openCategory");
    
    // Reset global state if available
    if (window.AppState) {
      window.AppState.buttonStates = {};
      window.AppState.repeatCounts = {};
      window.AppState.categoryCompletionDates = {};
      window.AppState.categoryCompleted = {};
      window.AppState.lastClickedPerCategory = {};
    }
    
    console.log("✅ SyncService: Local user data cleared");
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

    console.log("🔄 Auto-sync started (every 30s)");
  }

  /**
   * Stop automatic sync
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log("🔄 Auto-sync stopped");
    }
  }

  /**
   * Sync local data to Firestore
   */
  async syncToCloud(force = false) {
    const user = auth.currentUser;
    if (!user) {
      console.log("🔄 Cannot sync - no user logged in");
      return;
    }

    if (this.isSyncing && !force) {
      console.log("🔄 Sync already in progress, skipping...");
      return;
    }

    // CRITICAL: Verify localStorage data belongs to current user before syncing
    const storedUserId = localStorage.getItem("mc_current_user_id");
    if (storedUserId && storedUserId !== user.uid) {
      console.warn("⚠️ Cannot sync - localStorage data belongs to different user:", storedUserId);
      console.log("🔄 Clearing stale data and fetching from cloud...");
      this.clearLocalUserData();
      localStorage.setItem("mc_current_user_id", user.uid);
      await this.syncFromCloud(true);
      return;
    }

    // PROTECTION: Check if we have ANY local data before syncing
    // This prevents overwriting cloud data with empty localStorage
    let hasAnyLocalData = false;
    this.LANGUAGES.forEach((lang) => {
      const buttonStates = JSON.parse(
        localStorage.getItem(`buttonStates_${lang}`) || "{}"
      );
      if (Object.keys(buttonStates).length > 0) {
        hasAnyLocalData = true;
      }
    });

    if (!hasAnyLocalData) {
      console.log("🔄 No local data found - skipping sync to prevent data loss");
      console.log("🔄 Use syncFromCloud() to restore data from Firestore");
      return;
    }

    this.isSyncing = true;

    try {
      const userData = {
        userId: user.uid,
        email: user.email,
        displayName:
          user.displayName || user.email?.split("@")[0] || "Anonymous",
        lastSyncTime: new Date().toISOString(),
        languages: {},
      };

      // Collect data from all languages
      this.LANGUAGES.forEach((lang) => {
        const buttonStates = JSON.parse(
          localStorage.getItem(`buttonStates_${lang}`) || "{}"
        );
        const repeatCounts = JSON.parse(
          localStorage.getItem(`repeatCounts_${lang}`) || "{}"
        );
        const categoryCompletionDates = JSON.parse(
          localStorage.getItem(`categoryCompletionDates_${lang}`) || "{}"
        );

        userData.languages[lang] = {
          buttonStates,
          repeatCounts,
          categoryCompletionDates,
          wordCount: Object.keys(buttonStates).length,
          completedWords: Object.values(buttonStates).filter((s) => s.locked)
            .length,
        };
      });

      // Calculate total stats
      userData.stats = this.calculateStats(userData.languages);

      // Save to Firestore
      const userRef = doc(db, "users", user.uid);
      const syncTime = Date.now();

      await setDoc(
        userRef,
        {
          ...userData,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );

      this.lastSyncTime = syncTime;

      // Save local sync timestamp
      localStorage.setItem("lastSyncTime", syncTime.toString());

      console.log("✅ Synced to cloud:", userData.stats);
      
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
    if (!user) {
      console.log("🔄 Cannot sync from cloud - no user");
      return false;
    }

    try {
      console.log("🔄 Starting cloud sync for user:", user.uid);
      const userRef = doc(db, "users", user.uid);

      // Use getDocFromServer to bypass cache when forcing refresh
      let docSnap;
      if (forceServerFetch) {
        try {
          docSnap = await getDocFromServer(userRef);
          console.log("🔄 Fetched from server (bypassing cache)");
        } catch (serverError) {
          console.warn("🔄 Server fetch failed, trying cache:", serverError.message);
          docSnap = await getDoc(userRef);
        }
      } else {
        docSnap = await getDoc(userRef);
      }

      if (!docSnap.exists()) {
        console.log("🔄 No cloud data found - pushing local data to cloud");
        // User's first sync - push local data to cloud
        await this.syncToCloud(true);
        return true;
      }

      const cloudData = docSnap.data();
      const cloudSyncTime = new Date(cloudData.lastSyncTime || 0).getTime();
      const localSyncTime = parseInt(
        localStorage.getItem("lastSyncTime") || "0"
      );

      console.log("🔄 Cloud sync time:", new Date(cloudSyncTime).toISOString());
      console.log("🔄 Local sync time:", new Date(localSyncTime).toISOString());

      // If cloud is newer or we're forcing refresh, use cloud data
      if (forceServerFetch || cloudSyncTime > localSyncTime) {
        console.log("🔄 Cloud data is newer - updating local storage");

        // Merge strategy: newer data wins
        this.LANGUAGES.forEach((lang) => {
          if (cloudData.languages && cloudData.languages[lang]) {
            const cloudLang = cloudData.languages[lang];
            const localButtonStates = JSON.parse(
              localStorage.getItem(`buttonStates_${lang}`) || "{}"
            );

            // Merge: take cloud data but preserve any newer local changes
            const merged = this.mergeButtonStates(
              localButtonStates,
              cloudLang.buttonStates,
              cloudSyncTime,
              localSyncTime
            );

            // Save merged data
            localStorage.setItem(
              `buttonStates_${lang}`,
              JSON.stringify(merged)
            );

            // MERGE repeatCounts - take the HIGHER value for each category
            if (cloudLang.repeatCounts) {
              const localRepeatCounts = JSON.parse(
                localStorage.getItem(`repeatCounts_${lang}`) || "{}"
              );
              const mergedRepeatCounts = this.mergeRepeatCounts(localRepeatCounts, cloudLang.repeatCounts);
              localStorage.setItem(
                `repeatCounts_${lang}`,
                JSON.stringify(mergedRepeatCounts)
              );
            }

            // MERGE categoryCompletionDates - keep the best scores
            if (cloudLang.categoryCompletionDates) {
              const localCompletionDates = JSON.parse(
                localStorage.getItem(`categoryCompletionDates_${lang}`) || "{}"
              );
              const mergedCompletions = this.mergeCategoryCompletions(localCompletionDates, cloudLang.categoryCompletionDates);
              localStorage.setItem(
                `categoryCompletionDates_${lang}`,
                JSON.stringify(mergedCompletions)
              );
            }

            console.log(
              `✅ Synced ${lang} from cloud: ${
                Object.keys(merged).length
              } words`
            );
          }
        });

        // Save sync timestamp
        localStorage.setItem("lastSyncTime", cloudSyncTime.toString());
      } else {
        console.log("🔄 Local data is up-to-date");
      }

      // Reload state in app
      if (window.stateService) {
        window.stateService.loadButtonStates();
        console.log("✅ State reloaded after cloud sync");
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
      // Always keep the higher count - stars should never be lost
      merged[key] = Math.max(localCount, cloudCount);
    });
    
    console.log("🔄 Merged repeatCounts:", merged);
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
    
    console.log("🔄 Merged categoryCompletions:", Object.keys(merged).length, "entries");
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
    console.log("🔄 Force sync triggered");
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
        const buttonStates = JSON.parse(
          localStorage.getItem(`buttonStates_${lang}`) || "{}"
        );
        const repeatCounts = JSON.parse(
          localStorage.getItem(`repeatCounts_${lang}`) || "{}"
        );
        const categoryCompletionDates = JSON.parse(
          localStorage.getItem(`categoryCompletionDates_${lang}`) || "{}"
        );
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
          console.log("Could not fetch avatar from Firestore");
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

// /public/scripts/services/premiumService.js
// Premium status management - SIMPLIFIED

import { auth, db } from "../auth.js";
import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const CACHE_KEY = "mc_premium_status_cache";
const CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours
const TRIAL_DAYS = 7;

class PremiumService {
  constructor() {
    this.isPremiumUser = false;
    this.trialInfo = null;
    this.isCheckingStatus = false;
    this.isInitialized = false;

    this.hydrateFromCache();
    this.setupVisibilityHandler();
    this.setupIAPHandler();
  }

  // Restore status from localStorage when page becomes visible
  setupVisibilityHandler() {
    if (typeof document === "undefined") return;
    
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        this.hydrateFromCache();
      }
    });
  }

  setupIAPHandler() {
    if (typeof window === "undefined") return;

    window.addEventListener("iap:entitlementChanged", async (event) => {
      const hasPremiumEntitlement = Boolean(
        event?.detail?.hasPremiumEntitlement
      );

      if (!hasPremiumEntitlement) return;
      if (!auth.currentUser) return;

      try {
        const userDocRef = doc(db, "users", auth.currentUser.uid);
        await setDoc(
          userDocRef,
          {
            premium: true,
            premiumSource: "iap",
            premiumUpdatedAt: serverTimestamp(),
          },
          { merge: true }
        );

        this.trialInfo = { isActive: false, isPaid: true };
        this.isPremiumUser = true;
        window.isPremiumUser = true;

        this.persistStatus(auth.currentUser.uid, true);

        window.dispatchEvent(
          new CustomEvent("premiumStatusChanged", {
            detail: { isPremium: true },
          })
        );
      } catch (error) {
        console.error("Error syncing IAP premium status:", error);
      }
    });
  }

  // Load premium/trial status from localStorage
  hydrateFromCache() {
    if (typeof window === "undefined" || !window.localStorage) return;
    
    try {
      const raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw) return;
      
      const cached = JSON.parse(raw);
      if (!cached || Date.now() - cached.timestamp > CACHE_TTL) {
        window.localStorage.removeItem(CACHE_KEY);
        return;
      }

      // Check if trial is still active
      if (cached.trialEndDate) {
        const endDate = new Date(cached.trialEndDate);
        const daysLeft = Math.max(0, Math.ceil((endDate - new Date()) / (1000 * 60 * 60 * 24)));
        
        if (daysLeft > 0) {
          this.trialInfo = { isActive: true, daysLeft, endDate };
          this.isPremiumUser = true;
          window.isPremiumUser = true;
          return;
        }
      }
      
      // No trial - use cached status
      if (cached.status === true) {
        this.isPremiumUser = true;
        window.isPremiumUser = true;
      }
    } catch (error) {
      console.warn("Error hydrating premium cache", error);
    }
  }

  // Save status to localStorage
  persistStatus(uid, status) {
    if (!uid || typeof status !== "boolean") return;
    
    try {
      const payload = {
        uid,
        status,
        isPaidPremium: this.trialInfo?.isPaid === true,
        timestamp: Date.now(),
        trialEndDate: this.trialInfo?.endDate instanceof Date
          ? this.trialInfo.endDate.getTime()
          : this.trialInfo?.endDate || null,
      };
      window.localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
    } catch (error) {
      console.warn("Error caching premium status", error);
    }
  }

  // Clear cache on logout
  clearCache() {
    try {
      window.localStorage.removeItem(CACHE_KEY);
      this.isPremiumUser = false;
      this.trialInfo = null;
    } catch (error) {}
  }

  // Main method - get current premium status
  getPremiumStatus() {
    // Active trial = always premium
    if (this.trialInfo?.isActive) {
      return true;
    }
    if (typeof window.isPremiumUser === "boolean") {
      return window.isPremiumUser;
    }
    return this.isPremiumUser;
  }

  getTrialInfo() {
    return this.trialInfo;
  }

  // Check trial from Firestore user data
  checkTrialStatus(userData) {
    if (!userData.trialStartDate) {
      return { isActive: false, daysLeft: 0 };
    }

    const trialDays = userData.trialDays || TRIAL_DAYS;
    const startMs = userData.trialStartDate.toDate 
      ? userData.trialStartDate.toDate().getTime() 
      : new Date(userData.trialStartDate).getTime();
    
    const endMs = startMs + (trialDays * 24 * 60 * 60 * 1000);
    const msLeft = endMs - Date.now();
    const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));

    return msLeft > 0 
      ? { isActive: true, daysLeft, endDate: new Date(endMs) }
      : { isActive: false, daysLeft: 0, endDate: new Date(endMs) };
  }

  // Wait for premium status (used by sidebar)
  async waitForPremiumStatus(maxWait = 1000) {
    const startTime = Date.now();
    while (Date.now() - startTime < maxWait) {
      if (typeof window.isPremiumUser === "boolean") {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  // Check premium status from Firestore (called on login)
  async checkPremiumStatus(user) {
    if (this.isCheckingStatus) return this.isPremiumUser;
    this.isCheckingStatus = true;

    if (!user) {
      this.clearCache();
      this.isCheckingStatus = false;
      return false;
    }

    try {
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      
      let newStatus = false;

      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        
        if (userData.premium === true) {
          // Paid premium user
          newStatus = true;
          this.trialInfo = { isActive: false, isPaid: true };
        } else {
          // Check trial
          this.trialInfo = this.checkTrialStatus(userData);
          newStatus = this.trialInfo.isActive;
        }
      } else {
        // NEW USER - create document with trial
        const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`;
        
        await setDoc(userDocRef, {
          premium: false,
          trialStartDate: serverTimestamp(),
          trialDays: TRIAL_DAYS,
          createdAt: serverTimestamp(),
          avatarStyle: "adventurer",
          avatarSeed: user.uid,
          avatarUrl,
          displayName: user.displayName || user.email?.split("@")[0] || "Anonymous",
        }, { merge: true });
        
        newStatus = true;
        const endDate = new Date(Date.now() + TRIAL_DAYS * 24 * 60 * 60 * 1000);
        this.trialInfo = { isActive: true, daysLeft: TRIAL_DAYS, endDate };
      }

      this.isPremiumUser = newStatus;
      window.isPremiumUser = newStatus;
      this.persistStatus(user.uid, newStatus);
      
      // Notify other components
      window.dispatchEvent(new CustomEvent("premiumStatusChanged", {
        detail: { isPremium: newStatus }
      }));

    } catch (error) {
      console.error("Error checking premium status:", error);
    }

    this.isCheckingStatus = false;
    return this.isPremiumUser;
  }

  init() {
    if (this.isInitialized) return;
    this.isInitialized = true;
  }

  destroy() {
    this.isInitialized = false;
  }
}

export const premiumService = new PremiumService();
window.premiumService = premiumService;
premiumService.init();

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { setupUI } from "./index.js";
import { CONFIG } from "./utils/config.js";

// Trial duration constant
const TRIAL_DAYS = 7;
const REDDIT_REF_PARAM ="reddit_languages";
const REDDIT_REF_STORAGE_KEY ="reddit_ref";
const REDDIT_REF_AT_STORAGE_KEY ="reddit_ref_at";
const REDDIT_CUTOFF_DATE = new Date("2026-02-04T23:59:59Z");

// Capture Reddit ref from URL once and persist for signup/login flow
try {
 const urlParams = new URLSearchParams(window.location.search);
 const redditRef = urlParams.get("ref");
 if (redditRef === REDDIT_REF_PARAM) {
 localStorage.setItem(REDDIT_REF_STORAGE_KEY,"true");
 localStorage.setItem(REDDIT_REF_AT_STORAGE_KEY, new Date().toISOString());
 }
} catch (error) {
 console.warn("Failed to read ref param:", error);
}

export const app = initializeApp(CONFIG.firebase);
export const auth = getAuth(app);
export const db = getFirestore(app);

// Check if user has active trial
function hasActiveTrial(userData) {
 if (!userData || !userData.trialStartDate) return false;
  const trialDays = userData.trialDays || TRIAL_DAYS;
 let trialStart;
  // Handle Firestore timestamp
 if (userData.trialStartDate.toDate) {
 trialStart = userData.trialStartDate.toDate();
 } else if (userData.trialStartDate instanceof Date) {
 trialStart = userData.trialStartDate;
 } else {
 trialStart = new Date(userData.trialStartDate);
 }
  const trialEnd = new Date(trialStart.getTime() + trialDays * 24 * 60 * 60 * 1000);
 return new Date() < trialEnd;
}

function getDateValue(rawDate) {
 if (!rawDate) return null;
 if (rawDate.toDate) return rawDate.toDate();
 if (rawDate instanceof Date) return rawDate;
 const parsed = new Date(rawDate);
 return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function isRedditPromoEligible() {
 const refFlag = localStorage.getItem(REDDIT_REF_STORAGE_KEY) ==="true";
 const refAtRaw = localStorage.getItem(REDDIT_REF_AT_STORAGE_KEY);
 if (!refFlag || !refAtRaw) return false;
 const refAt = getDateValue(refAtRaw);
 if (!refAt) return false;
 return refAt <= REDDIT_CUTOFF_DATE;
}

// Simple email validation
function isValidEmail(email) {
 return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Simple password validation (min. 6 characters)
function isValidPassword(password) {
 return password.length >= 6;
}

// Auth state change handler
onAuthStateChanged(auth, async (user) => {
 if (user) {
 try {
 const userDocRef = doc(db,"users", user.uid);
 let userDocSnap = await getDoc(userDocRef);
 let userData = userDocSnap.exists() ? userDocSnap.data() : null;

 const redditRefActive = isRedditPromoEligible();
  // CRITICAL: Create user document with trial for NEW users
 if (!userData) {
 const avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${user.uid}`;
  await setDoc(userDocRef, {
 premium: redditRefActive ? true : false,
 trialStartDate: serverTimestamp(),
 trialDays: TRIAL_DAYS,
 createdAt: serverTimestamp(),
 avatarStyle:"adventurer",
 avatarSeed: user.uid,
 avatarUrl,
 displayName: user.displayName || user.email?.split("@")[0] ||"Anonymous",
 ...(redditRefActive
 ? {
 source:"reddit",
 redditGrantedAt: serverTimestamp(),
 }
 : {}),
 });
  // Re-fetch to get the created document with resolved timestamp
 userDocSnap = await getDoc(userDocRef);
 userData = userDocSnap.exists() ? userDocSnap.data() : {};
 }

 // If user came from Reddit during promo window, grant free access
 if (redditRefActive && userData?.premium !== true) {
 await setDoc(
 userDocRef,
 {
 premium: true,
 source:"reddit",
 redditGrantedAt: serverTimestamp(),
 },
 { merge: true }
 );
 userData = { ...userData, premium: true, source:"reddit" };
 }

 // Ensure trialStartDate exists for existing users without it
 if (userData && !userData.trialStartDate && userData.premium !== true) {
 const creationTime = user.metadata?.creationTime
 ? new Date(user.metadata.creationTime)
 : new Date();

 await setDoc(
 userDocRef,
 {
 trialStartDate: creationTime,
 trialDays: userData.trialDays || TRIAL_DAYS,
 },
 { merge: true }
 );

 userData.trialStartDate = creationTime;
 userData.trialDays = userData.trialDays || TRIAL_DAYS;
 }
  // Check premium status OR active trial
 const isPremium = userData.premium || hasActiveTrial(userData);
 const avatarData = {
 avatarStyle: userData.avatarStyle || 'adventurer',
 avatarSeed: userData.avatarSeed || user.uid,
 avatarUrl: userData.avatarUrl || null
 };
  // Store user ID for data isolation
 localStorage.setItem("mc_current_user_id", user.uid);
  // Set premium status globally for immediate access
 window.isPremiumUser = isPremium;
  // Cache premium status for fast loading
 try {
 let trialEndDate = null;
 if (userData.trialStartDate) {
 const trialDays = userData.trialDays || TRIAL_DAYS;
 let trialStart;
 if (userData.trialStartDate.toDate) {
 trialStart = userData.trialStartDate.toDate();
 } else {
 trialStart = new Date(userData.trialStartDate);
 }
 const trialEndMs = trialStart.getTime() + trialDays * 24 * 60 * 60 * 1000;
 trialEndDate = trialEndMs;
 }
 localStorage.setItem("mc_premium_status_cache", JSON.stringify({
 uid: user.uid,
 status: isPremium,
 isPaidPremium: userData.premium === true,
 timestamp: Date.now(),
 trialEndDate: trialEndDate
 }));
 } catch (e) {
 console.warn("Failed to cache premium status:", e);
 }
  // Dispatch event to notify components about premium status
 window.dispatchEvent(new CustomEvent("premiumStatusChanged", {
 detail: { isPremium: isPremium }
 }));
  setupUI(user, isPremium, avatarData);
 } catch (error) {
 console.error("Error fetching user data:", error);
  // Attempt to fallback to cache
 let usedCache = false;
 try {
 const cachedRaw = window.localStorage.getItem("mc_premium_status_cache");
 if (cachedRaw) {
 const cached = JSON.parse(cachedRaw);
 // Verify cache belongs to current user and is valid
 if (cached && cached.uid === user.uid && typeof cached.status ==="boolean") {
 setupUI(user, cached.status, { avatarStyle: 'adventurer', avatarSeed: user.uid });
 usedCache = true;
 }
 }
 } catch (cacheError) {
 console.warn("Error reading premium cache fallback:", cacheError);
 } // Fixed: closed brace for catch block

 if (!usedCache) {
 setupUI(user, false, { avatarStyle: 'adventurer', avatarSeed: user.uid });
 }
 }
 } else {
 setupUI(null);
 }
});

// --- Registration ---
const signupForm = document.querySelector("#signup-form");
if (signupForm) {
 const emailInput = signupForm["signup-email"];
 const passwordInput = signupForm["signup-password"];
 const emailError = document.createElement("div");
 emailError.className =" text-xs mt-1";
 emailInput.parentNode.appendChild(emailError);

 const passwordError = document.createElement("div");
 passwordError.className =" text-xs mt-1";
 passwordInput.parentNode.appendChild(passwordError);

 emailInput.addEventListener("input", () => {
 if (emailInput.value && !isValidEmail(emailInput.value)) {
 emailError.textContent ="Invalid email address.";
	emailInput.classList.add("bg-learning-app-design-4");
 } else {
 emailError.textContent ="";
	emailInput.classList.remove("bg-learning-app-design-4");
 }
 });

 passwordInput.addEventListener("input", () => {
 if (passwordInput.value && !isValidPassword(passwordInput.value)) {
 passwordError.textContent ="Password must be at least 6 characters.";
	passwordInput.classList.add("bg-learning-app-design-4");
 } else {
 passwordError.textContent ="";
	passwordInput.classList.remove("bg-learning-app-design-4");
 }
 });

 signupForm.addEventListener("submit", (e) => {
 e.preventDefault();
 const email = emailInput.value;
 const password = passwordInput.value;

 let valid = true;
 if (!isValidEmail(email)) {
 emailError.textContent ="Please enter a valid email address.";
	emailInput.classList.add("bg-learning-app-design-4");
 valid = false;
 }
 if (!isValidPassword(password)) {
 passwordError.textContent ="Password must be at least 6 characters.";
	passwordInput.classList.add("bg-learning-app-design-4");
 valid = false;
 }
 if (!valid) return;

 createUserWithEmailAndPassword(auth, email, password)
 .then((cred) => {
 // CRITICAL: Clear any previous user's data before setting up new user
 if (window.clearUserLocalData) {
 window.clearUserLocalData();
 }
  document.getElementById("modal-signup").checked = false;
 signupForm.reset();
 emailError.textContent ="";
 passwordError.textContent ="";
	emailInput.classList.remove("bg-learning-app-design-4");
	passwordInput.classList.remove("bg-learning-app-design-4");
  setTimeout(() => {
 window.location.reload();
 }, 500); // Small delay to let modal close smoothly
 })
 .catch((error) => {
 console.error("Error signing up:", error);
 passwordError.textContent ="Error:" + error.message;
 });
 });
}

// --- Login ---
const loginForm = document.querySelector("#login-form");
if (loginForm) {
 const emailInput = loginForm["login-email"];
 const passwordInput = loginForm["login-password"];
 const emailError = document.createElement("div");
 emailError.className =" text-xs mt-1";
 emailInput.parentNode.appendChild(emailError);

 const passwordError = document.createElement("div");
 passwordError.className =" text-xs mt-1";
 passwordInput.parentNode.appendChild(passwordError);

 emailInput.addEventListener("input", () => {
 if (emailInput.value && !isValidEmail(emailInput.value)) {
 emailError.textContent ="Invalid email address.";
	emailInput.classList.add("bg-learning-app-design-4");
 } else {
 emailError.textContent ="";
	emailInput.classList.remove("bg-learning-app-design-4");
 }
 });

 passwordInput.addEventListener("input", () => {
 passwordError.textContent ="";
	passwordInput.classList.remove("bg-learning-app-design-4");
 });

 loginForm.addEventListener("submit", (e) => {
 e.preventDefault();
 const email = emailInput.value;
 const password = passwordInput.value;

 let valid = true;
 if (!isValidEmail(email)) {
 emailError.textContent ="Please enter a valid email address.";
	emailInput.classList.add("bg-learning-app-design-4");
 valid = false;
 }
 if (!isValidPassword(password)) {
 passwordError.textContent ="Password must be at least 6 characters.";
	passwordInput.classList.add("bg-learning-app-design-4");
 valid = false;
 }
 if (!valid) return;

 signInWithEmailAndPassword(auth, email, password)
 .then((cred) => {
 // Check if different user is logging in - clear old data
 const previousUserId = localStorage.getItem("mc_current_user_id");
 if (previousUserId && previousUserId !== cred.user.uid) {
 if (window.clearUserLocalData) {
 window.clearUserLocalData();
 }
 }
  document.getElementById("modal-login").checked = false;
 loginForm.reset();
 emailError.textContent ="";
 passwordError.textContent ="";
	emailInput.classList.remove("bg-learning-app-design-4");
	passwordInput.classList.remove("bg-learning-app-design-4");
  setTimeout(() => {
 window.location.reload();
 }, 500); // Small delay to let modal close smoothly
 })
 .catch((error) => {
 console.error("Error logging in:", error);
 passwordError.textContent ="Error:" + error.message;
 });
 });
}

// --- Password Reset ---
const forgotPasswordForm = document.querySelector("#forgot-password-form");
if (forgotPasswordForm) {
 const emailInput = forgotPasswordForm["forgot-password-email"];
 const emailError = document.createElement("div");
 emailError.className =" text-xs mt-1";
 emailInput.parentNode.appendChild(emailError);

 emailInput.addEventListener("input", () => {
 if (emailInput.value && !isValidEmail(emailInput.value)) {
 emailError.textContent ="Invalid email address.";
	emailInput.classList.add("bg-learning-app-design-4");
 } else {
 emailError.textContent ="";
	emailInput.classList.remove("bg-learning-app-design-4");
 }
 });

 forgotPasswordForm.addEventListener("submit", (e) => {
 e.preventDefault();
 const email = emailInput.value;

 if (!isValidEmail(email)) {
 emailError.textContent ="Please enter a valid email address.";
	emailInput.classList.add("bg-learning-app-design-4");
 return;
 }

 sendPasswordResetEmail(auth, email)
 .then(() => {
 alert("Password reset email has been sent!");
 document.getElementById("modal-forgot-password").checked = false;
 forgotPasswordForm.reset();
 emailError.textContent ="";
	emailInput.classList.remove("bg-learning-app-design-4");
 })
 .catch((error) => {
 console.error("Error sending password reset email:", error);
 alert("Error:" + error.message);
 });
 });
}

const logoutBtns = [
 document.getElementById("logout"),
 document.getElementById("logout-mobile")
].filter(Boolean);

logoutBtns.forEach((btn) => {
 btn.addEventListener("click", (e) => {
 e.preventDefault();
 signOut(auth)
 .then(() => {
 // CRITICAL: Clear all user data from localStorage on logout
 // This prevents data bleeding between users on the same browser
 clearUserLocalData();
 window.location.href ="/"; // Redirect to home page after logout
 })
 .catch((error) => {
 console.error("Error signing out:", error);
 });
 });
});

/**
 * Clear all user-specific data from localStorage
 * Called on logout and before new user login to prevent data mixing
 */
function clearUserLocalData() {
 const LANGUAGES = ["es","de","fr","ru","zh","ja","ko","it"];
  // Clear all language-specific progress data
 LANGUAGES.forEach((lang) => {
 localStorage.removeItem(`buttonStates_${lang}`);
 localStorage.removeItem(`repeatCounts_${lang}`);
 localStorage.removeItem(`categoryCompletionDates_${lang}`);
 localStorage.removeItem(`lastClickedPerCategory_${lang}`);
 });
  // Clear sync-related data
 localStorage.removeItem("lastSyncTime");
 localStorage.removeItem("pendingCloudSync");
 localStorage.removeItem("mc_premium_status_cache");
 localStorage.removeItem("mc_menu_avatar");
 localStorage.removeItem("mc_auth_state");
 localStorage.removeItem("openCategory");
  // Reset global state if available
 if (window.AppState) {
 window.AppState.buttonStates = {};
 window.AppState.repeatCounts = {};
 window.AppState.categoryCompletionDates = {};
 window.AppState.categoryCompleted = {};
 }
}

// Export for use in other modules
window.clearUserLocalData = clearUserLocalData;
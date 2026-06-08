// /public/scripts/pages/profile.js
// Profile page functionality - display name and avatar generator

import { auth, db } from"../auth.js";
import { doc, getDoc, setDoc, serverTimestamp } from"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { updateProfile } from"https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

class ProfileManager {
 constructor() {
 this.currentAvatarSeed = null;
 this.currentAvatarStyle ="adventurer";
 this.elements = {};
 this.init();
 }

 init() {
 // Wait for DOM and auth
 if (document.readyState ==="loading") {
 document.addEventListener("DOMContentLoaded", () => this.setup());
 } else {
 this.setup();
 }
 }

 setup() {
 // Cache DOM elements
 this.elements = {
 loading: document.getElementById("profile-loading"),
 loginRequired: document.getElementById("login-required"),
 content: document.getElementById("profile-content"),
 avatarPreview: document.getElementById("current-avatar"),
 avatarStyle: document.getElementById("avatar-style"),
 generateBtn: document.getElementById("generate-avatar-btn"),
 displayNameInput: document.getElementById("display-name-input"),
 saveBtn: document.getElementById("save-profile-btn"),
 userEmail: document.getElementById("user-email"),
 accountType: document.getElementById("account-type"),
 trialInfoRow: document.getElementById("trial-info-row"),
 trialStatus: document.getElementById("trial-status"),
 memberSince: document.getElementById("member-since"),
 saveSuccess: document.getElementById("save-success"),
 saveError: document.getElementById("save-error"),
 errorMessage: document.getElementById("error-message"),
 pageStatus: document.getElementById("profile-page-status"),
 };

 this.showLoading();

 // Listen for auth state
 auth.onAuthStateChanged((user) => this.handleAuthState(user));

 // Setup event listeners
 this.setupEventListeners();
 }

 setupEventListeners() {
 // Avatar style change
 this.elements.avatarStyle?.addEventListener("change", (e) => {
 this.currentAvatarStyle = e.target.value;
 this.generateAvatar();
 });

 // Generate random avatar
 this.elements.generateBtn?.addEventListener("click", () => {
 this.currentAvatarSeed = this.generateRandomSeed();
 this.generateAvatar();
 });

 // Save profile
 this.elements.saveBtn?.addEventListener("click", () => this.saveProfile());

 // Validate display name input
 this.elements.displayNameInput?.addEventListener("input", (e) => {
 // Only allow letters, numbers, spaces
 e.target.value = e.target.value.replace(/[^a-zA-Z0-9\s]/g,"").slice(0, 20);
 });
 }

 async handleAuthState(user) {
 this.hideAllSections();
 this.hidePageStatus();

 if (!user) {
 this.elements.loginRequired.classList.remove("hidden");
 return;
 }

 this.showLoading();
 const loaded = await this.loadUserProfile(user);

 // Loading is finished at this point, regardless of result.
 this.elements.loading?.classList.add("hidden");

 if (loaded) {
 this.elements.content.classList.remove("hidden");
 return;
 }

 this.showPageStatus("Could not load your profile data. Pull to refresh or try again.","error");
 this.elements.loginRequired.classList.remove("hidden");
 }

 hideAllSections() {
 this.elements.loading?.classList.add("hidden");
 this.elements.loginRequired?.classList.add("hidden");
 this.elements.content?.classList.add("hidden");
 this.elements.saveSuccess?.classList.add("hidden");
 this.elements.saveError?.classList.add("hidden");
 }

 showLoading() {
 this.hideAllSections();
 this.elements.loading?.classList.remove("hidden");
 }

 showPageStatus(message, tone ="info") {
 if (!this.elements.pageStatus) return;

 const toneClass =
 tone ==="error"
 ?"bg-learning-app-design-1"
 : tone ==="success"
 ?"bg-learning-app-design-5"
 :"bg-learning-app-design-1";

 this.elements.pageStatus.className = `mb-4 rounded-lg px-4 py-3 text-sm ${toneClass}`;
 this.elements.pageStatus.textContent = message;
 this.elements.pageStatus.classList.remove("hidden");
 }

 hidePageStatus() {
 this.elements.pageStatus?.classList.add("hidden");
 }

 async loadUserProfile(user) {
 try {
 // Set email
 this.elements.userEmail.textContent = user.email;

 // Set member since
 const creationTime = user.metadata?.creationTime;
 if (creationTime) {
 const date = new Date(creationTime);
 this.elements.memberSince.textContent = date.toLocaleDateString("en-US", {
 year:"numeric",
 month:"long",
 day:"numeric",
 });
 }

 // Load profile from Firestore
 const userRef = doc(db,"users", user.uid);
 const docSnap = await getDoc(userRef);

 if (docSnap.exists()) {
 const data = docSnap.data();

 // Set display name
 const displayName = data.displayName || user.displayName || user.email?.split("@")[0] ||"";
 this.elements.displayNameInput.value = displayName;

 // Set avatar
 if (data.avatarStyle) {
 this.currentAvatarStyle = data.avatarStyle;
 this.elements.avatarStyle.value = data.avatarStyle;
 }
 if (data.avatarSeed) {
 this.currentAvatarSeed = data.avatarSeed;
 } else {
 // Generate seed from user ID for consistency
 this.currentAvatarSeed = user.uid;
 }

 // Check premium status and trial
 const isPremium = data.premium || false;

 // Fallback: use auth creationTime if trialStartDate is missing
 if (!data.trialStartDate && user.metadata?.creationTime) {
 data.trialStartDate = new Date(user.metadata.creationTime);
 data.trialDays = data.trialDays || 7;
 }

 this.updateAccountTypeUI(isPremium, data, user);
 } else {
 // New user - create document with trial and defaults
 const avatarUrl = `https://api.dicebear.com/7.x/${this.currentAvatarStyle}/svg?seed=${user.uid}`;
 await setDoc(
 userRef,
 {
 premium: false,
 trialStartDate: serverTimestamp(),
 trialDays: 7,
 createdAt: serverTimestamp(),
 avatarStyle: this.currentAvatarStyle,
 avatarSeed: user.uid,
 avatarUrl,
 displayName: user.displayName || user.email?.split("@")[0] ||"Anonymous",
 },
 { merge: true }
 );

 const refreshedSnap = await getDoc(userRef);
 const refreshedData = refreshedSnap.exists() ? refreshedSnap.data() : {};

 this.elements.displayNameInput.value = refreshedData.displayName || user.displayName || user.email?.split("@")[0] ||"";
 this.currentAvatarSeed = refreshedData.avatarSeed || user.uid;
 this.currentAvatarStyle = refreshedData.avatarStyle || this.currentAvatarStyle;
 this.updateAccountTypeUI(false, refreshedData, user);
 }

 // Generate avatar with loaded settings
 this.generateAvatar();

 return true;

 } catch (error) {
 console.error("Error loading profile:", error);
 return false;
 }
 }

 generateRandomSeed() {
 return Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
 }

 generateAvatar() {
 if (!this.currentAvatarSeed) {
 this.currentAvatarSeed = this.generateRandomSeed();
 }

 // Use DiceBear API for avatars
 const avatarUrl = `https://api.dicebear.com/7.x/${this.currentAvatarStyle}/svg?seed=${this.currentAvatarSeed}`;
  if (this.elements.avatarPreview) {
 this.elements.avatarPreview.src = avatarUrl;
 }
 }

 async saveProfile() {
 const user = auth.currentUser;
 if (!user) return;

 const displayName = this.elements.displayNameInput.value.trim();
 this.hidePageStatus();

 // Validate display name
 if (displayName.length < 2) {
 this.showError("Display name must be at least 2 characters.");
 return;
 }

 if (displayName.length > 20) {
 this.showError("Display name must be 20 characters or less.");
 return;
 }

 // Disable save button
 this.elements.saveBtn.disabled = true;
 this.elements.saveBtn.classList.add("opacity-70","cursor-wait");
 this.elements.saveBtn.innerHTML = `
 <span class="loading loading-spinner loading-sm"></span>
 Saving...
 `;

 try {
 // Update Firebase Auth profile
 await updateProfile(user, {
 displayName: displayName,
 photoURL: `https://api.dicebear.com/7.x/${this.currentAvatarStyle}/svg?seed=${this.currentAvatarSeed}`,
 });

 // Update Firestore
 const userRef = doc(db,"users", user.uid);
 await setDoc(userRef, {
 displayName: displayName,
 avatarStyle: this.currentAvatarStyle,
 avatarSeed: this.currentAvatarSeed,
 avatarUrl: `https://api.dicebear.com/7.x/${this.currentAvatarStyle}/svg?seed=${this.currentAvatarSeed}`,
 updatedAt: serverTimestamp(),
 }, { merge: true });

 // Show success
 this.showSuccess();

 // Update menu avatar if exists
 this.updateMenuAvatar();

 // Update leaderboard with new avatar
 if (window.syncService && typeof window.syncService.updateLeaderboard === 'function') {
 await window.syncService.updateLeaderboard();
 }

 } catch (error) {
 console.error("Error saving profile:", error);
 this.showError("Error saving profile. Please try again.");
 } finally {
 // Re-enable save button
 this.elements.saveBtn.disabled = false;
 this.elements.saveBtn.classList.remove("opacity-70","cursor-wait");
 this.elements.saveBtn.innerHTML = `
 <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
 <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
 </svg>
 Save Changes
 `;
 }
 }

 updateMenuAvatar() {
 // Update avatar in navigation menu using global function
 const avatarUrl = `https://api.dicebear.com/7.x/${this.currentAvatarStyle}/svg?seed=${this.currentAvatarSeed}`;
 if (window.updateMenuAvatar) {
 const avatarData = {
 avatarStyle: this.currentAvatarStyle,
 avatarSeed: this.currentAvatarSeed,
 avatarUrl: avatarUrl
 };
 window.updateMenuAvatar(auth.currentUser, avatarData);
 }
 // Update global currentUser so home page renders fresh avatar
 if (window.currentUser) {
 window.currentUser.avatarUrl = avatarUrl;
 }
 // Mark cache as fresh profile save so auth won't overwrite with stale Firestore data
 try {
 localStorage.setItem('mc_menu_avatar', JSON.stringify({
 uid: auth.currentUser?.uid,
 avatarUrl: avatarUrl,
 savedAt: Date.now()
 }));
 } catch (e) {}
 }

 showSuccess() {
 this.elements.saveError?.classList.add("hidden");
 this.elements.saveSuccess?.classList.remove("hidden");
  // Auto-hide after 3 seconds
 setTimeout(() => {
 this.elements.saveSuccess?.classList.add("hidden");
 }, 3000);
 }

 showError(message) {
 this.elements.saveSuccess?.classList.add("hidden");
 if (this.elements.errorMessage) {
 this.elements.errorMessage.textContent = message;
 }
 this.elements.saveError?.classList.remove("hidden");
  // Auto-hide after 5 seconds
 setTimeout(() => {
 this.elements.saveError?.classList.add("hidden");
 }, 5000);
 }

 /**
 * Update Account Type UI with premium and trial status
 */
 updateAccountTypeUI(isPremium, userData, user) {
 const TRIAL_DAYS = 7;
  if (isPremium) {
 // Paid premium user
 this.elements.accountType.textContent ="Premium";
 this.elements.accountType.className ="text-sm font-semibold";
 this.elements.trialInfoRow?.classList.add("hidden");
 } else {
 // Free user - check trial
 this.elements.accountType.textContent ="Free";
 this.elements.accountType.className ="text-sm font-semibold";
  const toDateSafe = (value) => {
 if (!value) return null;
 if (value.toDate) return value.toDate();
 if (value instanceof Date) return value;
 const parsed = new Date(value);
 return Number.isNaN(parsed.getTime()) ? null : parsed;
 };

 const trialDays = userData.trialDays || TRIAL_DAYS;
 const trialStartDate = toDateSafe(userData.trialStartDate) || toDateSafe(userData.createdAt);
 const accountCreatedAt = toDateSafe(user?.metadata?.creationTime);
 const effectiveStartDate = accountCreatedAt && trialStartDate
 ? (trialStartDate > accountCreatedAt ? accountCreatedAt : trialStartDate)
 : (trialStartDate || accountCreatedAt);

 if (effectiveStartDate) {
 const trialStartMs = effectiveStartDate.getTime();
  const trialEndMs = trialStartMs + (trialDays * 24 * 60 * 60 * 1000);
 const now = Date.now();
 const msLeft = trialEndMs - now;
 const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));

 if (msLeft > 0) {
 // Trial active
 this.elements.trialInfoRow?.classList.remove("hidden");
 this.elements.trialStatus.textContent = `${daysLeft} day${daysLeft !== 1 ? 's' : ''} left`;
 this.elements.trialStatus.className ="text-sm font-semibold";
 } else {
 // Trial expired
 this.elements.trialInfoRow?.classList.remove("hidden");
 this.elements.trialStatus.textContent ="Expired";
 this.elements.trialStatus.className ="text-sm font-semibold";
 }
 } else {
 // No trial data (old user before trial feature)
 this.elements.trialInfoRow?.classList.add("hidden");
 }
 }
 }
}

// Initialize profile manager
const profileManager = new ProfileManager();
export { profileManager };

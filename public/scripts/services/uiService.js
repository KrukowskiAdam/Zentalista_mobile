// /public/scripts/services/uiService.js
// UI rendering and management service

import { createElement } from"../utils/helpers.js";
import { stateService } from"./stateService.js";
import { dataService } from"./dataService.js";
import { premiumService } from"./premiumService.js";
import { languageService } from"./languageService.js";
import { db } from"../auth.js";
import { CardComponent } from"../components/cardComponent.js";
import { SidebarComponent } from"../components/sidebarComponent.js";
import { ProgressBarComponent } from"../components/progressBarComponent.js";
import {
  collection,
  getDocs,
  query,
  orderBy,
  limit,
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

class UIService {
 constructor() {
 this.cardComponent = new CardComponent();
 this.sidebarComponent = new SidebarComponent();
 this.progressBarComponent = new ProgressBarComponent();
 this._leaderboardRankCache = null;
 this._renderVersion = 0;
 }

 async fetchLeaderboardRank() {
 if (this._leaderboardRankCache !== null) return this._leaderboardRankCache;
 try {
 const currentUser = window.currentUser || null;
 if (!currentUser) return null;
 const q = query(collection(db, "leaderboard"), orderBy("totalPoints", "desc"), limit(200));
 const snapshot = await getDocs(q);
 const entries = [];
 snapshot.forEach((doc) => entries.push({ id: doc.id, ...doc.data() }));
 const idx = entries.findIndex((e) => e.userId === currentUser.uid || e.id === currentUser.uid);
 const rank = idx >= 0 ? idx + 1 : null;
 this._leaderboardRankCache = rank;
 return rank;
 } catch (e) {
 return null;
 }
 }

 getLearnHomeStats() {
 const currentLangCode = languageService.getCurrentLanguage();
 const currentLang = languageService.getLanguageDetails(currentLangCode);
 const isPremiumUser = premiumService.getPremiumStatus();
 const buttonStates = Object.values(stateService.buttonStates || {});
 const repeatCountsByCategory = stateService.repeatCounts || {};
 const repeatCounts = Object.values(repeatCountsByCategory);
 const completionDates = stateService.categoryCompletionDates || {};
 const availableCategories = (dataService.categories || []).filter(
 (category) => isPremiumUser || category.source ==="free"
 );

 const lockedWords = buttonStates.filter((state) => state?.locked).length;
 const completedCategories = repeatCounts.filter(
 (value) => Number(value) > 0
 ).length;
 const totalCategories = availableCategories.length;
 const categoryProgress = totalCategories
 ? Math.min(100, Math.round((completedCategories / totalCategories) * 100))
 : 0;

 const now = Date.now();
 const dayMs = 24 * 60 * 60 * 1000;
 const todayIso = new Date().toISOString().slice(0, 10);
 const completionEntries = Object.entries(repeatCountsByCategory).map(
 ([key, repeatCount]) => [key, completionDates[key] || {}, Number(repeatCount) || 0]
 );

 const newCategoryDoneToday = completionEntries.some(([key, meta, repeatCount]) => {
 if (!meta?.lastCompletedAt) return false;
 const lastDay = String(meta.lastCompletedAt).slice(0, 10);
 if (lastDay !== todayIso) return false;
 return repeatCount === 1;
 });

 const reviewDoneToday = completionEntries.some(([, meta]) => {
 if (!meta?.lastCompletedAt || !meta?.previousCompletedAt) return false;
 const lastDay = String(meta.lastCompletedAt).slice(0, 10);
 if (lastDay !== todayIso) return false;
 const lastTs = new Date(meta.lastCompletedAt).getTime();
 const prevTs = new Date(meta.previousCompletedAt).getTime();
 return Number.isFinite(lastTs) && Number.isFinite(prevTs) && lastTs - prevTs >= dayMs;
 });

 // --- Review status: replicate exact stats page computation ---
 // Step 1: Count total words per category (same as stats fillTotalWords)
 const totalWordsPerCat = {};
 for (const word of (dataService.allWords || [])) {
 const key = `${word.source}::${word.category}`;
 totalWordsPerCat[key] = (totalWordsPerCat[key] || 0) + 1;
 }

 // Step 2: Count locked words + find latest click per category (same as stats fillUserProgress)
 const lockedPerCat = {};
 const latestClickPerCat = {};
 for (const state of Object.values(stateService.buttonStates || {})) {
 if (!state?.locked || !state?.source || !state?.category) continue;
 const key = `${state.source}::${state.category}`;
 lockedPerCat[key] = (lockedPerCat[key] || 0) + 1;
 const clicks = state.clicks || [];
 if (clicks.length > 0) {
 const lastClick = clicks[clicks.length - 1].timestamp || 0;
 if (lastClick > (latestClickPerCat[key] || 0)) {
 latestClickPerCat[key] = lastClick;
 }
 }
 }

 // Step 3: For each completed category, get completionDate exactly like stats page
 const COOLDOWN_MS = dayMs; // 24h
 const reviewCandidates = []; // { key, source, category, hoursLeft, canRepeat }

 for (const key of Object.keys(repeatCountsByCategory)) {
 if (Number(repeatCountsByCategory[key]) <= 0) continue;
 const total = totalWordsPerCat[key] || 0;
 const locked = lockedPerCat[key] || 0;
 const isFullyComplete = total > 0 && locked === total;
 if (!isFullyComplete) continue;

 // Get completionDate same way as stats page (lines 960-985 of stats.ejs)
 const completionEntry = completionDates[key];
 let completionDate = null;

 if (typeof completionEntry === "number") {
 completionDate = completionEntry;
 } else if (typeof completionEntry === "string") {
 const parsed = Date.parse(completionEntry);
 completionDate = Number.isFinite(parsed) ? parsed : null;
 } else if (completionEntry && typeof completionEntry === "object") {
 if (completionEntry.lastLockedDate) {
 completionDate = completionEntry.lastLockedDate;
 } else if (completionEntry.completedAt) {
 const parsed = Date.parse(completionEntry.completedAt);
 completionDate = Number.isFinite(parsed) ? parsed : null;
 }
 }

 // Fallback to word-click timestamp (same as stats: stats.lastLockedDate)
 if (!completionDate && latestClickPerCat[key]) {
 completionDate = latestClickPerCat[key];
 }

 // Parse if string (same as stats line 983-986)
 if (completionDate && typeof completionDate !== "number") {
 const parsed = Date.parse(completionDate);
 completionDate = Number.isFinite(parsed) ? parsed : null;
 }

 const parts = key.split("::");
 const source = parts[0];
 const category = parts.slice(1).join("::");

 if (!completionDate) {
 // No timestamp at all → treat as overdue (ready now)
 reviewCandidates.push({ key, source, category, hoursLeft: 0, canRepeat: true });
 continue;
 }

 const elapsed = now - completionDate;
 const canRepeat = elapsed >= COOLDOWN_MS;
 const hoursLeft = canRepeat ? 0 : Math.ceil((COOLDOWN_MS - elapsed) / (1000 * 60 * 60));
 reviewCandidates.push({ key, source, category, hoursLeft, canRepeat });
 }

 // Pick best: first any that canRepeat (oldest first), else smallest hoursLeft
 reviewCandidates.sort((a, b) => {
 if (a.canRepeat && !b.canRepeat) return -1;
 if (!a.canRepeat && b.canRepeat) return 1;
 return a.hoursLeft - b.hoursLeft;
 });

 const bestReview = reviewCandidates[0] || null;
 const lastLearnedCategory = bestReview?.category || null;
 const lastLearnedSource = bestReview?.source || null;
 const lastLearnedCanRepeat = bestReview?.canRepeat || false;
 const lastLearnedHoursLeft = bestReview?.hoursLeft || 0;

 const reviewDueCount = reviewCandidates.filter(c => c.canRepeat).length;

 const dailyPlanCompletedCount = Number(newCategoryDoneToday) + Number(reviewDoneToday);
 const dailyPlanGoalCount = 2;
 const dailyPlanProgress = Math.round((dailyPlanCompletedCount / dailyPlanGoalCount) * 100);
 const repeatGoalCompletedCount = Number(reviewDoneToday);
 const repeatGoalCount = 1;
 const repeatGoalProgress = Math.round((repeatGoalCompletedCount / repeatGoalCount) * 100);
 const newGoalCompletedCount = Number(newCategoryDoneToday);
 const newGoalCount = 1;
 const newGoalProgress = Math.round((newGoalCompletedCount / newGoalCount) * 100);
 const currentUser = window.currentUser || null;
 const displayName =
 currentUser?.displayName ||
 currentUser?.email?.split("@")[0] ||
"Learner";
 const continueCategory =
 stateService.categoryFilter || availableCategories[0]?.name ||"Your first category";

 // --- Next new category (never completed) ---
 const completedKeys = new Set(
 Object.entries(repeatCountsByCategory)
 .filter(([, v]) => Number(v) > 0)
 .map(([k]) => k)
 );

 // Check if a category has been started (any word clicked but not fully locked)
 const isStarted = (catName) => Object.values(stateService.buttonStates || {}).some(
 (s) => s?.category === catName && (s?.count || 0) > 0
 );

 const nextNewCatObj = availableCategories.find((cat) => {
 const key = `${cat.source}::${cat.name}`;
 return !completedKeys.has(key) && !isStarted(cat.name);
 });
 const nextNewCategory = nextNewCatObj?.name || null;
 const nextNewCategorySource = nextNewCatObj?.source || null;
 const nextNewCategoryStarted = false;

 // In-progress category: started but not completed — pick closest to completion
 const inProgressCandidates = availableCategories.filter((cat) => {
 const key = `${cat.source}::${cat.name}`;
 return !completedKeys.has(key) && isStarted(cat.name);
 });
 let inProgressCatObj = null;
 if (inProgressCandidates.length > 0) {
 inProgressCatObj = inProgressCandidates.reduce((best, cat) => {
 const key = `${cat.source}::${cat.name}`;
 const total = totalWordsPerCat[key] || 1;
 const locked = lockedPerCat[key] || 0;
 const progress = locked / total;
 const bestKey = `${best.source}::${best.name}`;
 const bestTotal = totalWordsPerCat[bestKey] || 1;
 const bestLocked = lockedPerCat[bestKey] || 0;
 const bestProgress = bestLocked / bestTotal;
 return progress > bestProgress ? cat : best;
 });
 }
 const inProgressCategory = inProgressCatObj?.name || null;
 const inProgressCategorySource = inProgressCatObj?.source || null;

 // --- Challenges done (bestScore > 0) ---
 const challengesDone = Object.values(completionDates).filter(
 (meta) => (meta?.bestScore || 0) > 0
 ).length;

 // --- Per-language stats across all languages ---
 const allLangsStats = languageService.languages.map(lang => {
 try {
 const rc = JSON.parse(localStorage.getItem(`repeatCounts_${lang.code}`) || '{}');
 const cd = JSON.parse(localStorage.getItem(`categoryCompletionDates_${lang.code}`) || '{}');
 const bs = JSON.parse(localStorage.getItem(`buttonStates_${lang.code}`) || '{}');
 const completedCats = Object.values(rc).filter(v => Number(v) > 0).length;
 const challengesDoneLang = Object.values(cd).filter(meta => (meta?.bestScore || 0) > 0).length;
 const hasAnyInteraction = Object.keys(bs).length > 0 || completedCats > 0 || challengesDoneLang > 0;
 return { code: lang.code, name: lang.name, flag: lang.flag, completedCats, challengesDoneLang, hasAnyInteraction };
 } catch(e) {
      return { code: lang.code, name: lang.name, flag: lang.flag, completedCats: 0, challengesDoneLang: 0, hasAnyInteraction: false };
 }
 }).filter(l => l.hasAnyInteraction);

 return {
 displayName,
 continueCategory,
 lockedWords,
 completedCategories,
 totalCategories,
 categoryProgress,
 newCategoryDoneToday,
 reviewDoneToday,
 reviewDueCount,
 dailyPlanCompletedCount,
 dailyPlanGoalCount,
 dailyPlanProgress,
 repeatGoalCompletedCount,
 repeatGoalCount,
 repeatGoalProgress,
 newGoalCompletedCount,
 newGoalCount,
 newGoalProgress,
 langCode: currentLangCode,
 langName: currentLang?.name || currentLangCode,
 langFlag: currentLang?.flag || "",
 lastLearnedCategory,
 lastLearnedSource,
 lastLearnedCanRepeat,
 lastLearnedHoursLeft,
 inProgressCategory,
 inProgressCategorySource,
 nextNewCategory,
 nextNewCategorySource,
 challengesDone,
 allLangsStats,
 };
 }

 async renderLearnHomeOverview(mainContent, renderVersion) {
 const stats = this.getLearnHomeStats();
 const safeName = String(stats.displayName).replace(/[<>]/g,"");

 const rank = await this.fetchLeaderboardRank();

 // If a newer render was triggered while we awaited, abort this one
 if (renderVersion !== undefined && renderVersion !== this._renderVersion) return;

 const rankDisplay = rank ? `#${rank}` : "—";

 // Clear any content inserted by a prior concurrent render
 mainContent.innerHTML = "";

 let avatarUrl = null;
 if (window.currentUser?.avatarUrl) {
 avatarUrl = window.currentUser.avatarUrl;
 }
 if (!avatarUrl) {
 try {
 const cached = localStorage.getItem("mc_menu_avatar");
 if (cached) avatarUrl = JSON.parse(cached).avatarUrl || null;
 } catch (e) {}
 }
 if (!avatarUrl && window.currentUser?.uid) {
 avatarUrl = `https://api.dicebear.com/7.x/adventurer/svg?seed=${window.currentUser.uid}`;
 }
 const avatarHtml = avatarUrl
 ? `<img src="${avatarUrl}" alt="avatar" class="w-10 h-10 rounded-full object-cover flex-shrink-0" />`
 : `<div class="w-10 h-10 rounded-full bg-learning-app-design-4 flex items-center justify-center flex-shrink-0 text-sm font-bold">${safeName.charAt(0).toUpperCase()}</div>`;

 // Pre-compute multi-language stats rows
 const allRows = stats.allLangsStats.length > 0
 ? stats.allLangsStats
   : [{ name: stats.langName, flag: stats.langFlag, completedCats: stats.completedCategories, challengesDoneLang: stats.challengesDone }];
 const learningStatsRows = allRows.map(l =>
 '<div class="flex items-center gap-3 px-4 pb-3">'
 + '<div class="flex-1 min-w-0"><p class="mt-2 text-xs flex items-center gap-2">'
 + '<span class="inline-flex w-5 h-5 rounded-full overflow-hidden flex-shrink-0">' + l.flag + '</span>'
 + l.name + '</p></div>'
 + '<div class="flex-shrink-0 text-right"><p class="text-xs opacity-50">Categories</p><p class="text-xs">' + l.completedCats + '</p></div>'
 + '</div>'
 ).join('');
 const challengeStatsRows = allRows.map(l =>
 '<div class="flex items-center gap-3 px-4 pb-3">'
 + '<div class="flex-1 min-w-0"><p class="mt-2 text-xs flex items-center gap-2">'
 + '<span class="inline-flex w-5 h-5 rounded-full overflow-hidden flex-shrink-0">' + l.flag + '</span>'
 + l.name + '</p></div>'
 + '<div class="flex-shrink-0 text-right"><p class="text-xs opacity-50">Done / Available</p><p class="text-xs">' + l.challengesDoneLang + '/' + l.completedCats + '</p></div>'
 + '</div>'
 ).join('');

 const overview = createElement("section", {
 id:"learn-home-overview",
 className:"w-full px-4 pt-5 pb-3",
 parent: mainContent,
 });

 overview.innerHTML = `
 <div class="mx-auto max-w-4xl space-y-4">

 <!-- Welcome card -->
 <div id="home-welcome-card" class="rounded-xl bg-learning-app-design-1 p-4 shadow-card">
 <p class="text-xl font-semibold mb-1 mt-2">${window.currentUser ? 'Welcome back' : 'Learn languages faster than ever with <span class="text-level-expert">Zentalist</span>'}</p>
 <p class="text-sm opacity-70 mb-6">${window.currentUser ? 'Keep your streak alive — learn, challenge, and rank up' : 'A unique and effective flashcard system. Learn vocabulary in 8 languages and compete with learners worldwide.'}</p>
 ${window.currentUser ? `<div class="flex items-center gap-3">
 ${avatarHtml}
 <div class="min-w-0 flex-1">
 <h1 class="text-lg font-bold leading-tight">${safeName}</h1>
 </div>
 <div class="flex-shrink-0 flex items-center gap-2">
 <p class="text-l leading-tight">Global rank</p>
 <p class="text-l leading-tight">${rankDisplay}</p>
 </div>
 </div>` : ''}
 <div class="mt-4">
 <button id="continue-learning-btn" type="button" class="w-full inline-flex items-center justify-center rounded-full bg-level-expert py-3 text-sm font-semibold text-white border-0">Start learning</button>
 </div>
 </div>

 ${!window.currentUser ? `
 <!-- How it works card (guest only) -->
 <div class="rounded-xl bg-learning-app-design-1 p-4 shadow-card">
 <p class="text-lg font-semibold mb-3">How it works</p>
 <div class="space-y-4">
 <div class="flex gap-3 items-start">
 <svg class="w-6 h-6 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="#ff8c02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 10.4V20M12 10.4C12 8.15979 12 7.03969 11.564 6.18404C11.1805 5.43139 10.5686 4.81947 9.81596 4.43597C8.96031 4 7.84021 4 5.6 4H4.6C4.03995 4 3.75992 4 3.54601 4.10899C3.35785 4.20487 3.20487 4.35785 3.10899 4.54601C3 4.75992 3 5.03995 3 5.6V16.4C3 16.9601 3 17.2401 3.10899 17.454C3.20487 17.6422 3.35785 17.7951 3.54601 17.891C3.75992 18 4.03995 18 4.6 18H7.54668C8.08687 18 8.35696 18 8.61814 18.0466C8.84995 18.0879 9.0761 18.1563 9.29191 18.2506C9.53504 18.3567 9.75977 18.5065 10.2092 18.8062L12 20M12 10.4C12 8.15979 12 7.03969 12.436 6.18404C12.8195 5.43139 13.4314 4.81947 14.184 4.43597C15.0397 4 16.1598 4 18.4 4H19.4C19.9601 4 20.2401 4 20.454 4.10899C20.6422 4.20487 20.7951 4.35785 20.891 4.54601C21 4.75992 21 5.03995 21 5.6V16.4C21 16.9601 21 17.2401 20.891 17.454C20.7951 17.6422 20.6422 17.7951 20.454 17.891C20.2401 18 19.9601 18 19.4 18H16.4533C15.9131 18 15.643 18 15.3819 18.0466C15.15 18.0879 14.9239 18.1563 14.7081 18.2506C14.465 18.3567 14.2402 18.5065 13.7908 18.8062L12 20"/></svg>
 <div>
 <p class="text-sm font-semibold">1,500+ words & phrases in 8 languages</p>
 <p class="text-xs opacity-70">9 categories per language built from the most commonly used words, expanded with dedicated phrases so you can use them in real conversations right away.</p>
 </div>
 </div>
 <div class="flex gap-3 items-start">
 <svg class="w-6 h-6 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="#ff8c02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11.2691 4.41115C11.5006 3.89177 11.6164 3.63208 11.7776 3.55211C11.9176 3.48263 12.082 3.48263 12.222 3.55211C12.3832 3.63208 12.499 3.89177 12.7305 4.41115L14.5745 8.54808C14.643 8.70162 14.6772 8.77839 14.7302 8.83718C14.777 8.8892 14.8343 8.93081 14.8982 8.95929C14.9705 8.99149 15.0541 9.00031 15.2213 9.01795L19.7256 9.49336C20.2911 9.55304 20.5738 9.58288 20.6997 9.71147C20.809 9.82316 20.8598 9.97956 20.837 10.1342C20.8108 10.3122 20.5996 10.5025 20.1772 10.8832L16.8125 13.9154C16.6877 14.0279 16.6252 14.0842 16.5857 14.1527C16.5507 14.2134 16.5288 14.2807 16.5215 14.3503C16.5132 14.429 16.5306 14.5112 16.5655 14.6757L17.5053 19.1064C17.6233 19.6627 17.6823 19.9408 17.5989 20.1002C17.5264 20.2388 17.3934 20.3354 17.2393 20.3615C17.0619 20.3915 16.8156 20.2495 16.323 19.9654L12.3995 17.7024C12.2539 17.6184 12.1811 17.5765 12.1037 17.56C12.0352 17.5455 11.9644 17.5455 11.8959 17.56C11.8185 17.5765 11.7457 17.6184 11.6001 17.7024L7.67662 19.9654C7.18404 20.2495 6.93775 20.3915 6.76034 20.3615C6.60623 20.3354 6.47319 20.2388 6.40075 20.1002C6.31736 19.9408 6.37635 19.6627 6.49434 19.1064L7.4341 14.6757C7.46898 14.5112 7.48642 14.429 7.47814 14.3503C7.47081 14.2807 7.44894 14.2134 7.41394 14.1527C7.37439 14.0842 7.31195 14.0279 7.18708 13.9154L3.82246 10.8832C3.40005 10.5025 3.18884 10.3122 3.16258 10.1342C3.13978 9.97956 3.19059 9.82316 3.29993 9.71147C3.42581 9.58288 3.70856 9.55304 4.27406 9.49336L8.77835 9.01795C8.94553 9.00031 9.02911 8.99149 9.10139 8.95929C9.16534 8.93081 9.2226 8.8892 9.26946 8.83718C9.32241 8.77839 9.35663 8.70162 9.42508 8.54808L11.2691 4.41115Z"/></svg>
 <div>
 <p class="text-sm font-semibold">Track your progress</p>
 <p class="text-xs opacity-70">Complete a category and review it after 24 hours — spaced repetition is the most effective way to learn a language.</p>
 </div>
 </div>
 <div class="flex gap-3 items-start">
 <svg class="w-6 h-6 flex-shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="#ff8c02" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 14V17M12 14C9.58104 14 7.56329 12.2822 7.10002 10M12 14C14.419 14 16.4367 12.2822 16.9 10M17 5H19.75C19.9823 5 20.0985 5 20.1951 5.01921C20.5918 5.09812 20.9019 5.40822 20.9808 5.80491C21 5.90151 21 6.01767 21 6.25C21 6.94698 21 7.29547 20.9424 7.58527C20.7056 8.77534 19.7753 9.70564 18.5853 9.94236C18.2955 10 17.947 10 17.25 10H17H16.9M7 5H4.25C4.01767 5 3.90151 5 3.80491 5.01921C3.40822 5.09812 3.09812 5.40822 3.01921 5.80491C3 5.90151 3 6.01767 3 6.25C3 6.94698 3 7.29547 3.05764 7.58527C3.29436 8.77534 4.22466 9.70564 5.41473 9.94236C5.70453 10 6.05302 10 6.75 10H7H7.10002M12 17C12.93 17 13.395 17 13.7765 17.1022C14.8117 17.3796 15.6204 18.1883 15.8978 19.2235C16 19.605 16 20.07 16 21H8C8 20.07 8 19.605 8.10222 19.2235C8.37962 18.1883 9.18827 17.3796 10.2235 17.1022C10.605 17 11.07 17 12 17ZM7.10002 10C7.03443 9.67689 7 9.34247 7 9V4.57143C7 4.03831 7 3.77176 7.09903 3.56612C7.19732 3.36201 7.36201 3.19732 7.56612 3.09903C7.77176 3 8.03831 3 8.57143 3H15.4286C15.9617 3 16.2282 3 16.4339 3.09903C16.638 3.19732 16.8027 3.36201 16.901 3.56612C17 3.77176 17 4.03831 17 4.57143V9C17 9.34247 16.9656 9.67689 16.9 10"/></svg>
 <div>
 <p class="text-sm font-semibold">Take the Challenge</p>
 <p class="text-xs opacity-70">Score 90%+ for +20 pts or a perfect 100% for +50 pts on the Global Leaderboard.</p>
 </div>
 </div>
 <div class="flex gap-3 items-start">
 <img src="/img/svg/01/globe_logo.svg" alt="Globe" class="w-6 h-6 flex-shrink-0 mt-0.5" style="filter: brightness(0) saturate(100%) invert(55%) sepia(89%) saturate(1000%) hue-rotate(360deg) brightness(101%) contrast(106%);">
 <div>
 <p class="text-sm font-semibold">Compete on the Global Leaderboard</p>
 <p class="text-xs opacity-70">Complete categories and finish challenges to earn points and climb the ranks!</p>
 </div>
 </div>
 </div>
 </div>
 ` : ''}

 <!-- Daily goals -->
 <div id="home-daily-goals" class="grid grid-cols-1 gap-4 sm:grid-cols-2">
 <div id="home-daily-plan-card" class="rounded-xl bg-learning-app-design-1 overflow-hidden shadow-card">

 <!-- M3 Header -->
 <div class="flex items-center gap-3 px-4 pt-3 pb-2">
 <div class="flex-1 min-w-0">
 <p class="text-xl font-semibold">Daily Repeat</p>
 <p class="text-xs opacity-50 leading-tight pt-3">${stats.langName}</p>
 </div>
 </div>

 <!-- M3 Media: language flag -->
 <div class="w-full flex items-center justify-center bg-learning-app-design-1" style="height:110px;">
 <span class="inline-flex items-center justify-center rounded-full overflow-hidden" style="width:80px; height:80px;">
 ${stats.langFlag}
 </span>
 </div>

 <!-- M3 Content + Actions: two columns -->
 ${stats.lastLearnedCategory ? `
 <p class="px-4 pt-3 text-xs opacity-50">Ready to review</p>
 <div class="flex items-center gap-3 px-4 pb-3">
 <div class="flex-1 min-w-0">
 <p class="mt-2 text-xs">${stats.lastLearnedCategory}</p>
 </div>
 <div class="flex-shrink-0">
 ${stats.lastLearnedCanRepeat
 ? `<button class="home-review-btn inline-flex items-center justify-center rounded-full py-2 px-4 text-sm font-semibold bg-learning-app-design-4 text-white border-0" data-source="${stats.lastLearnedSource}" data-category="${stats.lastLearnedCategory}">Review Now</button>`
 : `<button class="inline-flex items-center justify-center rounded-full py-2 px-4 text-sm font-normal bg-learning-app-design-2 text-gray-400 border-0 cursor-default" disabled>Review in ${stats.lastLearnedHoursLeft}h</button>`
 }
 </div>
 </div>
 ` : `
 <p class="px-4 pt-3 pb-3 text-xs opacity-50">No categories to review yet</p>
 `}

 ${stats.inProgressCategory ? `
 <div class="h-px bg-learning-app-design-3 mx-4"></div>
 <p class="px-4 pt-3 text-xs opacity-50">Continue learning</p>
 <div class="flex items-center gap-3 px-4 pb-3">
 <div class="flex-1 min-w-0">
 <p class="mt-2 text-xs">${stats.inProgressCategory}</p>
 </div>
 <div class="flex-shrink-0">
 <button class="home-nav-btn inline-flex items-center justify-center rounded-full py-2 px-4 text-sm font-semibold bg-learning-app-design-7 text-white border-0" data-source="${stats.inProgressCategorySource}" data-category="${stats.inProgressCategory}">Continue</button>
 </div>
 </div>
 ` : ""}

 ${stats.nextNewCategory ? `
 <div class="h-px bg-learning-app-design-3 mx-4"></div>
 <p class="px-4 pt-3 text-xs opacity-50">Start new category</p>
 <div class="flex items-center gap-3 px-4 pb-3">
 <div class="flex-1 min-w-0">
 <p class="mt-2 text-xs">${stats.nextNewCategory}</p>
 </div>
 <div class="flex-shrink-0">
 <button class="home-nav-btn inline-flex items-center justify-center rounded-full py-2 px-4 text-sm font-semibold bg-learning-app-design-5 text-white border-0" data-source="${stats.nextNewCategorySource}" data-category="${stats.nextNewCategory}">Start</button>
 </div>
 </div>
 ` : ""}

 </div>

 <!-- Quick stats -->
 <div id="home-quick-stats-card" class="rounded-xl bg-learning-app-design-1 overflow-hidden shadow-card">
 <div class="px-4 pt-3 pb-2">
 <p class="text-xl font-semibold">Learning stats</p>
 </div>
 ${learningStatsRows}
 <div class="flex justify-end px-4 pb-3 pt-3">
 <a href="/stats" class="inline-flex items-center justify-center rounded-full py-2 px-4 text-sm font-semibold bg-level-expert text-white border-0">Go to My Stats</a>
 </div>
 </div>

 <!-- Quick challenge -->
 <div id="home-quick-challenge-card" class="rounded-xl bg-learning-app-design-1 overflow-hidden shadow-card">
 <div class="px-4 pt-3 pb-2">
 <p class="text-xl font-semibold">Challenge stats</p>
 </div>
 ${challengeStatsRows}
 <div class="flex justify-end px-4 pb-3 pt-3">
 <a href="/challenge" class="inline-flex items-center justify-center rounded-full py-2 px-4 text-sm font-semibold bg-level-expert text-white border-0">Go to Challenge</a>
 </div>
 </div>
 </div>
 `;

 const continueButton = document.getElementById("continue-learning-btn");
 continueButton?.addEventListener("click", () => {
 localStorage.setItem("autoOpenSidebar", "true");
 window.location.href ="/learn";
 });

 const navigateToCategory = (source, category) => {
 try {
 localStorage.setItem("openCategory", JSON.stringify({ source, category, timestamp: Date.now() }));
 } catch (e) {}
 window.location.href = "/learn";
 };

 document.querySelectorAll(".home-nav-btn").forEach((btn) => {
 btn.addEventListener("click", () => {
 navigateToCategory(btn.dataset.source, btn.dataset.category);
 });
 });

 document.querySelectorAll(".home-review-btn").forEach((btn) => {
 btn.addEventListener("click", () => {
 const source = btn.dataset.source;
 const category = btn.dataset.category;

 // Reset all words in this category (same as stats page restart)
 Object.entries(stateService.buttonStates).forEach(([key, state]) => {
   if (state?.source === source && state?.category === category) {
     state.locked = false;
     state.count = 0;
     state.clicks = [];
     state.lastClicked = null;
     state.wasReset = true;
     state.resetTime = Date.now();
   }
 });
 stateService.saveButtonStates();

 navigateToCategory(source, category);
 });
 });
 }

 /**
 * Render main cards interface
 */
 async renderCards() {
 const renderVersion = ++this._renderVersion;
 try {
 const mainContent = document.getElementById("main-content");
 if (!mainContent) return false;
 const isHomeRoute = window.location.pathname ==="/home";

 // Clear content first
 mainContent.innerHTML ="";

 if (isHomeRoute) {
 await this.renderLearnHomeOverview(mainContent, renderVersion);
 return true;
 }

 const cardsContainer = createElement("div", {
 id:"cards-container",
 className:"container mx-auto p-4 pb-8",
 parent: mainContent,
 });

 // Breadcrumb placeholder
 const bc = createElement("div", { id: "learn-breadcrumb", className: "mt-2 text-xs opacity-50 px-1", parent: cardsContainer });
 bc.style.margin = "0 16px";
 this.updateBreadcrumb();

 this.renderPremiumBanner();

 const cardsGrid = createElement("div", {
 id:"cards-grid",
 className:"grid grid-cols-1 gap-y-20 pt-20 pb-32 place-items-center",
 parent: cardsContainer,
 });

 // Render cards into the grid
 await this.renderAllCardsIntoContainer(cardsGrid);

 return true;
 } catch (error) {
 console.error("Error rendering cards:", error);
 return false;
 }
 }

 /**
 * Render all cards into specific container
 */
 async renderAllCardsIntoContainer(gridContainer) {
 try {
 // Get fresh premium status
 const isPremiumUser = premiumService.getPremiumStatus();

 stateService.resetCardSelection();
  // Restore last clicked button for the current category
 if (stateService.categoryFilter) {
 stateService.lastClickedButtonKey = stateService.getLastClickedForCategory(stateService.categoryFilter);
 }

 let filteredWords = [];

 if (stateService.categoryFilter) {
 filteredWords = dataService.allWords.filter(
 (word) => word.category === stateService.categoryFilter
 );
 } else {
 if (!isPremiumUser) {
 filteredWords = dataService.allWords.filter(
 (word) => word.source ==="free"
 );

 if (filteredWords.length > 0) {
 const freeCategories = [
 ...new Set(filteredWords.map((word) => word.category)),
 ];
 if (freeCategories.length > 0) {
 stateService.categoryFilter = freeCategories[0];
 this.sidebarComponent.updateCategorySidebar();
 filteredWords = dataService.allWords.filter(
 (word) => word.category === stateService.categoryFilter
 );
 }
 }
 } else {
 filteredWords = dataService.allWords;
 }
 }

 const filteredData = dataService.groupDataIntoCards(filteredWords);
 await dataService.loadCardsForCards(filteredData);

 if (!gridContainer) return;

 gridContainer.innerHTML ="";
 const fragment = document.createDocumentFragment();
 filteredData.forEach((card) =>
 fragment.appendChild(this.cardComponent.createCardElement(card))
 );
 gridContainer.appendChild(fragment);

 setTimeout(() => this.progressBarComponent.updateAllProgressBars(), 100);
 } catch (error) {
 console.error("Cards rendering error:", error);
 }
 }

 /**
 * Render all cards (public method)
 */
 async renderAllCards() {
 const grid = document.getElementById("cards-grid");
 if (grid) {
 this.updateBreadcrumb();
 await this.renderAllCardsIntoContainer(grid);
 }
 }

 updateBreadcrumb() {
 const el = document.getElementById("learn-breadcrumb");
 if (!el) return;
 if (!stateService.categoryFilter) { el.textContent = ""; return; }
 const sectionMap = {
  free: "Greetings & Introductions",
  premium1: "Numbers & Time",
  premium2: "Food & Dining",
  premium3: "Travel & Tourism",
  premium4: "Daily Life & Shopping",
  premium5: "Family & Relationships",
  premium6: "Health & Body",
  premium7: "Education & Work",
  premium8: "Hobbies & Interests",
 };
 const word = dataService.allWords.find(w => w.category === stateService.categoryFilter);
 const section = word ? sectionMap[word.source] : null;
 el.textContent = section ? `${section}  >  ${stateService.categoryFilter}` : stateService.categoryFilter;
 }

 /**
 * Initialize category sidebar
 */
 async initCategorySidebar() {
 return await this.sidebarComponent.initCategorySidebar();
 }

 /**
 * Update category sidebar
 */
 updateCategorySidebar() {
 this.sidebarComponent.updateCategorySidebar();
 }

 /**
 * Update all progress bars
 */
 updateAllProgressBars() {
 this.progressBarComponent.updateAllProgressBars();
 }

 /**
 * Render premium banner - DISABLED
 */
 renderPremiumBanner() {
 // Banner disabled - users can discover premium via navbar/menu
 return;
 }
}

// Create singleton instance
export const uiService = new UIService();

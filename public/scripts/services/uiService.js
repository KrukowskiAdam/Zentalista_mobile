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

 const reviewDueCount = completionEntries.filter(([, meta, repeatCount]) => {
 if (!meta?.lastCompletedAt) {
 // Legacy fallback: known completed category without timestamp is treated as due.
 return repeatCount > 0;
 }
 const lastTs = new Date(meta.lastCompletedAt).getTime();
 return Number.isFinite(lastTs) && now - lastTs >= dayMs;
 }).length;

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

 // --- Last learned category + repeat status ---
 let lastLearnedCategory = null;
 let lastLearnedSource = null;
 let lastLearnedTs = 0;
 let lastLearnedCanRepeat = false;
 let lastLearnedHoursLeft = 0;

 for (const [key, meta] of Object.entries(completionDates)) {
 const ts = meta?.lastCompletedAt ? new Date(meta.lastCompletedAt).getTime() : 0;
 if (Number.isFinite(ts) && ts > lastLearnedTs) {
 lastLearnedTs = ts;
 // key format: "source::categoryName"
 const parts = key.split("::");
 lastLearnedSource = parts[0];
 lastLearnedCategory = parts.slice(1).join("::");
 const elapsed = now - ts;
 lastLearnedCanRepeat = elapsed >= dayMs;
 lastLearnedHoursLeft = lastLearnedCanRepeat ? 0 : Math.ceil((dayMs - elapsed) / (1000 * 60 * 60));
 }
 }

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

 // In-progress category: started but not completed
 const inProgressCatObj = availableCategories.find((cat) => {
 const key = `${cat.source}::${cat.name}`;
 return !completedKeys.has(key) && isStarted(cat.name);
 });
 const inProgressCategory = inProgressCatObj?.name || null;
 const inProgressCategorySource = inProgressCatObj?.source || null;

 // --- Completed main sections (0/9) ---
 const sourceGroups = {};
 for (const cat of availableCategories) {
 if (!sourceGroups[cat.source]) sourceGroups[cat.source] = [];
 sourceGroups[cat.source].push(cat);
 }
 const completedSections = Object.values(sourceGroups).filter(
 (cats) => cats.every((cat) => completedKeys.has(`${cat.source}::${cat.name}`))
 ).length;
 const totalSections = 9;

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
 // Derive completed sections from buttonStates: group unique categories by source, check all completed
 const catsBySource = {};
 Object.values(bs).forEach(state => {
 if (state?.source && state?.category) {
 if (!catsBySource[state.source]) catsBySource[state.source] = new Set();
 catsBySource[state.source].add(state.category);
 }
 });
 const completedSectionsLang = Object.entries(catsBySource).filter(([source, cats]) =>
 [...cats].every(cat => Number(rc[source + '::' + cat]) > 0)
 ).length;
 return { code: lang.code, name: lang.name, flag: lang.flag, completedCats, challengesDoneLang, completedSectionsLang, hasAnyInteraction };
 } catch(e) {
 return { code: lang.code, name: lang.name, flag: lang.flag, completedCats: 0, challengesDoneLang: 0, completedSectionsLang: 0, hasAnyInteraction: false };
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
 completedSections,
 totalSections,
 challengesDone,
 allLangsStats,
 };
 }

 async renderLearnHomeOverview(mainContent) {
 const stats = this.getLearnHomeStats();
 const safeName = String(stats.displayName).replace(/[<>]/g,"");

 const rank = await this.fetchLeaderboardRank();
 const rankDisplay = rank ? `#${rank}` : "—";

 let avatarUrl = null;
 try {
 const cached = localStorage.getItem("mc_menu_avatar");
 if (cached) avatarUrl = JSON.parse(cached).avatarUrl || null;
 } catch (e) {}
 const avatarHtml = avatarUrl
 ? `<img src="${avatarUrl}" alt="avatar" class="w-10 h-10 rounded-full object-cover flex-shrink-0" />`
 : `<div class="w-10 h-10 rounded-full bg-learning-app-design-4 flex items-center justify-center flex-shrink-0 text-sm font-bold">${safeName.charAt(0).toUpperCase()}</div>`;

 // Pre-compute multi-language stats rows
 const allRows = stats.allLangsStats.length > 0
 ? stats.allLangsStats
 : [{ name: stats.langName, flag: stats.langFlag, completedCats: stats.completedCategories, completedSectionsLang: stats.completedSections, challengesDoneLang: stats.challengesDone }];
 const learningStatsRows = allRows.map(l =>
 '<div class="flex items-center gap-3 px-4 pb-3">'
 + '<div class="flex-1 min-w-0"><p class="mt-2 text-xs flex items-center gap-2">'
 + '<span class="inline-flex w-5 h-5 rounded-full overflow-hidden flex-shrink-0">' + l.flag + '</span>'
 + l.name + '</p></div>'
 + '<div class="flex-shrink-0 text-right"><p class="text-xs opacity-50">Categories</p><p class="text-xs">' + l.completedCats + '</p></div>'
 + '<div class="flex-shrink-0 text-right ml-3"><p class="text-xs opacity-50">Sections</p><p class="text-xs">' + l.completedSectionsLang + '/9</p></div>'
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
 <div class="mx-auto max-w-4xl space-y-3">

 <!-- Welcome card -->
 <div id="home-welcome-card" class="rounded-xl bg-learning-app-design-1 p-4 shadow-card">
 <p class="text-sm uppercase tracking-[0.15em] mb-3">${window.currentUser ? 'Welcome back' : 'Welcome'}</p>
 <div class="flex items-center gap-3">
 ${avatarHtml}
 <div class="min-w-0 flex-1">
 <h1 class="text-lg font-bold leading-tight">${safeName}</h1>
 </div>
 <div class="flex-shrink-0 text-center">
 <p class="text-sm uppercase tracking-[0.15em]">Global rank</p>
 <p class="text-xl font-bold">${rankDisplay}</p>
 </div>
 </div>
 <div class="mt-4">
 <button id="continue-learning-btn" type="button" class="w-full inline-flex items-center justify-center rounded-full bg-level-expert py-3 text-sm font-semibold text-white border-0">Start learning</button>
 </div>
 </div>

 <!-- Daily goals -->
 <div id="home-daily-goals" class="grid grid-cols-1 gap-3 sm:grid-cols-2">
 <div id="home-daily-plan-card" class="rounded-xl bg-learning-app-design-1 overflow-hidden shadow-card">

 <!-- M3 Header -->
 <div class="flex items-center gap-3 px-4 pt-3 pb-2">
 <div class="flex-1 min-w-0">
 <p class="text-sm uppercase tracking-[0.15em]">Daily Repeat</p>
 <p class="text-xs opacity-60 leading-tight">${stats.langName}</p>
 </div>
 </div>

 <!-- M3 Media: language flag -->
 <div class="w-full flex items-center justify-center bg-learning-app-design-1" style="height:140px;">
 <span class="inline-flex items-center justify-center rounded-full overflow-hidden" style="width:80px; height:80px;">
 ${stats.langFlag}
 </span>
 </div>

 <!-- M3 Content + Actions: two columns -->
 <p class="px-4 pt-3 text-xs opacity-50">Last studied category</p>
 <div class="flex items-center gap-3 px-4 pb-3">
 <div class="flex-1 min-w-0">
 <p class="mt-2 text-xs">
 ${stats.inProgressCategory || stats.lastLearnedCategory || "No categories yet"}
 </p>
 </div>
 <div class="flex-shrink-0">
 ${stats.inProgressCategory
 ? `<button class="home-nav-btn inline-flex items-center justify-center rounded-full py-2 px-4 text-sm font-semibold bg-learning-app-design-7 text-white border-0" data-source="${stats.inProgressCategorySource}" data-category="${stats.inProgressCategory}">Continue</button>`
 : stats.lastLearnedCanRepeat && stats.lastLearnedCategory
 ? `<button class="home-review-btn inline-flex items-center justify-center rounded-full py-2 px-4 text-sm font-semibold bg-learning-app-design-4 text-white border-0" data-source="${stats.lastLearnedSource}" data-category="${stats.lastLearnedCategory}">Review Now</button>`
 : `<button class="inline-flex items-center justify-center rounded-full py-2 px-4 text-sm font-semibold opacity-40 cursor-default" disabled>Review in ${stats.lastLearnedHoursLeft}h</button>`
 }
 </div>
 </div>

 ${stats.nextNewCategory ? `
 <div class="h-px bg-learning-app-design-3 mx-4"></div>
 <p class="px-4 pt-3 text-xs opacity-50">Start new category</p>
 <div class="flex items-center gap-3 px-4 pb-3">
 <div class="flex-1 min-w-0">
 <p class="mt-2 text-xs">${stats.nextNewCategory}</p>
 </div>
 <div class="flex-shrink-0">
 <button class="home-nav-btn inline-flex items-center justify-center rounded-full py-2 px-4 text-sm font-semibold bg-learning-app-design-6 text-white border-0" data-source="${stats.nextNewCategorySource}" data-category="${stats.nextNewCategory}">Start</button>
 </div>
 </div>
 ` : ""}

 </div>

 <!-- Quick stats -->
 <div id="home-quick-stats-card" class="rounded-xl bg-learning-app-design-1 overflow-hidden shadow-card">
 <div class="px-4 pt-3 pb-2">
 <p class="text-sm uppercase tracking-[0.15em]">Your stats</p>
 </div>
 <!-- Learning stats -->
 <p class="px-4 pt-3 text-xs opacity-50">Learning stats</p>
 ${learningStatsRows}
 <div class="h-px bg-learning-app-design-3 mx-4"></div>
 <!-- Challenge stats -->
 <p class="px-4 pt-3 text-xs opacity-50">Challenge stats</p>
 ${challengeStatsRows}
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
 navigateToCategory(btn.dataset.source, btn.dataset.category);
 });
 });
 }

 /**
 * Render main cards interface
 */
 async renderCards() {
 try {
 const mainContent = document.getElementById("main-content");
 if (!mainContent) return false;
 const isHomeRoute = window.location.pathname ==="/home";

 // Clear content first
 mainContent.innerHTML ="";

 if (isHomeRoute) {
 await this.renderLearnHomeOverview(mainContent);
 return true;
 }

 const cardsContainer = createElement("div", {
 id:"cards-container",
 className:"container mx-auto p-4 pb-8",
 parent: mainContent,
 });

 this.renderPremiumBanner();

 const cardsGrid = createElement("div", {
 id:"cards-grid",
 className:"grid grid-cols-1 gap-y-28 place-items-center",
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
 await this.renderAllCardsIntoContainer(grid);
 }
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

// /public/scripts/services/uiService.js
// UI rendering and management service

import { createElement } from"../utils/helpers.js";
import { stateService } from"./stateService.js";
import { dataService } from"./dataService.js";
import { premiumService } from"./premiumService.js";
import { CardComponent } from"../components/cardComponent.js";
import { SidebarComponent } from"../components/sidebarComponent.js";
import { ProgressBarComponent } from"../components/progressBarComponent.js";

class UIService {
 constructor() {
 this.cardComponent = new CardComponent();
 this.sidebarComponent = new SidebarComponent();
 this.progressBarComponent = new ProgressBarComponent();
 }

 getLearnHomeStats() {
 const languageMeta = {
 es: {
 name: "Spanish",
 flag: '<svg viewBox="0 0 32 32" class="w-full h-full"><rect y="0" x="0" height="32" width="32" fill="#c60b1e"/><rect y="11" x="0" height="10" width="32" fill="#ffc400"/></svg>',
 },
 de: {
 name: "German",
 flag: '<svg viewBox="0 0 32 32" class="w-full h-full"><rect y="0" x="0" height="11" width="32" fill="#000000"/><rect y="11" x="0" height="11" width="32" fill="#dd0000"/><rect y="22" x="0" height="10" width="32" fill="#ffce00"/></svg>',
 },
 fr: {
 name: "French",
 flag: '<svg viewBox="0 0 32 32" class="w-full h-full"><rect y="0" x="0" height="32" width="11" fill="#002395"/><rect y="0" x="11" height="32" width="11" fill="#ffffff"/><rect y="0" x="22" height="32" width="10" fill="#ed2939"/></svg>',
 },
 ru: {
 name: "Russian",
 flag: '<svg viewBox="0 0 32 32" class="w-full h-full"><rect y="0" x="0" height="11" width="32" fill="#ffffff"/><rect y="11" x="0" height="11" width="32" fill="#0039a6"/><rect y="22" x="0" height="10" width="32" fill="#d52b1e"/></svg>',
 },
 zh: {
 name: "Chinese",
 flag: '<svg viewBox="0 0 32 32" class="w-full h-full"><rect fill="#de2910" height="32" width="32" y="0" x="0"/><polygon fill="#ffde00" points="8,6 9.5,10 14,10 10.5,12.5 12,17 8,14 4,17 5.5,12.5 2,10 6.5,10"/></svg>',
 },
 ja: {
 name: "Japanese",
 flag: '<svg viewBox="0 0 32 32" class="w-full h-full"><rect fill="#ffffff" height="32" width="32" y="0" x="0"/><circle fill="#bc002d" cx="16" cy="16" r="6"/></svg>',
 },
 ko: {
 name: "Korean",
 flag: '<svg viewBox="0 0 32 32" class="w-full h-full"><rect fill="#ffffff" height="32" width="32" y="0" x="0"/><circle fill="none" stroke="#c60c30" stroke-width="2" cx="16" cy="16" r="6"/><path fill="#003478" d="M 16 10 A 6 6 0 0 1 16 22 Z"/><path fill="#c60c30" d="M 16 10 A 6 6 0 0 0 16 22 Z"/></svg>',
 },
 it: {
 name: "Italian",
 flag: '<svg viewBox="0 0 32 32" class="w-full h-full"><rect y="0" x="0" height="32" width="11" fill="#009246"/><rect y="0" x="11" height="32" width="11" fill="#eeeeee"/><rect y="0" x="22" height="32" width="10" fill="#ce2b36"/></svg>',
 },
 };
 const languageCodes = Object.keys(languageMeta);
 const oneDayMs = 24 * 60 * 60 * 1000;
 const sevenDaysMs = 7 * oneDayMs;
 const now = Date.now();

 const safeJsonParse = (value, fallback = {}) => {
 try {
 const parsed = JSON.parse(value || JSON.stringify(fallback));
 return parsed && typeof parsed === "object" ? parsed : fallback;
 } catch (error) {
 return fallback;
 }
 };

 const extractActivityTimestamp = (state) => {
 if (!state) return 0;
 const lastClickedTs = Number(state.lastClicked) || 0;
 const clickTs = Array.isArray(state.clicks)
 ? Math.max(
 ...state.clicks.map((item) => Number(item?.timestamp) || 0),
 0
 )
 : 0;
 return Math.max(lastClickedTs, clickTs);
 };

 let latestActivity = null;

 languageCodes.forEach((lang) => {
 const buttonStatesByLang = safeJsonParse(
 localStorage.getItem(`buttonStates_${lang}`),
 {}
 );

 Object.values(buttonStatesByLang).forEach((state) => {
 const ts = extractActivityTimestamp(state);
 if (!ts) return;
 if (!latestActivity || ts > latestActivity.timestamp) {
 latestActivity = {
 timestamp: ts,
 lang,
 category: state.category || null,
 source: state.source || "free",
 };
 }
 });
 });

 const fallbackLang = localStorage.getItem("selectedLanguage") || "es";
 const recentLanguageCode = latestActivity?.lang || fallbackLang;
 const recentLanguageData =
 languageMeta[recentLanguageCode] || languageMeta.es;
 const recentLanguage = recentLanguageData.name;
 const recentLanguageFlag = recentLanguageData.flag;

 const recentCategory = latestActivity?.category || "No category started yet";
 const recentCategoryKey = latestActivity?.category
 ? `${latestActivity.source || "free"}::${latestActivity.category}`
 : null;

 const repeatCountsForRecentLang = safeJsonParse(
 localStorage.getItem(`repeatCounts_${recentLanguageCode}`),
 {}
 );
 const completionDatesForRecentLang = safeJsonParse(
 localStorage.getItem(`categoryCompletionDates_${recentLanguageCode}`),
 {}
 );

 const recentRepeatCount = recentCategoryKey
 ? Number(repeatCountsForRecentLang[recentCategoryKey]) || 0
 : 0;
 const recentCategoryCompleted = recentRepeatCount > 0;

 let recentCategoryStatus = "Not started";
 if (latestActivity?.category) {
 recentCategoryStatus = recentCategoryCompleted ? "Completed" : "In progress";
 }

 let reviewStatus = "Not available yet";
 let canReviewNow = false;

 if (recentCategoryCompleted && recentCategoryKey) {
 const meta = completionDatesForRecentLang[recentCategoryKey] || {};
 const lastCompletedAt = meta?.lastCompletedAt
 ? new Date(meta.lastCompletedAt).getTime()
 : 0;

 if (Number.isFinite(lastCompletedAt) && lastCompletedAt > 0) {
 const hoursSinceCompletion = Math.floor((now - lastCompletedAt) / (1000 * 60 * 60));
 const hoursUntilReview = 24 - hoursSinceCompletion;
 if (hoursUntilReview <= 0) {
 reviewStatus = "Review now";
 canReviewNow = true;
 } else {
 reviewStatus = `Review in ${hoursUntilReview}h`;
 }
 } else {
 reviewStatus = "Review now";
 canReviewNow = true;
 }
 }

 let completedLast7Days = 0;
 languageCodes.forEach((lang) => {
 const completionDatesByLang = safeJsonParse(
 localStorage.getItem(`categoryCompletionDates_${lang}`),
 {}
 );

 Object.entries(completionDatesByLang).forEach(([key, value]) => {
 if (key.endsWith(":inProgress") || key.endsWith(":reset")) return;
 if (!value || typeof value !== "object") return;

 const completedAtTs = value.lastCompletedAt
 ? new Date(value.lastCompletedAt).getTime()
 : 0;

 if (
 Number.isFinite(completedAtTs) &&
 completedAtTs > 0 &&
 now - completedAtTs <= sevenDaysMs
 ) {
 completedLast7Days += 1;
 }
 });
 });

 const currentUser = window.currentUser || null;
 const displayName =
 currentUser?.displayName ||
 currentUser?.email?.split("@")[0] ||
"Learner";

 return {
 displayName,
 recentLanguage,
 recentLanguageFlag,
 recentCategory,
 recentCategoryStatus,
 reviewStatus,
 canReviewNow,
 completedLast7Days,
 };
 }

 renderLearnHomeOverview(mainContent) {
 const stats = this.getLearnHomeStats();
 const safeName = String(stats.displayName).replace(/[<>]/g,"");

 const overview = createElement("section", {
 id:"learn-home-overview",
 className:"w-full px-4 pt-5 pb-3",
 parent: mainContent,
 });

 overview.innerHTML = `
 <div class="mx-auto max-w-4xl space-y-3">
 <div class="rounded-xl bg-learning-app-design-1 p-4 shadow-card">
 <p class="text-xs uppercase tracking-[0.14em]">Welcome back</p>
 <h1 class="mt-1 text-xl font-bold">${safeName}, keep your momentum</h1>
 <p class="mt-2 text-sm">Focus on your latest learning activity</p>

 <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
 <button id="continue-learning-btn" type="button" class="touch-target rounded-xl bg-level-expert px-4 py-3 text-sm font-semibold">Continue learning</button>
 <a href="/learn" class="touch-target rounded-xl px-4 py-3 text-center text-sm font-semibold bg-learning-app-design-4">Open learn</a>
 <a href="/stats" class="touch-target rounded-xl px-4 py-3 text-center text-sm font-semibold bg-learning-app-design-5">View stats</a>
 </div>
 </div>

 <div class="grid grid-cols-1 gap-3">
 <div class="rounded-xl bg-learning-app-design-1 p-4 shadow-card">
 <p class="text-xs uppercase tracking-[0.12em]">Last activity</p>
 <div class="mt-2 flex items-center gap-2">
 <span class="inline-flex items-center justify-center w-6 h-6 rounded-full overflow-hidden">${stats.recentLanguageFlag}</span>
 <p class="text-2xl font-bold">${stats.recentLanguage}</p>
 </div>
 <p class="mt-3 text-xs uppercase tracking-[0.12em]">Last learned category</p>
 <p class="mt-2 text-xl font-bold">${stats.recentCategory}</p>
 <div class="mt-3 flex flex-wrap gap-2 text-xs">
 <span class="rounded-full bg-learning-app-design-4 px-3 py-1">Status: ${stats.recentCategoryStatus}</span>
 <span class="rounded-full ${stats.canReviewNow ? "bg-level-expert" : "bg-learning-app-design-5"} px-3 py-1">${stats.reviewStatus}</span>
 </div>
 </div>

 <div class="rounded-xl bg-learning-app-design-1 p-4 shadow-card">
 <p class="text-xs uppercase tracking-[0.12em]">Closed in last 7 days</p>
 <p class="mt-2 text-2xl font-bold">${stats.completedLast7Days}</p>
 <p class="mt-2 text-xs">Number of categories completed recently across all languages.</p>
 </div>
 </div>
 </div>
 `;

 const continueButton = document.getElementById("continue-learning-btn");
 continueButton?.addEventListener("click", () => {
 window.location.href ="/learn";
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
 this.renderLearnHomeOverview(mainContent);
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

 console.log(
"🎴 Rendering cards:",
 filteredData.length,
"cards with",
 filteredWords.length,
"words"
 );
 gridContainer.innerHTML ="";
 const fragment = document.createDocumentFragment();
 filteredData.forEach((card) =>
 fragment.appendChild(this.cardComponent.createCardElement(card))
 );
 gridContainer.appendChild(fragment);
 console.log("✅ Cards rendered to DOM");

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

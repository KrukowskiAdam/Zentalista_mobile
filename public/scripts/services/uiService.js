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
 <div class="rounded-xl bg-learning-app-design-2 p-4 shadow-card">
 <p class="text-xs uppercase tracking-[0.14em]">Welcome back</p>
 <h1 class="mt-1 text-xl font-bold">${safeName}, keep your momentum</h1>
 <p class="mt-2 text-sm">Continue with <span class="">${stats.continueCategory}</span></p>

 <div class="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
 <button id="continue-learning-btn" type="button" class="touch-target rounded-xl bg-level-expert px-4 py-3 text-sm font-semibold hover:bg-level-expert">Continue learning</button>
 <a href="/challenge" class="touch-target rounded-xl px-4 py-3 text-center text-sm font-semibold hover:bg-learning-app-design-3">Quick challenge</a>
 <a href="/stats" class="touch-target rounded-xl px-4 py-3 text-center text-sm font-semibold hover:bg-learning-app-design-3">View stats</a>
 </div>
 </div>

 <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
 <div class="rounded-xl bg-learning-app-design-1 p-4 shadow-card">
 <p class="text-xs uppercase tracking-[0.12em]">Daily plan</p>
 <div class="mt-2 flex items-end justify-between">
 <p class="text-2xl font-bold">${stats.repeatGoalCompletedCount}/${stats.repeatGoalCount}</p>
 <p class="text-xs">repeat goal</p>
 </div>
 <div class="mt-3 space-y-1 text-xs">
 <p>${stats.reviewDoneToday ?"✓" :"○"} Repeat 1 category after 24h</p>
 </div>
 <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-learning-app-design-4">
 <div class="h-full rounded-full bg-level-expert transition-all duration-500" style="width: ${stats.repeatGoalProgress}%"></div>
 </div>
 <p class="mt-2 text-xs">Review due now: ${stats.reviewDueCount}</p>
 </div>

 <div class="rounded-xl bg-learning-app-design-1 p-4 shadow-card">
 <p class="text-xs uppercase tracking-[0.12em]">Learning progress</p>
 <div class="mt-2 flex items-end justify-between">
 <p class="text-2xl font-bold">${stats.newGoalCompletedCount}/${stats.newGoalCount}</p>
 <p class="text-xs">new category goal</p>
 </div>
 <div class="mt-3 space-y-1 text-xs">
 <p>${stats.newCategoryDoneToday ?"✓" :"○"} Close 1 new category today</p>
 </div>
 <div class="mt-3 h-2 w-full overflow-hidden rounded-full bg-learning-app-design-4">
 <div class="h-full rounded-full bg-level-mastered transition-all duration-500" style="width: ${stats.newGoalProgress}%"></div>
 </div>
 <p class="mt-2 text-xs">All-time: ${stats.completedCategories}/${stats.totalCategories} categories done</p>
 </div>
 </div>

 <div class="rounded-xl bg-learning-app-design-1 p-4 shadow-card">
 <div class="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
 <div>
 <p class="text-xs uppercase tracking-[0.12em]">Words locked</p>
 <p class="mt-1 text-xl font-bold">${stats.lockedWords}</p>
 </div>
 <div>
 <p class="text-xs uppercase tracking-[0.12em]">Categories</p>
 <p class="mt-1 text-xl font-bold">${stats.completedCategories}</p>
 </div>
 <div>
 <p class="text-xs uppercase tracking-[0.12em]">Challenge</p>
 <p class="mt-1 text-xl font-bold">Ready</p>
 </div>
 <div>
 <p class="text-xs uppercase tracking-[0.12em]">Focus</p>
 <p class="mt-1 text-xl font-bold">10 min</p>
 </div>
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

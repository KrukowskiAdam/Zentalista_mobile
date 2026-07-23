// /public/scripts/services/celebrationService.js
// Handles the celebratory modal + confetti animation that appears after a category is completed

import { CONFIG } from"../utils/config.js";
import { stateService } from"./stateService.js";

class CelebrationService {
 constructor() {
 this.modal = null;
 this.animationContainer = null;
 this.confettiLayer = null;
 this.titleElement = null;
 this.subtitleElement = null;
 this.challengeButton = null;
 this.closeButton = null;
 this.animationInstance = null;
 this.currentContext = null;
 this.confettiStyleInjected = false;
 this.showDelayTimeout = null;
 }

 showCelebration(detail) {
 if (!detail || !detail.category) return;

 this.currentContext = detail;
 this.ensureModal();

 this.clearPendingCelebration();
 const delay = CONFIG.celebrations?.completionModalDelayMs ?? 0;

 if (delay <= 0) {
 this.presentCelebration(detail);
 return;
 }

 this.showDelayTimeout = window.setTimeout(() => {
 this.showDelayTimeout = null;
 this.presentCelebration(detail);
 }, delay);
 }

 presentCelebration(detail) {
 const context = detail || this.currentContext;
 if (!context) return;
 this.currentContext = context;

 const { category, repeatCount } = context;
 const loggedIn = this.isUserLoggedIn();
 this.titleElement.textContent ="Category completed!";
 const baseSubtitle = repeatCount
 ? `You just finished ${category} for the ${repeatCount}º time. Keep the streak going!`
 : `You just completed ${category}. Ready for the next challenge?`;
 this.subtitleElement.textContent = loggedIn
 ? baseSubtitle
 : `${baseSubtitle} Log in to take the challenge and secure your progress.`;

 this.modal.classList.remove("hidden");
 document.body.classList.add("overflow-hidden");

 this.updateChallengeButtonState(loggedIn);
 this.playAnimation();
 }

 hideCelebration() {
 this.clearPendingCelebration();
 if (!this.modal) return;

 this.modal.classList.add("hidden");
 document.body.classList.remove("overflow-hidden");

 this.destroyLottie();
 this.clearFallbackConfetti();
 }

 ensureModal() {
 if (this.modal) return;

 const overlay = document.createElement("div");
 overlay.id ="category-celebration-modal";
 overlay.className ="fixed inset-0 z-[120] bg-learning-app-design-3 backdrop-blur-sm flex items-center justify-center px-4 hidden";
 overlay.setAttribute("role","dialog");
 overlay.setAttribute("aria-modal","true");
 overlay.addEventListener("click", (event) => {
 if (event.target === overlay) {
 this.hideCelebration();
 }
 });

 this.confettiLayer = document.createElement("div");
 this.confettiLayer.className ="absolute inset-0 pointer-events-none overflow-hidden";
 overlay.appendChild(this.confettiLayer);

 const card = document.createElement("div");
 card.className ="relative w-full max-w-md bg-learning-app-design-1 rounded-2xl shadow-2xl p-6 text-center z-10";

 const closeBtn = document.createElement("button");
 closeBtn.type ="button";
 closeBtn.className ="absolute top-4 right-4 transition-colors";
 closeBtn.setAttribute("aria-label","Close celebration");
 closeBtn.innerHTML = `
 <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
 <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
 </svg>
 `;
 closeBtn.addEventListener("click", () => this.hideCelebration());
 this.closeButton = closeBtn;

 const animationWrapper = document.createElement("div");
 animationWrapper.className ="mx-auto mb-4 flex items-center justify-center";
 animationWrapper.style.width ="220px";
 animationWrapper.style.height ="220px";

 this.animationContainer = document.createElement("div");
 this.animationContainer.className ="w-full h-full";
 animationWrapper.appendChild(this.animationContainer);

 this.titleElement = document.createElement("h3");
 this.titleElement.className ="text-2xl font-bold mb-2";

 this.subtitleElement = document.createElement("p");
 this.subtitleElement.className ="text-sm mb-6";

 const buttonsWrapper = document.createElement("div");
 buttonsWrapper.className ="flex flex-col gap-3";

 this.challengeButton = document.createElement("button");
 this.challengeButton.type ="button";
 this.challengeButton.className ="w-full inline-flex items-center justify-center rounded-full py-3 text-sm font-semibold bg-level-expert text-white border-0";
 this.challengeButton.textContent ="Take the challenge";
 this.challengeButton.style.minHeight ="auto";
 this.challengeButton.addEventListener("click", () => this.launchChallenge());

 const maybeLaterButton = document.createElement("button");
 maybeLaterButton.type ="button";
 maybeLaterButton.className ="w-full inline-flex items-center justify-center rounded-full py-3 text-sm font-semibold bg-level-learning text-white border-0";
 maybeLaterButton.textContent ="Maybe later";
 maybeLaterButton.style.minHeight ="auto";
 maybeLaterButton.addEventListener("click", () => this.hideCelebration());

 buttonsWrapper.appendChild(this.challengeButton);
 buttonsWrapper.appendChild(maybeLaterButton);

 card.appendChild(closeBtn);
 card.appendChild(animationWrapper);
 card.appendChild(this.titleElement);
 card.appendChild(this.subtitleElement);
 card.appendChild(buttonsWrapper);

 overlay.appendChild(card);
 document.body.appendChild(overlay);

 this.modal = overlay;
 }

 async playAnimation() {
 this.destroyLottie();
 this.clearFallbackConfetti();

 const animationPath = CONFIG.animations?.categoryComplete;
 const hasLottie = typeof window.lottie !=="undefined";

 if (hasLottie && animationPath) {
 try {
 this.animationInstance = window.lottie.loadAnimation({
 container: this.animationContainer,
 renderer:"svg",
 loop: false,
 autoplay: true,
 path: animationPath,
 rendererSettings: {
 preserveAspectRatio:"xMidYMid meet",
 },
 });
 this.animationInstance.addEventListener("complete", () => {
 // Keep the final frame visible
 });
 this.animationInstance.addEventListener("data_failed", () => {
 console.warn("Lottie data failed to load, falling back to confetti");
 this.playFallbackConfetti();
 });
 return;
 } catch (error) {
 console.error("Lottie animation failed, falling back to confetti", error);
 }
 }

 if (!animationPath) {
 console.warn("CONFIG.animations.categoryComplete is not set. Showing fallback confetti instead.");
 } else if (!hasLottie) {
 console.warn("window.lottie is unavailable. Showing fallback confetti instead.");
 }

 this.playFallbackConfetti();
 }

 clearPendingCelebration() {
 if (this.showDelayTimeout) {
 clearTimeout(this.showDelayTimeout);
 this.showDelayTimeout = null;
 }
 }

 destroyLottie() {
 if (this.animationInstance && typeof this.animationInstance.destroy ==="function") {
 this.animationInstance.destroy();
 this.animationInstance = null;
 }
 if (this.animationContainer) {
 this.animationContainer.innerHTML ="";
 }
 }

 injectFallbackStyles() {
 if (this.confettiStyleInjected) return;
 const style = document.createElement("style");
 style.id ="celebration-confetti-style";
 style.textContent = `
 @keyframes celebration-confetti-fall {
 0% { transform: translate3d(var(--confetti-x), -120%, 0) rotate(0deg); opacity: 0; }
 10% { opacity: 1; }
 100% { transform: translate3d(calc(var(--confetti-x) + var(--confetti-shift)), 140%, 0) rotate(var(--confetti-rotate)); opacity: 0; }
 }
 .celebration-confetti-piece {
 position: absolute;
 top: -10%;
 width: var(--confetti-width, 8px);
 height: var(--confetti-height, 22px);
 background-color: var(--confetti-color, #2BD999);
 999px;
 opacity: 0;
 animation: celebration-confetti-fall var(--confetti-duration, 2.4s) ease-in forwards;
 }
 `;
 document.head.appendChild(style);
 this.confettiStyleInjected = true;
 }

 playFallbackConfetti() {
 this.injectFallbackStyles();
 if (!this.confettiLayer) return;

 const colors = ["#4227F2","#4951F2","#27368C","#4982A6","#2BD999"];
 const pieceCount = 28;

 for (let i = 0; i < pieceCount; i += 1) {
 const piece = document.createElement("span");
 piece.className ="celebration-confetti-piece";
 piece.style.setProperty("--confetti-x", `${Math.random() * 100}%`);
 piece.style.setProperty(
"--confetti-shift",
 `${(Math.random() - 0.5) * 50}%`
 );
 piece.style.setProperty(
"--confetti-rotate",
 `${Math.floor(Math.random() * 720)}deg`
 );
 piece.style.setProperty(
"--confetti-width",
 `${6 + Math.random() * 6}px`
 );
 piece.style.setProperty(
"--confetti-height",
 `${16 + Math.random() * 18}px`
 );
 piece.style.setProperty(
"--confetti-color",
 colors[i % colors.length]
 );
 piece.style.setProperty(
"--confetti-duration",
 `${1.8 + Math.random() * 1.2}s`
 );

 this.confettiLayer.appendChild(piece);
 }

 // Clean up confetti nodes after the animation finishes
 setTimeout(() => this.clearFallbackConfetti(), 2600);
 }

 clearFallbackConfetti() {
 if (!this.confettiLayer) return;
 this.confettiLayer.innerHTML ="";
 }

 launchChallenge() {
 if (!this.isUserLoggedIn()) {
 this.promptLogin();
 return;
 }
 if (!this.currentContext) return;
 const payload = {
 source: this.currentContext.source,
 category: this.currentContext.category,
 language:
 this.currentContext.language ||
 localStorage.getItem("selectedLanguage") ||
"es",
 timestamp: Date.now(),
 };

 try {
 localStorage.setItem("pendingChallenge", JSON.stringify(payload));
 } catch (error) {
 console.error("Error storing pending challenge", error);
 }

 window.location.href ="/challenge";
 }

 updateChallengeButtonState(loggedIn) {
 if (!this.challengeButton) return;

 if (loggedIn) {
 this.challengeButton.textContent ="Take the challenge";
 this.challengeButton.classList.remove("bg-learning-app-design-2");
 } else {
 this.challengeButton.textContent ="Log in to take the challenge";
 this.challengeButton.classList.add("bg-learning-app-design-2");
 }
 }

 isUserLoggedIn() {
 return Boolean(window.currentUser && window.currentUser.uid);
 }

 promptLogin() {
 const modal = document.getElementById("modal-login");
 if (modal) {
 modal.checked = true;
 } else {
 alert("Log in to take challenges and earn leaderboard points.");
 }
 }

 /**
 * Show card completion celebration (when all 4 words on a card are done)
 * Displays a quick Lottie animation centered on screen
 */
 showCardCelebration(detail) {
 if (!detail || !detail.cardId) return;

 const hasLottie = typeof window.lottie !== 'undefined';
 const animationPath = CONFIG.animations?.cardComplete;

 if (!hasLottie || !animationPath) return;

 // Create overlay container - large and shifted right to align with cards
 const container = document.createElement('div');
 container.className = 'card-celebration-container';
 container.style.cssText = `
 position: fixed;
 left: 60%;
 top: 50%;
 transform: translate(-50%, -50%);
 width: 1200px;
 height: 1200px;
 pointer-events: none;
 z-index: 100;
 `;
 document.body.appendChild(container);

 try {
 const anim = window.lottie.loadAnimation({
 container: container,
 renderer: 'svg',
 loop: false,
 autoplay: true,
 path: animationPath,
 rendererSettings: {
 preserveAspectRatio: 'xMidYMid meet',
 },
 });

 // Speed up animation
 anim.setSpeed(2);

 anim.addEventListener('complete', () => {
 anim.destroy();
 container.remove();
 });

 // Fallback removal after 2 seconds
 setTimeout(() => {
 if (container.parentNode) {
 container.remove();
 }
 }, 2000);
 } catch (error) {
 console.warn('Card celebration Lottie failed:', error);
 container.remove();
 }
 }
}

export const celebrationService = new CelebrationService();
window.celebrationService = celebrationService;

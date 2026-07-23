// /public/scripts/components/buttonComponent.js
// Word button creation and management component

import { CONFIG } from "../utils/config.js";
import { createElement, addLockIcon } from "../utils/helpers.js";
import { stateService } from "../services/stateService.js";
import { premiumService } from "../services/premiumService.js";

const audioCache = new Map();
let currentAudio = null;

export class ButtonComponent {
 constructor() {
 }

 /**
 * Create word button with all functionality
 */
 createWordButton(word, cardId, cardWords = []) {
 const safeUniqueKey = `word-${word.globalIndex}-${word.source}`;

 // Get fresh premium status for each button - with extra checks
 let currentPremiumStatus = premiumService.getPremiumStatus();

 // During stats navigation, use the most reliable source
 if (stateService._blockRerender) {
 currentPremiumStatus =
 window.isPremiumUser || premiumService.isPremiumUser || false;
 }

 const isPremiumWord = stateService.premiumCategories.has(word.category);
 const isWordLocked = isPremiumWord && !currentPremiumStatus;
 const initialProgress = stateService.getButtonProgress(safeUniqueKey);
 const isLocked = stateService.isButtonLocked(safeUniqueKey);

 const buttonClass = `fc-button min-w-[60px] transition-all duration-300 ease-in-out min-h-[80px] leading-[1.2] flex items-center justify-center ${
 isWordLocked ? CONFIG.cards.buttonColors.locked : "bg-learning-app-design-1"
 } relative overflow-hidden`;

 const btn = createElement("button", {
 className: buttonClass,
 text: word.en,
 styles: {
 zIndex: "1",
 height: "60px",
 alignItems: "center",
 justifyContent: "center",
 display: "flex",
 flexWrap: "wrap",
 cursor: isWordLocked ? "not-allowed" : "pointer",
 },
 });

 if (isWordLocked) {
 addLockIcon(btn);
 }

 const progressWidth = isLocked
 ? "100%"
 : `${(initialProgress / CONFIG.cards.clicksToComplete) * 100}%`;
 const progressBar = createElement("span", {
 className:
 "absolute left-0 bottom-0 h-full transition-all duration-300 ease-in-out bg-level-expert-progress z-[-1]",
 styles: { width: progressWidth },
 parent: btn,
 });

 if (!isWordLocked) {
 this.addButtonEventHandlers(
 btn,
 safeUniqueKey,
 progressBar,
 cardId,
 word,
 cardWords
 );
 }

 return btn;
 }

 /**
 * Add event handlers to button
 */
 addButtonEventHandlers(button, uniqueKey, progressBar, cardId, word, cardWords = []) {
 button.onclick = () => {
 // Check if this button was last clicked in this category - block if so
 const lastClickedInCategory = stateService.getLastClickedForCategory(word.category);
 const allowRepeatForCard = this.isOnlyRemainingInCard(cardWords, uniqueKey);
 if (lastClickedInCategory === uniqueKey && !allowRepeatForCard) return;
 if (stateService.isButtonLocked(uniqueKey)) return;

 // Update state with timestamp
 stateService.updateButtonState(uniqueKey, true, {
 category: word.category,
 source: word.source,
 language: word.language,
 });
 this.updateButtonProgressBar(progressBar, uniqueKey);
 this.updateCardTranslation(cardId, word);
 
 // Track last clicked per category (persists across category switches)
 stateService.setLastClickedForCategory(word.category, uniqueKey);
 };

 // Prevent context menu on word buttons
 button.oncontextmenu = (e) => e.preventDefault();
 }

 /**
 * Allow a same-word click only if it's the last unfinished word in the card.
 */
 isOnlyRemainingInCard(cardWords, uniqueKey) {
 if (!Array.isArray(cardWords) || cardWords.length === 0) return false;

 let remainingCount = 0;
 let remainingKey = null;

 cardWords.forEach((word) => {
 const key = `word-${word.globalIndex}-${word.source}`;
 if (!stateService.isButtonLocked(key)) {
 remainingCount += 1;
 remainingKey = key;
 }
 });

 return remainingCount === 1 && remainingKey === uniqueKey;
 }

 /**
 * Update button progress bar visual
 */
 updateButtonProgressBar(progressBar, uniqueKey) {
 const count = stateService.getButtonProgress(uniqueKey);
 const progress = (count / CONFIG.cards.clicksToComplete) * 100;
 progressBar.style.width = stateService.isButtonLocked(uniqueKey)
 ? "100%"
 : `${progress}%`;
 }

 /**
 * Update card translation display
 */
 updateCardTranslation(cardId, word) {
 const translationEl = document.getElementById(cardId);
 if (!translationEl) return;

 const primaryLangText = translationEl.querySelector(".primary-lang-text");
 const audioButton = translationEl.querySelector(".fc-audio-button");

 if (stateService.lastCardId && stateService.lastCardId !== cardId) {
 const prevCard = document.getElementById(stateService.lastCardId);
 if (prevCard) {
 const prevPrimaryLangText =
 prevCard.querySelector(".primary-lang-text");
 const prevAudioButton = prevCard.querySelector(".fc-audio-button");
 if (prevPrimaryLangText) prevPrimaryLangText.textContent = "";
 if (prevAudioButton) prevAudioButton.style.display = "none";
 }
 }

 // Get fresh premium status
 const currentPremiumStatus = premiumService.getPremiumStatus();
 const isPremiumWord = stateService.premiumCategories.has(word.category);
 const isWordAccessible = !isPremiumWord || currentPremiumStatus;

 if (isWordAccessible) {
 // Get current language and display appropriate text
 const currentLang = localStorage.getItem("selectedLanguage") || "es";
 let mainText = "";
 let romanization = "";

 if (currentLang === "es") {
 mainText = word.es || "";
 } else if (currentLang === "de") {
 mainText = word.de || "";
 } else if (currentLang === "fr") {
 mainText = word.fr || "";
 } else if (currentLang === "ru") {
 mainText = word.ru || "";
 } else if (currentLang === "zh") {
 mainText = word.zh || "";
 romanization = word.pinyin || "";
 } else if (currentLang === "ja") {
 mainText = word.ja || "";
 romanization = word.romaji || "";
 } else if (currentLang === "ko") {
 mainText = word.ko || "";
 romanization = word.romaja || "";
 } else if (currentLang === "it") {
 mainText = word.it || "";
 }

 // Display main text
 primaryLangText.textContent = mainText;

 // Add romanization for Asian languages (will implement styling later)
 if (romanization) {
 primaryLangText.innerHTML = `
 <div class="text-4xl font-bold">${mainText}</div>
 <div class="text-lg mt-2">${romanization}</div>
 `;
 } else {
 primaryLangText.textContent = mainText;
 }

 // Preload audio as soon as word is revealed (before user taps speaker)
 if (word.audio && !audioCache.has(word.audio)) {
  const preload = new Audio(word.audio);
  preload.preload = "auto";
  audioCache.set(word.audio, preload);
 }

 audioButton.style.display = "flex";
 audioButton.onclick = () => {
  if (!word.audio) return;
  // Stop any currently playing audio to prevent double-play
  if (currentAudio && !currentAudio.paused) {
   currentAudio.pause();
   currentAudio.currentTime = 0;
  }
  const audio = audioCache.get(word.audio) || new Audio(word.audio);
  if (!audioCache.has(word.audio)) audioCache.set(word.audio, audio);
  currentAudio = audio;
  audio.currentTime = 0;
  audio.play().catch(console.error);
 };
 } else {
 primaryLangText.textContent = "[Premium] Unlock with premium account";
 audioButton.style.display = "none";
 }

 stateService.lastCardId = cardId;
 }
}

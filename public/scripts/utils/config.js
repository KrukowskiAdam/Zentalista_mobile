// /public/scripts/utils/config.js
// Configuration constants for MellowCards application

/**
 * Get JSON URLs based on selected language
 */
function getJsonUrls(languageOverride) {
 const selectedLanguage = languageOverride ||
 localStorage.getItem("selectedLanguage") ||
 "es";
 // Use current host for local development, production URL otherwise
 const isLocal =
 window.location.hostname === "127.0.0.1" ||
 window.location.hostname === "localhost";
 const baseUrl = isLocal ? "" : "https://costam-3f612.web.app";

 // console.log('🌍 [config.js] Selected language:', selectedLanguage);
 // console.log('🌍 [config.js] Is local:', isLocal, 'Base URL:', baseUrl || 'relative');

 const urls = {
 free: `${baseUrl}/languages/${selectedLanguage}/${selectedLanguage}_en_01.json`,
 premium1: `${baseUrl}/languages/${selectedLanguage}/${selectedLanguage}_en_02.json`,
 premium2: `${baseUrl}/languages/${selectedLanguage}/${selectedLanguage}_en_03.json`,
 premium3: `${baseUrl}/languages/${selectedLanguage}/${selectedLanguage}_en_04.json`,
 premium4: `${baseUrl}/languages/${selectedLanguage}/${selectedLanguage}_en_05.json`,
 premium5: `${baseUrl}/languages/${selectedLanguage}/${selectedLanguage}_en_06.json`,
 premium6: `${baseUrl}/languages/${selectedLanguage}/${selectedLanguage}_en_07.json`,
 premium7: `${baseUrl}/languages/${selectedLanguage}/${selectedLanguage}_en_08.json`,
 premium8: `${baseUrl}/languages/${selectedLanguage}/${selectedLanguage}_en_09.json`,
 };

 // console.log('🌍 [config.js] JSON URLs:', urls);

 return urls;
}

export const CONFIG = {
 firebase: {
 apiKey: "AIzaSyA5TmUWOFkanWSVj-GU3SgDiKyD86yDgoQ",
 authDomain: "costam-3f612.firebaseapp.com",
 databaseURL: "https://costam-3f612-default-rtdb.firebaseio.com",
 projectId: "costam-3f612",
 storageBucket: "costam-3f612.firebasestorage.app",
 messagingSenderId: "767407380440",
 appId: "1:767407380440:web:eb4a082d596a7a69c384ad",
 },
 get jsonUrls() {
 return getJsonUrls();
 },
 jsonUrlsForLanguage(languageCode) {
 return getJsonUrls(languageCode);
 },
 cards: {
 groupSize: 4,
 clicksToComplete: 5, // Default: Medium profile
 buttonColors: {
 default: "bg-learning-app-design-1",
 completed: "bg-level-mastered",
	locked: "bg-learning-app-design-4",
 },
 },
 ui: {
 itemsPerPage: 2,
 },
 celebrations: {
 completionModalDelayMs: 3000,
 },
 animations: {
 // Set to a Lottie JSON file path (e.g., '/img/animations/category-celebration.json') when available
 categoryComplete: "/img/animations/confetti.json",
 cardComplete: "/img/animations/Flex_Confetti.json",
 },
};

// /public/scripts/services/languageService.js
// Language selection and management service

class LanguageService {
  constructor() {
    this.storageKey = "selectedLanguage";
    this.defaultLanguage = "es";
    this.languages = [
      {
        code: "es",
        name: "Spanish",
        flag: '<svg viewBox="0 0 32 32" class="w-full h-full"><rect y="0" x="0" height="32" width="32" fill="#c60b1e"/><rect y="11" x="0" height="10" width="32" fill="#ffc400"/></svg>',
        nativeName: "Español",
      },
      {
        code: "de",
        name: "German",
        flag: '<svg viewBox="0 0 32 32" class="w-full h-full"><rect y="0" x="0" height="11" width="32" fill="#000000"/><rect y="11" x="0" height="11" width="32" fill="#dd0000"/><rect y="22" x="0" height="10" width="32" fill="#ffce00"/></svg>',
        nativeName: "Deutsch",
      },
      {
        code: "fr",
        name: "French",
        flag: '<svg viewBox="0 0 32 32" class="w-full h-full"><rect y="0" x="0" height="32" width="11" fill="#002395"/><rect y="0" x="11" height="32" width="11" fill="#ffffff"/><rect y="0" x="22" height="32" width="10" fill="#ed2939"/></svg>',
        nativeName: "Français",
      },
      {
        code: "ru",
        name: "Russian",
        flag: '<svg viewBox="0 0 32 32" class="w-full h-full"><rect y="0" x="0" height="11" width="32" fill="#ffffff"/><rect y="11" x="0" height="11" width="32" fill="#0039a6"/><rect y="22" x="0" height="10" width="32" fill="#d52b1e"/></svg>',
        nativeName: "Русский",
      },
      {
        code: "zh",
        name: "Chinese",
        flag: '<svg viewBox="0 0 32 32" class="w-full h-full"><rect fill="#de2910" height="32" width="32" y="0" x="0"/><polygon fill="#ffde00" points="8,6 9.5,10 14,10 10.5,12.5 12,17 8,14 4,17 5.5,12.5 2,10 6.5,10"/></svg>',
        nativeName: "中文",
      },
      {
        code: "ja",
        name: "Japanese",
        flag: '<svg viewBox="0 0 32 32" class="w-full h-full"><rect fill="#ffffff" height="32" width="32" y="0" x="0"/><circle fill="#bc002d" cx="16" cy="16" r="6"/></svg>',
        nativeName: "日本語",
      },
      {
        code: "ko",
        name: "Korean",
        flag: '<svg viewBox="0 0 32 32" class="w-full h-full"><rect fill="#ffffff" height="32" width="32" y="0" x="0"/><circle fill="none" stroke="#c60c30" stroke-width="2" cx="16" cy="16" r="6"/><path fill="#003478" d="M 16 10 A 6 6 0 0 1 16 22 Z"/><path fill="#c60c30" d="M 16 10 A 6 6 0 0 0 16 22 Z"/></svg>',
        nativeName: "한국어",
      },
      {
        code: "it",
        name: "Italian",
        flag: '<svg viewBox="0 0 32 32" class="w-full h-full"><rect y="0" x="0" height="32" width="11" fill="#009246"/><rect y="0" x="11" height="32" width="11" fill="#eeeeee"/><rect y="0" x="22" height="32" width="10" fill="#ce2b36"/></svg>',
        nativeName: "Italiano",
      },
    ];
  }

  /**
   * Get currently selected language
   */
  getCurrentLanguage() {
    const stored = localStorage.getItem(this.storageKey);
    if (stored && this.isValidLanguage(stored)) {
      return stored;
    }
    return this.defaultLanguage;
  }

  /**
   * Get language details by code
   */
  getLanguageDetails(code) {
    return (
      this.languages.find((lang) => lang.code === code) || this.languages[0]
    );
  }

  /**
   * Get all available languages
   */
  getAllLanguages() {
    return this.languages;
  }

  /**
   * Check if language code is valid
   */
  isValidLanguage(code) {
    return this.languages.some((lang) => lang.code === code);
  }

  /**
   * Change language and reload page
   */
  changeLanguage(newLanguageCode) {
    if (!this.isValidLanguage(newLanguageCode)) {
      console.error("Invalid language code:", newLanguageCode);
      return;
    }

    const currentLang = this.getCurrentLanguage();
    if (currentLang === newLanguageCode) {
      return;
    }

    // Save to localStorage
    localStorage.setItem(this.storageKey, newLanguageCode);

    // Reload page immediately
    window.location.reload();
  }

  /**
   * Initialize language selector UI
   */
  initializeUI() {
    const currentLang = this.getCurrentLanguage();
    const langDetails = this.getLanguageDetails(currentLang);

    this.updateDropdownDisplay(langDetails);

    // Add click handlers
    this.attachEventListeners();
    // console.log("🌍 Language service initialized");
  }

  /**
   * Update dropdown display with current language
   */
  updateDropdownDisplay(langDetails) {
    const flagElement = document.getElementById("current-flag");
    const codeElement = document.getElementById("current-lang-code");
    const nameElement = document.getElementById("current-lang-name");

    if (flagElement) flagElement.innerHTML = langDetails.flag;
    if (codeElement) codeElement.textContent = langDetails.code.toUpperCase();
    if (nameElement) nameElement.textContent = langDetails.name;
  }

  /**
   * Attach click event listeners to language options
   */
  attachEventListeners() {
    const languageLinks = document.querySelectorAll("[data-language]");
    // console.log("🌍 Found", languageLinks.length, "language links");

    languageLinks.forEach((element) => {
      element.addEventListener("click", (e) => {
        e.preventDefault();
        const langCode = element.getAttribute("data-language");
        this.changeLanguage(langCode);
      });
    });
  }
}

// Create singleton instance
export const languageService = new LanguageService();

// Expose to window for EJS templates
window.languageService = languageService;

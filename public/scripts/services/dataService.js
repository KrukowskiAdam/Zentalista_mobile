// /public/scripts/services/dataService.js
// Data fetching and processing service

import { CONFIG } from "../utils/config.js";
import { stateService } from "./stateService.js";
import { fetchWithTimeout } from "../utils/helpers.js";

const PREMIUM_SOURCES = [
  "premium1",
  "premium2",
  "premium3",
  "premium4",
  "premium5",
  "premium6",
  "premium7",
  "premium8",
];

class DataService {
  constructor() {
    this.allWords = [];
    this.categories = [];
  }

  /**
   * Fetch all cards data from JSON endpoints
   */
  async fetchAllCards() {
    try {
      const currentLanguage =
        localStorage.getItem("selectedLanguage") || "es";
      const { categories, allWords } = await this.fetchLanguageBundle(
        currentLanguage
      );

      this.categories = categories;
      this.allWords = allWords;

      // Update state service
      stateService.totalWordCount = this.allWords.length;
      stateService.groupId = 1; // Reset before regrouping to align ids with slices
      stateService.cardsData = this.groupDataIntoCards(this.allWords);

      // Mark premium categories
      this.markPremiumCategories();


      return stateService.cardsData.length > 0;
    } catch (error) {
      console.error("Error loading cards:", error);
      return false;
    }
  }

  async fetchLanguageBundle(languageCode) {
    const urls =
      typeof CONFIG.jsonUrlsForLanguage === "function"
        ? CONFIG.jsonUrlsForLanguage(languageCode)
        : CONFIG.jsonUrls;

    const freeResponse = await fetchWithTimeout(
      `${urls.free}?nocache=${Date.now()}`,
      {
        cache: "no-store",
      }
    );

    if (!freeResponse.ok)
      throw new Error(`HTTP Error: ${freeResponse.status}`);
    const freeData = await freeResponse.json();

    const premiumResponses = await Promise.all(
      PREMIUM_SOURCES.map((source) =>
        fetchWithTimeout(`${urls[source]}?nocache=${Date.now()}`, {
          cache: "no-store",
        })
      )
    );

    const premiumDataArray = await Promise.all(
      premiumResponses.map(async (response, index) => {
        if (response.ok) {
          const data = await response.json();
          return data.categories.map((c) => ({
            ...c,
            source: PREMIUM_SOURCES[index],
            language: languageCode,
          }));
        }
        return [];
      })
    );

    const categories = [
      ...freeData.categories.map((c) => ({
        ...c,
        source: "free",
        language: languageCode,
      })),
      ...premiumDataArray.flat(),
    ];

    const allWords = this.extractWordsFromCategories(categories, languageCode);
    this.processWordData(allWords, languageCode);

    return { categories, allWords };
  }

  /**
   * Extract individual words from categories
   */
  extractWordsFromCategories(categories, languageCode) {
    const allWords = [];
    let globalIndex = 0;

    categories.forEach((category) => {
      if (category.words && Array.isArray(category.words)) {
        category.words.forEach((word) => {
          // Every word gets a unique globalIndex regardless of duplicates
          allWords.push({
            ...word,
            category: category.name,
            source: category.source,
            language: category.language || languageCode,
            globalIndex: globalIndex++,
          });
        });
      }
    });

    return allWords;
  }

  /**
   * Process and validate word data
   */
  processWordData(data, languageCode) {
    const currentLang = languageCode ||
      localStorage.getItem("selectedLanguage") ||
      "es";

    data.forEach((word) => {
      // Always ensure English exists
      word.en = word.en || "";
      word.audio = word.audio || "";

      // Ensure main language field exists
      if (currentLang === "es") {
        word.es = word.es || "";
      } else if (currentLang === "de") {
        word.de = word.de || "";
      } else if (currentLang === "fr") {
        word.fr = word.fr || "";
      } else if (currentLang === "ru") {
        word.ru = word.ru || "";
      } else if (currentLang === "zh") {
        word.zh = word.zh || "";
        word.pinyin = word.pinyin || "";
      } else if (currentLang === "ja") {
        word.ja = word.ja || "";
        word.romaji = word.romaji || "";
      } else if (currentLang === "ko") {
        word.ko = word.ko || "";
        word.romaja = word.romaja || "";
      } else if (currentLang === "it") {
        word.it = word.it || "";
      }
    });
  }

  /**
   * Group words into cards
   */
  groupDataIntoCards(data) {
    const grouped = [];
    for (let i = 0; i < data.length; i += CONFIG.cards.groupSize) {
      grouped.push({
        id: stateService.groupId++,
        words: data.slice(i, i + CONFIG.cards.groupSize),
      });
    }
    return grouped;
  }

  /**
   * Load words for specific cards
   */
  async loadCardsForCards(cardsArray) {
    cardsArray.forEach((card) => {
      if (!card.words) {
        card.words = this.allWords.slice(
          (card.id - 1) * CONFIG.cards.groupSize,
          card.id * CONFIG.cards.groupSize
        );
      }
    });
  }

  /**
   * Fetch all categories for menu display
   */
  async fetchAllCategoriesForMenu() {
    const sources = [
      { key: "free", isPremium: false },
      { key: "premium1", isPremium: true },
      { key: "premium2", isPremium: true },
      { key: "premium3", isPremium: true },
      { key: "premium4", isPremium: true },
      { key: "premium5", isPremium: true },
      { key: "premium6", isPremium: true },
      { key: "premium7", isPremium: true },
      { key: "premium8", isPremium: true },
    ];

    try {
      // Use cache if available and recent
      if (
        stateService.categoryCache &&
        Date.now() - stateService.lastCategoryFetchTime < 300000
      ) {
        // 5 minutes
        return stateService.categoryCache;
      }

      const cacheBuster = Date.now();
      const dataArray = await Promise.all(
        sources.map(async (source, index) => {
          const response = await fetchWithTimeout(
            `${CONFIG.jsonUrls[source.key]}?nocache=${cacheBuster}`,
            { cache: "no-store" }
          );
          const sourceKey = source.key;
          if (response.ok) {
            const data = await response.json();
            if (source.isPremium) {
              data.categories.forEach((cat) =>
                stateService.premiumCategories.add(cat.name)
              );
            }
            return {
              key: `${sourceKey}Categories`,
              categories: data.categories.map((c) => ({
                ...c,
                source: sourceKey,
              })),
            };
          }
          return { key: `${sourceKey}Categories`, categories: [] };
        })
      );

      const result = dataArray.reduce((obj, item) => {
        obj[item.key] = item.categories;
        return obj;
      }, {});

      stateService.categoryCache = result;
      stateService.lastCategoryFetchTime = Date.now();
      return result;
    } catch (error) {
      console.error("Error loading categories for menu:", error);
      return sources.reduce((obj, source) => {
        obj[`${source.key}Categories`] = [];
        return obj;
      }, {});
    }
  }

  /**
   * Mark premium categories in state
   */
  markPremiumCategories() {
    this.categories.forEach((category) => {
      if (category.source !== "free") {
        stateService.premiumCategories.add(category.name);
      }
    });
  }

  /**
   * Check if word is accessible based on premium status
   */
  isWordAccessible(word) {
    return stateService.isWordAccessible(word);
  }
}

// Create singleton instance
export const dataService = new DataService();

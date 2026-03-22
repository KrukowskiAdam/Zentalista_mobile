// /public/scripts/services/uiService.js
// UI rendering and management service

import { createElement } from "../utils/helpers.js";
import { stateService } from "./stateService.js";
import { dataService } from "./dataService.js";
import { premiumService } from "./premiumService.js";
import { CardComponent } from "../components/cardComponent.js";
import { SidebarComponent } from "../components/sidebarComponent.js";
import { ProgressBarComponent } from "../components/progressBarComponent.js";

class UIService {
  constructor() {
    this.cardComponent = new CardComponent();
    this.sidebarComponent = new SidebarComponent();
    this.progressBarComponent = new ProgressBarComponent();
  }

  /**
   * Render main cards interface
   */
  async renderCards() {
    try {
      const mainContent = document.getElementById("main-content");
      if (!mainContent) return false;

      // Clear content first
      mainContent.innerHTML = "";

      const cardsContainer = createElement("div", {
        id: "cards-container",
        className: "container mx-auto p-4 pb-8 text-white",
        parent: mainContent,
      });

      this.renderPremiumBanner();

      const cardsGrid = createElement("div", {
        id: "cards-grid",
        className: "grid grid-cols-1 gap-y-28 place-items-center",
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
            (word) => word.source === "free"
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
      gridContainer.innerHTML = "";
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

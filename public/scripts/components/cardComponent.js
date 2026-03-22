// /public/scripts/components/cardComponent.js
// Card creation and management component

import { CONFIG } from '../utils/config.js';
import { createElement } from '../utils/helpers.js';
import { ButtonComponent } from './buttonComponent.js';

export class CardComponent {
  constructor() {
    this.buttonComponent = new ButtonComponent();
  }

  /**
   * Create translation element for card
   */
  createTranslationElement(id, parent) {
    const translationEl = createElement("div", {
      id: id,
      className: "h-80 flex items-center justify-center font-bold text-white bg-dark-card rounded-[12px] mb-1 relative overflow-hidden px-4 min-w-0 w-full",
      parent: parent
    });

    createElement("div", { className: "primary-lang-text text-white", parent: translationEl });

    createElement("button", {
      className: "fc-audio-button text-white absolute bottom-4 left-1/2 transform -translate-x-1/2 p-2 rounded-full hover:bg-opacity-75 transition-all",
      html: `
        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
        </svg>
      `,
      styles: { display: "none" },
      parent: translationEl
    });

    return translationEl;
  }

  /**
   * Create complete card element
   */
  createCardElement(card, index) {
    try {
      const cardDiv = createElement("div", { 
        className: "card bg-dark-border shadow-xl group" 
      });
      
      const cardBody = createElement("div", { 
        className: "card-body p-2 flex flex-col shadow-xl justify-between border border-transparent", 
        parent: cardDiv 
      });

      const translationId = `card${card.id}`;
      this.createTranslationElement(translationId, cardBody);

      const buttonsContainer = createElement("div", {
        id: `buttons${card.id}`,
        className: "grid gap-2 p-0 w-full",
        styles: {
          display: "grid",
          gridTemplateColumns: `repeat(${CONFIG.ui.itemsPerPage}, 1fr)`
        },
        parent: cardBody
      });

      card.words?.forEach((word) => {
        const button = this.buttonComponent.createWordButton(word, translationId, card.words);
        buttonsContainer.appendChild(button);
      });

      return cardDiv;
    } catch (error) {
      console.error("Error creating card element:", error);
      return document.createElement("div");
    }
  }
}

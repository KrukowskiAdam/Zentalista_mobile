// /public/scripts/components/progressBarComponent.js
// Progress bar management component

import { CONFIG } from '../utils/config.js';
import { stateService } from '../services/stateService.js';

export class ProgressBarComponent {
  
  /**
   * Update all progress bars in the interface
   */
  updateAllProgressBars() {
    const buttons = document.querySelectorAll('.fc-button');
    
    buttons.forEach(button => {
      const progressBar = button.querySelector('span[class*="bg-level-expert-progress"]');
      if (!progressBar) return;

      // Get word data from button's dataset or find by context
      const buttonText = button.textContent.trim();
      
      // Find the specific word by checking the parent card context
      const cardElement = button.closest('.card');
      const cardId = cardElement?.querySelector('[id^="card"]')?.id;
      
      if (!cardId) return;
      
      // Extract card number from cardId (e.g., "card123" -> 123)
      const cardNumber = parseInt(cardId.replace('card', ''));
      
      // Find the corresponding card data
      const cardData = stateService.cardsData.find(c => c.id === cardNumber);
      if (!cardData || !cardData.words) return;
      
      // Find the word within this specific card by button position
      const buttonsInCard = cardElement.querySelectorAll('.fc-button');
      const buttonIndex = Array.from(buttonsInCard).indexOf(button);
      
      const wordObj = cardData.words[buttonIndex];
      if (!wordObj) return;

      const key = `word-${wordObj.globalIndex}-${wordObj.source}`;
      const buttonState = stateService.buttonStates[key];
      if (!buttonState) {
        progressBar.style.width = "0%";
        return;
      }

      const progress = buttonState.count || 0;
      const maxClicks = CONFIG.cards.clicksToComplete;
      const progressPercentage = Math.min((progress / maxClicks) * 100, 100);

      progressBar.style.width = buttonState.locked ? "100%" : `${progressPercentage}%`;
    });
  }

  /**
   * Update specific progress bar
   */
  updateProgressBar(progressBarElement, uniqueKey) {
    const count = stateService.getButtonProgress(uniqueKey);
    const progress = (count / CONFIG.cards.clicksToComplete) * 100;
    progressBarElement.style.width = stateService.isButtonLocked(uniqueKey) ? "100%" : `${progress}%`;
  }
}

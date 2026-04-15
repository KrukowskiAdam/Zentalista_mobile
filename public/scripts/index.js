// public/scripts/index.js

const CLASSES = {
  HIDDEN: "hidden",
  AUTH_LOGGED_OUT: ".auth-logged-out",
  AUTH_LOGGED_IN: ".auth-logged-in",
};

const getElements = () => {
  return {
    authLoggedOut: document.querySelectorAll(CLASSES.AUTH_LOGGED_OUT) || [],
    authLoggedIn: document.querySelectorAll(CLASSES.AUTH_LOGGED_IN) || [],
    accountDetails: document.querySelector(".account-details"),
    premiumStatusDiv: document.getElementById("user-is-premium"),
    regularStatusDiv: document.getElementById("user-is-regular"),
    priceCards: document.getElementById("price-cards"),
    featuresList: document.getElementById("features-list"),
    userCard: document.getElementById("user-card"),
  };
};

const toggleElementsVisibility = (elements, shouldShow) => {
  elements.forEach((element) => {
    element?.classList.toggle(CLASSES.HIDDEN, !shouldShow);
  });
};

const updateAccountDetails = (element, user) => {
  if (!element) return;
  element.textContent = `Zalogowany jako ${user.email}`;
  element.style.display = "block";
};

const updateMenuAvatar = (user, avatarData) => {
  const avatarIcon = document.getElementById("menu-avatar-icon");
  const avatarImg = document.getElementById("menu-avatar-img");
  
  if (!avatarIcon || !avatarImg) return;
  
  if (user && avatarData) {
    // Show avatar image, hide default icon
    const avatarUrl = avatarData.avatarUrl || 
      `https://api.dicebear.com/7.x/${avatarData.avatarStyle || 'adventurer'}/svg?seed=${avatarData.avatarSeed || user.uid}`;
    avatarImg.src = avatarUrl;
    avatarImg.classList.remove("hidden");
    avatarIcon.classList.add("hidden");
    
    // Cache avatar in localStorage for instant load on refresh
    // Skip if profile page saved a fresher avatar within the last 30 seconds
    try {
      const existing = JSON.parse(localStorage.getItem('mc_menu_avatar') || '{}');
      const isFreshProfileSave = existing.savedAt && (Date.now() - existing.savedAt < 30000);
      if (!isFreshProfileSave) {
        localStorage.setItem('mc_menu_avatar', JSON.stringify({
          uid: user.uid,
          avatarUrl: avatarUrl
        }));
      }
    } catch (e) {
      console.warn('Could not cache avatar:', e);
    }
  } else {
    // Show default icon, hide avatar image
    avatarImg.classList.add("hidden");
    avatarIcon.classList.remove("hidden");
    
    // Clear cached avatar
    try {
      localStorage.removeItem('mc_menu_avatar');
      localStorage.removeItem('mc_auth_state');
    } catch (e) {}
  }
};

const syncAuthMenuVisibility = (isLoggedIn) => {
  document.documentElement.classList.add('auth-ready');
  document.querySelectorAll('.auth-logged-in').forEach((el) => {
    el.classList.toggle('hidden', !isLoggedIn);
  });
  document.querySelectorAll('.auth-logged-out').forEach((el) => {
    el.classList.toggle('hidden', isLoggedIn);
  });
};

// Load cached auth state immediately on page load to prevent flash
const loadCachedAuthState = () => {
  try {
    // Load cached auth state
    const authState = localStorage.getItem('mc_auth_state');
    if (authState === 'logged-in') {
      syncAuthMenuVisibility(true);
    } else if (authState === 'logged-out') {
      syncAuthMenuVisibility(false);
    }
    
    // Load cached avatar
    const cached = localStorage.getItem('mc_menu_avatar');
    if (cached) {
      const { avatarUrl } = JSON.parse(cached);
      const avatarIcon = document.getElementById("menu-avatar-icon");
      const avatarImg = document.getElementById("menu-avatar-img");
      
      if (avatarIcon && avatarImg && avatarUrl) {
        avatarImg.src = avatarUrl;
        avatarImg.classList.remove("hidden");
        avatarIcon.classList.add("hidden");
      }
    }
  } catch (e) {
    console.warn('Could not load cached auth state:', e);
  }
};

const getCachedPaidPremium = () => {
  try {
    const cachedRaw = localStorage.getItem("mc_premium_status_cache");
    if (!cachedRaw) return false;
    const cached = JSON.parse(cachedRaw);
    return Boolean(cached?.isPaidPremium);
  } catch (e) {
    return false;
  }
};

// Run immediately when script loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadCachedAuthState);
} else {
  loadCachedAuthState();
}

// Expose updateMenuAvatar globally for profile.js to use
window.updateMenuAvatar = updateMenuAvatar;

let elements;

// Najważniejsza zmiana - usunięcie debounce i natychmiastowa inicjalizacja
const initialize = () => {
  elements = getElements();

  // Ensure all modals are closed on page load
  const modalCheckboxes = ['modal-login', 'modal-signup', 'modal-forgot-password'];
  modalCheckboxes.forEach(id => {
    const checkbox = document.getElementById(id);
    if (checkbox) {
      checkbox.checked = false;
    }
  });

  // console.log('🔍 [index.js] Checking window.languageService:', !!window.languageService);

  // Initialize language service UI (if available)
  if (window.languageService) {
    // console.log('🔍 [index.js] Calling languageService.initializeUI()');
    window.languageService.initializeUI();
  } else {
    console.warn("🔍 [index.js] languageService not available yet, will retry");
    // Retry after a short delay
    setTimeout(() => {
      if (window.languageService) {
        window.languageService.initializeUI();
      } else {
        console.error("🔍 [index.js] languageService still not available");
      }
    }, 100);
  }

  // Domyślnie pokazuj karty cen, ale jeśli cache mówi że premium — pokaż kartę premium od razu
  if (elements.priceCards && elements.userCard) {
    const cachedPaidPremium = getCachedPaidPremium();
    toggleElementsVisibility([elements.priceCards, elements.featuresList], !cachedPaidPremium);
    toggleElementsVisibility([elements.userCard], cachedPaidPremium);
  }

  // Ensure only one FAQ item is open at a time, while allowing toggle close on re-click
  const setupFaqSingleOpenBehavior = () => {
    const faqSection = document.getElementById("faq-section");
    if (!faqSection) return;
    const faqs = Array.from(
      faqSection.querySelectorAll(
        'input[name="faq-accordion"][type="checkbox"]'
      )
    );
    if (!faqs.length) return;

    faqs.forEach((cb) => {
      cb.addEventListener("change", () => {
        if (cb.checked) {
          // Uncheck all others
          faqs.forEach((other) => {
            if (other !== cb) other.checked = false;
          });
        }
        // If unchecked, do nothing – allows toggle close
      });
    });
  };
  setupFaqSingleOpenBehavior();

  // console.debug("DOM załadowany");
};
document.addEventListener("DOMContentLoaded", initialize);

export const setupUI = (user, isPremium = false, avatarData = null) => {
  elements = getElements();

  // DODAJ TO - eksportuj status premium globalnie
  window.isPremiumUser = Boolean(isPremium);
  window.currentUser = user
    ? {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || user.email?.split("@")[0] || "",
      }
    : null;
  // console.log('🔍 [setupUI] Setting window.isPremiumUser to:', window.isPremiumUser);

  // Update menu avatar
  updateMenuAvatar(user, avatarData);

  // Dispatch event to notify other services about auth state change
  window.dispatchEvent(
    new CustomEvent("authStateChanged", {
      detail: { user, isPremium: Boolean(isPremium) },
    })
  );

  // Mark auth as ready to show elements
  document.documentElement.classList.add('auth-ready');

  // Zawsze resetuj widoczność kart na początku
  toggleElementsVisibility([elements.priceCards, elements.featuresList, elements.userCard], false);

  if (user) {
    // Cache auth state for instant load on refresh
    try {
      localStorage.setItem('mc_auth_state', 'logged-in');
    } catch (e) {}
    
    updateAccountDetails(elements.accountDetails, user);

    toggleElementsVisibility(elements.authLoggedIn, true);
    toggleElementsVisibility(elements.authLoggedOut, false);
    syncAuthMenuVisibility(true);

    const isPremiumUser = Boolean(isPremium);
    let isPaidPremium = false;
    if (user) {
      try {
        const cachedRaw = localStorage.getItem("mc_premium_status_cache");
        if (cachedRaw) {
          const cached = JSON.parse(cachedRaw);
          if (cached && cached.uid === user.uid && cached.isPaidPremium === true) {
            isPaidPremium = true;
          }
        }
      } catch (e) {
        // Ignore cache read errors
      }
    }

    // If current premium flag is false, never show premium card from stale cache
    if (!isPremiumUser) {
      isPaidPremium = false;
    }

    // Widoczność kart
    toggleElementsVisibility([elements.priceCards, elements.featuresList], !isPaidPremium);
    toggleElementsVisibility([elements.userCard], isPaidPremium);

    // Statusy
    toggleElementsVisibility([elements.premiumStatusDiv], isPremiumUser);
    toggleElementsVisibility([elements.regularStatusDiv], !isPremiumUser);
  } else {
    // Check if this is just Firebase SDK initializing (not a real logout)
    // If cached state says logged-in, don't flash the menu to logged-out
    const cachedAuth = localStorage.getItem('mc_auth_state');
    if (cachedAuth === 'logged-in') {
      // Firebase SDK hasn't verified session yet — keep menu as-is
      return;
    }

    // Cache auth state for instant load on refresh
    try {
      localStorage.setItem('mc_auth_state', 'logged-out');
      // Clear user ID to prevent data leaks
      localStorage.removeItem('mc_current_user_id');
    } catch (e) {}
    
    // DODAJ TO - gdy użytkownik się wyloguje
    window.isPremiumUser = false;
    window.currentUser = null;

    if (elements.accountDetails) {
      elements.accountDetails.textContent = "";
      elements.accountDetails.style.display = "none";
    }

    toggleElementsVisibility(elements.authLoggedIn, false);
    toggleElementsVisibility(elements.authLoggedOut, true);
    syncAuthMenuVisibility(false);

    // Tylko karty cenowe widoczne dla niezalogowanych
    toggleElementsVisibility([elements.priceCards, elements.featuresList], true);
  }
};

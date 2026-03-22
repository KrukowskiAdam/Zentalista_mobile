import { iapService } from "../services/iapService.js";

const statusNode = () => document.getElementById("iap-status");
const infoNoteNode = () => document.getElementById("iap-price-note");

const STATUS_CLASS_BY_TONE = {
  info: "text-gray-200 border-dark-border bg-dark-card/40",
  success: "text-green-300 border-green-500/30 bg-green-500/10",
  error: "text-red-300 border-red-500/30 bg-red-500/10",
};

function setStatus(message, tone = "info") {
  const el = statusNode();
  if (!el) return;

  const toneClass = STATUS_CLASS_BY_TONE[tone] || STATUS_CLASS_BY_TONE.info;
  el.className = `mt-3 text-sm rounded-md border px-3 py-2 min-h-[44px] flex items-center justify-center ${toneClass}`;
  el.setAttribute("role", tone === "error" ? "alert" : "status");
  el.setAttribute("aria-live", "polite");
  el.textContent = message;
}

function setButtonBusy(button, busy, busyLabel) {
  if (!button) return;

  if (!button.dataset.defaultLabel) {
    button.dataset.defaultLabel = button.textContent.trim();
  }

  button.disabled = busy;
  button.classList.toggle("opacity-70", busy);
  button.classList.toggle("cursor-wait", busy);
  button.classList.toggle("cursor-not-allowed", busy);
  button.setAttribute("aria-busy", busy ? "true" : "false");

  if (busy) {
    button.textContent = busyLabel;
  } else {
    button.textContent = button.dataset.defaultLabel;
  }
}

function setupButtonsForContext() {
  const ctaButtons = document.querySelectorAll("[data-iap-package]");
  const nativePaywallButtons = document.querySelectorAll("[data-iap-native-paywall]");
  const restoreButton = document.getElementById("iap-restore");

  if (!ctaButtons.length) return;

  if (!iapService.isNativeApp()) {
    ctaButtons.forEach((button) => {
      button.disabled = true;
      button.classList.add("cursor-not-allowed", "opacity-70");
      button.setAttribute("aria-disabled", "true");
      button.textContent = "Available in iOS/Android app";
    });

    nativePaywallButtons.forEach((button) => {
      button.disabled = true;
      button.classList.add("cursor-not-allowed", "opacity-70");
      button.setAttribute("aria-disabled", "true");
      button.textContent = "Available in iOS/Android app";
    });

    if (restoreButton) {
      restoreButton.disabled = true;
      restoreButton.classList.add("cursor-not-allowed", "opacity-70");
      restoreButton.setAttribute("aria-disabled", "true");
    }

    setStatus("Open Zentalist in the mobile app to buy or restore Premium.");
    return;
  }

  infoNoteNode()?.classList.remove("hidden");
  setStatus("Sign in and choose a plan to continue.");
}

function bindNativePaywallHandlers() {
  const nativePaywallButtons = document.querySelectorAll("[data-iap-native-paywall]");

  nativePaywallButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.currentUser?.uid) {
        const loginModal = document.getElementById("modal-login");
        if (loginModal) loginModal.checked = true;
        setStatus("Sign in first to continue with purchase.", "error");
        return;
      }

      setButtonBusy(button, true, "Opening paywall...");
      setStatus("Opening secure paywall...");

      const paywallResult = await iapService.presentNativePaywall();
      setButtonBusy(button, false);

      if (paywallResult.ok && paywallResult.hasPremiumEntitlement) {
        setStatus("Premium unlocked successfully.", "success");
        return;
      }

      if (paywallResult.reason === "cancelled") {
        setStatus("Purchase cancelled.");
        return;
      }

      if (paywallResult.reason === "not-presented") {
        setStatus("Paywall is not configured yet.", "error");
        return;
      }

      setStatus("Paywall failed. Please try again.", "error");
    });
  });
}

function bindPurchaseHandlers() {
  const ctaButtons = document.querySelectorAll("[data-iap-package]");
  const restoreButton = document.getElementById("iap-restore");

  ctaButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const packageType = button.dataset.iapPackage;

      if (!window.currentUser?.uid) {
        const loginModal = document.getElementById("modal-login");
        if (loginModal) loginModal.checked = true;
        setStatus("Sign in first to continue with purchase.", "error");
        return;
      }

      if (!packageType) {
        setButtonBusy(button, true, "Opening paywall...");
        setStatus("Opening secure paywall...");

        const paywallResult = await iapService.presentNativePaywall();
        setButtonBusy(button, false);

        if (paywallResult.ok && paywallResult.hasPremiumEntitlement) {
          setStatus("Premium unlocked successfully.", "success");
          return;
        }

        if (paywallResult.reason === "cancelled") {
          setStatus("Purchase cancelled.");
          return;
        }

        if (paywallResult.reason === "not-presented") {
          setStatus("Paywall is not configured yet.", "error");
          return;
        }

        setStatus("Paywall failed. Please try again.", "error");
        return;
      }

      setButtonBusy(button, true, "Processing...");
      setStatus("Processing purchase...");

      const result = await iapService.purchasePackageType(packageType);
      setButtonBusy(button, false);

      if (result.ok && result.hasPremiumEntitlement) {
        setStatus("Premium unlocked successfully.", "success");
        return;
      }

      if (result.reason === "cancelled") {
        setStatus("Purchase cancelled.");
        return;
      }

      setStatus("Purchase failed. Please try again.", "error");
    });
  });

  restoreButton?.addEventListener("click", async () => {
    if (!window.currentUser?.uid) {
      const loginModal = document.getElementById("modal-login");
      if (loginModal) loginModal.checked = true;
      setStatus("Sign in first to restore purchases.", "error");
      return;
    }

    setButtonBusy(restoreButton, true, "Restoring...");
    setStatus("Restoring purchases...");

    const result = await iapService.restorePurchases();
    setButtonBusy(restoreButton, false);

    if (result.ok && result.hasPremiumEntitlement) {
      setStatus("Purchases restored. Premium is active.", "success");
      return;
    }

    if (result.ok) {
      setStatus("No active subscription found for this account.");
      return;
    }

    setStatus("Restore failed. Please try again.", "error");
  });
}

async function initializeIAPForCurrentUser() {
  if (!iapService.isNativeApp()) return;

  setStatus("Checking in-app purchase availability...");

  const currentUserId = window.currentUser?.uid || null;
  const initResult = await iapService.initialize(currentUserId);

  if (!initResult.enabled) {
    if (initResult.reason === "missing-api-key") {
      setStatus("IAP is not configured yet. Add RevenueCat API keys.", "error");
      return;
    }

    setStatus("IAP unavailable on this build.", "error");
    return;
  }

  setStatus("IAP ready. Choose a plan.");
}

document.addEventListener("DOMContentLoaded", async () => {
  setupButtonsForContext();
  bindNativePaywallHandlers();
  bindPurchaseHandlers();
  await initializeIAPForCurrentUser();
});

window.addEventListener("authStateChanged", async (event) => {
  const user = event?.detail?.user || null;
  await iapService.initialize(user?.uid || null);
  if (user) {
    setStatus("IAP ready. Choose a plan.");
  } else {
    setStatus("Sign in and choose a plan to continue.");
  }
});

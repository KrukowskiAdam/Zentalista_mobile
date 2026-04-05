import { IAP_CONFIG } from "../config/iapConfig.js";

class IAPService {
  constructor() {
    this.isReady = false;
    this.currentUserId = null;
    this.paywallResult = {
      purchased: "PURCHASED",
      restored: "RESTORED",
      cancelled: "CANCELLED",
      error: "ERROR",
      notPresented: "NOT_PRESENTED",
    };
  }

  isNativeApp() {
    if (typeof window === "undefined") return false;

    if (typeof window.__MOBILE_APP__ === "boolean") {
      return window.__MOBILE_APP__;
    }

    return Boolean(window.Capacitor?.isNativePlatform?.());
  }

  getPlatform() {
    return window.Capacitor?.getPlatform?.() || "web";
  }

  getPlugin() {
    return window.Capacitor?.Plugins?.Purchases;
  }

  getPaywallPlugin() {
    return window.Capacitor?.Plugins?.RevenueCatUI;
  }

  getApiKeyForPlatform() {
    const platform = this.getPlatform();
    if (platform === "ios") return IAP_CONFIG.iosApiKey;
    if (platform === "android") return IAP_CONFIG.androidApiKey;
    return "";
  }

  async initialize(appUserID = null) {
    if (!this.isNativeApp()) return { enabled: false, reason: "not-native" };

    const Purchases = this.getPlugin();
    if (!Purchases) return { enabled: false, reason: "plugin-missing" };

    const apiKey = this.getApiKeyForPlatform();
    if (!apiKey) {
      return { enabled: false, reason: "missing-api-key" };
    }

    try {
      if (!this.isReady) {
        await Purchases.configure({ apiKey });
        this.isReady = true;
      }

      if (appUserID && appUserID !== this.currentUserId) {
        await Purchases.logIn({ appUserID });
        this.currentUserId = appUserID;
      }

      const { customerInfo } = await Purchases.getCustomerInfo();
      this.emitEntitlementStatus(customerInfo);

      return { enabled: true, customerInfo };
    } catch (error) {
      console.error("IAP initialize failed:", error);
      return { enabled: false, reason: "init-failed", error };
    }
  }

  getEntitlementStatus(customerInfo) {
    const entitlement = customerInfo?.entitlements?.active?.[IAP_CONFIG.entitlementId];
    return Boolean(entitlement);
  }

  hasActiveEntitlement(customerInfo, entitlementId = IAP_CONFIG.entitlementId) {
    return Boolean(customerInfo?.entitlements?.active?.[entitlementId]);
  }

  emitEntitlementStatus(customerInfo) {
    const hasPremiumEntitlement = this.getEntitlementStatus(customerInfo);

    window.dispatchEvent(
      new CustomEvent("iap:entitlementChanged", {
        detail: {
          hasPremiumEntitlement,
          customerInfo,
          entitlementId: IAP_CONFIG.entitlementId,
        },
      })
    );

    return hasPremiumEntitlement;
  }

  async getOfferings() {
    const Purchases = this.getPlugin();
    if (!Purchases || !this.isReady) return null;

    const offerings = await Purchases.getOfferings();
    return offerings?.current || null;
  }

  pickPackage(offering, packageType) {
    if (!offering) return null;

    const direct = offering[packageType];
    if (direct) return direct;

    return offering.availablePackages?.find((pkg) => {
      const identifier = String(pkg?.identifier || "").toLowerCase();
      return identifier.includes(packageType);
    }) || null;
  }

  async purchasePackageType(packageType) {
    const Purchases = this.getPlugin();
    if (!Purchases || !this.isReady) {
      return { ok: false, reason: "not-ready" };
    }

    try {
      const offering = await this.getOfferings();
      const selectedPackage = this.pickPackage(offering, packageType);

      if (!selectedPackage) {
        return { ok: false, reason: "package-not-found" };
      }

      const { customerInfo } = await Purchases.purchasePackage({
        aPackage: selectedPackage,
      });

      const hasPremiumEntitlement = this.emitEntitlementStatus(customerInfo);
      return {
        ok: true,
        hasPremiumEntitlement,
        customerInfo,
      };
    } catch (error) {
      if (error?.userCancelled) {
        return { ok: false, reason: "cancelled" };
      }

      console.error("IAP purchase failed:", error);
      return { ok: false, reason: "purchase-failed", error };
    }
  }

  async restorePurchases() {
    const Purchases = this.getPlugin();
    if (!Purchases || !this.isReady) {
      return { ok: false, reason: "not-ready" };
    }

    try {
      const { customerInfo } = await Purchases.restorePurchases();
      const hasPremiumEntitlement = this.emitEntitlementStatus(customerInfo);

      return {
        ok: true,
        hasPremiumEntitlement,
        customerInfo,
      };
    } catch (error) {
      console.error("IAP restore failed:", error);
      return { ok: false, reason: "restore-failed", error };
    }
  }

  async presentNativePaywall() {
    const RevenueCatUI = this.getPaywallPlugin();
    if (!RevenueCatUI || !this.isReady) {
      return { ok: false, reason: "paywall-not-ready" };
    }

    try {
      const response = await RevenueCatUI.presentPaywall();
      const result = String(response?.result || "").toUpperCase();

      if (
        result === this.paywallResult.purchased ||
        result === this.paywallResult.restored
      ) {
        const { customerInfo } = await this.getPlugin().getCustomerInfo();
        const hasPremiumEntitlement = this.emitEntitlementStatus(customerInfo);

        return {
          ok: true,
          result,
          hasPremiumEntitlement,
          customerInfo,
        };
      }

      if (result === this.paywallResult.cancelled) {
        return { ok: false, reason: "cancelled", result };
      }

      if (result === this.paywallResult.notPresented) {
        return { ok: false, reason: "not-presented", result };
      }

      if (result === this.paywallResult.error) {
        return { ok: false, reason: "paywall-error", result };
      }

      return { ok: false, reason: "unknown-result", result };
    } catch (error) {
      console.error("Native paywall failed:", error);
      return { ok: false, reason: "paywall-failed", error };
    }
  }
}

export const iapService = new IAPService();
window.iapService = iapService;

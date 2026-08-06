"use client";

// =============================================================================
// PromoBanner — usage/limit banner shown only to "promo" (student) accounts.
// Surfaces how many matters + AI calls they have left, the expiry, and an
// explicit upgrade CTA. Regular free-trial and paid accounts see nothing.
// =============================================================================

import { useState } from "react";
import { Sparkles, Zap, Lock, X } from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/components/providers/language-provider";
import { useMatters } from "@/components/providers/matters-provider";
import SubscriptionPaywallModal from "@/components/subscription/subscription-paywall-modal";

export default function PromoBanner() {
  const { user } = useAuth();
  const { isRtl } = useLanguage();
  const { matters } = useMatters();
  const [openPaywall, setOpenPaywall] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const promo = user?.accessKind === "promo";
  if (!promo || dismissed) return null;

  const mattersUsed = matters?.length ?? 0;
  const mattersMax = user?.promoMaxMatters ?? 0;
  const aiUsed = user?.promoAiUsed ?? 0;
  const aiQuota = user?.promoAiQuota ?? 0;
  const aiQuotaPeriod = user?.promoAiQuotaPeriod ?? "total";
  const expiresAt = user?.promoExpiresAt;

  const mattersExhausted = mattersMax > 0 && mattersUsed >= mattersMax;
  const aiExhausted = aiQuota > 0 && aiUsed >= aiQuota;

  return (
    <>
      <div
        className={`mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${
          mattersExhausted || aiExhausted
            ? "border-amber-400/40 bg-amber-500/10 text-amber-900"
            : "border-primary/20 bg-primary/5 text-foreground"
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 shrink-0 rounded-lg p-1.5 ${mattersExhausted || aiExhausted ? "bg-amber-500 text-white" : "bg-primary text-primary-foreground"}`}>
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="space-y-1 text-sm">
            <p className="font-bold">
              {isRtl ? "حساب الطالب — استخدام مجاني محدود" : "Student Access — free limited plan"}
            </p>
            <ul className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                <span>
                  {isRtl
                    ? `القضايا: ${mattersUsed} / ${mattersMax}`
                    : `Matters: ${mattersUsed}/${mattersMax}`}
                </span>
              </li>
              <li className="flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                <span>
                  {isRtl
                    ? `مكالمات الذكاء الاصطناعي: ${aiUsed} / ${aiQuota}${
                        aiQuotaPeriod === "monthly" ? " (شهرياً)" : ""
                      }`
                    : `AI calls: ${aiUsed}/${aiQuota}${
                        aiQuotaPeriod === "monthly" ? " /month" : ""
                      }`}
                </span>
              </li>
              {expiresAt && (
                <li className="text-[11px] text-muted-foreground">
                  {isRtl
                    ? `تنتهي: ${new Date(expiresAt).toLocaleDateString()}`
                    : `Expires: ${new Date(expiresAt).toLocaleDateString()}`}
                </li>
              )}
            </ul>
            {(mattersExhausted || aiExhausted) && (
              <p className="text-xs font-medium">
                {isRtl
                  ? "وصلت إلى حد استخدامك المجاني. قم بالترقية لرفع الحدود ومتابعة العمل."
                  : "You've reached your free usage limit. Upgrade to lift limits and keep working."}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setOpenPaywall(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground transition-colors hover:bg-primary/90 cursor-pointer"
          >
            <Lock className="h-3.5 w-3.5" />
            <span>{isRtl ? "الترقية إلى خطة مدفوعة" : "Upgrade"}</span>
          </button>
          <button
            onClick={() => setDismissed(true)}
            aria-label={isRtl ? "إغلاق" : "Dismiss"}
            className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <SubscriptionPaywallModal
        isOpen={openPaywall}
        onClose={() => setOpenPaywall(false)}
        restrictedFeatureName="unlimited matters & AI"
      />
    </>
  );
}
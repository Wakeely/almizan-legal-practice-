"use client";

import React from "react";
import { Check, X } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";

const rows = [
  {
    traditional: { ar: "البحث في قواعد بيانات قانونية متعددة", en: "Search multiple legal databases" },
    mizan: { ar: "ابحث في كل شيء من مساحة عمل واحدة", en: "Search everything from one workspace" },
  },
  {
    traditional: { ar: "صياغة المستندات من الصفر", en: "Draft documents from scratch" },
    mizan: { ar: "احصل على مسودة أولى مصقولة", en: "Generate a polished first draft" },
  },
  {
    traditional: { ar: "قراءة مئات الصفحات", en: "Read hundreds of pages" },
    mizan: { ar: "راجع ملخصات موجزة", en: "Review concise summaries" },
  },
  {
    traditional: { ar: "إعادة البحث نفسه مراراً", en: "Repeat the same research" },
    mizan: { ar: "أعد استخدام أعمالك السابقة وطوّرها", en: "Reuse and refine previous work" },
  },
  {
    traditional: { ar: "ساعات من الصياغة", en: "Hours of drafting" },
    mizan: { ar: "دقائق للوصول إلى مسودة متينة", en: "Minutes to a solid first draft" },
  },
];

export default function Comparison() {
  const { isRtl } = useLanguage();

  return (
    <section className="py-16 md:py-24 bg-paper">
      <div className="max-w-[900px] mx-auto px-5 md:px-7">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <div className="text-xs font-bold tracking-widest uppercase text-brass mb-4">
            {isRtl ? "الطريقة التقليدية مقابل الميزان" : "Traditional vs. With Al Mizan"}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            {isRtl ? "قارن طريقتك الحالية بالعمل مع الميزان" : "Compare how you work today with Al Mizan"}
          </h2>
          <p className="text-ink/70 leading-relaxed">
            {isRtl
              ? "الفرق ليس أسرع قليلاً — إنه طريقة مختلفة تماماً للعمل."
              : "It's not a little faster — it's a completely different way of working."}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-line shadow-lg overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-2" dir={isRtl ? "rtl" : "ltr"}>
            <div className="px-4 sm:px-6 py-4 bg-sage-soft/50 border-b border-line text-center">
              <span className="text-xs sm:text-sm font-bold text-ink/50 uppercase tracking-wider">
                {isRtl ? "سير العمل التقليدي" : "Traditional workflow"}
              </span>
            </div>
            <div className="px-4 sm:px-6 py-4 bg-brass/15 border-b border-line text-center relative">
              <span className="absolute top-2 left-1/2 -translate-x-1/2 text-[9px] font-bold text-brass-dark bg-white border border-brass/30 rounded-full px-2 py-0.5 uppercase tracking-wider">
                {isRtl ? "مع الميزان" : "With Al Mizan"}
              </span>
              <span className="text-xs sm:text-sm font-bold text-brass-dark uppercase tracking-wider">
                {isRtl ? "مع الميزان" : "Al Mizan"}
              </span>
            </div>
          </div>

          {/* Rows */}
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-2 border-b border-line last:border-0" dir={isRtl ? "rtl" : "ltr"}>
              <div className="px-4 sm:px-6 py-4 sm:py-5 bg-sage-soft/30 flex items-start gap-2.5">
                <X className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                <span className="text-xs sm:text-sm text-ink/55 leading-relaxed">{isRtl ? r.traditional.ar : r.traditional.en}</span>
              </div>
              <div className="px-4 sm:px-6 py-4 sm:py-5 bg-brass/5 flex items-start gap-2.5">
                <div className="w-5 h-5 rounded-full bg-teal-deep/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="w-3 h-3 text-teal-deep" />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-ink leading-relaxed">{isRtl ? r.mizan.ar : r.mizan.en}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

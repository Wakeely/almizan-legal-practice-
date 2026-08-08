"use client";

import React from "react";
import { CheckCircle2, Download, Check } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";

const exportBullets = [
  {
    ar: "ترويسة المكتب وبيانات القضية تلقائياً",
    en: "Automated firm letterhead and case data",
  },
  {
    ar: "فهرس عناوين منظم مع ترقيم قانوني",
    en: "Organized table of contents with legal numbering",
  },
  {
    ar: "حقول مهيكلة: الأطراف، المحكمة، رقم القضية، التاريخ",
    en: "Structured fields: parties, court, case number, date",
  },
  {
    ar: "جاهز للطباعة أو الإرسال الإلكتروني مباشرة",
    en: "Ready for printing or direct e-filing",
  },
];

export default function ShowcaseExport() {
  const { language, isRtl } = useLanguage();

  return (
    <section id="export" className="py-16 md:py-24 overflow-hidden border-b border-line bg-paper">
      <div className="max-w-[1180px] mx-auto px-5 md:px-7">
        <div className="grid lg:grid-cols-2 gap-10 lg:gap-20 items-center">
          {/* Mockup */}
          <div className="order-2 lg:order-1 relative">
            {/* Decorative blob behind */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%] bg-gradient-to-tr from-brass-light/20 to-teal-deep/5 blur-3xl -z-10 rounded-full"></div>

            {/* PDF Container */}
            <div className="bg-white rounded-xl shadow-[0_20px_50px_-12px_rgba(0,0,0,0.15)] overflow-hidden border border-line flex flex-col font-sans relative z-10 w-full max-w-sm md:max-w-[420px] mx-auto">
              {/* PDF Header Bar */}
              <div className="bg-[#1A2626] text-white/50 text-xs px-4 py-3 flex justify-between items-center">
                <div className="flex gap-2">
                  <div className="px-2 py-0.5 rounded bg-brass-light/20 text-brass-light font-bold text-[10px]">PDF · A4</div>
                </div>
                <div className="font-mono tracking-wider text-[10px] md:text-xs">
                  {isRtl ? "تقرير_اللائحة_31-07-2026.pdf" : "Motion_Report_31-07-2026.pdf"}
                </div>
                <div className="flex gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
                  <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
                </div>
              </div>

              {/* PDF Content Area */}
              <div className="p-5 md:p-6 pb-16 md:pb-20 bg-white relative text-[10px] md:text-xs">
                {/* Firm Header */}
                <div className="flex justify-between items-start border-b-2 border-ink pb-3 mb-4">
                  <div className="text-start" dir={language === "ar" ? "rtl" : "ltr"}>
                    <h4 className="font-serif font-bold text-lg text-ink mb-1">
                      {isRtl ? "مكتب الميزان للمحاماة" : "Al Mizan Law Firm"}
                    </h4>
                    <p className="text-ink/50 text-[10px] uppercase tracking-widest">
                      {isRtl ? "الرياض · جدة · دبي" : "Riyadh · Jeddah · Dubai"}
                    </p>
                  </div>
                  <div className="text-[10px] text-ink/60 space-y-1 text-end font-mono" dir={language === "ar" ? "rtl" : "ltr"}>
                    <div className="flex justify-end gap-2">
                      <span>{isRtl ? "التاريخ:" : "Date:"}</span>
                      <span className="text-ink/80" dir="ltr">{isRtl ? "31 يوليو 2026" : "July 31, 2026"}</span>
                    </div>
                    <div className="flex justify-end gap-2">
                      <span>{isRtl ? "المرجع:" : "Ref:"}</span>
                      <span className="text-ink/80" dir="ltr">AM-2026-1487</span>
                    </div>
                  </div>
                </div>

                {/* Document Title */}
                <h3 className="text-center font-bold text-lg mb-4 text-ink/90">
                  {isRtl ? "لائحة دعوى — مطالبة بأجرة متأخرة" : "Statement of Claim — Late Rent Demand"}
                </h3>

                {/* Visual Case Info Highlights */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-sm" dir={language === "ar" ? "rtl" : "ltr"}>
                  <div className="bg-sage-soft p-3 rounded-lg border border-line flex flex-col justify-center items-start">
                    <span className="text-ink/50 text-[10px] block mb-1 uppercase tracking-wider">
                      {isRtl ? "رقم القضية" : "Case No"}
                    </span>
                    <span className="font-bold text-teal-deep font-mono" dir="ltr">
                      {isRtl ? "1487 / 1447 هـ" : "1487 / 1447 H"}
                    </span>
                  </div>
                  <div className="bg-sage-soft p-3 rounded-lg border border-line flex flex-col justify-center items-start">
                    <span className="text-ink/50 text-[10px] block mb-1 uppercase tracking-wider">
                      {isRtl ? "المحكمة" : "Court"}
                    </span>
                    <span className="font-bold text-teal-deep text-xs md:text-sm">
                      {isRtl ? "المحكمة التجارية — الرياض" : "Commercial Court — Riyadh"}
                    </span>
                  </div>
                </div>

                <div className="bg-brass-light/10 border border-brass-light/30 rounded-xl p-4 mb-4" dir={language === "ar" ? "rtl" : "ltr"}>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-xs font-bold text-brass-dark flex items-center gap-1.5">
                      <CheckCircle2 className="w-3 h-3" />
                      {isRtl ? "النقاط الجوهرية (مستخرج آلياً)" : "Key Highlights (Auto-extracted)"}
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex gap-2.5 items-start">
                      <div className="w-1.5 h-1.5 rounded-full bg-brass mt-1.5 shrink-0"></div>
                      <div className="text-xs text-ink/80 leading-relaxed font-medium">
                        {isRtl
                          ? "بموجب عقد الإيجار التجاري المؤرخ 12/03/2024، التزم المدعى عليه بسداد الأجرة الشهرية في موعدها. وحيث ثبت التأخر لمدة تجاوزت ستين يوماً، فإن المدعي يطلب إلزام المدعى عليه بالمبالغ المستحقة مع التعويض..."
                          : "Pursuant to the commercial lease agreement dated 12/03/2024, the defendant was obligated to pay the monthly rent on time. Given the proven delay exceeding sixty days, the plaintiff requests compelling the defendant to pay the outstanding amounts with compensation..."}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Abstract representations of further content */}
                <div className="space-y-2 opacity-30 mt-4 mb-3">
                  <div className="h-2 w-full bg-muted rounded"></div>
                  <div className="h-2 w-full bg-muted rounded"></div>
                  <div className="h-2 w-3/4 bg-muted rounded"></div>
                </div>
                <div className="space-y-2 opacity-30">
                  <div className="h-2 w-full bg-muted rounded"></div>
                  <div className="h-2 w-5/6 bg-muted rounded"></div>
                </div>

                {/* CTA overlaid in the center */}
                <div className="absolute left-1/2 -translate-x-1/2 bottom-5 z-20 w-max">
                  <button className="bg-brass hover:bg-brass-dark text-ink font-bold py-2.5 px-6 rounded-xl shadow-2xl shadow-brass/30 flex items-center gap-2 transition-all hover:scale-105 active:scale-95 border border-brass-light/30 text-sm whitespace-nowrap group cursor-pointer">
                    <Download className="w-4 h-4 shrink-0 group-hover:-translate-y-0.5 transition-transform" />
                    {isRtl ? "تصدير PDF بنقرة واحدة" : "Export PDF in 1-Click"}
                  </button>
                </div>

                {/* Fade out gradient at bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none z-10"></div>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="order-1 lg:order-2" dir={language === "ar" ? "rtl" : "ltr"}>
            <div className="text-xs font-bold tracking-widest uppercase text-brass mb-4">
              {isRtl ? "تصدير التقارير" : "Report Export"}
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6 leading-[1.3]">
              {isRtl ? "تقارير PDF جاهزة للتقديم والمراجعة" : "Filing-ready PDF reports"}
            </h2>
            <p className="text-ink/70 leading-relaxed mb-8">
              {isRtl
                ? "بضغطة واحدة تصدّر لائحة كاملة بتنسيق احترافي — ترويسة المكتب، حقول القضية، فهرس العناوين، ونص جاهز للتوقيع. لا قوالب يدوية، ولا تنسيق متأخر في منتصف الليل."
                : "With a single click, export a complete motion in professional format — firm letterhead, case fields, table of contents, and signature-ready text. No manual templates, no late-night formatting."}
            </p>

            <ul className="space-y-4 mb-10">
              {exportBullets.map((b, i) => (
                <li key={i} className="flex items-center gap-3">
                  <div className="w-5 h-5 rounded-full bg-teal-deep/10 flex items-center justify-center shrink-0">
                    <Check className="w-3 h-3 text-teal-deep" />
                  </div>
                  <span className="font-medium text-ink/80">{isRtl ? b.ar : b.en}</span>
                </li>
              ))}
            </ul>

            <button className="px-6 py-3 bg-teal-deep text-ivory font-bold rounded-lg hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer">
              {isRtl ? "جرّب التصدير من المختبر" : "Try Export from Lab"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

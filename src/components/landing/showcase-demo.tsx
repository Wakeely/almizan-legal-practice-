"use client";

import React, { useState, useEffect } from "react";
import { FileSearch, QrCode, Smartphone } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/language-provider";

const demoOutputs = [
  {
    ar: "إلى: السادة/ إدارة العقارات التجارية\nالموضوع: إنذار رسمي بشأن الإخلال بالتزامات عقد الإيجار التجاري المؤرخ ...\n\nإنه بموجب المادة (14) من العقد المشار إليه، وحيث ثبت تأخر المستأجر عن سداد الأجرة المستحقة لمدة تجاوزت ستين يوماً، فإننا ننذركم بضرورة الوفاء بكامل المتأخرات خلال 15 يوماً من تاريخه...",
    en: "To: Commercial Property Management\nRe: Formal Notice — Breach of Commercial Lease dated ...\n\nPursuant to Article 14 of the referenced agreement, and given the tenant's delay in rental payment exceeding sixty days, you are hereby notified to settle all outstanding amounts within 15 days of this notice...",
    conf: "98.4%",
    time: "1.2",
  },
  {
    ar: "تحليل مدة التقادم — دعوى التعويض التقصيري\n\nوفقاً للقانون المدني المطبق، تسقط دعوى التعويض عن الفعل الضار بمضي ثلاث سنوات من تاريخ علم المتضرر بالضرر وبالمسؤول عنه، وبمضي خمس عشرة سنة من تاريخ وقوع الفعل الضار على أي حال...",
    en: "Limitation period analysis — Tort claim\n\nUnder applicable civil law, a tort claim is time-barred after three years from the date the injured party became aware of the harm and the responsible party, and in any case after fifteen years from the date the harmful act occurred...",
    conf: "96.1%",
    time: "0.9",
  },
  {
    ar: "ملخص نقاط المخاطر — اتفاقية المشروع المشترك\n\n1. غياب آلية واضحة لتسوية النزاعات بين الشركاء\n2. بند الخروج (Exit Clause) لا يحدد آلية تقييم الحصص\n3. تعارض محتمل بين قانون الحوكمة المطبق واختصاص المحاكم المحلية...",
    en: "Risk summary — Joint venture agreement\n\n1. No clear dispute-resolution mechanism between partners\n2. The exit clause lacks a share-valuation mechanism\n3. Potential conflict between the governing law clause and local court jurisdiction...",
    conf: "94.7%",
    time: "1.4",
  },
];

function ConsolePane({ lang, activeIdx, label }: { lang: "ar" | "en"; activeIdx: number; label?: string }) {
  const [text, setText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [isScanning, setIsScanning] = useState(true);
  const [scanProgress, setScanProgress] = useState(0);

  useEffect(() => {
    const scanInterval = setInterval(() => {
      setScanProgress((p) => {
        if (p >= 100) {
          clearInterval(scanInterval);
          return 100;
        }
        return p + 5;
      });
    }, 50);

    const scanTimeout = setTimeout(() => {
      setIsScanning(false);

      const fullText = demoOutputs[activeIdx][lang];
      let i = 0;
      setIsTyping(true);

      const typingTimer = setInterval(() => {
        setText(fullText.slice(0, i));
        i += 3;
        if (i > fullText.length) {
          setText(fullText);
          setIsTyping(false);
          clearInterval(typingTimer);
        }
      }, 15);

      return () => clearInterval(typingTimer);
    }, 1200);

    return () => {
      clearInterval(scanInterval);
      clearTimeout(scanTimeout);
    };
  }, [activeIdx, lang]);

  return (
    <div className="bg-teal-mid text-white rounded-xl p-5 md:p-8 shadow-2xl relative overflow-hidden flex flex-col h-full">
      <div className="flex justify-between items-center mb-6 text-xs text-white/50 font-mono">
        <div className="flex gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
          <div className="w-2.5 h-2.5 rounded-full bg-white/20"></div>
        </div>
        <span>{label}</span>
      </div>

      <div className="flex-1 min-h-[220px] relative">
        {isScanning ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center border-2 border-dashed border-white/20 rounded-lg p-6 bg-white/5">
            <div className="flex gap-6 items-center mb-8">
              <motion.div
                key={`pdf-${activeIdx}`}
                initial={{ scale: 0.5, y: -20, opacity: 0, rotate: -15 }}
                animate={{ scale: 1, y: 0, opacity: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 200, damping: 12 }}
                className="relative w-14 h-16 bg-white rounded-md shadow-lg flex items-center justify-center border-t-4 border-t-red-500 overflow-hidden"
              >
                <span className="text-red-500 font-bold text-xs uppercase tracking-wider relative z-10">PDF</span>
                <div className="absolute top-1.5 right-1.5 w-3 h-3 bg-red-100 rounded-sm"></div>
                <div className="absolute bottom-2 left-2 right-2 h-1 bg-muted rounded-full"></div>
                <div className="absolute bottom-4 left-2 right-4 h-1 bg-muted rounded-full"></div>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 }}
              >
                <FileSearch className="w-8 h-8 text-brass-light opacity-80" />
              </motion.div>
            </div>
            <div className="w-full max-w-xs space-y-2 text-center">
              <div className="text-sm font-medium text-white/80">
                {lang === "ar" ? "جارٍ مسح الملف وتحليله..." : "Scanning and analyzing file..."}
              </div>
              <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden" dir="ltr">
                <div
                  className="h-full bg-brass transition-all duration-75 ease-linear"
                  style={{ width: `${scanProgress}%` }}
                />
              </div>
            </div>
            <motion.div
              className="absolute left-0 right-0 h-0.5 bg-brass shadow-[0_0_8px_2px_rgba(176,141,87,0.5)]"
              animate={{ top: ["10%", "90%", "10%"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            <div className="flex-1 flex flex-col md:flex-row gap-6 border-t border-white/10 pt-6">
              <div className="flex-1 font-mono text-[14px] leading-[1.9] text-white/90 whitespace-pre-wrap" dir={lang === "ar" ? "rtl" : "ltr"}>
                {text}
                {isTyping && <span className="inline-block w-2 h-4 bg-brass-light ml-1 align-middle animate-pulse"></span>}
              </div>

              {!isTyping && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  transition={{ delay: 0.5, type: "spring" }}
                  className="w-full md:w-36 shrink-0 bg-white/5 rounded-xl p-4 border border-white/10 flex flex-col items-center justify-center gap-3 self-start shadow-lg"
                >
                  <div className="bg-white p-2.5 rounded-lg shadow-sm">
                    <QrCode className="w-16 h-16 text-teal-deep" strokeWidth={1.5} />
                  </div>
                  <div className="text-center space-y-1.5 w-full">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-brass-light flex items-center justify-center gap-1.5">
                      <Smartphone className="w-3.5 h-3.5" />
                      {lang === "ar" ? "إرسال للهاتف" : "Send to Phone"}
                    </div>
                    <div className="text-[9px] text-white/40 leading-tight bg-black/20 rounded px-1.5 py-1">
                      {lang === "ar" ? "للقراءة أثناء التنقل" : "For reading on the go"}
                    </div>
                  </div>
                </motion.div>
              )}
            </div>

            <div className="flex justify-between items-center mt-8 pt-6 border-t border-white/10 text-xs shrink-0">
              <span className="text-white/50">
                {lang === "ar" ? `تم التوليد خلال ${demoOutputs[activeIdx].time} ثانية` : `Generated in ${demoOutputs[activeIdx].time}s`}
              </span>
              <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-lg" dir="ltr">
                <span className="font-bold text-white/80 tracking-wide">
                  {lang === "ar" ? "الثقة" : "Confidence"}
                </span>
                <div className="w-24 h-1.5 bg-white/10 rounded-full overflow-hidden flex items-center">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: demoOutputs[activeIdx].conf }}
                    transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-brass-light rounded-full"
                  />
                </div>
                <span className="font-mono text-brass-light text-[11px] font-bold">
                  {demoOutputs[activeIdx].conf}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ShowcaseDemo() {
  const { language, isRtl } = useLanguage();
  const [activeIdx, setActiveIdx] = useState(0);
  const [compareIdx, setCompareIdx] = useState<number | null>(null);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying || compareIdx !== null) return;
    const timer = setInterval(() => {
      setActiveIdx((prev) => (prev + 1) % 3);
    }, 6000);
    return () => clearInterval(timer);
  }, [isAutoPlaying, compareIdx]);

  return (
    <section id="demo" className="py-16 md:py-24 bg-ivory">
      <div className="max-w-[1180px] mx-auto px-5 md:px-7">
        <div className={cn("grid gap-8 md:gap-12 items-start", compareIdx !== null ? "lg:grid-cols-1" : "lg:grid-cols-[1.1fr_0.9fr]")}>
          <div className="order-2 lg:order-1 relative z-10" dir={language === "ar" ? "rtl" : "ltr"}>
            <div className="text-xs font-bold tracking-widest uppercase text-brass mb-4">
              {isRtl ? "مختبر الصياغة التفاعلي" : "Interactive drafting lab"}
            </div>
            <div className="flex items-start justify-between gap-6 mb-6">
              <h2 className="text-3xl md:text-4xl font-serif font-bold leading-[1.3]">
                {isRtl ? "شاهد مستنداً قانونياً يُصاغ أمامك خلال ثوانٍ" : "Watch a legal document draft itself in seconds"}
              </h2>
              {compareIdx === null && (
                <button
                  onClick={() => {
                    setCompareIdx(activeIdx === 0 ? 1 : 0);
                    setIsAutoPlaying(false);
                  }}
                  className="shrink-0 px-4 py-2 bg-sage-soft border border-brass text-brass-dark text-sm font-bold rounded-lg hover:bg-brass hover:text-white transition-colors cursor-pointer"
                >
                  {isRtl ? "مقارنة مع مستند آخر" : "Compare Document"}
                </button>
              )}
            </div>
            <p className="text-ink/70 leading-relaxed mb-8">
              {isRtl
                ? "اختر أحد النماذج الجاهزة وشاهد اللائحة تُصاغ أمامك خلال ثوانٍ — جاهزة للتقديم، مع تقييم ثقة صريح وليس وعداً مبالغاً فيه."
                : "Pick a ready scenario and watch a motion draft itself in seconds — filing-ready, with an honest confidence score, not an overpromise."}
            </p>

            <div className={cn("grid gap-3", compareIdx !== null ? "grid-cols-1 md:grid-cols-3" : "flex flex-col")}>
              {[1, 2, 3].map((num, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setIsAutoPlaying(false);
                    if (compareIdx !== null) {
                      if (activeIdx !== i) setCompareIdx(i);
                    } else {
                      setActiveIdx(i);
                    }
                  }}
                  className={cn(
                    "text-start px-5 py-4 rounded-xl border text-sm font-bold transition-all flex items-center justify-between group cursor-pointer",
                    (activeIdx === i || compareIdx === i)
                      ? "border-brass bg-white shadow-md text-ink min-h-[80px]"
                      : "border-transparent bg-sage-soft/70 text-ink/70 hover:border-brass/30 hover:bg-white/60 min-h-[60px]"
                  )}
                >
                  <span className="flex-1">
                    {isRtl
                      ? ["صياغة إنذار رسمي بسبب الإخلال بعقد إيجار تجاري", "حساب مدة التقادم المحددة لدعوى التعويض التقصيري", "تلخيص نقاط المخاطر الجوهرية في اتفاقية مشروع مشترك"][i]
                      : ["Draft a formal notice for breach of a commercial lease", "Calculate the limitation period for a tort claim", "Summarize key risk points in a joint venture agreement"][i]}
                  </span>
                  <div className="flex gap-2 shrink-0">
                    {activeIdx === i && <span className="text-[10px] px-2 py-1 bg-brass text-white rounded-md uppercase tracking-wider">{isRtl ? "المستند ١" : "Doc 1"}</span>}
                    {compareIdx === i && <span className="text-[10px] px-2 py-1 bg-teal-deep text-white rounded-md uppercase tracking-wider">{isRtl ? "المستند ٢" : "Doc 2"}</span>}
                  </div>
                </button>
              ))}
            </div>

            {compareIdx !== null && (
              <button
                onClick={() => {
                  setCompareIdx(null);
                  setIsAutoPlaying(true);
                }}
                className="mt-6 text-sm text-ink/60 hover:text-ink transition-colors underline block cursor-pointer"
              >
                {isRtl ? "إلغاء وضع المقارنة" : "Exit comparison mode"}
              </button>
            )}
          </div>

          <div className={cn("order-1 lg:order-2 grid gap-6 items-stretch", compareIdx !== null ? "md:grid-cols-2" : "grid-cols-1")}>
            <ConsolePane
              key={`${activeIdx}-${language}`}
              lang={language}
              activeIdx={activeIdx}
              label={compareIdx !== null ? (isRtl ? "المستند الأساسي" : "Primary Document") : isRtl ? "مساعد الصياغة — نتيجة التوليد" : "Drafting Assistant — Output"}
            />
            {compareIdx !== null && (
              <ConsolePane
                key={`${compareIdx}-${language}`}
                lang={language}
                activeIdx={compareIdx}
                label={isRtl ? "المستند المقارن" : "Comparison Document"}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

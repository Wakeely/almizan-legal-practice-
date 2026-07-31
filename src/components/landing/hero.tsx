"use client";

import React, { useState, useEffect } from "react";
import { Search, PenLine, ScanSearch, Gavel, FileDown, Sparkles, Check, ArrowRight, FileSearch, FileText } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/language-provider";

const heroPills = [
  { ar: "ابحث في التشريعات بلغة بسيطة", en: "Research legislation in plain language", icon: Search },
  { ar: "اصغِ اللوائح والمذكرات في دقائق", en: "Draft pleadings in minutes", icon: PenLine },
  { ar: "حلّل ملفات من آلاف الصفحات", en: "Analyze 1,000-page case files", icon: ScanSearch },
  { ar: "جهّز حججاً قانونية أقوى", en: "Prepare stronger legal arguments", icon: Gavel },
];

function Typewriter({ text }: { text: string }) {
  const [content, setContent] = useState("");

  useEffect(() => {
    let i = 0;
    const timer = setInterval(() => {
      i += 2;
      setContent(text.slice(0, i));
      if (i >= text.length) clearInterval(timer);
    }, 18);
    return () => clearInterval(timer);
  }, [text]);

  return (
    <pre className="whitespace-pre-wrap font-mono text-[11px] leading-[1.8] text-ink/85">
      {content}
      <span className="inline-block w-1.5 h-3 bg-brass ml-0.5 align-middle animate-pulse"></span>
    </pre>
  );
}

function ResearchStep({ isRtl }: { isRtl: boolean }) {
  const results = [
    {
      title: isRtl ? "التأخر في السداد — المادة 14" : "Late payment — Article 14",
      ref: isRtl ? "قانون المعاملات التجارية" : "Commercial Transactions Law",
    },
    {
      title: isRtl ? "فائدة على الإيجار المتأخر" : "Interest on delayed rent",
      ref: isRtl ? "المادة 172 من القانون المدني" : "Civil Code Art. 172",
    },
    {
      title: isRtl ? "شرط الإخطار — 15 يوماً" : "Notice requirement — 15 days",
      ref: isRtl ? "اللائحة التنفيذية 4/2021" : "Regulation 4/2021",
    },
  ];

  return (
    <div className="flex flex-col gap-3 h-full" dir={isRtl ? "rtl" : "ltr"}>
      <div className="flex items-center gap-2 bg-white/10 border border-white/10 rounded-xl px-3 py-2.5">
        <Search className="w-4 h-4 text-brass-light shrink-0" />
        <span className="text-xs text-white/70 flex-1 truncate">
          {isRtl ? "ما هي الضوابط القانونية للمطالبة بالإيجار المتأخر؟" : "What limits apply to late rent claims?"}
        </span>
        <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 bg-brass text-white rounded-md uppercase tracking-wider">
          {isRtl ? "بحث" : "Search"}
        </span>
      </div>

      <div className="space-y-2">
        {results.map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.25 }}
            className="flex items-start gap-2.5 bg-white/5 border border-white/10 rounded-xl px-3 py-2.5"
          >
            <div className="w-5 h-5 rounded-full bg-brass/25 flex items-center justify-center shrink-0 mt-0.5">
              <Check className="w-3 h-3 text-brass-light" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white/90 truncate">{r.title}</div>
              <div className="text-[10px] text-white/50 font-mono truncate">{r.ref}</div>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="mt-auto pt-1 text-center">
        <span className="text-[10px] text-brass-light/80 font-mono">
          {isRtl ? "تم العثور على 12 مرجعاً خلال 0.8 ثانية" : "12 authorities found in 0.8s"}
        </span>
      </div>
    </div>
  );
}

function DraftStep({ isRtl }: { isRtl: boolean }) {
  const doc = isRtl
    ? "إلى: شركة النخيل التجارية\nالموضوع: إنذار رسمي بشأن الإخلال بعقد إيجار تجاري\n\nبموجب المادة (14) من العقد، وحيث تأخر المستأجر عن سداد الأجرة المستحقة لمدة تجاوزت ستين يوماً، فإننا ننذركم بالوفاء بكامل المتأخرات خلال 15 يوماً..."
    : "To: Al Nakheel Trading Est.\nRe: Formal Notice — Breach of Commercial Lease\n\nPursuant to Article 14 of the agreement, and given the tenant's delay exceeding sixty days, you are hereby notified to settle all outstanding amounts within 15 days...";

  return (
    <div className="bg-white/95 rounded-xl overflow-hidden border border-white/10 shadow-lg flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 bg-sage-soft/60 border-b border-line/40">
        <div className="flex gap-1.5" dir="ltr">
          <div className="w-2 h-2 rounded-full bg-red-400"></div>
          <div className="w-2 h-2 rounded-full bg-amber-400"></div>
          <div className="w-2 h-2 rounded-full bg-green-400"></div>
        </div>
        <span className="mx-auto text-[9px] font-mono text-ink/50 bg-white px-2 py-0.5 rounded border border-line">
          motion_final.docx
        </span>
      </div>
      <div className="p-3.5 flex-1 overflow-hidden">
        <Typewriter text={doc} />
      </div>
      <div className="px-3 py-2 border-t border-line/40 flex items-center justify-between">
        <span className="text-[10px] text-ink/50 font-mono">{isRtl ? "تم التوليد خلال 1.2 ثانية" : "Generated in 1.2s"}</span>
        <span className="text-[10px] font-bold px-2 py-0.5 bg-brass text-white rounded-md uppercase tracking-wider">
          {isRtl ? "ثقة 98.4%" : "98.4% confidence"}
        </span>
      </div>
    </div>
  );
}

function AnalyzeStep({ isRtl }: { isRtl: boolean }) {
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setDone(true);
          return 100;
        }
        return p + 6;
      });
    }, 70);
    return () => clearInterval(interval);
  }, [isRtl]);

  const findings = [
    isRtl ? "تناقض في الشهادات (صفحة 42)" : "Contradiction in testimonies (p.42)",
    isRtl ? "سابقة قضائية مطابقة 144/2021" : "Matching precedent 144/2021",
  ];

  return (
    <div className="flex flex-col items-center justify-center gap-4 h-full border-2 border-dashed border-white/15 rounded-xl p-5 relative overflow-hidden" dir={isRtl ? "rtl" : "ltr"}>
      <motion.div
        className="absolute left-0 right-0 h-0.5 bg-brass shadow-[0_0_10px_2px_rgba(176,141,87,0.5)]"
        animate={{ top: ["15%", "85%", "15%"] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
      />
      <div className="flex gap-4 items-center">
        <motion.div
          key={isRtl ? "pdf-ar" : "pdf-en"}
          initial={{ scale: 0.5, y: -15, opacity: 0, rotate: -15 }}
          animate={{ scale: 1, y: 0, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
          className="relative w-12 h-14 bg-white rounded-md shadow-lg flex items-center justify-center border-t-4 border-t-red-500 overflow-hidden"
        >
          <span className="text-red-500 font-bold text-[10px] uppercase tracking-wider relative z-10">PDF</span>
          <div className="absolute bottom-2 left-2 right-2 h-1 bg-gray-100 rounded-full"></div>
          <div className="absolute bottom-4 left-2 right-4 h-1 bg-gray-100 rounded-full"></div>
        </motion.div>
        <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}>
          <FileSearch className="w-7 h-7 text-brass-light opacity-90" />
        </motion.div>
      </div>
      <div className="w-full max-w-[220px] space-y-2 text-center">
        <div className="text-xs text-white/80 font-medium">
          {isRtl ? "جارٍ تحليل ملف القضية..." : "Analyzing case file..."}
        </div>
        <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden" dir="ltr">
          <div className="h-full bg-brass transition-all duration-75 ease-linear" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-[260px] space-y-1.5"
          >
            {findings.map((f, i) => (
              <div key={i} className="flex items-center gap-2 bg-brass/15 border border-brass/30 rounded-lg px-3 py-2">
                <Sparkles className="w-3 h-3 text-brass-light shrink-0" />
                <span className="text-[11px] font-bold text-brass-light truncate">{f}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExportStep({ isRtl }: { isRtl: boolean }) {
  return (
    <div className="bg-white/95 rounded-xl overflow-hidden border border-white/10 shadow-lg flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 bg-[#1A2626] text-white/60">
        <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-brass-light/20 text-brass-light">PDF · A4</span>
        <span className="font-mono text-[9px] tracking-wider">{isRtl ? "تقرير_اللائحة_31-07-2026.pdf" : "Motion_Report_31-07-2026.pdf"}</span>
      </div>
      <div className="p-3.5 flex-1 flex flex-col gap-2" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex justify-between items-center border-b-2 border-ink pb-2">
          <div>
            <div className="font-serif font-bold text-[13px] text-ink leading-tight">{isRtl ? "مكتب الميزان للمحاماة" : "Al Mizan Law Firm"}</div>
            <div className="text-[8px] text-ink/50 uppercase tracking-widest">{isRtl ? "الرياض · جدة · دبي" : "Riyadh · Jeddah · Dubai"}</div>
          </div>
          <span className="text-[8px] font-mono text-ink/60">AM-2026-1487</span>
        </div>
        <div className="text-center font-bold text-[12px] text-ink/90 leading-tight">
          {isRtl ? "لائحة دعوى — مطالبة بأجرة متأخرة" : "Statement of Claim — Late Rent Demand"}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-sage-soft rounded-md p-2">
            <div className="text-[8px] text-ink/50 uppercase tracking-wider">{isRtl ? "رقم القضية" : "Case No"}</div>
            <div className="font-bold text-teal-deep font-mono text-[11px]">{isRtl ? "1487 / 1447 هـ" : "1487 / 1447 H"}</div>
          </div>
          <div className="bg-sage-soft rounded-md p-2">
            <div className="text-[8px] text-ink/50 uppercase tracking-wider">{isRtl ? "المحكمة" : "Court"}</div>
            <div className="font-bold text-teal-deep text-[10px]">{isRtl ? "المحكمة التجارية — الرياض" : "Commercial Court — Riyadh"}</div>
          </div>
        </div>
      </div>
      <div className="px-3 py-2 border-t border-line/40">
        <button className="w-full bg-brass hover:bg-brass-dark text-ink font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer">
          <FileDown className="w-3.5 h-3.5" />
          {isRtl ? "تصدير PDF بنقرة واحدة" : "Export PDF in 1-Click"}
        </button>
      </div>
    </div>
  );
}

function HeroStepper({ isRtl }: { isRtl: boolean }) {
  const [step, setStep] = useState(0);

  const tabs = [
    { ar: "بحث", en: "Research", icon: Search },
    { ar: "صياغة", en: "Draft", icon: PenLine },
    { ar: "تحليل", en: "Analyze", icon: ScanSearch },
    { ar: "تصدير", en: "Export", icon: FileDown },
  ];

  useEffect(() => {
    const timer = setInterval(() => setStep((p) => (p + 1) % tabs.length), 4200);
    return () => clearInterval(timer);
  }, [tabs.length]);

  return (
    <div className="relative">
      {/* Floating decorative chips */}
      <motion.div
        animate={{ y: [0, -8, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -top-4 -left-2 sm:-left-5 z-20 bg-white rounded-xl shadow-2xl border border-brass/30 px-3 py-2 flex items-center gap-2"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="w-6 h-6 rounded-lg bg-brass/15 flex items-center justify-center">
          <FileText className="w-3.5 h-3.5 text-brass-dark" />
        </div>
        <div>
          <div className="text-[10px] font-bold text-ink leading-none">{isRtl ? "1,245 صفحة" : "1,245 pages"}</div>
          <div className="text-[9px] text-ink/50 leading-none mt-0.5">{isRtl ? "تم تلخيصها" : "summarized"}</div>
        </div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute -bottom-5 -right-2 sm:-right-5 z-20 bg-white rounded-xl shadow-2xl border border-brass/30 px-3 py-2 flex items-center gap-2"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <div className="w-6 h-6 rounded-lg bg-brass/15 flex items-center justify-center">
          <Sparkles className="w-3.5 h-3.5 text-brass-dark" />
        </div>
        <div>
          <div className="text-[10px] font-bold text-ink leading-none">{isRtl ? "ثقة 98.4%" : "98.4% confidence"}</div>
          <div className="text-[9px] text-ink/50 leading-none mt-0.5">{isRtl ? "في الصياغة" : "in drafting"}</div>
        </div>
      </motion.div>

      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 sm:p-5 shadow-2xl relative z-10">
        {/* Step tabs */}
        <div className="grid grid-cols-4 gap-1.5 mb-4" dir={isRtl ? "rtl" : "ltr"}>
          {tabs.map((t, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={cn(
                "flex flex-col sm:flex-row items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer",
                step === i ? "bg-brass text-white shadow-lg shadow-brass/30" : "bg-white/5 text-white/50 hover:bg-white/10"
              )}
            >
              <t.icon className="w-3.5 h-3.5" />
              <span>{isRtl ? t.ar : t.en}</span>
            </button>
          ))}
        </div>

        {/* Step content */}
        <div className="min-h-[250px] sm:min-h-[280px] relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12, filter: "blur(3px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: -12, filter: "blur(3px)" }}
              transition={{ duration: 0.35 }}
              className="h-full"
            >
              {step === 0 && <ResearchStep isRtl={isRtl} />}
              {step === 1 && <DraftStep isRtl={isRtl} />}
              {step === 2 && <AnalyzeStep isRtl={isRtl} />}
              {step === 3 && <ExportStep isRtl={isRtl} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

interface HeroProps {
  onEnterWorkspace: () => void;
}

export default function Hero({ onEnterWorkspace }: HeroProps) {
  const { isRtl } = useLanguage();
  const [pillIdx, setPillIdx] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setPillIdx((p) => (p + 1) % heroPills.length), 3000);
    return () => clearInterval(timer);
  }, []);

  const currentPill = heroPills[pillIdx];

  return (
    <section className="relative bg-teal-mid text-white overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_60%_at_80%_-10%,rgba(176,141,87,0.28),transparent_60%)]"></div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_10%_110%,rgba(22,63,58,0.9),transparent_60%)]"></div>
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(247,244,238,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(247,244,238,0.04)_1px,transparent_1px)] bg-[size:3.5rem_3.5rem] [mask-image:radial-gradient(ellipse_70%_70%_at_50%_30%,#000_50%,transparent_100%)]"></div>

      <div className="max-w-[1180px] mx-auto px-5 md:px-7 py-16 md:py-24 relative z-10">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-12 lg:gap-16 items-center">
          {/* Left: content */}
          <div dir={isRtl ? "rtl" : "ltr"}>
            {/* Animated eyebrow pill */}
            <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-white/5 border border-brass/40 text-brass-light text-xs font-bold mb-6 min-h-[38px]">
              <div className="w-2 h-2 rounded-full bg-brass animate-pulse shrink-0"></div>
              <AnimatePresence mode="wait">
                <motion.span
                  key={pillIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                  className="flex items-center gap-2"
                >
                  <currentPill.icon className="w-3.5 h-3.5 shrink-0" />
                  {isRtl ? currentPill.ar : currentPill.en}
                </motion.span>
              </AnimatePresence>
            </div>

            {/* Headline */}
            <h1 className="font-serif font-bold text-4xl sm:text-5xl lg:text-6xl leading-[1.15] mb-6">
              <motion.span
                className="block"
                initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.7, delay: 0.1 }}
              >
                {isRtl ? "أنجز العمل القانوني" : "Finish legal work"}
              </motion.span>
              <motion.span
                className="block text-transparent bg-clip-text bg-gradient-to-r from-brass-light via-brass to-brass-light"
                initial={{ opacity: 0, y: 24, filter: "blur(6px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                transition={{ duration: 0.7, delay: 0.35 }}
              >
                {isRtl ? "في دقائق، لا ساعات." : "in minutes, not hours."}
              </motion.span>
            </h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.55 }}
              className="text-white/75 text-base sm:text-lg leading-relaxed mb-8 max-w-xl"
            >
              {isRtl
                ? "يساعد الميزان المحامين على البحث في التشريعات، صياغة المستندات القانونية، تحليل القضايا، وإعداد حجج قانونية أقوى — كل ذلك من مساحة عمل واحدة مدعومة بالذكاء الاصطناعي."
                : "Al Mizan helps lawyers research legislation, draft legal documents, analyze cases, and prepare stronger legal arguments — all from one AI-powered workspace."}
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.7 }}
              className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-8"
            >
              <button
                onClick={onEnterWorkspace}
                className="px-6 py-3.5 bg-brass hover:bg-brass-light text-ink font-bold rounded-xl shadow-xl shadow-brass/25 transition-all hover:-translate-y-0.5 active:scale-95 cursor-pointer flex items-center justify-center gap-2 text-sm"
              >
                <Sparkles className="w-4 h-4" />
                {isRtl ? "ابدأ تجربة مجانية" : "Start Free Trial"}
              </button>
              <a
                href="#use-cases"
                className="px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-white/20 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm"
              >
                {isRtl ? "استكشف حالات الاستخدام" : "Explore Use Cases"}
                <ArrowRight className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
              </a>
            </motion.div>

            {/* Micro badges */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.85 }}
              className="flex flex-wrap gap-2"
            >
              {[
                isRtl ? "بحث أسرع" : "Research faster",
                isRtl ? "صياغة في دقائق" : "Draft in minutes",
                isRtl ? "عربي / إنجليزي" : "Bilingual AR / EN",
              ].map((b, i) => (
                <span key={i} className="text-[11px] font-semibold text-white/60 bg-white/5 border border-white/10 rounded-full px-3 py-1">
                  {b}
                </span>
              ))}
            </motion.div>
          </div>

          {/* Right: animated workflow stepper */}
          <motion.div
            initial={{ opacity: 0, x: isRtl ? -24 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="relative"
          >
            <HeroStepper isRtl={isRtl} />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

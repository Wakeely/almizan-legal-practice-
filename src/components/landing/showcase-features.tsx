"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, FileSearch, Clock, Activity, Shield, Scale, CheckCircle2, ArrowUpRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/components/providers/language-provider";

const features = [
  {
    title: { ar: "صياغة في دقائق", en: "Draft in minutes" },
    body: {
      ar: "اصغِ العقود والإنذارات واللوائح والطلبات والمذكرات القانونية في دقائق — لا من الصفر، بل من مسودة أولى عالية الجودة.",
      en: "Draft contracts, legal notices, pleadings, motions, and memoranda in minutes — not from scratch, but from a polished first draft.",
    },
    icon: Sparkles,
    color: "bg-teal-deep",
  },
  {
    title: { ar: "مراجعة سريعة للمستندات الطويلة", en: "Review lengthy documents in minutes" },
    body: {
      ar: "راجع الأحكام والمستندات القانونية الطويلة في دقائق — ثغرات وسوابق وتناقضات تُستخرج تلقائياً.",
      en: "Review lengthy judgments and legal documents in minutes — loopholes, precedents, and contradictions surfaced automatically.",
    },
    icon: FileSearch,
    color: "bg-brass",
  },
  {
    title: { ar: "تتبع مدد التقادم والاستحقاق", en: "Statute & deadline tracking" },
    body: {
      ar: "تتوقف عن خسارة القضايا بسبب موعد فائت — تنبيهات دقيقة قبل كل أجل حاسم.",
      en: "You stop losing cases to missed deadlines — precise alerts before every critical date.",
    },
    icon: Clock,
    color: "bg-teal-mid",
  },
  {
    title: { ar: "فواتير وحسابات الأمانة", en: "Billing & trust accounting" },
    body: {
      ar: "يرى الشركاء ما هو قابل للتحصيل فعلاً، قبل مفاجآت نهاية الشهر لا بعدها.",
      en: "Partners see what's actually collectible before month-end surprises, not after.",
    },
    icon: Activity,
    color: "bg-sage",
  },
  {
    title: { ar: "بوابة الموكل", en: "Client portal" },
    body: {
      ar: 'مكالمات أقل بسؤال "ما مستجدات قضيتي؟" — الموكل يرى بنفسه، لحظة بلحظة.',
      en: "Fewer “what's happening with my case?” calls — clients see progress themselves, moment to moment.",
    },
    icon: Shield,
    color: "bg-ink",
  },
];

export default function ShowcaseFeatures() {
  const { language, isRtl } = useLanguage();
  const [activeFeat, setActiveFeat] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  useEffect(() => {
    if (!isAutoPlaying) return;
    const timer = setInterval(() => {
      setActiveFeat((prev) => (prev + 1) % features.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [isAutoPlaying]);

  return (
    <section id="features" className="py-16 md:py-24 bg-paper overflow-hidden">
      <div className="max-w-[1180px] mx-auto px-5 md:px-7">
        <div className="max-w-2xl mx-auto text-center mb-16">
          <div className="text-xs font-bold tracking-widest uppercase text-brass mb-4">
            {isRtl ? "القدرات والإمكانيات" : "Capabilities"}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            {isRtl ? "ابحث، اصغِ، حلّل — كل ذلك في مساحة عمل واحدة" : "Research, draft, analyze — all in one workspace"}
          </h2>
          <p className="text-ink/70 leading-relaxed">
            {isRtl
              ? "ابحث في التشريعات والمبادئ القانونية بلغة بسيطة. اصغِ مستندات عالية الجودة في دقائق. راجع القضايا وحللها في مكان واحد."
              : "Research legislation and legal principles using natural language. Draft high-quality documents in minutes. Review and analyze cases in one place."}
          </p>
        </div>

        <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 lg:gap-8 md:gap-12 items-start relative">
          <div className="space-y-3 order-2 lg:order-1" dir={language === "ar" ? "rtl" : "ltr"}>
            {features.map((f, i) => (
              <button
                key={i}
                onClick={() => {
                  setActiveFeat(i);
                  setIsAutoPlaying(false);
                }}
                className={cn(
                  "w-full text-start px-5 py-3 md:py-4 rounded-[1.25rem] transition-all duration-300 border relative overflow-hidden group flex flex-col justify-center cursor-pointer",
                  activeFeat === i
                    ? "bg-white border-brass shadow-md min-h-[100px]"
                    : "bg-sage-soft/70 border-transparent hover:border-brass/30 hover:bg-white/60 min-h-[60px]"
                )}
              >
                {activeFeat === i && (
                  <motion.div
                    layoutId="activeFeatBg"
                    className="absolute inset-0 bg-gradient-to-r from-brass-light/5 to-transparent pointer-events-none"
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
                <div className="relative z-10 flex items-start justify-between gap-4 w-full">
                  <div className="flex-1 pt-1">
                    <h3 className={cn(
                      "text-[17px] md:text-xl font-bold transition-colors leading-tight",
                      activeFeat === i ? "text-ink" : "text-ink/70 group-hover:text-ink"
                    )}>
                      {isRtl ? f.title.ar : f.title.en}
                    </h3>
                    <AnimatePresence initial={false}>
                      {activeFeat === i && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.3 }}
                          className="overflow-hidden"
                        >
                          <p className="text-ink/60 leading-relaxed pt-2 text-[13px] md:text-sm pr-2">
                            {isRtl ? f.body.ar : f.body.en}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <div className={cn(
                    "w-11 h-11 md:w-12 md:h-12 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300",
                    activeFeat === i
                      ? `${f.color} shadow-lg text-white`
                      : "bg-white text-ink/40 shadow-sm border border-line group-hover:text-brass group-hover:border-brass/30"
                  )}>
                    <f.icon className="w-5 h-5" />
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="sticky top-32 h-[300px] sm:h-[400px] lg:h-[520px] bg-white rounded-3xl border border-line shadow-2xl overflow-hidden flex items-center justify-center p-6 relative order-1 lg:order-2">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(240,240,235,0.8)_0%,transparent_100%)] opacity-50"></div>
            <AnimatePresence mode="wait">
              <motion.div
                key={activeFeat}
                initial={{ opacity: 0, scale: 0.95, filter: "blur(4px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 1.05, filter: "blur(4px)" }}
                transition={{ type: "spring", stiffness: 300, damping: 25 }}
                className="relative z-10 w-full max-w-[360px]"
              >
                {activeFeat === 0 && (
                  <div className="bg-white rounded-2xl border border-line shadow-2xl overflow-hidden relative">
                    <div className="bg-sage-soft p-3 border-b border-line flex items-center gap-2">
                      <div className="flex gap-1.5" dir="ltr">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-400"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-green-400"></div>
                      </div>
                      <div className="mx-auto text-[10px] font-mono text-ink/50 bg-white px-2 py-0.5 rounded border border-line">
                        draft_motion_final.docx
                      </div>
                    </div>
                    <div className="p-6 relative">
                      <div className="absolute -top-3 -right-2 bg-teal-deep text-white text-[10px] font-bold px-3 py-1.5 rounded-lg shadow-lg flex items-center gap-1.5 z-10">
                        <Sparkles className="w-3 h-3 text-brass-light" />
                        {isRtl ? "صياغة مدعومة بالذكاء الاصطناعي" : "AI Drafted - 98% Match"}
                      </div>

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-4"
                        dir={language === "ar" ? "rtl" : "ltr"}
                      >
                        <div className="h-3 w-1/3 bg-muted rounded mb-6"></div>

                        <div className="space-y-2.5">
                          <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 1, ease: "easeOut" }} className="h-2 bg-muted rounded"></motion.div>
                          <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 1, delay: 0.1, ease: "easeOut" }} className="h-2 bg-muted rounded"></motion.div>
                          <motion.div initial={{ width: 0 }} animate={{ width: "85%" }} transition={{ duration: 1, delay: 0.2, ease: "easeOut" }} className="h-2 bg-muted rounded"></motion.div>
                        </div>

                        <div className="py-2"></div>

                        <div className="space-y-2.5 relative">
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.4 }}
                            className="absolute -left-2 -top-2 -bottom-2 w-1 bg-brass rounded-full"
                          />
                          <motion.div initial={{ width: 0 }} animate={{ width: "100%" }} transition={{ duration: 1, delay: 0.5, ease: "easeOut" }} className="h-2 bg-brass-light/40 rounded"></motion.div>
                          <motion.div initial={{ width: 0 }} animate={{ width: "90%" }} transition={{ duration: 1, delay: 0.6, ease: "easeOut" }} className="h-2 bg-brass-light/40 rounded"></motion.div>
                          <motion.div initial={{ width: 0 }} animate={{ width: "60%" }} transition={{ duration: 1, delay: 0.7, ease: "easeOut" }} className="h-2 bg-brass-light/40 rounded"></motion.div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                )}

                {activeFeat === 1 && (
                  <div className="relative bg-white rounded-2xl border border-line shadow-2xl p-6 overflow-hidden">
                    <div className="absolute inset-0 bg-sage-soft/30 -z-10"></div>

                    <div className="flex items-center gap-3 mb-6 border-b border-line pb-4" dir={language === "ar" ? "rtl" : "ltr"}>
                      <div className="w-10 h-10 bg-brass/10 rounded-lg flex items-center justify-center">
                        <FileSearch className="w-5 h-5 text-brass-dark" />
                      </div>
                      <div>
                        <div className="text-xs font-bold">
                          {isRtl ? "تحليل اتفاقية الشراكة" : "Partnership Agreement Analysis"}
                        </div>
                        <div className="text-[10px] text-ink/50 font-mono">
                          42 {isRtl ? "صفحة" : "pages"} • 12s {isRtl ? "متبقي" : "remaining"}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4 relative z-0" dir={language === "ar" ? "rtl" : "ltr"}>
                      <div className="h-2 w-full bg-muted rounded"></div>
                      <div className="h-2 w-full bg-muted rounded"></div>
                      <div className="h-2 w-3/4 bg-muted rounded"></div>

                      <motion.div
                        initial={{ backgroundColor: "rgba(254, 242, 242, 0)", borderColor: "rgba(254, 226, 226, 0)" }}
                        animate={{ backgroundColor: "rgba(254, 242, 242, 1)", borderColor: "rgba(254, 226, 226, 1)" }}
                        transition={{ delay: 1 }}
                        className="p-3 border rounded mt-4 relative"
                      >
                        <div className="h-2 w-full bg-red-200/50 rounded mb-2.5"></div>
                        <div className="h-2 w-5/6 bg-red-200/50 rounded"></div>
                      </motion.div>

                      <div className="h-2 w-full bg-muted rounded mt-4"></div>
                      <div className="h-2 w-4/5 bg-muted rounded"></div>
                    </div>

                    <motion.div
                      className="absolute left-0 right-0 h-0.5 bg-brass shadow-[0_0_15px_3px_rgba(176,141,87,0.6)] z-10"
                      animate={{ top: ["15%", "85%", "15%"] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    />

                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: "spring", delay: 1.2 }}
                      className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-red-500 text-white text-xs font-bold px-3 py-2 rounded-lg shadow-xl flex items-center gap-2 whitespace-nowrap"
                      dir={language === "ar" ? "rtl" : "ltr"}
                    >
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                      {isRtl ? "تعارض في المادة 41 (شرط عدم المنافسة)" : "Contradiction: Art 41 (Non-compete)"}
                    </motion.div>
                  </div>
                )}

                {activeFeat === 2 && (
                  <div className="bg-white rounded-2xl border border-line shadow-2xl overflow-hidden" dir={language === "ar" ? "rtl" : "ltr"}>
                    <div className="bg-teal-deep p-5 flex justify-between items-center text-white relative overflow-hidden">
                      <div className="relative z-10">
                        <div className="text-[10px] text-white/70 font-bold uppercase tracking-wider mb-1">
                          {isRtl ? "القضية:" : "Case:"} 1487 / 1447 H
                        </div>
                        <div className="font-serif font-bold text-lg">
                          {isRtl ? "الجدول الزمني الحرج" : "Critical Timeline"}
                        </div>
                      </div>
                      <Clock className="w-8 h-8 text-white/20 absolute -right-2 -bottom-2 scale-150" />
                    </div>

                    <div className="p-0">
                      {[
                        { days: 2, label: isRtl ? "موعد تقديم المذكرة" : "Memo Deadline", urgent: true, date: "15 Aug" },
                        { days: 14, label: isRtl ? "جلسة الاستماع" : "Hearing", urgent: false, date: "27 Aug" },
                        { days: 45, label: isRtl ? "سقوط حق الاستئناف" : "Appeal Expiry", urgent: false, date: "27 Sep" }
                      ].map((d, i) => (
                        <div key={i} className="flex items-stretch border-b border-line last:border-0 relative">
                          {d.urgent && (
                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500"></div>
                          )}
                          <div className={cn(
                            "w-16 md:w-20 p-3 md:p-4 flex flex-col items-center justify-center shrink-0 border-l border-line",
                            d.urgent ? "bg-red-50/50" : "bg-muted/50"
                          )}>
                            <span className={cn("text-xl font-bold leading-none mb-1", d.urgent ? "text-red-600" : "text-ink/60")}>
                              {d.days}
                            </span>
                            <span className={cn("text-[9px] uppercase font-bold", d.urgent ? "text-red-600/70" : "text-ink/40")}>
                              {isRtl ? "أيام" : "days"}
                            </span>
                          </div>

                          <div className="flex-1 p-4 flex flex-col justify-center">
                            <div className="flex justify-between items-center mb-2">
                              <div className={cn("font-bold text-sm", d.urgent ? "text-red-600" : "text-ink")}>{d.label}</div>
                              <div className="text-[10px] font-mono text-ink/40 bg-muted px-2 py-0.5 rounded">{d.date}</div>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: d.urgent ? "85%" : "25%" }}
                                transition={{ delay: i * 0.2 + 0.2, duration: 1, ease: "easeOut" }}
                                className={cn("h-full", d.urgent ? "bg-red-500" : "bg-teal-mid/50")}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeFeat === 3 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4" dir={language === "ar" ? "rtl" : "ltr"}>
                    <div className="bg-sage p-6 rounded-2xl text-white shadow-xl transform -rotate-2 hover:rotate-0 transition-transform duration-300 relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4"></div>

                      <div className="text-white/80 text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                        <Activity className="w-3 h-3" />
                        {isRtl ? "إجمالي المفوتر" : "Total Billed"}
                      </div>
                      <div className="text-2xl md:text-3xl font-serif font-bold mb-4 md:mb-6">$45,200</div>

                      <div className="h-8 md:h-12 w-full flex items-end gap-1.5">
                        {[40, 60, 30, 80, 50, 90, 70].map((h, i) => (
                          <motion.div
                            key={i}
                            initial={{ height: 0 }}
                            animate={{ height: `${h}%` }}
                            transition={{ delay: i * 0.05, duration: 0.5, type: "spring" }}
                            className="flex-1 bg-white/30 rounded-sm hover:bg-white/50 transition-colors cursor-pointer"
                          ></motion.div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-brass p-6 rounded-2xl text-ink shadow-xl transform rotate-2 hover:rotate-0 transition-transform duration-300 flex flex-col justify-between relative overflow-hidden">
                      <div className="absolute -bottom-4 -left-4 w-24 h-24 bg-white/20 rounded-full blur-xl"></div>

                      <div>
                        <div className="text-ink/60 text-[10px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5">
                          <Scale className="w-3 h-3" />
                          {isRtl ? "قابل للتحصيل" : "Collectible"}
                        </div>
                        <div className="text-2xl md:text-3xl font-serif font-bold">$38,000</div>
                      </div>

                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.5 }}
                        className="flex items-center gap-2 text-xs bg-white/40 p-2.5 rounded-lg mt-6 backdrop-blur-sm border border-white/20 font-medium"
                      >
                        <div className="w-5 h-5 rounded-full bg-green-500/20 text-green-700 flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-3 h-3" />
                        </div>
                        <span>{isRtl ? "رصيد أمانة متوفر" : "Trust Balance OK"}</span>
                      </motion.div>
                    </div>
                  </div>
                )}

                {activeFeat === 4 && (
                  <div className="bg-[#EFEFEF] p-3 rounded-[2rem] border-[6px] border-ink shadow-2xl relative mx-auto w-[280px]">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-5 bg-ink rounded-b-2xl z-20"></div>

                    <div className="bg-white h-[380px] lg:h-[480px] rounded-[1.5rem] overflow-hidden flex flex-col relative">
                      <div className="bg-teal-deep pt-8 pb-4 px-4 text-white text-center shadow-md relative z-10">
                        <div className="font-bold text-[15px] tracking-wide">
                          {isRtl ? "بوابة الموكل" : "Client Portal"}
                        </div>
                        <div className="text-[10px] text-white/80 mt-0.5">
                          {isRtl ? "تحديث حي" : "Live Update"}
                        </div>
                      </div>

                      <div className="flex-1 p-4 space-y-4 bg-paper/50 overflow-hidden relative" dir={language === "ar" ? "rtl" : "ltr"}>
                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.2 }}
                          className="bg-white p-3.5 rounded-2xl rounded-tr-sm border border-line text-[13px] font-medium shadow-sm relative"
                        >
                          <div className="text-[10px] text-ink/40 font-bold mb-1 uppercase tracking-wider">
                            {isRtl ? "أمس، 10:30 ص" : "Yesterday, 10:30 AM"}
                          </div>
                          <p>
                            {isRtl
                              ? "تم إيداع مذكرة الرد الخاصة بنا لدى المحكمة التجارية بنجاح."
                              : "Our reply memo was successfully filed with the Commercial Court."}
                          </p>
                        </motion.div>

                        <motion.div
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.6 }}
                          className="bg-brass-light/10 p-3.5 rounded-2xl rounded-tr-sm border border-brass-light/30 text-[13px] font-medium shadow-sm relative"
                        >
                          <div className="absolute -left-1 -top-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white"></div>
                          <div className="text-[10px] text-brass-dark font-bold mb-1 uppercase tracking-wider flex items-center gap-1">
                            <Sparkles className="w-3 h-3" />
                            {isRtl ? "الآن" : "Just now"}
                          </div>
                          <p className="text-ink">
                            {isRtl
                              ? "تم تحديد موعد الجلسة القادمة بتاريخ 15 أغسطس عبر الاتصال المرئي."
                              : "Next hearing scheduled for Aug 15 via video conference."}
                          </p>
                        </motion.div>
                      </div>

                      <div className="p-4 border-t border-line bg-white">
                        <div className="h-10 bg-muted rounded-full flex items-center px-4 justify-between">
                          <div className="text-xs text-ink/40 font-medium">
                            {isRtl ? "اكتب رسالة..." : "Type a message..."}
                          </div>
                          <div className="w-6 h-6 rounded-full bg-teal-deep flex items-center justify-center">
                            <ArrowUpRight className="w-3 h-3 text-white" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}

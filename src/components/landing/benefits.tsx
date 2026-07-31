"use client";

import React from "react";
import { Clock, TrendingUp, PenLine, Search, RefreshCw, Scale } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";

const benefits = [
  {
    icon: Clock,
    title: { ar: "وفّر ساعات كل أسبوع", en: "Save hours every week" },
    desc: {
      ar: "أتمتة الأعمال القانونية المتكررة لتركّز على الاستراتيجية والمرافعة.",
      en: "Automate repetitive legal work so you can focus on strategy and advocacy.",
    },
  },
  {
    icon: TrendingUp,
    title: { ar: "زد قدرتك القابلة للفوترة", en: "Increase billable capacity" },
    desc: {
      ar: "عالج المزيد من القضايا دون زيادة عبء العمل.",
      en: "Handle more matters without increasing your workload.",
    },
  },
  {
    icon: PenLine,
    title: { ar: "اصغِ أسرع", en: "Draft faster" },
    desc: {
      ar: "مسودات أولية عالية الجودة للمستندات القانونية في دقائق.",
      en: "Generate high-quality first drafts of legal documents in minutes.",
    },
  },
  {
    icon: Search,
    title: { ar: "ابحث بذكاء", en: "Research smarter" },
    desc: {
      ar: "حدّد مواقع التشريعات والمراجع القانونية ذات الصلة أسرع بكثير من البحث التقليدي.",
      en: "Locate relevant legislation, regulations, and legal authorities much faster than traditional research.",
    },
  },
  {
    icon: RefreshCw,
    title: { ar: "قلّل العمل المتكرر", en: "Reduce repetitive work" },
    desc: {
      ar: "أعد استخدام القوالب، حسّن الاتساق، وتخلّص من الصياغة المكررة.",
      en: "Reuse templates, improve consistency, and eliminate repetitive drafting.",
    },
  },
  {
    icon: Scale,
    title: { ar: "جهّز قضايا أقوى", en: "Prepare stronger cases" },
    desc: {
      ar: "نظّم الوقائع، حدّد المسائل القانونية، وطوّر حججاً قانونية منظمة.",
      en: "Organize facts, identify legal issues, and develop structured legal arguments.",
    },
  },
];

export default function Benefits() {
  const { isRtl } = useLanguage();

  return (
    <section className="py-16 md:py-24 bg-paper">
      <div className="max-w-[1180px] mx-auto px-5 md:px-7">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <div className="text-xs font-bold tracking-widest uppercase text-brass mb-4">
            {isRtl ? "نتائج تهم المحامين فعلاً" : "Outcomes lawyers actually care about"}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            {isRtl ? "لماذا يختار المحامون الميزان؟" : "Why lawyers choose Al Mizan"}
          </h2>
          <p className="text-ink/70 leading-relaxed">
            {isRtl
              ? "أكثر من مجرد أداة — شريك يومي يمنحك الوقت والثقة لتقديم أفضل ما لديك."
              : "More than a tool — a daily partner that gives you back time and confidence to do your best work."}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {benefits.map((b, i) => (
            <div
              key={i}
              className="group bg-white rounded-2xl border border-line p-6 hover:border-brass/40 hover:shadow-xl transition-all hover:-translate-y-1"
              dir={isRtl ? "rtl" : "ltr"}
            >
              <div className="w-11 h-11 rounded-xl bg-sage-soft flex items-center justify-center mb-4 group-hover:bg-brass/15 transition-colors">
                <b.icon className="w-5 h-5 text-teal-deep group-hover:text-brass-dark transition-colors" />
              </div>
              <h3 className="font-bold text-ink text-lg mb-2">{isRtl ? b.title.ar : b.title.en}</h3>
              <p className="text-sm text-ink/60 leading-relaxed">{isRtl ? b.desc.ar : b.desc.en}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

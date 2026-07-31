"use client";

import React from "react";
import { Search, FileText, Gavel, ScanSearch, ClipboardCheck, Users } from "lucide-react";
import { useLanguage } from "@/components/providers/language-provider";

const useCases = [
  {
    icon: Search,
    title: { ar: "البحث القانوني", en: "Legal Research" },
    desc: {
      ar: "اطرح أسئلة قانونية معقدة بلغة بسيطة واحصل على بحث منظم مع مراجع قانونية داعمة.",
      en: "Ask complex legal questions in plain language and receive organized research with supporting legal references.",
    },
    accent: "text-brass-dark bg-brass/15",
  },
  {
    icon: FileText,
    title: { ar: "صياغة العقود", en: "Contract Drafting" },
    desc: {
      ar: "أنشئ اتفاقيات احترافية مصممة خصيصاً حسب قضيتك وملفك.",
      en: "Create professional agreements tailored to your matter.",
    },
    accent: "text-teal-deep bg-teal-deep/10",
  },
  {
    icon: Gavel,
    title: { ar: "التقاضي", en: "Litigation" },
    desc: {
      ar: "صياغة اللوائح والمذكرات القانونية والردود والطلبات والمرافعات.",
      en: "Draft pleadings, legal memoranda, responses, motions, and arguments.",
    },
    accent: "text-sage bg-sage/15",
  },
  {
    icon: ScanSearch,
    title: { ar: "تحليل القضايا", en: "Case Analysis" },
    desc: {
      ar: "ارفع ملفات القضايا واحصل على ملخصات وجداول زمنية ومسائل قانونية ووقائع رئيسية.",
      en: "Upload case files and receive summaries, timelines, legal issues, and key facts.",
    },
    accent: "text-brass-dark bg-brass/15",
  },
  {
    icon: ClipboardCheck,
    title: { ar: "المراجعة القانونية", en: "Legal Review" },
    desc: {
      ar: "راجع العقود للكشف عن المخاطر والبنود الناقصة والتناقضات والمشكلات المحتملة.",
      en: "Review contracts for risks, missing clauses, inconsistencies, and potential issues.",
    },
    accent: "text-teal-deep bg-teal-deep/10",
  },
  {
    icon: Users,
    title: { ar: "اجتماعات الموكلين", en: "Client Meetings" },
    desc: {
      ar: "تجهّز قبل الاستشارات ببحث سريع وملاحظات منظمة.",
      en: "Prepare before consultations with quick research and organized notes.",
    },
    accent: "text-sage bg-sage/15",
  },
];

export default function UseCases() {
  const { isRtl } = useLanguage();

  return (
    <section id="use-cases" className="py-16 md:py-24 bg-ivory">
      <div className="max-w-[1180px] mx-auto px-5 md:px-7">
        <div className="max-w-2xl mx-auto text-center mb-14">
          <div className="text-xs font-bold tracking-widest uppercase text-brass mb-4">
            {isRtl ? "حالات استخدام حقيقية" : "Real ways to use it"}
          </div>
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
            {isRtl ? "ماذا يمكنك أن تفعل بمساحة عمل واحدة؟" : "What you can do in one workspace"}
          </h2>
          <p className="text-ink/70 leading-relaxed">
            {isRtl
              ? "من البحث الأول إلى الاستشارة القادمة — الميزان معك في كل خطوة من دورة العمل القانوني."
              : "From first research to your next consultation — Al Mizan is with you at every step of the legal workflow."}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {useCases.map((c, i) => (
            <div
              key={i}
              className="group bg-white rounded-2xl border border-line p-6 hover:border-brass/40 hover:shadow-xl transition-all hover:-translate-y-1"
              dir={isRtl ? "rtl" : "ltr"}
            >
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${c.accent} group-hover:scale-110 transition-transform`}>
                <c.icon className="w-5 h-5" />
              </div>
              <h3 className="font-bold text-ink text-lg mb-2">{isRtl ? c.title.ar : c.title.en}</h3>
              <p className="text-sm text-ink/60 leading-relaxed">{isRtl ? c.desc.ar : c.desc.en}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

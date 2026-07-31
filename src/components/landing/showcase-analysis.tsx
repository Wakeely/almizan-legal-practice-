"use client";

import React from "react";
import { FileSearch, Sparkles, Scale, Search } from "lucide-react";
import { motion } from "framer-motion";
import { useLanguage } from "@/components/providers/language-provider";

export default function ShowcaseAnalysis() {
  const { language, isRtl } = useLanguage();

  return (
    <section id="analysis" className="py-16 md:py-24 bg-teal-mid text-white relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--color-teal-mid)_0%,_transparent_70%)]"></div>
      <div className="max-w-[1180px] mx-auto px-5 md:px-7 relative z-10">
        <div className="grid lg:grid-cols-2 gap-8 lg:gap-16 items-center">
          <div className="order-2 lg:order-1">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-sm"
            >
              <div className="flex items-center justify-between mb-8 border-b border-white/10 pb-4">
                <div className="flex items-center gap-3">
                  <FileSearch className="w-5 h-5 text-brass-light" />
                  <span className="font-semibold text-sm">
                    {isRtl ? "تحليل ملف القضية #4092" : "Analyzing Case File #4092"}
                  </span>
                </div>
                <div className="text-xs text-white/50 font-mono">1,245 Pages</div>
              </div>

              <div className="space-y-6">
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-brass/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-4 h-4 text-brass-light" />
                  </div>
                  <div>
                    <h4 className="font-bold text-brass-light text-sm mb-1">
                      {isRtl ? "تناقض في الشهادات" : "Contradiction in Testimonies"}
                    </h4>
                    <p className="text-sm text-white/80 leading-relaxed">
                      {isRtl
                        ? "أقوال الشاهد الأول في الصفحة 42 تتعارض مع التقرير المالي المرفق في الملحق (ج)."
                        : "First witness's statement on page 42 contradicts the financial report attached in Appendix C."}
                    </p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-brass/20 flex items-center justify-center shrink-0">
                    <Scale className="w-4 h-4 text-brass-light" />
                  </div>
                  <div>
                    <h4 className="font-bold text-brass-light text-sm mb-1">
                      {isRtl ? "سابقة قضائية مطابقة" : "Matching Legal Precedent"}
                    </h4>
                    <p className="text-sm text-white/80 leading-relaxed">
                      {isRtl
                        ? "حكم محكمة التمييز رقم 144/2021 يتطابق مع وقائع هذه القضية ويمكن الاستناد إليه."
                        : "Cassation Court ruling 144/2021 perfectly matches the facts of this case and can be cited."}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="order-1 lg:order-2">
            <div className="text-xs font-bold tracking-widest uppercase text-brass-light mb-4">
              {isRtl ? "القدرة الفارقة" : "The differentiator"}
            </div>
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-6 leading-[1.3]">
              {isRtl ? "حلّل القضايا المعقدة في دقائق، لا أيام" : "Analyze complex cases in minutes, not days"}
            </h2>
            <p className="text-white/70 leading-relaxed mb-10 text-lg">
              {isRtl
                ? "لا تضيع ساعاتك في قراءة آلاف الصفحات بحثاً عن ثغرة. الميزان يقرأ، يحلل، ويربط بين الوقائع والمواد القانونية ليضع الاستراتيجية الأقوى بين يديك."
                : "Don't waste hours reading thousands of pages looking for a loophole. Al Mizan reads, analyzes, and connects facts with legal articles to put the strongest strategy in your hands."}
            </p>
            <div className="space-y-5">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-brass/20 flex items-center justify-center shrink-0">
                  <Search className="w-4 h-4 text-brass-light" />
                </div>
                <div>
                  <div className="font-bold text-brass-light text-sm mb-0.5">
                    {isRtl ? "من الصفحات إلى الاستراتيجية" : "From pages to strategy"}
                  </div>
                  <div className="text-sm text-white/70 leading-relaxed">
                    {isRtl
                      ? "ملف من آلاف الصفحات يتحول إلى ملخص استراتيجي منظم بوقائع ومسائل قانونية."
                      : "A file of thousands of pages becomes one organized strategy — facts and legal issues mapped out."}
                  </div>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-full bg-brass/20 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4 text-brass-light" />
                </div>
                <div>
                  <div className="font-bold text-brass-light text-sm mb-0.5">
                    {isRtl ? "ثغرات وسوابق تلقائياً" : "Loopholes & precedents, automatically"}
                  </div>
                  <div className="text-sm text-white/70 leading-relaxed">
                    {isRtl
                      ? "تناقضات وسوابق قضائية مطابقة تُستخرج وترتبط بقضيتك دون بحث يدوي."
                      : "Contradictions and matching precedents surfaced and linked to your case — no manual digging."}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

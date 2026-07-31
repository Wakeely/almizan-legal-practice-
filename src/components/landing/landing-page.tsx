'use client';

import React, { useState } from 'react';
import { 
  ArrowRight, 
  Briefcase, 
  ChevronDown, 
  Globe, 
  Scale, 
  ShieldCheck, 
  Users 
} from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import ShowcaseFeatures from '@/components/landing/showcase-features';
import ShowcaseDemo from '@/components/landing/showcase-demo';
import ShowcaseAnalysis from '@/components/landing/showcase-analysis';
import ShowcaseExport from '@/components/landing/showcase-export';
import Hero from '@/components/landing/hero';
import Benefits from '@/components/landing/benefits';
import UseCases from '@/components/landing/use-cases';
import Comparison from '@/components/landing/comparison';

interface LandingPageProps {
  onEnterWorkspace: () => void;
  onEnterClientPortal: () => void;
}

export default function LandingPage({ onEnterWorkspace, onEnterClientPortal }: LandingPageProps) {
  const { language, setLanguage, isRtl } = useLanguage();
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const faqs = [
    {
      qEn: "How does Al Mizan maintain offline access during court sessions?",
      qAr: "كيف يضمن الميزان إمكانية الوصول إلى القضايا والمستندات بدون إنترنت في قاعة المحكمة؟",
      aEn: "Al Mizan uses IndexedDB browser storage technology. All matter data, case timelines, attached documents, tasks, and time entries are automatically cached locally. When your device loses connectivity inside courtroom basements or transit, you can continue viewing and editing data seamlessly.",
      aAr: "يعتمد الميزان على تقنية IndexedDB للتخزين المحلي المتقدم داخل المتصفح. يتم حفظ بيانات القضايا والمستندات والمهام تلقائياً. عند انقطاع الشبكة داخل قاعات المحكمة أو التسجيل، يمكنك متابعة الاطلاع على البيانات دون أي انقطاع."
    },
    {
      qEn: "Is client and case data kept strictly secure and private?",
      qAr: "هل بيانات الموكلين والقضايا محفوفة بضمانات الخصوصية والأمان؟",
      aEn: "Yes. All AI API communications route through dedicated server-side proxy routes using environment key protection. Raw API keys are never exposed to client browsers. Furthermore, row-level tenant isolation in PostgreSQL ensures data is strictly separated between authorized organizations.",
      aAr: "نعم بصرامة. تمر كافة الاتصالات بالذكاء الاصطناعي عبر خوادم آمنة مع حماية المفاتيح المشفّرة. ولا يتم كشف أي مفاتيح API للمتصفح، بالإضافة إلى عزل البيانات على مستوى الصفوف في قاعدة بيانات PostgreSQL لضمان فصل تام بين المؤسسات."
    },
    {
      qEn: "Can my clients view case progress without installing any software?",
      qAr: "هل يمكن للموكلين متابعة القضايا دون الحاجة لتنزيل أي برامج؟",
      aEn: "Absolutely. Al Mizan features a built-in Client Portal view. Clients receive a clean, secure view showing case timelines, shared documents, pending billing invoices, and direct messaging with their legal team from any web browser.",
      aAr: "بالتأكيد. يوفر النظام بوابة موكلين تفاعلية وآمنة تعمل مباشرة على كافة المتصفحات دون الحاجة لتنزيل أي برامج، حيث يمكنهم مراجعة المستندات وفواتير أتعاب المحاماة."
    },
    {
      qEn: "Is Al Mizan available in both Arabic and English?",
      qAr: "هل الميزان يدعم اللغتين العربية والإنجليزية بطلاقة؟",
      aEn: "Yes! Al Mizan is natively bilingual with complete Right-to-Left (RTL) support for Arabic legal terminology and Left-to-Right (LTR) support for English corporate law practices.",
      aAr: "نعم! الميزان مصمم بخصائص ثنائية اللغة كاملة مع دعم واجهات الاتجاه من اليمين إلى اليسار (RTL) للغة العربية والمصطلحات القضائية الرسمية."
    }
  ];

  return (
    <div className="bg-ivory text-ink font-sans min-h-screen flex flex-col overflow-x-hidden pb-20 sm:pb-0">

      {/* 1. Global Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-ivory/90 backdrop-blur-md border-b border-brass/20 px-2.5 sm:px-8 py-2.5 sm:py-3 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          
          {/* Brand Logo — ONLY the logo, no text (per user request) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            { }
            <img src="/logo-header-dark.png" alt="Al Mizan Legal Practice" className="h-12 sm:h-16 w-auto shrink-0" />
          </div>

          {/* Center Quick Nav */}
          <div className="hidden lg:flex items-center gap-6 text-xs font-bold text-ink/70">
            <a href="#who-is-it-for" className="hover:text-brass transition-colors">{isRtl ? 'من المستفيد؟' : 'Who It Is For'}</a>
            <a href="#features" className="hover:text-brass transition-colors">{isRtl ? 'القدرات' : 'Capabilities'}</a>
            <a href="#demo" className="hover:text-brass transition-colors">{isRtl ? 'التجربة' : 'Demo'}</a>
            <a href="#analysis" className="hover:text-brass transition-colors">{isRtl ? 'التحليل الاستراتيجي' : 'Analysis'}</a>
            <a href="#faq" className="hover:text-brass transition-colors">{isRtl ? 'الأسئلة الشائعة' : 'FAQ'}</a>
          </div>

          {/* Action Buttons & Language Switcher */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs font-bold text-ink bg-white border border-brass/30 hover:border-brass rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Globe className="w-3.5 h-3.5 text-brass" />
              <span>{language === 'ar' ? 'English' : 'العربية'}</span>
            </button>

            <button
              onClick={onEnterClientPortal}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-brass-dark bg-brass/15 border border-brass/30 hover:bg-brass/25 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{isRtl ? 'بوابة الموكل' : 'Client Portal'}</span>
            </button>

            <button
              onClick={onEnterWorkspace}
              className="hidden sm:flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-extrabold text-ivory bg-gradient-to-r from-teal-deep to-teal-mid hover:from-teal-mid hover:to-teal-mid rounded-xl shadow-lg shadow-teal-deep/30 border border-teal-mid transition-all cursor-pointer group whitespace-nowrap shrink-0"
            >
              <span>{isRtl ? 'دخول بيئة العمل' : 'Launch Workspace'}</span>
              <ArrowRight className={`w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform ${isRtl ? 'rotate-180' : ''}`} />
            </button>
          </div>

        </div>
      </nav>

      {/* 2. Hero */}
      <Hero onEnterWorkspace={onEnterWorkspace} />

      {/* 3. Benefits */}
      <Benefits />

      {/* 4. Use Cases */}
      <UseCases />

      {/* 5. Who Is It For? (Target Personas) */}
      <section id="who-is-it-for" className="py-20 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold text-brass-dark uppercase tracking-widest bg-brass/10 border border-brass/30 px-3 py-1 rounded-full">
            {isRtl ? 'القطاعات المستهدفة' : 'Tailored For Legal Excellence'}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-ink mt-4 font-display">
            {isRtl ? 'لمن صُمم الميزان؟' : 'Who Benefits From Al Mizan?'}
          </h2>
          <p className="text-ink/60 text-sm sm:text-base mt-3">
            {isRtl 
              ? 'حلول مخصصة تلبي تطلعات المحامين، مدراء المكاتب، والشركات الكبرى لضمان أقصى كفاءة قضائية.'
              : 'Purpose-built for litigation specialists, firm leaders, corporate counsel, and legal operations.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Persona 1: Trial Lawyers */}
          <div className="p-6 bg-white border border-line rounded-2xl hover:border-teal-deep/60 transition-all flex flex-col justify-between group shadow-sm">
            <div>
              <div className="w-12 h-12 rounded-xl bg-teal-deep/10 border border-teal-deep/30 text-teal-deep flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Scale className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-ink mb-2">
                {isRtl ? 'المحامون والمرافعون' : 'Litigation Attorneys'}
              </h3>
              <p className="text-xs text-ink/60 leading-relaxed">
                {isRtl 
                  ? 'صياغة المذكرات والدفوع بدقة عالية، تتبع مدد السقوط والتقادم، وإمكانية تصفح القضايا بدون إنترنت أثناء الجلسات.'
                  : 'Instant pleading generation, statutory limitation countdowns, and reliable offline access during court appearances.'}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-line text-[11px] font-semibold text-teal-deep flex items-center gap-1">
              <span>{isRtl ? 'الميزة الرئيسية: المحرر الذكي' : 'Key Advantage: AI Drafter'}</span>
            </div>
          </div>

          {/* Persona 2: Managing Partners */}
          <div className="p-6 bg-white border border-line rounded-2xl hover:border-brass/70 transition-all flex flex-col justify-between group shadow-sm">
            <div>
              <div className="w-12 h-12 rounded-xl bg-brass/15 border border-brass/30 text-brass-dark flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Briefcase className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-ink mb-2">
                {isRtl ? 'الشركاء ومدراء المكاتب' : 'Managing Partners'}
              </h3>
              <p className="text-xs text-ink/60 leading-relaxed">
                {isRtl 
                  ? 'رؤية شاملة لأداء المكتب، أرباح القضايا، حسابات الأمانات، ومعدل كسب القضايا مع تحليلات مالية دقيقة.'
                  : 'Real-time firm profitability metrics, unbilled hour tracking, trust accounting, and high-level case analytics.'}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-line text-[11px] font-semibold text-brass-dark flex items-center gap-1">
              <span>{isRtl ? 'الميزة الرئيسية: لوحة التحليلات' : 'Key Advantage: Analytics'}</span>
            </div>
          </div>

          {/* Persona 3: In-House Corporate Counsel */}
          <div className="p-6 bg-white border border-line rounded-2xl hover:border-sage/70 transition-all flex flex-col justify-between group shadow-sm">
            <div>
              <div className="w-12 h-12 rounded-xl bg-sage/20 border border-sage/40 text-teal-mid flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-ink mb-2">
                {isRtl ? 'الإدارات القانونية بالشركات' : 'Corporate In-House Counsel'}
              </h3>
              <p className="text-xs text-ink/60 leading-relaxed">
                {isRtl 
                  ? 'متابعة النزاعات التجارية، إدارة عقود الموردين والمستندات المشفّرة، وضبط ميزانيات الأتعاب الخارجية.'
                  : 'Centralize corporate disputes, manage outside counsel billables, summarize contract risks, and enforce compliance.'}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-line text-[11px] font-semibold text-teal-mid flex items-center gap-1">
              <span>{isRtl ? 'الميزة الرئيسية: إدارة المخاطر' : 'Key Advantage: Risk Management'}</span>
            </div>
          </div>

          {/* Persona 4: Clients */}
          <div className="p-6 bg-white border border-line rounded-2xl hover:border-teal-mid/70 transition-all flex flex-col justify-between group shadow-sm">
            <div>
              <div className="w-12 h-12 rounded-xl bg-teal-mid/10 border border-teal-mid/30 text-teal-mid flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-ink mb-2">
                {isRtl ? 'الموكلون وأصحاب القضايا' : 'Corporate Clients'}
              </h3>
              <p className="text-xs text-ink/60 leading-relaxed">
                {isRtl 
                  ? 'بوابة خاصة لكل موكل لمتابعة مستجدات القضية، الاطلاع على المستندات المصرح بها، وسداد الفواتير بمرونة.'
                  : 'Dedicated transparent client portal for live case status updates, document sharing, and invoice settlement.'}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-line text-[11px] font-semibold text-teal-mid flex items-center gap-1">
              <span>{isRtl ? 'الميزة الرئيسية: بوابة الموكل' : 'Key Advantage: Client Portal'}</span>
            </div>
          </div>

        </div>
      </section>

      {/* 6. Ported Showcase Sections */}
      <ShowcaseFeatures />
      <ShowcaseDemo />
      <ShowcaseAnalysis />
      <ShowcaseExport />

      {/* 7. Comparison */}
      <Comparison />

      {/* 8. FAQ Accordion Section */}
      <section id="faq" className="py-20 px-4 sm:px-8 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-brass-dark uppercase tracking-widest bg-brass/10 border border-brass/30 px-3 py-1 rounded-full">
            {isRtl ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-ink mt-4 font-display">
            {isRtl ? 'كل ما تحتاج معرفته عن المنظومة' : 'Everything You Need To Know'}
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="bg-white border border-line rounded-2xl overflow-hidden transition-all shadow-sm"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full px-6 py-4 text-left rtl:text-right flex items-center justify-between text-sm sm:text-base font-bold text-ink hover:text-brass-dark transition-colors cursor-pointer"
                >
                  <span className="pr-4">{isRtl ? faq.qAr : faq.qEn}</span>
                  <ChevronDown className={`w-5 h-5 text-sage shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-xs sm:text-sm text-ink/70 leading-relaxed border-t border-line pt-3">
                    {isRtl ? faq.aAr : faq.aEn}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 9. Strong Closing CTA Banner */}
      <section className="py-12 sm:py-20 px-3 sm:px-8 max-w-6xl mx-auto text-center relative">
        <div className="p-5 sm:p-16 bg-gradient-to-br from-teal-mid via-teal-mid to-brass-dark rounded-3xl border border-line-dark shadow-2xl shadow-teal-deep/40 relative overflow-hidden">
          
          <div className="relative z-10 max-w-3xl mx-auto space-y-4 sm:space-y-6">
            <h2 className="text-xl sm:text-4xl md:text-5xl font-black text-ivory font-display tracking-tight leading-snug sm:leading-tight">
              {isRtl 
                ? 'جاهز للارتقاء بأداء مكتبك القانوني إلى آفاق جديدة؟' 
                : 'Ready To Modernize Your Legal Practice?'}
            </h2>
            <p className="text-sage-soft text-xs sm:text-base md:text-lg font-medium leading-relaxed">
              {isRtl 
                ? 'صياغة تلقائية للمذكرات، عمل موثوق في قاعة المحكمة، وبوابة موكلين خاصة — كل ذلك في منظومة واحدة.' 
                : 'Autonomous pleading drafting, courtroom offline access, and white-label client portals — all in one powerful suite.'}
            </p>

            <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full">
              <button
                onClick={onEnterWorkspace}
                className="w-full sm:w-auto px-5 sm:px-8 py-3.5 sm:py-4 bg-ivory hover:bg-white text-teal-deep font-black text-sm sm:text-base rounded-2xl shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 transform hover:scale-105 active:scale-95 leading-normal"
              >
                <Scale className="w-5 h-5 text-brass-dark shrink-0" />
                <span className="text-center">{isRtl ? 'دخول بيئة العمل الذكية الآن' : 'Launch Workspace Environment'}</span>
                <ArrowRight className={`w-4 h-4 shrink-0 ${isRtl ? 'rotate-180' : ''}`} />
              </button>

              <button
                onClick={onEnterClientPortal}
                className="w-full sm:w-auto px-5 sm:px-6 py-3.5 sm:py-4 bg-brass/20 hover:bg-brass/30 text-ivory font-bold text-sm sm:text-base rounded-2xl border border-brass/40 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Users className="w-5 h-5 text-brass-light shrink-0" />
                <span className="text-center">{isRtl ? 'تجربة بوابة الموكل' : 'Client Portal Demo'}</span>
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* 10. Landing Footer */}
      <footer className="py-8 border-t border-line text-center text-xs text-ink/60 font-medium">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            { }
            <img src="/logo-header-dark.png" alt="Al Mizan Legal Practice" className="h-10 w-auto" />
          </div>
          <span>{isRtl ? 'جميع الحقوق محفوظة © ٢٠٢٦ الميزان' : '© 2026 Al Mizan. All Rights Reserved.'}</span>
          <div className="flex gap-4">
            <button onClick={onEnterWorkspace} className="hover:text-brass-dark transition-colors">Workspace</button>
            <button onClick={onEnterClientPortal} className="hover:text-brass-dark transition-colors">Portal</button>
          </div>
        </div>
      </footer>

      {/* 11. Mobile Sticky Bottom Navigation CTA Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-ivory/95 backdrop-blur-xl border-t border-line p-2.5 shadow-2xl flex items-center justify-between gap-2">
        <button
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="px-2.5 py-2 text-xs font-bold text-ink bg-white border border-line rounded-xl flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5 text-brass" />
          <span>{language === 'ar' ? 'English' : 'العربية'}</span>
        </button>

        <button
          onClick={onEnterClientPortal}
          className="px-2.5 py-2 text-xs font-bold text-brass-dark bg-brass/15 border border-brass/30 rounded-xl flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <Users className="w-3.5 h-3.5" />
          <span>{isRtl ? 'بوابة الموكل' : 'Portal'}</span>
        </button>

        <button
          onClick={onEnterWorkspace}
          className="flex-1 py-2 px-3 bg-gradient-to-r from-teal-mid via-teal-mid to-teal-mid text-ivory font-black text-xs rounded-xl shadow-lg border border-teal-mid flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-95 transition-transform"
        >
          <span>{isRtl ? 'دخول بيئة العمل' : 'Launch Workspace'}</span>
          <ArrowRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
        </button>
      </div>

    </div>
  );
}

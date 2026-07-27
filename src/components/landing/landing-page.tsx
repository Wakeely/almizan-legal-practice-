'use client';

import React, { useState } from 'react';
import { 
  Scale, 
  Sparkles, 
  ShieldCheck, 
  Zap, 
  WifiOff, 
  FileText, 
  CheckCircle2, 
  ArrowRight, 
  Users, 
  BarChart3, 
  Clock, 
  FolderKanban, 
  CreditCard, 
  MessageSquare, 
  Briefcase, 
  ChevronDown, 
  Play, 
  Globe, 
  Check, 
  AlertTriangle,
  Bot,
  Layers,
  Lock
} from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { useAuth } from '@/components/providers/auth-provider';
import AuthModal from '@/components/auth/auth-modal';
import SubscriptionPaywallModal from '@/components/subscription/subscription-paywall-modal';

interface LandingPageProps {
  onEnterWorkspace: () => void;
  onEnterClientPortal: () => void;
}

export default function LandingPage({ onEnterWorkspace, onEnterClientPortal }: LandingPageProps) {
  const { language, setLanguage, isRtl } = useLanguage();
  const [activeTab, setActiveTab] = useState<'ai' | 'offline' | 'matters' | 'billing' | 'portal'>('ai');
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Playground state for interactive preview
  const [demoPrompt, setDemoPrompt] = useState('Draft a formal notice of dispute for breach of commercial lease contract in Dubai jurisdiction.');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulatedOutput, setSimulatedOutput] = useState<string | null>(null);

  const handleRunSimulation = (customPrompt?: string) => {
    const textToRun = customPrompt || demoPrompt;
    setIsSimulating(true);
    setSimulatedOutput(null);

    setTimeout(() => {
      setIsSimulating(false);
      setSimulatedOutput(
        isRtl
          ? `[صياغة قانونية متقدمة بواسطة الميزان AI]\n\nإلى: الشركة المدعى عليها\nالموضوع: إخطار رسمي بإنهاء عقد إيجار تجاري والإخلال بالتزامات الصيانة\n\nبناءً على أحكام قانون المعاملات المدنية والقوانين العقارية ذات الصلة في النطاق القضائي المذكور:\n١. نود إحاطتكم بعدم سداد القسط المستحق بتاريخ يناير ٢٠٢٦.\n٢. نمنحكم مهلة ٧ أيام عمل لتصحيح المخالفة وإلا سيتم البدء في إجراءات الدعوى المستعجلة.\n\nتاريخ الاستحقاق القانوني للتقادم: خلال ٣٠ يوماً.`
          : `[WAKEELY PRO AI LEGAL DRAFTING SUITE]\n\nTO: Responding Commercial Entity\nRE: Formal Notice of Breach of Lease Contract & Maintenance Default\n\nPursuant to applicable Civil Transactions Code & Commercial Real Estate Directives:\n1. Notice is hereby served regarding delinquent rental installment due January 2026.\n2. You are provided a final cure period of 7 business days prior to filing urgent relief in tribunal.\n\nStatutory Limitation Expiry Check: Valid (30 days remaining for summary proceedings).`
      );
    }, 900);
  };

  const samplePrompts = [
    {
      en: 'Draft a formal notice of dispute for breach of commercial lease contract.',
      ar: 'صياغة إنذار رسمي بسبب الإخلال بعقد إيجار تجاري.'
    },
    {
      en: 'Calculate statute of limitations for tort action filed in 2024.',
      ar: 'حساب مدة التقادم المحددة لدعوى التعويض التقصيري.'
    },
    {
      en: 'Summarize key risk points in 15-page joint venture agreement.',
      ar: 'تلخيص نقاط المخاطر الجوهرية في اتفاقية مشروع مشترك.'
    }
  ];

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
      aEn: "Yes. All AI API communications route through dedicated server-side proxy routes using environment key protection. Raw API keys are never exposed to client browsers. Furthermore, Firestore data security rules ensure data isolation between authorized users.",
      aAr: "نعم بصرامة. تمر كافة الاتصالات بالذكاء الاصطناعي عبر خوادم آمنة مع حماية المفاتيح المشفّرة. ولا يتم كشف أي مفاتيح API للمتصفح، بالإضافة إلى قواعد حماية Firestore المعتمدة."
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
    <div className="bg-slate-50 text-slate-900 font-sans min-h-screen flex flex-col selection:bg-indigo-200 selection:text-slate-900 overflow-x-hidden pb-20 sm:pb-0">
      
      {/* 1. Global Navigation Bar */}
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200/80 px-2.5 sm:px-8 py-2.5 sm:py-3 transition-all">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
          
          {/* Brand Logo — ONLY the logo, no text (per user request) */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            { }
            <img src="/logo-header.svg" alt="Al Mizan Legal Practice" className="h-12 sm:h-16 w-auto shrink-0" />
          </div>

          {/* Center Quick Nav */}
          <div className="hidden lg:flex items-center gap-6 text-xs font-bold text-slate-700">
            <a href="#who-is-it-for" className="hover:text-slate-900 transition-colors">{isRtl ? 'من المستفيد؟' : 'Who Is It For'}</a>
            <a href="#features" className="hover:text-slate-900 transition-colors">{isRtl ? 'المميزات الرئيسية' : 'Core Features'}</a>
            <a href="#demo" className="hover:text-slate-900 transition-colors">{isRtl ? 'تجربة الذكاء الاصطناعي' : 'AI Playground'}</a>
            <a href="#offline" className="hover:text-slate-900 transition-colors">{isRtl ? 'العمل أوفلاين' : 'Offline Engine'}</a>
            <a href="#faq" className="hover:text-slate-900 transition-colors">{isRtl ? 'الأسئلة الشائعة' : 'FAQ'}</a>
          </div>

          {/* Action Buttons & Language Switcher */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            <button
              onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
              className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-200 hover:border-slate-300 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Globe className="w-3.5 h-3.5 text-indigo-600" />
              <span>{language === 'ar' ? 'English' : 'العربية'}</span>
            </button>

            <button
              onClick={onEnterClientPortal}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-amber-600 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0"
            >
              <Users className="w-3.5 h-3.5" />
              <span>{isRtl ? 'بوابة الموكل' : 'Client Portal'}</span>
            </button>

            <button
              onClick={onEnterWorkspace}
              className="hidden sm:flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-extrabold text-slate-900 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-indigo-600/30 border border-indigo-400/30 transition-all cursor-pointer group whitespace-nowrap shrink-0"
            >
              <span>{isRtl ? 'دخول بيئة العمل' : 'Launch Workspace'}</span>
              <ArrowRight className={`w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform ${isRtl ? 'rotate-180' : ''}`} />
            </button>
          </div>

        </div>
      </nav>

      {/* 2. Hero Section */}
      <section className="relative pt-8 sm:pt-20 pb-12 sm:pb-16 px-3 sm:px-8 overflow-hidden bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(99,102,241,0.25),rgba(255,255,255,0))]">
        
        {/* Background Decorative Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

        <div className="max-w-5xl mx-auto text-center relative z-10 flex flex-col items-center">
          
          {/* Animated Status Pill */}
          <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-700 text-xs font-bold mb-4 sm:mb-6 shadow-inner max-w-full leading-normal">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
            </span>
            <span className="truncate">
              {isRtl 
                ? '✨ النظام الذكي المتقدم للخدمات القانونية والصياغة القضائية' 
                : '✨ Autonomous AI Legal Operating System v2.4'}
            </span>
          </div>

          {/* High-Impact Headline */}
          <h1 className="text-2xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-slate-900 tracking-tight leading-snug sm:leading-[1.1] font-display max-w-4xl">
            {isRtl ? (
              <>
                منظومة إدارة المحاماة <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 via-amber-600 to-indigo-600">الذكية المتكاملة</span> للمكاتب والشركاء
              </>
            ) : (
              <>
                The AI Operating System for <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-700 via-amber-600 to-indigo-600">Modern Law Practice</span> & Litigation
              </>
            )}
          </h1>

          {/* Subtitle */}
          <p className="mt-4 sm:mt-6 text-sm sm:text-lg md:text-xl text-slate-700 max-w-3xl font-medium leading-relaxed">
            {isRtl ? (
              'صياغة اللوائح والمذكرات القانونية بالذكاء الاصطناعي، تتبع مدد التقادم والاستحقاق، إدارة فواتير الأتعاب وحسابات الأمانات، ومزامنة المستندات أوفلاين أثناء جلسات المحاكمة.'
            ) : (
              'Automate pleading drafts with Gemini 2.5 AI, monitor statute of limitations deadlines, streamline trust billing, and access case files offline inside courtrooms.'
            )}
          </p>

          {/* Hero CTAs */}
          <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full max-w-md sm:max-w-none">
            <button
              onClick={onEnterWorkspace}
              className="w-full sm:w-auto px-5 sm:px-8 py-3.5 sm:py-4 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 hover:from-indigo-500 hover:to-indigo-500 text-white font-black text-sm sm:text-base rounded-2xl shadow-xl shadow-indigo-600/30 border border-indigo-400/40 transition-all transform hover:-translate-y-0.5 cursor-pointer flex items-center justify-center gap-2 sm:gap-3 leading-normal"
            >
              <Scale className="w-5 h-5 text-indigo-100 shrink-0" />
              <span className="text-center">{isRtl ? 'بدء العمل على المنظومة مجاناً' : 'Launch Live Workspace Now'}</span>
              <ArrowRight className={`w-4 h-4 shrink-0 ${isRtl ? 'rotate-180' : ''}`} />
            </button>

            <a
              href="#demo"
              className="w-full sm:w-auto px-5 sm:px-7 py-3.5 sm:py-4 bg-white/90 hover:bg-slate-200 text-slate-800 font-bold text-sm sm:text-base rounded-2xl border border-slate-300/80 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5 text-amber-600 shrink-0" />
              <span>{isRtl ? 'تجربة صياغة اللوائح' : 'Try AI Playground'}</span>
            </a>
          </div>

          {/* Quick Badges */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-6 text-xs text-slate-500 font-semibold">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              {isRtl ? 'لا يتطلب تثبيت أية برامج' : 'Zero Setup Required'}
            </span>
            <span className="flex items-center gap-1.5">
              <WifiOff className="w-4 h-4 text-amber-600" />
              {isRtl ? 'يعمل أوفلاين في المحكمة (IndexedDB)' : 'Offline Courtroom Access'}
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-indigo-600" />
              {isRtl ? 'حماية مشفرة للبيانات' : 'Encrypted Client Data'}
            </span>
          </div>

          {/* Hero App Mockup Preview Card */}
          <div className="mt-12 w-full max-w-5xl rounded-3xl bg-white border border-slate-200 p-3 sm:p-4 shadow-2xl shadow-indigo-300/30 relative">
            
            {/* Top Bar Fake Window */}
            <div className="flex items-center justify-between pb-3 px-3 border-b border-slate-200/80 text-xs text-slate-500 font-mono">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                <span className="text-slate-500 text-[11px] ml-2">app.almizan.legal / active-matter</span>
              </div>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
                  ● {isRtl ? 'متصل بالشبكة' : 'ONLINE SYNC'}
                </span>
                <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded-md font-bold">
                  AR / EN
                </span>
              </div>
            </div>

            {/* Mock Dashboard Grid */}
            <div className="p-4 sm:p-6 bg-white/90 rounded-2xl grid grid-cols-1 md:grid-cols-3 gap-4 text-left font-sans">
              
              {/* Card 1: Active Matter Card */}
              <div className="p-4 bg-white/90 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs text-indigo-600 font-bold">
                  <span>MATTER #2026-DXB-88</span>
                  <span className="bg-indigo-500/20 text-indigo-700 px-2 py-0.5 rounded text-[10px]">COMMERCIAL</span>
                </div>
                <h4 className="text-sm font-bold text-slate-900">Al-Sharq Real Estate vs. Global Tech Ltd</h4>
                <p className="text-xs text-slate-500">Jurisdiction: Dubai Commercial Court of First Instance</p>
                <div className="pt-2 flex justify-between items-center text-xs border-t border-slate-200">
                  <span className="text-slate-500">Statute Deadline:</span>
                  <span className="text-amber-600 font-bold">18 Days Remaining</span>
                </div>
              </div>

              {/* Card 2: AI Pleading Copilot Stream */}
              <div className="p-4 bg-white/90 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs text-emerald-600 font-bold">
                  <span className="flex items-center gap-1"><Sparkles className="w-3.5 h-3.5" /> AI COPILOT STATUS</span>
                  <span className="bg-emerald-500/20 text-emerald-700 px-2 py-0.5 rounded text-[10px]">READY</span>
                </div>
                <div className="text-xs text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono text-[11px] leading-relaxed">
                  "Generative Motion for Summary Judgment draft prepared with 4 statutory references..."
                </div>
                <div className="flex justify-between text-[11px] text-slate-500">
                  <span>Confidence Rating: 98.4%</span>
                  <span className="text-indigo-600 font-bold">Auto-Filed</span>
                </div>
              </div>

              {/* Card 3: Trust Billing & Expenses */}
              <div className="p-4 bg-white/90 rounded-xl border border-slate-200 space-y-2">
                <div className="flex justify-between items-center text-xs text-amber-600 font-bold">
                  <span>BILLING & RETAINER</span>
                  <span className="bg-amber-500/20 text-amber-600 px-2 py-0.5 rounded text-[10px]">PAID</span>
                </div>
                <div className="text-xl font-black text-slate-900">$24,500.00</div>
                <p className="text-xs text-slate-500">Trust Account Retainer • 14.5 Hours Billed</p>
                <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-amber-400 h-full w-[65%]" />
                </div>
              </div>

            </div>

          </div>

        </div>
      </section>

      {/* 3. Social Proof & Statistics Banner */}
      <section className="py-12 border-y border-slate-200/80 bg-slate-100/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          <div className="space-y-1">
            <div className="text-3xl sm:text-4xl font-black text-indigo-600 font-display">85%</div>
            <p className="text-xs text-slate-500 font-semibold">{isRtl ? 'تقليل وقت صياغة اللوائح' : 'Faster Brief Drafting'}</p>
          </div>
          <div className="space-y-1">
            <div className="text-3xl sm:text-4xl font-black text-amber-600 font-display">100%</div>
            <p className="text-xs text-slate-500 font-semibold">{isRtl ? 'استمرارية العمل أوفلاين في الجلسات' : 'Offline Courtroom Reliability'}</p>
          </div>
          <div className="space-y-1">
            <div className="text-3xl sm:text-4xl font-black text-emerald-600 font-display">3.2x</div>
            <p className="text-xs text-slate-500 font-semibold">{isRtl ? 'مضاعفة ساعات الأتعاب المسجلة' : 'Unbilled Hour Recovery'}</p>
          </div>
          <div className="space-y-1">
            <div className="text-3xl sm:text-4xl font-black text-slate-900 font-display">AR / EN</div>
            <p className="text-xs text-slate-500 font-semibold">{isRtl ? 'دعم مزدوج كامل للغة العربية والإنجليزية' : 'Native Dual Language Support'}</p>
          </div>
        </div>
      </section>

      {/* 4. Who Is It For? (Target Personas) */}
      <section id="who-is-it-for" className="py-20 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
            {isRtl ? 'القطاعات المستهدفة' : 'Tailored For Legal Excellence'}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-4 font-display">
            {isRtl ? 'لمن صُمم الميزان؟' : 'Who Benefits From Al Mizan?'}
          </h2>
          <p className="text-slate-500 text-sm sm:text-base mt-3">
            {isRtl 
              ? 'حلول مخصصة تلبي تطلعات المحامين، مدراء المكاتب، والشركات الكبرى لضمان أقصى كفاءة قضائية.'
              : 'Purpose-built for litigation specialists, firm leaders, corporate counsel, and legal operations.'}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          
          {/* Persona 1: Trial Lawyers */}
          <div className="p-6 bg-white/80 border border-slate-200 rounded-2xl hover:border-indigo-500/50 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Scale className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {isRtl ? 'المحامون والمرافيعون' : 'Litigation Attorneys'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {isRtl 
                  ? 'صياغة المذكرات والدفوع بدقة عالية، تتبع مدد السقوط والتقادم، وإمكانية تصفح القضايا بدون إنترنت أثناء الجلسات.'
                  : 'Instant pleading generation, statutory limitation countdowns, and reliable offline access during court appearances.'}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-200/80 text-[11px] font-semibold text-indigo-600 flex items-center gap-1">
              <span>{isRtl ? 'الميزة الرئيسية: المحرر الذكي' : 'Key Advantage: AI Drafter'}</span>
            </div>
          </div>

          {/* Persona 2: Managing Partners */}
          <div className="p-6 bg-white/80 border border-slate-200 rounded-2xl hover:border-amber-500/50 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Briefcase className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {isRtl ? 'الشركاء ومدراء المكاتب' : 'Managing Partners'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {isRtl 
                  ? 'رؤية شاملة لأداء المكتب، أرباح القضايا، حسابات الأمانات، ومعدل كسب القضايا مع تحليلات مالية دقيقة.'
                  : 'Real-time firm profitability metrics, unbilled hour tracking, trust accounting, and high-level case analytics.'}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-200/80 text-[11px] font-semibold text-amber-600 flex items-center gap-1">
              <span>{isRtl ? 'الميزة الرئيسية: لوحة التحليلات' : 'Key Advantage: Analytics'}</span>
            </div>
          </div>

          {/* Persona 3: In-House Corporate Counsel */}
          <div className="p-6 bg-white/80 border border-slate-200 rounded-2xl hover:border-emerald-500/50 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {isRtl ? 'الإدارات القانونية بالشركات' : 'Corporate In-House Counsel'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {isRtl 
                  ? 'متابعة النزاعات التجارية، إدارة عقود الموردين والمستندات المشفّرة، وضبط ميزانيات الأتعاب الخارجية.'
                  : 'Centralize corporate disputes, manage outside counsel billables, summarize contract risks, and enforce compliance.'}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-200/80 text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
              <span>{isRtl ? 'الميزة الرئيسية: إدارة المخاطر' : 'Key Advantage: Risk Management'}</span>
            </div>
          </div>

          {/* Persona 4: Clients */}
          <div className="p-6 bg-white/80 border border-slate-200 rounded-2xl hover:border-indigo-400/50 transition-all flex flex-col justify-between group">
            <div>
              <div className="w-12 h-12 rounded-xl bg-indigo-400/10 border border-indigo-400/30 text-indigo-700 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-2">
                {isRtl ? 'الموكلون وأصحاب القضايا' : 'Corporate Clients'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {isRtl 
                  ? 'بوابة خاصة لكل موكل لمتابعة مستجدات القضية، الاطلاع على المستندات المصرح بها، وسداد الفواتير بمرونة.'
                  : 'Dedicated transparent client portal for live case status updates, document sharing, and invoice settlement.'}
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-200/80 text-[11px] font-semibold text-indigo-700 flex items-center gap-1">
              <span>{isRtl ? 'الميزة الرئيسية: بوابة الموكل' : 'Key Advantage: Client Portal'}</span>
            </div>
          </div>

        </div>
      </section>

      {/* 5. What Does It Do? (Core Feature Pillars) */}
      <section id="features" className="py-20 px-4 sm:px-8 bg-white/40 border-y border-slate-200/80">
        <div className="max-w-7xl mx-auto">
          
          <div className="text-center max-w-3xl mx-auto mb-12">
            <span className="text-xs font-bold text-amber-600 uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
              {isRtl ? 'القدرات والإمكانيات' : 'What Does It Do?'}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-4 font-display">
              {isRtl ? 'منظومة عمل قانونية شاملة ومتكاملة' : '6 Core Legal Engineering Pillars'}
            </h2>
          </div>

          {/* Interactive Feature Tabs Selector */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-10">
            <button
              onClick={() => setActiveTab('ai')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'ai' 
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/30' 
                  : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Bot className="w-4 h-4" />
              <span>{isRtl ? 'الذكاء الاصطناعي والصياغة' : '1. AI Legal Copilot'}</span>
            </button>

            <button
              onClick={() => setActiveTab('offline')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'offline' 
                  ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/30' 
                  : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <WifiOff className="w-4 h-4" />
              <span>{isRtl ? 'العمل أوفلاين في المحكمة' : '2. Offline IndexedDB'}</span>
            </button>

            <button
              onClick={() => setActiveTab('matters')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'matters' 
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' 
                  : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <FolderKanban className="w-4 h-4" />
              <span>{isRtl ? 'إدارة القضايا والتقادم' : '3. Matter & Statute Management'}</span>
            </button>

            <button
              onClick={() => setActiveTab('billing')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'billing' 
                  ? 'bg-purple-600 text-slate-900 shadow-lg shadow-purple-600/30' 
                  : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <CreditCard className="w-4 h-4" />
              <span>{isRtl ? 'الفواتير وساعات الأتعاب' : '4. Trust Billing'}</span>
            </button>

            <button
              onClick={() => setActiveTab('portal')}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                activeTab === 'portal' 
                  ? 'bg-cyan-600 text-slate-900 shadow-lg shadow-cyan-600/30' 
                  : 'bg-white text-slate-500 hover:text-slate-900 border border-slate-200'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>{isRtl ? 'بوابة الموكلين' : '5. Client Portal'}</span>
            </button>
          </div>

          {/* Active Tab Panel Content */}
          <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-10 shadow-2xl">
            {activeTab === 'ai' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center border border-indigo-500/20">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 font-display">
                    {isRtl ? 'مساعد الصياغة القضائية المتقدم بواسطة AI' : 'Gemini 2.5 Powered Pleading & Motion Drafter'}
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {isRtl 
                      ? 'يقوم الذكاء الاصطناعي بصياغة المذكرات، اللوائح، والإنذارات الرسمية باللغتين العربية والإنجليزية. يعتمد على مراجعة تلقائية للمستندات المرفقة وتحديد الثغرات وتاريخ التقادم.'
                      : 'Generate complete motions, cease and desist notices, contract dispute briefs, and legal summaries grounded in your attached matter documents and evidence files.'}
                  </p>
                  <ul className="space-y-2 text-xs text-slate-700">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      {isRtl ? 'تحليل ثنائي اللغة (عربي / إنجليزي)' : 'Bilingual Context Awareness (Arabic & English)'}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      {isRtl ? 'ربط المستندات بملف القضية مباشرة' : 'Direct Binding to Case File Attachments'}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-emerald-600" />
                      {isRtl ? 'تقييم احتمالية كسب القضية ونسبة المخاطرة' : 'Automated Win Probability & Risk Scoring'}
                    </li>
                  </ul>
                </div>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 font-mono text-xs text-indigo-700 space-y-3 shadow-inner">
                  <div className="text-[10px] text-slate-500 uppercase tracking-widest pb-2 border-b border-slate-200">
                    PROMPT SIMULATION OUTPUT
                  </div>
                  <p className="text-slate-800">
                    "IN THE COMMERCIAL COURT OF FIRST INSTANCE..."
                  </p>
                  <p className="text-slate-500 leading-relaxed text-[11px]">
                    1. Claimant respectfully submits that Defendant failed to deliver construction milestones as contracted under Article 14...
                  </p>
                  <div className="pt-2 flex justify-between text-[10px] text-indigo-600">
                    <span>Generated in 1.2s</span>
                    <span className="text-emerald-600 font-bold">✓ Ready for Court Filing</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'offline' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 flex items-center justify-center border border-amber-500/20">
                    <WifiOff className="w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 font-display">
                    {isRtl ? 'تخزين محلي IndexedDB للعمل في قاعات المحكمة' : 'IndexedDB Local Cache Engine'}
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {isRtl 
                      ? 'لا داعي للقلق بشأن ضعف إشارة الإنترنت في بدروم المحاكم. يقوم الميزان بحفظ أحدث القضايا والمستندات والمهام محلياً على جهازك لتصفحها وتعديلها فوراً.'
                      : 'Never worry about losing connection in court basements or elevators. Al Mizan stores all recent matters, documents, and timelines inside standard browser IndexedDB storage.'}
                  </p>
                  <ul className="space-y-2 text-xs text-slate-700">
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-amber-600" />
                      {isRtl ? 'تزامن تلقائي بمجرد إعادة الاتصال' : 'Automatic Resynchronization On Connection Restore'}
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-amber-600" />
                      {isRtl ? 'عرض وتصفح المستندات المخزنة بدون تأخير' : 'Instant Offline Document Viewing'}
                    </li>
                  </ul>
                </div>
                <div className="p-5 bg-slate-50 rounded-2xl border border-amber-500/20 text-xs space-y-3">
                  <div className="flex justify-between items-center text-amber-600 font-bold">
                    <span>OFFLINE STATUS INDICATOR</span>
                    <span className="bg-amber-500/20 text-amber-600 px-2 py-0.5 rounded text-[10px]">ACTIVE CACHE</span>
                  </div>
                  <div className="space-y-2 text-slate-700 text-[11px]">
                    <div className="flex justify-between p-2 bg-white rounded border border-slate-200">
                      <span>IndexedDB Matters Store:</span>
                      <span className="text-emerald-600 font-bold">Cached (12 Matters)</span>
                    </div>
                    <div className="flex justify-between p-2 bg-white rounded border border-slate-200">
                      <span>IndexedDB Docs Store:</span>
                      <span className="text-emerald-600 font-bold">Cached (48 Docs)</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'matters' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center border border-emerald-500/20">
                    <FolderKanban className="w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 font-display">
                    {isRtl ? 'إدارة ملفات القضايا وحساب مدد التقادم' : 'Comprehensive Matter & Deadline Management'}
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {isRtl 
                      ? 'سجل كامل لكل قضية يتضمن بيانات الخصوم، القاضي، المحكمة المختصة، مستويات المخاطرة، وتنبيهات بمدد السقوط والتقادم القانوني.'
                      : 'Track legal proceedings with rich jurisdiction data, judge details, opposing counsel, statute of limitations countdowns, and risk scoring.'}
                  </p>
                </div>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="flex justify-between items-center text-xs font-bold text-slate-800">
                    <span>Statute of Limitations Countdown</span>
                    <span className="text-rose-600 font-bold">CRITICAL URGENCY</span>
                  </div>
                  <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-700 flex justify-between items-center">
                    <span>Al-Sharq Dispute Claim Expiry</span>
                    <span className="font-extrabold text-sm">18 Days Left</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'billing' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-400 flex items-center justify-center border border-purple-500/20">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 font-display">
                    {isRtl ? 'ساعات الأتعاب وفواتير الأمانات' : 'Precision Legal Billing & Trust Accounting'}
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {isRtl 
                      ? 'سجل ساعات العمل القابلة للفوترة، إصدار فواتير المحاماة الاحترافية، ومتابعة دفوعات الموكلين بسهولة وشفافية.'
                      : 'Record hourly billables, manage client trust retainers, track litigation expenses, and generate client-ready invoices.'}
                  </p>
                </div>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between font-bold text-slate-700">
                    <span>Invoice #INV-2026-004</span>
                    <span className="text-emerald-600">PAID</span>
                  </div>
                  <div className="text-2xl font-black text-slate-900">$12,450.00</div>
                  <p className="text-slate-500">Client: Global Logistics FZ</p>
                </div>
              </div>
            )}

            {activeTab === 'portal' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
                <div className="space-y-4">
                  <div className="w-10 h-10 rounded-xl bg-cyan-500/10 text-cyan-400 flex items-center justify-center border border-cyan-500/20">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 font-display">
                    {isRtl ? 'بوابة تفاعلية آمنة للموكلين' : 'White-Label Encrypted Client Portal'}
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {isRtl 
                      ? 'امنح موكليك تجربة راقية لمتابعة تقدم قضاياهم، مراجعة المستندات المصرح بها، والتواصل مع فريقك القانوني.'
                      : 'Give your clients direct transparent visibility into case milestones, shared document repositories, and billing status without phone calls.'}
                  </p>
                </div>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                  <div className="p-3 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                    <div className="flex justify-between font-bold text-slate-900">
                      <span>Client Portal View</span>
                      <span className="text-cyan-400">Live Status</span>
                    </div>
                    <p className="text-slate-500">Viewing: Dubai Commercial Appeal Proceedings</p>
                  </div>
                </div>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* 6. Live Interactive AI Playground Simulator */}
      <section id="demo" className="py-20 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="bg-gradient-to-br from-indigo-950/80 via-slate-100 to-slate-950 border border-indigo-500/30 rounded-3xl p-6 sm:p-12 relative overflow-hidden shadow-2xl">
          
          <div className="max-w-3xl mb-8">
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/30 px-3 py-1 rounded-full">
              {isRtl ? 'مختبر الصياغة التفاعلي' : 'Interactive AI Drafting Simulator'}
            </span>
            <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-3 font-display">
              {isRtl ? 'جرب قوة الذكاء الاصطناعي القانوني الآن' : 'Test the AI Legal Engine Live'}
            </h2>
            <p className="text-slate-700 text-sm mt-2">
              {isRtl 
                ? 'اختر أحد النماذج الجاهزة أو أدخل طلبك القانوني لمعاينة صياغة اللائحة فوراً.'
                : 'Select a sample legal instruction or enter a custom prompt to test the pleading generator preview.'}
            </p>
          </div>

          {/* Sample Prompts */}
          <div className="flex flex-wrap gap-2 mb-4">
            {samplePrompts.map((sp, idx) => (
              <button
                key={idx}
                onClick={() => {
                  const val = isRtl ? sp.ar : sp.en;
                  setDemoPrompt(val);
                  handleRunSimulation(val);
                }}
                className="text-xs bg-white/90 hover:bg-slate-200 text-slate-700 hover:text-slate-900 border border-slate-300/80 px-3 py-1.5 rounded-xl transition-all cursor-pointer"
              >
                💡 {isRtl ? sp.ar : sp.en}
              </button>
            ))}
          </div>

          {/* Input & Run Button */}
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <input
              type="text"
              value={demoPrompt}
              onChange={(e) => setDemoPrompt(e.target.value)}
              placeholder={isRtl ? 'أدخل تفاصيل الطلب القانوني أو المذكرة...' : 'Enter prompt or case details...'}
              className="flex-grow bg-slate-50 border border-slate-300 text-slate-900 placeholder-slate-500 px-4 py-3 rounded-xl text-xs sm:text-sm focus:outline-none focus:border-indigo-500 transition-colors"
            />
            <button
              onClick={() => handleRunSimulation()}
              disabled={isSimulating}
              className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-500 text-slate-900 font-bold text-xs sm:text-sm rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shrink-0 shadow-lg shadow-indigo-600/30"
            >
              {isSimulating ? (
                <>
                  <Bot className="w-4 h-4 animate-spin text-amber-600" />
                  <span>{isRtl ? 'جاري الصياغة...' : 'Drafting Brief...'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-600" />
                  <span>{isRtl ? 'توليد المذكرة' : 'Generate Pleading Preview'}</span>
                </>
              )}
            </button>
          </div>

          {/* Simulated Output Container */}
          {simulatedOutput && (
            <div className="p-5 bg-white/90 border border-indigo-500/40 rounded-2xl animate-in fade-in space-y-3 font-mono text-xs text-slate-800">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-[10px] font-sans font-bold text-indigo-600">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  {isRtl ? 'نتيجة الصياغة المعتمدة من الميزان AI' : 'Al Mizan Legal AI Draft Generated'}
                </span>
                <span className="text-slate-500">100% Client Security Verified</span>
              </div>
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-slate-700">
                {simulatedOutput}
              </pre>
              <div className="pt-2 border-t border-slate-200 flex justify-between items-center font-sans text-xs">
                <span className="text-slate-500">{isRtl ? 'يرجى مراجعة الصياغة وتحديد المحكمة المختصة.' : 'Ready to import into full matter workspace.'}</span>
                <button
                  onClick={onEnterWorkspace}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg text-xs transition-colors cursor-pointer"
                >
                  {isRtl ? 'فتح في ملف القضية →' : 'Open in Case Workspace →'}
                </button>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* 7. FAQ Accordion Section */}
      <section id="faq" className="py-20 px-4 sm:px-8 max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <span className="text-xs font-bold text-indigo-600 uppercase tracking-widest bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded-full">
            {isRtl ? 'الأسئلة الشائعة' : 'Frequently Asked Questions'}
          </span>
          <h2 className="text-2xl sm:text-4xl font-black text-slate-900 mt-4 font-display">
            {isRtl ? 'كل ما تحتاج معرفته عن المنظومة' : 'Everything You Need To Know'}
          </h2>
        </div>

        <div className="space-y-4">
          {faqs.map((faq, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div
                key={idx}
                className="bg-white border border-slate-200 rounded-2xl overflow-hidden transition-all"
              >
                <button
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between text-sm sm:text-base font-bold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer"
                >
                  <span className="pr-4">{isRtl ? faq.qAr : faq.qEn}</span>
                  <ChevronDown className={`w-5 h-5 text-slate-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
                {isOpen && (
                  <div className="px-6 pb-5 text-xs sm:text-sm text-slate-700 leading-relaxed border-t border-slate-200/80 pt-3">
                    {isRtl ? faq.aAr : faq.aEn}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 8. Strong Closing CTA Banner */}
      <section className="py-12 sm:py-20 px-3 sm:px-8 max-w-6xl mx-auto text-center relative">
        <div className="p-5 sm:p-16 bg-gradient-to-r from-indigo-700 via-indigo-600 to-indigo-800 rounded-3xl border border-indigo-400/30 shadow-2xl shadow-indigo-600/40 relative overflow-hidden">
          
          <div className="relative z-10 max-w-3xl mx-auto space-y-4 sm:space-y-6">
            <h2 className="text-xl sm:text-4xl md:text-5xl font-black text-white font-display tracking-tight leading-snug sm:leading-tight">
              {isRtl 
                ? 'جاهز للارتقاء بأداء مكتبك القانوني إلى آفاق جديدة؟' 
                : 'Ready To Modernize Your Legal Practice?'}
            </h2>
            <p className="text-indigo-100 text-xs sm:text-base md:text-lg font-medium leading-relaxed">
              {isRtl 
                ? 'انضم إلى نخبة المكاتب والشركاء الذين يراكمون النجاحات باستخدام الميزان AI.' 
                : 'Experience autonomous pleading drafting, courtroom offline access, and white-label client portals in one powerful suite.'}
            </p>

            <div className="pt-2 sm:pt-4 flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 w-full">
              <button
                onClick={onEnterWorkspace}
                className="w-full sm:w-auto px-5 sm:px-8 py-3.5 sm:py-4 bg-white hover:bg-slate-100 text-indigo-950 font-black text-sm sm:text-base rounded-2xl shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 transform hover:scale-105 active:scale-95 leading-normal"
              >
                <Scale className="w-5 h-5 text-indigo-600 shrink-0" />
                <span className="text-center">{isRtl ? 'دخول بيئة العمل الذكية الآن' : 'Launch Workspace Environment'}</span>
                <ArrowRight className={`w-4 h-4 shrink-0 ${isRtl ? 'rotate-180' : ''}`} />
              </button>

              <button
                onClick={onEnterClientPortal}
                className="w-full sm:w-auto px-5 sm:px-6 py-3.5 sm:py-4 bg-indigo-950/40 hover:bg-indigo-950/60 text-white font-bold text-sm sm:text-base rounded-2xl border border-white/30 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Users className="w-5 h-5 text-amber-300 shrink-0" />
                <span className="text-center">{isRtl ? 'تجربة بوابة الموكل' : 'Client Portal Demo'}</span>
              </button>
            </div>
          </div>

        </div>
      </section>

      {/* 9. Landing Footer */}
      <footer className="py-8 border-t border-slate-200 text-center text-xs text-slate-500 font-medium">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            { }
            <img src="/logo-header.svg" alt="Al Mizan Legal Practice" className="h-10 w-auto" />
          </div>
          <span>{isRtl ? 'جميع الحقوق محفوظة © ٢٠٢٦ الميزان' : '© 2026 Al Mizan. All Rights Reserved.'}</span>
          <div className="flex gap-4">
            <button onClick={onEnterWorkspace} className="hover:text-slate-700 transition-colors">Workspace</button>
            <button onClick={onEnterClientPortal} className="hover:text-slate-700 transition-colors">Portal</button>
          </div>
        </div>
      </footer>

      {/* 10. Mobile Sticky Bottom Navigation CTA Bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-50/95 backdrop-blur-xl border-t border-slate-200/90 p-2.5 shadow-2xl flex items-center justify-between gap-2">
        <button
          onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')}
          className="px-2.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-200 rounded-xl flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <Globe className="w-3.5 h-3.5 text-indigo-600" />
          <span>{language === 'ar' ? 'English' : 'العربية'}</span>
        </button>

        <button
          onClick={onEnterClientPortal}
          className="px-2.5 py-2 text-xs font-bold text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-1 shrink-0 cursor-pointer"
        >
          <Users className="w-3.5 h-3.5" />
          <span>{isRtl ? 'بوابة الموكل' : 'Portal'}</span>
        </button>

        <button
          onClick={onEnterWorkspace}
          className="flex-1 py-2 px-3 bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-600 text-slate-900 font-black text-xs rounded-xl shadow-lg border border-indigo-400/30 flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer active:scale-95 transition-transform"
        >
          <span>{isRtl ? 'دخول بيئة العمل' : 'Launch Workspace'}</span>
          <ArrowRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
        </button>
      </div>

    </div>
  );
}

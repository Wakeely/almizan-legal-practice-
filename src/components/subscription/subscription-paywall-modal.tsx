'use client';

import React, { useState } from 'react';
import { 
  X, 
  Check, 
  ShieldCheck, 
  Sparkles, 
  CreditCard, 
  Zap, 
  Award, 
  Building2, 
  Users, 
  Scale, 
  Lock, 
  Download, 
  CheckCircle2, 
  HelpCircle,
  FileText
} from 'lucide-react';
import { useAuth, SubscriptionTier } from '@/components/providers/auth-provider';
import { useLanguage } from '@/components/providers/language-provider';

interface SubscriptionPaywallModalProps {
  isOpen: boolean;
  onClose: () => void;
  restrictedFeatureName?: string;
}

export default function SubscriptionPaywallModal({ isOpen, onClose, restrictedFeatureName }: SubscriptionPaywallModalProps) {
  const { isRtl } = useLanguage();
  const { user, upgradeSubscription } = useAuth();

  const [billingCycle, setBillingCycle] = useState<'Monthly' | 'Annual'>('Annual');
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier>('Pro Practice');
  const [isProcessing, setIsProcessing] = useState(false);
  const [checkoutStep, setCheckoutStep] = useState<'plans' | 'checkout' | 'success'>('plans');

  // Checkout Form State
  const [cardHolder, setCardHolder] = useState(user?.name || 'Adv. Legal Counsel');
  const [cardNumber, setCardNumber] = useState('•••• •••• •••• 4242');
  const [expiry, setExpiry] = useState('12/28');
  const [cvv, setCvv] = useState('882');
  const [txInvoiceId, setTxInvoiceId] = useState('');

  if (!isOpen) return null;

  const plans = [
    {
      id: 'Solo Practice' as SubscriptionTier,
      nameEn: 'Solo Practice',
      nameAr: 'المحامي الفردي',
      priceMonthly: 49,
      priceAnnual: 39,
      descriptionEn: 'Essential litigation tools for independent sole practitioners.',
      descriptionAr: 'الأدوات الأساسية لإدارة القضايا والتنظيم اليومي للمحامي المستقل.',
      seatsEn: '1 Counsel Seat',
      seatsAr: 'ترخيص لمستخدم واحد',
      badge: null,
      featuresEn: [
        'Up to 10 Active Matters',
        'Court Rules Calendaring (Jordan, KSA, UAE)',
        'Basic Redaction & Bates Stamping',
        'UTBMS LEDES Billing & Stopwatch',
        'Offline IndexedDB Storage'
      ],
      featuresAr: [
        'إدارة حتى 10 قضايا قائمة',
        'حاسبة المواعيد الإجرائية (الأردن، السعودية، الإمارات)',
        'تظليل المستندات والترقيم المتسلسل (Bates)',
        'مؤقت الأتعاب ومفرز LEDES القياسي',
        'التخزين المحلي دون إنترنت'
      ]
    },
    {
      id: 'Pro Practice' as SubscriptionTier,
      nameEn: 'Pro Practice',
      nameAr: 'المكتب المتقدم (الموصى به)',
      priceMonthly: 149,
      priceAnnual: 119,
      descriptionEn: 'Comprehensive AI suite for growing mid-sized law firms.',
      descriptionAr: 'الحزمة الكاملة بالذكاء الاصطناعي لمكاتب المحاماة المتقدمة.',
      seatsEn: 'Up to 5 Attorney Seats',
      seatsAr: 'حتى 5 تراخيص للمحامين',
      badge: isRtl ? 'الأكثر طلباً ⭐' : 'Most Popular ⭐',
      featuresEn: [
        'Unlimited Matters & Case Files',
        'Advanced Gemini 3.5 Flash Drafting',
        'Multi-Page Redaction & Regex Auto-Scan',
        'UTBMS LEDES 1998B Export & PDF Invoices',
        'Trial War Room & Hearing Binders',
        'Client Portal Dashboard Access',
        'Cross-Case Kanban & Task Locks'
      ],
      featuresAr: [
        'قضايا ومستندات غير محدودة',
        'مساعد الصياغة القضائية المتقدم بالذكاء الاصطناعي',
        'تظليل متعدد الصفحات مع فحص الأرقام التلقائي',
        'تصدير LEDES 1998B وفواتير الحساب التفصيلية',
        'غرفة عمليات المحاكمة وسجل الأدلة',
        'بوابة تفاعلية للموكلين',
        'لوحة المهام المتشابكة مع قفل التبعيات'
      ]
    },
    {
      id: 'Enterprise & Arbitration' as SubscriptionTier,
      nameEn: 'Enterprise & Arbitration',
      nameAr: 'المؤسسات والتحكيم الدولي',
      priceMonthly: 399,
      priceAnnual: 319,
      descriptionEn: 'High-tier platform for top firms, corporate legal & arbitration.',
      descriptionAr: 'المنظومة المتكاملة للمكاتب الكبرى والإدارات القانونية وهيئات التحكيم.',
      seatsEn: 'Unlimited Counsel Seats',
      seatsAr: 'تراخيص غير محدودة للمستشارين',
      badge: isRtl ? 'النظام الشامل' : 'Enterprise Choice',
      featuresEn: [
        'Everything in Pro Practice',
        'Ethics & Conflict of Interest Engine',
        'Verifiable Clearance Certificates (WKL-ETH)',
        'AI Diarization & Speaker Transcript Indexer',
        'Biometric Hardware Passkey Locks',
        'Multi-Jurisdiction Rules (DIFC, ADGM, FRCP)',
        'Dedicated SLA & Custom API Integrations'
      ],
      featuresAr: [
        'كافة خصائص المكتب المتقدم',
        'نظام فحص تعارض المصالح الأخلاقي المعتمد',
        'إصدار شهادات خلو التعارض (WKL-ETH)',
        'مفهرس المحاضر مع تحديد المتحدثين تلقائياً',
        'قفل الملفات بالبصمة البيومترية',
        'قواعد المحاكم الدولية (DIFC, ADGM, FRCP)',
        'دعم فني مخصص وربط مع الأنظمة الخارجية'
      ]
    }
  ];

  const handleSelectPlanToCheckout = (tier: SubscriptionTier) => {
    setSelectedTier(tier);
    setCheckoutStep('checkout');
  };

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);

    const invId = `INV-SUB-${Math.floor(100000 + Math.random() * 900000)}`;
    setTxInvoiceId(invId);

    try {
      await upgradeSubscription(selectedTier, billingCycle);
      setIsProcessing(false);
      setCheckoutStep('success');
    } catch (err) {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 relative flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500 text-slate-950 rounded-2xl shadow-md">
              <Zap className="w-5 h-5 font-bold" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-display tracking-tight text-white flex items-center gap-2">
                <span>{isRtl ? 'خطط الاشتراكات وبوابة الترقية (Subscription Paywall)' : 'Al Mizan Plans & Licensing'}</span>
              </h3>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                {user ? (
                  isRtl
                    ? `خطتك الحالية: ${user.subscriptionTier} (${user.planStatus})`
                    : `Current Plan: ${user.subscriptionTier} (${user.planStatus})`
                ) : (
                  isRtl ? 'اختر الخطة المناسبة لنشاط مكتبك القضائي' : 'Select the optimal legal practice plan for your firm'
                )}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Restricted Feature Alert Banner */}
        {restrictedFeatureName && (
          <div className="bg-amber-500/10 border-b border-amber-500/20 px-6 py-3 text-amber-900 text-xs font-bold flex items-center gap-2">
            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {isRtl
                ? `تتطلب الميزة "${restrictedFeatureName}" ترقية خطتك إلى الحزمة المتقدمة أو حزمة المؤسسات.`
                : `Feature "${restrictedFeatureName}" requires Pro Practice or Enterprise Tier subscription.`}
            </span>
          </div>
        )}

        {/* STEP 1: PLANS OVERVIEW */}
        {checkoutStep === 'plans' && (
          <div className="p-5 sm:p-6 space-y-6">
            {/* Billing Cycle Switcher */}
            <div className="flex justify-center items-center gap-3">
              <span className={`text-xs font-bold ${billingCycle === 'Monthly' ? 'text-slate-900' : 'text-slate-400'}`}>
                {isRtl ? 'اشتراك شهري' : 'Monthly Billing'}
              </span>
              <button
                onClick={() => setBillingCycle(billingCycle === 'Monthly' ? 'Annual' : 'Monthly')}
                className="w-12 h-6 bg-slate-900 rounded-full p-1 relative transition-colors cursor-pointer"
              >
                <div className={`w-4 h-4 bg-amber-400 rounded-full transition-transform ${billingCycle === 'Annual' ? 'translate-x-6 rtl:-translate-x-6' : ''}`} />
              </button>
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-bold ${billingCycle === 'Annual' ? 'text-slate-900' : 'text-slate-400'}`}>
                  {isRtl ? 'اشتراك سنوي' : 'Annual Billing'}
                </span>
                <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-md uppercase">
                  {isRtl ? 'توفير 20%' : 'Save 20%'}
                </span>
              </div>
            </div>

            {/* Plans Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {plans.map(p => {
                const isCurrent = user?.subscriptionTier === p.id;
                const price = billingCycle === 'Annual' ? p.priceAnnual : p.priceMonthly;

                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl p-5 border flex flex-col justify-between transition-all relative ${
                      p.id === 'Pro Practice'
                        ? 'bg-slate-900 text-white border-indigo-500 shadow-xl ring-2 ring-indigo-500/20'
                        : 'bg-slate-50 text-slate-900 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    {p.badge && (
                      <span className="absolute -top-3 right-4 bg-indigo-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-sm">
                        {p.badge}
                      </span>
                    )}

                    <div className="space-y-3">
                      <div>
                        <h4 className="text-base font-bold font-display">{isRtl ? p.nameAr : p.nameEn}</h4>
                        <p className={`text-[11px] mt-1 ${p.id === 'Pro Practice' ? 'text-slate-300' : 'text-slate-500'}`}>
                          {isRtl ? p.descriptionAr : p.descriptionEn}
                        </p>
                      </div>

                      <div className="pt-2 border-t border-slate-200/20">
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-extrabold font-mono">${price}</span>
                          <span className={`text-xs ${p.id === 'Pro Practice' ? 'text-slate-400' : 'text-slate-500'}`}>
                            {isRtl ? '/ شهر' : '/ month'}
                          </span>
                        </div>
                        <span className={`text-[10px] font-medium block mt-0.5 ${p.id === 'Pro Practice' ? 'text-slate-400' : 'text-slate-500'}`}>
                          {isRtl ? p.seatsAr : p.seatsEn}
                        </span>
                      </div>

                      {/* Feature Bullet List */}
                      <ul className="space-y-2 pt-2 text-xs">
                        {(isRtl ? p.featuresAr : p.featuresEn).map((f, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <Check className={`w-3.5 h-3.5 shrink-0 mt-0.5 ${p.id === 'Pro Practice' ? 'text-amber-400' : 'text-indigo-600'}`} />
                            <span className="leading-tight text-[11px]">{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="pt-5 mt-4 border-t border-slate-200/20">
                      {isCurrent ? (
                        <button
                          disabled
                          className="w-full py-2.5 bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-bold text-xs rounded-xl cursor-default flex items-center justify-center gap-1.5"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                          <span>{isRtl ? 'الخطة الحالية المفعّلة' : 'Active Plan'}</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => handleSelectPlanToCheckout(p.id)}
                          className={`w-full py-2.5 font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 ${
                            p.id === 'Pro Practice'
                              ? 'bg-amber-400 hover:bg-amber-500 text-slate-950'
                              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                          }`}
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>{isRtl ? 'ترقية وتفعيل الآن' : 'Upgrade & Activate'}</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 2: CHECKOUT & PAYMENT FORM */}
        {checkoutStep === 'checkout' && (
          <form onSubmit={handleConfirmPayment} className="p-6 space-y-5 animate-in fade-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h4 className="text-sm font-bold text-slate-900 font-display">
                  {isRtl ? `إتمام ترقية الاشتراك: ${selectedTier}` : `Complete Order: ${selectedTier}`}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  {isRtl ? `الدورة الفوترية المختارة: ${billingCycle === 'Annual' ? 'سنوي (توفير 20%)' : 'شهري'}` : `Selected Billing Cycle: ${billingCycle}`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCheckoutStep('plans')}
                className="text-xs font-bold text-indigo-600 hover:underline cursor-pointer"
              >
                {isRtl ? '← تغيير الخطة' : '← Change Plan'}
              </button>
            </div>

            {/* Payment Summary */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs space-y-2">
              <div className="flex justify-between text-slate-600">
                <span>{isRtl ? 'سعر الخطة:' : 'Base Subscription:'}</span>
                <span className="font-mono font-bold">${selectedTier === 'Enterprise & Arbitration' ? (billingCycle === 'Annual' ? 3828 : 399) : (billingCycle === 'Annual' ? 1428 : 149)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>{isRtl ? 'ضريبة المبيعات / القيمة المضافة (0% للمؤسسات القانونية):' : 'VAT / Sales Tax (0% Legal Entity):'}</span>
                <span className="font-mono font-bold">$0.00</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2 text-slate-900 text-sm font-bold">
                <span>{isRtl ? 'الإجمالي المستحق:' : 'Total Amount Due:'}</span>
                <span className="font-mono text-indigo-600">
                  ${selectedTier === 'Enterprise & Arbitration' ? (billingCycle === 'Annual' ? 3828 : 399) : (billingCycle === 'Annual' ? 1428 : 149)}
                </span>
              </div>
            </div>

            {/* Credit Card Input Details */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">{isRtl ? 'اسم صاحب البطاقة / الشركة:' : 'Cardholder Name:'}</label>
                <input
                  type="text"
                  value={cardHolder}
                  onChange={e => setCardHolder(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">{isRtl ? 'رقم البطاقة الائتمانية:' : 'Credit / Debit Card Number:'}</label>
                <div className="relative">
                  <CreditCard className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3" />
                  <input
                    type="text"
                    value={cardNumber}
                    onChange={e => setCardNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isRtl ? 'تاريخ الانتهاء:' : 'Expiry Date:'}</label>
                  <input
                    type="text"
                    value={expiry}
                    onChange={e => setExpiry(e.target.value)}
                    placeholder="MM/YY"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">{isRtl ? 'رمز الأمان (CVV):' : 'Security Code (CVV):'}</label>
                  <input
                    type="password"
                    value={cvv}
                    onChange={e => setCvv(e.target.value)}
                    placeholder="882"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-xs font-bold rounded-2xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              {isProcessing ? (
                <>
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>{isRtl ? 'جاري معالجة الدفع وإصدار الفاتورة...' : 'Processing Payment & Issuing Tax Receipt...'}</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>{isRtl ? 'تأكيد الدفع وتفعيل الاشتراك الآن' : 'Confirm Payment & Activate Tier'}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* STEP 3: SUCCESS CONFIRMATION & RECEIPT */}
        {checkoutStep === 'success' && (
          <div className="p-6 text-center space-y-4 animate-in zoom-in-95 duration-300">
            <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <div>
              <h4 className="text-xl font-bold font-display text-slate-900">
                {isRtl ? 'تم تفعيل ترقية الاشتراك بنجاح!' : 'Plan Upgraded Successfully!'}
              </h4>
              <p className="text-xs text-slate-500 mt-1">
                {isRtl
                  ? `أصبح حسابك الآن مفعلاً على خطة ${selectedTier}. يمكنك استخدام كافة الأدوات فوراً.`
                  : `Your practice account is now active under the ${selectedTier} tier. All features are fully unlocked.`}
              </p>
            </div>

            {/* Receipt Summary Card */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs font-mono text-slate-700 max-w-md mx-auto text-left rtl:text-right rtl:text-left space-y-2">
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-400">{isRtl ? 'رقم الفاتورة الضريبية:' : 'Tax Invoice Ref:'}</span>
                <span className="font-bold text-slate-900">{txInvoiceId}</span>
              </div>
              <div className="flex justify-between border-b border-slate-200 pb-2">
                <span className="text-slate-400">{isRtl ? 'الخطة المفعّلة:' : 'Active Tier:'}</span>
                <span className="text-indigo-600 font-bold">{selectedTier}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">{isRtl ? 'تاريخ التجديد:' : 'Renewal Date:'}</span>
                <span>{user?.renewalDate}</span>
              </div>
            </div>

            <div className="pt-3">
              <button
                onClick={onClose}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-all shadow-md cursor-pointer"
              >
                {isRtl ? 'العودة لممنظومة الميزان' : 'Return to Practice Workspace'}
              </button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-100 p-4 text-center">
          <p className="text-[11px] text-slate-400">
            {isRtl
              ? 'الاشتراكات مغطاة بضمان الاسترداد الكامل خلال 14 يوماً مع إلغاء مرن في أي وقت.'
              : 'Subscriptions include a 14-day refund guarantee with seamless cancelation.'}
          </p>
        </div>

      </div>
    </div>
  );
}

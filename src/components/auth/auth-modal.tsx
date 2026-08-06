'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  X,
  Lock,
  Mail,
  User,
  Building2,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Key,
  AlertCircle,
  Eye,
  EyeOff,
  Award,
  Scale,
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useLanguage } from '@/components/providers/language-provider';
import { cn } from '@/lib/utils';
import { JURISDICTION_LIST } from '@/lib/jurisdictions';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup' | 'forgot';
  onSuccess?: () => void;
}

type AuthMode = 'signin' | 'signup' | 'forgot' | 'reset-code';
type SignupStep = 1 | 2 | 3;

const inputBase =
  'w-full rounded-lg border border-input bg-background px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20';

const inputWithLeadingIcon = cn(
  inputBase,
  'ltr:pl-9 rtl:pr-9',
);

const inputWithBothIcons = cn(
  inputBase,
  'ltr:pl-9 ltr:pr-10 rtl:pr-9 rtl:pl-10',
);

const labelCls = 'mb-1.5 block text-xs font-semibold text-foreground';

const btnPrimary =
  'flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground cursor-pointer';

const btnGhost =
  'flex items-center justify-center gap-2 rounded-lg bg-transparent px-4 py-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer';

function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
    />
  );
}

function LeadingIcon({ icon: Icon }: { icon: React.ElementType }) {
  return (
    <Icon className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground ltr:left-3 rtl:right-3" />
  );
}

function StepProgress({
  current,
  isRtl,
}: {
  current: SignupStep;
  isRtl: boolean;
}) {
  const steps: { n: number; ar: string; en: string }[] = [
    { n: 1, ar: 'البريد', en: 'Email' },
    { n: 2, ar: 'الهوية', en: 'Identity' },
    { n: 3, ar: 'التفاصيل', en: 'Details' },
  ];

  return (
    <div className="flex items-center justify-center gap-1.5 py-1">
      {steps.map(({ n, ar, en }, i) => (
        <React.Fragment key={n}>
          {i > 0 && (
            <div
              className={cn(
                'h-px w-5',
                n <= current ? 'bg-primary' : 'bg-border',
              )}
            />
          )}
          <div className="flex items-center gap-1.5">
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold transition-all',
                n < current
                  ? 'bg-primary text-primary-foreground'
                  : n === current
                    ? 'bg-primary text-primary-foreground ring-2 ring-primary/25'
                    : 'bg-muted text-muted-foreground',
              )}
            >
              {n < current ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                n
              )}
            </div>
            <span
              className={cn(
                'hidden text-[11px] font-medium sm:inline',
                n === current ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {isRtl ? ar : en}
            </span>
          </div>
        </React.Fragment>
      ))}
    </div>
  );
}

function Alert({
  type,
  children,
}: {
  type: 'error' | 'success';
  children: React.ReactNode;
}) {
  const Icon = type === 'error' ? AlertCircle : CheckCircle2;
  return (
    <div
      className={cn(
        'animate-in fade-in flex items-center gap-2 rounded-lg border p-3 text-xs',
        type === 'error'
          ? 'border-destructive/20 bg-destructive/10 text-destructive'
          : 'border-primary/20 bg-primary/10 text-primary',
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}

export default function AuthModal({
  isOpen,
  onClose,
  initialMode = 'signin',
  onSuccess,
}: AuthModalProps) {
  const { isRtl } = useLanguage();
  const { login, signup, resetPassword } = useAuth();

  // ── mode & ui state ──
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // ── sign-in fields ──
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // ── sign-up fields ──
  const [fullName, setFullName] = useState('');
  const [firmName, setFirmName] = useState('');
  const [barId, setBarId] = useState('');
  const [jurisdiction, setJurisdiction] = useState('JO');
  const [accountType, setAccountType] = useState<
    'Law Firm' | 'Solo Practitioner' | 'Corporate Counsel' | 'Client'
  >('Law Firm');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [promoCode, setPromoCode] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(true);
  const [signupStep, setSignupStep] = useState<SignupStep>(1);

  // ── forgot / reset fields ──
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  // ── ref for body scroll-lock ──
  const dialogRef = useRef<HTMLDivElement>(null);

  // sync mode when prop changes externally
  useEffect(() => {
    if (isOpen) {
      setMode(initialMode);
      clearMessages();
      setSignupStep(1);
    }
  }, [isOpen, initialMode]);

  // lock body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // focus trap: focus the dialog when it opens
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus();
    }
  }, [isOpen, mode, signupStep]);

  // ── helpers ──
  const clearMessages = useCallback(() => {
    setError(null);
    setSuccessMsg(null);
  }, []);

  const switchMode = useCallback(
    (m: AuthMode) => {
      setMode(m);
      clearMessages();
      setShowPassword(false);
      if (m === 'signup') setSignupStep(1);
    },
    [clearMessages],
  );

  // ─────────────────────────────────────────────────────────────────────
  // Handlers
  // ─────────────────────────────────────────────────────────────────────

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError(
        isRtl
          ? 'يرجى إدخال البريد الإلكتروني وكلمة المرور'
          : 'Please enter email and password',
      );
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      setSuccessMsg(isRtl ? 'تم تسجيل الدخول بنجاح!' : 'Signed in successfully!');
      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 500);
    } catch {
      setError(
        isRtl
          ? 'فشل تسجيل الدخول. يرجى التحقق من القيد والرمز.'
          : 'Sign in failed. Check credentials.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !signupEmail.trim() || !signupPassword) {
      setError(
        isRtl
          ? 'يرجى ملء جميع الحقول الإلزامية'
          : 'Please complete all required fields',
      );
      return;
    }
    if (!agreedTerms) {
      setError(
        isRtl
          ? 'يجب الموافقة على الشروط وأحكام السرية المعتمدة'
          : 'You must accept the Legal Practice Terms & Privacy Policy',
      );
      return;
    }
    setLoading(true);
    try {
      await signup(
        {
          name: fullName,
          email: signupEmail,
          firmName:
            firmName ||
            (isRtl ? 'مكتب محاماة مستقل' : 'Independent Law Chambers'),
          barAssociationId: barId || 'BAR-2026-PENDING',
          jurisdiction,
          accountType,
          studentCode: promoCode.trim() || undefined,
        },
        signupPassword,
      );
      setSuccessMsg(
        isRtl
          ? 'تم إنشاء حسابك التجريبي بنجاح! جاري توجيهك...'
          : 'Account created successfully! Redirecting...',
      );
      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 600);
    } catch {
      setError(
        isRtl ? 'تعذر إنشاء الحساب حالياً.' : 'Failed to create account.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!forgotEmail.trim()) {
      setError(
        isRtl
          ? 'أدخل البريد الإلكتروني المسجل'
          : 'Enter registered work email',
      );
      return;
    }
    setLoading(true);
    try {
      await resetPassword(forgotEmail);
      setMode('reset-code');
      setSuccessMsg(
        isRtl
          ? 'تم إرسال رمز التحقيق إلى بريدك الإلكتروني'
          : 'Verification code dispatched to your email',
      );
    } catch {
      setError(
        isRtl ? 'حدث خطأ أثناء إرسال الرمز' : 'Failed to send reset code',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!resetCode.trim() || !newPassword) {
      setError(
        isRtl
          ? 'يرجى إدخال رمز التحقيق وكلمة المرور الجديدة'
          : 'Enter verification code and new password',
      );
      return;
    }
    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setMode('signin');
      setEmail(forgotEmail);
      setPassword(newPassword);
      setSuccessMsg(
        isRtl
          ? 'تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول.'
          : 'Password updated successfully! You may sign in.',
      );
    }, 600);
  };

  // ── signup step navigation ──
  const goSignupStep2 = () => {
    if (!signupEmail.trim() || !signupPassword) {
      setError(
        isRtl
          ? 'يرجى إدخال البريد الإلكتروني وكلمة المرور'
          : 'Please enter email and password',
      );
      return;
    }
    clearMessages();
    setSignupStep(2);
  };

  const goSignupStep3 = () => {
    if (!fullName.trim()) {
      setError(
        isRtl ? 'يرجى إدخال الاسم الكامل' : 'Please enter your full legal name',
      );
      return;
    }
    clearMessages();
    setSignupStep(3);
  };

  // ─────────────────────────────────────────────────────────────────────
  // Render — early exit when closed
  // ─────────────────────────────────────────────────────────────────────
  if (!isOpen) return null;

  // mode-specific header config
  const headerConfig: Record<
    AuthMode,
    { ar: string; en: string; icon: React.ElementType }
  > = {
    signin: {
      ar: 'تسجيل الدخول',
      en: 'Sign In',
      icon: Lock,
    },
    signup: {
      ar: 'إنشاء حساب جديد',
      en: 'Create Account',
      icon: User,
    },
    forgot: {
      ar: 'استعادة كلمة المرور',
      en: 'Recover Password',
      icon: Key,
    },
    'reset-code': {
      ar: 'إعادة تعيين كلمة المرور',
      en: 'Reset Password',
      icon: Key,
    },
  };

  const { ar: headerAr, en: headerEn, icon: HeaderIcon } = headerConfig[mode];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Card — full-width on mobile, max-w-md on desktop */}
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={isRtl ? headerAr : headerEn}
        className={cn(
          'flex max-h-[100dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-card shadow-2xl border border-border',
          'sm:max-h-[90vh] sm:max-w-md sm:rounded-xl',
          'animate-in zoom-in-95 duration-200 slide-in-from-bottom-4 sm:slide-in-from-bottom-0',
        )}
      >
        {/* ── Header ── */}
        <div className="relative flex items-center gap-3 border-b border-border px-5 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HeaderIcon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-sm font-bold text-foreground leading-tight">
              {isRtl ? headerAr : headerEn}
            </h2>
            {mode === 'signin' && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {isRtl
                  ? 'الميزان — بوابة الممارسة القانونية'
                  : 'Al Mizan — Legal Practice Portal'}
              </p>
            )}
            {mode === 'signup' && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {isRtl
                  ? `الخطوة ${signupStep} من 3`
                  : `Step ${signupStep} of 3`}
              </p>
            )}
            {mode === 'forgot' && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {isRtl
                  ? 'سنرسل رمز إعادة التعيين إلى بريدك'
                  : "We'll send a reset code to your email"}
              </p>
            )}
            {(mode === 'reset-code') && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {isRtl
                  ? 'أدخل الرمز المرسل واختر كلمة مرور جديدة'
                  : 'Enter the code and choose a new password'}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground cursor-pointer"
            aria-label={isRtl ? 'إغلاق' : 'Close'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-4 p-5">
            {/* Alerts */}
            {error && <Alert type="error">{error}</Alert>}
            {successMsg && <Alert type="success">{successMsg}</Alert>}

            {/* ═══════════════════════════════════════════════════════════
                SIGN IN
            ═══════════════════════════════════════════════════════════ */}
            {mode === 'signin' && (
              <form onSubmit={handleSignIn} className="space-y-4">
                {/* Email */}
                <div>
                  <label className={labelCls}>
                    {isRtl ? 'البريد الإلكتروني المهني' : 'Professional Email'}
                  </label>
                  <div className="relative">
                    <LeadingIcon icon={Mail} />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="advocate@almizan.law"
                      className={inputWithLeadingIcon}
                      autoComplete="email"
                      required
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className={labelCls}>
                    {isRtl ? 'كلمة المرور' : 'Password'}
                  </label>
                  <div className="relative">
                    <LeadingIcon icon={Lock} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className={inputWithBothIcons}
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer ltr:right-3 rtl:left-3"
                      tabIndex={-1}
                      aria-label={
                        showPassword
                          ? isRtl
                            ? 'إخفاء كلمة المرور'
                            : 'Hide password'
                          : isRtl
                            ? 'إظهار كلمة المرور'
                            : 'Show password'
                      }
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                {/* Remember + Forgot link */}
                <div className="flex items-center justify-between text-xs">
                  <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="rounded border-border text-primary focus:ring-primary/20"
                    />
                    <span>{isRtl ? 'تذكرني' : 'Remember me'}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => switchMode('forgot')}
                    className="font-semibold text-primary hover:text-primary/80 hover:underline cursor-pointer"
                  >
                    {isRtl ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                  </button>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={loading}
                  className={btnPrimary}
                >
                  {loading ? (
                    <>
                      <Spinner className="border-primary-foreground/30 border-t-primary-foreground" />
                      <span>{isRtl ? 'جاري التحقق...' : 'Authenticating...'}</span>
                    </>
                  ) : (
                    <>
                      <Lock className="h-4 w-4" />
                      <span>{isRtl ? 'دخول آمن' : 'Secure Sign In'}</span>
                    </>
                  )}
                </button>

                {/* Bottom link to signup */}
                <div className="flex items-center justify-center gap-1 pt-1 text-xs text-muted-foreground">
                  <span>
                    {isRtl ? 'ليس لديك حساب؟' : "Don't have an account?"}
                  </span>
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="font-semibold text-primary hover:text-primary/80 hover:underline cursor-pointer"
                  >
                    {isRtl ? 'إنشاء حساب' : 'Sign Up'}
                  </button>
                </div>

                {/* Trust badge */}
                <div className="flex items-center justify-center gap-1.5 pt-2 text-[11px] text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>256-Bit SSL Encryption</span>
                </div>
              </form>
            )}

            {/* ═══════════════════════════════════════════════════════════
                SIGN UP — multi-step wizard
            ═══════════════════════════════════════════════════════════ */}
            {mode === 'signup' && (
              <form onSubmit={handleSignUp} className="space-y-4">
                <StepProgress current={signupStep} isRtl={isRtl} />

                {/* Step 1: Email + Password */}
                {signupStep === 1 && (
                  <div className="space-y-3 animate-in fade-in duration-200">
                    <p className="text-xs text-muted-foreground">
                      {isRtl
                        ? 'ابدأ ببريدك الإلكتروني المهني وكلمة مرور قوية.'
                        : 'Start with your professional email and a strong password.'}
                    </p>

                    <div>
                      <label className={labelCls}>
                        {isRtl ? 'البريد الإلكتروني المعتمد للمكتب' : 'Official Work Email'}
                      </label>
                      <div className="relative">
                        <LeadingIcon icon={Mail} />
                        <input
                          type="email"
                          value={signupEmail}
                          onChange={(e) => setSignupEmail(e.target.value)}
                          placeholder="counsel@firm.law"
                          className={inputWithLeadingIcon}
                          autoComplete="email"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>
                        {isRtl ? 'تعيين كلمة المرور' : 'Set Password'}
                      </label>
                      <div className="relative">
                        <LeadingIcon icon={Lock} />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={signupPassword}
                          onChange={(e) => setSignupPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className={inputWithBothIcons}
                          autoComplete="new-password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer ltr:right-3 rtl:left-3"
                          tabIndex={-1}
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={goSignupStep2}
                      className={btnPrimary}
                    >
                      <span>{isRtl ? 'متابعة' : 'Continue'}</span>
                      <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                    </button>

                    {/* Back to sign-in */}
                    <div className="flex items-center justify-center gap-1 pt-1 text-xs text-muted-foreground">
                      <span>
                        {isRtl ? 'لديك حساب بالفعل؟' : 'Already have an account?'}
                      </span>
                      <button
                        type="button"
                        onClick={() => switchMode('signin')}
                        className="font-semibold text-primary hover:text-primary/80 hover:underline cursor-pointer"
                      >
                        {isRtl ? 'تسجيل الدخول' : 'Sign In'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 2: Name + Firm */}
                {signupStep === 2 && (
                  <div className="space-y-3 animate-in fade-in duration-200">
                    <p className="text-xs text-muted-foreground">
                      {isRtl
                        ? 'أخبرنا عن هويتك القانونية ومكتبك.'
                        : 'Tell us about your legal identity and firm.'}
                    </p>

                    <div>
                      <label className={labelCls}>
                        {isRtl ? 'الاسم الكامل بالصفة القضائية' : 'Full Legal Name'}
                      </label>
                      <div className="relative">
                        <LeadingIcon icon={User} />
                        <input
                          type="text"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Adv. Ahmad Al-Khatib"
                          className={inputWithLeadingIcon}
                          autoComplete="name"
                          required
                          autoFocus
                        />
                      </div>
                    </div>

                    <div>
                      <label className={labelCls}>
                        {isRtl ? 'اسم المكتب / الشركة' : 'Firm / Chamber Name'}
                      </label>
                      <div className="relative">
                        <LeadingIcon icon={Building2} />
                        <input
                          type="text"
                          value={firmName}
                          onChange={(e) => setFirmName(e.target.value)}
                          placeholder="Al-Khatib Legal Associates"
                          className={inputWithLeadingIcon}
                          autoComplete="organization"
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          clearMessages();
                          setSignupStep(1);
                        }}
                        className={cn(btnGhost, 'flex-1')}
                      >
                        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                        <span>{isRtl ? 'رجوع' : 'Back'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={goSignupStep3}
                        className={cn(btnPrimary, 'flex-[2]')}
                      >
                        <span>{isRtl ? 'متابعة' : 'Continue'}</span>
                        <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Step 3: Jurisdiction + Bar ID + Account Type + Terms */}
                {signupStep === 3 && (
                  <div className="space-y-3 animate-in fade-in duration-200">
                    <p className="text-xs text-muted-foreground">
                      {isRtl
                        ? 'الخطوة الأخيرة — يمكنك ترك الحقول الاختيارية والبدء بالقيم الافتراضية.'
                        : 'Final step — leave optional fields blank to use smart defaults.'}
                    </p>

                    {/* Account type selector */}
                    <div>
                      <label className={labelCls}>
                        {isRtl ? 'نوع الحساب' : 'Account Type'}
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            ['Law Firm', isRtl ? 'مكتب محاماة' : 'Law Firm'],
                            ['Solo Practitioner', isRtl ? 'محامي فردي' : 'Solo Advocate'],
                            ['Corporate Counsel', isRtl ? 'مستشار مؤسسي' : 'Corporate Counsel'],
                            ['Client', isRtl ? 'عميل' : 'Client'],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setAccountType(value as typeof accountType)}
                            className={cn(
                              'cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold transition-all',
                              accountType === value
                                ? 'border-primary/30 bg-primary/10 text-primary'
                                : 'border-border bg-card text-muted-foreground hover:bg-muted',
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Jurisdiction + Bar ID row */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div>
                        <label className={labelCls}>
                          {isRtl ? 'النطاق القضائي' : 'Jurisdiction'}
                        </label>
                        <select
                          value={jurisdiction}
                          onChange={(e) => setJurisdiction(e.target.value)}
                          className={cn(inputBase, 'appearance-none')}
                        >
                          {JURISDICTION_LIST.map((info) => (
                            <option key={info.code} value={info.code}>
                              {isRtl ? info.labelAr : info.labelEn}
                              {' — '}
                              {isRtl ? info.labelEn : info.labelAr}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className={labelCls}>
                          {isRtl ? 'رقم القيد / الترخيص' : 'Bar License / Reg ID'}
                        </label>
                        <input
                          type="text"
                          value={barId}
                          onChange={(e) => setBarId(e.target.value)}
                          placeholder="JBA-2026-881"
                          className={inputBase}
                        />
                      </div>
                    </div>

                    {/* Promo / student code (optional) */}
                    <div>
                      <label className={labelCls}>
                        {isRtl ? 'رمز الطالب (اختياري)' : 'Student / Promo Code (optional)'}
                      </label>
                      <div className="relative">
                        <LeadingIcon icon={Key} />
                        <input
                          type="text"
                          value={promoCode}
                          onChange={(e) => setPromoCode(e.target.value)}
                          placeholder="STUDENT-ABCD-1234"
                          className={inputWithLeadingIcon}
                          autoComplete="off"
                          spellCheck={false}
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {isRtl
                          ? 'سيتم تطبيق حدود الاستخدام المجاني تلقائياً. الترقية إلى خطة مدفوعة ترفع الحدود.'
                          : 'Free limited-access codes from your instructor. Redeem to start — upgrade anytime to lift limits.'}
                      </p>
                    </div>

                    {/* Terms checkbox */}
                    <label className="flex cursor-pointer items-start gap-2 pt-1 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={agreedTerms}
                        onChange={(e) => setAgreedTerms(e.target.checked)}
                        className="mt-0.5 rounded border-border text-primary focus:ring-primary/20"
                      />
                      <span>
                        {isRtl
                          ? 'أوافق على الشروط وسياسة السرية المعتمدة وقواعد حماية البيانات.'
                          : 'I agree to the Terms of Service, Confidentiality Charter & Data Protection Protocol.'}
                      </span>
                    </label>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          clearMessages();
                          setSignupStep(2);
                        }}
                        className={cn(btnGhost, 'flex-1')}
                      >
                        <ArrowLeft className="h-4 w-4 rtl:rotate-180" />
                        <span>{isRtl ? 'رجوع' : 'Back'}</span>
                      </button>
                      <button
                        type="submit"
                        disabled={loading}
                        className={cn(btnPrimary, 'flex-[2]')}
                      >
                        {loading ? (
                          <>
                            <Spinner className="border-primary-foreground/30 border-t-primary-foreground" />
                            <span>
                              {isRtl
                                ? 'جاري إنشاء الحساب...'
                                : 'Setting Up Practice...'}
                            </span>
                          </>
                        ) : (
                          <>
                            <Award className="h-4 w-4" />
                            <span>
                              {isRtl
                                ? 'بدء التجربة المجانية (14 يوماً)'
                                : 'Start 14-Day Free Trial'}
                            </span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </form>
            )}

            {/* ═══════════════════════════════════════════════════════════
                FORGOT PASSWORD
            ═══════════════════════════════════════════════════════════ */}
            {mode === 'forgot' && (
              <form onSubmit={handleSendResetCode} className="space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Mail className="h-6 w-6" />
                </div>

                <p className="text-center text-xs leading-relaxed text-muted-foreground">
                  {isRtl
                    ? 'أدخل بريدك الإلكتروني المسجل وسنرسل لك رمز إعادة تعيين كلمة المرور.'
                    : 'Enter your registered work email and we\'ll send you a password reset code.'}
                </p>

                <div>
                  <label className={labelCls}>
                    {isRtl ? 'البريد الإلكتروني' : 'Work Email'}
                  </label>
                  <div className="relative">
                    <LeadingIcon icon={Mail} />
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="counsel@firm.law"
                      className={inputWithLeadingIcon}
                      autoComplete="email"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={btnPrimary}
                >
                  {loading ? (
                    <Spinner className="border-primary-foreground/30 border-t-primary-foreground" />
                  ) : (
                    <>
                      <Key className="h-4 w-4" />
                      <span>{isRtl ? 'إرسال الرمز' : 'Send Reset Code'}</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => switchMode('signin')}
                  className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {isRtl ? '← العودة لتسجيل الدخول' : '← Back to Sign In'}
                </button>
              </form>
            )}

            {/* ═══════════════════════════════════════════════════════════
                RESET CODE CONFIRMATION
            ═══════════════════════════════════════════════════════════ */}
            {mode === 'reset-code' && (
              <form onSubmit={handleConfirmReset} className="space-y-4">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Scale className="h-6 w-6" />
                </div>

                <p className="text-center text-xs text-muted-foreground">
                  {isRtl
                    ? 'أدخل رمز التحقيق المكون من 6 أرقام واختر كلمة مرور جديدة.'
                    : 'Enter the 6-digit verification code and choose a new password.'}
                </p>

                <div>
                  <label className={labelCls}>
                    {isRtl ? 'رمز التحقيق' : 'Verification Code'}
                  </label>
                  <input
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="849201"
                    className={cn(
                      inputBase,
                      'text-center font-mono text-sm font-bold tracking-widest',
                    )}
                    required
                    autoFocus
                  />
                </div>

                <div>
                  <label className={labelCls}>
                    {isRtl ? 'كلمة المرور الجديدة' : 'New Password'}
                  </label>
                  <div className="relative">
                    <LeadingIcon icon={Lock} />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className={inputWithBothIcons}
                      autoComplete="new-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer ltr:right-3 rtl:left-3"
                      tabIndex={-1}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className={btnPrimary}
                >
                  {loading ? (
                    <Spinner className="border-primary-foreground/30 border-t-primary-foreground" />
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>
                        {isRtl
                          ? 'تأكيد كلمة المرور الجديدة'
                          : 'Confirm New Password'}
                      </span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="w-full text-center text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {isRtl ? '← إعادة إرسال الرمز' : '← Resend Code'}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="border-t border-border bg-muted/50 px-5 py-3 text-center">
          <p className="flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground">
            <Scale className="h-3.5 w-3.5 shrink-0" />
            <span>
              {isRtl
                ? 'الميزان — تشفير سيادي ومعايير سرية قضائية'
                : 'Al Mizan — Sovereign Encryption & Court-Grade Privacy'}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}

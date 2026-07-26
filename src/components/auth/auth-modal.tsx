'use client';

import React, { useState } from 'react';
import { 
  X, 
  Lock, 
  Mail, 
  User, 
  Building2, 
  ShieldCheck, 
  Fingerprint, 
  ArrowRight, 
  CheckCircle2, 
  Key, 
  Briefcase, 
  Sparkles, 
  Globe, 
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  Award
} from 'lucide-react';
import { useAuth } from '@/components/providers/auth-provider';
import { useLanguage } from '@/components/providers/language-provider';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup' | 'forgot';
  onSuccess?: () => void;
}

export default function AuthModal({ isOpen, onClose, initialMode = 'signin', onSuccess }: AuthModalProps) {
  const { isRtl } = useLanguage();
  const { login, signup, resetPassword } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup' | 'forgot' | 'reset-code'>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sign In Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);

  // Sign Up Form State
  const [fullName, setFullName] = useState('');
  const [firmName, setFirmName] = useState('');
  const [barId, setBarId] = useState('');
  const [jurisdiction, setJurisdiction] = useState('Jordan & DIFC Courts');
  const [accountType, setAccountType] = useState<'Law Firm' | 'Solo Practitioner' | 'Corporate Counsel' | 'Client'>('Law Firm');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [agreedTerms, setAgreedTerms] = useState(true);

  // Forgot Password State
  const [forgotEmail, setForgotEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');

  if (!isOpen) return null;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError(isRtl ? 'يرجى إدخال البريد الإلكتروني وكلمة المرور' : 'Please enter email and password');
      return;
    }

    setLoading(true);
    try {
      await login(email, password);
      setSuccessMsg(isRtl ? 'تم تسجيل الدخول بنجاح!' : 'Signed in successfully!');
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 500);
    } catch (err) {
      setError(isRtl ? 'فشل تسجيل الدخول. يرجى التحقق من القيد والرمز.' : 'Sign in failed. Check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!fullName.trim() || !signupEmail.trim() || !signupPassword) {
      setError(isRtl ? 'يرجى ملء جميع الحقول الإلزامية' : 'Please complete all required fields');
      return;
    }

    if (!agreedTerms) {
      setError(isRtl ? 'يجب الموافقة على الشروط وأحكام السرية المعتمدة' : 'You must accept the Legal Practice Terms & Privacy Policy');
      return;
    }

    setLoading(true);
    try {
      await signup({
        name: fullName,
        email: signupEmail,
        firmName: firmName || (isRtl ? 'مكتب محاماة مستقل' : 'Independent Law Chambers'),
        barAssociationId: barId || 'BAR-2026-PENDING',
        jurisdiction,
        accountType
      }, signupPassword);

      setSuccessMsg(isRtl ? 'تم إنشاء حسابك التجريبي بنجاح! جاري توجيهك...' : 'Account created successfully! Redirecting...');
      setTimeout(() => {
        onClose();
        if (onSuccess) onSuccess();
      }, 600);
    } catch (err) {
      setError(isRtl ? 'تعذر إنشاء الحساب حالياً.' : 'Failed to create account.');
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!forgotEmail.trim()) {
      setError(isRtl ? 'أدخل البريد الإلكتروني المسجل' : 'Enter registered work email');
      return;
    }

    setLoading(true);
    try {
      await resetPassword(forgotEmail);
      setMode('reset-code');
      setSuccessMsg(isRtl ? 'تم إرسال رمز التحقيق إلى بريدك الإلكتروني' : 'Verification code dispatched to your email');
    } catch (err) {
      setError(isRtl ? 'حدث خطأ أثناء إرسال الرمز' : 'Failed to send reset code');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!resetCode.trim() || !newPassword) {
      setError(isRtl ? 'يرجى إدخال رمز التحقيق وكلمة المرور الجديدة' : 'Enter verification code and new password');
      return;
    }

    setLoading(true);
    setTimeout(() => {
      setLoading(false);
      setMode('signin');
      setEmail(forgotEmail);
      setPassword(newPassword);
      setSuccessMsg(isRtl ? 'تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول.' : 'Password updated successfully! You may sign in.');
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200 my-auto">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 relative flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-tr from-amber-500 to-amber-600 text-slate-950 rounded-2xl shadow-md">
              <Lock className="w-5 h-5 font-bold" />
            </div>
            <div>
              <h3 className="text-lg font-bold font-display tracking-tight text-white flex items-center gap-2">
                <span>{isRtl ? 'الميزان — بوابة الممارسة' : 'Al Mizan — Practice Portal'}</span>
              </h3>
              <p className="text-xs text-slate-400 font-sans mt-0.5">
                {mode === 'signin' && (isRtl ? 'تسجيل الدخول المشفّر بأعلى معايير السرية' : 'Encrypted Legal Practice Authentication')}
                {mode === 'signup' && (isRtl ? 'إنشاء حساب جديد للمكاتب والإدارات القانونية' : 'Create Firm or Legal Department Account')}
                {(mode === 'forgot' || mode === 'reset-code') && (isRtl ? 'استعادة كلمة المرور والتأمين الشامل' : 'Secure Account Recovery Engine')}
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

        {/* Mode Selector Tabs */}
        {mode !== 'reset-code' && (
          <div className="grid grid-cols-2 bg-slate-100 border-b border-slate-200 text-xs font-bold font-display p-1">
            <button
              onClick={() => { setMode('signin'); setError(null); setSuccessMsg(null); }}
              className={`py-2.5 text-center transition-all cursor-pointer rounded-xl ${
                mode === 'signin' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isRtl ? 'تسجيل الدخول' : 'Sign In'}
            </button>
            <button
              onClick={() => { setMode('signup'); setError(null); setSuccessMsg(null); }}
              className={`py-2.5 text-center transition-all cursor-pointer rounded-xl ${
                mode === 'signup' ? 'bg-white text-indigo-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {isRtl ? 'إنشاء حساب جديد' : 'Register Account'}
            </button>
          </div>
        )}

        {/* Form Body */}
        <div className="p-6 space-y-4">
          {/* Notifications */}
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* SIGN IN FORM */}
          {mode === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRtl ? 'البريد الإلكتروني المهني:' : 'Professional Email Address:'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3" />
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="advocate@almizan.law"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-3 py-2.5 rtl:pl-3 rtl:pr-9 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {isRtl ? 'كلمة المرور:' : 'Password:'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                  >
                    {isRtl ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-10 py-2.5 rtl:pl-10 rtl:pr-9 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 rtl:right-auto rtl:left-3 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs text-slate-600">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={e => setRememberMe(e.target.checked)}
                    className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>{isRtl ? 'تذكر بيانات الدخول' : 'Remember my session'}</span>
                </label>
                <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>256-Bit SSL</span>
                </span>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-2xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{isRtl ? 'جاري التحقق...' : 'Authenticating...'}</span>
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    <span>{isRtl ? 'دخول آمن للمكتب' : 'Secure Sign In'}</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* SIGN UP FORM */}
          {mode === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-3">
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl text-[11px] font-bold text-slate-700">
                <button
                  type="button"
                  onClick={() => setAccountType('Law Firm')}
                  className={`py-1.5 rounded-xl transition-all ${accountType === 'Law Firm' ? 'bg-white text-indigo-600 shadow-xs' : ''}`}
                >
                  {isRtl ? 'مكتب محاماة' : 'Law Firm'}
                </button>
                <button
                  type="button"
                  onClick={() => setAccountType('Solo Practitioner')}
                  className={`py-1.5 rounded-xl transition-all ${accountType === 'Solo Practitioner' ? 'bg-white text-indigo-600 shadow-xs' : ''}`}
                >
                  {isRtl ? 'محامي فردي' : 'Solo Advocate'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isRtl ? 'الاسم الكامل بالصفة القضائية:' : 'Full Legal Name:'}
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                    placeholder="Adv. Ahmad Al-Khatib"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isRtl ? 'اسم المكتب / الشركة:' : 'Firm / Chamber Name:'}
                  </label>
                  <input
                    type="text"
                    value={firmName}
                    onChange={e => setFirmName(e.target.value)}
                    placeholder="Al-Khatib Legal Associates"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isRtl ? 'رقم القيد / الترخيص النقابي:' : 'Bar License / Reg ID:'}
                  </label>
                  <input
                    type="text"
                    value={barId}
                    onChange={e => setBarId(e.target.value)}
                    placeholder="JBA-2026-881"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    {isRtl ? 'النطاق القضائي الرئيسي:' : 'Primary Jurisdiction:'}
                  </label>
                  <select
                    value={jurisdiction}
                    onChange={e => setJurisdiction(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="Jordan Courts & Arbitration">Jordan Courts & Arbitration (الأردن)</option>
                    <option value="Saudi Commercial Courts (SCCA)">Saudi Commercial Courts & SCCA (السعودية)</option>
                    <option value="UAE Federal & DIFC Courts">UAE Federal & DIFC Courts (الإمارات)</option>
                    <option value="International Tribunals (ICC/LCIA)">International Commercial Tribunals (تحكيم دولي)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isRtl ? 'البريد الإلكتروني المعتمد للمكتب:' : 'Official Work Email:'}
                </label>
                <input
                  type="email"
                  value={signupEmail}
                  onChange={e => setSignupEmail(e.target.value)}
                  placeholder="counsel@firm.law"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  {isRtl ? 'تعيين كلمة المرور:' : 'Set Strong Password:'}
                </label>
                <input
                  type="password"
                  value={signupPassword}
                  onChange={e => setSignupPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div className="pt-1">
                <label className="flex items-start gap-2 text-[11px] text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={agreedTerms}
                    onChange={e => setAgreedTerms(e.target.checked)}
                    className="mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    {isRtl
                      ? 'أوافق على الشروط وسياسة السرية المعتمدة للممارسة القانونية وقواعد حماية البيانات.'
                      : 'I agree to the Legal Practice Terms of Service, Confidentiality Charter & Data Protection Protocol.'}
                  </span>
                </label>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-bold text-xs rounded-2xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2 mt-2"
              >
                {loading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{isRtl ? 'جاري إنشاء الحساب...' : 'Setting Up Practice Account...'}</span>
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4" />
                    <span>{isRtl ? 'بدء الحساب التجريبي المتقدم (14 يوماً مجاناً)' : 'Start 14-Day Free Practice Trial'}</span>
                  </>
                )}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {mode === 'forgot' && (
            <form onSubmit={handleSendResetCode} className="space-y-4">
              <div className="text-xs text-slate-600 leading-relaxed">
                {isRtl
                  ? 'أدخل بريدك الإلكتروني المسجل في النظام لإرسال رمز إعادة تعيين كلمة المرور الآمن:'
                  : 'Enter your registered work email to receive a secure password reset verification code:'}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRtl ? 'البريد الإلكتروني:' : 'Work Email:'}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 rtl:left-auto rtl:right-3" />
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    placeholder="counsel@firm.law"
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-9 pr-3 py-2.5 rtl:pl-3 rtl:pr-9 text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  type="button"
                  onClick={() => setMode('signin')}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  {isRtl ? '← العودة لتسجيل الدخول' : '← Back to Sign In'}
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  {loading ? (
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <Key className="w-4 h-4" />
                      <span>{isRtl ? 'إرسال الرمز' : 'Send Reset Code'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* RESET CODE CONFIRMATION FORM */}
          {mode === 'reset-code' && (
            <form onSubmit={handleConfirmReset} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRtl ? 'رمز التحقيق المرسل:' : '6-Digit Verification Code:'}
                </label>
                <input
                  type="text"
                  value={resetCode}
                  onChange={e => setResetCode(e.target.value)}
                  placeholder="849201"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-center font-mono text-sm tracking-widest font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {isRtl ? 'كلمة المرور الجديدة:' : 'New Strong Password:'}
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-2xl transition-all shadow-md cursor-pointer flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isRtl ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}</span>
                  </>
                )}
              </button>
            </form>
          )}

        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-100 p-4 text-center">
          <p className="text-[11px] text-slate-400">
            {isRtl
              ? 'الميزان محمي ببروتوكولات الأمان القضائي والتشفير السيادي.'
              : 'Al Mizan — Sovereign Encryption & Court-Grade Data Privacy Standard.'}
          </p>
        </div>

      </div>
    </div>
  );
}

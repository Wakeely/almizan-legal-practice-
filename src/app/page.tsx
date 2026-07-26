"use client";

// =============================================================================
// Al Mizan — single-page app entry (state-driven)
// -----------------------------------------------------------------------------
// The fullstack-dev sandbox only exposes the `/` route to the user. The
// reference Vite app is also a single-page app driven by `useState`, so this
// is a faithful architectural port.
//
// Flow:
//   landing  → user clicks "Launch Workspace" or "Client Portal"
//   auth     → AuthModal opens (sign-in / sign-up / forgot-password)
//   authed   → workspace renders (Turn 2 ships the actual modules; for Turn 1
//              we render a placeholder that confirms the session is active).
// =============================================================================

import React, { useState } from "react";
import LandingPage from "@/components/landing/landing-page";
import AuthModal from "@/components/auth/auth-modal";
import { useAuth } from "@/components/providers/auth-provider";
import { useLanguage } from "@/components/providers/language-provider";
import { useTheme } from "next-themes";
import {
  Scale,
  ShieldCheck,
  Globe,
  Sun,
  Moon,
  LogOut,
  RefreshCw,
  Lock,
  AlertTriangle,
} from "lucide-react";

export default function Page() {
  const { user, loading, isAuthenticated, logout, refresh } = useAuth();
  const { t, isRtl, language, toggleLanguage } = useLanguage();
  const { theme, setTheme } = useTheme();

  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [mode, setMode] = useState<"Lawyer" | "Client">("Lawyer");
  // Tracks whether the user has clicked "Launch Workspace" / "Client Portal"
  // from the landing page. Once true, we render the auth gate (or workspace
  // if already authenticated).
  const [hasEntered, setHasEntered] = useState(false);

  // ----- LANDING VIEW -----
  // User is on landing if (a) not authenticated and (b) hasn't clicked Enter.
  if (!isAuthenticated && !hasEntered) {
    return (
      <>
        <LandingPage
          onEnterWorkspace={() => {
            if (isAuthenticated) {
              setMode("Lawyer");
              setHasEntered(true);
            } else {
              setAuthMode("signin");
              setAuthOpen(true);
            }
          }}
          onEnterClientPortal={() => {
            if (isAuthenticated) {
              setMode("Client");
              setHasEntered(true);
            } else {
              setAuthMode("signin");
              setAuthOpen(true);
            }
          }}
        />
        <AuthModal
          isOpen={authOpen}
          onClose={() => setAuthOpen(false)}
          initialMode={authMode}
          onSuccess={() => {
            setMode("Lawyer");
            setHasEntered(true);
          }}
        />
      </>
    );
  }

  // ----- LOADING VIEW -----
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <RefreshCw className="w-8 h-8 animate-spin text-primary" />
        <p className="text-sm font-semibold text-muted-foreground">
          {isRtl ? "جاري تحضير ملفات الميزان..." : "Initializing Al Mizan..."}
        </p>
      </div>
    );
  }

  // ----- AUTH REQUIRED VIEW -----
  if (!isAuthenticated) {
    return (
      <>
        <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 bg-background">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/30 text-primary flex items-center justify-center">
            <Lock className="w-8 h-8" />
          </div>
          <div className="text-center max-w-md">
            <h2 className="text-xl font-extrabold text-foreground">
              {isRtl ? "يجب تسجيل الدخول للوصول لبيئة العمل" : "Authentication required"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {isRtl
                ? "يرجى تسجيل الدخول أو إنشاء حساب للمتابعة إلى مساحة عمل الميزان."
                : "Please sign in or create an account to access the Al Mizan workspace."}
            </p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => { setAuthMode("signin"); setAuthOpen(true); }}
              className="px-5 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow hover:opacity-90 transition cursor-pointer"
            >
              {isRtl ? "تسجيل الدخول" : "Sign In"}
            </button>
            <button
              onClick={() => { setAuthMode("signup"); setAuthOpen(true); }}
              className="px-5 py-2.5 bg-secondary text-secondary-foreground font-bold text-xs rounded-xl border border-border hover:bg-accent transition cursor-pointer"
            >
              {isRtl ? "إنشاء حساب" : "Register"}
            </button>
          </div>
        </div>
        <AuthModal
          isOpen={authOpen}
          onClose={() => setAuthOpen(false)}
          initialMode={authMode}
          onSuccess={() => setHasEntered(true)}
        />
      </>
    );
  }

  // ----- WORKSPACE VIEW (Turn 1 placeholder — full modules ship in Turn 2) -----
  return (
    <div className="app-theme-wrapper min-h-screen p-4 md:p-8 pb-24 lg:pb-8 text-foreground flex flex-col">
      {/* Top bar — minimal until Header ships in Turn 2 */}
      <header className="flex items-center justify-between mb-6 px-1">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-amber-400 p-0.5">
            <div className="w-full h-full bg-background rounded-[10px] flex items-center justify-center">
              <Scale className="w-4 h-4 text-primary" />
            </div>
          </div>
          <div>
            <div className="text-sm font-extrabold leading-none">
              {isRtl ? "الميزان" : "Al Mizan"}
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {isRtl ? "مساحة العمل — المرحلة 1" : "Workspace — Phase 1"}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-secondary border border-border rounded-xl hover:bg-accent transition cursor-pointer"
            aria-label="Toggle language"
          >
            <Globe className="w-3.5 h-3.5" />
            <span>{language === "ar" ? "English" : "العربية"}</span>
          </button>
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 text-xs font-bold bg-secondary border border-border rounded-xl hover:bg-accent transition cursor-pointer"
            aria-label="Toggle theme"
          >
            {theme === "dark" ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={async () => { await logout(); setHasEntered(false); }}
            className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 rounded-xl hover:bg-rose-500/20 transition cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{isRtl ? "خروج" : "Sign Out"}</span>
          </button>
        </div>
      </header>

      {/* Welcome card — confirms session + multi-tenancy work */}
      <main className="flex-grow flex flex-col gap-6">
        <section className="bg-card border border-border rounded-3xl p-6 md:p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="w-5 h-5 text-emerald-500" />
            <h1 className="text-xl md:text-2xl font-extrabold">
              {isRtl
                ? `مرحباً ${user?.name} — تم إنشاء الجلسة المشفّرة بنجاح`
                : `Welcome ${user?.name} — encrypted session established`}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-3xl">
            {isRtl
              ? "تم تسجيل دخولك بأمان باستخدام ملفات تعريف ارتباط HttpOnly. جميع استعلامات البيانات ستقتصر على مؤسستك (organizationId). المرحلة الأولى جاهزة — ستتبعها وحدات القضايا والمهام والمستندات والفوترة والتقويم والذكاء الاصطناعي في المراحل القادمة."
              : "You are signed in via HttpOnly cookies. All data queries will be scoped to your organization (organizationId). Phase 1 foundation is live — the Matters, Tasks, Documents, Billing, Calendar, and AI modules ship in the upcoming turns of the rollout plan."}
          </p>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* Session card */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="text-[11px] font-bold text-primary uppercase tracking-wider mb-2">
              {isRtl ? "بيانات الجلسة" : "Session"}
            </div>
            <dl className="text-xs space-y-1.5">
              <div className="flex justify-between"><dt className="text-muted-foreground">{isRtl ? "الاسم" : "Name"}</dt><dd className="font-bold">{user?.name}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{isRtl ? "البريد" : "Email"}</dt><dd className="font-mono text-[11px]">{user?.email}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{isRtl ? "المكتب" : "Firm"}</dt><dd className="font-bold">{user?.firmName}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{isRtl ? "الدور" : "Role"}</dt><dd className="font-bold">{user?.role}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{isRtl ? "النطاق" : "Jurisdiction"}</dt><dd className="font-bold">{user?.jurisdiction}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Organization ID</dt><dd className="font-mono text-[10px]">{user?.organizationId}</dd></div>
            </dl>
          </div>

          {/* Subscription card */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-2">
              {isRtl ? "الاشتراك" : "Subscription"}
            </div>
            <dl className="text-xs space-y-1.5">
              <div className="flex justify-between"><dt className="text-muted-foreground">{isRtl ? "الباقة" : "Tier"}</dt><dd className="font-bold">{user?.subscriptionTier}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{isRtl ? "الحالة" : "Status"}</dt><dd className="font-bold">{user?.planStatus}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{isRtl ? "أيام التجربة" : "Trial Days"}</dt><dd className="font-bold">{user?.trialDaysLeft}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{isRtl ? "المقاعد" : "Seats"}</dt><dd className="font-bold">{user?.seats} / {user?.maxSeats}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{isRtl ? "دورة الفوترة" : "Billing"}</dt><dd className="font-bold">{user?.billingCycle}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">{isRtl ? "التجديد" : "Renewal"}</dt><dd className="font-bold">{user?.renewalDate || "—"}</dd></div>
            </dl>
          </div>

          {/* Status card */}
          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">
              {isRtl ? "حالة النظام" : "System Status"}
            </div>
            <ul className="text-xs space-y-2">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{isRtl ? "ملفات تعريف الارتباط HttpOnly مفعّلة" : "HttpOnly cookies active"}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{isRtl ? "عزل المؤسسات مفعّل (organizationId)" : "Multi-tenant isolation (organizationId)"}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{isRtl ? "تشفير bcrypt لكلمات المرور (12 جولة)" : "bcrypt password hashing (12 rounds)"}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{isRtl ? "سجل التدقيق مفعّل" : "Audit logging enabled"}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>{isRtl ? "تحديد المعدل في الذاكرة (MVP)" : "In-memory rate limit (MVP)"}</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span>{isRtl ? "قاعدة بيانات SQLite (تطوير)" : "SQLite database (dev)"}</span>
              </li>
            </ul>
          </div>
        </section>

        {/* Roadmap card */}
        <section className="bg-card border border-border rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-extrabold">
              {isRtl ? "خطة التطوير القادمة" : "Upcoming Rollout"}
            </h3>
          </div>
          <ol className="text-xs text-muted-foreground space-y-1.5 list-decimal list-inside">
            <li>{isRtl ? "المرحلة 2: الترويسة + القضايا + التحليلات + المهام" : "Turn 2: Header + Matters + Analytics + Tasks"}</li>
            <li>{isRtl ? "المرحلة 3: المستندات + الفوترة + التقويم" : "Turn 3: Documents + Billing + Calendar"}</li>
            <li>{isRtl ? "المرحلة 4: الذكاء الاصطناعي + غرفة الحرب + بوابة الموكل" : "Turn 4: AI Copilot + War Room + Client Portal"}</li>
            <li>{isRtl ? "المرحلة 5: تعارض المصالح + البحث + التصلب" : "Turn 5: Conflict Check + Global Search + Hardening"}</li>
          </ol>
        </section>
      </main>

      <footer className="mt-auto pt-6 border-t border-border flex flex-col md:flex-row justify-between items-center text-[10px] text-muted-foreground uppercase tracking-widest gap-2">
        <span>WAKEELY PRO © 2026</span>
        <span>BILINGUAL • MULTI-TENANT • RTL-READY</span>
        <span>v0.1.0 — PHASE 1</span>
      </footer>
    </div>
  );
}

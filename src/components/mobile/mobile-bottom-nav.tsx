'use client';

import React, { useState } from 'react';
import { 
  BarChart2, 
  CheckSquare, 
  FileText, 
  Sparkles, 
  User, 
  Shield, 
  Plus, 
  Bell, 
  Landmark, 
  Languages, 
  X, 
  CreditCard,
  ChevronRight,
  ChevronLeft,
  Folder,
  Menu,
  CheckCircle2,
  Lock,
  Search,
  Scale,
  Fingerprint,
  Scan
} from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import { translateStaticText } from '@/lib/i18n';
import { Matter } from '@/lib/types';

interface MobileBottomNavProps {
  currentMode: 'Lawyer' | 'Client';
  onModeChange: (mode: 'Lawyer' | 'Client') => void;
  activeMobileTab: 'all' | 'analytics' | 'tasks' | 'docs' | 'ai';
  onSelectMobileTab: (tab: 'all' | 'analytics' | 'tasks' | 'docs' | 'ai') => void;
  unreadNotificationsCount: number;
  onOpenNotifications: () => void;
  onOpenSearch?: () => void;
  onOpenNewMatterModal: () => void;
  onOpenBiometrics?: () => void;
  matters: Matter[];
  activeMatterId: string;
  onActiveMatterChange: (id: string) => void;
}

export default function MobileBottomNav({
  currentMode,
  onModeChange,
  activeMobileTab,
  onSelectMobileTab,
  unreadNotificationsCount,
  onOpenNotifications,
  onOpenSearch,
  onOpenNewMatterModal,
  onOpenBiometrics,
  matters,
  activeMatterId,
  onActiveMatterChange
}: MobileBottomNavProps) {
  const { language, setLanguage, t, isRtl } = useLanguage();
  const [showSideDrawer, setShowSideDrawer] = useState(false);
  const [showCaseSheet, setShowCaseSheet] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const activeMatter = matters.find(m => m.id === activeMatterId);

  const handleTabClick = (tabKey: 'all' | 'analytics' | 'tasks' | 'docs' | 'ai') => {
    onSelectMobileTab(tabKey);
    setShowSideDrawer(false);
    
    let elementId = '';
    if (tabKey === 'analytics') elementId = 'analytics-module';
    else if (tabKey === 'tasks') elementId = 'tasks-module';
    else if (tabKey === 'docs') elementId = 'documents-module';
    else if (tabKey === 'ai') elementId = 'ai-module';

    if (elementId) {
      setTimeout(() => {
        const el = document.getElementById(elementId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 50);
    }
  };

  const handleScrollToModule = (id: string) => {
    setShowSideDrawer(false);
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 50);
  };

  const handleLanguageToggle = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  const filteredMatters = matters.filter(m => 
    m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    m.jurisdiction.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <>
      {/* 1. NATIVE MOBILE APP TOP HEADER (Sticky, App Bar) */}
      <div className="sticky top-0 z-30 bg-white/95 backdrop-blur-2xl border-b border-slate-200/90 px-3 py-2.5 lg:hidden mb-4 shadow-xs">
        <div className="flex items-center justify-between gap-2">
          
          {/* Hamburger Menu Trigger & App Title */}
          <div className="flex items-center gap-2 min-w-0">
            <button
              onClick={() => setShowSideDrawer(true)}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl transition-all cursor-pointer border border-slate-200/80 active:scale-95 flex items-center justify-center shrink-0"
              aria-label={t.mobileNavMenu}
            >
              <Menu className="w-5 h-5 text-indigo-700 stroke-[2.2]" />
            </button>

            {/* Case Quick Switcher Pill */}
            <button
              onClick={() => setShowCaseSheet(true)}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200/80 border border-slate-200/80 rounded-xl px-2.5 py-1.5 text-xs font-semibold text-slate-800 min-w-0 max-w-[170px] truncate transition-colors cursor-pointer"
            >
              <Landmark className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="truncate">
                {activeMatter ? translateStaticText(activeMatter.title, isRtl) : t.selectCase}
              </span>
            </button>
          </div>

          {/* Right Top Actions: Global Search, Lang Switcher & Notification Bell */}
          <div className="flex items-center gap-1.5 shrink-0">

            {/* Global Search Button */}
            {onOpenSearch && (
              <button
                onClick={onOpenSearch}
                className="p-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded-xl border border-indigo-200/80 transition-all cursor-pointer active:scale-95"
                title={t.globalSearchTitle}
              >
                <Search className="w-4 h-4 stroke-[2.2]" />
              </button>
            )}

            {/* Language Switch Button */}
            <button
              onClick={handleLanguageToggle}
              className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-bold flex items-center gap-1 border border-slate-200 transition-colors cursor-pointer"
            >
              <Languages className="w-3.5 h-3.5 text-indigo-600" />
              <span>{language === 'ar' ? 'EN' : 'عربي'}</span>
            </button>

            {/* Notification Bell */}
            <button
              onClick={onOpenNotifications}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl border border-slate-200 transition-colors relative cursor-pointer"
            >
              <Bell className={`w-4 h-4 ${unreadNotificationsCount > 0 ? 'text-indigo-600 animate-bounce' : 'text-slate-600'}`} />
              {unreadNotificationsCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[9px] font-extrabold w-4.5 h-4.5 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                  {unreadNotificationsCount}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 2. SLIDE LEFT-TO-RIGHT / RIGHT-TO-LEFT SIDE DRAWER MENU */}
      {showSideDrawer && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          {/* Backdrop Blur Overlay */}
          <div 
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md transition-opacity animate-in fade-in duration-200"
            onClick={() => setShowSideDrawer(false)}
          />

          {/* Side Drawer Panel */}
          <div 
            className={`relative w-80 max-w-[85vw] bg-white h-full shadow-2xl flex flex-col z-10 overflow-y-auto animate-in duration-300 ${
              isRtl ? 'ml-auto slide-in-from-right' : 'mr-auto slide-in-from-left'
            }`}
          >
            {/* Drawer Header & Profile Card */}
            <div className="p-4 bg-gradient-to-br from-indigo-950 via-slate-900 to-indigo-900 text-white relative flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 bg-indigo-600 rounded-xl flex items-center justify-center font-bold text-base shadow-md font-display">
                    {isRtl ? 'و' : 'W'}
                  </div>
                  <div>
                    <h3 className="font-bold text-sm font-display text-white leading-none">Al Mizan</h3>
                    <p className="text-[10px] text-indigo-300 mt-0.5">DIFC & SCCA Legal System</p>
                  </div>
                </div>

                <button
                  onClick={() => setShowSideDrawer(false)}
                  className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-slate-300 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* User Profile / Role Selector inside Drawer */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/10 flex items-center justify-between gap-2 mt-1">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-full bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center text-xs font-bold text-indigo-200 shrink-0">
                    {currentMode === 'Lawyer' ? <Shield className="w-4 h-4 text-indigo-300" /> : <User className="w-4 h-4 text-amber-300" />}
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {currentMode === 'Lawyer' ? (isRtl ? 'المحامي الرئيسي' : 'Lead Attorney') : (isRtl ? 'بوابة الموكل' : 'Client Access')}
                    </p>
                    <p className="text-[10px] text-indigo-300 truncate">
                      {currentMode === 'Lawyer' ? 'Partner View' : activeMatter?.clientName}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => {
                    onModeChange(currentMode === 'Lawyer' ? 'Client' : 'Lawyer');
                    setShowSideDrawer(false);
                  }}
                  className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold transition-all shrink-0 cursor-pointer shadow-sm"
                >
                  {currentMode === 'Lawyer' ? t.clientMode : t.lawyerMode}
                </button>
              </div>
            </div>

            {/* Navigation Body */}
            <div className="p-4 flex flex-col gap-5 flex-grow">
              
              {/* Site-Wide Endpoints Section */}
              <div>
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2 font-mono">
                  {t.mobileSiteEndpoints}
                </p>
                
                <div className="flex flex-col gap-1">
                  {/* Endpoint 1: Overview */}
                  <button
                    onClick={() => handleTabClick('analytics')}
                    className="w-full p-2.5 rounded-xl hover:bg-indigo-50/80 text-slate-700 hover:text-indigo-900 flex items-center justify-between text-xs font-bold transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-indigo-100/70 text-indigo-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <BarChart2 className="w-4 h-4" />
                      </div>
                      <span>{t.mobileNavOverview}</span>
                    </div>
                    {isRtl ? <ChevronLeft className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </button>

                  {/* Endpoint 2: Tasks & Deadlines */}
                  <button
                    onClick={() => handleTabClick('tasks')}
                    className="w-full p-2.5 rounded-xl hover:bg-indigo-50/80 text-slate-700 hover:text-indigo-900 flex items-center justify-between text-xs font-bold transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <CheckSquare className="w-4 h-4" />
                      </div>
                      <span>{t.mobileNavTasks}</span>
                    </div>
                    {isRtl ? <ChevronLeft className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </button>

                  {/* Endpoint 3: Document Vault */}
                  <button
                    onClick={() => handleTabClick('docs')}
                    className="w-full p-2.5 rounded-xl hover:bg-indigo-50/80 text-slate-700 hover:text-indigo-900 flex items-center justify-between text-xs font-bold transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-blue-100/70 text-blue-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <FileText className="w-4 h-4" />
                      </div>
                      <span>{t.mobileNavDocs}</span>
                    </div>
                    {isRtl ? <ChevronLeft className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </button>

                  {/* Endpoint 4: Billing & Financials */}
                  <button
                    onClick={() => handleScrollToModule('documents-module')}
                    className="w-full p-2.5 rounded-xl hover:bg-indigo-50/80 text-slate-700 hover:text-indigo-900 flex items-center justify-between text-xs font-bold transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-amber-100/70 text-amber-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                        <CreditCard className="w-4 h-4" />
                      </div>
                      <span>{t.mobileNavBilling}</span>
                    </div>
                    {isRtl ? <ChevronLeft className="w-4 h-4 text-slate-400" /> : <ChevronRight className="w-4 h-4 text-slate-400" />}
                  </button>

                  {/* Endpoint 5: Gemini AI Legal Copilot */}
                  <button
                    onClick={() => handleTabClick('ai')}
                    className="w-full p-2.5 rounded-xl bg-gradient-to-r from-indigo-500/10 to-purple-500/10 border border-indigo-200/50 text-indigo-900 flex items-center justify-between text-xs font-bold transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center group-hover:scale-110 transition-transform">
                        <Sparkles className="w-4 h-4 text-amber-300 fill-amber-300" />
                      </div>
                      <span>{t.mobileNavAi}</span>
                    </div>
                    <span className="bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 rounded-full font-bold">PRO</span>
                  </button>

                  {/* Endpoint 6: AI Co-pilot */}
                </div>
              </div>

              {/* Active Cases Section */}
              <div className="border-t border-slate-100 pt-3">
                <div className="flex justify-between items-center mb-2">
                  <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider font-mono">
                    {t.mobileActiveCases} ({matters.length})
                  </p>
                  {currentMode === 'Lawyer' && (
                    <button
                      onClick={() => {
                        setShowSideDrawer(false);
                        onOpenNewMatterModal();
                      }}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3 h-3" />
                      {t.newIntake}
                    </button>
                  )}
                </div>

                {/* Case Search Input inside Drawer */}
                <div className="relative mb-2">
                  <Search className={`w-3.5 h-3.5 text-slate-400 absolute top-2.5 ${isRtl ? 'right-2.5' : 'left-2.5'}`} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={isRtl ? 'بحث في القضايا...' : 'Search disputes...'}
                    className={`w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-1.5 text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 ${
                      isRtl ? 'pr-8 pl-2' : 'pl-8 pr-2'
                    }`}
                  />
                </div>

                <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-0.5">
                  {filteredMatters.map(m => {
                    const isSelected = m.id === activeMatterId;
                    const locTitle = translateStaticText(m.title, isRtl);
                    const locClient = translateStaticText(m.clientName, isRtl);

                    return (
                      <button
                        key={m.id}
                        onClick={() => {
                          onActiveMatterChange(m.id);
                          setShowSideDrawer(false);
                        }}
                        className={`w-full p-2 rounded-xl text-start border transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-900 font-bold'
                            : 'bg-slate-50/60 hover:bg-slate-100 border-slate-200/60 text-slate-700'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <p className="text-xs truncate">{locTitle}</p>
                          <p className="text-[10px] text-slate-400 truncate">{locClient}</p>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Compliance & Security Footer */}
              <div className="mt-auto border-t border-slate-100 pt-3 flex flex-col gap-2">
                <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-semibold bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                  <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>DIFC & SCCA Compliant Legal Node</span>
                </div>

                <div className="flex justify-between items-center text-[10px] text-slate-400 px-1 font-mono">
                  <span>Hash: 0x821A_PRO</span>
                  <span>v1.08</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. 5-BUTTON NATIVE MOBILE BOTTOM NAVIGATION BAR (Fixed) */}
      <nav 
        className="fixed bottom-0 inset-x-0 z-40 lg:hidden bg-white/95 backdrop-blur-2xl border-t border-slate-200/90 px-2 py-1.5 shadow-[0_-8px_30px_rgba(15,23,42,0.12)]"
        aria-label="Mobile Bottom Navigation"
      >
        <div className="grid grid-cols-5 gap-1 items-center max-w-md mx-auto">
          {currentMode === 'Lawyer' ? (
            <>
              {/* Button 1: Menu Drawer Trigger */}
              <button
                onClick={() => setShowSideDrawer(true)}
                className="flex flex-col items-center justify-center py-1 rounded-xl text-slate-600 hover:text-indigo-600 font-semibold transition-all cursor-pointer active:scale-95"
              >
                <div className="p-1 rounded-xl bg-slate-100/80 text-slate-700">
                  <Menu className="w-5 h-5 stroke-[2.2]" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight font-bold">{t.mobileNavMenu}</span>
              </button>

              {/* Button 2: Metrics / Analytics */}
              <button
                onClick={() => handleTabClick('analytics')}
                className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
                  activeMobileTab === 'analytics'
                    ? 'text-indigo-600 font-extrabold'
                    : 'text-slate-500 hover:text-slate-800 font-semibold'
                }`}
              >
                <div className={`p-1 rounded-xl transition-all ${activeMobileTab === 'analytics' ? 'bg-indigo-600 text-white scale-105 shadow-xs' : ''}`}>
                  <BarChart2 className="w-5 h-5" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">{t.mobileNavOverview}</span>
              </button>

              {/* Button 3: Tasks & Kanban */}
              <button
                onClick={() => handleTabClick('tasks')}
                className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
                  activeMobileTab === 'tasks'
                    ? 'text-indigo-600 font-extrabold'
                    : 'text-slate-500 hover:text-slate-800 font-semibold'
                }`}
              >
                <div className={`p-1 rounded-xl transition-all ${activeMobileTab === 'tasks' ? 'bg-indigo-600 text-white scale-105 shadow-xs' : ''}`}>
                  <CheckSquare className="w-5 h-5" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">{t.mobileNavTasks}</span>
              </button>

              {/* Button 4: Document Vault */}
              <button
                onClick={() => handleTabClick('docs')}
                className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
                  activeMobileTab === 'docs'
                    ? 'text-indigo-600 font-extrabold'
                    : 'text-slate-500 hover:text-slate-800 font-semibold'
                }`}
              >
                <div className={`p-1 rounded-xl transition-all ${activeMobileTab === 'docs' ? 'bg-indigo-600 text-white scale-105 shadow-xs' : ''}`}>
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">{t.mobileNavDocs}</span>
              </button>

              {/* Button 5: Gemini AI Legal Copilot */}
              <button
                onClick={() => handleTabClick('ai')}
                className={`flex flex-col items-center justify-center py-1 rounded-xl transition-all cursor-pointer active:scale-95 ${
                  activeMobileTab === 'ai'
                    ? 'text-indigo-600 font-extrabold'
                    : 'text-slate-500 hover:text-slate-800 font-semibold'
                }`}
              >
                <div className={`p-1 rounded-xl transition-all ${activeMobileTab === 'ai' ? 'bg-indigo-600 text-white scale-105 shadow-xs' : ''}`}>
                  <Sparkles className="w-5 h-5 text-amber-300 fill-amber-300" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">{t.mobileNavAi}</span>
              </button>
            </>
          ) : (
            <>
              {/* Client Mode Bottom Navigation Bar (5 Buttons) */}
              <button
                onClick={() => setShowSideDrawer(true)}
                className="flex flex-col items-center justify-center py-1 rounded-xl text-slate-600 hover:text-indigo-600 font-semibold transition-all cursor-pointer"
              >
                <div className="p-1 rounded-xl bg-slate-100 text-slate-700">
                  <Menu className="w-5 h-5 stroke-[2.2]" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight font-bold">{t.mobileNavMenu}</span>
              </button>

              <button
                onClick={() => handleScrollToModule('client-summary-card')}
                className="flex flex-col items-center justify-center py-1 rounded-xl text-amber-600 font-extrabold cursor-pointer"
              >
                <div className="p-1 rounded-xl bg-amber-50 text-amber-600">
                  <Landmark className="w-5 h-5" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">{isRtl ? 'الملخص' : 'Summary'}</span>
              </button>

              <button
                onClick={() => handleScrollToModule('client-docs-card')}
                className="flex flex-col items-center justify-center py-1 rounded-xl text-slate-600 font-semibold cursor-pointer"
              >
                <div className="p-1 rounded-xl hover:bg-slate-100">
                  <FileText className="w-5 h-5" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">{t.mobileNavDocs}</span>
              </button>

              <button
                onClick={() => handleScrollToModule('client-messages-card')}
                className="flex flex-col items-center justify-center py-1 rounded-xl text-slate-600 font-semibold cursor-pointer"
              >
                <div className="p-1 rounded-xl hover:bg-slate-100">
                  <User className="w-5 h-5" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">{isRtl ? 'المحادثة' : 'Chat'}</span>
              </button>

              <button
                onClick={() => onModeChange('Lawyer')}
                className="flex flex-col items-center justify-center py-1 rounded-xl text-indigo-600 font-bold cursor-pointer"
              >
                <div className="p-1 rounded-xl bg-indigo-50 text-indigo-600">
                  <Shield className="w-5 h-5" />
                </div>
                <span className="text-[10px] mt-0.5 tracking-tight">{t.mobileNavLawyer}</span>
              </button>
            </>
          )}
        </div>
      </nav>

      {/* 4. CASE SELECTOR BOTTOM SHEET (When case pill tapped in header) */}
      {showCaseSheet && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div 
            className="fixed inset-0" 
            onClick={() => setShowCaseSheet(false)} 
          />
          <div className="relative bg-white rounded-t-3xl p-5 shadow-2xl border-t border-slate-200 z-10 flex flex-col gap-4 animate-in slide-in-from-bottom duration-200 max-h-[80vh] overflow-y-auto">
            {/* Sheet Handle */}
            <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mb-1" />

            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="text-base font-bold text-slate-800 font-display flex items-center gap-2">
                <Landmark className="w-4 h-4 text-indigo-600" />
                {isRtl ? 'ملفات القضايا والنزاعات القائمة' : 'Active Commercial Cases'}
              </h4>
              <button
                onClick={() => setShowCaseSheet(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              {matters.map(m => {
                const isSelected = m.id === activeMatterId;
                const locTitle = translateStaticText(m.title, isRtl);
                const locClient = translateStaticText(m.clientName, isRtl);
                const locJur = translateStaticText(m.jurisdiction, isRtl);

                return (
                  <button
                    key={m.id}
                    onClick={() => {
                      onActiveMatterChange(m.id);
                      setShowCaseSheet(false);
                    }}
                    className={`w-full p-3.5 rounded-2xl border text-start flex items-center justify-between transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-200 text-indigo-900 ring-2 ring-indigo-500/20'
                        : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        <Folder className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-xs truncate">{locTitle}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          {locClient} • <span className="font-mono">{locJur}</span>
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <span className="w-2.5 h-2.5 bg-indigo-600 rounded-full shrink-0 ml-2" />
                    )}
                  </button>
                );
              })}
            </div>

            {currentMode === 'Lawyer' && (
              <button
                onClick={() => {
                  setShowCaseSheet(false);
                  onOpenNewMatterModal();
                }}
                className="w-full py-3 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors flex items-center justify-center gap-1.5 mt-2 cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>{t.newIntake}</span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

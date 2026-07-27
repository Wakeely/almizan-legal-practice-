'use client';

import React, { useState, useEffect } from 'react';
import { Shield, ShieldCheck, User, Landmark, Plus, RefreshCw, Folder, Languages, Bell, Inbox, Check, FileCheck, Calendar, MessageSquare, Search, Sparkles, Fingerprint, Scan, Sun, Moon, Printer, LogOut, Award, Zap, Key } from 'lucide-react';
import { Matter } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';
import { useTheme } from 'next-themes';
import { useAuth } from '@/components/providers/auth-provider';
import { translateStaticText } from '@/lib/i18n';
import MobileBottomNav from '@/components/mobile/mobile-bottom-nav';
import GlobalSearchModal from '@/components/search/global-search-modal';
import ConflictCheckModal from '@/components/conflict/conflict-check-modal';
import AuthModal from '@/components/auth/auth-modal';
import SubscriptionPaywallModal from '@/components/subscription/subscription-paywall-modal';
import ThemeAwareLogo from '@/components/branding/theme-aware-logo';

interface HeaderProps {
  currentMode: 'Lawyer' | 'Client';
  onModeChange: (mode: 'Lawyer' | 'Client') => void;
  matters: Matter[];
  activeMatterId: string;
  onActiveMatterChange: (id: string) => void;
  onNewMatterCreated: (newMatter: Matter) => void;
  onShowLandingPage?: () => void;
}

export default function Header({
  currentMode,
  onModeChange,
  matters,
  activeMatterId,
  onActiveMatterChange,
  onNewMatterCreated,
  onShowLandingPage
}: HeaderProps) {
  const { language, setLanguage, t, isRtl } = useLanguage();
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  const toggleTheme = () => setTheme(isDark ? "light" : "dark");
  const { user, isAuthenticated, logout } = useAuth();

  const [showModal, setShowModal] = useState(false);
  const [showSearchModal, setShowSearchModal] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPaywallModal, setShowPaywallModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const [title, setTitle] = useState('');
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [jurisdiction, setJurisdiction] = useState('Dubai Commercial Court');
  const [opposingParty, setOpposingParty] = useState('');
  const [opposingCounsel, setOpposingCounsel] = useState('');
  const [budget, setBudget] = useState(15000);
  const [submitting, setSubmitting] = useState(false);

  // Global search keyboard shortcut listener (Ctrl+K or Cmd+K)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowSearchModal(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  // Notifications state
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isFetchingNotifications, setIsFetchingNotifications] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);

  const [readIds, setReadIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('almizan_read_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [dismissedIds, setDismissedIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('almizan_dismissed_notifications');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Mobile Native Nav tab filter state
  const [activeMobileTab, setActiveMobileTab] = useState<'all' | 'analytics' | 'tasks' | 'docs' | 'ai'>('all');

  const activeMatter = matters.find(m => m.id === activeMatterId);

  const loadNotificationsData = async () => {
    setIsFetchingNotifications(true);
    try {
      const allTasks: any[] = [];
      const allDocs: any[] = [];
      const allMessages: any[] = [];

      await Promise.all(matters.map(async (m) => {
        try {
          const tasksRes = await fetch(`/api/matters/${m.id}/tasks`);
          if (tasksRes.ok) {
            const tData = await tasksRes.json();
            allTasks.push(...tData);
          }

          const docsRes = await fetch(`/api/matters/${m.id}/documents`);
          if (docsRes.ok) {
            const dData = await docsRes.json();
            allDocs.push(...dData);
          }

          const msgsRes = await fetch(`/api/matters/${m.id}/messages`);
          if (msgsRes.ok) {
            const mData = await msgsRes.json();
            allMessages.push(...mData);
          }
        } catch (e) {
          console.error(`Failed to load data for matter ${m.id}:`, e);
        }
      }));

      const list: any[] = [];

      // 1. High priority uncompleted tasks
      allTasks.forEach(t => {
        if (t.priority === 'High' && t.status !== 'Completed') {
          list.push({
            id: `task-${t.id}`,
            type: 'deadline',
            title: t.title,
            description: t.description || '',
            date: t.dueDate,
            matterId: t.matterId,
            matterTitle: matters.find(m => m.id === t.matterId)?.title || '',
            isUrgent: true,
            refId: t.id
          });
        }
      });

      // 2. Draft documents waiting to be approved (visibleToClient === false)
      allDocs.forEach(d => {
        if (!d.visibleToClient) {
          list.push({
            id: `doc-${d.id}`,
            type: 'document',
            title: d.name,
            description: d.uploadedBy,
            date: new Date(d.uploadedAt).toLocaleDateString(),
            matterId: d.matterId,
            matterTitle: matters.find(m => m.id === d.matterId)?.title || '',
            isUrgent: false,
            refId: d.id
          });
        }
      });

      // 3. Client messages
      allMessages.forEach(msg => {
        if (msg.sender === 'Client') {
          list.push({
            id: `msg-${msg.id}`,
            type: 'message',
            title: msg.text,
            description: matters.find(m => m.id === msg.matterId)?.clientName || '',
            date: new Date(msg.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }),
            matterId: msg.matterId,
            matterTitle: matters.find(m => m.id === msg.matterId)?.title || '',
            isUrgent: false,
            refId: msg.id
          });
        }
      });

      list.sort((a, b) => {
        if (a.isUrgent && !b.isUrgent) return -1;
        if (!a.isUrgent && b.isUrgent) return 1;
        return b.id.localeCompare(a.id);
      });

      setNotifications(list);
    } catch (err) {
      console.error("Error building notifications:", err);
    } finally {
      setIsFetchingNotifications(false);
    }
  };

  useEffect(() => {
    if (matters.length > 0) {
      loadNotificationsData();
    }

    const handleTasksUpdate = () => loadNotificationsData();
    const handleDocsUpdate = () => loadNotificationsData();
    const handleMessagesUpdate = () => loadNotificationsData();
    const handlePortalUpdate = () => loadNotificationsData();

    window.addEventListener('tasks-updated', handleTasksUpdate);
    window.addEventListener('docs-updated', handleDocsUpdate);
    window.addEventListener('messages-updated', handleMessagesUpdate);
    window.addEventListener('portal-updated', handlePortalUpdate);

    return () => {
      window.removeEventListener('tasks-updated', handleTasksUpdate);
      window.removeEventListener('docs-updated', handleDocsUpdate);
      window.removeEventListener('messages-updated', handleMessagesUpdate);
      window.removeEventListener('portal-updated', handlePortalUpdate);
    };
  }, [matters, activeMatterId]);

  const markAsRead = (id: string) => {
    setReadIds(prev => {
      const next = prev.includes(id) ? prev : [...prev, id];
      localStorage.setItem('almizan_read_notifications', JSON.stringify(next));
      return next;
    });
  };

  const markAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    setReadIds(prev => {
      const next = Array.from(new Set([...prev, ...allIds]));
      localStorage.setItem('almizan_read_notifications', JSON.stringify(next));
      return next;
    });
  };

  const dismissNotification = (id: string) => {
    setDismissedIds(prev => {
      const next = prev.includes(id) ? prev : [...prev, id];
      localStorage.setItem('almizan_dismissed_notifications', JSON.stringify(next));
      return next;
    });
  };

  const handleApproveDocument = async (docId: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibleToClient: true })
      });
      if (res.ok) {
        window.dispatchEvent(new Event('docs-updated'));
        window.dispatchEvent(new Event('portal-updated'));
        markAsRead(`doc-${docId}`);
        dismissNotification(`doc-${docId}`);
      }
    } catch (e) {
      console.error("Failed to approve document:", e);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Completed' })
      });
      if (res.ok) {
        window.dispatchEvent(new Event('tasks-updated'));
        markAsRead(`task-${taskId}`);
        dismissNotification(`task-${taskId}`);
      }
    } catch (e) {
      console.error("Failed to complete task:", e);
    }
  };

  const handleMarkMessageRead = (msgId: string) => {
    markAsRead(`msg-${msgId}`);
    dismissNotification(`msg-${msgId}`);
  };

  const activeNotifications = notifications.filter(n => !dismissedIds.includes(n.id));
  const unreadCount = activeNotifications.filter(n => !readIds.includes(n.id)).length;

  const handleCreateMatter = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !clientName) return;

    setSubmitting(true);
    try {
      const response = await fetch('/api/matters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          clientName,
          clientEmail,
          jurisdiction,
          opposingParty,
          opposingCounsel,
          budget,
          riskLevel: 'Medium'
        })
      });
      if (response.ok) {
        const data = await response.json();
        onNewMatterCreated(data);
        setShowModal(false);
        // Reset
        setTitle('');
        setClientName('');
        setClientEmail('');
        setOpposingParty('');
        setOpposingCounsel('');
        setBudget(15000);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleLanguageToggle = () => {
    setLanguage(language === 'ar' ? 'en' : 'ar');
  };

  const handleSelectSearchResult = (matterId: string, section?: 'documents' | 'tasks') => {
    onActiveMatterChange(matterId);
    if (section) {
      window.dispatchEvent(new CustomEvent('mobile-tab-changed', { detail: section === 'documents' ? 'docs' : 'tasks' }));

      setTimeout(() => {
        const elId = section === 'documents' ? 'documents-module' : 'tasks-module';
        const el = document.getElementById(elId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 150);
    }
  };

  return (
    <>
      {/* Native Mobile Top & Bottom Navigation Bar */}
      <MobileBottomNav
        currentMode={currentMode}
        onModeChange={onModeChange}
        activeMobileTab={activeMobileTab}
        onSelectMobileTab={(tab) => {
          setActiveMobileTab(tab);
          window.dispatchEvent(new CustomEvent('mobile-tab-changed', { detail: tab }));
        }}
        unreadNotificationsCount={unreadCount}
        onOpenNotifications={() => setShowNotificationDropdown(true)}
        onOpenSearch={() => setShowSearchModal(true)}
        onOpenNewMatterModal={() => setShowModal(true)}
        matters={matters}
        activeMatterId={activeMatterId}
        onActiveMatterChange={onActiveMatterChange}
      />

      {/* Desktop Header Bar (Hidden on Mobile) */}
      <header className="hidden lg:flex flex-col lg:flex-row justify-between items-start lg:items-center mb-8 gap-4" id="app-header">
      {/* Brand Logo — ONLY the logo, no text/icons (per user request) */}
      <div className="flex items-center gap-3">
        <ThemeAwareLogo className="h-20 sm:h-24 w-auto shrink-0" alt="Al Mizan Legal Practice" />
        {activeMatter && (
          <p className="text-sm text-slate-600 dark:text-slate-400 font-sans flex items-center gap-1.5 mt-0.5">
            <Folder className="w-3.5 h-3.5 text-teal-600 shrink-0" />
            {t.activeCase}: <span className="text-teal-950 dark:text-teal-300 font-bold">{translateStaticText(activeMatter.title, isRtl)}</span>
          </p>
        )}
      </div>

      {/* Controls & Active Actions */}
      <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
        {/* Global Legal Search Input Trigger */}
        <button
          onClick={() => setShowSearchModal(true)}
          className="flex items-center gap-2.5 bg-white border border-slate-200 hover:border-teal-400 text-slate-500 hover:text-slate-800 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all cursor-pointer group w-64 lg:w-72"
          title={t.globalSearchTitle}
        >
          <Search className="w-4 h-4 text-teal-700 group-hover:scale-110 transition-transform shrink-0 stroke-[2.2]" />
          <span className="truncate flex-grow text-left rtl:text-right rtl:text-left font-sans text-slate-400 group-hover:text-slate-600">{t.globalSearchPlaceholder}</span>
          <kbd className="hidden sm:inline-block bg-teal-50 border border-teal-200 text-teal-800 px-1.5 py-0.5 rounded text-[10px] font-mono shadow-2xs font-bold shrink-0">
            ⌘K
          </kbd>
        </button>

        {/* Language Switcher */}
        <button
          onClick={handleLanguageToggle}
          className="px-3.5 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-teal-50/50 hover:border-teal-300 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
          title="Toggle Language / تغيير اللغة"
        >
          <Languages className="w-4 h-4 text-teal-700" />
          <span>{t.languageToggle}</span>
        </button>

        {/* Matter Dropdown selector */}
        <div className="flex items-center gap-2 bg-white border border-slate-200 hover:border-teal-300 rounded-xl px-3 py-1.5 shadow-sm">
          <Landmark className="w-4 h-4 text-teal-700" />
          <select
            value={activeMatterId}
            onChange={(e) => onActiveMatterChange(e.target.value)}
            className="text-sm font-bold text-teal-950 bg-transparent focus:outline-none border-none cursor-pointer"
          >
            {matters.map(m => {
              const localizedTitle = translateStaticText(m.title, isRtl);
              return (
                <option key={m.id} value={m.id}>
                  {localizedTitle.length > 30 ? `${localizedTitle.substring(0, 30)}...` : localizedTitle}
                </option>
              );
            })}
          </select>
        </div>

        {/* Notification Bell Icon */}
        <div className="relative">
          <button
            onClick={() => setShowNotificationDropdown(!showNotificationDropdown)}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-xl shadow-sm transition-all relative flex items-center justify-center cursor-pointer"
            title={t.notificationsTitle}
          >
            <Bell className={`w-4 h-4 text-slate-500 ${unreadCount > 0 ? 'animate-bounce text-indigo-600' : ''}`} />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-[9px] text-white font-extrabold w-4 h-4 rounded-full flex items-center justify-center border border-white shadow-sm">
                {unreadCount}
              </span>
            )}
          </button>

          {showNotificationDropdown && (
            <>
              {/* Backing backdrop to close on clicking away */}
              <div className="fixed inset-0 z-40" onClick={() => setShowNotificationDropdown(false)} />
              
              <div className={`absolute top-full ${isRtl ? 'left-0' : 'right-0'} mt-3 w-80 md:w-96 bg-white border border-slate-200 rounded-2xl shadow-2xl z-50 p-4 flex flex-col gap-3 animate-in fade-in slide-in-from-top-2 duration-150`}>
                <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-slate-800 font-display">{t.notificationsTitle}</span>
                    {unreadCount > 0 && (
                      <span className="bg-indigo-50 text-indigo-600 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                        {unreadCount} {t.unreadNotifications}
                      </span>
                    )}
                  </div>
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllAsRead}
                      className="text-[10px] text-indigo-600 hover:text-indigo-700 font-bold transition-colors cursor-pointer"
                    >
                      {t.markAllRead}
                    </button>
                  )}
                </div>

                <div className="flex flex-col gap-2.5 max-h-[280px] overflow-y-auto pr-0.5">
                  {activeNotifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
                      <Inbox className="w-8 h-8 text-slate-300" />
                      <p className="text-xs font-semibold">{t.emptyNotifications}</p>
                    </div>
                  ) : (
                    activeNotifications.map(n => {
                      const isUnread = !readIds.includes(n.id);
                      return (
                        <div
                          key={n.id}
                          onClick={() => markAsRead(n.id)}
                          className={`p-3 rounded-xl border transition-all flex gap-3 relative overflow-hidden group ${
                            isUnread
                              ? 'bg-indigo-50/40 border-indigo-100/80 shadow-sm'
                              : 'bg-slate-50/40 border-slate-100 hover:bg-slate-50'
                          }`}
                        >
                          {/* Indicator line for unread */}
                          {isUnread && (
                            <span className={`absolute top-0 bottom-0 ${isRtl ? 'right-0' : 'left-0'} w-1 bg-indigo-500`} />
                          )}

                          {/* Icon depending on type */}
                          <div className="shrink-0 mt-0.5">
                            {n.type === 'deadline' && (
                              <div className="w-7 h-7 bg-rose-50 border border-rose-100 text-rose-600 rounded-lg flex items-center justify-center">
                                <Calendar className="w-4 h-4" />
                              </div>
                            )}
                            {n.type === 'document' && (
                              <div className="w-7 h-7 bg-amber-50 border border-amber-100 text-amber-600 rounded-lg flex items-center justify-center">
                                <FileCheck className="w-4 h-4" />
                              </div>
                            )}
                            {n.type === 'message' && (
                              <div className="w-7 h-7 bg-teal-50 border border-teal-100 text-teal-600 rounded-lg flex items-center justify-center">
                                <MessageSquare className="w-4 h-4" />
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-grow min-w-0">
                            <div className="flex justify-between items-start gap-1">
                              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                                {n.type === 'deadline' && t.urgentDeadline}
                                {n.type === 'document' && t.pendingApproval}
                                {n.type === 'message' && t.clientMessage}
                              </span>
                              <span className="text-[9px] font-mono text-slate-400 whitespace-nowrap">{n.date}</span>
                            </div>

                            <h5 className="text-xs font-bold text-slate-700 leading-snug mt-0.5 truncate" title={translateStaticText(n.title, isRtl)}>
                              {translateStaticText(n.title, isRtl)}
                            </h5>

                            <p className="text-[10px] text-slate-500 leading-relaxed mt-1 line-clamp-2" title={translateStaticText(n.description, isRtl)}>
                              {translateStaticText(n.description, isRtl)}
                            </p>

                            <p className="text-[8px] text-indigo-500 font-bold mt-1.5 font-mono uppercase tracking-wider">
                              {translateStaticText(n.matterTitle, isRtl)}
                            </p>

                            {/* Quick Actions */}
                            <div className="flex gap-1.5 mt-2.5">
                              {n.type === 'deadline' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleCompleteTask(n.refId);
                                  }}
                                  className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg text-[9px] font-bold hover:bg-emerald-700 transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  {t.completeTaskBtn}
                                </button>
                              )}
                              {n.type === 'document' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleApproveDocument(n.refId);
                                  }}
                                  className="px-2.5 py-1 bg-amber-500 text-white rounded-lg text-[9px] font-bold hover:bg-amber-600 transition-colors shadow-sm flex items-center gap-1 cursor-pointer"
                                >
                                  <FileCheck className="w-3 h-3" />
                                  {t.approveDocBtn}
                                </button>
                              )}
                              {n.type === 'message' && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleMarkMessageRead(n.refId);
                                  }}
                                  className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-[9px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                                >
                                  <Check className="w-3 h-3" />
                                  {isRtl ? 'مقروء' : 'Mark Read'}
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  dismissNotification(n.id);
                                }}
                                className="px-2 py-1 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg text-[9px] font-bold transition-colors cursor-pointer"
                              >
                                {isRtl ? 'إخفاء' : 'Dismiss'}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Conflict Check Trigger */}
        {currentMode === 'Lawyer' && (
          <button
            onClick={() => setShowConflictModal(true)}
            className="px-2.5 py-2 bg-indigo-900 hover:bg-indigo-950 border border-indigo-700/80 rounded-xl text-xs font-bold text-indigo-100 shadow-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            title={isRtl ? 'فحص تعارض المصالح الأخلاقي' : 'Ethics & Conflict Check'}
          >
            <ShieldCheck className="w-4 h-4 text-indigo-300 shrink-0" />
            <span className="hidden xl:inline">{isRtl ? 'فحص التعارض' : 'Conflict Check'}</span>
          </button>
        )}

        {/* Create Matter Trigger (Lawyer Only) */}
        {currentMode === 'Lawyer' && (
          <button
            onClick={() => setShowModal(true)}
            className="p-2 md:px-4 md:py-2 bg-teal-800 hover:bg-teal-900 border border-teal-700 rounded-xl text-sm font-bold text-white shadow-md shadow-teal-900/10 flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.newIntake}</span>
          </button>
        )}

        {/* Dedicated Case Summary Print Button */}
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('open-print-preview'))}
          className="px-2.5 py-2 bg-teal-950 text-amber-300 hover:bg-teal-900 border border-teal-700/80 rounded-xl text-xs font-bold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0 no-print"
          title={isRtl ? 'معاينة وطباعة تقرير ملخص القضية للمحكمة' : 'Preview & Print Case Summary Report for Court'}
        >
          <Printer className="w-4 h-4 text-amber-400 shrink-0" />
          <span className="hidden md:inline">{isRtl ? 'طباعة القضية' : 'Print Case Summary'}</span>
        </button>

        {/* Global Dark / Light Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          className={`p-2 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
            isDark
              ? 'bg-teal-950 text-amber-300 border-teal-700 hover:bg-teal-900'
              : 'bg-teal-50 text-teal-950 border-teal-200 hover:bg-teal-100 shadow-xs'
          }`}
          title={
            isDark
              ? isRtl
                ? 'التبديل إلى الوضع المضيء (نهار)'
                : 'Switch to Light Mode'
              : isRtl
              ? 'التبديل إلى الوضع الليلي (داكن)'
              : 'Switch to Dark Mode'
          }
        >
          {isDark ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span className="hidden sm:inline text-[11px]">{isRtl ? 'وضع نهار' : 'Light Mode'}</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-teal-800" />
              <span className="hidden sm:inline text-[11px]">{isRtl ? 'وضع ليلي' : 'Dark Mode'}</span>
            </>
          )}
        </button>

        {/* Landing Page Showcase Button */}
        {onShowLandingPage && (
          <button
            onClick={onShowLandingPage}
            className="hidden sm:flex px-3 py-2 bg-teal-950 text-teal-100 hover:bg-teal-900 border border-teal-700/80 rounded-xl text-xs font-bold items-center gap-1.5 shadow-xs transition-all cursor-pointer shrink-0"
            title={isRtl ? 'الصفحة التعريفية للموقع' : 'View Landing Showcase'}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>{isRtl ? 'الصفحة التعريفية' : 'Landing Showcase'}</span>
          </button>
        )}

        {/* Dual-Sided Mode Selector Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200 ml-auto lg:ml-0">
          <button
            onClick={() => onModeChange('Lawyer')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
              currentMode === 'Lawyer'
                ? 'bg-white text-indigo-600 shadow-sm font-extrabold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Shield className="w-3.5 h-3.5" />
            {t.lawyerMode}
          </button>
          <button
            onClick={() => onModeChange('Client')}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer ${
              currentMode === 'Client'
                ? 'bg-white text-amber-600 shadow-sm font-extrabold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            {t.clientMode}
          </button>
        </div>

        {/* User Account & Subscription Badge Dropdown */}
        <div className="relative">
          {user ? (
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl border border-slate-800 flex items-center gap-2 shadow-xs transition-all cursor-pointer shrink-0"
            >
              <div className="w-6 h-6 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-extrabold text-[11px]">
                {user.name.charAt(0)}
              </div>
              <div className="hidden lg:block text-left rtl:text-right rtl:text-left">
                <span className="block text-[11px] font-bold text-white leading-tight truncate max-w-[110px]">
                  {user.name}
                </span>
                <span className="block text-[9px] font-mono text-amber-400 font-bold uppercase">
                  {user.subscriptionTier}
                </span>
              </div>
            </button>
          ) : (
            <button
              onClick={() => setShowAuthModal(true)}
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-xs transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
            >
              <User className="w-3.5 h-3.5" />
              <span>{isRtl ? 'تسجيل الدخول' : 'Sign In'}</span>
            </button>
          )}

          {/* Account Profile Dropdown Menu */}
          {showUserDropdown && user && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowUserDropdown(false)} />
              <div className="absolute right-0 rtl:right-auto rtl:left-0 top-full mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-4 space-y-3 animate-in fade-in duration-150">
                <div className="border-b border-slate-100 pb-3">
                  <h4 className="text-xs font-bold text-slate-900 font-display truncate">{user.name}</h4>
                  <p className="text-[11px] text-slate-500 truncate">{user.email}</p>
                  <p className="text-[10px] text-slate-400 font-mono mt-0.5">{user.firmName} • {user.barAssociationId}</p>
                </div>

                {/* Subscription Badge Card */}
                <div className="bg-slate-900 text-white rounded-xl p-3 space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{isRtl ? 'خطة الاشتراك:' : 'Plan Tier:'}</span>
                    <span className="px-2 py-0.5 bg-amber-400 text-slate-950 font-mono text-[10px] font-extrabold rounded-md uppercase">
                      {user.subscriptionTier}
                    </span>
                  </div>
                  <div className="text-[10px] text-slate-300 flex justify-between">
                    <span>{isRtl ? 'حالة الحساب:' : 'Status:'} {user.planStatus}</span>
                    <span>{isRtl ? 'التجديد:' : 'Renews:'} {user.renewalDate}</span>
                  </div>
                  <button
                    onClick={() => { setShowUserDropdown(false); setShowPaywallModal(true); }}
                    className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>{isRtl ? 'ترقية / إدارة الاشتراك' : 'Manage Subscription'}</span>
                  </button>
                </div>

                {/* Quick Menu Options */}
                <div className="space-y-1 text-xs font-medium text-slate-700 pt-1">
                  <button
                    onClick={() => { setShowUserDropdown(false); setShowConflictModal(true); }}
                    className="w-full text-left rtl:text-right rtl:text-left px-2.5 py-1.5 hover:bg-slate-50 rounded-lg flex items-center gap-2 transition-colors cursor-pointer"
                  >
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <span>{isRtl ? 'فحص تعارض المصالح الأخلاقي' : 'Ethics & Conflict Check'}</span>
                  </button>
                  <button
                    onClick={() => { setShowUserDropdown(false); logout(); }}
                    className="w-full text-left rtl:text-right rtl:text-left px-2.5 py-1.5 hover:bg-rose-50 text-rose-600 rounded-lg flex items-center gap-2 transition-colors cursor-pointer pt-2 border-t border-slate-100"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{isRtl ? 'تسجيل الخروج' : 'Sign Out'}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* NEW MATTER MODAL */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-3xl p-6 max-w-lg w-full border border-slate-200 shadow-2xl flex flex-col gap-4 animate-in fade-in zoom-in duration-200">
            <div>
              <h3 className="text-xl font-bold text-slate-800 font-display">{t.intakeTitle}</h3>
              <p className="text-xs text-slate-500">{t.intakeSub}</p>
            </div>

            <form onSubmit={handleCreateMatter} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t.matterTitle}</label>
                <input
                  type="text"
                  required
                  placeholder={isRtl ? "مثال: تحكيم إنشاءات برج الحمراء" : "e.g. Al-Hamra Tower Construction Arbitration"}
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t.clientName}</label>
                  <input
                    type="text"
                    required
                    placeholder={isRtl ? "مثال: طارق السويدي" : "e.g. Tariq Al-Suwaidi"}
                    value={clientName}
                    onChange={e => setClientName(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t.clientEmail}</label>
                  <input
                    type="email"
                    placeholder="tariq@al-suwaidi.com"
                    value={clientEmail}
                    onChange={e => setClientEmail(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t.jurisdiction}</label>
                  <select
                    value={jurisdiction}
                    onChange={e => setJurisdiction(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-100 focus:outline-none bg-white"
                  >
                    <option value="Dubai Commercial Court">{isRtl ? 'محكمة دبي التجارية' : 'Dubai Commercial Court'}</option>
                    <option value="SCCA Arbitration Center, Riyadh">{isRtl ? 'مركز التحكيم التجاري السعودي، الرياض' : 'SCCA Riyadh'}</option>
                    <option value="Kuwait Family & Estate Court">{isRtl ? 'محكمة الأسرة والتركات الكويتية' : 'Kuwait Corporate Court'}</option>
                    <option value="Abu Dhabi Global Market (ADGM)">{isRtl ? 'سوق أبوظبي العالمي (ADGM)' : 'ADGM Court'}</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t.initialBudget}</label>
                  <input
                    type="number"
                    value={budget}
                    onChange={e => setBudget(Number(e.target.value))}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t.opposingParty}</label>
                  <input
                    type="text"
                    placeholder={isRtl ? "مثال: الفطيم للمقاولات" : "e.g. Al-Futtaim Builders"}
                    value={opposingParty}
                    onChange={e => setOpposingParty(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase mb-1">{t.opposingCounsel}</label>
                  <input
                    type="text"
                    placeholder={isRtl ? "مثال: فريش فيلدز الرياض" : "e.g. Freshfields Riyadh"}
                    value={opposingCounsel}
                    onChange={e => setOpposingCounsel(e.target.value)}
                    className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:ring-2 focus:ring-indigo-100 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-50"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-100 flex items-center gap-1.5 disabled:opacity-50"
                >
                  {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  {t.registerIntake}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </header>

    {/* Global Search Modal - Rendered outside hidden header for full responsiveness */}
    <GlobalSearchModal
      isOpen={showSearchModal}
      onClose={() => setShowSearchModal(false)}
      matters={matters}
      onSelectResult={handleSelectSearchResult}
    />

    {/* Ethics Conflict Check Modal */}
    <ConflictCheckModal
      isOpen={showConflictModal}
      onClose={() => setShowConflictModal(false)}
      matters={matters}
    />

    {/* Authentication Modal (Sign In / Sign Up / Forgot Password) */}
    <AuthModal
      isOpen={showAuthModal}
      onClose={() => setShowAuthModal(false)}
    />

    {/* Subscription Tier Models & Paywall Modal */}
    <SubscriptionPaywallModal
      isOpen={showPaywallModal}
      onClose={() => setShowPaywallModal(false)}
    />
    </>
  );
}

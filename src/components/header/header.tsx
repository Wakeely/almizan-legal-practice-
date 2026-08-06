'use client';

import React, { useState, useEffect } from 'react';
import { Bell, Inbox, FileCheck, Calendar, MessageSquare, Search, Sun, Moon, Plus, ShieldCheck, Languages } from 'lucide-react';
import { Matter } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';
import { useTheme } from '@/components/providers/theme-provider';
import { useAuth } from '@/components/providers/auth-provider';
import { translateStaticText } from '@/lib/i18n';
import GlobalSearchModal from '@/components/search/global-search-modal';
import ConflictCheckModal from '@/components/conflict/conflict-check-modal';
import AuthModal from '@/components/auth/auth-modal';
import ThemeAwareLogo from '@/components/branding/theme-aware-logo';
import { cn } from '@/lib/utils';

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
  currentMode, onModeChange, matters, activeMatterId,
  onActiveMatterChange, onNewMatterCreated, onShowLandingPage,
}: HeaderProps) {
  const { language, setLanguage, t, isRtl } = useLanguage();
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'dark';
  const { isAuthenticated } = useAuth();

  const [showSearch, setShowSearch] = useState(false);
  const [showConflict, setShowConflict] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showNotif, setShowNotif] = useState(false);

  // Notification persistence
  const loadPersisted = (key: string) => { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : []; } catch { return []; } };
  const [readIds, setReadIds] = useState<string[]>(() => loadPersisted('almizan_read_notifications'));
  const [dismissedIds, setDismissedIds] = useState<string[]>(() => loadPersisted('almizan_dismissed_notifications'));
  const persist = (key: string, ids: string[]) => localStorage.setItem(key, JSON.stringify(ids));

  const [notifications, setNotifications] = useState<any[]>([]);
  const activeNotifs = notifications.filter(n => !dismissedIds.includes(n.id));
  const unreadCount = activeNotifs.filter(n => !readIds.includes(n.id)).length;

  // ── Keyboard shortcuts & events ──────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setShowSearch(p => !p); } };
    window.addEventListener('keydown', onKey);
    const onOpenSearch = () => setShowSearch(true);
    window.addEventListener('open-search-modal', onOpenSearch);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-search-modal', onOpenSearch);
    };
  }, []);

  // ── Notifications ────────────────────────────────────────
  const buildNotifications = async () => {
    try {
      const allT: any[] = [], allD: any[] = [], allM: any[] = [];
      await Promise.all(matters.map(async m => {
        try {
          const [tR, dR, mR] = await Promise.all([
            fetch(`/api/matters/${m.id}/tasks`), fetch(`/api/matters/${m.id}/documents`), fetch(`/api/matters/${m.id}/messages`)
          ]);
          if (tR.ok) allT.push(...await tR.json());
          if (dR.ok) allD.push(...await dR.json());
          if (mR.ok) allM.push(...await mR.json());
        } catch { /* skip */ }
      }));
      const list: any[] = [];
      allT.filter(t => t.priority === 'High' && t.status !== 'Completed').forEach(t => list.push({ id: `task-${t.id}`, type: 'deadline', title: t.title, description: t.description || '', date: t.dueDate, matterTitle: matters.find(m => m.id === t.matterId)?.title || '', isUrgent: true, refId: t.id }));
      allD.filter(d => !d.visibleToClient).forEach(d => list.push({ id: `doc-${d.id}`, type: 'document', title: d.name, description: d.uploadedBy, date: new Date(d.uploadedAt).toLocaleDateString(), matterTitle: matters.find(m => m.id === d.matterId)?.title || '', isUrgent: false, refId: d.id }));
      allM.filter(m => m.sender === 'Client').forEach(m => list.push({ id: `msg-${m.id}`, type: 'message', title: m.text, description: matters.find(mt => mt.id === m.matterId)?.clientName || '', date: new Date(m.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' }), matterTitle: matters.find(mt => mt.id === m.matterId)?.title || '', isUrgent: false, refId: m.id }));
      list.sort((a, b) => (a.isUrgent && !b.isUrgent) ? -1 : (!a.isUrgent && b.isUrgent) ? 1 : b.id.localeCompare(a.id));
      setNotifications(list);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    const refresh = () => buildNotifications();
    if (matters.length > 0) {
      // Deferred so the notification state update isn't a synchronous setState
      // within the effect body.
      const t = setTimeout(buildNotifications, 0);
      ['tasks-updated', 'docs-updated', 'messages-updated'].forEach(ev => window.addEventListener(ev, refresh));
      return () => {
        ['tasks-updated', 'docs-updated', 'messages-updated'].forEach(ev => window.removeEventListener(ev, refresh));
        clearTimeout(t);
      };
    }
    ['tasks-updated', 'docs-updated', 'messages-updated'].forEach(ev => window.addEventListener(ev, refresh));
    return () => ['tasks-updated', 'docs-updated', 'messages-updated'].forEach(ev => window.removeEventListener(ev, refresh));
  }, [matters, activeMatterId]);

  const markRead = (id: string) => setReadIds(p => { const n = p.includes(id) ? p : [...p, id]; persist('almizan_read_notifications', n); return n; });
  const markAllRead = () => { const ids = notifications.map(n => n.id); setReadIds(p => { const n = [...new Set([...p, ...ids])]; persist('almizan_read_notifications', n); return n; }); };
  const dismiss = (id: string) => setDismissedIds(p => { const n = p.includes(id) ? p : [...p, id]; persist('almizan_dismissed_notifications', n); return n; });

  const handleSearchResult = (matterId: string, section?: 'documents' | 'tasks') => {
    onActiveMatterChange(matterId);
    if (section) {
      window.dispatchEvent(new CustomEvent('mobile-tab-changed', { detail: section === 'documents' ? 'docs' : 'tasks' }));
      setTimeout(() => { document.getElementById(section === 'documents' ? 'documents-module' : 'tasks-module')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 150);
    }
  };

  const notifIcon = (type: string) => type === 'deadline' ? <Calendar className="w-4 h-4" /> : type === 'document' ? <FileCheck className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />;
  const notifBg = (type: string) => type === 'deadline' ? 'bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-950/30 dark:border-rose-800/30 dark:text-rose-400' : type === 'document' ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-950/30 dark:border-amber-800/30 dark:text-amber-400' : 'bg-secondary text-muted-foreground border-border';
  const notifLabel = (type: string) => type === 'deadline' ? t.urgentDeadline : type === 'document' ? t.pendingApproval : t.clientMessage;
  const iconBtnCls = 'h-8 w-8 rounded-lg bg-accent hover:bg-accent/80 flex items-center justify-center transition-colors';

  return (
    <>
      {/* ── Mobile Header ──────────────────────────────── */}
      <header className="lg:hidden flex items-center justify-between gap-2 bg-card border-b border-border h-14 px-4 sticky top-0 z-30" id="app-header-mobile">
        <ThemeAwareLogo className="h-8 w-auto shrink-0" alt="Al Mizan" />
        <div className="flex items-center gap-1">
          <button onClick={() => setShowSearch(true)} className={iconBtnCls} title={t.globalSearchTitle}><Search className="w-4 h-4" /></button>
          <button onClick={() => setShowNotif(p => !p)} className={cn(iconBtnCls, 'relative')} title={t.notificationsTitle}>
            <Bell className={cn('w-4 h-4', unreadCount > 0 && 'text-primary')} />
            {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-[9px] text-white font-extrabold w-4 h-4 rounded-full flex items-center justify-center border border-card">{unreadCount}</span>}
          </button>
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className={iconBtnCls}>{isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
          <button onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')} className={iconBtnCls} title={t.languageToggle}><Languages className="w-4 h-4" /></button>
        </div>
      </header>

      {/* ── Desktop Header ─────────────────────────────── */}
      <header className="hidden lg:flex items-center justify-between gap-4 bg-card border-b border-border h-14 px-4" id="app-header">
        <div className="shrink-0"><ThemeAwareLogo className="h-9 w-auto" alt="Al Mizan Legal Practice" /></div>

        {/* Centered search trigger */}
        <div className="flex-1 max-w-md mx-auto">
          <button onClick={() => setShowSearch(true)} className="w-full flex items-center gap-2 bg-background border border-border hover:border-primary/50 rounded-lg px-3 h-8 text-sm transition-colors cursor-pointer group" title={t.globalSearchTitle}>
            <Search className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0 stroke-[2.2]" />
            <span className="truncate text-muted-foreground text-xs">{t.globalSearchPlaceholder}</span>
            <kbd className="ml-auto bg-secondary border border-border text-foreground px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0">⌘K</kbd>
          </button>
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {currentMode === 'Lawyer' && (
            <button onClick={() => window.dispatchEvent(new CustomEvent('open-new-matter-modal'))} className="h-8 w-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center transition-colors" title={t.newIntake}><Plus className="w-4 h-4" /></button>
          )}
          {currentMode === 'Lawyer' && (
            <button onClick={() => setShowConflict(true)} className={cn(iconBtnCls, 'text-primary')} title={isRtl ? 'فحص تعارض المصالح' : 'Conflict Check'}><ShieldCheck className="w-4 h-4" /></button>
          )}

          <div className="w-px h-6 bg-border" />

          {/* Notifications */}
          <div className="relative">
            <button onClick={() => setShowNotif(p => !p)} className={cn(iconBtnCls, 'relative')} title={t.notificationsTitle}>
              <Bell className={cn('w-4 h-4', unreadCount > 0 && 'text-primary')} />
              {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-rose-500 text-[9px] text-white font-extrabold w-4 h-4 rounded-full flex items-center justify-center border border-card">{unreadCount}</span>}
            </button>
            {showNotif && (<>
              <div className="fixed inset-0 z-40" onClick={() => setShowNotif(false)} />
              <div className={cn('absolute top-full', isRtl ? 'left-0' : 'right-0', 'mt-2 w-80 bg-card border border-border rounded-xl shadow-xl z-50 p-3 flex flex-col gap-2.5 animate-in fade-in slide-in-from-top-2 duration-150')}>
                <div className="flex justify-between items-center border-b border-border pb-2">
                  <div className="flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold text-foreground">{t.notificationsTitle}</span>
                    {unreadCount > 0 && <span className="bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold">{unreadCount} {t.unreadNotifications}</span>}
                  </div>
                  {unreadCount > 0 && <button onClick={markAllRead} className="text-[10px] text-primary hover:text-primary/80 font-bold">{t.markAllRead}</button>}
                </div>
                <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                  {activeNotifs.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground flex flex-col items-center gap-2"><Inbox className="w-8 h-8" /><p className="text-xs font-semibold">{t.emptyNotifications}</p></div>
                  ) : activeNotifs.map(n => {
                    const unread = !readIds.includes(n.id);
                    return (
                      <div key={n.id} onClick={() => markRead(n.id)} className={cn('p-2.5 rounded-lg border transition-all flex gap-2.5 cursor-pointer relative', unread ? 'bg-primary/5 border-primary/20' : 'bg-accent/50 border-border hover:bg-accent')}>
                        {unread && <span className={cn('absolute top-0 bottom-0 w-0.5 bg-primary rounded-full', isRtl ? 'right-0' : 'left-0')} />}
                        <div className={cn('w-7 h-7 rounded-lg border flex items-center justify-center shrink-0', notifBg(n.type))}>{notifIcon(n.type)}</div>
                        <div className="flex-grow min-w-0">
                          <div className="flex justify-between items-start gap-1">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{notifLabel(n.type)}</span>
                            <span className="text-[9px] font-mono text-muted-foreground whitespace-nowrap">{n.date}</span>
                          </div>
                          <h5 className="text-xs font-bold text-foreground leading-snug mt-0.5 truncate">{translateStaticText(n.title, isRtl)}</h5>
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{translateStaticText(n.matterTitle, isRtl)}</p>
                          <div className="flex justify-end mt-1.5">
                            <button onClick={e => { e.stopPropagation(); dismiss(n.id); }} className="px-1.5 py-0.5 bg-secondary hover:bg-secondary/80 text-muted-foreground rounded-md text-[9px] font-bold transition-colors">{isRtl ? 'إخفاء' : 'Dismiss'}</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </>)}
          </div>

          <div className="w-px h-6 bg-border" />
          <button onClick={() => setTheme(isDark ? 'light' : 'dark')} className={cn(iconBtnCls, isDark && 'bg-secondary text-amber-400 hover:bg-secondary/80')}>{isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
          <button onClick={() => setLanguage(language === 'ar' ? 'en' : 'ar')} className={iconBtnCls} title={t.languageToggle}><Languages className="w-4 h-4" /></button>
          {!isAuthenticated && (
            <button onClick={() => setShowAuth(true)} className="h-8 px-3 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-bold flex items-center gap-1.5 transition-colors">{isRtl ? 'تسجيل الدخول' : 'Sign In'}</button>
          )}
        </div>
      </header>

      {/* ── Modals (external components, only trigger buttons in header) ── */}
      <GlobalSearchModal isOpen={showSearch} onClose={() => setShowSearch(false)} matters={matters} onSelectResult={handleSearchResult} />
      <ConflictCheckModal isOpen={showConflict} onClose={() => setShowConflict(false)} matters={matters} />
      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </>
  );
}

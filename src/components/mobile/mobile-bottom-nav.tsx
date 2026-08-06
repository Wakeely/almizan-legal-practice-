'use client';

import React, { useState } from 'react';
import {
  Plus,
  Bell,
  Search,
  Menu,
  Landmark,
} from 'lucide-react';
import { useLanguage } from '@/components/providers/language-provider';
import type { Matter } from '@/lib/types';
import { cn } from '@/lib/utils';
import {
  NAV_ITEMS,
  getNavItem,
  type WorkspaceView,
} from '@/lib/navigation';

interface MobileBottomNavProps {
  currentMode: 'Lawyer' | 'Client';
  onModeChange: (mode: 'Lawyer' | 'Client') => void;
  activeView: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  unreadNotificationsCount: number;
  onOpenNotifications: () => void;
  onOpenSearch?: () => void;
  onOpenNewMatterModal: () => void;
  matters: Matter[];
  activeMatterId: string;
  onActiveMatterChange: (id: string) => void;
}

/* ------------------------------------------------------------------ */
/*  4 PRIMARY TABS — derived from the single source of truth           */
/* ------------------------------------------------------------------ */
const PRIMARY_TAB_IDS: WorkspaceView[] = ['overview', 'matter', 'documents', 'ai'];
const PRIMARY_TABS = PRIMARY_TAB_IDS.map(getNavItem);

/* The "More" drawer shows EVERY main navigation item. */
const MORE_SECTIONS = NAV_ITEMS;

export default function MobileBottomNav({
  currentMode,
  onModeChange,
  activeView,
  onViewChange,
  unreadNotificationsCount,
  onOpenNotifications,
  onOpenSearch,
  onOpenNewMatterModal,
  matters,
  activeMatterId,
  onActiveMatterChange,
}: MobileBottomNavProps) {
  const { isRtl } = useLanguage();
  const [showMoreDrawer, setShowMoreDrawer] = useState(false);
  const [showMatterPicker, setShowMatterPicker] = useState(false);

  const activeMatter = matters.find((m) => m.id === activeMatterId);

  const selectView = (view: WorkspaceView) => {
    onViewChange(view);
    setShowMoreDrawer(false);
  };

  return (
    <>
      {/* ── MOBILE TOP BAR ── */}
      <div className="lg:hidden sticky top-0 z-40 bg-card/95 backdrop-blur-sm border-b border-border">
        <div className="flex items-center justify-between px-3 h-12">
          {/* Left: Logo placeholder + matter title */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              onClick={() => setShowMatterPicker(!showMatterPicker)}
              className="flex items-center gap-1.5 min-w-0 cursor-pointer"
            >
              <Landmark className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold truncate max-w-[140px]">
                {activeMatter?.title || (isRtl ? 'اختر قضية' : 'Select matter')}
              </span>
            </button>
          </div>

          {/* Right: Action icons */}
          <div className="flex items-center gap-1 shrink-0">
            {onOpenSearch && (
              <button
                onClick={onOpenSearch}
                className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors cursor-pointer"
              >
                <Search className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={onOpenNotifications}
              className="h-8 w-8 flex items-center justify-center rounded-lg text-muted-foreground hover:bg-accent transition-colors cursor-pointer relative"
            >
              <Bell className="w-4 h-4" />
              {unreadNotificationsCount > 0 && (
                <span className="absolute top-0.5 right-0.5 w-2.5 h-2.5 bg-destructive rounded-full border border-card" />
              )}
            </button>
          </div>
        </div>

        {/* Matter picker dropdown */}
        {showMatterPicker && (
          <div className="border-t border-border bg-card max-h-48 overflow-y-auto">
            {matters.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  onActiveMatterChange(m.id);
                  setShowMatterPicker(false);
                }}
                className={cn(
                  'w-full text-left rtl:text-right px-4 py-2.5 text-xs hover:bg-accent transition-colors cursor-pointer',
                  m.id === activeMatterId && 'bg-primary/10 text-primary font-semibold'
                )}
              >
                <div className="font-semibold truncate">{m.title}</div>
                <div className="text-muted-foreground mt-0.5">{m.clientName}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── BOTTOM TAB BAR ── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/95 backdrop-blur-md border-t border-border safe-area-bottom">
        <div className="flex items-center justify-around h-16 px-2">
          {PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeView === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => selectView(tab.id)}
                className={cn(
                  'flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-xl transition-colors cursor-pointer min-h-[44px]',
                  isActive ? 'text-primary' : 'text-muted-foreground'
                )}
              >
                <Icon className={cn('w-5 h-5', isActive && 'text-primary')} />
                <span className="text-[10px] font-semibold">{isRtl ? tab.labelAr : tab.labelEn}</span>
              </button>
            );
          })}

          {/* More button */}
          <button
            onClick={() => setShowMoreDrawer(true)}
            className={cn(
              'flex flex-col items-center justify-center gap-1 flex-1 py-2 rounded-xl transition-colors cursor-pointer min-h-[44px]',
              !PRIMARY_TABS.some((t) => t.id === activeView) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Menu className="w-5 h-5" />
            <span className="text-[10px] font-semibold">{isRtl ? 'المزيد' : 'More'}</span>
          </button>
        </div>
      </div>

      {/* ── MORE DRAWER (slide-up sheet) — lists EVERY main tool ── */}
      {showMoreDrawer && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowMoreDrawer(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl border-t border-border p-4 pb-8 animate-in slide-in-from-bottom duration-200 max-h-[80vh] overflow-y-auto">
            <div className="w-10 h-1 bg-muted rounded-full mx-auto mb-4" />
            <h3 className="text-sm font-bold mb-3">
              {isRtl ? 'جميع الأقسام' : 'All Sections'}
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {MORE_SECTIONS.map((section) => {
                const Icon = section.icon;
                const isActive = activeView === section.id;
                return (
                  <button
                    key={section.id}
                    onClick={() => selectView(section.id)}
                    className={cn(
                      'flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-accent transition-colors cursor-pointer',
                      isActive && 'bg-primary/10'
                    )}
                  >
                    <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', isActive ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary')}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[10px] font-semibold text-center leading-tight">
                      {isRtl ? section.labelAr : section.labelEn}
                    </span>
                  </button>
                );
              })}

              {/* New Matter button in more drawer */}
              <button
                onClick={() => {
                  onOpenNewMatterModal();
                  setShowMoreDrawer(false);
                }}
                className="flex flex-col items-center gap-1.5 p-3 rounded-xl hover:bg-accent transition-colors cursor-pointer"
              >
                <div className="w-10 h-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-semibold text-center leading-tight">
                  {isRtl ? 'قضية جديدة' : 'New'}
                </span>
              </button>
            </div>

            {/* Mode toggle at bottom */}
            <div className="mt-4 pt-3 border-t border-border">
              <div className="flex rounded-lg bg-muted p-0.5">
                <button
                  onClick={() => { onModeChange('Lawyer'); setShowMoreDrawer(false); }}
                  className={cn(
                    'flex-1 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer',
                    currentMode === 'Lawyer'
                      ? 'bg-card text-primary shadow-sm'
                      : 'text-muted-foreground'
                  )}
                >
                  {isRtl ? 'المحامي' : 'Lawyer'}
                </button>
                <button
                  onClick={() => { onModeChange('Client'); setShowMoreDrawer(false); }}
                  className={cn(
                    'flex-1 py-2 text-xs font-semibold rounded-md transition-all cursor-pointer',
                    currentMode === 'Client'
                      ? 'bg-card text-primary shadow-sm'
                      : 'text-muted-foreground'
                  )}
                >
                  {isRtl ? 'الموكل' : 'Client'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

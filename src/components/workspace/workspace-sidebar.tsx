'use client';

import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/components/providers/language-provider';
import type { Matter, UserProfile } from '@/lib/types';
import {
  Briefcase,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LogOut,
  User,
  Scale,
  Users,
} from 'lucide-react';
import {
  NAV_SECTIONS,
  getNavItem,
  type WorkspaceView,
} from '@/lib/navigation';

// Re-export the shared view type for compatibility with existing imports.
export type { WorkspaceView } from '@/lib/navigation';

interface WorkspaceSidebarProps {
  activeView: WorkspaceView;
  onViewChange: (view: WorkspaceView) => void;
  matters: Matter[];
  activeMatterId: string;
  onActiveMatterChange: (id: string) => void;
  user: UserProfile | null;
  onLogout: () => void;
  currentMode: 'Lawyer' | 'Client';
  onModeChange: (mode: 'Lawyer' | 'Client') => void;
}

/* ------------------------------------------------------------------ */
/*  SIDEBAR COMPONENT                                                  */
/* ------------------------------------------------------------------ */

export default function WorkspaceSidebar({
  activeView,
  onViewChange,
  matters,
  activeMatterId,
  onActiveMatterChange,
  user,
  onLogout,
  currentMode,
  onModeChange,
}: WorkspaceSidebarProps) {
  const { isRtl } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [matterDropdownOpen, setMatterDropdownOpen] = useState(false);

  const activeMatter = matters.find((m) => m.id === activeMatterId);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  return (
    <aside
      className={cn(
        'hidden md:flex flex-col bg-card border-r border-border transition-all duration-200 h-full overflow-hidden',
        collapsed ? 'w-[60px]' : 'w-[240px]'
      )}
    >
      {/* ── MATTER SELECTOR (top) ── */}
      <div className={cn('p-3 border-b border-border', collapsed && 'px-2')}>
        {collapsed ? (
          <div className="flex items-center justify-center">
            <button
              onClick={() => setCollapsed(false)}
              className="p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer"
              title={activeMatter?.title || (isRtl ? 'لا توجد قضية' : 'No matter')}
            >
              <Briefcase className="w-4 h-4 text-primary" />
            </button>
          </div>
        ) : (
          <div className="relative">
            <button
              onClick={() => setMatterDropdownOpen(!matterDropdownOpen)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-accent/50 hover:bg-accent transition-colors cursor-pointer text-left rtl:text-right"
            >
              <Briefcase className="w-4 h-4 text-primary shrink-0" />
              <span className="flex-1 text-xs font-semibold truncate">
                {activeMatter?.title || (isRtl ? 'اختر قضية' : 'Select a matter')}
              </span>
              <ChevronDown
                className={cn(
                  'w-3.5 h-3.5 text-muted-foreground transition-transform shrink-0',
                  matterDropdownOpen && 'rotate-180'
                )}
              />
            </button>

            {/* Dropdown */}
            {matterDropdownOpen && (
              <div className="absolute top-full mt-1 inset-x-0 z-50 bg-popover border border-border rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {matters.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      onActiveMatterChange(m.id);
                      setMatterDropdownOpen(false);
                    }}
                    className={cn(
                      'w-full px-3 py-2 text-left rtl:text-right text-xs hover:bg-accent transition-colors cursor-pointer',
                      m.id === activeMatterId && 'bg-primary/10 text-primary font-semibold'
                    )}
                  >
                    <div className="font-semibold truncate">{m.title}</div>
                    <div className="text-muted-foreground mt-0.5 truncate">{m.clientName}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODE TOGGLE ── */}
      <div className={cn('px-3 py-2 border-b border-border', collapsed && 'px-2')}>
        {collapsed ? (
          <button
            onClick={() => onModeChange(currentMode === 'Lawyer' ? 'Client' : 'Lawyer')}
            className="p-2 rounded-lg hover:bg-accent transition-colors cursor-pointer mx-auto"
            title={currentMode}
          >
            {currentMode === 'Lawyer' ? (
              <Scale className="w-4 h-4 text-primary" />
            ) : (
              <Users className="w-4 h-4 text-primary" />
            )}
          </button>
        ) : (
          <div className="flex rounded-lg bg-muted p-0.5">
            <button
              onClick={() => onModeChange('Lawyer')}
              className={cn(
                'flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all cursor-pointer',
                currentMode === 'Lawyer'
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {isRtl ? 'المحامي' : 'Lawyer'}
            </button>
            <button
              onClick={() => onModeChange('Client')}
              className={cn(
                'flex-1 py-1.5 text-[11px] font-semibold rounded-md transition-all cursor-pointer',
                currentMode === 'Client'
                  ? 'bg-card text-primary shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {isRtl ? 'الموكل' : 'Client'}
            </button>
          </div>
        )}
      </div>

      {/* ── NAV SECTIONS ── */}
      <nav className="flex-1 overflow-y-auto py-2" aria-label="Workspace navigation">
        {NAV_SECTIONS.map((section) => {
          const isCollapsed = collapsedSections.has(section.id);
          const items = section.itemIds.map(getNavItem);
          return (
            <div key={section.id} className="mb-1">
              {/* Section header */}
              {!collapsed && (
                <button
                  onClick={() => toggleSection(section.id)}
                  className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <span>{isRtl ? section.labelAr : section.labelEn}</span>
                  <ChevronDown
                    className={cn(
                      'w-3 h-3 transition-transform',
                      isCollapsed && '-rotate-90'
                    )}
                  />
                </button>
              )}

              {/* Section items — every item has equal visual weight */}
              {!isCollapsed && (
                <div className="space-y-0.5 px-2">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onViewChange(item.id)}
                        className={cn(
                          'w-full flex items-center gap-2.5 rounded-lg px-3 py-2 transition-all cursor-pointer',
                          isActive
                            ? 'bg-primary/10 text-primary font-semibold'
                            : 'text-foreground hover:bg-accent hover:text-foreground font-semibold text-xs',
                          collapsed && 'justify-center px-0'
                        )}
                        title={collapsed ? (isRtl ? item.labelAr : item.labelEn) : undefined}
                      >
                        <Icon className={cn('w-4 h-4 shrink-0', isActive ? 'text-primary' : 'text-muted-foreground')} />
                        {!collapsed && (
                          <span>{isRtl ? item.labelAr : item.labelEn}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Collapsed: show icons */}
              {collapsed && !isCollapsed && (
                <div className="space-y-0.5 px-2">
                  {items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeView === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => onViewChange(item.id)}
                        className={cn(
                          'w-full flex items-center justify-center rounded-lg py-2 transition-all cursor-pointer',
                          isActive
                            ? 'bg-primary/10 text-primary'
                            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                        )}
                      >
                        <Icon className={cn('w-4 h-4', isActive ? 'text-primary' : '')} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* ── USER INFO + LOGOUT (bottom) ── */}
      <div className={cn('border-t border-border p-3', collapsed && 'px-2')}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <button
              onClick={onLogout}
              className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              title={isRtl ? 'تسجيل الخروج' : 'Logout'}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <User className="w-4 h-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold truncate">
                {user?.name || (isRtl ? 'المستخدم' : 'User')}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                {user?.role || 'Managing Partner'}
              </div>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
              title={isRtl ? 'تسجيل الخروج' : 'Logout'}
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* ── COLLAPSE TOGGLE ── */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-1/2 -translate-y-1/2 border border-border bg-card rounded-full p-0.5 hidden lg:flex items-center justify-center hover:bg-accent transition-colors cursor-pointer z-10"
        style={{ [isRtl ? 'right' : 'left']: '-12px' }}
      >
        {collapsed ? (
          isRtl ? <ChevronLeft className="w-3 h-3 text-muted-foreground" /> : <ChevronRight className="w-3 h-3 text-muted-foreground" />
        ) : (
          isRtl ? <ChevronRight className="w-3 h-3 text-muted-foreground" /> : <ChevronLeft className="w-3 h-3 text-muted-foreground" />
        )}
      </button>
    </aside>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import {
  Calendar as CalendarIcon,
  Plus,
  Clock,
  MapPin,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Filter,
  Users,
  Scale,
  Sparkles,
  ExternalLink,
  CalendarCheck,
  Building2,
  ShieldAlert,
  Trash2,
  Landmark
} from 'lucide-react';
import { Matter, CalendarEvent, Task, TimelineEvent } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';
import { translateStaticText } from '@/lib/i18n';
import { saveItemsToOfflineStore, getByMatterIdFromOfflineStore, STORES } from '@/lib/offline-storage';
import CourtRulesCalendaringModule from '@/components/court-rules/court-rules-calendaring-module';

interface CalendarModuleProps {
  matterId: string;
  matters: Matter[];
}

export default function CalendarModule({ matterId, matters }: CalendarModuleProps) {
  const { isRtl, language } = useLanguage();
  const activeMatter = matters.find((m) => m.id === matterId) || matters[0];

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  const [viewMode, setViewMode] = useState<'month' | 'agenda' | 'rules'>('month');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  
  // Date states for Month Grid
  const [currentDate, setCurrentDate] = useState<Date>(new Date(2026, 6, 1)); // Default July/August 2026

  // New Event Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState<'Hearing' | 'Court Deadline' | 'Client Meeting' | 'Filing' | 'Arbitration'>('Hearing');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newTime, setNewTime] = useState('10:00 AM');
  const [newLocation, setNewLocation] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [syncToGoogleCheck, setSyncToGoogleCheck] = useState(true);
  const [creating, setCreating] = useState(false);

  // Auto-sync alert toast
  const [syncToast, setSyncToast] = useState<string | null>(null);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      if (!navigator.onLine) {
        throw new Error('Offline');
      }
      const res = await fetch(`/api/matters/${matterId}/calendar`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
        // Phase 1.4: write-back to IndexedDB so calendar survives offline refresh.
        if (Array.isArray(data) && data.length > 0) {
          await saveItemsToOfflineStore(STORES.CALENDAR_EVENTS, data);
        }
      } else {
        throw new Error('API Error');
      }
    } catch (err) {
      console.warn('Loading calendar events from IndexedDB cache:', err);
      const cached = await getByMatterIdFromOfflineStore<CalendarEvent>(STORES.CALENDAR_EVENTS, matterId);
      if (cached && cached.length > 0) {
        setEvents(cached);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
  }, [matterId]);

  const handleSyncGoogleAll = async () => {
    setSyncingAll(true);
    try {
      const res = await fetch('/api/calendar/sync-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matterId })
      });
      if (res.ok) {
        const data = await res.json();
        setSyncToast(
          isRtl
            ? `تمت مزامنة ${data.syncedCount || events.length} موعد وقضية مع تقويم Google بنجاح!`
            : `Synced ${data.syncedCount || events.length} court dates with Google Calendar!`
        );
        fetchEvents();
        setTimeout(() => setSyncToast(null), 4000);
      }
    } catch (err) {
      console.error('Failed to sync all with Google Calendar:', err);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleSyncSingleEvent = async (eventId: string) => {
    try {
      const res = await fetch('/api/calendar/sync-google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matterId, eventId })
      });
      if (res.ok) {
        setEvents((prev) =>
          prev.map((e) => (e.id === eventId ? { ...e, syncedToGoogleCalendar: true } : e))
        );
        setSyncToast(
          isRtl
            ? 'تمت إضافة الجلسة إلى Google Calendar'
            : 'Event successfully added to Google Calendar'
        );
        setTimeout(() => setSyncToast(null), 3000);
      }
    } catch (err) {
      console.error('Error syncing single event:', err);
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setCreating(true);
    try {
      const res = await fetch('/api/calendar/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matterId,
          title: newTitle,
          category: newCategory,
          startDate: newDate,
          time: newTime,
          location: newLocation || (activeMatter ? activeMatter.court : ''),
          description: newDescription,
          syncToGoogle: syncToGoogleCheck
        })
      });

      if (res.ok) {
        setShowAddModal(false);
        setNewTitle('');
        setNewDescription('');
        setNewLocation('');
        fetchEvents();
      }
    } catch (err) {
      console.error('Error creating calendar event:', err);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteEvent = async (id: string) => {
    try {
      const res = await fetch(`/api/calendar/events/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEvents((prev) => prev.filter((e) => e.id !== id));
      }
    } catch (err) {
      console.error('Error deleting calendar event:', err);
    }
  };

  // Helper for Category Colors
  const getCategoryBadge = (cat: string) => {
    switch (cat) {
      case 'Hearing':
        return 'bg-teal-100 text-teal-950 border-teal-300 font-extrabold';
      case 'Court Deadline':
        return 'bg-rose-100 text-rose-950 border-rose-300 font-extrabold';
      case 'Client Meeting':
        return 'bg-amber-100 text-amber-950 border-amber-300 font-extrabold';
      case 'Filing':
        return 'bg-emerald-100 text-emerald-950 border-emerald-300 font-extrabold';
      case 'Arbitration':
        return 'bg-cyan-100 text-cyan-950 border-cyan-300 font-extrabold';
      default:
        return 'bg-muted text-foreground border-border font-bold';
    }
  };

  // Month rendering math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const monthNamesEn = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const monthNamesAr = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];

  const filteredEvents = filterCategory === 'all' ? events : events.filter((e) => e.category === filterCategory);

  return (
    <div className="space-y-6 font-sans text-foreground pb-12">
      
      {/* Toast alert message */}
      {syncToast && (
        <div className="fixed top-20 right-4 z-50 bg-card border border-border text-foreground px-5 py-3.5 rounded-xl shadow-2xl flex items-center gap-3 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-bold">{syncToast}</span>
        </div>
      )}

      {/* Top Header Card */}
      <div className="bg-card border border-border rounded-xl p-4 md:p-5 shadow-sm relative overflow-hidden text-foreground">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-xs font-bold">
              <CalendarCheck className="w-3.5 h-3.5 text-primary" />
              <span>{isRtl ? 'تقويم الجلسات والمواعيد القضائية' : 'Court Calendar & Schedule Engine'}</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-foreground font-display">
              {isRtl ? 'التقويم القضائي ومزامنة Google Calendar' : 'Legal Calendar & Hearing Schedule'}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground font-medium">
              {activeMatter ? translateStaticText(activeMatter.title, isRtl) : (isRtl ? 'جميع القضايا' : 'All Matters')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Google Calendar Sync Action */}
            <button
              onClick={handleSyncGoogleAll}
              disabled={syncingAll}
              className="px-4 py-2.5 bg-secondary text-secondary-foreground font-bold text-xs rounded-lg border border-border flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
            >
              {syncingAll ? (
                <RefreshCw className="w-4 h-4 animate-spin text-primary" />
              ) : (
                <CalendarIcon className="w-4 h-4 text-primary" />
              )}
              <span>
                {isRtl
                  ? 'مزامنة مع Google Calendar'
                  : 'Sync Google Calendar'}
              </span>
            </button>

            {/* Add Event Button */}
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-lg border border-primary/30 flex items-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>{isRtl ? 'إضافة موعد / جلسة' : 'Add Court Date'}</span>
            </button>
          </div>
        </div>

        {/* Statute of Limitations Alert Box for Active Matter */}
        {activeMatter?.statuteOfLimitations && (
          <div className="mt-4 p-3.5 bg-destructive/10 rounded-xl border border-destructive/30 flex items-center justify-between gap-3 text-xs text-destructive">
            <div className="flex items-center gap-2.5 text-destructive">
              <ShieldAlert className="w-4 h-4 text-rose-300 shrink-0" />
              <span>
                <strong className="text-white">{isRtl ? 'تاريخ تقادم القضية:' : 'Statute of Limitations:'}</strong>{' '}
                {activeMatter.statuteOfLimitations} ({activeMatter.court || 'Court'})
              </span>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider bg-destructive/20 text-destructive border border-destructive/30 px-2.5 py-1 rounded-md shrink-0">
              {isRtl ? 'تاريخ حرج' : 'Critical Date'}
            </span>
          </div>
        )}
      </div>

      {/* View Switcher & Category Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-3 rounded-xl border border-border shadow-sm">
        
        {/* Category Pill Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          {['all', 'Hearing', 'Court Deadline', 'Client Meeting', 'Filing', 'Arbitration'].map((cat) => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 text-xs font-extrabold rounded-xl border transition-all cursor-pointer whitespace-nowrap ${
                filterCategory === cat
                  ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                  : 'bg-background text-foreground border-border hover:bg-accent hover:border-primary'
              }`}
            >
              {cat === 'all'
                ? isRtl
                  ? 'الكل'
                  : 'All Categories'
                : cat}
            </button>
          ))}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
          <div className="bg-muted p-1 rounded-xl border border-border flex items-center gap-1">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                viewMode === 'month' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isRtl ? 'شهري' : 'Month'}
            </button>
            <button
              onClick={() => setViewMode('agenda')}
              className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer ${
                viewMode === 'agenda' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {isRtl ? 'جدول المواعيد' : 'Agenda'}
            </button>
            <button
              onClick={() => setViewMode('rules')}
              className={`px-3.5 py-1.5 text-xs font-extrabold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'rules' ? 'bg-primary text-primary-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Scale className="w-3.5 h-3.5 text-primary-foreground" />
              {isRtl ? 'حاسبة المهل القضائية' : 'Court Rules Calculator'}
            </button>
          </div>
        </div>
      </div>

      {/* Main Content View */}
      {viewMode === 'rules' ? (
        <CourtRulesCalendaringModule activeMatter={activeMatter} onDeadlinesAdded={fetchEvents} />
      ) : viewMode === 'month' ? (
        /* ================= MONTH GRID VIEW ================= */
        <div className="bg-card border border-border rounded-xl p-4 md:p-5 shadow-sm space-y-4">
          
          {/* Calendar Month Navigation Header */}
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <h3 className="text-base sm:text-lg font-black text-foreground font-display flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              <span>
                {isRtl ? monthNamesAr[month] : monthNamesEn[month]} {year}
              </span>
            </h3>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentDate(new Date(year, month - 1, 1))}
                className="p-2 bg-accent hover:bg-primary/15 text-primary rounded-lg border border-primary transition-all cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setCurrentDate(new Date())}
                className="px-3 py-1.5 bg-accent hover:bg-primary/15 text-primary text-xs font-bold rounded-lg border border-primary transition-all cursor-pointer"
              >
                {isRtl ? 'اليوم' : 'Today'}
              </button>
              <button
                onClick={() => setCurrentDate(new Date(year, month + 1, 1))}
                className="p-2 bg-accent hover:bg-primary/15 text-primary rounded-lg border border-primary transition-all cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Weekday Names */}
          <div className="grid grid-cols-7 gap-1 text-center font-extrabold text-xs text-muted-foreground pb-2 border-b border-border">
            {isRtl
              ? ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
              : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']}
          </div>

          {/* Calendar Days Grid */}
          <div className="grid grid-cols-7 gap-1.5">
            {/* Empty cells before month start */}
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="h-24 sm:h-28 bg-background/50 rounded-xl border border-border" />
            ))}

            {/* Days of the month */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
              
              // Filter events for this day
              const dayEvents = filteredEvents.filter((e) => e.startDate === dateStr);
              const isToday =
                new Date().getFullYear() === year &&
                new Date().getMonth() === month &&
                new Date().getDate() === dayNum;

              return (
                <div
                  key={`day-${dayNum}`}
                  className={`h-24 sm:h-28 p-1.5 sm:p-2 rounded-xl border flex flex-col justify-between transition-all ${
                    isToday
                      ? 'bg-primary/10 border-2 border-primary shadow-xs'
                      : 'bg-card border-border hover:border-primary'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-black w-6 h-6 rounded-full flex items-center justify-center ${
                        isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                      }`}
                    >
                      {dayNum}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="w-2 h-2 rounded-full bg-teal-600 animate-pulse" />
                    )}
                  </div>

                  {/* Render day events */}
                  <div className="space-y-1 overflow-y-auto scrollbar-none max-h-16">
                    {dayEvents.map((ev) => (
                      <div
                        key={ev.id}
                        onClick={() => handleSyncSingleEvent(ev.id)}
                        className={`text-[10px] p-1 rounded-lg border leading-tight truncate cursor-pointer transition-transform hover:scale-102 shadow-2xs ${getCategoryBadge(
                          ev.category
                        )}`}
                        title={`${ev.title} (${ev.time || ''}) - Click to sync with Google Calendar`}
                      >
                        <div className="font-extrabold truncate">{ev.title}</div>
                        {ev.time && <div className="text-[9px] opacity-90 font-mono">{ev.time}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* ================= AGENDA LIST VIEW ================= */
        <div className="space-y-3">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 bg-card border border-border rounded-xl space-y-3 shadow-sm">
              <CalendarIcon className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground font-bold">
                {isRtl ? 'لا توجد مواعيد مضافة في هذه الفئة' : 'No calendar events found.'}
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold rounded-lg shadow-sm cursor-pointer"
              >
                {isRtl ? '+ إضافة جلسة جديدة' : '+ Add Event'}
              </button>
            </div>
          ) : (
            filteredEvents.map((ev) => (
              <div
                key={ev.id}
                className="p-4 sm:p-5 bg-card border border-border hover:border-primary rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-all shadow-xs"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/30 flex flex-col items-center justify-center shrink-0 text-primary font-black">
                    <span className="text-[10px] font-extrabold text-primary uppercase">
                      {new Date(ev.startDate).toLocaleString('default', { month: 'short' })}
                    </span>
                    <span className="text-sm font-black text-primary">
                      {new Date(ev.startDate).getDate()}
                    </span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full border ${getCategoryBadge(ev.category)}`}>
                        {ev.category}
                      </span>
                      {ev.syncedToGoogleCalendar && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                          <span>{isRtl ? 'مسنّد إلى Google' : 'Google Synced'}</span>
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm sm:text-base font-extrabold text-foreground">{ev.title}</h4>
                    {ev.description && (
                      <p className="text-xs text-muted-foreground font-normal leading-relaxed">{ev.description}</p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 flex-wrap">
                      {ev.time && (
                        <span className="flex items-center gap-1 text-foreground font-extrabold">
                          <Clock className="w-3.5 h-3.5 text-primary" />
                          <span>{ev.time}</span>
                        </span>
                      )}
                      {ev.location && (
                        <span className="flex items-center gap-1 text-foreground font-semibold">
                          <MapPin className="w-3.5 h-3.5 text-primary" />
                          <span>{ev.location}</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center pt-2 sm:pt-0 border-t sm:border-t-0 border-border w-full sm:w-auto justify-end">
                  {!ev.syncedToGoogleCalendar && (
                    <button
                      onClick={() => handleSyncSingleEvent(ev.id)}
                      className="px-3.5 py-2 bg-accent hover:bg-primary/15 text-primary text-xs font-bold rounded-lg border border-primary flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    >
                      <CalendarIcon className="w-3.5 h-3.5 text-primary" />
                      <span>{isRtl ? 'مزامنة Google' : 'Sync Google'}</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleDeleteEvent(ev.id)}
                    className="p-2 text-muted-foreground hover:text-rose-600 bg-background hover:bg-rose-50 rounded-xl border border-border transition-colors cursor-pointer"
                    title={isRtl ? 'حذف الموعد' : 'Delete event'}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ================= NEW EVENT CREATION MODAL ================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-xl w-full max-w-lg p-6 text-foreground shadow-2xl relative overflow-hidden font-sans space-y-5">
            
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-center text-primary">
                  <CalendarIcon className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-foreground font-display">
                    {isRtl ? 'إضافة موعد أو جلسة محاكمة' : 'Schedule Court Date / Hearing'}
                  </h3>
                  <p className="text-xs text-muted-foreground font-semibold">
                    {activeMatter ? translateStaticText(activeMatter.title, isRtl) : (isRtl ? 'إضافة موعد' : 'Add event')}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowAddModal(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-xl bg-muted cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateEvent} className="space-y-4">
              
              {/* Event Title */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">
                  {isRtl ? 'عنوان الجلسة / الموعد *' : 'Event / Hearing Title *'}
                </label>
                <input
                  type="text"
                  required
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder={isRtl ? 'مثال: جلسة المرافعة الشفهية الأولى' : 'e.g., First Oral Pleading Hearing'}
                  className="w-full bg-background border border-border focus:border-teal-500 rounded-xl px-3.5 py-2.5 text-xs text-foreground font-semibold placeholder-slate-400 focus:outline-hidden"
                />
              </div>

              {/* Category Selector */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">
                  {isRtl ? 'تصنيف الموعد *' : 'Category *'}
                </label>
                <select
                  value={newCategory}
                  onChange={(e: any) => setNewCategory(e.target.value)}
                  className="w-full bg-background border border-border text-xs text-foreground font-semibold rounded-xl px-3.5 py-2.5 focus:outline-hidden cursor-pointer"
                >
                  <option value="Hearing">{isRtl ? 'جلسة محاكمة (Hearing)' : 'Hearing'}</option>
                  <option value="Court Deadline">{isRtl ? 'موعد تقديم لائحة (Court Deadline)' : 'Court Deadline'}</option>
                  <option value="Client Meeting">{isRtl ? 'اجتماع موكل (Client Meeting)' : 'Client Meeting'}</option>
                  <option value="Filing">{isRtl ? 'إيداع مستندات (Filing)' : 'Filing'}</option>
                  <option value="Arbitration">{isRtl ? 'جلسة تحكيم (Arbitration)' : 'Arbitration'}</option>
                </select>
              </div>

              {/* Date & Time Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    {isRtl ? 'التاريخ *' : 'Date *'}
                  </label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-foreground">
                    {isRtl ? 'الوقت' : 'Time'}
                  </label>
                  <input
                    type="text"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    placeholder="10:00 AM"
                    className="w-full bg-background border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
                  />
                </div>
              </div>

              {/* Location */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">
                  {isRtl ? 'المكان / القاعة' : 'Location / Court Room'}
                </label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  placeholder={activeMatter ? activeMatter.court : 'Court Room / Zoom'}
                  className="w-full bg-background border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
                />
              </div>

              {/* Description */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">
                  {isRtl ? 'ملاحظات / أهداف الجلسة' : 'Description / Prep Notes'}
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder={isRtl ? 'تفاصيل المرفقات ومذكرات المرافعة المطلوب تحضيرها' : 'Notes for counsel or trial strategy'}
                  className="w-full bg-background border border-border rounded-xl px-3.5 py-2 text-xs text-foreground font-semibold focus:outline-hidden"
                />
              </div>

              {/* Toggle Sync with Google Calendar */}
              <div className="p-3 bg-accent rounded-xl border border-primary/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4 text-primary" />
                  <span className="text-xs font-bold text-primary">
                    {isRtl ? 'مزامنة تلقائية مع Google Calendar' : 'Auto-sync to Google Calendar'}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={syncToGoogleCheck}
                  onChange={(e) => setSyncToGoogleCheck(e.target.checked)}
                  className="w-4 h-4 accent-primary rounded cursor-pointer"
                />
              </div>

              {/* Modal Actions */}
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-muted hover:bg-foreground/10 text-foreground text-xs font-bold rounded-lg cursor-pointer"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-extrabold rounded-lg shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {creating && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isRtl ? 'حفظ الموعد' : 'Save Event'}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}

'use client';

import React, { useState } from 'react';
import { Sword, BookOpen, Users, FileCheck, Sparkles, Plus, CheckCircle2, AlertCircle, Search, Filter, Shield, ChevronRight, HelpCircle, Layers, ArrowUpRight, Hash, Bookmark, Calendar } from 'lucide-react';
import { Matter } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';
import { translateStaticText } from '@/lib/i18n';

interface WarRoomModuleProps {
  activeMatter: Matter;
}

interface WitnessEntry {
  id: string;
  name: string;
  role: 'Fact Witness' | 'Expert Witness' | 'Adverse Representative';
  side: 'Plaintiff' | 'Defendant';
  status: 'Examined' | 'Pending' | 'On Stand';
  keyTestimony: string;
  attackPoints: string[];
}

interface ExhibitEntry {
  id: string;
  code: string; // e.g. "EX-P-01" or "EX-D-04"
  description: string;
  batesRange: string;
  offeredBy: 'Plaintiff' | 'Defendant';
  status: 'Admitted' | 'Marked Only' | 'Objected/Excluded';
  relevanceNote: string;
}

interface TimelineEvent {
  id: string;
  date: string;
  title: string;
  titleAr: string;
  category: 'Filing' | 'Evidence' | 'Hearing' | 'Discovery' | 'Milestone';
  status: 'Completed' | 'Pending' | 'Upcoming';
  summary: string;
  summaryAr: string;
  linkedRef?: string;
}

export default function WarRoomModule({ activeMatter }: WarRoomModuleProps) {
  const { t, isRtl } = useLanguage();
  const [activeTab, setActiveTab] = useState<'witnesses' | 'exhibits' | 'chronology' | 'ai-counter'>('chronology');

  // Interactive Timeline Events State
  const [timelineEvents, setTimelineEvents] = useState<TimelineEvent[]>([
    {
      id: 't1',
      date: '2025-01-10',
      title: 'Original Statement of Claim Filed',
      titleAr: 'قيد لائحة الدعوى الأصلية أمام المحكمة التجارية',
      category: 'Filing',
      status: 'Completed',
      summary: 'Filed initial claim seeking 4.2M JOD in breach of contract and liquidated damages.',
      summaryAr: 'تم تسجيل المذكرة الأولى للمطالبة بمبلغ 4.2 مليون دينار أردني بناءً على إخلال بالعقد.',
      linkedRef: 'EX-P-01'
    },
    {
      id: 't2',
      date: '2025-02-14',
      title: 'Opposing Defense & Counterclaim Submitted',
      titleAr: 'إيداع مذكرة الدفاع والطلب العارض من الخصم',
      category: 'Filing',
      status: 'Completed',
      summary: 'Defendant filed 45-page statement alleging force majeure and unexcused project delays.',
      summaryAr: 'أودع الخصم لائحة دفاع من 45 صفحة محتجاً بالقوة القاهرة وتأخر التنفيذ.',
      linkedRef: 'EX-D-03'
    },
    {
      id: 't3',
      date: '2025-03-20',
      title: 'Expert Engineering Inspection Report',
      titleAr: 'إيداع تقرير الخبرة الهندسية الفنية',
      category: 'Evidence',
      status: 'Completed',
      summary: 'Court-appointed expert panel delivered 110-page structural concrete assessment.',
      summaryAr: 'أودعت لجنة الخبراء المعينة تقرير الفحص الفني للخرسانة المكون من 110 صفحة.',
      linkedRef: 'EX-P-08'
    },
    {
      id: 't4',
      date: '2025-05-18',
      title: 'Oral Cross-Examination Hearing',
      titleAr: 'جلسة استجواب الخبراء والشهود شفاهاً',
      category: 'Hearing',
      status: 'Pending',
      summary: 'Cross-examination of Dr. Tariq Al-Mansoor & Mr. Walid Al-Rashid scheduled before tribunal.',
      summaryAr: 'جلسة مناقشة الخبراء والشهود أمام هيئة المحكمة.',
      linkedRef: 'w1'
    },
    {
      id: 't5',
      date: '2025-06-30',
      title: 'Closing Submissions & Final Judgment Award',
      titleAr: 'إيداع المذكرات الختامية وصدور الحكم الابتدائى',
      category: 'Milestone',
      status: 'Upcoming',
      summary: 'Final statutory deadline for post-hearing briefs and tribunal deliberation.',
      summaryAr: 'الموعد النهائي لإيداع المرافعات الختامية وحجز الدعوى للحكم.'
    }
  ]);

  const [selectedEventId, setSelectedEventId] = useState<string>('t3');
  const [timelineCategoryFilter, setTimelineCategoryFilter] = useState<string>('All');

  // Add Event Form Modal
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState('');
  const [newEventCategory, setNewEventCategory] = useState<'Filing' | 'Evidence' | 'Hearing' | 'Discovery' | 'Milestone'>('Filing');
  const [newEventSummary, setNewEventSummary] = useState('');

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEventTitle.trim() || !newEventDate) return;

    const newEv: TimelineEvent = {
      id: `t_${Date.now()}`,
      date: newEventDate,
      title: newEventTitle,
      titleAr: newEventTitle,
      category: newEventCategory,
      status: 'Pending',
      summary: newEventSummary || 'Registered timeline milestone.',
      summaryAr: newEventSummary || 'حدث مضاف المخطط الزمني.'
    };

    setTimelineEvents(prev => [...prev, newEv].sort((a, b) => a.date.localeCompare(b.date)));
    setNewEventTitle('');
    setNewEventDate('');
    setNewEventSummary('');
    setShowAddEvent(false);
  };

  const selectedEvent = timelineEvents.find(e => e.id === selectedEventId) || timelineEvents[0];

  // Sample Witnesses Data
  const [witnesses, setWitnesses] = useState<WitnessEntry[]>([
    {
      id: 'w1',
      name: 'Dr. Tariq Al-Mansoor',
      role: 'Expert Witness',
      side: 'Plaintiff',
      status: 'Pending',
      keyTestimony: 'Testified regarding structural concrete compression tests showing 22% deficit below ASTM C39 standards.',
      attackPoints: [
        'Exceeds scope of original expert report filed on Jan 12',
        'Prior inconsistent statement during 2024 arbitration in Abu Dhabi',
        'Uncalibrated testing apparatus used during field inspection'
      ]
    },
    {
      id: 'w2',
      name: 'Walid Al-Rashid',
      role: 'Adverse Representative',
      side: 'Defendant',
      status: 'On Stand',
      keyTestimony: 'Admitted signing Change Order #4 without prior written approval from the board of directors.',
      attackPoints: [
        'Contradicts email exhibit EX-P-08 timestamped 14:22',
        'Financial incentive tied to project completion milestone'
      ]
    }
  ]);

  // Sample Exhibits Data
  const [exhibits, setExhibits] = useState<ExhibitEntry[]>([
    {
      id: 'e1',
      code: 'EX-P-01',
      description: 'Master Commercial Construction Agreement & Schedule B',
      batesRange: 'AL-HIKMAH-000001 to 000045',
      offeredBy: 'Plaintiff',
      status: 'Admitted',
      relevanceNote: 'Establishes 12% liquidated damages penalty clause for unexcused delay.'
    },
    {
      id: 'e2',
      code: 'EX-P-08',
      description: 'Executive Email Chain regarding Delay Notice & FIDIC Clause 20.1',
      batesRange: 'AL-HIKMAH-000210 to 000215',
      offeredBy: 'Plaintiff',
      status: 'Admitted',
      relevanceNote: 'Proves timely notice of force majeure claim sent within statutory 28-day window.'
    },
    {
      id: 'e3',
      code: 'EX-D-03',
      description: 'Internal Quality Control Audit Memorandum (Draft)',
      batesRange: 'DEF-AUDIT-000012',
      offeredBy: 'Defendant',
      status: 'Objected/Excluded',
      relevanceNote: 'Excluded under Attorney Work Product Privilege pursuant to Court Order #2.'
    }
  ]);

  // AI Tactical Counter-Argument State
  const [opposingArgument, setOpposingArgument] = useState('');
  const [aiCounterStrategy, setAiCounterStrategy] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  // Witness Form modal state
  const [showAddWitness, setShowAddWitness] = useState(false);
  const [newWitnessName, setNewWitnessName] = useState('');
  const [newWitnessRole, setNewWitnessRole] = useState<'Fact Witness' | 'Expert Witness' | 'Adverse Representative'>('Fact Witness');
  const [newWitnessTestimony, setNewWitnessTestimony] = useState('');

  const handleCreateWitness = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWitnessName.trim()) return;

    const newW: WitnessEntry = {
      id: `w_${Date.now()}`,
      name: newWitnessName,
      role: newWitnessRole,
      side: 'Defendant',
      status: 'Pending',
      keyTestimony: newWitnessTestimony || 'Statement pending cross-examination.',
      attackPoints: ['Key admissions to be established during cross-examination.']
    };

    setWitnesses(prev => [...prev, newW]);
    setNewWitnessName('');
    setNewWitnessTestimony('');
    setShowAddWitness(false);
  };

  const handleGenerateCounterStrategy = async () => {
    if (!opposingArgument.trim()) return;
    setIsGenerating(true);
    setAiCounterStrategy('');

    try {
      const res = await fetch('/api/ai/generate-pleading', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pleadingType: 'Trial Cross-Examination & Rebuttal Strategy',
          matterDetails: `Matter Title: ${activeMatter.title}, Jurisdiction: ${activeMatter.jurisdiction}, Opposing Party: ${activeMatter.opposingParty}`,
          userNotes: `Opposing Argument to Counter: "${opposingArgument}". Provide 3 immediate cross-examination attack vectors, statutory precedents, and evidentiary objections.`
        })
      });

      if (res.ok) {
        const data = await res.json();
        setAiCounterStrategy(data.generatedDraft);
      } else {
        throw new Error('AI Server Error');
      }
    } catch (err) {
      setAiCounterStrategy(isRtl
        ? 'حدث خطأ أثناء الاتصال بالمساعد الذكي للمحاكمة. يرجى إعادة المحاولة.'
        : 'Failed to contact Trial AI Copilot. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 shadow-sm space-y-4" id="warroom-module">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-rose-600 text-white rounded-2xl shadow-xs">
            <Sword className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 font-display flex items-center gap-2">
              <span>{isRtl ? 'غرفة عمليات المحاكمة والجلسات (Trial War Room)' : 'Trial War Room & Hearing Binder'}</span>
              <span className="px-2 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 text-[10px] font-bold rounded-md uppercase">
                {isRtl ? 'مباشر' : 'Live Hearing Prep'}
              </span>
            </h3>
            <p className="text-xs text-slate-500">
              {isRtl ? 'إدارة أقوال الشهود، أدلة النزاع، واستراتيجيات الاستجواب المضاد' : 'Organize witness examination binders, exhibit ledgers, and rebuttal attack vectors'}
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex flex-wrap items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold font-display gap-1">
          <button
            onClick={() => setActiveTab('chronology')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'chronology' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{isRtl ? 'المخطط الزمني الشامل' : 'Trial Chronology'}</span>
          </button>
          <button
            onClick={() => setActiveTab('witnesses')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'witnesses' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>{isRtl ? 'دفتر الشهود' : 'Witness Binder'}</span>
          </button>
          <button
            onClick={() => setActiveTab('exhibits')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'exhibits' ? 'bg-white text-rose-600 shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>{isRtl ? 'حافظة المستندات والأدلة' : 'Exhibit Ledger'}</span>
          </button>
          <button
            onClick={() => setActiveTab('ai-counter')}
            className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'ai-counter' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>{isRtl ? 'الرد الذكي الفوري' : 'AI Rebuttal Engine'}</span>
          </button>
        </div>
      </div>

      {/* TAB 0: VISUAL INTERACTIVE TRIAL CHRONOLOGY & TIMELINE */}
      {activeTab === 'chronology' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          {/* Controls Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 p-3 rounded-2xl">
            {/* Category Filters */}
            <div className="flex items-center gap-1.5 overflow-x-auto text-[11px] font-bold">
              <span className="text-slate-400 font-sans mr-1 rtl:ml-1 shrink-0">{isRtl ? 'تصفية حسب:' : 'Filter:'}</span>
              {['All', 'Filing', 'Evidence', 'Hearing', 'Milestone'].map(cat => (
                <button
                  key={cat}
                  onClick={() => setTimelineCategoryFilter(cat)}
                  className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer whitespace-nowrap ${
                    timelineCategoryFilter === cat
                      ? 'bg-rose-600 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {cat === 'All' ? (isRtl ? 'الكل' : 'All') : cat}
                </button>
              ))}
            </div>

            <button
              onClick={() => setShowAddEvent(true)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1 shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isRtl ? 'إضافة محطة زمنية' : 'Add Event'}</span>
            </button>
          </div>

          {/* Add Timeline Event Form */}
          {showAddEvent && (
            <form onSubmit={handleAddEvent} className="bg-slate-900 text-white border border-slate-800 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
              <h4 className="text-xs font-bold font-display uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span>{isRtl ? 'إضافة محطة جديدة إلى التسلسل الزمني للنزاع' : 'Register New Case Milestone Event'}</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">{isRtl ? 'عنوان الحدث / المذكرة:' : 'Event Title:'}</label>
                  <input
                    type="text"
                    value={newEventTitle}
                    onChange={e => setNewEventTitle(e.target.value)}
                    placeholder="e.g. Submissions of Rebuttal Expert Brief"
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">{isRtl ? 'التاريخ:' : 'Event Date:'}</label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={e => setNewEventDate(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">{isRtl ? 'نوع المحطة:' : 'Category:'}</label>
                  <select
                    value={newEventCategory}
                    onChange={e => setNewEventCategory(e.target.value as any)}
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="Filing">Court Filing (إيداع قضائي)</option>
                    <option value="Evidence">Evidence Production (تقديم أدلة)</option>
                    <option value="Hearing">Hearing / Deposition (جلسة محاكمة)</option>
                    <option value="Discovery">Discovery Phase (تبادل مستندات)</option>
                    <option value="Milestone">Case Milestone (حدث جوهري)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">{isRtl ? 'الوصف / الأهمية القانونية:' : 'Summary / Legal Impact:'}</label>
                  <input
                    type="text"
                    value={newEventSummary}
                    onChange={e => setNewEventSummary(e.target.value)}
                    placeholder="Brief description of significance..."
                    className="w-full bg-slate-800 border border-slate-700 text-white rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddEvent(false)}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl hover:bg-slate-700"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-colors shadow-xs"
                >
                  {isRtl ? 'حفظ الحدث' : 'Save Event'}
                </button>
              </div>
            </form>
          )}

          {/* Interactive Timeline Axis */}
          <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-5 border border-slate-800 space-y-4">
            <div className="flex justify-between items-center text-xs border-b border-slate-800 pb-3">
              <span className="font-bold font-display text-slate-300 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-rose-400" />
                <span>{isRtl ? 'المخطط الزمني لمجريات المحاكمة (Interactive Bird\'s-Eye Timeline)' : 'Interactive Bird\'s-Eye Case Timeline'}</span>
              </span>
              <span className="text-[11px] text-slate-400 font-mono">
                {timelineEvents.length} {isRtl ? 'محطات معتمدة' : 'Milestones'}
              </span>
            </div>

            {/* Horizontal Scrollable Nodes Flow */}
            <div className="relative py-6 overflow-x-auto scrollbar-thin scrollbar-thumb-slate-700">
              {/* Central Connecting Line */}
              <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2 h-1 bg-slate-800 z-0" />

              <div className="flex items-center justify-between gap-6 min-w-[600px] px-4 relative z-10">
                {timelineEvents
                  .filter(ev => timelineCategoryFilter === 'All' || ev.category === timelineCategoryFilter)
                  .map((ev, idx) => {
                    const isSelected = ev.id === selectedEventId;
                    return (
                      <div
                        key={ev.id}
                        onClick={() => setSelectedEventId(ev.id)}
                        className={`group flex flex-col items-center cursor-pointer transition-all duration-200 shrink-0 ${
                          isSelected ? 'scale-110' : 'hover:scale-105 opacity-80 hover:opacity-100'
                        }`}
                      >
                        {/* Event Date Tag Above */}
                        <span className={`text-[10px] font-mono font-bold mb-2 px-2 py-0.5 rounded-md transition-colors ${
                          isSelected ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-400'
                        }`}>
                          {ev.date}
                        </span>

                        {/* Interactive Node Icon */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-md ${
                          isSelected
                            ? 'bg-rose-600 text-white ring-4 ring-rose-500/30'
                            : ev.status === 'Completed'
                            ? 'bg-emerald-600 text-white'
                            : ev.status === 'Pending'
                            ? 'bg-amber-500 text-white ring-2 ring-amber-400/40 animate-pulse'
                            : 'bg-slate-800 border border-slate-700 text-slate-400'
                        }`}>
                          {ev.category === 'Filing' && <FileCheck className="w-4 h-4" />}
                          {ev.category === 'Evidence' && <BookOpen className="w-4 h-4" />}
                          {ev.category === 'Hearing' && <Users className="w-4 h-4" />}
                          {ev.category === 'Milestone' && <Sparkles className="w-4 h-4" />}
                          {ev.category === 'Discovery' && <Search className="w-4 h-4" />}
                        </div>

                        {/* Event Title Below */}
                        <span className={`text-[11px] font-bold mt-2 max-w-[120px] text-center line-clamp-1 transition-colors ${
                          isSelected ? 'text-white' : 'text-slate-400'
                        }`}>
                          {isRtl ? ev.titleAr : ev.title}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Selected Event Detail Inspection Card */}
          {selectedEvent && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-3 animate-in fade-in duration-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div className="flex items-center gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                    selectedEvent.status === 'Completed' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {selectedEvent.status}
                  </span>
                  <span className="px-2.5 py-1 bg-slate-200 text-slate-800 font-mono text-xs font-bold rounded-lg">
                    {selectedEvent.date}
                  </span>
                  <span className="px-2.5 py-1 bg-rose-50 text-rose-700 border border-rose-200 text-xs font-bold rounded-lg">
                    {selectedEvent.category}
                  </span>
                </div>
                {selectedEvent.linkedRef && (
                  <span className="text-xs font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-lg flex items-center gap-1">
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>{isRtl ? 'مرتبط بالمستند:' : 'Linked Ref:'} {selectedEvent.linkedRef}</span>
                  </span>
                )}
              </div>

              <div>
                <h4 className="text-base font-bold text-slate-900 font-display">
                  {isRtl ? selectedEvent.titleAr : selectedEvent.title}
                </h4>
                <p className="text-xs text-slate-600 mt-1.5 leading-relaxed bg-white border border-slate-200/80 rounded-xl p-3">
                  {isRtl ? selectedEvent.summaryAr : selectedEvent.summary}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 1: WITNESS BINDER */}
      {activeTab === 'witnesses' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center">
            <p className="text-xs text-slate-500 font-medium">
              {isRtl ? 'قائمة الشهود والخبراء المقيدين في الجلسات:' : 'Active witnesses and expert cross-examination binders:'}
            </p>
            <button
              onClick={() => setShowAddWitness(true)}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>{isRtl ? 'إضافة شاهد' : 'Add Witness'}</span>
            </button>
          </div>

          {/* Add Witness Modal Form */}
          {showAddWitness && (
            <form onSubmit={handleCreateWitness} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{isRtl ? 'قيد شاهد جديد للجلسة' : 'Register Witness for Trial'}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">{isRtl ? 'اسم الشاهد / الخبير:' : 'Witness Full Name:'}</label>
                  <input
                    type="text"
                    value={newWitnessName}
                    onChange={e => setNewWitnessName(e.target.value)}
                    placeholder="e.g. Dr. Sultan Al-Amri"
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-1">{isRtl ? 'الصفة القانونية:' : 'Witness Role:'}</label>
                  <select
                    value={newWitnessRole}
                    onChange={e => setNewWitnessRole(e.target.value as any)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                  >
                    <option value="Fact Witness">Fact Witness (شاهد إثبات)</option>
                    <option value="Expert Witness">Expert Witness (خبير هندسي/مالي)</option>
                    <option value="Adverse Representative">Adverse Representative (ممثل الخصم)</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">{isRtl ? 'ملخص الشهادة أو الإقرار:' : 'Summary of Testimony / Deposition Highlight:'}</label>
                <textarea
                  value={newWitnessTestimony}
                  onChange={e => setNewWitnessTestimony(e.target.value)}
                  rows={2}
                  placeholder={isRtl ? 'أدخل النقاط الجوهرية في شهادة الشاهد...' : 'Enter key admissions or expert points...'}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddWitness(false)}
                  className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-bold rounded-xl hover:bg-slate-300"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-rose-600 text-white text-xs font-bold rounded-xl hover:bg-rose-700 shadow-xs"
                >
                  {isRtl ? 'حفظ الشاهد' : 'Save Witness'}
                </button>
              </div>
            </form>
          )}

          {/* Witness Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {witnesses.map(w => (
              <div key={w.id} className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 relative hover:border-rose-300 transition-colors">
                <div className="flex justify-between items-start gap-2">
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 font-display flex items-center gap-2">
                      <span>{w.name}</span>
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                        w.status === 'On Stand' ? 'bg-amber-100 text-amber-800 border border-amber-200 animate-pulse' : 'bg-slate-200 text-slate-700'
                      }`}>
                        {w.status}
                      </span>
                    </h4>
                    <p className="text-[11px] font-semibold text-rose-700 mt-0.5">{w.role} ({w.side})</p>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 rounded-xl p-3 text-xs text-slate-700 leading-relaxed">
                  <span className="font-bold text-slate-900 block mb-1">{isRtl ? 'أقوال الشاهد الرئيسية:' : 'Key Testimony:'}</span>
                  {w.keyTestimony}
                </div>

                {/* Attack Vectors */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-rose-900 uppercase tracking-wider block">
                    {isRtl ? 'محاور الاستجواب المضاد (Cross-Exam Attack Vectors):' : 'Cross-Exam Attack Vectors:'}
                  </span>
                  <ul className="space-y-1 text-xs text-slate-600">
                    {w.attackPoints.map((ap, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 bg-rose-50/50 p-2 rounded-lg border border-rose-100/50">
                        <ChevronRight className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5 rtl:rotate-180" />
                        <span>{ap}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: EXHIBIT LEDGER */}
      {activeTab === 'exhibits' && (
        <div className="space-y-3 animate-in fade-in duration-200">
          <p className="text-xs text-slate-500 font-medium">
            {isRtl ? 'سجل الأدلة وحوافظ المستندات المقبولة والمستبعدة أمام المحكمة:' : 'Master trial exhibit ledger and court admission statuses:'}
          </p>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left rtl:text-right text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">{isRtl ? 'رمز الدليل' : 'Exhibit Code'}</th>
                  <th className="p-3">{isRtl ? 'الوصف' : 'Description'}</th>
                  <th className="p-3">{isRtl ? 'نطاق بيتس (Bates)' : 'Bates Stamp'}</th>
                  <th className="p-3">{isRtl ? 'مقدم الدليل' : 'Offered By'}</th>
                  <th className="p-3">{isRtl ? 'الحالة أمام المحكمة' : 'Court Status'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {exhibits.map(ex => (
                  <tr key={ex.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3 font-mono font-bold text-indigo-600">{ex.code}</td>
                    <td className="p-3 max-w-xs">
                      <div className="font-bold">{ex.description}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">{ex.relevanceNote}</div>
                    </td>
                    <td className="p-3 font-mono text-[11px] text-slate-600">{ex.batesRange}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                        ex.offeredBy === 'Plaintiff' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}>
                        {ex.offeredBy}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold inline-flex items-center gap-1 ${
                        ex.status === 'Admitted' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        <FileCheck className="w-3 h-3" />
                        <span>{ex.status}</span>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: AI REBUTTAL ENGINE */}
      {activeTab === 'ai-counter' && (
        <div className="space-y-4 animate-in fade-in duration-200">
          <div className="bg-slate-900 text-white p-4 sm:p-5 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h4 className="text-sm font-bold font-display">{isRtl ? 'مولد الردود القانونية الفورية للجلسة (AI Rebuttal Generator)' : 'Real-time Trial Rebuttal & Counter-Argument Engine'}</h4>
            </div>
            <p className="text-xs text-slate-300">
              {isRtl ? 'أدخل دفوع محامي الخصم أثناء الجلسة لتوليد تفنيد قانوني فوري مدعوم بالقواعد والمبادئ:' : 'Paste opposing counsel\'s argument in real-time to generate immediate statutory counter-arguments:'}
            </p>

            <div className="space-y-2">
              <textarea
                value={opposingArgument}
                onChange={e => setOpposingArgument(e.target.value)}
                rows={3}
                placeholder={isRtl ? 'مثال: يزعم الخصم أن إخطار التأخير لم يتضمن التفاصيل المالية المطلوبة في المادة 20.1...' : 'e.g. Opposing counsel argues that notice of claim was defective due to missing financial breakdown under Clause 20.1...'}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500"
              />
              <button
                onClick={handleGenerateCounterStrategy}
                disabled={isGenerating || !opposingArgument.trim()}
                className="w-full py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>{isRtl ? 'جاري تحليل الدفوع واستدعاء المبادئ القضائية...' : 'Analyzing Arguments & Formulating Rebuttal...'}</span>
                  </>
                ) : (
                  <>
                    <Sword className="w-4 h-4" />
                    <span>{isRtl ? 'توليد استراتيجية الرد والتفنيد' : 'Generate Immediate Counter-Rebuttal'}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Rebuttal Output */}
          {aiCounterStrategy && (
            <div className="bg-rose-50/60 border border-rose-200 rounded-2xl p-4 sm:p-5 space-y-3 animate-in fade-in duration-300">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-rose-900 font-display flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-rose-600" />
                  <span>{isRtl ? 'خطة التفنيد والاستجواب الموصى بها:' : 'Recommended Trial Rebuttal Strategy:'}</span>
                </span>
                <button
                  onClick={() => navigator.clipboard.writeText(aiCounterStrategy)}
                  className="px-2.5 py-1 bg-white hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold rounded-lg transition-colors cursor-pointer"
                >
                  {isRtl ? 'نسخ النص' : 'Copy Text'}
                </button>
              </div>
              <div className="bg-white border border-rose-100 rounded-xl p-4 text-xs text-slate-800 whitespace-pre-line leading-relaxed font-sans shadow-2xs">
                {aiCounterStrategy}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

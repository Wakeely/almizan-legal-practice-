'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Folder, FileText, CheckSquare, User, ArrowRight, CornerDownLeft, Sparkles, Loader2, Tag } from 'lucide-react';
import { Matter, Document, Task } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';
import { translateStaticText } from '@/lib/i18n';
import { getAllFromOfflineStore, STORES } from '@/lib/offline-storage';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  matters: Matter[];
  onSelectResult: (matterId: string, section?: 'documents' | 'tasks') => void;
}

interface SearchResultItem {
  id: string;
  type: 'matter' | 'document' | 'task';
  title: string;
  subtitle: string;
  matterId: string;
  matterTitle: string;
  badgeText?: string;
  badgeColor?: string;
  extraDetails?: string;
  tags?: string[];
}

export default function GlobalSearchModal({
  isOpen,
  onClose,
  matters,
  onSelectResult
}: GlobalSearchModalProps) {
  const { isRtl, t } = useLanguage();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'matters' | 'documents' | 'tasks'>('all');
  const [loading, setLoading] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Reset search when modal opens
  useEffect(() => {
    if (!isOpen) return;

    setSelectedIndex(0);

    // Focus search input on open
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);

    const fetchSearchData = async () => {
      setLoading(true);
      try {
        // 1. First try unified search endpoint
        try {
          const res = await fetch('/api/all-searchable-data');
          if (res.ok) {
            const data = await res.json();
            if (data.documents && Array.isArray(data.documents)) setDocuments(data.documents);
            if (data.tasks && Array.isArray(data.tasks)) setTasks(data.tasks);
            setLoading(false);
            return;
          }
        } catch (e) {
          // Server endpoint error, fallback to per-matter API calls
        }

        // 2. Fallback per-matter API calls
        const fetchedDocs: Document[] = [];
        const fetchedTasks: Task[] = [];

        await Promise.all((matters || []).map(async (m) => {
          try {
            const [docsRes, tasksRes] = await Promise.all([
              fetch(`/api/matters/${m.id}/documents`),
              fetch(`/api/matters/${m.id}/tasks`)
            ]);

            if (docsRes.ok) {
              const dData = await docsRes.json();
              if (Array.isArray(dData)) fetchedDocs.push(...dData);
            }
            if (tasksRes.ok) {
              const tData = await tasksRes.json();
              if (Array.isArray(tData)) fetchedTasks.push(...tData);
            }
          } catch (e) {
            console.warn(`Error fetching search data for matter ${m.id}:`, e);
          }
        }));

        // 3. Fallback to IndexedDB offline storage if needed
        if (fetchedDocs.length === 0) {
          const cachedDocs = await getAllFromOfflineStore<Document>(STORES.DOCUMENTS);
          if (cachedDocs && cachedDocs.length > 0) fetchedDocs.push(...cachedDocs);
        }
        if (fetchedTasks.length === 0) {
          const cachedTasks = await getAllFromOfflineStore<Task>(STORES.TASKS);
          if (cachedTasks && cachedTasks.length > 0) fetchedTasks.push(...cachedTasks);
        }

        setDocuments(fetchedDocs);
        setTasks(fetchedTasks);
      } catch (err) {
        console.error("Global search data fetch failed:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchSearchData();
  }, [isOpen, matters]);

  // Compute search results safely
  const q = query.trim().toLowerCase();
  const results: SearchResultItem[] = [];

  if (q.length > 0) {
    // 1. Search Matters & Clients
    if (filter === 'all' || filter === 'matters') {
      (matters || []).forEach(m => {
        const titleStr = m.title || '';
        const clientNameStr = m.clientName || '';
        const clientEmailStr = m.clientEmail || '';
        const jurisdictionStr = m.jurisdiction || '';
        const opposingPartyStr = m.opposingParty || '';
        const opposingCounselStr = m.opposingCounsel || '';

        const localizedTitle = translateStaticText(titleStr, isRtl);
        const localizedClient = translateStaticText(clientNameStr, isRtl);

        const matchTitle = localizedTitle.toLowerCase().includes(q) || titleStr.toLowerCase().includes(q);
        const matchClient = localizedClient.toLowerCase().includes(q) || clientNameStr.toLowerCase().includes(q) || clientEmailStr.toLowerCase().includes(q);
        const matchJurisdiction = jurisdictionStr.toLowerCase().includes(q);
        const matchOpposing = opposingPartyStr.toLowerCase().includes(q) || opposingCounselStr.toLowerCase().includes(q);

        if (matchTitle || matchClient || matchJurisdiction || matchOpposing) {
          results.push({
            id: `matter-${m.id}`,
            type: 'matter',
            title: localizedTitle || titleStr,
            subtitle: `${t.clientName}: ${localizedClient || clientNameStr}${jurisdictionStr ? ` • ${jurisdictionStr}` : ''}`,
            matterId: m.id,
            matterTitle: localizedTitle || titleStr,
            badgeText: t.searchTypeMatter,
            badgeColor: 'bg-primary/5 text-primary border-primary/20',
            extraDetails: opposingPartyStr ? `${t.opposingParty}: ${opposingPartyStr}` : undefined
          });
        }
      });
    }

    // 2. Search Documents
    if (filter === 'all' || filter === 'documents') {
      (documents || []).forEach(d => {
        const docName = (d.name || '').toLowerCase();
        const docCat = (d.category || '').toLowerCase();
        const uploadedBy = (d.uploadedBy || '').toLowerCase();
        const aiSummary = (d.aiSummary || '').toLowerCase();
        const tags = d.aiTags || [];

        const matchName = docName.includes(q);
        const matchCat = docCat.includes(q);
        const matchUser = uploadedBy.includes(q);
        const matchSummary = aiSummary.includes(q);
        const matchTags = tags.some(tag => (tag || '').toLowerCase().includes(q));

        if (matchName || matchCat || matchUser || matchSummary || matchTags) {
          const parentMatter = (matters || []).find(m => m.id === d.matterId);
          const parentTitle = parentMatter ? translateStaticText(parentMatter.title || '', isRtl) : '';

          results.push({
            id: `doc-${d.id}`,
            type: 'document',
            title: d.name || 'Document',
            subtitle: `${t.category}: ${d.category || 'General'} • ${d.fileSize || ''}`,
            matterId: d.matterId,
            matterTitle: parentTitle,
            badgeText: t.searchTypeDoc,
            badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
            extraDetails: d.aiSummary ? `${d.aiSummary.substring(0, 100)}...` : undefined,
            tags: d.aiTags
          });
        }
      });
    }

    // 3. Search Tasks
    if (filter === 'all' || filter === 'tasks') {
      (tasks || []).forEach(tk => {
        const taskTitle = (tk.title || '').toLowerCase();
        const taskDesc = (tk.description || '').toLowerCase();
        const assignedTo = (tk.assignedTo || '').toLowerCase();

        const matchTitle = taskTitle.includes(q);
        const matchDesc = taskDesc.includes(q);
        const matchAssignee = assignedTo.includes(q);

        if (matchTitle || matchDesc || matchAssignee) {
          const parentMatter = (matters || []).find(m => m.id === tk.matterId);
          const parentTitle = parentMatter ? translateStaticText(parentMatter.title || '', isRtl) : '';

          results.push({
            id: `task-${tk.id}`,
            type: 'task',
            title: tk.title || 'Task',
            subtitle: `${t.assignedStaff || 'Assigned'}: ${tk.assignedTo || 'Unassigned'} • ${t.dueDate || 'Due'}: ${tk.dueDate || 'N/A'}`,
            matterId: tk.matterId,
            matterTitle: parentTitle,
            badgeText: `${t.searchTypeTask} [${tk.status || 'To Do'}]`,
            badgeColor: tk.priority === 'High' 
              ? 'bg-rose-50 text-rose-700 border-rose-200' 
              : 'bg-amber-50 text-amber-700 border-amber-200',
            extraDetails: tk.description
          });
        }
      });
    }
  }

  // Handle ESC key press and Arrow navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => (prev > 0 ? prev - 1 : results.length - 1));
      } else if (e.key === 'Enter' && results.length > 0) {
        e.preventDefault();
        const item = results[selectedIndex] || results[0];
        if (item) {
          handleItemClick(item);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, results, selectedIndex]);

  if (!isOpen) return null;

  const handleItemClick = (item: SearchResultItem) => {
    const section = item.type === 'document' ? 'documents' : item.type === 'task' ? 'tasks' : undefined;
    onSelectResult(item.matterId, section);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-12 sm:pt-20 px-3 sm:px-4 bg-foreground/60 backdrop-blur-md animate-in fade-in duration-150">
      {/* Background click to dismiss */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Main Command Palette Dialog Container */}
      <div 
        className="relative w-full max-w-2xl bg-white border border-border rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden z-10 flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Search Input Box */}
        <div className="flex items-center gap-3 px-4 sm:px-5 py-3.5 sm:py-4 border-b border-border bg-card/50">
          <Search className="w-5 h-5 text-primary shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder={t.globalSearchPlaceholder}
            className="w-full text-sm sm:text-base font-semibold text-foreground placeholder-slate-400 bg-transparent focus:outline-none"
          />
          {query.length > 0 && (
            <button
              onClick={() => setQuery('')}
              className="p-1 text-muted-foreground hover:text-muted-foreground hover:bg-muted/60 rounded-full transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={onClose}
            className="hidden sm:flex items-center gap-1 text-[11px] font-mono font-bold text-muted-foreground hover:text-muted-foreground bg-muted/70 px-2 py-1 rounded-lg transition-colors cursor-pointer"
          >
            ESC
          </button>
        </div>

        {/* Filter Category Chips */}
        <div className="flex items-center gap-1.5 px-4 sm:px-5 py-2.5 border-b border-border bg-white overflow-x-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              filter === 'all'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-muted text-muted-foreground hover:bg-muted'
            }`}
          >
            {t.searchFilterAll}
          </button>
          <button
            onClick={() => setFilter('matters')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              filter === 'matters'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-muted text-muted-foreground hover:bg-muted'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            {t.searchFilterMatters}
          </button>
          <button
            onClick={() => setFilter('documents')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              filter === 'documents'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-muted text-muted-foreground hover:bg-muted'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            {t.searchFilterDocs}
          </button>
          <button
            onClick={() => setFilter('tasks')}
            className={`px-3 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              filter === 'tasks'
                ? 'bg-primary text-white shadow-xs'
                : 'bg-muted text-muted-foreground hover:bg-muted'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            {t.searchFilterTasks}
          </button>

          {loading && (
            <div className={`flex items-center gap-1.5 text-xs text-primary font-medium ${isRtl ? 'mr-auto' : 'ml-auto'}`}>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>{isRtl ? 'جاري الفهرسة...' : 'Indexing...'}</span>
            </div>
          )}
        </div>

        {/* Results Body */}
        <div className="flex-grow overflow-y-auto p-3 sm:p-4 min-h-[220px] max-h-[500px]">
          {q.length === 0 ? (
            /* Default prompt when input is empty */
            <div className="py-12 px-4 text-center flex flex-col items-center justify-center gap-3">
              <div className="w-12 h-12 bg-primary/5 border border-primary/20 rounded-2xl flex items-center justify-center text-primary">
                <Sparkles className="w-6 h-6" />
              </div>
              <h4 className="text-sm sm:text-base font-bold text-foreground font-display">
                {t.globalSearchTitle}
              </h4>
              <p className="text-xs text-muted-foreground max-w-md leading-relaxed">
                {t.globalSearchSub}
              </p>

              {/* Quick sample suggestions */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{isRtl ? 'اقتراحات البحث:' : 'Try searching:'}</span>
                {(matters || []).slice(0, 2).map(m => (
                  <button
                    key={m.id}
                    onClick={() => setQuery(m.clientName ? m.clientName.split(' ')[0] : m.title.substring(0, 10))}
                    className="text-xs font-semibold bg-muted hover:bg-muted text-foreground px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                  >
                    {m.clientName || m.title}
                  </button>
                ))}
                <button
                  onClick={() => setQuery('Claim')}
                  className="text-xs font-semibold bg-muted hover:bg-muted text-foreground px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  Statement of Claim
                </button>
              </div>
            </div>
          ) : results.length === 0 ? (
            /* No matching results */
            <div className="py-12 px-4 text-center flex flex-col items-center justify-center gap-2">
              <Search className="w-10 h-10 text-muted-foreground" />
              <p className="text-sm font-bold text-foreground">
                {t.noSearchResults} "{query}"
              </p>
              <p className="text-xs text-muted-foreground">
                {isRtl ? 'حاول البحث بكلمات أخرى أو تغيير الفلتر المعتمد.' : 'Try adjusting your search query or selecting a different category filter.'}
              </p>
            </div>
          ) : (
            /* Render matching items list */
            <div className="flex flex-col gap-2">
              <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 pb-1 flex justify-between items-center">
                <span>{isRtl ? `تم العثور على ${results.length} نتيجة` : `Found ${results.length} result(s)`}</span>
                <span className="text-[9px] text-muted-foreground font-mono">Use ↑↓ and Enter</span>
              </div>

              {results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`p-3 sm:p-3.5 border rounded-xl sm:rounded-2xl transition-all cursor-pointer group flex items-start gap-3 relative shadow-2xs ${
                      isSelected
                        ? 'bg-primary/5/90 border-primary/30 ring-1 ring-primary/20'
                        : 'bg-white hover:bg-primary/5/50 border-border/80 hover:border-primary/20'
                    }`}
                  >
                    {/* Category Type Icon */}
                    <div className="shrink-0 mt-0.5">
                      {item.type === 'matter' && (
                        <div className="w-9 h-9 bg-primary/10 text-primary rounded-xl flex items-center justify-center border border-primary/20">
                          <Folder className="w-4.5 h-4.5" />
                        </div>
                      )}
                      {item.type === 'document' && (
                        <div className="w-9 h-9 bg-emerald-100 text-emerald-700 rounded-xl flex items-center justify-center border border-emerald-200">
                          <FileText className="w-4.5 h-4.5" />
                        </div>
                      )}
                      {item.type === 'task' && (
                        <div className="w-9 h-9 bg-amber-100 text-amber-700 rounded-xl flex items-center justify-center border border-amber-200">
                          <CheckSquare className="w-4.5 h-4.5" />
                        </div>
                      )}
                    </div>

                    {/* Main Details */}
                    <div className="flex-grow min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h5 className="text-xs sm:text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">
                          {item.title}
                        </h5>
                        {item.badgeText && (
                          <span className={`px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-md border ${item.badgeColor}`}>
                            {item.badgeText}
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
                        {item.subtitle}
                      </p>

                      {/* Extra AI snippet / description */}
                      {item.extraDetails && (
                        <p className="text-[10px] text-muted-foreground mt-1 line-clamp-1 bg-card p-1.5 rounded-lg border border-border font-sans">
                          {item.extraDetails}
                        </p>
                      )}

                      {/* Associated tags if document */}
                      {item.tags && item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {item.tags.map((tag, tagIdx) => (
                            <span key={tagIdx} className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
                              <Tag className="w-2.5 h-2.5 text-primary" />
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Matter ownership link */}
                      {item.matterTitle && item.type !== 'matter' && (
                        <div className="mt-1.5 text-[9px] font-mono font-bold text-primary flex items-center gap-1">
                          <span>{t.activeCase}:</span>
                          <span className="truncate">{item.matterTitle}</span>
                        </div>
                      )}
                    </div>

                    {/* Jump Action Indicator */}
                    <div className={`shrink-0 self-center transition-opacity ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <span className="text-[11px] font-bold text-primary bg-primary/10/80 px-2.5 py-1 rounded-xl flex items-center gap-1">
                        {t.jumpTo}
                        <ArrowRight className={`w-3.5 h-3.5 ${isRtl ? 'rotate-180' : ''}`} />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info bar */}
        <div className="px-4 py-2.5 border-t border-border bg-card text-[10px] text-muted-foreground font-mono flex justify-between items-center">
          <span>{isRtl ? 'محرك البحث الميزان المحدث' : 'Al Mizan Search Index v1.2'}</span>
          <div className="flex items-center gap-2">
            <kbd className="bg-white border border-border px-1.5 py-0.5 rounded text-[9px] shadow-2xs font-sans">↑↓ Navigate</kbd>
            <kbd className="bg-white border border-border px-1.5 py-0.5 rounded text-[9px] shadow-2xs font-sans">Enter Select</kbd>
            <kbd className="bg-white border border-border px-1.5 py-0.5 rounded text-[9px] shadow-2xs font-sans">ESC Close</kbd>
          </div>
        </div>
      </div>
    </div>
  );
}

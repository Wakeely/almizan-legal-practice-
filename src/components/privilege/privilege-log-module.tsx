'use client';

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Lock, Sparkles, FileSpreadsheet, Copy, Printer, 
  Plus, Trash2, Edit3, Check, X, RefreshCw, AlertTriangle, 
  HelpCircle, EyeOff, ShieldAlert, CheckCircle2, FileText
} from 'lucide-react';
import { PrivilegeLogEntry, Document } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';
import { translateStaticText } from '@/lib/i18n';

interface PrivilegeLogModuleProps {
  matterId: string;
}

export default function PrivilegeLogModule({ matterId }: PrivilegeLogModuleProps) {
  const { isRtl } = useLanguage();
  const [entries, setEntries] = useState<PrivilegeLogEntry[]>([]);
  const [matterDocs, setMatterDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [copiedNotification, setCopiedNotification] = useState<boolean>(false);

  // Modal State
  const [showModal, setShowModal] = useState<boolean>(false);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);

  // Form Fields
  const [docControlNum, setDocControlNum] = useState<string>('');
  const [docDate, setDocDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [author, setAuthor] = useState<string>('');
  const [recipients, setRecipients] = useState<string>('');
  const [docType, setDocType] = useState<string>('Legal Memo');
  const [subject, setSubject] = useState<string>('');
  const [privilegeClaimed, setPrivilegeClaimed] = useState<'Attorney-Client Privilege' | 'Work-Product Doctrine' | 'Common Interest Privilege' | 'Bank Confidentiality' | 'Sharia Professional Secrecy'>('Attorney-Client Privilege');
  const [justification, setJustification] = useState<string>('');
  const [reviewStatus, setReviewStatus] = useState<'Flagged' | 'Verified' | 'Withheld'>('Verified');
  const [isRedacted, setIsRedacted] = useState<boolean>(true);

  // AI Assistant State
  const [aiAnalyzing, setAiAnalyzing] = useState<boolean>(false);
  const [selectedDocForAi, setSelectedDocForAi] = useState<string>('');

  const fetchPrivilegeLog = async () => {
    setLoading(true);
    try {
      const [privRes, docsRes] = await Promise.all([
        fetch(`/api/matters/${matterId}/privilege-log`),
        fetch(`/api/matters/${matterId}/documents`)
      ]);

      if (privRes.ok) {
        const data: PrivilegeLogEntry[] = await privRes.json();
        setEntries(data);
      }
      if (docsRes.ok) {
        const docsData: Document[] = await docsRes.json();
        setMatterDocs(docsData);
      }
    } catch (err) {
      console.error("Failed to load privilege log:", err);
    } fonting: {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrivilegeLog();
  }, [matterId]);

  const resetForm = () => {
    setEditingEntryId(null);
    setDocControlNum(`PRIV-M-${Math.floor(Math.random() * 900 + 100)}`);
    setDocDate(new Date().toISOString().split('T')[0]);
    setAuthor('Farah Al-Sabah (Senior Associate)');
    setRecipients('Tariq Al-Tayer (Client CEO)');
    setDocType('Legal Opinion Memo');
    setSubject('');
    setPrivilegeClaimed('Attorney-Client Privilege');
    setJustification('');
    setReviewStatus('Verified');
    setIsRedacted(true);
    setSelectedDocForAi('');
  };

  const openAddModal = () => {
    resetForm();
    setShowModal(true);
  };

  const openEditModal = (entry: PrivilegeLogEntry) => {
    setEditingEntryId(entry.id);
    setDocControlNum(entry.docControlNum);
    setDocDate(entry.docDate);
    setAuthor(entry.author);
    setRecipients(entry.recipients);
    setDocType(entry.docType);
    setSubject(entry.subject);
    setPrivilegeClaimed(entry.privilegeClaimed);
    setJustification(entry.justification);
    setReviewStatus(entry.reviewStatus);
    setIsRedacted(entry.isRedacted ?? true);
    setShowModal(true);
  };

  const handleAiPrivilegeAnalysis = async () => {
    if (!subject && !selectedDocForAi) return;

    setAiAnalyzing(true);
    try {
      let targetName = subject || 'Confidential Discovery Document';
      let targetType = docType;
      
      if (selectedDocForAi) {
        const matched = matterDocs.find(d => d.id === selectedDocForAi);
        if (matched) {
          targetName = matched.name;
          targetType = matched.category;
          if (!subject) setSubject(matched.aiSummary || matched.name);
        }
      }

      const res = await fetch('/api/ai/privilege-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matterId,
          docName: targetName,
          docType: targetType,
          author: author || 'Legal Counsel',
          recipients: recipients || 'Client Executive',
          subject: subject || targetName,
          lang: isRtl ? 'ar' : 'en'
        })
      });

      if (res.ok) {
        const data = await res.json();
        if (data.recommendedPrivilege) {
          setPrivilegeClaimed(data.recommendedPrivilege as any);
        }
        if (data.justificationRationale) {
          setJustification(data.justificationRationale);
        }
      }
    } catch (err) {
      console.error("AI Privilege analysis failed:", err);
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docControlNum || !subject || !justification) return;

    const payload = {
      matterId,
      docControlNum,
      docDate,
      author,
      recipients,
      docType,
      subject,
      privilegeClaimed,
      justification,
      reviewStatus,
      isRedacted
    };

    try {
      if (editingEntryId) {
        const res = await fetch(`/api/privilege-log/${editingEntryId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const updated = await res.json();
          setEntries(prev => prev.map(p => p.id === updated.id ? updated : p));
        }
      } else {
        const res = await fetch('/api/privilege-log', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const created = await res.json();
          setEntries(prev => [created, ...prev]);
        }
      }
      setShowModal(false);
    } catch (err) {
      console.error("Failed to save privilege log entry:", err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(isRtl ? 'هل أنت تأكد من حذف هذا القيد من سجل الحصانة القضائية؟' : 'Are you sure you want to remove this entry from the Privilege Log?')) return;

    try {
      const res = await fetch(`/api/privilege-log/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setEntries(prev => prev.filter(p => p.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete privilege log entry:", err);
    }
  };

  const handleCopyLogTSV = () => {
    const headers = ["Control #", "Doc Date", "Author", "Recipients", "Doc Type", "Subject Matter", "Privilege Claimed", "Justification Rationale"];
    const rows = entries.map(e => [
      e.docControlNum,
      e.docDate,
      e.author,
      e.recipients,
      e.docType,
      e.subject,
      e.privilegeClaimed,
      e.justification
    ]);

    const tsvContent = [headers.join('\t'), ...rows.map(r => r.join('\t'))].join('\n');
    navigator.clipboard.writeText(tsvContent);

    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2500);
  };

  const handleExportCSV = () => {
    const headers = ["Control Number", "Document Date", "Author / Sender", "Recipients", "Document Type", "Subject Matter", "Privilege Claimed", "Justification"];
    const rows = entries.map(e => [
      `"${e.docControlNum}"`,
      `"${e.docDate}"`,
      `"${e.author.replace(/"/g, '""')}"`,
      `"${e.recipients.replace(/"/g, '""')}"`,
      `"${e.docType.replace(/"/g, '""')}"`,
      `"${e.subject.replace(/"/g, '""')}"`,
      `"${e.privilegeClaimed}"`,
      `"${e.justification.replace(/"/g, '""')}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Court_Privilege_Log_Matter_${matterId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintLog = () => {
    window.print();
  };

  const countAttorneyClient = entries.filter(e => e.privilegeClaimed === 'Attorney-Client Privilege').length;
  const countWorkProduct = entries.filter(e => e.privilegeClaimed === 'Work-Product Doctrine').length;

  return (
    <div className="bg-white border border-slate-200 rounded-3xl p-5 sm:p-6 shadow-sm flex flex-col gap-5">
      
      {/* Module Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-800 shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base sm:text-lg font-extrabold text-slate-900 font-display">
                {isRtl ? 'سجل الحصانة القضائية والمستندات المحجوبة' : 'Automated Court Discovery Privilege Log'}
              </h3>
              <span className="px-2.5 py-0.5 bg-teal-100/80 text-teal-900 border border-teal-300/80 text-[10px] font-bold rounded-full">
                {isRtl ? 'معتمد للمحاكم والتحكيم' : 'Courtroom Formatted'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {isRtl 
                ? 'إعداد وحصر المراسلات السرية وحقوق الامتناع عن الإفصاح وفقاً للأصول القضائية وقواعد SCCA' 
                : 'Manage attorney-client privilege, work-product doctrine claims, and court-compliant justifications'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 no-print">
          <button
            onClick={handleCopyLogTSV}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title={isRtl ? 'نسخ السجل كجدول' : 'Copy Table to Clipboard'}
          >
            {copiedNotification ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            {copiedNotification ? (isRtl ? 'تم النسخ!' : 'Copied!') : (isRtl ? 'نسخ الجدول' : 'Copy Log')}
          </button>

          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title={isRtl ? 'تصدير ملحق CSV للمحكمة' : 'Export Court CSV'}
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-teal-700" />
            {isRtl ? 'تصدير CSV' : 'Export CSV'}
          </button>

          <button
            onClick={handlePrintLog}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
            title={isRtl ? 'طباعة رسمية A4' : 'Print Docket'}
          >
            <Printer className="w-3.5 h-3.5 text-amber-600" />
            {isRtl ? 'طباعة' : 'Print'}
          </button>

          <button
            onClick={openAddModal}
            className="px-4 py-1.5 bg-teal-800 hover:bg-teal-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            {isRtl ? 'إضافة قيد حصانة جديد' : 'Add Privilege Entry'}
          </button>
        </div>
      </div>

      {/* Summary Stat Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            {isRtl ? 'إجمالي القيود المحجوبة' : 'Total Withheld Docs'}
          </span>
          <span className="text-lg font-black text-slate-900 font-mono mt-1">
            {entries.length}
          </span>
        </div>

        <div className="bg-teal-50/60 border border-teal-200 rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-teal-900 uppercase tracking-wider">
            {isRtl ? 'امتياز محامي-موكل' : 'Attorney-Client'}
          </span>
          <span className="text-lg font-black text-teal-950 font-mono mt-1">
            {countAttorneyClient}
          </span>
        </div>

        <div className="bg-amber-50/60 border border-amber-200 rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider">
            {isRtl ? 'نتاج العمل القانوني' : 'Work-Product Doctrine'}
          </span>
          <span className="text-lg font-black text-amber-950 font-mono mt-1">
            {countWorkProduct}
          </span>
        </div>

        <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-3 flex flex-col justify-between">
          <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider">
            {isRtl ? 'قيود موثقة ومراجعة' : 'Verified Entries'}
          </span>
          <span className="text-lg font-black text-emerald-950 font-mono mt-1">
            {entries.filter(e => e.reviewStatus === 'Verified').length}
          </span>
        </div>
      </div>

      {/* Privilege Log Master Table */}
      <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs bg-white">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left rtl:text-right rtl:text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white font-display text-[11px] uppercase tracking-wider">
                <th className="p-3 border-b border-slate-800">{isRtl ? 'رقم القيد' : 'Control #'}</th>
                <th className="p-3 border-b border-slate-800">{isRtl ? 'التاريخ' : 'Doc Date'}</th>
                <th className="p-3 border-b border-slate-800">{isRtl ? 'المُرسِل / المحرر' : 'Author / Sender'}</th>
                <th className="p-3 border-b border-slate-800">{isRtl ? 'المستلم (المرسل إليه)' : 'Recipient(s)'}</th>
                <th className="p-3 border-b border-slate-800">{isRtl ? 'النوع' : 'Doc Type'}</th>
                <th className="p-3 border-b border-slate-800">{isRtl ? 'موضوع المستند' : 'Subject Matter'}</th>
                <th className="p-3 border-b border-slate-800">{isRtl ? 'نوع الحصانة المطالب بها' : 'Privilege Claimed'}</th>
                <th className="p-3 border-b border-slate-800">{isRtl ? 'التبرير القانوني المعتمد' : 'Justification Rationale'}</th>
                <th className="p-3 border-b border-slate-800 no-print text-center">{isRtl ? 'إجراءات' : 'Actions'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-teal-700" />
                    {isRtl ? 'جاري تحضير سجل الحصانة القضائية...' : 'Loading Privilege Log...'}
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-500">
                    <EyeOff className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="font-bold">{isRtl ? 'لا يوجد قيود حصانة مدونة لهذا الملف بعد.' : 'No privilege entries logged for this matter yet.'}</p>
                    <button
                      onClick={openAddModal}
                      className="mt-2 text-teal-800 font-bold underline cursor-pointer"
                    >
                      {isRtl ? 'إضافة أول قيد حصانة' : 'Add First Entry'}
                    </button>
                  </td>
                </tr>
              ) : (
                entries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors">
                    
                    {/* Control # */}
                    <td className="p-3 font-mono font-bold text-teal-900 whitespace-nowrap">
                      {entry.docControlNum}
                    </td>

                    {/* Date */}
                    <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                      {entry.docDate}
                    </td>

                    {/* Author */}
                    <td className="p-3 font-medium text-slate-800 max-w-[140px] truncate" title={entry.author}>
                      {entry.author}
                    </td>

                    {/* Recipients */}
                    <td className="p-3 font-medium text-slate-800 max-w-[140px] truncate" title={entry.recipients}>
                      {entry.recipients}
                    </td>

                    {/* Type */}
                    <td className="p-3 text-slate-700 whitespace-nowrap font-medium">
                      {entry.docType}
                    </td>

                    {/* Subject */}
                    <td className="p-3 font-semibold text-slate-900 max-w-[200px]" title={entry.subject}>
                      {entry.subject}
                    </td>

                    {/* Privilege Claimed Badge */}
                    <td className="p-3 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                        entry.privilegeClaimed === 'Attorney-Client Privilege'
                          ? 'bg-teal-100 text-teal-950 border-teal-300'
                          : entry.privilegeClaimed === 'Work-Product Doctrine'
                          ? 'bg-amber-100 text-amber-950 border-amber-300'
                          : 'bg-indigo-100 text-indigo-950 border-indigo-300'
                      }`}>
                        {entry.privilegeClaimed}
                      </span>
                    </td>

                    {/* Justification Rationale */}
                    <td className="p-3 text-[11px] text-slate-600 leading-relaxed max-w-[280px]">
                      {entry.justification}
                    </td>

                    {/* Actions */}
                    <td className="p-3 no-print text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => openEditModal(entry)}
                          className="p-1.5 text-slate-500 hover:text-teal-800 hover:bg-teal-50 rounded-lg transition-colors cursor-pointer"
                          title={isRtl ? 'تعديل' : 'Edit Entry'}
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(entry.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title={isRtl ? 'حذف' : 'Delete Entry'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Privilege Entry Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4 animate-in fade-in">
          <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-teal-100 bg-teal-50/80 flex justify-between items-center">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-teal-100 border border-teal-200 flex items-center justify-center text-teal-800">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 font-display">
                    {editingEntryId 
                      ? (isRtl ? 'تعديل قيد الحصانة القضائية' : 'Edit Privilege Log Entry') 
                      : (isRtl ? 'إضافة مستند إلى سجل الحصانة' : 'Add New Privilege Entry')}
                  </h3>
                  <p className="text-xs text-slate-600 font-medium">
                    {isRtl ? 'تحديد معايير السرية وتأصيل الأسباب الحاكمة للعدم الإفصاح' : 'Define discovery parameters and legal protection justification rationale'}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">

              {/* AI Assistant Banner */}
              <div className="bg-gradient-to-r from-teal-950 via-teal-900 to-teal-950 border border-teal-800 rounded-2xl p-3.5 text-white flex flex-col gap-2.5 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-teal-300 animate-pulse" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-teal-100">
                      {isRtl ? 'مساعد التبرير القانوني الذكي من جيمي' : 'AI Privilege Rationale Generator'}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <select
                    value={selectedDocForAi}
                    onChange={(e) => setSelectedDocForAi(e.target.value)}
                    className="w-full sm:w-auto flex-grow bg-slate-950 border border-teal-700 text-xs text-white rounded-xl p-2 focus:outline-none focus:border-teal-400"
                  >
                    <option value="">{isRtl ? '-- اختيار مستند قضائي للتحليل الذكي --' : '-- Select Existing Matter Document --'}</option>
                    {matterDocs.map(d => (
                      <option key={d.id} value={d.id}>{d.name} ({d.category})</option>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleAiPrivilegeAnalysis}
                    disabled={aiAnalyzing}
                    className="w-full sm:w-auto px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {aiAnalyzing ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        {isRtl ? 'جاري التحليل...' : 'Generating...'}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5" />
                        {isRtl ? 'توليد الصياغة القانونية' : 'Auto-Generate Justification'}
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Controls Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isRtl ? 'رقم الضبط والرمز (Control Number):' : 'Doc Control Number:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={docControlNum}
                    onChange={(e) => setDocControlNum(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono font-bold focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isRtl ? 'تاريخ المراسلة / المحرر:' : 'Document Date:'}
                  </label>
                  <input
                    type="date"
                    required
                    value={docDate}
                    onChange={(e) => setDocDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isRtl ? 'المحرر / المُرسِل:' : 'Author / Sender:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder={isRtl ? 'مثال: المحامي ألكسندر فاروق' : 'e.g. Farah Al-Sabah (Senior Associate)'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isRtl ? 'المُستلِم (Recipients):' : 'Recipient(s):'}
                  </label>
                  <input
                    type="text"
                    required
                    value={recipients}
                    onChange={(e) => setRecipients(e.target.value)}
                    placeholder={isRtl ? 'مثال: الرئيس التنفيذي للموكل' : 'e.g. Tariq Al-Tayer (Client CEO)'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-teal-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isRtl ? 'نوع المستند:' : 'Document Type:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={docType}
                    onChange={(e) => setDocType(e.target.value)}
                    placeholder={isRtl ? 'مثال: مذكرة رأي قانوني' : 'e.g. Legal Opinion Memo'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-teal-600"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isRtl ? 'نوع الحصانة المطالب بها:' : 'Privilege Doctrine Claimed:'}
                  </label>
                  <select
                    value={privilegeClaimed}
                    onChange={(e: any) => setPrivilegeClaimed(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-bold focus:outline-none focus:border-teal-600"
                  >
                    <option value="Attorney-Client Privilege">{isRtl ? 'حصانة سرية المحامي والموكل (Attorney-Client Privilege)' : 'Attorney-Client Privilege'}</option>
                    <option value="Work-Product Doctrine">{isRtl ? 'حصانة نتاج العمل القانوني (Work-Product Doctrine)' : 'Work-Product Doctrine'}</option>
                    <option value="Common Interest Privilege">{isRtl ? 'امتياز الدفاع المشترك (Common Interest Privilege)' : 'Common Interest Privilege'}</option>
                    <option value="Bank Confidentiality">{isRtl ? 'السرية المصرفية والقانونية (Bank Confidentiality)' : 'Bank Confidentiality'}</option>
                    <option value="Sharia Professional Secrecy">{isRtl ? 'السرية المهنية الشرعية (Sharia Professional Secrecy)' : 'Sharia Professional Secrecy'}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isRtl ? 'موضوع المستند المحجوب (Subject Matter):' : 'Document Subject Matter:'}
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder={isRtl ? 'موضوع موجز يوضح طبيعة المحرر دون كشف الاستراتيجية' : 'Summary of subject matter without disclosing privileged counsel strategy'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:outline-none focus:border-teal-600"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isRtl ? 'التبرير والتأصيل القانوني أمام هيئة المحكمة:' : 'Court Privilege Justification Rationale:'}
                </label>
                <textarea
                  rows={3}
                  required
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder={isRtl 
                    ? 'اكتب الأسباب القانونية التي تبرر الامتناع عن الإفصاح بناءً على توجيهات جيمي أو صياغة المكتب...' 
                    : 'Detail the legal grounds for withholding or redacting this document for discovery submission...'}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-800 focus:outline-none focus:border-teal-600 leading-relaxed font-sans"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition-colors"
                >
                  {isRtl ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-teal-800 text-white rounded-xl text-xs font-bold hover:bg-teal-900 transition-colors cursor-pointer shadow-sm"
                >
                  {editingEntryId ? (isRtl ? 'حفظ التعديلات' : 'Update Entry') : (isRtl ? 'حفظ القيد بالسجل' : 'Save Entry')}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

    </div>
  );
}

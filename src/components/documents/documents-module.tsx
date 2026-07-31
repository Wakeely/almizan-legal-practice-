'use client';

import React, { useState, useEffect } from 'react';
import { Folder, FileText, UploadCloud, Eye, EyeOff, Sparkles, RefreshCw, FileCheck, Check, Plus, HelpCircle, ShieldCheck, Scissors, Quote, Lock, AlertCircle } from 'lucide-react';
import { Document } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';
import { translateStaticText } from '@/lib/i18n';
import { saveItemsToOfflineStore, getByMatterIdFromOfflineStore, STORES } from '@/lib/offline-storage';
import { offlineFetch } from '@/lib/offline-fetch';
import { cacheDocumentBlob, getCachedDocumentBlob } from '@/lib/make-matter-available-offline';
import DocumentRedactionModal from '@/components/documents/document-redaction-modal';
import DepositionIndexerModule from '@/components/deposition/deposition-indexer-module';
import PrivilegeLogModule from '@/components/privilege/privilege-log-module';

interface DocumentsModuleProps {
  matterId: string;
  onRefreshExpenses?: () => void;
}

export default function DocumentsModule({ matterId, onRefreshExpenses }: DocumentsModuleProps) {
  const { t, isRtl } = useLanguage();
  const [activeTab, setActiveTab] = useState<'documents' | 'depositions' | 'privilege'>('documents');
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocCat, setNewDocCat] = useState('Pleading');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [aiAnalyzingId, setAiAnalyzingId] = useState<string | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [unlockedDocIds, setUnlockedDocIds] = useState<string[]>([]);
  const [showBiometricVerifyForDoc, setShowBiometricVerifyForDoc] = useState<Document | null>(null);
  const [showRedactionModalForDoc, setShowRedactionModalForDoc] = useState<Document | null>(null);

  const fetchDocs = async () => {
    setLoading(true);
    try {
      if (!navigator.onLine) {
        throw new Error('Offline');
      }
      const res = await fetch(`/api/matters/${matterId}/documents`);
      if (res.ok) {
        const data: Document[] = await res.json();
        setDocs(data);
        if (data.length > 0 && !selectedDoc) {
          setSelectedDoc(data[0]);
        }
        await saveItemsToOfflineStore(STORES.DOCUMENTS, data);
      } else {
        throw new Error('API Error');
      }
    } catch (err) {
      console.warn("Loading documents from IndexedDB cache:", err);
      const cached = await getByMatterIdFromOfflineStore<Document>(STORES.DOCUMENTS, matterId);
      if (cached && cached.length > 0) {
        setDocs(cached);
        if (!selectedDoc) {
          setSelectedDoc(cached[0]);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
    const handleUpdate = () => {
      fetchDocs();
    };
    window.addEventListener('docs-updated', handleUpdate);
    return () => {
      window.removeEventListener('docs-updated', handleUpdate);
    };
  }, [matterId]);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setNewDocName(file.name);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setNewDocName(file.name);
    }
  };

  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile && !newDocName) return;

    setUploading(true);
    setUploadError(null);
    try {
      if (selectedFile) {
        // Real file upload via multipart form data
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('name', newDocName || selectedFile.name);
        formData.append('category', newDocCat);
        formData.append('visibleToClient', 'false');

        const res = await fetch(`/api/matters/${matterId}/documents/upload`, {
          method: 'POST',
          body: formData,
        });

        if (res.ok) {
          const data = await res.json();
          setDocs(prev => [...prev, data]);
          setSelectedDoc(data);
          setNewDocName('');
          setSelectedFile(null);
        } else {
          const err = await res.json().catch(() => ({ error: 'Upload failed' }));
          setUploadError(err.error || 'Upload failed. Please try again.');
          console.error('Upload error:', err);
        }
      } else {
        // Fallback: metadata-only creation (no file, for backward compat)
        const sizeStr = `${(Math.random() * 4 + 1).toFixed(1)} MB`;
        const res = await fetch('/api/documents', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            matterId,
            name: newDocName,
            category: newDocCat,
            fileSize: sizeStr,
            uploadedBy: "Farah Al-Sabah (Senior Associate)",
            visibleToClient: false
          })
        });

        if (res.ok) {
          const data = await res.json();
          setDocs(prev => [...prev, data]);
          setSelectedDoc(data);
          setNewDocName('');
        } else {
          setUploadError('Failed to create document. Please try again.');
        }
      }
    } catch (err) {
      setUploadError('Network error during upload. Please check your connection.');
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  const handleDownload = async (docId: string, docName: string) => {
    setDownloadingDocId(docId);
    try {
      // If we're offline, try the cached blob first (Phase 4.14).
      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        const cachedBlob = await getCachedDocumentBlob(docId);
        if (cachedBlob) {
          const url = URL.createObjectURL(cachedBlob);
          const a = document.createElement('a');
          a.href = url;
          a.download = docName || 'document';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          return;
        }
        setUploadError('Document not available offline. Connect to the internet to download it the first time.');
        return;
      }

      const res = await fetch(`/api/documents/${docId}/file`, {
        credentials: 'same-origin', // ensures session cookie is sent
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Download failed' }));
        setUploadError(err.error || `Download failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      // Phase 4.14: cache the binary so a subsequent offline open works.
      await cacheDocumentBlob(docId, blob);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = docName || 'document';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      // Last-resort: try cached blob.
      const cachedBlob = await getCachedDocumentBlob(docId);
      if (cachedBlob) {
        const url = URL.createObjectURL(cachedBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = docName || 'document';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }
      setUploadError('Network error during download.');
      console.error(err);
    } finally {
      setDownloadingDocId(null);
    }
  };

  const toggleClientVisibility = async (doc: Document) => {
    const updatedVisible = !doc.visibleToClient;
    try {
      const res = await offlineFetch(`/api/documents/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibleToClient: updatedVisible })
      });
      if (res.ok) {
        // Optimistic UI update (works for both online success and queued offline).
        setDocs(prev => prev.map(d => d.id === doc.id ? { ...d, visibleToClient: updatedVisible } : d));
        if (selectedDoc && selectedDoc.id === doc.id) {
          setSelectedDoc(prev => prev ? { ...prev, visibleToClient: updatedVisible } : null);
        }
        // Persist optimistic state to offline cache so it survives refresh.
        const updated = { ...doc, visibleToClient: updatedVisible };
        await saveItemsToOfflineStore(STORES.DOCUMENTS, updated);
      } else {
        setUploadError('Failed to toggle visibility. Please try again.');
      }
    } catch (err) {
      setUploadError('Network error. Please try again.');
      console.error(err);
    }
  };

  const triggerGeminiSummarization = async (docId: string, docName: string, category: string) => {
    setAiAnalyzingId(docId);
    try {
      const res = await fetch('/api/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: docId })
      });
      if (res.ok) {
        const data = await res.json();
        // Merge the AI response into the existing doc — don't replace the whole doc
        setDocs(prev => prev.map(d => d.id === docId ? {
          ...d,
          aiSummary: data.summary,
          aiTags: data.tags || []
        } : d));
        if (selectedDoc && selectedDoc.id === docId) {
          setSelectedDoc(prev => prev ? {
            ...prev,
            aiSummary: data.summary,
            aiTags: data.tags || []
          } : null);
        }
      } else {
        const err = await res.json().catch(() => ({ error: 'AI summary failed' }));
        setUploadError(err.error || 'Failed to generate AI summary.');
      }
    } catch (err) {
      setUploadError('Network error during AI summary.');
      console.error(err);
    } finally {
      setAiAnalyzingId(null);
    }
  };

  const handleSaveRedactedDocument = async (redactedDocData: Partial<Document>) => {
    if (!showRedactionModalForDoc) return;
    try {
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matterId,
          name: redactedDocData.name,
          category: showRedactionModalForDoc.category,
          fileSize: showRedactionModalForDoc.fileSize,
          uploadedBy: "Farah Al-Sabah (Redaction Engine)",
          visibleToClient: false,
          isRedacted: true,
          redactionCount: redactedDocData.redactionCount,
          aiSummary: redactedDocData.aiSummary
        })
      });
      if (res.ok) {
        const newDoc = await res.json();
        setDocs(prev => [...prev, newDoc]);
        setSelectedDoc(newDoc);
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 shadow-sm flex flex-col h-full gap-3.5 sm:gap-5" id="documents-module">
      
      {/* Module Title & Discovery Sub-Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between border-b border-slate-100 pb-2.5 sm:pb-4 gap-3">
        <div className="flex items-center gap-2">
          <Folder className="w-5 h-5 text-teal-800 shrink-0" />
          <h3 className="text-base sm:text-lg font-extrabold text-slate-900 font-display">{t.docManagement}</h3>
        </div>

        {/* Navigation Sub-Tabs */}
        <div className="flex items-center p-1 bg-slate-100/90 rounded-2xl border border-slate-200 text-xs font-bold font-display">
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'documents'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Folder className="w-3.5 h-3.5" />
            {isRtl ? 'المستندات والقضايا' : 'Case Documents'}
            <span className="ml-1 px-1.5 py-0.2 bg-teal-900 text-teal-100 rounded-full text-[10px] font-mono font-bold">
              {docs.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('depositions')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'depositions'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Quote className="w-3.5 h-3.5" />
            {isRtl ? 'فهرس استجواب الشهود' : 'Deposition Indexer'}
          </button>

          <button
            onClick={() => setActiveTab('privilege')}
            className={`px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'privilege'
                ? 'bg-teal-800 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            {isRtl ? 'سجل الحصانة المعتمد' : 'Court Privilege Log'}
          </button>
        </div>
      </div>

      {/* Main Tab Views */}
      {activeTab === 'depositions' ? (
        <DepositionIndexerModule matterId={matterId} />
      ) : activeTab === 'privilege' ? (
        <PrivilegeLogModule matterId={matterId} />
      ) : (
        /* Grid: Left Column (Document List & Upload) | Right Column (File Details & AI summaries) */
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6 flex-grow overflow-hidden">
          {/* Left Hand: Upload & List */}
          <div className="flex flex-col gap-4 overflow-y-auto max-h-[480px] pr-1">
          {/* Upload Box */}
          <form onSubmit={handleUploadSubmit} className="space-y-3">
            {uploadError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold p-2.5 rounded-xl flex items-center gap-2 animate-in fade-in">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{uploadError}</span>
                <button type="button" onClick={() => setUploadError(null)} className="ms-auto text-rose-400 hover:text-rose-600 cursor-pointer shrink-0">
                  ×
                </button>
              </div>
            )}
            <div
              onDragEnter={handleDrag}
              onDragOver={handleDrag}
              onDragLeave={handleDrag}
              onDrop={handleDrop}
              onClick={() => document.getElementById('file-input-' + matterId)?.click()}
              className={`border-2 border-dashed rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-1.5 ${
                dragActive ? 'border-indigo-500 bg-indigo-50/40' : 'border-slate-200 bg-slate-50 hover:bg-slate-50/80'
              } ${selectedFile ? 'border-emerald-400 bg-emerald-50/40' : ''}`}
            >
              <input
                id={`file-input-${matterId}`}
                type="file"
                className="hidden"
                onChange={handleFileSelect}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.png,.jpg,.jpeg,.gif,.webp,.zip"
              />
              <UploadCloud className={`w-7 h-7 ${selectedFile ? 'text-emerald-500' : 'text-slate-400'}`} />
              {selectedFile ? (
                <>
                  <p className="text-xs font-semibold text-emerald-700">{selectedFile.name}</p>
                  <p className="text-[10px] text-slate-400">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB — {isRtl ? 'اضغط للتغيير' : 'Click to change'}</p>
                </>
              ) : (
                <>
                  <p className="text-xs font-semibold text-slate-600">{t.dragDrop}</p>
                  <p className="text-[10px] text-slate-400">{t.fileLimits}</p>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                placeholder={t.fileNamePlaceholder}
                value={newDocName}
                onChange={e => setNewDocName(e.target.value)}
                className="flex-grow text-xs border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <select
                value={newDocCat}
                onChange={e => setNewDocCat(e.target.value)}
                className="text-xs border border-slate-200 rounded-xl px-2.5 py-2.5 bg-white text-slate-600 focus:outline-none"
              >
                <option value="Pleading">{isRtl ? 'لائحة دعوى' : 'Pleading'}</option>
                <option value="Discovery">{isRtl ? 'إفصاح' : 'Discovery'}</option>
                <option value="Evidence">{isRtl ? 'بينة / دليل' : 'Evidence'}</option>
                <option value="Contract">{isRtl ? 'عقد' : 'Contract'}</option>
                <option value="Corporate">{isRtl ? 'شركات' : 'Corporate'}</option>
              </select>
              <button
                type="submit"
                disabled={uploading || !newDocName}
                className="px-3.5 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 transition-colors flex items-center gap-1 disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                {t.addFile}
              </button>
            </div>
          </form>

          {/* List of Files */}
          <div className="space-y-2">
            {loading ? (
              <div className="flex justify-center items-center py-10">
                <RefreshCw className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : docs.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-8">{t.noDocs}</p>
            ) : (
              docs.map(doc => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDoc(doc)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex justify-between items-center ${
                    selectedDoc?.id === doc.id
                      ? 'bg-indigo-50/50 border-indigo-200 shadow-sm'
                      : 'border-slate-100 bg-white hover:bg-slate-50/50'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <FileText className="w-4.5 h-4.5 text-indigo-600" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{translateStaticText(doc.name, isRtl)}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] uppercase tracking-wider bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-bold">
                          {isRtl ? (
                            doc.category === 'Pleading' ? 'لائحة دعوى' :
                            doc.category === 'Discovery' ? 'إفصاح' :
                            doc.category === 'Evidence' ? 'بينة' :
                            doc.category === 'Contract' ? 'عقد' :
                            doc.category === 'Corporate' ? 'شركات' : doc.category
                          ) : doc.category}
                        </span>
                        <span className="text-[9px] text-slate-400 font-mono">{isRtl ? 'إصدار' : 'v'}{doc.version} • {doc.fileSize}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions for client visibility toggle */}
                  <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => toggleClientVisibility(doc)}
                      title={doc.visibleToClient ? t.visiblePortal : t.internalOffice}
                      className={`p-1.5 rounded-lg border transition-all ${
                        doc.visibleToClient
                          ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
                      }`}
                    >
                      {doc.visibleToClient ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>

                    {/* Document Redaction Action */}
                    <button
                      onClick={() => setShowRedactionModalForDoc(doc)}
                      title={isRtl ? 'طمس وتنقيح البيانات السرية' : 'Redact & Blackout Sensitive Data'}
                      className="p-1.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 shadow-xs transition-all cursor-pointer"
                    >
                      <Scissors className="w-3.5 h-3.5" />
                    </button>

                    {/* AI Summarize action */}
                    <button
                      onClick={() => triggerGeminiSummarization(doc.id, doc.name, doc.category)}
                      disabled={aiAnalyzingId === doc.id}
                      title={isRtl ? 'بدء تحليل البنود عبر جيمي' : 'Run AI Clause Review via Gemini'}
                      className="p-1.5 rounded-lg border border-indigo-100 bg-white text-indigo-600 hover:bg-indigo-50 shadow-sm transition-all disabled:opacity-40 cursor-pointer"
                    >
                      {aiAnalyzingId === doc.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Hand: Selected File Details & AI summary */}
        <div className="bg-slate-50/50 rounded-2xl border border-slate-100 p-5 flex flex-col justify-between overflow-y-auto max-h-[480px]">
          {selectedDoc ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              <div className="border-b border-slate-200/60 pb-3">
                <span className="text-[9px] font-bold text-indigo-600 uppercase tracking-widest">
                  {isRtl ? 'مستند' : 'DOCUMENT'} - {isRtl ? (
                    selectedDoc.category === 'Pleading' ? 'لائحة دعوى' :
                    selectedDoc.category === 'Discovery' ? 'إفصاح' :
                    selectedDoc.category === 'Evidence' ? 'بينة / دليل' :
                    selectedDoc.category === 'Contract' ? 'عقد' :
                    selectedDoc.category === 'Corporate' ? 'شركات' : selectedDoc.category
                  ) : selectedDoc.category}
                </span>
                <h4 className="text-sm font-bold text-slate-800 font-display mt-0.5">{translateStaticText(selectedDoc.name, isRtl)}</h4>
                <p className="text-[10px] text-slate-400 mt-1">
                  {isRtl ? (
                    `تم الرفع بتاريخ ${new Date(selectedDoc.uploadedAt).toLocaleDateString()} بواسطة ${selectedDoc.uploadedBy.includes('Farah') ? 'المستشار فرح الصباح' : selectedDoc.uploadedBy}`
                  ) : (
                    `Uploaded at ${new Date(selectedDoc.uploadedAt).toLocaleDateString()} by ${selectedDoc.uploadedBy}`
                  )}
                </p>
              </div>

              {/* Status Toggles Display */}
              <div className="flex gap-2 flex-wrap items-center">
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md flex items-center gap-1 border ${
                  selectedDoc.visibleToClient
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    : 'bg-slate-100 border-slate-200 text-slate-400'
                }`}>
                  <Eye className="w-3 h-3" />
                  {selectedDoc.visibleToClient ? t.visiblePortal : t.internalOffice}
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 bg-white border border-slate-200 text-slate-500 rounded-md flex items-center gap-1 font-mono">
                  {t.version} {selectedDoc.version}.0
                </span>
                <button
                  onClick={() => setShowRedactionModalForDoc(selectedDoc)}
                  className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-md flex items-center gap-1 transition-colors cursor-pointer ms-auto"
                >
                  <Scissors className="w-3 h-3" />
                  {isRtl ? 'طمس وتنقيح سرّي' : 'Redact Canvas'}
                </button>
                <button
                  onClick={() => handleDownload(selectedDoc.id, selectedDoc.name)}
                  disabled={downloadingDocId === selectedDoc.id}
                  className="text-[9px] font-bold uppercase tracking-wider px-2 py-1 bg-teal-50 hover:bg-teal-100 border border-teal-200 text-teal-700 rounded-md flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                >
                  {downloadingDocId === selectedDoc.id ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <FileText className="w-3 h-3" />
                  )}
                  {downloadingDocId === selectedDoc.id
                    ? (isRtl ? 'جاري التحميل...' : 'Downloading...')
                    : (isRtl ? 'عرض/تحميل' : 'View/Download')}
                </button>
              </div>

              {/* AI Clause analysis & Summarization body */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center gap-1.5 text-indigo-600">
                  <Sparkles className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">{t.aiSummaryHeader}</span>
                </div>

                <div className="bg-white border border-slate-200/80 p-4 rounded-xl text-xs text-slate-600 leading-relaxed shadow-sm">
                  {translateStaticText(selectedDoc.aiSummary || '', isRtl) || (isRtl ? "لا يوجد ملخص متاح بعد. اضغط على زر النجمة لتشغيل مراجعة جيمي للبنود واستخراج المخاطر." : "No summary available yet. Click the Sparkles button next to the file to run a deep litigation clause analysis via Gemini.")}
                </div>

                {selectedDoc.aiTags && selectedDoc.aiTags.length > 0 && (
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">{t.aiTagsHeader}</span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedDoc.aiTags.map((tag, idx) => (
                        <span key={idx} className="bg-indigo-50 border border-indigo-100 text-indigo-600 text-[10px] font-bold px-2.5 py-1 rounded-full">
                          #{translateStaticText(tag, isRtl)}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="h-full flex flex-col justify-center items-center text-center text-slate-400 py-10 gap-2">
              <FileCheck className="w-10 h-10 text-slate-300" />
              <p className="text-xs">{t.selectDocPrompt}</p>
            </div>
          )}

          {selectedDoc && !selectedDoc.aiSummary && (
            <div className="mt-5 border-t border-slate-200/60 pt-4">
              <button
                onClick={() => triggerGeminiSummarization(selectedDoc.id, selectedDoc.name, selectedDoc.category)}
                disabled={aiAnalyzingId === selectedDoc.id}
                className="w-full py-2 bg-indigo-600 text-white rounded-xl text-xs font-semibold shadow-sm hover:bg-indigo-700 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {aiAnalyzingId === selectedDoc.id ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    {t.analyzingText}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    {t.triggerAnalysis}
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Interactive Document Redaction Modal */}
      {showRedactionModalForDoc && (
        <DocumentRedactionModal
          isOpen={true}
          document={showRedactionModalForDoc}
          onClose={() => setShowRedactionModalForDoc(null)}
          onSaveRedactedDocument={handleSaveRedactedDocument}
        />
      )}
    </div>
  );
}

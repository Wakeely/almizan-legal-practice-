'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  DollarSign, Clock, Receipt, Play, Pause, Square, Plus, RefreshCw, Check, 
  CheckCircle2, TrendingUp, Landmark, FileText, Download, Printer, Sparkles, 
  Tag, Code, Eye, X, FileCheck
} from 'lucide-react';
import { TimeEntry, Invoice, Matter } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';
import { translateStaticText } from '@/lib/i18n';
import { saveItemsToOfflineStore, getByMatterIdFromOfflineStore, STORES } from '@/lib/offline-storage';
import { offlineFetch, isQueuedOfflineResponse } from '@/lib/offline-fetch';

interface BillingModuleProps {
  activeMatter: Matter;
  onRefreshMatter: () => void;
}

// Common UTBMS Task & Activity Codes
const UTBMS_TASK_CODES = [
  { code: 'L110', label: 'L110 - Fact Investigation / Development' },
  { code: 'L120', label: 'L120 - Analysis / Strategy' },
  { code: 'L210', label: 'L210 - Pleadings' },
  { code: 'L220', label: 'L220 - Preliminary Motions' },
  { code: 'L310', label: 'L310 - Written Discovery' },
  { code: 'L330', label: 'L330 - Depositions' },
  { code: 'L410', label: 'L410 - Trial Preparation' },
  { code: 'L420', label: 'L420 - Trial Attendance' },
  { code: 'A102', label: 'A102 - Legal Research' },
];

const UTBMS_ACTIVITY_CODES = [
  { code: 'A101', label: 'A101 - Plan and prepare for' },
  { code: 'A102', label: 'A102 - Research' },
  { code: 'A103', label: 'A103 - Draft / Revise' },
  { code: 'A104', label: 'A104 - Review / Analyze' },
  { code: 'A105', label: 'A105 - Communicate (Client / Opposing Counsel)' },
  { code: 'A106', label: 'A106 - Court Appearance / Hearing' },
];

export default function BillingModule({ activeMatter, onRefreshMatter }: BillingModuleProps) {
  const { t, isRtl } = useLanguage();
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);

  // Manual Time form
  const [showTimeForm, setShowTimeForm] = useState(false);
  const [manualHours, setManualHours] = useState('');
  const [manualDesc, setManualDesc] = useState('');
  const [manualRate, setManualRate] = useState(150);
  const [taskCode, setTaskCode] = useState('L120');
  const [activityCode, setActivityCode] = useState('A103');
  const [savingTime, setSavingTime] = useState(false);
  const [classifyingAI, setClassifyingAI] = useState(false);

  // Dynamic Stopwatch State
  const [timerStatus, setTimerStatus] = useState<'idle' | 'running' | 'paused'>('idle');
  const [timerSeconds, setTimerSeconds] = useState(0);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Invoice Preview & LEDES Modal
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [taxRate, setTaxRate] = useState<number>(0.05); // 5% VAT default

  const fetchBilling = async () => {
    setLoading(true);
    try {
      if (!navigator.onLine) {
        throw new Error('Offline');
      }
      const res = await fetch(`/api/matters/${activeMatter.id}/billing`);
      if (res.ok) {
        const data = await res.json();
        setEntries(data.timeEntries || []);
        setInvoices(data.invoices || []);
        if (data.timeEntries) {
          await saveItemsToOfflineStore(STORES.TIME_ENTRIES, data.timeEntries);
        }
        if (data.invoices) {
          await saveItemsToOfflineStore(STORES.INVOICES, data.invoices);
        }
      } else {
        throw new Error('API Error');
      }
    } catch (err) {
      console.warn("Loading billing data from IndexedDB cache:", err);
      const cachedEntries = await getByMatterIdFromOfflineStore<TimeEntry>(STORES.TIME_ENTRIES, activeMatter.id);
      const cachedInvoices = await getByMatterIdFromOfflineStore<Invoice>(STORES.INVOICES, activeMatter.id);
      if (cachedEntries) setEntries(cachedEntries);
      if (cachedInvoices) setInvoices(cachedInvoices);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBilling();
    return () => {
      if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    };
  }, [activeMatter.id]);

  // Stopwatch controls
  const handleStartTimer = () => {
    setTimerStatus('running');
    if (!timerIntervalRef.current) {
      timerIntervalRef.current = setInterval(() => {
        setTimerSeconds(prev => prev + 1);
      }, 1000);
    }
  };

  const handlePauseTimer = () => {
    setTimerStatus('paused');
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  };

  const handleStopTimer = async () => {
    setTimerStatus('idle');
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    const elapsedHours = Number((timerSeconds / 3600).toFixed(2));
    if (elapsedHours < 0.01) {
      alert(isRtl ? "تنبيه: الوقت المسجل قصير جداً ليتم قيده (أقل من ٣٠ ثانية)." : "Timer was too short to record (< 30 seconds).");
      setTimerSeconds(0);
      return;
    }

    const desc = prompt(
      isRtl 
        ? "تم تسجيل الوقت عبر ساعة التتبع! يرجى إدخال وصف مبسط للعمل المنجز:" 
        : "Stopwatch Recorded! Enter description for this time block:", 
      isRtl ? "مراجعة وصياغة المذكرات القانونية" : "Case material analysis & legal drafting"
    );
    if (desc === null) {
      setTimerSeconds(0);
      return;
    }

    try {
      const payload = {
        matterId: activeMatter.id,
        description: desc || (isRtl ? "عمل مقيد بساعة التتبع" : "Logged via Stopwatch"),
        hours: elapsedHours,
        rate: manualRate,
        taskCode: 'L120',
        activityCode: 'A103'
      };
      const res = await offlineFetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        // If queued offline, synthesize a local TimeEntry with a temp id.
        const newEntry: TimeEntry = isQueuedOfflineResponse(res)
          ? {
              id: `offline-${Date.now()}`,
              organizationId: '',
              date: new Date().toISOString().split('T')[0],
              billed: false,
              ...payload
            } as TimeEntry
          : data;
        setEntries(prev => [newEntry, ...prev]);
        await saveItemsToOfflineStore(STORES.TIME_ENTRIES, newEntry);
        setTimerSeconds(0);
        if (!isQueuedOfflineResponse(res)) onRefreshMatter();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleAIClassifyLEDES = async () => {
    if (!manualDesc) return;
    setClassifyingAI(true);
    try {
      const res = await fetch('/api/ai/ledes-classify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: manualDesc, lang: isRtl ? 'ar' : 'en' })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.taskCode) setTaskCode(data.taskCode);
        if (data.activityCode) setActivityCode(data.activityCode);
        if (data.standardizedDescription) setManualDesc(data.standardizedDescription);
      }
    } catch (err) {
      console.error("LEDES classification error:", err);
    } finally {
      setClassifyingAI(false);
    }
  };

  const formatTimer = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const handleCreateTimeEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualHours || !manualDesc) return;

    setSavingTime(true);
    try {
      const payload = {
        matterId: activeMatter.id,
        description: manualDesc,
        hours: Number(manualHours),
        rate: Number(manualRate),
        taskCode,
        activityCode
      };
      const res = await offlineFetch('/api/time-entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        const newEntry: TimeEntry = isQueuedOfflineResponse(res)
          ? {
              id: `offline-${Date.now()}`,
              organizationId: '',
              date: new Date().toISOString().split('T')[0],
              billed: false,
              ...payload
            } as TimeEntry
          : data;
        setEntries(prev => [newEntry, ...prev]);
        await saveItemsToOfflineStore(STORES.TIME_ENTRIES, newEntry);
        setShowTimeForm(false);
        setManualHours('');
        setManualDesc('');
        if (!isQueuedOfflineResponse(res)) onRefreshMatter();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSavingTime(false);
    }
  };

  const handleGenerateInvoice = async () => {
    try {
      const res = await offlineFetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matterId: activeMatter.id })
      });
      if (res.ok) {
        const data = await res.json();
        const newInvoice: Invoice = isQueuedOfflineResponse(res)
          ? {
              id: `offline-${Date.now()}`,
              organizationId: '',
              invoiceNumber: `DRAFT-${Date.now()}`,
              totalAmount: 0,
              status: 'Draft',
              dueDate: new Date().toISOString().split('T')[0],
              ...data,
              matterId: activeMatter.id
            } as Invoice
          : data;
        setInvoices(prev => [newInvoice, ...prev]);
        await saveItemsToOfflineStore(STORES.INVOICES, newInvoice);
        if (!isQueuedOfflineResponse(res)) {
          fetchBilling();
          onRefreshMatter();
        }
      } else {
        const errData = await res.json().catch(() => ({ error: 'Generate failed' }));
        alert(errData.error || (isRtl ? "لا يمكن إصدار فاتورة جديدة حالياً." : "Cannot generate invoice."));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleMarkInvoicePaid = async (invId: string) => {
    const target = invoices.find(i => i.id === invId);
    if (!target) return;
    try {
      const res = await offlineFetch(`/api/invoices/${invId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'Paid', paymentTxId: `TXN-CLIQU-${Math.floor(1000 + Math.random() * 9000)}` })
      });
      if (res.ok) {
        if (isQueuedOfflineResponse(res)) {
          // Optimistic offline update — synthesize the updated invoice.
          const updated: Invoice = {
            ...target,
            status: 'Paid',
            paymentTxId: `TXN-PENDING-${Date.now()}`
          };
          setInvoices(prev => prev.map(inv => inv.id === invId ? updated : inv));
          if (selectedInvoice && selectedInvoice.id === invId) {
            setSelectedInvoice(updated);
          }
          await saveItemsToOfflineStore(STORES.INVOICES, updated);
        } else {
          const updated = await res.json();
          setInvoices(prev => prev.map(inv => inv.id === invId ? updated : inv));
          if (selectedInvoice && selectedInvoice.id === invId) {
            setSelectedInvoice(updated);
          }
          await saveItemsToOfflineStore(STORES.INVOICES, updated);
          onRefreshMatter();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Export Raw LEDES 1998B Pipe-Delimited File
  const handleExportLEDES1998B = (inv: Invoice) => {
    const invDate = inv.issueDate || new Date().toISOString().split('T')[0];
    const clientName = activeMatter.clientName || 'Client';
    
    // LEDES 1998B Header format
    let ledesText = `INVOICE_DATE|INVOICE_NUMBER|CLIENT_ID|LAW_FIRM_MATTER_ID|INVOICE_TOTAL|INVOICE_TAX|LINE_ITEM_NUMBER|EXP/FEE/CHARGE_TYPE|LINE_ITEM_NUMBER_OF_UNITS|LINE_ITEM_UNIT_COST|LINE_ITEM_TOTAL|TIMEKEEPER_ID|LINE_ITEM_DATE|LINE_ITEM_DESCRIPTION|TASK_CODE|ACTIVITY_CODE\n`;

    entries.forEach((entry, idx) => {
      const itemTotal = (entry.hours * entry.rate).toFixed(2);
      const line = `${invDate}|${inv.invoiceNumber}|${clientName.replace(/\|/g, '')}|${activeMatter.id}|${inv.totalAmount.toFixed(2)}|0.00|${idx + 1}|F|${entry.hours.toFixed(2)}|${entry.rate.toFixed(2)}|${itemTotal}|TK001|${entry.date}|${entry.description.replace(/\|/g, '')}|${entry.taskCode || 'L120'}|${entry.activityCode || 'A103'}\n`;
      ledesText += line;
    });

    const blob = new Blob([ledesText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${inv.invoiceNumber}_LEDES1998B.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const getInvoiceStatusLocalized = (status: string) => {
    if (!isRtl) return status;
    switch (status) {
      case 'Draft': return 'مسودة';
      case 'Sent': return 'مُرسلة';
      case 'Paid': return 'مدفوعة';
      default: return status;
    }
  };

  const unbilledHours = entries.filter(e => !e.billed).reduce((acc, curr) => acc + curr.hours, 0);
  const unbilledAmount = entries.filter(e => !e.billed).reduce((acc, curr) => acc + (curr.hours * curr.rate), 0);
  const totalBilled = invoices.reduce((acc, curr) => acc + curr.totalAmount, 0);
  const totalPaid = invoices.filter(i => i.status === 'Paid').reduce((acc, curr) => acc + curr.totalAmount, 0);

  return (
    <div className="bg-card border border-border rounded-xl p-4 md:p-5 shadow-sm flex flex-col h-full gap-3.5 sm:gap-5" id="billing-module">
      
      {/* Module Header */}
      <div className="flex justify-between items-center border-b border-border pb-2.5 sm:pb-4">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-primary shrink-0" />
          <h3 className="text-base sm:text-lg font-bold text-foreground font-display">{t.billingTitle}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase font-bold tracking-widest bg-muted text-muted-foreground px-2.5 py-1 rounded-md font-mono">
            UTBMS / LEDES 1998B Compliant
          </span>
          <span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground font-mono">
            {isRtl ? 'الأرقام بالدينار الأردني JOD' : 'Billed in JOD'}
          </span>
        </div>
      </div>

      {/* Trust Ledger & Financial Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">{t.unbilledLedger}</span>
            <span className="text-xl font-bold text-foreground font-display mt-1 block">{unbilledAmount.toLocaleString()} {isRtl ? 'د.أ' : 'JOD'}</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-mono mt-2 block">{unbilledHours.toFixed(1)} {t.outstanding}</span>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest block">{t.sentInvoices}</span>
            <span className="text-xl font-bold text-foreground font-display mt-1 block">{totalBilled.toLocaleString()} {isRtl ? 'د.أ' : 'JOD'}</span>
          </div>
          <button
            onClick={handleGenerateInvoice}
            disabled={unbilledAmount === 0}
            className="mt-2 text-[10px] font-extrabold uppercase tracking-widest bg-primary text-primary-foreground px-3 py-1.5 rounded-lg transition-colors text-center disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer"
          >
            {t.generateInvoice}
          </button>
        </div>

        <div className="bg-card border border-border p-4 rounded-xl flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block">{t.trustFunds}</span>
            <span className="text-xl font-bold text-foreground font-display mt-1 block">{totalPaid.toLocaleString()} {isRtl ? 'د.أ' : 'JOD'}</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-semibold mt-2 block">{t.realization}: {totalBilled > 0 ? ((totalPaid/totalBilled)*100).toFixed(0) : 100}%</span>
        </div>
      </div>

      {/* Stopwatch & Live Timer Controls */}
      <div className="bg-card border border-border rounded-xl p-4 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className={`p-2.5 rounded-lg ${timerStatus === 'running' ? 'bg-emerald-100 text-emerald-700 animate-pulse' : 'bg-primary/10 text-primary'}`}>
            <Clock className="w-5 h-5" />
          </div>
          <div className="min-w-[140px]">
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-extrabold text-muted-foreground uppercase tracking-wider block">{t.stopwatchTitle}</span>
              {timerStatus === 'running' && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />}
            </div>
            <span className="text-lg font-extrabold text-foreground font-mono mt-0.5 block">
              {formatTimer(timerSeconds)}
            </span>
            <span className="text-[10px] text-muted-foreground font-mono">
              {(timerSeconds / 3600).toFixed(2)} hrs • ~{((timerSeconds / 3600) * manualRate).toFixed(0)} JOD
            </span>
          </div>

          <div className="flex gap-1.5 ml-3">
            {timerStatus === 'idle' ? (
              <button
                onClick={handleStartTimer}
                className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold shadow-md transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5 fill-white" /> {t.startActive}
              </button>
            ) : timerStatus === 'running' ? (
              <button
                onClick={handlePauseTimer}
                className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-amber-700 transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Pause className="w-3.5 h-3.5 fill-white" /> {isRtl ? 'إيقاف مؤقت' : 'Pause'}
              </button>
            ) : (
              <button
                onClick={handleStartTimer}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-emerald-700 transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5 fill-white" /> {isRtl ? 'استئناف' : 'Resume'}
              </button>
            )}

            {timerStatus !== 'idle' && (
              <button
                onClick={handleStopTimer}
                className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold shadow-md hover:bg-rose-700 transition-colors flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <Square className="w-3.5 h-3.5 fill-white" /> {t.stopLog}
              </button>
            )}
          </div>
        </div>

        {/* Trigger manual input */}
        <button
          onClick={() => setShowTimeForm(!showTimeForm)}
          className="text-xs font-bold text-foreground bg-card border border-border hover:bg-background px-4 py-2 rounded-xl shadow-xs cursor-pointer shrink-0 w-full md:w-auto text-center flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5 text-primary" />
          {showTimeForm ? (isRtl ? 'إخفاء الإدخال اليدوي' : 'Hide Manual Log') : t.manualLogBtn}
        </button>
      </div>

      {/* Manual log Form with UTBMS / LEDES Codes */}
      {showTimeForm && (
        <form onSubmit={handleCreateTimeEntry} className="bg-background p-4 border border-border rounded-xl space-y-3 animate-in fade-in duration-200">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <div className="flex justify-between items-center mb-1">
                <label className="text-[10px] font-bold text-muted-foreground uppercase">{t.timeEntryDesc}</label>
                <button
                  type="button"
                  onClick={handleAIClassifyLEDES}
                  disabled={classifyingAI || !manualDesc}
                  className="text-[10px] font-extrabold text-primary hover:text-primary disabled:opacity-40 flex items-center gap-1 cursor-pointer"
                >
                  {classifyingAI ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {isRtl ? 'تصنيف UTBMS تلقائياً بالذكاء' : 'AI UTBMS Auto-Classify'}
                </button>
              </div>
              <input
                type="text"
                required
                placeholder={isRtl ? "مثال: مراجعة وصياغة بنود مذكرة الدفاع لمركز التحكيم" : "e.g. Defense drafting for SCCA Arbitration tribunal"}
                value={manualDesc}
                onChange={e => setManualDesc(e.target.value)}
                className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">{t.logHoursLabel}</label>
              <input
                type="number"
                step="0.1"
                required
                placeholder="2.5"
                value={manualHours}
                onChange={e => setManualHours(e.target.value)}
                className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors font-mono font-bold"
              />
            </div>
          </div>

          {/* UTBMS Task & Activity Code Selectors */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                UTBMS Task Code:
              </label>
              <select
                value={taskCode}
                onChange={e => setTaskCode(e.target.value)}
                className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
              >
                {UTBMS_TASK_CODES.map(tc => (
                  <option key={tc.code} value={tc.code}>{tc.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-muted-foreground uppercase mb-1">
                UTBMS Activity Code:
              </label>
              <select
                value={activityCode}
                onChange={e => setActivityCode(e.target.value)}
                className="w-full text-xs border border-border rounded-lg px-3 py-2 bg-background focus:outline-none focus:ring-2 focus:ring-ring/50 transition-colors"
              >
                {UTBMS_ACTIVITY_CODES.map(ac => (
                  <option key={ac.code} value={ac.code}>{ac.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowTimeForm(false)}
              className="px-3.5 py-1.5 text-xs text-muted-foreground hover:bg-muted rounded-lg cursor-pointer"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={savingTime}
              className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-bold transition-colors disabled:opacity-50 cursor-pointer flex items-center gap-1"
            >
              {savingTime && <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />}
              {t.saveTime}
            </button>
          </div>
        </form>
      )}

      {/* List grids: Left Side (Time entries list) | Right Side (Invoices list) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-h-[360px] overflow-hidden">
        
        {/* Time ledger */}
        <div className="overflow-y-auto pr-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">{t.hoursLogged}</span>
          <div className="space-y-2">
            {entries.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-xl">
                {t.emptyTimeLedger}
              </p>
            ) : (
              entries.map(te => (
                <div key={te.id} className="p-3 bg-background/60 border border-border rounded-xl flex justify-between items-center text-xs">
                  <div>
                    <p className="font-bold text-foreground leading-snug">{translateStaticText(te.description, isRtl)}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {te.date} • {te.hours} {isRtl ? 'ساعة' : 'hrs'} @ {te.rate} JOD
                      </span>
                      <span className="px-1.5 py-0.5 bg-muted/80 text-foreground font-mono text-[9px] font-bold rounded">
                        {te.taskCode || 'L120'} / {te.activityCode || 'A103'}
                      </span>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 rounded-md font-bold text-[9px] uppercase tracking-wider shrink-0 ${
                    te.billed ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-muted text-muted-foreground'
                  }`}>
                    {te.billed ? (isRtl ? 'مفوترة' : 'Invoiced') : (isRtl ? 'معلقة' : 'Pending')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Invoices List */}
        <div className="overflow-y-auto pr-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-2">
            {isRtl ? 'سجل الفواتير والتصدير الإلكتروني (LEDES)' : 'Disbursement & Invoices History'}
          </span>
          <div className="space-y-2">
            {invoices.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 border border-dashed border-border rounded-xl">
                {t.emptyInvoiceHistory}
              </p>
            ) : (
              invoices.map(inv => (
                <div key={inv.id} className="p-3 bg-card border border-border rounded-xl flex justify-between items-center text-xs shadow-xs">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-foreground">{inv.invoiceNumber}</span>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-extrabold uppercase tracking-wide ${
                        inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' :
                        inv.status === 'Sent' ? 'bg-accent text-primary' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {getInvoiceStatusLocalized(inv.status)}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1 font-mono">
                      {isRtl ? 'استحقاق' : 'Due'}: {inv.dueDate} • <span className="text-foreground font-bold">{inv.totalAmount.toLocaleString()} JOD</span>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedInvoice(inv)}
                      className="p-1.5 bg-muted hover:bg-foreground/10 text-foreground rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      title="Preview Statement"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleExportLEDES1998B(inv)}
                      className="px-2 py-1 bg-accent hover:bg-primary/15 text-primary border border-primary rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      title="Export LEDES 1998B"
                    >
                      <Download className="w-3 h-3" />
                      <span>LEDES</span>
                    </button>

                    {inv.status !== 'Paid' && (
                      <button
                        onClick={() => handleMarkInvoicePaid(inv.id)}
                        className="px-2 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold text-[10px] uppercase hover:bg-emerald-100 transition-all cursor-pointer"
                      >
                        {t.clearPayment}
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      {/* Invoice Statement & LEDES Print Preview Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-foreground/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-card border border-border rounded-xl max-w-3xl w-full p-6 sm:p-8 shadow-2xl space-y-6 relative animate-in zoom-in-95">
            
            {/* Close */}
            <button
              onClick={() => setSelectedInvoice(null)}
              className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-muted-foreground rounded-full hover:bg-muted cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Print Header */}
            <div className="border-b border-border pb-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-xl font-black text-foreground font-display">AL-HIKMAH & PARTNERS</h2>
                <p className="text-xs text-muted-foreground font-medium">Advocates & International Arbitrators • DIFC / Amman</p>
                <p className="text-[11px] text-muted-foreground font-mono mt-0.5">CR: 948201-JO • Tax Reg: 104928301</p>
              </div>
              <div className="text-right rtl:text-left">
                <span className="text-xs font-bold font-mono text-primary uppercase bg-accent px-3 py-1 rounded-lg border border-primary">
                  STATEMENT OF ACCOUNT / INVOICE
                </span>
                <p className="text-sm font-black text-foreground font-mono mt-1">{selectedInvoice.invoiceNumber}</p>
                <p className="text-xs text-muted-foreground font-mono">{selectedInvoice.issueDate || '2026-07-23'}</p>
              </div>
            </div>

            {/* Matter & Client Details */}
            <div className="grid grid-cols-2 gap-4 bg-background p-4 rounded-xl text-xs">
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Billed To:</span>
                <strong className="text-foreground text-sm block mt-0.5">{activeMatter.clientName}</strong>
                <p className="text-muted-foreground font-mono">{activeMatter.clientEmail}</p>
              </div>
              <div>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Matter Ref:</span>
                <strong className="text-foreground text-sm block mt-0.5">{translateStaticText(activeMatter.title, isRtl)}</strong>
                <p className="text-muted-foreground font-mono">Jurisdiction: {activeMatter.jurisdiction}</p>
              </div>
            </div>

            {/* Itemized Table */}
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left rtl:text-right rtl:text-left border-collapse">
                <thead className="bg-muted text-foreground font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Date</th>
                    <th className="p-3">Description & UTBMS Code</th>
                    <th className="p-3 text-right rtl:text-left">Hours</th>
                    <th className="p-3 text-right rtl:text-left">Rate</th>
                    <th className="p-3 text-right rtl:text-left">Amount (JOD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {entries.map((item) => (
                    <tr key={item.id} className="hover:bg-background/50">
                      <td className="p-3 font-mono text-muted-foreground">{item.date}</td>
                      <td className="p-3">
                        <p className="font-bold text-foreground">{translateStaticText(item.description, isRtl)}</p>
                        <span className="text-[9px] font-mono font-bold text-primary bg-accent px-1.5 py-0.5 rounded mt-0.5 inline-block">
                          {item.taskCode || 'L120'} - {item.activityCode || 'A103'}
                        </span>
                      </td>
                      <td className="p-3 text-right rtl:text-left font-mono font-bold">{item.hours}</td>
                      <td className="p-3 text-right rtl:text-left font-mono">{item.rate}</td>
                      <td className="p-3 text-right rtl:text-left font-mono font-bold text-foreground">
                        {(item.hours * item.rate).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals & Tax Calculation */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 pt-2">
              <div className="text-xs text-muted-foreground space-y-1">
                <p>• E-Billing Standard: LEDES 1998B compliant format.</p>
                <p>• Payment methods accepted: Wire transfer, Bank Draft, CliQ transfer.</p>
              </div>

              <div className="w-full sm:w-64 space-y-2 text-xs border-t sm:border-t-0 pt-3 sm:pt-0">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-mono font-bold">{selectedInvoice.totalAmount.toLocaleString()} JOD</span>
                </div>
                <div className="flex justify-between text-muted-foreground items-center">
                  <span>VAT / Tax (5%):</span>
                  <span className="font-mono font-bold">{(selectedInvoice.totalAmount * taxRate).toLocaleString()} JOD</span>
                </div>
                <div className="flex justify-between text-foreground font-extrabold text-base pt-2 border-t border-border">
                  <span>Total Due:</span>
                  <span className="font-mono text-primary">{(selectedInvoice.totalAmount * (1 + taxRate)).toLocaleString()} JOD</span>
                </div>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-wrap justify-between items-center pt-4 border-t border-border gap-3">
              <button
                type="button"
                onClick={() => handleExportLEDES1998B(selectedInvoice)}
                className="px-4 py-2 bg-accent hover:bg-primary/15 text-primary border border-primary rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Export LEDES 1998B (.txt)</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-xs font-bold flex items-center gap-2 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>Print Invoice Statement</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}

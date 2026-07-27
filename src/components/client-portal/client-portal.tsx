'use client';

import React, { useState, useEffect } from 'react';
import { Eye, ShieldCheck, Download, CreditCard, Send, Sparkles, RefreshCw, Landmark, Calendar, MessageSquare, FileText, CheckCircle } from 'lucide-react';
import { Matter, Document, Invoice, ClientMessage, TimelineEvent } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';
import { translateStaticText } from '@/lib/i18n';

interface ClientPortalProps {
  activeMatter: Matter;
  onRefreshMatter: () => void;
}

export default function ClientPortal({ activeMatter, onRefreshMatter }: ClientPortalProps) {
  const { t, isRtl } = useLanguage();
  const [docs, setDocs] = useState<Document[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [messages, setMessages] = useState<ClientMessage[]>([]);
  const [loading, setLoading] = useState(false);

  // Client Msg Input
  const [msgInput, setMsgInput] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);

  // Client AI Query
  const [aiQuery, setAiQuery] = useState('');
  const [aiReply, setAiReply] = useState('');
  const [queryingAi, setQueryingAi] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Server-sanitized Documents for Client Portal
      const dRes = await fetch(`/api/client-portal/matters/${activeMatter.id}/documents`);
      const sanitizedDocs = dRes.ok ? await dRes.json() : [];
      setDocs(sanitizedDocs);

      // Billing/Invoices
      const bRes = await fetch(`/api/matters/${activeMatter.id}/billing`);
      const bData = bRes.ok ? await bRes.json() : { invoices: [] };
      setInvoices(bData.invoices); // Show all invoices sent to client

      // Messages
      const mRes = await fetch(`/api/matters/${activeMatter.id}/messages`);
      const allMsgs = mRes.ok ? await mRes.json() : [];
      setMessages(allMsgs);

      // Server-sanitized Timeline
      const tRes = await fetch(`/api/client-portal/matters/${activeMatter.id}/timeline`);
      const sanitizedEvents = tRes.ok ? await tRes.json() : [];
      setTimeline(sanitizedEvents);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const handleUpdate = () => {
      fetchData();
    };
    window.addEventListener('portal-updated', handleUpdate);
    return () => {
      window.removeEventListener('portal-updated', handleUpdate);
    };
  }, [activeMatter.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!msgInput) return;

    setSendingMsg(true);
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matterId: activeMatter.id,
          sender: 'Client',
          text: msgInput
        })
      });
      if (res.ok) {
        const data = await res.json();
        setMessages(prev => [...prev, data]);
        setMsgInput('');
        window.dispatchEvent(new Event('messages-updated'));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSendingMsg(false);
    }
  };

  const handleAskClientAi = async () => {
    if (!aiQuery) return;
    setQueryingAi(true);
    setAiReply('');
    try {
      const res = await fetch('/api/ai/client-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          matterId: activeMatter.id,
          query: aiQuery,
          lang: isRtl ? 'ar' : 'en'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAiReply(data.reply);
      } else {
        setAiReply(
          isRtl 
            ? "تعذر عليّ مراجعة ملف القضية والرد في الوقت الحالي. يرجى إعادة المحاولة لاحقاً." 
            : "I was unable to consult your case files at this time. Please check back shortly."
        );
      }
    } catch (err) {
      console.error(err);
      setAiReply(
        isRtl 
          ? "حدث خطأ في الاتصال بالخادم الذكي." 
          : "Network error occurred connecting to AI case advisor."
      );
    } finally {
      setQueryingAi(false);
    }
  };

  const handlePayInvoice = async (invId: string) => {
    try {
      const res = await fetch(`/api/invoices/${invId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'Paid',
          paymentTxId: `TXN-CLIQU-${Math.floor(1000 + Math.random() * 9000)}`
        })
      });
      if (res.ok) {
        const updated = await res.json();
        setInvoices(prev => prev.map(inv => inv.id === invId ? updated : inv));
        onRefreshMatter(); // Refresh budget expenses
      }
    } catch (err) {
      console.error(err);
    }
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

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 shadow-sm flex flex-col h-full gap-3.5 sm:gap-6" id="client-portal">
      {/* Header Profile */}
      <div className="flex justify-between items-center bg-white border border-teal-100 p-3.5 sm:p-5 rounded-xl sm:rounded-2xl shadow-sm">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-teal-100 border border-teal-200 rounded-xl flex items-center justify-center text-teal-800 shrink-0">
            <Eye className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
          </div>
          <div>
            <span className="text-[10px] font-extrabold text-teal-700 uppercase tracking-widest block">{t.clientTransparency}</span>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900 font-display mt-0.5">{translateStaticText(activeMatter.title, isRtl)}</h2>
          </div>
        </div>
        <div className={isRtl ? 'text-left' : 'text-right'}>
          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest block">{t.loggedClient}</span>
          <span className="text-xs sm:text-sm font-bold text-teal-950 block mt-0.5">{translateStaticText(activeMatter.clientName, isRtl)}</span>
        </div>
      </div>

      {/* Grid: Left Column (Timeline & Bills) | Right Column (Documents & Safe AI Assistant) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 sm:gap-4 md:gap-6 flex-grow overflow-hidden">
        
        {/* Left Column (Span 5): Case Progress Timeline */}
        <div className="lg:col-span-5 flex flex-col gap-3.5 sm:gap-6 overflow-y-auto max-h-[550px] pr-1">
          {/* Timeline Block */}
          <div className="bg-white border border-teal-100/80 rounded-xl sm:rounded-2xl p-3.5 sm:p-5 shadow-sm flex-grow" id="client-summary-card">
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 mb-4">
              <Calendar className="w-4 h-4 text-teal-700" />
              <h3 className="text-sm font-extrabold text-slate-900 font-display">{t.auditTrail}</h3>
            </div>

            {timeline.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-10">{t.noMilestones}</p>
            ) : (
              <div className={`relative border-l border-slate-200 ${isRtl ? 'mr-2 pr-4 border-r border-l-0 ml-0' : 'ml-2 pl-4'} space-y-5`}>
                {timeline.map((event) => (
                  <div key={event.id} className="relative text-xs">
                    {/* Timeline dot */}
                    <span className={`absolute ${isRtl ? '-right-[21px]' : '-left-[21px]'} top-1 w-3.5 h-3.5 rounded-full border-2 border-white bg-teal-600 shadow-sm`} />
                    <div>
                      <div className="flex justify-between items-center">
                        <span className="font-extrabold text-slate-800">{translateStaticText(event.title, isRtl)}</span>
                        <span className="text-[9px] font-mono font-bold text-slate-500">{event.date}</span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed font-normal">{translateStaticText(event.description, isRtl)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Billing & Settlement */}
          <div className="bg-white border border-teal-100/80 rounded-2xl p-5 shadow-sm" id="client-invoices-card">
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 mb-4">
              <CreditCard className="w-4 h-4 text-teal-700" />
              <h3 className="text-sm font-extrabold text-slate-900 font-display">{t.settlementTitle}</h3>
            </div>

            <div className="space-y-3">
              {invoices.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">{t.noInvoices}</p>
              ) : (
                invoices.map(inv => (
                  <div key={inv.id} className="p-3 border border-slate-200 rounded-xl bg-slate-50/50 flex justify-between items-center text-xs">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="font-extrabold text-slate-800">{inv.invoiceNumber}</span>
                        <span className={`px-1.5 py-0.5 text-[8px] font-extrabold rounded uppercase tracking-wide ${
                          inv.status === 'Paid' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-rose-100 text-rose-800 border border-rose-200'
                        }`}>
                          {getInvoiceStatusLocalized(inv.status)}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium mt-1">{isRtl ? 'تاريخ الاستحقاق' : 'Due'} {inv.dueDate}</p>
                      <span className="font-black text-teal-950 text-[13px]">{inv.totalAmount.toLocaleString()} {isRtl ? 'د.أ' : 'JOD'}</span>
                    </div>

                    {inv.status !== 'Paid' ? (
                      <button
                        onClick={() => handlePayInvoice(inv.id)}
                        className="px-3.5 py-2 bg-teal-800 text-white hover:bg-teal-900 rounded-xl font-bold text-[11px] shadow-sm transition-all cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        <CreditCard className="w-3.5 h-3.5 shrink-0" /> {isRtl ? 'دفع عبر كليك CliQ' : 'CliQ pay'}
                      </button>
                    ) : (
                      <span className="text-[10px] text-emerald-700 font-bold flex items-center gap-1 font-mono shrink-0">
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> {isRtl ? 'تمت التسوية' : 'CLEARED'}
                      </span>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column (Span 7): Secure Documents & AI Chat Advisor */}
        <div className="lg:col-span-7 flex flex-col gap-6 overflow-y-auto max-h-[550px] pr-1">
          {/* Shared Documents */}
          <div className="bg-white border border-teal-100/80 rounded-2xl p-5 shadow-sm" id="client-docs-card">
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 mb-3">
              <FileText className="w-4 h-4 text-teal-700" />
              <h3 className="text-sm font-extrabold text-slate-900 font-display">{t.sharedFiles}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {docs.length === 0 ? (
                <div className="col-span-2 py-8 text-center text-xs text-slate-400">
                  {t.noFilesShared}
                </div>
              ) : (
                docs.map(doc => (
                  <div key={doc.id} className="p-3 border border-slate-200 rounded-xl bg-teal-50/20 flex justify-between items-center text-xs">
                    <div className="truncate pr-2">
                      <p className="font-extrabold text-slate-800 truncate" title={translateStaticText(doc.name, isRtl)}>{translateStaticText(doc.name, isRtl)}</p>
                      <p className="text-[10px] text-slate-500 font-medium mt-0.5">{doc.fileSize} • {isRtl ? 'إصدار' : 'Version'} {doc.version}.0</p>
                    </div>
                    <button
                      onClick={() => alert(isRtl ? `محاكاة تحميل ملف: ${translateStaticText(doc.name, isRtl)}` : `Simulating file download of: ${doc.name}`)}
                      className="p-2 bg-white hover:bg-teal-50 text-teal-700 hover:text-teal-900 border border-teal-200 rounded-lg shadow-2xs transition-colors cursor-pointer shrink-0"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Secure Chat with Lawyers */}
          <div className="bg-white border border-teal-100/80 rounded-2xl p-5 shadow-sm flex flex-col gap-3" id="client-messages-card">
            <div className="flex items-center gap-1.5 border-b border-slate-100 pb-2">
              <MessageSquare className="w-4 h-4 text-teal-700" />
              <h3 className="text-sm font-extrabold text-slate-900 font-display">{t.secureMessaging}</h3>
            </div>

            {/* Chats Scroll */}
            <div className="flex flex-col gap-2.5 max-h-[180px] overflow-y-auto bg-teal-50/30 p-3.5 rounded-xl border border-teal-100 shadow-inner">
              {messages.length === 0 ? (
                <p className="text-[10px] text-slate-400 text-center py-4">{t.noMessages}</p>
              ) : (
                messages.map(msg => {
                  const isClient = msg.sender === 'Client';
                  return (
                    <div
                      key={msg.id}
                      className={`p-3 rounded-2xl max-w-[85%] text-xs flex flex-col gap-1 shadow-2xs ${
                        isClient
                          ? `bg-teal-800 text-white ${isRtl ? 'mr-auto' : 'ml-auto'}`
                          : `bg-white text-slate-800 border border-slate-200 ${isRtl ? 'ml-auto' : 'mr-auto'}`
                      }`}
                    >
                      <span className={`text-[9px] font-extrabold uppercase tracking-wider ${isClient ? 'text-teal-200' : 'text-teal-700'}`}>
                        {isClient ? (isRtl ? 'أنت' : 'You') : (isRtl ? 'المستشار فرح الصباح' : 'Senior Counsel Farah')}
                      </span>
                      <p className="leading-relaxed font-semibold">{translateStaticText(msg.text, isRtl)}</p>
                    </div>
                  );
                })
              )}
            </div>

            <form onSubmit={handleSendMessage} className="flex gap-2">
              <input
                type="text"
                placeholder={t.messagingPlaceholder}
                value={msgInput}
                onChange={e => setMsgInput(e.target.value)}
                className="flex-grow text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 focus:outline-none focus:ring-2 focus:ring-teal-200 bg-white font-semibold text-slate-800 leading-normal"
              />
              <button
                type="submit"
                disabled={sendingMsg || !msgInput}
                className="px-4 bg-teal-800 text-white rounded-xl hover:bg-teal-900 flex items-center justify-center shrink-0 disabled:opacity-50 cursor-pointer transition-colors"
              >
                <Send className="w-3.5 h-3.5 shrink-0" />
              </button>
            </form>
          </div>

          {/* Safe client AI assistant Advisor */}
          <div className="bg-gradient-to-br from-teal-950 via-teal-900 to-teal-950 rounded-3xl p-5 text-white flex flex-col gap-3 relative overflow-hidden shadow-xl border border-teal-800/80">
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-600/20 rounded-full blur-2xl pointer-events-none" />
            
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1.5 text-teal-200">
                <Sparkles className="w-4 h-4 text-teal-300 fill-teal-300 animate-pulse shrink-0" />
                <span className="text-xs font-extrabold uppercase tracking-widest">{t.safeAiAssistant}</span>
              </div>
              <span className="px-2.5 py-0.5 text-[9px] font-extrabold uppercase tracking-widest bg-white/10 text-teal-200 border border-white/10 rounded-md">
                {t.permissionsChecked}
              </span>
            </div>

            <div>
              <h4 className="text-sm font-extrabold font-display text-white">{t.safeAiTitle}</h4>
              <p className="text-[11px] text-teal-100 mt-1 leading-relaxed font-normal">
                {t.safeAiDesc}
              </p>
            </div>

            <div className="flex gap-2 mt-1">
              <input
                type="text"
                placeholder={t.safeAiPlaceholder}
                value={aiQuery}
                onChange={e => setAiQuery(e.target.value)}
                className="flex-grow text-xs border border-teal-700/60 rounded-xl px-3.5 py-2.5 bg-teal-900/60 text-white placeholder-teal-200/60 focus:outline-none focus:ring-2 focus:ring-teal-400 font-semibold leading-normal"
              />
              <button
                onClick={handleAskClientAi}
                disabled={queryingAi || !aiQuery}
                className="px-4 py-2.5 bg-white text-teal-950 rounded-xl text-xs font-bold shadow hover:bg-teal-50 transition-colors flex items-center gap-1.5 shrink-0 disabled:opacity-50 cursor-pointer"
              >
                {queryingAi ? <RefreshCw className="w-3.5 h-3.5 animate-spin text-teal-900" /> : <Sparkles className="w-3.5 h-3.5 text-teal-700 fill-teal-700" />}
                {t.askAiBtn}
              </button>
            </div>

            {aiReply && (
              <div className="bg-teal-900/80 border border-teal-700/80 p-4 rounded-2xl text-xs text-white mt-1 animate-in slide-in-from-bottom-2 duration-300 leading-relaxed shadow-lg">
                <span className="text-[9px] uppercase font-bold text-teal-300 tracking-wider block mb-1">{t.advisorResponse}</span>
                <p className="leading-relaxed whitespace-pre-line font-medium text-slate-100">{aiReply}</p>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}

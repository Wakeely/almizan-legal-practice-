'use client';

import React, { useState } from 'react';
import {
  ShieldCheck,
  TrendingUp,
  Users,
  Target,
  CalendarClock,
  DollarSign,
  Activity,
  Download,
  FileSpreadsheet,
  FileText,
  Printer,
  CheckCircle2,
  Calendar,
  ArrowUpRight,
  BarChart3
} from 'lucide-react';
import { Matter } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';

interface AnalyticsModuleProps {
  activeMatter: Matter;
}

export default function AnalyticsModule({ activeMatter }: AnalyticsModuleProps) {
  const { t, isRtl } = useLanguage();
  const [selectedMonth, setSelectedMonth] = useState<string>('2026-07');
  const [exportingType, setExportingType] = useState<'pdf' | 'excel' | null>(null);
  const [showExportToast, setShowExportToast] = useState<string | null>(null);

  // Compute key metrics based on active matter
  const budgetRatio = Math.min(100, Math.round((activeMatter.expenses / activeMatter.budget) * 100));
  const remainingBudget = activeMatter.budget - activeMatter.expenses;
  const staffRatio = activeMatter.riskLevel === 'High' ? 85 : activeMatter.riskLevel === 'Medium' ? 60 : 35;

  // Monthly breakdown mock historical dataset
  const monthlyData = [
    {
      month: isRtl ? 'يوليو 2026 (الحالي)' : 'July 2026 (Current)',
      code: '2026-07',
      billed: Math.round(activeMatter.expenses * 0.45) || 12450,
      hours: 142,
      budgetUsed: `${budgetRatio}%`,
      riskIndex: activeMatter.riskLevel === 'High' ? '74.2%' : '38.5%',
      status: isRtl ? 'قيد المعالجة' : 'In Progress'
    },
    {
      month: isRtl ? 'يونيو 2026' : 'June 2026',
      code: '2026-06',
      billed: Math.round(activeMatter.expenses * 0.35) || 9800,
      hours: 118,
      budgetUsed: '62%',
      riskIndex: '42.0%',
      status: isRtl ? 'مكتمل ومفلتر' : 'Billed & Cleared'
    },
    {
      month: isRtl ? 'مايو 2026' : 'May 2026',
      code: '2026-05',
      billed: Math.round(activeMatter.expenses * 0.20) || 6200,
      hours: 86,
      budgetUsed: '41%',
      riskIndex: '31.5%',
      status: isRtl ? 'مكتمل ومفلتر' : 'Billed & Cleared'
    }
  ];

  // CSV Export Handler
  const handleExportExcel = () => {
    setExportingType('excel');

    setTimeout(() => {
      const headers = [
        'Matter ID',
        'Matter Title',
        'Client',
        'Reporting Month',
        'Total Budget (JOD)',
        'Incurred Expenses (JOD)',
        'Remaining Budget (JOD)',
        'Budget Exhausted (%)',
        'Risk Level',
        'Win Probability (%)',
        'Monthly Billed (JOD)',
        'Billable Hours'
      ];

      const row = [
        `"${activeMatter.id}"`,
        `"${activeMatter.title.replace(/"/g, '""')}"`,
        `"${activeMatter.clientName.replace(/"/g, '""')}"`,
        `"${selectedMonth}"`,
        activeMatter.budget,
        activeMatter.expenses,
        remainingBudget,
        `"${budgetRatio}%"`,
        `"${activeMatter.riskLevel}"`,
        `"${activeMatter.winProbability}%"`,
        monthlyData[0].billed,
        monthlyData[0].hours
      ];

      // Add monthly historical rows
      const historyRows = monthlyData.map(m => [
        `"${activeMatter.id}"`,
        `"${activeMatter.title.replace(/"/g, '""')}"`,
        `"${activeMatter.clientName.replace(/"/g, '""')}"`,
        `"${m.month}"`,
        activeMatter.budget,
        m.billed,
        '-',
        `"${m.budgetUsed}"`,
        `"${m.riskIndex}"`,
        `"${activeMatter.winProbability}%"`,
        m.billed,
        m.hours
      ]);

      const csvContent =
        '\uFEFF' + // UTF-8 BOM for Excel Arabic compatibility
        [headers.join(','), row.join(','), ...historyRows.map(r => r.join(','))].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `AlMizan_Analytics_Report_${activeMatter.id}_${selectedMonth}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setExportingType(null);
      setShowExportToast(isRtl ? 'تم تصدير تقرير Excel بنجاح (.csv)' : 'Excel performance report exported successfully (.csv)');
      setTimeout(() => setShowExportToast(null), 3500);
    }, 600);
  };

  // PDF Export Handler (Print / Formatted Report Window)
  const handleExportPDF = () => {
    setExportingType('pdf');

    setTimeout(() => {
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        setExportingType(null);
        alert(isRtl ? 'يرجى السماح بالنوافذ المنبثقة لتنزيل تقرير PDF' : 'Please allow popups to export the PDF report.');
        return;
      }

      const reportHtml = `
        <!DOCTYPE html>
        <html lang="${isRtl ? 'ar' : 'en'}" dir="${isRtl ? 'rtl' : 'ltr'}">
        <head>
          <meta charset="UTF-8">
          <title>Al Mizan Legal Analytics Report - ${activeMatter.id}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 40px; color: #0f172a; background: #fff; line-height: 1.6; }
            .header { border-bottom: 3px solid #312e81; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .logo { font-size: 24px; font-weight: 900; color: #312e81; letter-spacing: -1px; }
            .title { font-size: 18px; font-weight: 700; color: #475569; }
            .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; background: #f8fafc; padding: 20px; border-radius: 12px; border: 1px solid #e2e8f0; margin-bottom: 30px; }
            .meta-item { font-size: 13px; }
            .meta-item strong { color: #1e1b4b; display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; }
            .kpi-container { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 30px; }
            .kpi-card { background: #eef2ff; border: 1px solid #c7d2fe; padding: 15px; border-radius: 12px; text-align: center; }
            .kpi-val { font-size: 22px; font-weight: 800; color: #312e81; }
            .kpi-lbl { font-size: 11px; color: #4338ca; text-transform: uppercase; font-weight: 700; margin-top: 4px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 13px; }
            th, td { padding: 12px 15px; text-align: ${isRtl ? 'right' : 'left'}; border-bottom: 1px solid #e2e8f0; }
            th { background: #1e1b4b; color: #fff; font-weight: 700; text-transform: uppercase; font-size: 11px; }
            tr:nth-child(even) { background: #f8fafc; }
            .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 11px; color: #94a3b8; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <div class="logo">WAKEELY PRO | وكيلي برو</div>
              <div class="title">${isRtl ? 'تقرير الأداء المالي والقضائي الشهري' : 'Monthly Performance & Billing Report'}</div>
            </div>
            <div style="text-align: ${isRtl ? 'left' : 'right'}; font-size: 12px; color: #64748b;">
              <div>${isRtl ? 'تاريخ التقرير:' : 'Date:'} ${new Date().toLocaleDateString()}</div>
              <div>${isRtl ? 'رمز القضية:' : 'Matter Code:'} ${activeMatter.id}</div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-item"><strong>${isRtl ? 'اسم القضية' : 'Matter Title'}</strong> ${activeMatter.title}</div>
            <div class="meta-item"><strong>${isRtl ? 'الموكل' : 'Client Name'}</strong> ${activeMatter.clientName}</div>
            <div class="meta-item"><strong>${isRtl ? 'المحكمة المختصة' : 'Jurisdiction Court'}</strong> ${activeMatter.court || 'Dubai Courts'}</div>
            <div class="meta-item"><strong>${isRtl ? 'مستوى المخاطرة' : 'Risk Level'}</strong> ${activeMatter.riskLevel} Risk</div>
          </div>

          <div class="kpi-container">
            <div class="kpi-card">
              <div class="kpi-val">${activeMatter.budget.toLocaleString()} JOD</div>
              <div class="kpi-lbl">${isRtl ? 'الميزانية المعتمدة' : 'Total Budget'}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-val">${activeMatter.expenses.toLocaleString()} JOD</div>
              <div class="kpi-lbl">${isRtl ? 'المصاريف الفعلية' : 'Incurred Expenses'}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-val">${remainingBudget.toLocaleString()} JOD</div>
              <div class="kpi-lbl">${isRtl ? 'الرصيد المتبقي' : 'Budget Balance'}</div>
            </div>
            <div class="kpi-card">
              <div class="kpi-val">${activeMatter.winProbability}%</div>
              <div class="kpi-lbl">${isRtl ? 'نسبة النجاح المتوقعة' : 'Win Rate'}</div>
            </div>
          </div>

          <h3>${isRtl ? 'تفاصيل السجلات الشهرية والأثر المالي' : 'Monthly Performance Breakdown'}</h3>
          <table>
            <thead>
              <tr>
                <th>${isRtl ? 'الشهر' : 'Month'}</th>
                <th>${isRtl ? 'المبلغ المفوتر' : 'Billed Amount'}</th>
                <th>${isRtl ? 'ساعات العمل' : 'Billable Hours'}</th>
                <th>${isRtl ? 'استهلاك الميزانية' : 'Budget Used'}</th>
                <th>${isRtl ? 'مؤشر المخاطرة' : 'Risk Index'}</th>
                <th>${isRtl ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody>
              ${monthlyData
                .map(
                  m => `
                <tr>
                  <td><strong>${m.month}</strong></td>
                  <td>${m.billed.toLocaleString()} JOD</td>
                  <td>${m.hours} hrs</td>
                  <td>${m.budgetUsed}</td>
                  <td>${m.riskIndex}</td>
                  <td>${m.status}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>

          <div class="footer">
            Al Mizan Legal Operating System • Generated for Confidential Client Reference • Certified Audit Output
          </div>

          <script>
            window.onload = function() {
              window.print();
            };
          </script>
        </body>
        </html>
      `;

      printWindow.document.write(reportHtml);
      printWindow.document.close();

      setExportingType(null);
      setShowExportToast(isRtl ? 'تم فتح نافذة طباعة/تصدير تقرير PDF' : 'PDF Performance report print preview generated');
      setTimeout(() => setShowExportToast(null), 3500);
    }, 600);
  };

  return (
    <div className="space-y-4 font-sans">
      
      {/* Toast Alert Notification */}
      {showExportToast && (
        <div className="fixed top-20 right-4 z-50 bg-emerald-950 border border-emerald-500/40 text-emerald-200 px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span className="text-xs sm:text-sm font-bold">{showExportToast}</span>
        </div>
      )}

      {/* Analytics Header with Report Export Toolbar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 text-xs font-bold">
            <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
            <span>{isRtl ? 'تحليلات الأداء المالي والأثر القضائي' : 'Financial & Legal Performance Analytics'}</span>
          </div>
          <h3 className="text-lg sm:text-xl font-black text-white font-display">
            {isRtl ? 'مؤشرات الأداء وتصدير التقارير' : 'Monthly Performance & Billing Analytics'}
          </h3>
        </div>

        {/* Report Export Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* PDF Report Export Button */}
          <button
            onClick={handleExportPDF}
            disabled={exportingType !== null}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs rounded-xl shadow-md border border-indigo-400/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            title={isRtl ? 'تصدير تقرير أداء PDF مطبوع' : 'Export PDF Performance Report'}
          >
            <FileText className="w-4 h-4" />
            <span>{isRtl ? 'تصدير PDF' : 'Export PDF Report'}</span>
          </button>

          {/* Excel / CSV Report Export Button */}
          <button
            onClick={handleExportExcel}
            disabled={exportingType !== null}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl shadow-md border border-emerald-400/30 flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
            title={isRtl ? 'تصدير بيانات الأداء إلى جدول Excel (.csv)' : 'Export Excel Spreadsheet (.csv)'}
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>{isRtl ? 'تصدير Excel' : 'Export Excel (.csv)'}</span>
          </button>
        </div>
      </div>

      {/* Bento Grid Analytics Row */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5 sm:gap-4 md:gap-6" id="analytics-bento-grid">
        
        {/* 1. Risk Factor Block */}
        <div className="bg-indigo-900 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 shadow-sm flex flex-col text-white justify-between min-h-[140px] md:min-h-[160px] relative overflow-hidden md:col-span-1">
          <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-800/30 rounded-full blur-xl pointer-events-none" />
          <div className="flex justify-between items-start mb-2 sm:mb-4">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200">{t.riskFactorIndex}</span>
            <div className="px-2 py-0.5 bg-white/10 border border-white/10 rounded text-[9px] uppercase font-bold text-indigo-100">
              {activeMatter.riskLevel === 'High' ? (isRtl ? 'مرتفع' : 'High') : activeMatter.riskLevel === 'Medium' ? (isRtl ? 'متوسط' : 'Medium') : (isRtl ? 'منخفض' : 'Low')}
            </div>
          </div>
          <div>
            <div className="text-2xl sm:text-3xl font-extrabold font-display">
              {activeMatter.riskLevel === 'High' ? '74.2%' : activeMatter.riskLevel === 'Medium' ? '38.5%' : '14.8%'}
            </div>
            <p className="text-[11px] text-indigo-200 mt-1 leading-relaxed">
              {t.riskFactorDesc}
            </p>
          </div>
        </div>

        {/* 2. Staff Resource Allocation Map */}
        <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 shadow-sm flex flex-col justify-between min-h-[140px] md:min-h-[160px] md:col-span-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.resourceAllocation}</span>
            <Users className="w-4.5 h-4.5 text-indigo-600" />
          </div>
          <div className="space-y-1.5 sm:space-y-2 mt-2 sm:mt-4">
            <div className="h-2 sm:h-2.5 bg-slate-100 rounded-full w-full overflow-hidden">
              <div className="h-2 sm:h-2.5 bg-indigo-500 rounded-full transition-all duration-500" style={{ width: `${staffRatio}%` }} />
            </div>
            <div className="h-2 sm:h-2.5 bg-slate-100 rounded-full w-full overflow-hidden">
              <div className="h-2 sm:h-2.5 bg-indigo-500 rounded-full opacity-60 transition-all duration-500" style={{ width: `${Math.max(20, staffRatio - 15)}%` }} />
            </div>
            <div className="h-2 sm:h-2.5 bg-slate-100 rounded-full w-full overflow-hidden">
              <div className="h-2 sm:h-2.5 bg-indigo-500 rounded-full opacity-30 transition-all duration-500" style={{ width: `${Math.max(10, staffRatio - 35)}%` }} />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 text-center font-bold mt-1.5 sm:mt-2">
            {t.allocatedStaff}: {activeMatter.riskLevel === 'High' ? '6/8' : '3/8'}
          </p>
        </div>

        {/* 3. Primary Goal Saturation Indicator */}
        <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 shadow-sm flex flex-col justify-between border-l-4 border-l-emerald-500 min-h-[140px] md:min-h-[160px] md:col-span-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.primaryObjective}</span>
            <Target className="w-4.5 h-4.5 text-emerald-500" />
          </div>
          <div>
            <h4 className="text-base font-bold text-slate-800 font-display">{t.contractSaturation}</h4>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              {isRtl ? `تأمين معدل امتثال بنسبة ${activeMatter.winProbability}% لمتطلبات ما قبل المحاكمة وجلسة الاكتشاف.` : `Ensure ${activeMatter.winProbability}% compliance rating by pre-trial discovery hearing.`}
            </p>
          </div>
        </div>

        {/* 4. Financial Health Monitor */}
        <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 shadow-sm flex flex-col justify-between min-h-[140px] md:min-h-[160px] md:col-span-1">
          <div className="flex justify-between items-center">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{t.pleadingCapStatus}</span>
            <Activity className="w-4.5 h-4.5 text-indigo-600" />
          </div>
          <div>
            <div className="text-xl font-bold text-slate-800 font-mono">
              {remainingBudget.toLocaleString()} {isRtl ? 'د.أ' : 'JOD'}
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">{t.budgetBalance}</p>
            <div className="flex items-center gap-1.5 mt-2 sm:mt-3">
              <span className={`w-2.5 h-2.5 rounded-full ${budgetRatio > 75 ? 'bg-red-500' : 'bg-emerald-500'}`} />
              <span className="text-[10px] font-semibold text-slate-500">{budgetRatio}% {t.budgetExhausted}</span>
            </div>
          </div>
        </div>

      </div>

      {/* Monthly Performance & Billing Summary Table */}
      <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-sm space-y-3">
        <div className="flex items-center justify-between pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-indigo-600" />
            <h4 className="text-sm font-bold text-slate-800 font-display">
              {isRtl ? 'جدول الأداء المالي والساعات المفوترة شهرياً' : 'Monthly Performance & Billed Hours Log'}
            </h4>
          </div>
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
            {isRtl ? 'مستند تصدير معتمد' : 'Report Ready'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-200 text-[10px] uppercase font-bold text-slate-400 bg-slate-50">
                <th className="p-2.5">{isRtl ? 'الشهر' : 'Month'}</th>
                <th className="p-2.5">{isRtl ? 'الإيراد المفوتر' : 'Billed Amount'}</th>
                <th className="p-2.5">{isRtl ? 'ساعات العمل' : 'Billable Hours'}</th>
                <th className="p-2.5">{isRtl ? 'نسبة الاستهلاك' : 'Budget Used'}</th>
                <th className="p-2.5">{isRtl ? 'المخاطرة' : 'Risk Index'}</th>
                <th className="p-2.5 text-right">{isRtl ? 'الحالة' : 'Status'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {monthlyData.map((m) => (
                <tr key={m.code} className="hover:bg-slate-50/80 transition-colors">
                  <td className="p-2.5 font-bold text-slate-800">{m.month}</td>
                  <td className="p-2.5 font-mono text-indigo-700 font-bold">{m.billed.toLocaleString()} JOD</td>
                  <td className="p-2.5 text-slate-600">{m.hours} hrs</td>
                  <td className="p-2.5 text-slate-600">{m.budgetUsed}</td>
                  <td className="p-2.5 text-slate-600">{m.riskIndex}</td>
                  <td className="p-2.5 text-right">
                    <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {m.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}


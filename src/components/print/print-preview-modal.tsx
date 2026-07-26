"use client";

// =============================================================================
// PrintPreviewModal — STUB (faithful port ships in Turn 3 with full court
// docket layout). For Turn 2, renders a minimal preview + print button so the
// MattersModule "Print Docket" button still works end-to-end.
// =============================================================================

import React from "react";
import { Printer, X, FileText } from "lucide-react";
import type { Matter } from "@/lib/types";

interface PrintPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeMatter: Matter;
  analysis?: {
    riskSummary?: string;
    strategyRecommendations?: string[];
    riskScore?: number;
    winProbability?: number;
  } | null;
}

export default function PrintPreviewModal({ isOpen, onClose, activeMatter, analysis }: PrintPreviewModalProps) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto no-print">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-3xl overflow-hidden my-auto">
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 flex justify-between items-center border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500 text-slate-950 rounded-xl">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-extrabold">Courtroom Docket Preview</h3>
              <p className="text-[11px] text-slate-400">Phase 2 stub — full docket layout ships in Turn 3</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body — minimal docket summary */}
        <div className="p-6 print-only-court-summary" style={{ background: "white", color: "#0f172a" }}>
          <div className="border-b-2 border-slate-900 pb-3 mb-4">
            <h2 className="text-xl font-black uppercase">Al Mizan Legal Practice</h2>
            <p className="text-xs text-slate-600 mt-1">Courtroom Case File Docket & Summary</p>
          </div>
          <table className="w-full text-xs border border-slate-800 border-collapse">
            <tbody>
              <tr className="border-b border-slate-300">
                <td className="p-2 font-bold bg-slate-100 w-1/3">Matter Title</td>
                <td className="p-2">{activeMatter.title}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="p-2 font-bold bg-slate-100">Client</td>
                <td className="p-2">{activeMatter.clientName}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="p-2 font-bold bg-slate-100">Jurisdiction</td>
                <td className="p-2">{activeMatter.jurisdiction}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="p-2 font-bold bg-slate-100">Judge</td>
                <td className="p-2">{activeMatter.judge || "—"}</td>
              </tr>
              <tr className="border-b border-slate-300">
                <td className="p-2 font-bold bg-slate-100">Risk Level</td>
                <td className="p-2">{activeMatter.riskLevel}</td>
              </tr>
              <tr>
                <td className="p-2 font-bold bg-slate-100">Win Probability</td>
                <td className="p-2">{activeMatter.winProbability}%</td>
              </tr>
            </tbody>
          </table>
          {analysis?.riskSummary && (
            <div className="mt-4 p-3 border border-slate-300 text-xs">
              <strong>Risk Assessment:</strong> {analysis.riskSummary}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-slate-50 border-t border-slate-100 p-4 flex justify-end gap-2 no-print">
          <button onClick={onClose} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer">
            Close
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 bg-primary text-primary-foreground text-xs font-bold rounded-xl flex items-center gap-1.5 hover:opacity-90 transition cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Docket
          </button>
        </div>
      </div>
    </div>
  );
}

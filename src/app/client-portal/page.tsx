"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, ChevronRight } from "lucide-react";
import { useMatters } from "@/components/providers/matters-provider";
import { useLanguage } from "@/components/providers/language-provider";
import { WorkspaceLoading } from "@/components/workspace/workspace-status";

export default function ClientPortalIndex() {
  const { isRtl } = useLanguage();
  const { matters, mattersLoading, refresh } = useMatters();
  const router = useRouter();

  // A client with exactly one matter goes straight to it.
  useEffect(() => {
    if (!mattersLoading && matters.length === 1) {
      router.replace(`/client-portal/matters/${matters[0].id}`);
    }
  }, [mattersLoading, matters, router]);

  if (mattersLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <WorkspaceLoading />
      </div>
    );
  }

  if (matters.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm max-w-md mx-auto">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6">
          <Briefcase className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold mb-2">
          {isRtl ? "لا توجد قضايا" : "No Cases Yet"}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          {isRtl
            ? "ستظهر قضاياك هنا فور رفعها من قبل مكتب المحاماة."
            : "Your matters will appear here once your firm shares them."}
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="text-center mb-8">
        <h2 className="text-xl font-bold mb-2">
          {isRtl ? "قضاياي" : "My Cases"}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isRtl ? "اختر قضية لمتابعة تقدمها" : "Select a case to view its progress"}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {matters.map((m) => (
          <button
            key={m.id}
            onClick={() => router.push(`/client-portal/matters/${m.id}`)}
            className="flex items-start gap-3 p-5 bg-card border border-border rounded-xl hover:border-primary/50 hover:bg-accent/30 transition-all cursor-pointer text-left rtl:text-right group"
          >
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
              <Briefcase className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-bold truncate">{m.title}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{m.jurisdiction}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-3 rtl:rotate-180" />
          </button>
        ))}
      </div>

      <button
        onClick={refresh}
        className="mt-8 mx-auto block px-4 py-2 rounded-lg border border-border text-xs font-bold hover:bg-accent transition-colors cursor-pointer"
      >
        {isRtl ? "تحديث" : "Refresh"}
      </button>
    </div>
  );
}
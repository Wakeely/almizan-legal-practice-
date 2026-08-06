"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { Briefcase, ArrowLeft, FileQuestion } from "lucide-react";
import { useMatters } from "@/components/providers/matters-provider";
import { useLanguage } from "@/components/providers/language-provider";
import ClientPortal from "@/components/client-portal/client-portal";
import { WorkspaceLoading } from "@/components/workspace/workspace-status";

export default function ClientMatterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const { isRtl } = useLanguage();
  const { activeMatter, mattersLoading, refresh } = useMatters();

  if (mattersLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <WorkspaceLoading />
      </div>
    );
  }

  if (!activeMatter) {
    return (
      <div className="bg-card border border-border rounded-2xl p-12 text-center shadow-sm max-w-md mx-auto">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-6">
          <FileQuestion className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold mb-2">
          {isRtl ? "القضية غير متاحة" : "Matter not available"}
        </h3>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          {isRtl
            ? "تعذر العثور على هذه القضية أو لا تملك صلاحية الوصول إليها."
            : "We could not find this matter, or you don't have access to it."}
        </p>
        <button
          onClick={() => router.push("/client-portal")}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground font-bold text-xs rounded-xl shadow hover:opacity-90 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          {isRtl ? "العودة إلى قضاياي" : "Back to My Cases"}
        </button>
      </div>
    );
  }

  return (
    <>
      {/* Back link */}
      <button
        onClick={() => router.push("/client-portal")}
        className="mb-4 inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      >
        <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
        {isRtl ? "كل القضايا" : "All cases"}
      </button>

      {/* Matter header banner */}
      <div className="flex items-center gap-3 mb-6 p-4 bg-primary/5 border border-primary/10 rounded-xl">
        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Briefcase className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <h1 className="text-sm font-bold truncate">{activeMatter.title}</h1>
          <p className="text-xs text-muted-foreground">{activeMatter.clientName}</p>
        </div>
      </div>

      <ClientPortal activeMatter={activeMatter} onRefreshMatter={refresh} />
    </>
  );
}
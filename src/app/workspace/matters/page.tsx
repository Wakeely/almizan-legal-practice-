"use client";

import { Briefcase } from "lucide-react";
import { useMatters } from "@/components/providers/matters-provider";
import { useLanguage } from "@/components/providers/language-provider";
import MattersModule from "@/components/matters/matters-module";
import TasksModule from "@/components/tasks/tasks-module";

export default function MattersPage() {
  const { activeMatter, matters, updateMatter } = useMatters();
  const { isRtl } = useLanguage();
  if (!activeMatter) return null;

  return (
    <div>
      {/* Clear page-level label: this view holds BOTH the case
          profile AND the tasks/kanban for the active matter. */}
      <div className="flex items-center gap-2 mb-1">
        <Briefcase className="w-4 h-4 text-primary shrink-0" />
        <h2 className="text-base font-bold">
          {isRtl ? "ملف القضية والمهام" : "Case Profile & Tasks"}
        </h2>
      </div>
      <p className="text-xs text-muted-foreground mb-5">
        {isRtl
          ? "الملف التعريفي للقضية والمهام المترتبة عليها (كانبان) في مكان واحد."
          : "Manage the case profile and its tasks/kanban in one place."}
      </p>
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5">
          <MattersModule activeMatter={activeMatter} onMatterUpdated={updateMatter} />
        </div>
        <div className="xl:col-span-7">
          <TasksModule matterId={activeMatter.id} matters={matters} />
        </div>
      </div>
    </div>
  );
}

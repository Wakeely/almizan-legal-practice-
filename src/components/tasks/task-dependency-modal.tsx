'use client';

import React from 'react';
import { X, Lock, Unlock, ArrowRight, ArrowLeft, CheckCircle2, Clock, AlertTriangle, GitCommit, Workflow, User, Calendar } from 'lucide-react';
import { Task } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';
import { translateStaticText } from '@/lib/i18n';

interface TaskDependencyModalProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: Task[];
  onSelectTask?: (task: Task) => void;
}

export default function TaskDependencyModal({
  isOpen,
  onClose,
  tasks,
  onSelectTask
}: TaskDependencyModalProps) {
  const { t, isRtl } = useLanguage();

  if (!isOpen) return null;

  // Find prerequisite task title
  const getTaskById = (id: string) => tasks.find(t => t.id === id);

  return (
    <div className="fixed inset-0 z-[110] bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-4xl max-h-[88vh] shadow-2xl flex flex-col justify-between overflow-hidden">
        
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-teal-100 flex justify-between items-center bg-teal-50/60">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-teal-100 border border-teal-200 flex items-center justify-center text-teal-800">
              <Workflow className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 font-display">
                {isRtl ? 'المسار التتابعي والاعتمادات بين المهام' : 'Task Dependency Chain & Workflow Matrix'}
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                {isRtl ? 'خريطة المهام الحاكمة والاشتراطات المسبقة للتنفيذ القضائي' : 'Sequential prerequisite dependencies governing litigation task progression'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-teal-100/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Dependency Flow Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          <div className="bg-teal-50 border border-teal-200 rounded-2xl p-4 text-xs text-teal-950 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-extrabold text-teal-950">
                {isRtl ? 'قواعد الأمان والاعتمادية القضائية:' : 'Sequential Litigation Rule:'}
              </p>
              <p className="text-[11px] text-teal-800 mt-0.5 leading-relaxed font-semibold">
                {isRtl
                  ? 'لا يمكن تحريك المهام المحجوزة (🔒) إلى مراحل التنفيذ أو الاستكمال حتى يتم إنهاء المهام السابقة المقترنة بها لمنع الأخطاء الإجرائية أمام المحكمة.'
                  : 'Tasks with active prerequisites (🔒) are blocked from advancing to "In Progress" or "Completed" until prerequisite tasks are finished.'}
              </p>
            </div>
          </div>

          {/* Tasks List as Dependency Chain Nodes */}
          <div className="space-y-4">
            {tasks.map((task, idx) => {
              const prerequisites = (task.dependsOnTaskIds || []).map(id => getTaskById(id)).filter(Boolean) as Task[];
              const isBlocked = prerequisites.some(p => p.status !== 'Completed');

              return (
                <div
                  key={task.id}
                  onClick={() => onSelectTask && onSelectTask(task)}
                  className={`p-4 rounded-2xl border transition-all ${
                    isBlocked
                      ? 'bg-amber-50/30 border-amber-200/80'
                      : task.status === 'Completed'
                      ? 'bg-emerald-50/20 border-emerald-200/60'
                      : 'bg-white border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-grow">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md">
                          #{task.id}
                        </span>
                        
                        {/* Lock / Unlock Badge */}
                        {isBlocked ? (
                          <span className="text-[10px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <Lock className="w-3 h-3 text-amber-600" />
                            {isRtl ? 'مغلقة باشتراطات سابقة' : 'Blocked by Prerequisites'}
                          </span>
                        ) : (
                          <span className="text-[10px] font-extrabold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                            <Unlock className="w-3 h-3 text-emerald-600" />
                            {isRtl ? 'متاحة للتنفيذ' : 'Ready / Unlocked'}
                          </span>
                        )}

                        <span className="text-[10px] font-bold text-slate-500 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                          {isRtl ? (
                            task.status === 'To Do' ? 'قيد التخطيط' :
                            task.status === 'In Progress' ? 'قيد التنفيذ' :
                            task.status === 'Under Review' ? 'تحت المراجعة' : 'تم إنجازها'
                          ) : task.status}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-800 font-display">
                        {translateStaticText(task.title, isRtl)}
                      </h4>

                      {task.description && (
                        <p className="text-xs text-slate-500 leading-relaxed">
                          {translateStaticText(task.description || '', isRtl)}
                        </p>
                      )}
                    </div>

                    <div className="text-right text-xs text-slate-400 font-mono space-y-1 shrink-0">
                      <div className="flex items-center gap-1 justify-end">
                        <User className="w-3.5 h-3.5" />
                        <span>{translateStaticText(task.assignedTo, isRtl)}</span>
                      </div>
                      <div className="flex items-center gap-1 justify-end">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{new Date(task.dueDate).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Visual Prerequisite Arrow Connection */}
                  {prerequisites.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-[10px] font-extrabold uppercase text-slate-400">
                        {isRtl ? 'تشترط إنجاز:' : 'Prerequisites Required:'}
                      </span>
                      {prerequisites.map(prereq => (
                        <div
                          key={prereq.id}
                          className={`px-2.5 py-1 rounded-xl text-xs font-bold border flex items-center gap-1.5 ${
                            prereq.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-100 text-amber-900 border-amber-300'
                          }`}
                        >
                          {prereq.status === 'Completed' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          )}
                          <span>{translateStaticText(prereq.title, isRtl)}</span>
                          <span className="text-[9px] font-mono font-normal">({prereq.status})</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-teal-800 text-white rounded-xl text-xs font-bold hover:bg-teal-900 transition-colors cursor-pointer shadow-sm"
          >
            {isRtl ? 'إغلاق المخطط' : 'Close Dependency Matrix'}
          </button>
        </div>
      </div>
    </div>
  );
}

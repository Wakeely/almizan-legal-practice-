'use client';

import React, { useState, useEffect } from 'react';
import { Calendar, User, CheckCircle2, Circle, Clock, Eye, EyeOff, Plus, RefreshCw, AlertCircle, GripVertical, Move, ArrowRightLeft, Lock, Unlock, Workflow, ShieldAlert, Link2, GitCommit, X, Layers, Filter, FolderOpen } from 'lucide-react';
import { Task, Matter } from '@/lib/types';
import { useLanguage } from '@/components/providers/language-provider';
import { translateStaticText } from '@/lib/i18n';
import { saveItemsToOfflineStore, getByMatterIdFromOfflineStore, STORES } from '@/lib/offline-storage';
import { offlineFetch, isQueuedOfflineResponse } from '@/lib/offline-fetch';
import TaskDependencyModal from '@/components/tasks/task-dependency-modal';

interface TasksModuleProps {
  matterId: string;
  matters?: Matter[];
}

export default function TasksModule({ matterId, matters = [] }: TasksModuleProps) {
  const { t, isRtl } = useLanguage();
  const [boardScope, setBoardScope] = useState<'single' | 'all'>('single');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showDependencyMatrixModal, setShowDependencyMatrixModal] = useState(false);
  const [blockedTaskAttempt, setBlockedTaskAttempt] = useState<{ task: Task; targetStage: Task['status']; blockingTasks: Task[] } | null>(null);
  
  // Cross-Case Filters
  const [matterFilter, setMatterFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');

  // Drag and Drop States
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [dragOverStage, setDragOverStage] = useState<Task['status'] | null>(null);
  const [dragNotice, setDragNotice] = useState<string | null>(null);

  // New Task form inputs
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('Farah Al-Sabah');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState<'Low' | 'Medium' | 'High'>('Medium');
  const [visibleToClient, setVisibleToClient] = useState(false);
  const [selectedDependsOnTaskIds, setSelectedDependsOnTaskIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Localize Stage columns
  const STAGES: Task['status'][] = ['To Do', 'In Progress', 'Under Review', 'Completed'];

  const getStageLocalized = (stage: Task['status']) => {
    if (!isRtl) return stage;
    switch (stage) {
      case 'To Do': return 'قيد التخطيط';
      case 'In Progress': return 'قيد التنفيذ';
      case 'Under Review': return 'تحت المراجعة';
      case 'Completed': return 'تم إنجازها';
      default: return stage;
    }
  };

  const fetchTasks = async () => {
    setLoading(true);
    try {
      if (!navigator.onLine) {
        throw new Error('Offline');
      }
      const endpoint = boardScope === 'all' ? '/api/tasks/all' : `/api/matters/${matterId}/tasks`;
      const res = await fetch(endpoint);
      if (res.ok) {
        const data: Task[] = await res.json();
        setTasks(data);
        if (boardScope === 'single') {
          await saveItemsToOfflineStore(STORES.TASKS, data);
        }
      } else {
        throw new Error('API Error');
      }
    } catch (err) {
      console.warn("Loading tasks from IndexedDB cache:", err);
      const cached = await getByMatterIdFromOfflineStore<Task>(STORES.TASKS, matterId);
      if (cached && cached.length > 0) {
        setTasks(cached);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
    const handleUpdate = () => {
      fetchTasks();
    };
    window.addEventListener('tasks-updated', handleUpdate);
    return () => {
      window.removeEventListener('tasks-updated', handleUpdate);
    };
  }, [matterId, boardScope]);

  const getBlockingTasks = (task: Task): Task[] => {
    if (!task.dependsOnTaskIds || task.dependsOnTaskIds.length === 0) return [];
    return tasks.filter(t => task.dependsOnTaskIds!.includes(t.id) && t.status !== 'Completed');
  };

  const isTaskBlocked = (task: Task): boolean => {
    return getBlockingTasks(task).length > 0;
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title) return;

    setSubmitting(true);
    try {
      const payload = {
        matterId,
        title,
        description,
        assignedTo,
        dueDate: dueDate || new Date().toISOString().split('T')[0],
        priority,
        visibleToClient,
        status: 'To Do',
        dependsOnTaskIds: selectedDependsOnTaskIds
      };
      const res = await offlineFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const data = await res.json();
        // If the mutation was queued offline, synthesize a local Task object
        // so the UI reflects the new card immediately. The server will assign
        // the real id on flush; we use a temporary id in the meantime.
        const newTask: Task = isQueuedOfflineResponse(res)
          ? {
              id: `offline-${Date.now()}`,
              organizationId: '',
              ...payload,
              dependsOnTaskIds: selectedDependsOnTaskIds
            } as Task
          : data;
        setTasks(prev => [...prev, newTask]);
        // Persist to offline cache so the optimistic card survives refresh.
        await saveItemsToOfflineStore(STORES.TASKS, newTask);
        setShowForm(false);
        // Reset
        setTitle('');
        setDescription('');
        setDueDate('');
        setPriority('Medium');
        setVisibleToClient(false);
        setSelectedDependsOnTaskIds([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: Task['status'], bypassCheck: boolean = false) => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;

    // Intercept if task is blocked and moving to advanced stage
    if (!bypassCheck && (newStatus === 'In Progress' || newStatus === 'Under Review' || newStatus === 'Completed')) {
      const blockers = getBlockingTasks(targetTask);
      if (blockers.length > 0) {
        setBlockedTaskAttempt({
          task: targetTask,
          targetStage: newStatus,
          blockingTasks: blockers
        });
        return;
      }
    }

    try {
      const res = await offlineFetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });
      if (res.ok) {
        // Optimistic UI update (applies both for online success and queued offline).
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, status: newStatus } : t));
        // Also update the offline cache so the optimistic state survives refresh.
        const updated = { ...targetTask, status: newStatus };
        await saveItemsToOfflineStore(STORES.TASKS, updated);
        if (blockedTaskAttempt) setBlockedTaskAttempt(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const updateTaskPriority = async (taskId: string, newPriority: 'Low' | 'Medium' | 'High') => {
    const targetTask = tasks.find(t => t.id === taskId);
    if (!targetTask) return;
    try {
      const res = await offlineFetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: newPriority })
      });
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === taskId ? { ...t, priority: newPriority } : t));
        const updated = { ...targetTask, priority: newPriority };
        await saveItemsToOfflineStore(STORES.TASKS, updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const toggleTaskClientVisibility = async (task: Task) => {
    const updatedVisible = !task.visibleToClient;
    try {
      const res = await offlineFetch(`/api/tasks/${task.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visibleToClient: updatedVisible })
      });
      if (res.ok) {
        setTasks(prev => prev.map(t => t.id === task.id ? { ...t, visibleToClient: updatedVisible } : t));
        const updated = { ...task, visibleToClient: updatedVisible };
        await saveItemsToOfflineStore(STORES.TASKS, updated);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Drag and drop events
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    setDraggedTask(task);
    e.dataTransfer.setData('text/plain', task.id);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, stage: Task['status']) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverStage !== stage) {
      setDragOverStage(stage);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDropOnStage = async (e: React.DragEvent, targetStage: Task['status']) => {
    e.preventDefault();
    setDragOverStage(null);

    if (!draggedTask) return;

    if (draggedTask.status !== targetStage) {
      await updateTaskStatus(draggedTask.id, targetStage);
      setDragNotice(
        isRtl
          ? `تم تحديث المرحلة بنجاح إلى (${getStageLocalized(targetStage)})`
          : `Task moved to ${targetStage}`
      );
      setTimeout(() => setDragNotice(null), 3500);
    }
    setDraggedTask(null);
  };

  const handleDropOnPriority = async (e: React.DragEvent, targetPriority: 'Low' | 'Medium' | 'High') => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverStage(null);

    if (!draggedTask) return;

    if (draggedTask.priority !== targetPriority) {
      await updateTaskPriority(draggedTask.id, targetPriority);
      setDragNotice(
        isRtl
          ? `تم تعديل أولوية المهمة إلى (${getPriorityLocalized(targetPriority)})`
          : `Task priority updated to ${targetPriority}`
      );
      setTimeout(() => setDragNotice(null), 3500);
    }
    setDraggedTask(null);
  };

  const getPriorityLocalized = (p: string) => {
    if (!isRtl) return p;
    switch (p) {
      case 'High': return 'عالية';
      case 'Medium': return 'متوسطة';
      case 'Low': return 'منخفضة';
      default: return p;
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 md:p-6 shadow-sm flex flex-col h-full gap-3.5 sm:gap-5" id="tasks-module">
      {/* Module Header & Scope Switcher */}
      <div className="flex justify-between items-center border-b border-slate-100 pb-2.5 sm:pb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4.5 h-4.5 sm:w-5 sm:h-5 text-indigo-600 shrink-0" />
            <h3 className="text-base sm:text-lg font-bold text-slate-800 font-display">{t.workflowTitle}</h3>
          </div>

          {/* Scope Switcher: Single Case vs Cross-Case Kanban */}
          <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold font-display">
            <button
              onClick={() => setBoardScope('single')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                boardScope === 'single'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span>{isRtl ? 'قضية واحدة' : 'Case Kanban'}</span>
            </button>
            <button
              onClick={() => setBoardScope('all')}
              className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                boardScope === 'all'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{isRtl ? 'لوحة كافة القضايا' : 'Cross-Case Board'}</span>
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowDependencyMatrixModal(true)}
            className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer"
            title={isRtl ? 'عرض مخطط الاعتمادات والمسار التتابعي' : 'View Task Dependency Chain Matrix'}
          >
            <Workflow className="w-3.5 h-3.5 text-amber-600" />
            <span>{isRtl ? 'المسار التتابعي' : 'Dependency Matrix'}</span>
          </button>

          <button
            onClick={() => setShowForm(!showForm)}
            className="px-2.5 py-1 sm:px-3 sm:py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-xs font-bold rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            {t.addTask}
          </button>
        </div>
      </div>

      {/* Cross-Case Filter Bar */}
      {boardScope === 'all' && (
        <div className="bg-indigo-50/50 border border-indigo-100/80 p-2.5 rounded-2xl flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-indigo-600 shrink-0" />
            <span className="font-bold text-slate-700">{isRtl ? 'تصفية المهام الشاملة:' : 'Cross-Case Filters:'}</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter by Matter */}
            <div className="flex items-center gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">{isRtl ? 'القضية:' : 'Matter:'}</label>
              <select
                value={matterFilter}
                onChange={e => setMatterFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="all">{isRtl ? 'جميع القضايا' : 'All Matters'}</option>
                {matters.map(m => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>

            {/* Filter by Assignee */}
            <div className="flex items-center gap-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase">{isRtl ? 'المسؤول:' : 'Assignee:'}</label>
              <select
                value={assigneeFilter}
                onChange={e => setAssigneeFilter(e.target.value)}
                className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium text-slate-700 focus:outline-none"
              >
                <option value="all">{isRtl ? 'جميع المستشارين' : 'All Assignees'}</option>
                <option value="Farah Al-Sabah">Farah Al-Sabah</option>
                <option value="Walid Al-Gharaballi">Walid Al-Gharaballi</option>
                <option value="Tariq Al-Tayer">Tariq Al-Tayer</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Task Creation Form Dropdown */}
      {showForm && (
        <form onSubmit={handleCreateTask} className="bg-slate-50 border border-slate-100 p-4 rounded-2xl space-y-3 animate-in slide-in-from-top-4 duration-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.taskTitleLabel}</label>
              <input
                type="text"
                required
                placeholder={isRtl ? "مثال: استلام رد محكم مركز التحكيم التجاري" : "e.g. Obtain SCCA Arbitrator response"}
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.assignedLawyer}</label>
              <select
                value={assignedTo}
                onChange={e => setAssignedTo(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none"
              >
                <option value="Farah Al-Sabah">{isRtl ? 'فرح الصباح (مستشار أول)' : 'Farah Al-Sabah (Senior Associate)'}</option>
                <option value="Walid Al-Gharaballi">{isRtl ? 'وليد الغربللي (شريك أول)' : 'Walid Al-Gharaballi (Senior Partner)'}</option>
                <option value="Tariq Al-Tayer">{isRtl ? 'طارق الطاير (مستشار مساعد)' : 'Tariq Al-Tayer (Associate)'}</option>
              </select>
            </div>
          </div>

          {/* Prerequisite Tasks Selector */}
          {tasks.length > 0 && (
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center justify-between">
                <span>{isRtl ? 'المهام الحاكمة والمشترطات المسبقة (تمنع الاستكمال قبل إنجازها):' : 'Prerequisite Tasks (Blocks progression until finished):'}</span>
                <span className="text-[9px] text-amber-600 font-mono font-normal flex items-center gap-1">
                  <Lock className="w-3 h-3" />
                  {isRtl ? 'اعتمادية تتابعية' : 'Sequential Dependency'}
                </span>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-32 overflow-y-auto p-2 bg-white border border-slate-200 rounded-xl">
                {tasks.map((existingTask) => {
                  const isChecked = selectedDependsOnTaskIds.includes(existingTask.id);
                  return (
                    <label
                      key={existingTask.id}
                      className={`p-2 rounded-lg border text-xs flex items-center gap-2 cursor-pointer transition-all ${
                        isChecked ? 'bg-amber-50 border-amber-300 text-amber-900 font-bold' : 'border-slate-100 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDependsOnTaskIds(prev => [...prev, existingTask.id]);
                          } else {
                            setSelectedDependsOnTaskIds(prev => prev.filter(id => id !== existingTask.id));
                          }
                        }}
                        className="rounded border-slate-300 text-amber-600 focus:ring-amber-500 h-3.5 w-3.5"
                      />
                      <span className="truncate min-w-0 flex-grow">{translateStaticText(existingTask.title, isRtl)}</span>
                      <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 shrink-0">
                        {existingTask.status}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.dueDate}</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">{t.priority}</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as any)}
                className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none"
              >
                <option value="Low">{isRtl ? 'منخفضة' : 'Low'}</option>
                <option value="Medium">{isRtl ? 'متوسطة' : 'Medium'}</option>
                <option value="High">{isRtl ? 'عالية' : 'High'}</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                id="visibleToClientCheckbox"
                checked={visibleToClient}
                onChange={e => setVisibleToClient(e.target.checked)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 h-4 w-4 cursor-pointer"
              />
              <label htmlFor="visibleToClientCheckbox" className="text-xs font-bold text-slate-500 uppercase tracking-wide cursor-pointer select-none">
                {t.clientVisible}
              </label>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-4 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100"
            >
              {t.cancel}
            </button>
            <button
              type="submit"
              disabled={submitting || !title}
              className="px-4 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 shadow-md shadow-indigo-100 flex items-center gap-1 disabled:opacity-50"
            >
              {submitting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              {t.saveTask}
            </button>
          </div>
        </form>
      )}

      {/* Drag Notice Toast */}
      {dragNotice && (
        <div className="bg-indigo-950 text-indigo-100 border border-indigo-500/40 text-xs px-3.5 py-2 rounded-xl flex items-center justify-between shadow-md animate-in fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold">{dragNotice}</span>
          </div>
          <span className="text-[10px] text-indigo-300 font-mono">Al Mizan Workflow Engine</span>
        </div>
      )}

      {/* Kanban Drag & Drop Helper Legend Bar */}
      <div className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 flex flex-wrap items-center justify-between text-[11px] text-slate-500 gap-2">
        <div className="flex items-center gap-1.5 font-medium">
          <ArrowRightLeft className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>
            {isRtl
              ? 'اسحب بطاقة المهمة وأفلتها في العمود المطلوب لتغيير مرحلة العمل، أو فوق أزرار الأولوية لتعديل درجة الأهمية'
              : 'Drag & drop task cards across stage columns to update status, or onto priority chips to change urgency.'}
          </span>
        </div>

        {/* Priority Drop Target Chips */}
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold text-slate-400 uppercase">{isRtl ? 'تغيير الأولوية بالنقل:' : 'Quick Priority Drop:'}</span>
          {(['High', 'Medium', 'Low'] as const).map(p => (
            <div
              key={p}
              onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
              onDrop={(e) => handleDropOnPriority(e, p)}
              className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border cursor-pointer transition-all ${
                p === 'High' ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100' :
                p === 'Medium' ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100' :
                'bg-indigo-50 text-indigo-600 border-indigo-200 hover:bg-indigo-100'
              }`}
              title={isRtl ? `أفلت المهمة هنا لتعيين أولوية ${getPriorityLocalized(p)}` : `Drop task here to set ${p} priority`}
            >
              + {getPriorityLocalized(p)}
            </div>
          ))}
        </div>
      </div>

      {/* Kanban Board Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-grow overflow-x-auto min-h-[300px]" id="kanban-board">
        {STAGES.map(stage => {
          const stageTasks = tasks.filter(t => {
            if (t.status !== stage) return false;
            if (boardScope === 'all') {
              if (matterFilter !== 'all' && t.matterId !== matterFilter) return false;
              if (assigneeFilter !== 'all' && t.assignedTo !== assigneeFilter) return false;
            }
            return true;
          });
          const isCurrentDropZone = dragOverStage === stage;

          return (
            <div
              key={stage}
              onDragOver={(e) => handleDragOver(e, stage)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDropOnStage(e, stage)}
              className={`rounded-2xl p-3 flex flex-col gap-3 min-w-[200px] transition-all duration-200 ${
                isCurrentDropZone
                  ? 'bg-indigo-50/60 border-2 border-indigo-500 shadow-md ring-2 ring-indigo-200'
                  : 'bg-slate-50/50 border border-slate-100'
              }`}
            >
              {/* Stage Header */}
              <div className="flex justify-between items-center px-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700 font-display">
                    {getStageLocalized(stage)}
                  </span>
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full font-mono ${
                  isCurrentDropZone ? 'bg-indigo-600 text-white' : 'bg-slate-200/60 text-slate-600'
                }`}>
                  {stageTasks.length}
                </span>
              </div>

              {/* Task Cards Container */}
              <div className="space-y-2.5 flex-grow overflow-y-auto max-h-[380px] pr-1">
                {loading ? (
                  <div className="flex justify-center py-6">
                    <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
                  </div>
                ) : stageTasks.length === 0 ? (
                  <div className={`py-8 text-center border-2 border-dashed rounded-xl transition-all ${
                    isCurrentDropZone ? 'border-indigo-400 bg-indigo-100/50 text-indigo-700' : 'border-slate-200 text-slate-400'
                  }`}>
                    <p className="text-[10px] font-bold">
                      {isCurrentDropZone ? (isRtl ? 'أفلت المهمة هنا' : 'Drop task here') : t.noTasks}
                    </p>
                  </div>
                ) : (
                  stageTasks.map(task => {
                    const isDraggingThis = draggedTask?.id === task.id;
                    const blockers = getBlockingTasks(task);
                    const hasBlockers = blockers.length > 0;
                    const taskMatter = matters.find(m => m.id === task.matterId);

                    return (
                      <div
                        key={task.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, task)}
                        className={`bg-white border p-3 rounded-xl shadow-xs hover:shadow-md transition-all flex flex-col gap-2 cursor-grab active:cursor-grabbing ${
                          isDraggingThis
                            ? 'opacity-40 border-2 border-dashed border-indigo-500 bg-indigo-50/20'
                            : hasBlockers
                            ? 'border-amber-300 bg-amber-50/10 hover:border-amber-400'
                            : 'border-slate-200/70 hover:border-indigo-200'
                        }`}
                      >
                        {/* Drag Grip Handle, Priority Tag & Client Visibility */}
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <GripVertical className="w-3.5 h-3.5 text-slate-300 hover:text-slate-600 cursor-grab shrink-0" />
                            <span className={`text-[8px] font-extrabold uppercase tracking-widest px-1.5 py-0.5 rounded-md ${
                              task.priority === 'High' ? 'bg-red-50 text-red-600 border border-red-100' :
                              task.priority === 'Medium' ? 'bg-amber-50 text-amber-600 border border-amber-100' :
                              'bg-indigo-50 text-indigo-600 border border-indigo-100'
                            }`}>
                              {getPriorityLocalized(task.priority)}
                            </span>

                            {/* Lock Badge if Task is Blocked */}
                            {hasBlockers && (
                              <span
                                onClick={() => setShowDependencyMatrixModal(true)}
                                className="text-[8px] font-extrabold uppercase bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5 cursor-pointer hover:bg-amber-200"
                                title={isRtl ? `مغلقة بواسطة: ${blockers.map(b => b.title).join(', ')}` : `Blocked by: ${blockers.map(b => b.title).join(', ')}`}
                              >
                                <Lock className="w-2.5 h-2.5 text-amber-700 shrink-0" />
                                <span>{isRtl ? 'محجوزة' : 'Blocked'}</span>
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => toggleTaskClientVisibility(task)}
                            title={task.visibleToClient ? "Shared with client" : "Hidden from client"}
                            className={`p-1 rounded-md border transition-all ${
                              task.visibleToClient
                                ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                                : 'bg-slate-50 text-slate-400 border-slate-200 hover:text-slate-600'
                            }`}
                          >
                            {task.visibleToClient ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          </button>
                        </div>

                        {/* Cross-Case Matter Badge */}
                        {boardScope === 'all' && (
                          <div className="text-[9px] font-bold text-indigo-800 bg-indigo-50/80 border border-indigo-100 rounded-md px-2 py-0.5 truncate flex items-center gap-1.5">
                            <FolderOpen className="w-2.5 h-2.5 text-indigo-500 shrink-0" />
                            <span className="truncate">{taskMatter ? taskMatter.title : task.matterId}</span>
                          </div>
                        )}

                        {/* Title & Description */}
                        <div>
                          <h4 className="text-xs font-bold text-slate-700 leading-snug">{translateStaticText(task.title, isRtl)}</h4>
                          {task.description && (
                            <p className="text-[10px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                              {translateStaticText(task.description || '', isRtl)}
                            </p>
                          )}
                        </div>

                        {/* Metadata row */}
                        <div className="flex justify-between items-center pt-2 border-t border-slate-100 mt-1">
                          <div className="flex items-center gap-1 text-[9px] text-slate-400">
                            <User className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[80px]" title={task.assignedTo}>
                              {translateStaticText(task.assignedTo, isRtl)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[9px] text-slate-400 font-mono">
                            <Calendar className="w-3 h-3 text-slate-400 shrink-0" />
                            <span>{new Date(task.dueDate).toLocaleDateString(undefined, {month: 'short', day: 'numeric'})}</span>
                          </div>
                        </div>

                        {/* Advance Stage controls */}
                        <div className="grid grid-cols-2 gap-1 mt-1 border-t border-slate-100/60 pt-1.5">
                          {STAGES.indexOf(task.status) > 0 && (
                            <button
                              type="button"
                              onClick={() => updateTaskStatus(task.id, STAGES[STAGES.indexOf(task.status) - 1])}
                              className="text-[9px] font-bold text-slate-500 hover:text-indigo-600 py-1 bg-slate-50 hover:bg-indigo-50 border border-slate-200/60 rounded-md transition-colors cursor-pointer"
                            >
                              {t.back}
                            </button>
                          )}
                          {STAGES.indexOf(task.status) < STAGES.length - 1 && (
                            <button
                              type="button"
                              onClick={() => updateTaskStatus(task.id, STAGES[STAGES.indexOf(task.status) + 1])}
                              className="text-[9px] font-bold text-slate-500 hover:text-indigo-600 py-1 bg-slate-50 hover:bg-indigo-50 border border-slate-200/60 rounded-md transition-colors col-start-2 cursor-pointer"
                            >
                              {t.next}
                            </button>
                          )}
                          {task.status === 'Completed' && (
                            <div className="col-span-2 text-center text-[9px] text-emerald-500 font-extrabold flex items-center justify-center gap-1 py-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> {t.completed}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Task Dependency Chain Flow Modal */}
      <TaskDependencyModal
        isOpen={showDependencyMatrixModal}
        onClose={() => setShowDependencyMatrixModal(false)}
        tasks={tasks}
      />

      {/* Blocked Task Advancement Interception Modal */}
      {blockedTaskAttempt && (
        <div className="fixed inset-0 z-[120] bg-slate-950/80 backdrop-blur-sm flex justify-center items-center p-4 animate-in fade-in">
          <div className="bg-white border border-amber-200 rounded-3xl p-5 sm:p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-amber-800">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5 text-amber-700" />
              </div>
              <div>
                <h4 className="text-sm sm:text-base font-extrabold font-display text-slate-800">
                  {isRtl ? 'المهمة محجوزة باشتراطات سابقة!' : 'Task Blocked by Prerequisites!'}
                </h4>
                <p className="text-xs text-slate-500">
                  {isRtl ? 'لا يمكن تحريك مرحلة هذه المهمة بسبب اشتراطات غير مكتملة' : 'Cannot advance task status due to active unfinished prerequisite tasks'}
                </p>
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 p-3.5 rounded-2xl text-xs text-amber-900 space-y-2">
              <p className="font-bold text-slate-800">
                "{translateStaticText(blockedTaskAttempt.task.title, isRtl)}"
              </p>
              <p className="text-[11px] text-amber-800">
                {isRtl ? 'المهام المعطلة المسبقة الحاكمة:' : 'Unfinished blocking tasks:'}
              </p>
              <ul className="space-y-1 list-disc list-inside text-[11px] font-bold text-amber-950">
                {blockedTaskAttempt.blockingTasks.map(bt => (
                  <li key={bt.id} className="truncate">
                    {translateStaticText(bt.title, isRtl)} ({bt.status})
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setShowDependencyMatrixModal(true);
                  setBlockedTaskAttempt(null);
                }}
                className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <Workflow className="w-4 h-4" />
                <span>{isRtl ? 'عرض المسار التتابعي واستكمال المهام السابقة' : 'View Dependency Chain Matrix'}</span>
              </button>

              <button
                type="button"
                onClick={() => updateTaskStatus(blockedTaskAttempt.task.id, blockedTaskAttempt.targetStage, true)}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-amber-600" />
                <span>{isRtl ? 'تجاوز بقرار الشريك المسؤول (قيد المراجعة)' : 'Partner Force Override Advance'}</span>
              </button>

              <button
                type="button"
                onClick={() => setBlockedTaskAttempt(null)}
                className="w-full py-1.5 text-slate-400 hover:text-slate-600 text-xs font-bold transition-colors cursor-pointer text-center"
              >
                {isRtl ? 'إلغاء' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

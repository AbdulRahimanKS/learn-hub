import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  FileText,
  Loader2,
  Zap,
  User,
  ExternalLink,
  Paperclip,
  CheckIcon,
  CircleAlert,
  Clock,
  CheckCircle2,
  ClipboardList,
  Sparkles,
  BookOpen,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { getFriendlyAiErrorMessage, isAiEvaluationFailureText } from '@/lib/ai-error-message';

/** Display marks with up to 2 decimals (no unnecessary trailing zeros). */
function formatMarkDisplay(n: number): string {
  const rounded = Math.round((Number(n) || 0) * 100) / 100;
  return rounded.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Same typography for all hero stat card titles (sentence-style, not all-caps). */
const heroStatTitleClass = 'text-[10px] font-semibold tracking-wide text-primary-foreground/60';

const SUBMISSION_STATUS_UI: Record<
  string,
  { label: string; Icon: LucideIcon; pill: string; iconClass?: string }
> = {
  pending: {
    label: 'Pending',
    Icon: Clock,
    pill: 'border-sky-300/40 bg-gradient-to-r from-sky-500/25 to-blue-500/20 text-sky-50 shadow-sm shadow-sky-900/20',
  },
  evaluating: {
    label: 'AI evaluating',
    Icon: Loader2,
    pill: 'border-violet-300/40 bg-gradient-to-r from-violet-500/25 to-fuchsia-500/15 text-violet-50',
    iconClass: 'animate-spin',
  },
  pending_review: {
    label: 'Pending review',
    Icon: ClipboardList,
    pill: 'border-amber-200/35 bg-gradient-to-r from-amber-500/20 to-orange-500/15 text-amber-50',
  },
  published: {
    label: 'Published',
    Icon: CheckCircle2,
    pill: 'border-emerald-300/40 bg-gradient-to-r from-emerald-500/25 to-teal-500/15 text-emerald-50',
  },
};

const SUBMISSION_STATUS_WORKFLOW_HINT =
  'Typical flow: Pending → AI evaluating (full job running) → Pending review (you grade) → Published (student sees results).';

function SubmissionStatusPill({
  status,
  compact,
}: {
  status: string | undefined;
  compact?: boolean;
}) {
  const key = (status || 'pending').toLowerCase();
  const cfg = SUBMISSION_STATUS_UI[key] ?? {
    label: key.replace(/_/g, ' '),
    Icon: ClipboardList,
    pill: 'border-white/25 bg-white/10 text-primary-foreground',
  };
  const Icon = cfg.Icon;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full border font-semibold tracking-wide backdrop-blur-sm',
        compact ? 'gap-1 px-2 py-0.5 text-[10px]' : 'gap-2 px-3 py-1.5 text-[11px]',
        cfg.pill,
      )}
      title={SUBMISSION_STATUS_WORKFLOW_HINT}
    >
      <Icon
        className={cn('shrink-0 opacity-95', compact ? 'h-3 w-3' : 'h-3.5 w-3.5', cfg.iconClass)}
        aria-hidden
      />
      <span>{cfg.label}</span>
    </span>
  );
}

function shortNameStatic(url: string | null | undefined) {
  if (!url) return 'File';
  return typeof url === 'string' ? url.split('/').pop()?.split('?')[0] || 'File' : 'File';
}

function referenceFileLabel(file: string | undefined, name?: string | null) {
  if (name && String(name).trim()) return String(name).trim();
  return shortNameStatic(file);
}

interface SubmissionReviewModalProps {
  open: boolean;
  onClose: () => void;
  /** Batch the submission belongs to (required for URL namespace). */
  batchId: string;
  submissionId: number;
  onUpdated: () => void;
}

export function SubmissionReviewModal({
  open,
  onClose,
  batchId,
  submissionId,
  onUpdated,
}: SubmissionReviewModalProps) {
  const { toast } = useToast();
  const [submission, setSubmission] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [evaluatingQuestionIds, setEvaluatingQuestionIds] = useState<string[]>([]);

  // Editable fields
  const [remarks, setRemarks] = useState('');
  const [qMarks, setQMarks] = useState<Record<string, string>>({});
  const [qFeedback, setQFeedback] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open && submissionId) {
      fetchSubmission();
    }
  }, [open, submissionId, batchId]);

  const submissionBase = `/api/courses/v1/batches/${batchId}/test-submissions/${submissionId}`;

  const fetchSubmission = async (options?: { preserveLocalMarks?: boolean; preserveRemarks?: boolean }) => {
    setIsLoading(true);
    try {
      const res = await apiClient.get(`${submissionBase}/`);
      if (res.data?.success) {
        const data = res.data.data;
        setSubmission(data);
        if (options?.preserveRemarks) {
          setRemarks((prev) => (String(prev || '').trim() ? prev : data.grader_remarks || ''));
        } else {
          setRemarks(data.grader_remarks || '');
        }
        
        const marksMap: Record<string, string> = {};
        const feedbackMap: Record<string, string> = {};
        data.answers?.forEach((ans: any) => {
          if (typeof ans.id === 'string' && ans.id.startsWith('unattended-')) return;
          const raw = ans.marks_obtained ?? ans.ai_score ?? 0;
          const maxM = Number(ans.max_marks) || 0;
          let num = Math.round((parseFloat(String(raw)) || 0) * 100) / 100;
          num = Math.max(0, Math.min(num, maxM));
          marksMap[String(ans.id)] = formatMarkDisplay(num);
          feedbackMap[String(ans.id)] = String(ans.ai_feedback || '');
        });
        if (options?.preserveLocalMarks) {
          setQMarks((prev) => ({ ...marksMap, ...prev }));
        } else {
          setQMarks(marksMap);
        }
        setQFeedback(feedbackMap);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch submission details.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateStatus = async (status: string) => {
    setIsSaving(true);
    try {
      const wasPublished = submission?.status === 'published';
      const answersUpdate = Object.entries(qMarks)
        .filter(([id]) => !id.startsWith('unattended-'))
        .map(([id, marks]) => ({
          id: parseInt(id, 10),
          marks_obtained: Math.round((parseFloat(marks) || 0) * 100) / 100,
          ai_feedback: String(qFeedback[id] || '').trim(),
        }))
        .filter(row => !Number.isNaN(row.id));

      const totalMarksObtained = answersUpdate.reduce((acc, curr) => acc + curr.marks_obtained, 0);
      const totalPossible = submission?.answers?.reduce((acc: number, curr: any) => acc + curr.max_marks, 0) || 1;
      const percentage = (totalMarksObtained / totalPossible) * 100;
      
      const payload = {
        status,
        grader_remarks: remarks,
        marks_obtained: parseFloat(percentage.toFixed(2)),
        is_passed: percentage >= Number(submission?.pass_percentage ?? 70),
        answers: answersUpdate
      };

      await apiClient.patch(`${submissionBase}/`, payload);
      toast({
        title: 'Success',
        description: wasPublished ? 'Published result updated successfully.' : `Submission ${status.replace('_', ' ')} successfully.`,
        variant: 'success',
      });
      onUpdated();
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update submission.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerQuestionAI = async (answerId: number) => {
    const idKey = String(answerId);
    setEvaluatingQuestionIds(prev => [...prev, idKey]);
    try {
      const res = await apiClient.post(`${submissionBase}/answers/${answerId}/trigger-ai/`);
      if (res.data?.success) {
        toast({ title: 'Question Analyzed', description: 'AI has evaluated this specific question.', variant: 'success' });
        // Update local state for just this answer
        const updatedAnswer = res.data.data;
        setSubmission((prev: any) => ({
          ...prev,
          answers: prev.answers.map((a: any) => (a.id === answerId ? { ...a, ...updatedAnswer } : a)),
        }));
        if (updatedAnswer.ai_feedback !== undefined) {
          setQFeedback(prev => ({ ...prev, [idKey]: String(updatedAnswer.ai_feedback || '') }));
        }
        // Also update qMarks if AI suggested a score
        if (updatedAnswer.ai_score !== null && updatedAnswer.ai_score !== undefined) {
          const maxM = Number(updatedAnswer.max_marks) || 0;
          let v = Math.round((Number(updatedAnswer.ai_score) || 0) * 100) / 100;
          v = Math.max(0, Math.min(v, maxM));
          setQMarks(prev => ({ ...prev, [idKey]: formatMarkDisplay(v) }));
        }
        // Re-sync from DB so any backend-side writes are reflected without closing modal.
        await fetchSubmission({ preserveLocalMarks: true, preserveRemarks: true });
      }
    } catch (err) {
      toast({ title: 'AI Error', description: 'Failed to analyze this question.', variant: 'destructive' });
    } finally {
      setEvaluatingQuestionIds(prev => prev.filter(id => id !== idKey));
    }
  };

  /** Allow typing; max two fraction digits; cannot exceed this question’s max marks. */
  const handleMarkChange = (answerId: string, maxMarks: number, rawValue: string) => {
    if (rawValue === '') {
      setQMarks(prev => ({ ...prev, [answerId]: '' }));
      return;
    }
    if (!/^\d*\.?\d{0,2}$/.test(rawValue)) return;
    if (!rawValue.endsWith('.')) {
      const n = Number(rawValue);
      if (Number.isFinite(n) && n > maxMarks) {
        setQMarks(prev => ({ ...prev, [answerId]: formatMarkDisplay(maxMarks) }));
        return;
      }
    }
    setQMarks(prev => ({ ...prev, [answerId]: rawValue }));
  };

  const handleMarkBlur = (answerId: string, maxMarks: number) => {
    setQMarks(prev => {
      const cur = prev[answerId];
      if (cur === '' || cur === undefined || cur === '.') {
        return { ...prev, [answerId]: formatMarkDisplay(0) };
      }
      const parsed = Number(cur);
      if (!Number.isFinite(parsed)) return { ...prev, [answerId]: formatMarkDisplay(0) };
      const clamped = Math.max(0, Math.min(parsed, maxMarks));
      const rounded2 = Math.round(clamped * 100) / 100;
      return { ...prev, [answerId]: formatMarkDisplay(rounded2) };
    });
  };

  const totalPossible = submission?.answers?.reduce((acc: number, curr: any) => acc + curr.max_marks, 0) || 0;
  const gradedPoints =
    submission?.answers?.reduce(
      (acc: number, curr: any) => acc + (parseFloat(qMarks[String(curr.id)] || '0') || 0),
      0,
    ) || 0;
  const overallPercentage = totalPossible > 0 ? (gradedPoints / totalPossible) * 100 : 0;
  const answeredQuestions = submission?.answers?.filter((answer: any) => answer.is_attended).length || 0;
  const unansweredQuestions = (submission?.answers || []).length - answeredQuestions;
  const aiScoreValue = typeof submission?.ai_score === 'number' ? submission.ai_score : null;
  /**
   * Backend (`_process_ai_result`): full “Run AI review” stores submission.ai_score as the **sum** of
   * per-question scores (each 0…question max) from that one model response — same units as test marks.
   */
  const aiSuggestedMarks =
    aiScoreValue !== null && totalPossible > 0 ? Math.max(0, aiScoreValue) : null;
  const sumPerQuestionAiSuggested = (submission?.answers || []).reduce((acc: number, a: any) => {
    if (typeof a.id === 'string' && String(a.id).startsWith('unattended-')) return acc;
    if (a.ai_score === null || a.ai_score === undefined) return acc;
    return acc + (Number(a.ai_score) || 0);
  }, 0);
  const aiHeaderVsRowsMismatch =
    aiScoreValue !== null &&
    totalPossible > 0 &&
    Math.abs(sumPerQuestionAiSuggested - aiScoreValue) > 0.051;
  /** From API: `BatchWeeklyTest.pass_percentage` on submission. Fallback matches Django model default (70). */
  const passPercentage = Number(submission?.pass_percentage ?? 70);
  const isReadyToPass = overallPercentage >= passPercentage;
  /** Backend sets this while the async full-submission AI job is running (Celery). */
  const isSubmissionAiJobRunning = submission?.status === 'evaluating';
  const perQuestionAiDisabled = (answerId: string) =>
    isSubmissionAiJobRunning || evaluatingQuestionIds.includes(answerId);

  if (isLoading && !submission) {
    return (
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="flex items-center justify-center p-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="h-[96vh] w-[96vw] max-w-[1400px] flex flex-col rounded-3xl border border-primary/25 bg-background p-0 overflow-hidden shadow-2xl [&>button]:right-4 [&>button]:top-4 [&>button]:z-[60] [&>button]:text-primary-foreground [&>button]:opacity-90 [&>button]:ring-offset-transparent [&>button]:hover:bg-white/10 [&>button]:hover:text-primary-foreground [&>button]:hover:opacity-100 data-[state=open]:[&>button]:bg-transparent data-[state=open]:[&>button]:text-primary-foreground">
        <div className="relative shrink-0 space-y-0 overflow-hidden border-b border-white/10 gradient-primary p-8 text-primary-foreground">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-white/5 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-28 w-28 rounded-full bg-primary/20 blur-2xl" />
          </div>
          <div className="relative z-10 space-y-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10 backdrop-blur-md">
                  <User className="h-6 w-6 text-primary-foreground" />
                </div>
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <DialogTitle className="m-0 text-left text-2xl font-bold tracking-tight">
                      {submission?.student_name}
                    </DialogTitle>
                    <SubmissionStatusPill compact status={submission?.status} />
                  </div>
                  {submission?.test_title ? (
                    <p className="flex items-center gap-2 text-sm font-medium text-primary-foreground/90">
                      <FileText className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
                      <span className="truncate">{submission.test_title}</span>
                    </p>
                  ) : null}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-left backdrop-blur-sm sm:text-right">
                <p className="text-[10px] font-semibold text-primary-foreground/60">Submitted on</p>
                <p className="mt-1 text-xs font-medium text-primary-foreground/90">
                  {submission?.submitted_at && format(new Date(submission.submitted_at), 'MMM d, yyyy • h:mm a')}
                </p>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-12 lg:items-stretch">
              <div
                className="flex min-h-[132px] flex-col rounded-2xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur-sm lg:col-span-5"
                title="The percentage and total here are calculated only from the numbers you enter in each question’s Pts field below. Nothing from AI is applied automatically."
              >
                <p className={heroStatTitleClass}>Your result</p>
                <p className="mt-0.5 text-[10px] leading-snug text-primary-foreground/50">
                  From <span className="font-medium text-primary-foreground/65">Pts</span> you enter on each question
                </p>
                <div className="mt-1 flex flex-wrap items-end gap-2">
                  <span className="text-3xl font-bold tabular-nums text-primary-foreground sm:text-4xl">
                    {overallPercentage.toFixed(1)}
                  </span>
                  <span className="pb-1 text-lg font-semibold text-primary-foreground/80">%</span>
                  <span
                    className={cn(
                      'mb-1 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide',
                      isReadyToPass ? 'bg-emerald-500/20 text-emerald-100' : 'bg-amber-500/20 text-amber-100',
                    )}
                  >
                    {isReadyToPass ? 'At or above pass' : 'Below pass'}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <div
                    className={cn('h-full rounded-full transition-all', isReadyToPass ? 'bg-emerald-400' : 'bg-amber-400')}
                    style={{ width: `${Math.min(overallPercentage, 100)}%` }}
                  />
                </div>
                <p className="mt-auto pt-3 text-xs leading-relaxed text-primary-foreground/80">
                  <span className="font-semibold text-primary-foreground">Your marks total</span>{' '}
                  {formatMarkDisplay(gradedPoints)} / {formatMarkDisplay(totalPossible)} · Pass requires{' '}
                  <span className="font-semibold">{passPercentage}%</span> of the test total
                </p>
              </div>

              <div className="flex min-h-[132px] flex-col rounded-2xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur-sm lg:col-span-3">
                <p className={heroStatTitleClass}>Progress</p>
                <p className="mt-2 text-2xl font-bold tabular-nums text-primary-foreground">
                  {answeredQuestions}/{submission?.answers?.length ?? 0}
                </p>
                <p className="mt-1 text-xs text-primary-foreground/75">Questions with a response</p>
                <div className="mt-auto">
                  {unansweredQuestions > 0 ? (
                    <p className="mt-2 text-[11px] text-amber-100/90">{unansweredQuestions} not answered</p>
                  ) : (
                    <p className="mt-2 text-[11px] text-primary-foreground/60">All questions seen</p>
                  )}
                </div>
              </div>

              <div
                className="flex min-h-[132px] flex-col rounded-2xl border border-white/15 bg-white/[0.07] p-4 backdrop-blur-sm lg:col-span-4"
                title="From full AI review (triggered in submissions list): the sum of each question’s AI score (0 to that question’s max) from that run."
              >
                <p className={heroStatTitleClass}>AI suggested total</p>
                <p className="mt-0.5 text-[10px] leading-snug text-primary-foreground/50">
                  Sum of per-question AI scores from the last{' '}
                  <span className="font-medium text-primary-foreground/65">full</span> AI review
                </p>
                {aiScoreValue === null || totalPossible <= 0 ? (
                  <p className="mt-2 text-[11px] leading-snug text-primary-foreground/70">
                    Run <span className="font-semibold text-primary-foreground/85">AI review</span> (status pending) to
                    see a model draft here.
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-xl font-bold tabular-nums leading-tight text-primary-foreground">
                      {formatMarkDisplay(aiSuggestedMarks ?? 0)}
                      <span className="text-sm font-semibold text-primary-foreground/75">
                        {' '}
                        / {formatMarkDisplay(totalPossible)} marks
                      </span>
                    </p>
                    <p
                      className="mt-auto break-words pt-2 text-[11px] leading-snug text-primary-foreground/70"
                      title="The model returns a score from 0 to each question’s max; the server adds those scores into this total."
                    >
                      The model scores each question (0 to its max); this number is the{' '}
                      <span className="font-semibold text-primary-foreground/85">sum</span> from the last full AI run.
                    </p>
                    {aiHeaderVsRowsMismatch ? (
                      <p className="pt-1 text-[10px] leading-snug text-amber-100/90">
                        Adding current “Suggested” rows = {formatMarkDisplay(sumPerQuestionAiSuggested)}; header still
                        shows {formatMarkDisplay(aiScoreValue)} from the last full run. Run full AI again to sync, or trust
                        the rows you refreshed individually.
                      </p>
                    ) : null}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col xl:flex-row divide-y xl:divide-y-0 xl:divide-x divide-border">
          <div className="flex-1 min-w-0 p-8 space-y-10 bg-background overflow-y-auto">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-2 mb-8 border-b border-border pb-4">
                <div className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center">
                  <User className="h-3.5 w-3.5" />
                </div>
                Detailed student responses
              </h3>
              
              <div className="space-y-12">
                {(submission?.answers || []).length > 0 ? (
                  submission.answers.map((answer: any, index: number) => {
                    const refAttachments = Array.isArray(answer.attachments) ? answer.attachments : [];
                    const hasReferenceMaterials = Boolean(answer.question_file) || refAttachments.length > 0;
                    const hasQuestionAi =
                      Boolean(String(answer.ai_feedback || '').trim()) ||
                      (answer.ai_score !== null && answer.ai_score !== undefined);
                    return (
                    <div key={answer.id} className="space-y-4 group animate-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${index * 100}ms` }}>
                    <Card className="border-border shadow-sm overflow-hidden bg-card hover:shadow-md transition-all duration-300">
                      <CardContent className="p-0">
                        <div className="border-b border-border bg-muted/40 p-5 space-y-4">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="min-w-0 w-full flex-1 space-y-3">
                              <div className="flex flex-wrap items-center gap-2">
                                <span
                                  className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm ring-2 ring-primary/25"
                                  title={`Question ${index + 1} in this test`}
                                >
                                  {index + 1}
                                </span>
                                <div
                                  className={cn(
                                    'inline-flex flex-wrap items-center gap-2 rounded-xl border px-2.5 py-1',
                                    answer.is_attended
                                      ? 'border-emerald-500/25 bg-emerald-500/[0.08]'
                                      : 'border-border/80 bg-background/80',
                                  )}
                                >
                                  <span
                                    className={cn(
                                      'relative text-[10px] font-semibold',
                                      answer.is_attended ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
                                    )}
                                  >
                                    {answer.is_attended ? (
                                      <>
                                        <span
                                          className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 align-middle shadow-[0_0_6px_rgba(16,185,129,0.7)]"
                                          aria-hidden
                                        />
                                        Answered
                                      </>
                                    ) : (
                                      'No submission'
                                    )}
                                  </span>
                                  <span className="h-3 w-px bg-border" aria-hidden />
                                  <span className="text-[10px] font-medium text-muted-foreground">
                                    Out of {formatMarkDisplay(Number(answer.max_marks) || 0)} marks
                                  </span>
                                </div>
                              </div>
                              <div>
                                <p className="mb-1 text-[10px] font-semibold text-muted-foreground">Question</p>
                                <div className="text-[15px] text-foreground font-medium leading-relaxed">
                                  {answer.question_text}
                                </div>
                              </div>
                              {answer.is_attended && (
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-8 w-fit rounded-xl px-3 text-[10px] font-semibold text-primary hover:bg-primary/10 hover:text-primary gap-1.5"
                                  onClick={() => handleTriggerQuestionAI(Number(answer.id))}
                                  disabled={perQuestionAiDisabled(String(answer.id))}
                                  title={
                                    hasQuestionAi
                                      ? 'Replace this question feedback draft and suggested marks using the latest answer text.'
                                      : 'Generate a feedback draft and suggested marks for this answer.'
                                  }
                                >
                                  {evaluatingQuestionIds.includes(String(answer.id)) ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Zap className="h-3.5 w-3.5 fill-primary" />
                                  )}
                                  {hasQuestionAi ? 'Refresh AI for this question' : 'Run AI for this question'}
                                </Button>
                              )}
                            </div>
                            <div className="shrink-0 rounded-2xl border border-border bg-background p-4 lg:w-36">
                              <Label className="text-[10px] font-semibold normal-case tracking-normal text-muted-foreground">Awarded marks</Label>
                              <div className="relative mt-2">
                                <Input
                                  type="text"
                                  inputMode="decimal"
                                  autoComplete="off"
                                  className="h-12 rounded-xl border-border bg-background pr-3 text-right text-2xl font-semibold tabular-nums"
                                  value={qMarks[String(answer.id)] ?? '0'}
                                  onChange={e =>
                                    handleMarkChange(
                                      String(answer.id),
                                      Number(answer.max_marks) || 0,
                                      e.target.value,
                                    )
                                  }
                                  onBlur={() => handleMarkBlur(String(answer.id), Number(answer.max_marks) || 0)}
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-muted-foreground pointer-events-none">
                                  Pts
                                </div>
                              </div>
                            </div>
                          </div>
                          {hasReferenceMaterials ? (
                            <div className="w-full min-w-0 rounded-2xl border border-primary/15 bg-primary/[0.04] p-4">
                              <Label className="mb-3 flex items-center gap-2 text-[10px] font-semibold text-primary/80">
                                <BookOpen className="h-3.5 w-3.5 shrink-0" aria-hidden />
                                Reference materials
                              </Label>
                              <ul className="space-y-2">
                                {answer.question_file ? (
                                  <li>
                                    <a
                                      href={answer.question_file}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-background border border-border transition-all shadow-sm hover:border-primary/50 group/file"
                                    >
                                      <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary transition-transform group-hover/file:scale-110">
                                        <FileText className="h-5 w-5" aria-hidden />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-foreground truncate">
                                          {referenceFileLabel(answer.question_file, 'Question file')}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground font-medium">Open reference file</p>
                                      </div>
                                      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground group-hover/file:text-primary transition-colors" />
                                    </a>
                                  </li>
                                ) : null}
                                {refAttachments.map((att: { id: number; file: string; name?: string | null }) => (
                                  <li key={att.id}>
                                    <a
                                      href={att.file}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-background border border-border transition-all shadow-sm hover:border-primary/50 group/file"
                                    >
                                      <div className="h-10 w-10 shrink-0 rounded-xl bg-primary/10 flex items-center justify-center text-primary transition-transform group-hover/file:scale-110">
                                        <BookOpen className="h-5 w-5" aria-hidden />
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-foreground truncate">
                                          {referenceFileLabel(att.file, att.name)}
                                        </p>
                                        <p className="text-[10px] text-muted-foreground font-medium">Open reference file</p>
                                      </div>
                                      <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground group-hover/file:text-primary transition-colors" />
                                    </a>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ) : null}
                        </div>
                        <div className="space-y-5 p-6">
                          <div className="flex flex-col gap-2">
                            <Label className="text-[10px] font-semibold text-primary/70">Student response</Label>
                            {answer.is_attended ? (
                              answer.answer_text ? (
                                <div className="whitespace-pre-wrap text-[15px] text-foreground leading-relaxed font-medium bg-background p-4 rounded-2xl border border-dashed border-border">
                                  {answer.answer_text}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground italic bg-background p-4 rounded-2xl border border-dashed border-border">No text response provided.</div>
                              )
                            ) : (
                              <div className="flex gap-3 rounded-2xl border border-border/80 bg-muted/30 p-4">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                                  <CircleAlert className="h-5 w-5" aria-hidden />
                                </div>
                                <div className="min-w-0 space-y-1">
                                  <p className="text-sm font-semibold text-foreground">No answer submitted</p>
                                  <p className="text-xs leading-relaxed text-muted-foreground">
                                    This question was left blank. Award <span className="font-medium text-foreground">0</span>{' '}
                                    marks or adjust if partial credit applies.
                                  </p>
                                </div>
                              </div>
                            )}
                          </div>
                          {answer.answer_file && (
                            <div className="pt-1">
                              <Label className="text-[10px] font-semibold text-primary/70 mb-2 block">Attachment</Label>
                              <a href={answer.answer_file} target="_blank" rel="noreferrer" className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-background border border-border group/file hover:border-primary/50 transition-all shadow-sm">
                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary transition-transform group-hover/file:scale-110">
                                  <Paperclip className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-foreground truncate">{shortNameStatic(answer.answer_file)}</p>
                                  <p className="text-[10px] text-muted-foreground font-medium">Open submission file</p>
                                </div>
                                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover/file:text-primary transition-colors" />
                              </a>
                            </div>
                          )}
                          {answer.ai_feedback && (
                            <div
                              className={cn(
                                'rounded-2xl border p-4',
                                isAiEvaluationFailureText(answer.ai_feedback)
                                  ? 'border-destructive/25 bg-destructive/[0.06]'
                                  : 'border-primary/15 bg-primary/[0.04]',
                              )}
                            >
                              {isAiEvaluationFailureText(answer.ai_feedback) ? (
                                <div className="space-y-2">
                                  <p className="text-[10px] font-semibold text-destructive">Analysis failed</p>
                                  <p className="text-sm leading-relaxed text-destructive/90">
                                    {getFriendlyAiErrorMessage(answer.ai_feedback)}
                                  </p>
                                </div>
                              ) : (
                                <div className="mb-2 flex items-center gap-2">
                                  <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
                                    <Zap className="h-3 w-3 fill-current" />
                                    AI draft
                                  </span>
                                  <span className="text-xs font-semibold text-muted-foreground">
                                    Suggested: {formatMarkDisplay(Number(answer.ai_score) || 0)} /{' '}
                                    {formatMarkDisplay(Number(answer.max_marks) || 0)}
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                          {typeof answer.id !== 'string' && (
                            <div className="space-y-2">
                              <Label className="text-[10px] font-semibold text-muted-foreground">
                                Feedback
                              </Label>
                              <Textarea
                                placeholder="Feedback for this question (auto-filled from AI if available)."
                                className="min-h-[90px] bg-background border border-border rounded-xl text-[13px] font-medium resize-y focus:ring-primary/20 focus:border-primary"
                                value={qFeedback[String(answer.id)] ?? ''}
                                onChange={(e) =>
                                  setQFeedback((prev) => ({ ...prev, [String(answer.id)]: e.target.value }))
                                }
                              />
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                    );
                  })
               ) : (
                 <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
                       <FileText className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <div>
                       <p className="text-muted-foreground font-bold">No questions found for this test.</p>
                       <p className="text-muted-foreground text-xs mt-1">Check if the test configuration has questions assigned.</p>
                    </div>
                 </div>
               )}
              </div>
            </div>
          </div>

          <div className="w-full xl:w-[430px] 2xl:w-[460px] p-8 space-y-8 shrink-0 bg-muted/20 overflow-y-auto xl:border-l border-border">
            <div>
              <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-2 mb-6">
                <div className="h-6 w-6 rounded-lg bg-background border border-border flex items-center justify-center">
                  <Zap className="h-3.5 w-3.5" />
                </div>
                Review summary
              </h3>
              <div className="space-y-6">
                <div className="rounded-[28px] border border-border bg-background p-6 shadow-sm">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground">AI evaluation</p>
                      <p className="mt-1 text-sm text-foreground font-semibold">Optional grading assistant</p>
                    </div>
                  </div>
                  <p className="mb-3 text-[11px] leading-relaxed text-muted-foreground">
                    Full AI review (from the submissions list) asks the model for each
                    question’s score (0 to that question’s max) in one go; the server <span className="font-semibold text-foreground/90">sums</span>{' '}
                    them into the blue header total and saves per-card “Suggested” lines. It does{' '}
                    <span className="font-semibold text-foreground/90">not</span> publish grades.{' '}
                    <span className="font-semibold text-foreground/90">Refresh AI for this question</span> updates only
                    that row until you run full AI again.
                  </p>
                  {isSubmissionAiJobRunning && (
                    <p className="mb-3 rounded-xl border border-violet-500/25 bg-violet-500/10 px-3 py-2 text-[11px] text-muted-foreground">
                      <Loader2 className="mr-1.5 inline h-3.5 w-3.5 animate-spin align-middle text-violet-600 dark:text-violet-300" />
                      Full submission AI running — question-level AI is paused until it finishes.
                    </p>
                  )}
                  <p className="mb-4 text-[11px] text-muted-foreground">
                    Blue header: your marks total vs AI sum from the last full run. Summary text below.
                  </p>
                  <div className="rounded-2xl border border-border bg-muted/20 p-4 min-h-28">
                    {submission?.ai_feedback ? (
                      isAiEvaluationFailureText(submission.ai_feedback) ? (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold text-destructive">Analysis failed</p>
                          <p className="text-sm leading-relaxed text-destructive/90">
                            {getFriendlyAiErrorMessage(submission.ai_feedback)}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[10px] font-semibold text-muted-foreground">AI explanation (auto-generated)</p>
                          <p className="text-sm leading-relaxed text-foreground/90 italic">
                            &ldquo;{submission.ai_feedback}&rdquo;
                          </p>
                        </div>
                      )
                    ) : (
                      <div className="flex min-h-[7.5rem] flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border/70 bg-gradient-to-b from-muted/30 to-muted/10 px-5 py-6 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                          <Sparkles className="h-6 w-6" strokeWidth={1.75} aria-hidden />
                        </div>
                        <div className="max-w-[240px] space-y-1">
                          <p className="text-sm font-semibold text-foreground">No overall AI summary yet</p>
                          <p className="text-[11px] leading-relaxed text-muted-foreground">
                            Trigger full AI review from the submissions list when status is pending.
                            For each question here, use <span className="font-medium text-foreground/90">Run AI for this question</span>.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-semibold text-muted-foreground ml-1">Instructor feedback (published to student)</Label>
                    <Textarea placeholder="Share final feedback for the student (strengths, mistakes, and next steps)." className="min-h-[180px] bg-background border border-border rounded-2xl text-[14px] font-medium resize-none focus:ring-primary/20 focus:border-primary transition-all p-5" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                  </div>
                </div>

                <div className="pt-6 border-t border-border space-y-4">
                   <Button variant="gradient" className="w-full h-12 rounded-2xl text-sm font-bold shadow-none hover:shadow-none transition-all active:scale-95" onClick={() => handleUpdateStatus('published')} disabled={isSaving}>
                     {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckIcon className="h-5 w-5 mr-3" />}
                     {submission?.status === 'published' ? 'Update published result' : 'Confirm and publish'}
                   </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

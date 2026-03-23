import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  CheckCircle,
  FileText,
  Clock,
  Eye,
  Hourglass,
  HelpCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface WeeklyTestResultsProps {
  open: boolean;
  onClose: () => void;
  onRetake?: () => void;
  submission: any; 
  testTitle: string;
}

export function WeeklyTestResults({
  open,
  onClose,
  onRetake,
  submission,
  testTitle,
}: WeeklyTestResultsProps) {
  if (!submission) return null;

  const isPassed = submission.is_passed;
  const score = submission.marks_obtained;
  const status = submission.status;
  const isPublished = status === 'published';

  const shortName = (url: string | null | undefined) => {
    if (!url) return 'File';
    if (typeof url !== 'string') return 'File';
    return url.split('/').pop()?.split('?')[0] || url;
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="flex max-h-[92vh] max-w-3xl flex-col overflow-hidden rounded-[28px] border border-primary/25 bg-background p-0 text-foreground shadow-2xl [&>button]:right-4 [&>button]:top-4 [&>button]:z-[60] [&>button]:text-primary-foreground [&>button]:opacity-90 [&>button]:ring-offset-transparent [&>button]:hover:bg-white/10 [&>button]:hover:text-primary-foreground [&>button]:hover:opacity-100 data-[state=open]:[&>button]:bg-transparent data-[state=open]:[&>button]:text-primary-foreground">
        {/* Header — match WeeklyTestSubmission / MCQ modal */}
        <div className="relative flex-none overflow-hidden border-b border-white/10 gradient-primary px-6 pb-4 pt-7 text-primary-foreground">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-white/5 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-28 w-28 rounded-full bg-primary/20 blur-2xl" />
          </div>
          <div className="relative z-10 flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
            <div className="min-w-0 space-y-3">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-primary-foreground backdrop-blur-md">
                  <HelpCircle className="h-3.5 w-3.5 shrink-0" />
                  Weekly assessment
                </div>
                <DialogTitle className="mb-1.5 text-2xl font-bold tracking-tight text-primary-foreground capitalize">
                  {testTitle}
                </DialogTitle>
                <DialogDescription className="text-[15px] text-primary-foreground/80">
                  Submitted {submission.submitted_at && format(new Date(submission.submitted_at), 'MMMM do, yyyy')}
                </DialogDescription>
                <div className="mt-3">
                  {isPublished ? (
                    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-emerald-400/35 bg-emerald-500/15 px-3 py-1 text-xs font-semibold tracking-tight text-emerald-100 backdrop-blur-md">
                      <CheckCircle className="h-3.5 w-3.5 shrink-0" />
                      Results published
                    </span>
                  ) : (
                    <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tracking-tight text-primary-foreground backdrop-blur-md">
                      <Clock className="h-3.5 w-3.5 shrink-0" />
                      Pending review
                    </span>
                  )}
                </div>
              </div>
            </div>

            {isPublished && (
              <div className="relative shrink-0">
                <div className="relative flex min-w-[130px] flex-col items-center justify-center rounded-2xl border border-white/15 bg-white/10 p-4 shadow-sm backdrop-blur-md">
                  <p className="mb-1 text-[10px] font-semibold tracking-tight text-primary-foreground/60">
                    Total score
                  </p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold tabular-nums tracking-tight text-primary-foreground">
                      {Math.round(score)}
                    </span>
                    <span className="text-sm font-semibold text-primary-foreground/50">%</span>
                  </div>
                  <div
                    className={cn(
                      'mt-2 h-1 w-full overflow-hidden rounded-full bg-white/10',
                      isPassed ? 'shadow-[0_0_10px_rgba(52,211,153,0.12)]' : 'shadow-[0_0_10px_rgba(244,63,94,0.12)]',
                    )}
                  >
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-1000',
                        isPassed ? 'bg-emerald-400' : 'bg-rose-400',
                      )}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
                {isPassed && (
                  <div className="absolute -bottom-1.5 -right-1.5 rounded-full border-2 border-background bg-emerald-500 p-1 text-white shadow-lg">
                    <CheckCircle className="h-3 w-3" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-background p-4 md:p-6 space-y-6 scrollbar-hide">
          {/* Status Message */}
          {!isPublished && (
            <div className="rounded-2xl border border-border bg-muted/30 p-5 flex flex-col items-center text-center space-y-2 animate-in fade-in slide-in-from-top-2 duration-500">
               <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-1">
                 <Hourglass className="h-5 w-5 animate-[spin_4s_linear_infinite]" />
               </div>
               <h4 className="text-base font-semibold text-foreground tracking-tight">Evaluation is currently pending.</h4>
               <p className="text-xs text-muted-foreground max-w-sm leading-relaxed">
                 You'll be notified once your instructor reviews views and publishes your results.
               </p>
            </div>
          )}

          {/* Questions Section */}
          <div className="space-y-4">
            <h3 className="flex items-center gap-3 text-xs font-semibold tracking-tight text-muted-foreground">
              <span className="h-px flex-1 bg-border" />
              {isPublished ? 'Performance summary' : 'Questions submitted'}
              <span className="h-px flex-1 bg-border" />
            </h3>

            {submission.answers && submission.answers.length > 0 ? (
              <div className="grid gap-4">
                {submission.answers.map((answer: any, idx: number) => (
                  <Card key={answer.id} className={cn(
                    "bg-card border border-border/60 rounded-2xl overflow-hidden group transition-all",
                    !answer.is_attended && "opacity-80 border-dashed border-border"
                  )}>
                    <CardContent className="p-4 md:p-5 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Label className="pointer-events-none text-xs font-semibold tracking-tight text-indigo-600 dark:text-blue-400">
                              Question {idx + 1}
                            </Label>
                            {!answer.is_attended && (
                              <Badge variant="outline" className="h-5 rounded-md border-rose-500/20 bg-rose-500/5 px-2 text-[10px] font-medium tracking-tight text-rose-500 dark:text-rose-400/80">
                                Not attended
                              </Badge>
                            )}
                          </div>
                          <h4 className="text-[13px] md:text-sm font-semibold text-foreground leading-relaxed">
                            {answer.question_text}
                          </h4>
                        </div>
                        {isPublished && answer.is_attended && (
                          <div className="text-right shrink-0">
                            <div className="flex items-baseline justify-end gap-1 font-semibold text-lg text-foreground">
                              {answer.marks_obtained ?? 0}
                              <span className="text-muted-foreground text-xs font-semibold">/ {answer.max_marks}</span>
                            </div>
                            <div className="mt-1.5 h-1 w-20 bg-muted rounded-full ml-auto overflow-hidden">
                               <div 
                                 className="h-full bg-emerald-500 transition-all duration-700"
                                 style={{ width: `${( (answer.marks_obtained || 0) / answer.max_marks) * 100}%` }}
                               />
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Submitted Answer Text/Status */}
                      {(!answer.is_attended || answer.answer_text) && (
                        <div className={cn(
                          "p-3 rounded-xl border font-medium whitespace-pre-wrap leading-relaxed shadow-sm text-[12px]",
                          answer.is_attended 
                            ? "bg-background border-border/60 text-foreground/80"
                            : "bg-muted/30 border-dashed border-border text-muted-foreground italic"
                        )}>
                          {!answer.is_attended ? "This question was not attended by the student." : answer.answer_text}
                        </div>
                      )}

                      {/* Attachments Section */}
                      {(answer.question_file || answer.answer_file || (answer.attachments && answer.attachments.length > 0)) && (
                        <div className="space-y-4">
                           {/* Question Resources */}
                           {(answer.question_file || (answer.attachments && answer.attachments.length > 0)) && (
                             <div className="space-y-2">
                               <div className="flex items-center gap-2 text-xs font-semibold tracking-tight text-muted-foreground">
                                 <HelpCircle className="h-3 w-3 shrink-0" /> Reference materials
                               </div>
                               <div className="grid grid-cols-1 gap-2">
                                  {answer.question_file && (
                                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border group/file hover:bg-muted/45 transition-all shadow-sm">
                                       <div className="flex items-center gap-2.5 min-w-0">
                                          <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                                            <FileText className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                                          </div>
                                          <div className="min-w-0">
                                             <p className="text-[11px] font-semibold text-foreground truncate" title={shortName(answer.question_file)}>
                                               {shortName(answer.question_file)}
                                             </p>
                                             <p className="text-[10px] font-medium text-muted-foreground">Question resource</p>
                                          </div>
                                       </div>
                                       <div className="flex items-center gap-1 opacity-40 group-hover/file:opacity-100 transition-opacity">
                                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                             <a
                                               href={answer.question_file}
                                               target="_blank"
                                               rel="noopener noreferrer"
                                               title="Open in new tab"
                                             >
                                               <Eye className="h-3.5 w-3.5" />
                                             </a>
                                          </Button>
                                       </div>
                                    </div>
                                  )}
                                  {(answer.attachments || []).map((att: any) => (
                                    <div key={att.id} className="flex items-center justify-between p-2.5 rounded-xl bg-muted/30 border border-border group/file hover:bg-muted/45 transition-all shadow-sm">
                                       <div className="flex items-center gap-2.5 min-w-0">
                                          <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                                            <FileText className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                                          </div>
                                          <div className="min-w-0">
                                             <p className="text-[11px] font-semibold text-foreground truncate" title={att.name || att.file}>
                                               {att.name || shortName(att.file)}
                                             </p>
                                             <p className="text-[10px] font-medium text-muted-foreground">Additional asset</p>
                                          </div>
                                       </div>
                                       <div className="flex items-center gap-1 opacity-40 group-hover/file:opacity-100 transition-opacity">
                                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                             <a
                                               href={att.file}
                                               target="_blank"
                                               rel="noopener noreferrer"
                                               title="Open in new tab"
                                             >
                                               <Eye className="h-3.5 w-3.5" />
                                             </a>
                                          </Button>
                                       </div>
                                    </div>
                                  ))}
                               </div>
                             </div>
                           )}

                           {/* Student Submission */}
                           {answer.answer_file && (
                             <div className="space-y-2">
                               <div className="flex items-center gap-2 text-xs font-semibold tracking-tight text-slate-500 dark:text-white/35">
                                 <CheckCircle className="h-3 w-3 shrink-0" /> Your submission
                               </div>
                               <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/5 border border-emerald-500/10 dark:border-emerald-500/10 group/file hover:bg-emerald-500/10 transition-all shadow-sm">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                     <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                                       <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                     </div>
                                     <div className="min-w-0">
                                        <p className="text-[11px] font-semibold text-foreground truncate" title={shortName(answer.answer_file)}>
                                          {shortName(answer.answer_file)}
                                        </p>
                                        <p className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400/60">Student solution</p>
                                     </div>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-40 group-hover/file:opacity-100 transition-opacity">
                                     <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 dark:text-emerald-400" asChild>
                                        <a
                                          href={answer.answer_file}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          title="Open in new tab"
                                        >
                                          <Eye className="h-3.5 w-3.5" />
                                        </a>
                                     </Button>
                                  </div>
                               </div>
                             </div>
                           )}
                        </div>
                      )}

                      {/* Feedback (if exists and published) */}
                      {isPublished && (answer.ai_feedback || answer.grader_remarks) && (
                        <div className="relative pt-3 flex flex-col gap-2">
                           <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border to-transparent" />
                           <p className="text-[13px] text-primary font-semibold leading-relaxed italic">
                             "{answer.grader_remarks || answer.ai_feedback}"
                           </p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="py-12 text-center">
                 <p className="text-muted-foreground text-sm font-semibold italic">No questions found for this submission.</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0 justify-end border-t border-border bg-background p-4 md:p-6 sm:flex-row">
          <Button
            variant="gradient"
            onClick={onClose}
            className="group h-10 w-full rounded-xl px-10 text-sm font-bold shadow-none hover:shadow-none sm:w-auto"
          >
            Done
            <CheckCircle className="ml-2 h-4 w-4 opacity-70 transition-opacity group-hover:opacity-100" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

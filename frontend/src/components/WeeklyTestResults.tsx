import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Award,
  CheckCircle,
  FileText,
  MessageSquare,
  AlertTriangle,
  Clock,
  ExternalLink,
  ChevronRight,
  Target,
  Download,
  Eye,
  Hourglass,
  Scale,
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
      <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-[#0a0f1d] text-slate-900 dark:text-white">
        {/* Header Section */}
        <div className={cn(
          "p-4 md:p-6 text-white shrink-0 relative overflow-hidden border-b border-black/5 dark:border-white/5",
          isPublished 
            ? "bg-gradient-to-br from-[#112240] via-[#0a192f] to-[#0a0f1d]" 
            : "bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab]"
        )}>
          {/* Decorative Background Icons */}
          {isPublished ? (
            <CheckCircle className="absolute -right-6 -bottom-6 h-32 w-32 opacity-10 -rotate-12 text-emerald-500" />
          ) : (
            <Hourglass className="absolute -right-6 -bottom-6 h-32 w-32 opacity-10 -rotate-12 text-white animate-[spin_10s_linear_infinite]" />
          )}
          
          <div className="relative z-10 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
            <div className="space-y-3">
              <div className="space-y-0.5">
                <DialogTitle className="text-xl md:text-2xl font-black tracking-tight leading-tight text-white capitalize">
                  {testTitle}
                </DialogTitle>
                <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                  Submitted {submission.submitted_at && format(new Date(submission.submitted_at), 'MMMM do, yyyy')}
                </p>
              </div>

              {isPublished ? (
                <Badge className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black uppercase py-1 px-3 text-[9px] tracking-widest rounded-full flex items-center gap-1.5 w-fit">
                  <CheckCircle className="h-3 w-3" />
                  Results Published
                </Badge>
              ) : (
                <Badge className="bg-white/10 text-white/80 border border-white/20 font-black uppercase py-1 px-3 text-[9px] tracking-widest rounded-full flex items-center gap-1.5 w-fit">
                  <Clock className="h-3 w-3" />
                  Pending Review
                </Badge>
              )}
            </div>

            {isPublished && (
              <div className="relative group">
                <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative bg-white/10 rounded-2xl p-4 backdrop-blur-xl border border-white/20 min-w-[130px] flex flex-col items-center justify-center shadow-2xl">
                  <p className="text-[9px] font-black uppercase text-white/50 tracking-[0.2em] mb-1">Total Score</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black tracking-tighter text-white">
                      {Math.round(score)}
                    </span>
                    <span className="text-sm font-bold text-white/50">%</span>
                  </div>
                  <div className={cn(
                    "mt-2 h-1 w-full bg-white/10 rounded-full overflow-hidden",
                    isPassed ? "shadow-[0_0_10px_rgba(52,211,153,0.1)]" : "shadow-[0_0_10px_rgba(244,63,94,0.1)]"
                  )}>
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all duration-1000",
                        isPassed ? "bg-emerald-400" : "bg-rose-400"
                      )}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>
                {isPassed && (
                  <div className="absolute -bottom-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-1 shadow-lg border-2 border-[#0a192f] scale-100">
                    <CheckCircle className="h-3 w-3" />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 scrollbar-hide">
          {/* Status Message */}
          {!isPublished && (
            <div className="bg-indigo-500/5 dark:bg-indigo-500/[0.03] border border-indigo-500/10 dark:border-indigo-500/20 rounded-2xl p-5 flex flex-col items-center text-center space-y-2 animate-in fade-in slide-in-from-top-2 duration-500">
               <div className="h-10 w-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 mb-1">
                 <Hourglass className="h-5 w-5 animate-[spin_4s_linear_infinite]" />
               </div>
               <h4 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Evaluation is currently pending.</h4>
               <p className="text-xs text-slate-500 dark:text-white/40 max-w-sm leading-relaxed">
                 You'll be notified once your instructor reviews views and publishes your results.
               </p>
            </div>
          )}

          {/* Questions Section */}
          <div className="space-y-4">
            <h3 className="text-[9px] font-black uppercase tracking-[0.3em] text-slate-400 dark:text-white/20 flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-100 dark:bg-white/5" />
              {isPublished ? "Performance Summary" : "Questions Submitted"}
              <span className="h-px flex-1 bg-slate-100 dark:bg-white/5" />
            </h3>

            {submission.answers && submission.answers.length > 0 ? (
              <div className="grid gap-4">
                {submission.answers.map((answer: any, idx: number) => (
                  <Card key={answer.id} className={cn(
                    "bg-slate-50/50 dark:bg-white/[0.02] border border-slate-200 dark:border-white/5 rounded-2xl overflow-hidden group transition-all",
                    !answer.is_attended && "opacity-80 border-dashed border-slate-300 dark:border-white/10"
                  )}>
                    <CardContent className="p-4 md:p-5 space-y-4">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Label className="text-[9px] font-black pointer-events-none text-indigo-600 dark:text-blue-400 uppercase tracking-widest">
                              Question {idx + 1}
                            </Label>
                            {!answer.is_attended && (
                              <Badge variant="outline" className="h-4 text-[7px] font-black uppercase tracking-tighter border-rose-500/20 text-rose-500 dark:text-rose-400/80 bg-rose-500/5 px-1.5 rounded-sm">
                                Not Attended
                              </Badge>
                            )}
                          </div>
                          <h4 className="text-[13px] md:text-sm font-bold text-slate-800 dark:text-white leading-relaxed">
                            {answer.question_text}
                          </h4>
                        </div>
                        {isPublished && answer.is_attended && (
                          <div className="text-right shrink-0">
                            <div className="flex items-baseline justify-end gap-1 font-black text-lg text-slate-900 dark:text-white">
                              {answer.marks_obtained ?? 0}
                              <span className="text-slate-400 dark:text-white/20 text-xs font-bold">/ {answer.max_marks}</span>
                            </div>
                            <div className="mt-1.5 h-1 w-20 bg-slate-200 dark:bg-white/5 rounded-full ml-auto overflow-hidden">
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
                            ? "bg-white dark:bg-white/[0.03] border-slate-100 dark:border-white/5 text-slate-600 dark:text-white/60"
                            : "bg-slate-100/30 dark:bg-white/[0.01] border-dashed border-slate-200 dark:border-white/5 text-slate-400 dark:text-white/20 italic"
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
                               <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 dark:text-white/20 uppercase tracking-widest">
                                 <HelpCircle className="h-3 w-3" /> Reference Materials
                               </div>
                               <div className="grid grid-cols-1 gap-2">
                                  {answer.question_file && (
                                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 group/file hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-all shadow-sm">
                                       <div className="flex items-center gap-2.5 min-w-0">
                                          <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                                            <FileText className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                                          </div>
                                          <div className="min-w-0">
                                             <p className="text-[11px] font-bold text-slate-800 dark:text-white truncate" title={shortName(answer.question_file)}>
                                               {shortName(answer.question_file)}
                                             </p>
                                             <p className="text-[8px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-wider">Question Resource</p>
                                          </div>
                                       </div>
                                       <div className="flex items-center gap-1 opacity-40 group-hover/file:opacity-100 transition-opacity">
                                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                             <a href={answer.question_file} target="_blank" rel="noreferrer">
                                               <Eye className="h-3.5 w-3.5" />
                                             </a>
                                          </Button>
                                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                             <a href={answer.question_file} download>
                                               <Download className="h-3.5 w-3.5" />
                                             </a>
                                          </Button>
                                       </div>
                                    </div>
                                  )}
                                  {(answer.attachments || []).map((att: any) => (
                                    <div key={att.id} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-100/50 dark:bg-white/5 border border-slate-200 dark:border-white/5 group/file hover:bg-slate-100 dark:hover:bg-white/[0.08] transition-all shadow-sm">
                                       <div className="flex items-center gap-2.5 min-w-0">
                                          <div className="h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center shrink-0">
                                            <FileText className="h-4 w-4 text-indigo-500 dark:text-indigo-400" />
                                          </div>
                                          <div className="min-w-0">
                                             <p className="text-[11px] font-bold text-slate-800 dark:text-white truncate" title={att.name || att.file}>
                                               {att.name || shortName(att.file)}
                                             </p>
                                             <p className="text-[8px] font-bold text-slate-400 dark:text-white/30 uppercase tracking-wider">Additional Asset</p>
                                          </div>
                                       </div>
                                       <div className="flex items-center gap-1 opacity-40 group-hover/file:opacity-100 transition-opacity">
                                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                             <a href={att.file} target="_blank" rel="noreferrer">
                                               <Eye className="h-3.5 w-3.5" />
                                             </a>
                                          </Button>
                                          <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                             <a href={att.file} download>
                                               <Download className="h-3.5 w-3.5" />
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
                               <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 dark:text-white/20 uppercase tracking-widest">
                                 <CheckCircle className="h-3 w-3" /> Your Submission
                               </div>
                               <div className="flex items-center justify-between p-2.5 rounded-xl bg-emerald-500/5 dark:bg-emerald-500/5 border border-emerald-500/10 dark:border-emerald-500/10 group/file hover:bg-emerald-500/10 transition-all shadow-sm">
                                  <div className="flex items-center gap-2.5 min-w-0">
                                     <div className="h-8 w-8 rounded-lg bg-emerald-100 dark:bg-emerald-500/20 flex items-center justify-center shrink-0">
                                       <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                     </div>
                                     <div className="min-w-0">
                                        <p className="text-[11px] font-bold text-slate-800 dark:text-white truncate" title={shortName(answer.answer_file)}>
                                          {shortName(answer.answer_file)}
                                        </p>
                                        <p className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400/60 uppercase tracking-wider">Student Solution</p>
                                     </div>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-40 group-hover/file:opacity-100 transition-opacity">
                                     <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 dark:text-emerald-400" asChild>
                                        <a href={answer.answer_file} target="_blank" rel="noreferrer">
                                          <Eye className="h-3.5 w-3.5" />
                                        </a>
                                     </Button>
                                     <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 dark:text-emerald-400" asChild>
                                        <a href={answer.answer_file} download>
                                          <Download className="h-3.5 w-3.5" />
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
                           <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-slate-200 dark:via-white/5 to-transparent" />
                           <p className="text-[13px] text-indigo-600 dark:text-emerald-400/80 font-bold leading-relaxed italic">
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
                 <p className="text-slate-400 dark:text-white/20 text-sm font-bold italic">No questions found for this submission.</p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="p-4 md:p-6 border-t border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-[#0a0f1d] shrink-0 flex flex-col sm:flex-row gap-4 items-center justify-between">
          <div className="w-full sm:w-auto order-2 sm:order-1">
            {isPublished && (
              <Button 
                variant="outline" 
                className="bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-white/60 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 font-bold rounded-xl h-10 px-5 gap-2 w-full sm:w-auto transition-all text-xs"
                onClick={() => alert('Feedback download started...')}
              >
                <Download className="h-3.5 w-3.5" />
                Download Feedback
              </Button>
            )}
          </div>
          
          <div className="flex items-center gap-3 w-full sm:w-auto order-1 sm:order-2">
            {(isPublished && !isPassed) && (
              <Button 
                variant="gradient" 
                className="flex-1 sm:flex-none font-black px-8 h-10 rounded-xl text-[10px] uppercase tracking-widest shadow-lg shadow-indigo-500/20"
                onClick={() => {
                  onClose();
                  onRetake?.();
                }}
              >
                Retake Assessment
              </Button>
            )}
            <Button 
              onClick={onClose} 
              className="flex-1 sm:flex-none bg-indigo-600 dark:bg-[#283593] hover:bg-indigo-700 dark:hover:bg-[#1a237e] text-white font-black px-10 h-10 rounded-xl uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-indigo-200 dark:shadow-blue-900/20 transition-all active:scale-[0.98] group"
            >
              Done
              <CheckCircle className="ml-2 h-3.5 w-3.5 opacity-50 group-hover:opacity-100 transition-opacity" />
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

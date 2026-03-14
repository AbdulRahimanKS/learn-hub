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
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface WeeklyTestResultsProps {
  open: boolean;
  onClose: () => void;
  onRetake?: () => void;
  submission: any; // Using any for now to simplify, but ideally use TestSubmission type
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

  const getStatusBadge = () => {
    switch (status) {
      case 'published':
        return <Badge className="bg-emerald-500/20 text-emerald-100 border-none font-bold uppercase py-1 px-3 text-[10px] tracking-widest">Result Published</Badge>;
      case 'pending_review':
        return <Badge className="bg-amber-500/20 text-amber-100 border-none font-bold uppercase py-1 px-3 text-[10px] tracking-widest">Under Review</Badge>;
      case 'evaluating':
        return <Badge className="bg-indigo-500/20 text-indigo-100 border-none font-bold uppercase py-1 px-3 text-[10px] tracking-widest animate-pulse">AI Evaluating</Badge>;
      default:
        return <Badge className="bg-white/10 text-white/80 border-none font-bold uppercase py-1 px-3 text-[10px] tracking-widest">{status.replace('_', ' ')}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[92vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-background">
        <div className={cn(
          "p-6 md:p-8 text-white shrink-0 relative overflow-hidden",
          isPassed 
            ? "bg-gradient-to-br from-emerald-600 via-teal-600 to-emerald-800" 
            : "bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab]"
        )}>
          {/* Decorative Background Icon */}
          <Award className="absolute -right-8 -top-8 h-48 w-48 opacity-10 rotate-12" />
          
          <div className="relative z-10">
            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-6 mb-6">
              <div className="space-y-3">
                <DialogTitle className="text-2xl md:text-3xl font-black tracking-tight leading-tight">
                  {testTitle}
                </DialogTitle>
                <div className="flex flex-wrap items-center gap-4">
                  {getStatusBadge()}
                  <span className="text-white/60 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Submitted {submission.submitted_at && format(new Date(submission.submitted_at), 'PPP')}
                  </span>
                </div>
              </div>
              <div className="bg-white/10 rounded-2xl p-5 backdrop-blur-md border border-white/20 min-w-[140px] flex flex-col items-center justify-center shadow-2xl">
                <p className="text-[10px] font-black uppercase text-white/50 tracking-[0.2em] mb-1">Total Score</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black tracking-tighter">{score}</span>
                  <span className="text-xl font-bold opacity-40">%</span>
                </div>
              </div>
            </div>

            {status === 'published' && (
              <div className={cn(
                "p-4 rounded-2xl flex items-center gap-4 border backdrop-blur-sm shadow-lg",
                isPassed ? "bg-white/10 border-white/20" : "bg-rose-500/10 border-rose-500/20"
              )}>
                <div className={cn(
                  "p-2.5 rounded-full shrink-0",
                  isPassed ? "bg-white text-emerald-600 shadow-xl" : "bg-white text-rose-600 shadow-xl"
                )}>
                  {isPassed ? <CheckCircle className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <div>
                  <p className="font-bold text-sm">
                    {isPassed ? "Congratulations! You've passed this assessment." : "You haven't reached the pass percentage for this week."}
                  </p>
                  <p className="text-xs opacity-70 mt-0.5">
                    {isPassed ? "Great progress! You can now move on to the next week." : "Review the feedback and try to refine your concepts."}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 scrollbar-hide bg-slate-50/30 dark:bg-background/20">
          {/* Detailed Feedback if Published */}
          {submission.grader_remarks && (
            <section className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-500">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Instructor Feedback
              </h3>
              <Card className="border-none shadow-sm bg-indigo-50/50 dark:bg-indigo-950/10 border-l-4 border-l-indigo-500 rounded-xl overflow-hidden">
                <CardContent className="p-5 text-sm md:text-base leading-relaxed text-slate-700 dark:text-slate-200 font-medium italic">
                  "{submission.grader_remarks}"
                </CardContent>
              </Card>
            </section>
          )}

          {/* Individual Question Breakdown */}
          {submission.answers && submission.answers.length > 0 && (
            <div className="space-y-6">
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 flex items-center gap-2">
                <Target className="h-4 w-4" /> Detailed performance
              </h3>
              {submission.answers.map((answer: any, idx: number) => (
                <Card key={answer.id} className="border-none shadow-md bg-white dark:bg-card dark:border dark:border-slate-800/50 rounded-2xl overflow-hidden group">
                  <div className="flex flex-col md:flex-row md:divide-x divide-slate-100 dark:divide-slate-800/50 h-full">
                    {/* Q Number & Score */}
                    <div className="w-full md:w-32 shrink-0 p-6 bg-slate-50/50 dark:bg-slate-900/30 flex flex-row md:flex-col items-center justify-between md:justify-center text-center gap-2">
                      <div className="text-left md:text-center">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Question</span>
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{answer.question_order || idx+1}</p>
                      </div>
                      <div className="h-px w-8 bg-slate-200 dark:bg-slate-800 hidden md:block my-2" />
                      <div className="text-right md:text-center">
                        <span className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1 md:hidden">Marks</span>
                        <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{answer.marks_obtained ?? '-'}</p>
                        <span className="text-[10px] font-bold text-slate-400 dark:text-slate-600">out of {answer.max_marks}</span>
                      </div>
                    </div>
                    
                    {/* Q Text & Student Response */}
                    <div className="flex-1 p-6 md:p-8 space-y-6">
                      <div>
                        <Label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 block">Question Context</Label>
                        <p className="text-base font-bold text-slate-800 dark:text-slate-200 leading-relaxed">{answer.question_text}</p>
                      </div>
                      
                      {answer.answer_text && (
                        <div>
                          <Label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-3 block">Your Submission</Label>
                          <div className="p-5 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800/50 text-sm md:text-base text-slate-600 dark:text-slate-300 font-medium whitespace-pre-wrap leading-relaxed shadow-inner">
                            {answer.answer_text}
                          </div>
                        </div>
                      )}

                      {answer.ai_feedback && (
                        <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-5 rounded-2xl border border-indigo-100/50 dark:border-indigo-900/30">
                          <p className="text-[10px] font-black text-indigo-600 dark:text-indigo-400 uppercase mb-3 tracking-[0.2em] flex items-center gap-2">
                            <Target className="h-3.5 w-3.5" /> Core Analysis
                          </p>
                          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-bold">
                            {answer.ai_feedback}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {status === 'pending_review' && (
            <div className="p-10 text-center space-y-6 py-16 animate-in fade-in zoom-in-95 duration-700">
              <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-amber-50 dark:bg-amber-950/30 text-amber-500 shadow-inner">
                <Clock className="h-10 w-10 animate-pulse" />
              </div>
              <div className="space-y-2">
                <h4 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Review in Progress</h4>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Our instructors are currently reviewing your work. Your final marks will be published soon.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 md:p-8 border-t border-slate-100 dark:border-slate-800/50 bg-white dark:bg-background shrink-0 flex flex-col sm:flex-row gap-3">
          <Button 
            variant="ghost" 
            onClick={onClose} 
            className="w-full sm:w-auto font-black px-10 h-12 rounded-xl text-slate-400 hover:text-slate-600 uppercase text-xs tracking-widest"
          >
            Close Result
          </Button>
          {(status === 'published' && !isPassed) && (
            <Button 
              variant="gradient" 
              className="w-full sm:w-auto font-black px-10 h-12 rounded-xl text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/20"
              onClick={() => {
                onClose();
                onRetake?.();
              }}
            >
              Retake Assessment
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

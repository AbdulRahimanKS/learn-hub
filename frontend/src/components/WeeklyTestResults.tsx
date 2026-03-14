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
        return <Badge className="bg-emerald-500 text-white font-bold uppercase py-1 px-3">Result Published</Badge>;
      case 'pending_review':
        return <Badge variant="secondary" className="bg-amber-500 text-white font-bold uppercase py-1 px-3">Under Instructor Review</Badge>;
      case 'evaluating':
        return <Badge variant="outline" className="text-primary border-primary font-bold uppercase py-1 px-3 animate-pulse">AI Evaluating...</Badge>;
      default:
        return <Badge variant="outline" className="font-bold uppercase py-1 px-3">{status.replace('_', ' ')}</Badge>;
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <div className={cn(
          "p-8 text-white shrink-0 relative overflow-hidden",
          isPassed ? "bg-gradient-to-br from-emerald-600 to-teal-700" : "bg-gradient-to-br from-slate-700 to-slate-800"
        )}>
          {/* Decorative Background Icon */}
          <Award className="absolute -right-8 -top-8 h-48 w-48 opacity-10 rotate-12" />
          
          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div>
                <DialogTitle className="text-3xl font-black tracking-tight mb-2">
                  {testTitle}
                </DialogTitle>
                <div className="flex items-center gap-3">
                  {getStatusBadge()}
                  <span className="text-white/60 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    Submitted {submission.submitted_at && format(new Date(submission.submitted_at), 'PPP')}
                  </span>
                </div>
              </div>
              <div className="text-center bg-white/10 rounded-2xl p-4 backdrop-blur-md border border-white/20 min-w-[120px]">
                <p className="text-[10px] font-black uppercase text-white/70 tracking-widest mb-1">Score</p>
                <p className="text-4xl font-black">{score}%</p>
              </div>
            </div>

            {status === 'published' && (
              <div className={cn(
                "p-4 rounded-xl flex items-center gap-4 border backdrop-blur-sm",
                isPassed ? "bg-white/10 border-white/20" : "bg-rose-500/10 border-rose-500/20"
              )}>
                <div className={cn(
                  "p-2.5 rounded-full",
                  isPassed ? "bg-emerald-400 text-emerald-900" : "bg-rose-400 text-rose-900"
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

        <div className="flex-1 overflow-y-auto p-8 space-y-8 scrollbar-hide bg-slate-50/50">
          {/* Detailed Feedback if Published */}
          {submission.grader_remarks && (
            <section className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" /> Instructor Feedback
              </h3>
              <Card className="border-emerald-100 bg-emerald-50/30">
                <CardContent className="p-5 text-sm leading-relaxed text-slate-700 italic">
                  "{submission.grader_remarks}"
                </CardContent>
              </Card>
            </section>
          )}

          {/* Individual Question Breakdown */}
          {submission.answers && submission.answers.length > 0 && (
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <Target className="h-4 w-4" /> Question Breakdown
              </h3>
              {submission.answers.map((answer: any, idx: number) => (
                <Card key={answer.id} className="border-slate-200/60 shadow-sm overflow-hidden">
                  <div className="flex divide-x divide-slate-100 h-full">
                    {/* Q Number & Score */}
                    <div className="w-24 shrink-0 p-4 bg-slate-100/30 flex flex-col items-center justify-center text-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase mb-1">Q {answer.question_order || idx+1}</span>
                      <p className="text-xl font-black text-slate-800">{answer.marks_obtained ?? '-'}</p>
                      <span className="text-[10px] font-bold text-slate-400">/ {answer.max_marks}</span>
                    </div>
                    
                    {/* Q Text & Student Response */}
                    <div className="flex-1 p-5 space-y-4">
                      <div>
                        <p className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wide">Question</p>
                        <p className="text-sm font-medium text-slate-800 line-clamp-2">{answer.question_text}</p>
                      </div>
                      
                      {answer.answer_text && (
                        <div>
                          <p className="text-xs font-bold text-slate-400 uppercase mb-2 tracking-wide">Your Answer</p>
                          <div className="p-3 rounded-lg bg-white border border-slate-100 text-sm text-slate-600 whitespace-pre-wrap">
                            {answer.answer_text}
                          </div>
                        </div>
                      )}

                      {answer.ai_feedback && (
                        <div className="bg-primary/5 p-4 rounded-xl border border-primary/10">
                          <p className="text-[10px] font-black text-primary uppercase mb-2 tracking-widest flex items-center gap-1.5">
                            <Award className="h-3 w-3" /> AI Analysis
                          </p>
                          <p className="text-xs text-slate-600 leading-relaxed font-medium capitalize">
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
            <div className="p-8 text-center space-y-4 py-12">
              <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Clock className="h-8 w-8" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-slate-800">Review in Progress</h4>
                <p className="text-sm text-slate-500 max-w-sm mx-auto mt-2">
                  Our instructors are currently reviewing your work. You'll receive a notification once the final marks are published.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-6 border-t bg-white">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto font-bold px-8">
            Close Result
          </Button>
          {(status === 'published' && !isPassed) && (
            <Button 
              variant="default" 
              className="w-full sm:w-auto font-black px-8 bg-slate-900"
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

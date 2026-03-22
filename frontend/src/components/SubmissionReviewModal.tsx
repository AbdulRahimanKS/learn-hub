import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Loader2,
  Zap,
  User,
  ExternalLink,
  Paperclip,
  CheckIcon,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface SubmissionReviewModalProps {
  open: boolean;
  onClose: () => void;
  submissionId: number;
  onUpdated: () => void;
}

export function SubmissionReviewModal({
  open,
  onClose,
  submissionId,
  onUpdated,
}: SubmissionReviewModalProps) {
  const { toast } = useToast();
  const [submission, setSubmission] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [evaluatingQuestionIds, setEvaluatingQuestionIds] = useState<number[]>([]);

  // Editable fields
  const [remarks, setRemarks] = useState('');
  const [qMarks, setQMarks] = useState<Record<number, string>>({});

  useEffect(() => {
    if (open && submissionId) {
      fetchSubmission();
    }
  }, [open, submissionId]);

  const fetchSubmission = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/api/courses/v1/test-submissions/${submissionId}/`);
      if (res.data?.success) {
        const data = res.data.data;
        setSubmission(data);
        setRemarks(data.grader_remarks || '');
        
        const marksMap: Record<number, string> = {};
        data.answers?.forEach((ans: any) => {
          marksMap[ans.id] = ans.marks_obtained?.toString() || ans.ai_score?.toString() || '0';
        });
        setQMarks(marksMap);
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
      const answersUpdate = Object.entries(qMarks)
        .filter(([id]) => !id.startsWith('unattended-'))
        .map(([id, marks]) => ({
          id: parseInt(id),
          marks_obtained: parseFloat(marks) || 0
        }));

      const totalMarksObtained = answersUpdate.reduce((acc, curr) => acc + curr.marks_obtained, 0);
      const totalPossible = submission?.answers?.reduce((acc: number, curr: any) => acc + curr.max_marks, 0) || 1;
      const percentage = (totalMarksObtained / totalPossible) * 100;
      
      const payload = {
        status,
        grader_remarks: remarks,
        marks_obtained: parseFloat(percentage.toFixed(2)),
        is_passed: percentage >= (submission?.batch_weekly_test?.pass_percentage || 50),
        answers: answersUpdate
      };

      await apiClient.patch(`/api/courses/v1/test-submissions/${submissionId}/`, payload);
      toast({ title: 'Success', description: `Submission ${status.replace('_', ' ')} successfully.`, variant: 'success' });
      onUpdated();
      onClose();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to update submission.', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTriggerAI = async () => {
    setIsEvaluating(true);
    try {
      const res = await apiClient.post(`/api/courses/v1/test-submissions/${submissionId}/trigger-ai/`);
      if (res.data?.success) {
        toast({ title: 'AI Analysis Complete', description: 'AI has evaluated the submission.', variant: 'success' });
        fetchSubmission();
      }
    } catch (err) {
      toast({ title: 'AI Error', description: 'AI evaluation failed.', variant: 'destructive' });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleTriggerQuestionAI = async (answerId: number) => {
    setEvaluatingQuestionIds(prev => [...prev, answerId]);
    try {
      const res = await apiClient.post(`/api/courses/v1/test-submissions/${submissionId}/answers/${answerId}/trigger-ai/`);
      if (res.data?.success) {
        toast({ title: 'Question Analyzed', description: 'AI has evaluated this specific question.', variant: 'success' });
        // Update local state for just this answer
        const updatedAnswer = res.data.data;
        setSubmission((prev: any) => ({
          ...prev,
          answers: prev.answers.map((a: any) => a.id === answerId ? { ...a, ...updatedAnswer } : a)
        }));
        // Also update qMarks if AI suggested a score
        if (updatedAnswer.ai_score !== null) {
          setQMarks(prev => ({ ...prev, [answerId]: updatedAnswer.ai_score.toString() }));
        }
      }
    } catch (err) {
      toast({ title: 'AI Error', description: 'Failed to analyze this question.', variant: 'destructive' });
    } finally {
      setEvaluatingQuestionIds(prev => prev.filter(id => id !== answerId));
    }
  };

  const shortName = (url: string | null | undefined) => {
    if (!url) return 'File';
    return typeof url === 'string' ? url.split('/').pop()?.split('?')[0] || 'File' : 'File';
  };

  const totalPossible = submission?.answers?.reduce((acc: number, curr: any) => acc + curr.max_marks, 0) || 0;
  const gradedPoints = Object.values(qMarks).reduce((acc, mark) => acc + (parseFloat(mark) || 0), 0);
  const overallPercentage = totalPossible > 0 ? (gradedPoints / totalPossible) * 100 : 0;
  const answeredQuestions = submission?.answers?.filter((answer: any) => answer.is_attended).length || 0;
  const unansweredQuestions = (submission?.answers || []).length - answeredQuestions;
  const aiScore = submission?.ai_score?.toFixed(1) || '0.0';
  const passPercentage = submission?.batch_weekly_test?.pass_percentage || 50;
  const isReadyToPass = overallPercentage >= passPercentage;

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
      <DialogContent className="h-[96vh] w-[96vw] max-w-[1400px] flex flex-col rounded-3xl border border-border bg-background p-0 overflow-hidden shadow-2xl">
        <DialogHeader className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-8 text-white shrink-0 space-y-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="relative z-10 space-y-6">
            <div className="flex justify-between items-start gap-6">
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                   <User className="h-6 w-6 text-primary-foreground" />
                  </div>
                  <div>
                    <DialogTitle className="text-3xl font-black tracking-tight">{submission?.student_name}</DialogTitle>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant="outline" className="border-white/20 text-white/70 bg-white/5 h-5 px-1.5 text-[9px] uppercase font-bold tracking-widest">
                        {submission?.batch_name}
                      </Badge>
                      <span className="text-[10px] text-white/30 font-black uppercase tracking-tighter">•</span>
                      <span className="text-xs text-white/70 font-medium flex items-center gap-1.5">
                        <FileText className="h-3 w-3" />
                        {submission?.test_title}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-right backdrop-blur-sm">
                  <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/40">Submission Status</p>
                  <p className="mt-1 text-sm font-black uppercase tracking-[0.12em] text-white">
                    {submission?.status?.replace('_', ' ')}
                  </p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="text-[9px] text-white/30 font-bold uppercase tracking-widest">Submitted On</span>
                  <span className="text-xs text-white/70 font-medium">
                    {submission?.submitted_at && format(new Date(submission.submitted_at), 'MMM d, yyyy • h:mm a')}
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              {[
                { label: 'Questions', value: `${answeredQuestions}/${(submission?.answers || []).length}`, hint: `${unansweredQuestions} unanswered` },
                { label: 'Total Marks', value: `${gradedPoints.toFixed(1)} / ${totalPossible}`, hint: `Pass percentage ${passPercentage}%` },
                { label: 'Final Score', value: `${overallPercentage.toFixed(1)}%`, hint: isReadyToPass ? 'Currently passing' : 'Needs improvement' },
                { label: 'AI Suggestion', value: `${aiScore}%`, hint: submission?.ai_feedback ? 'AI analysis available' : 'No AI analysis yet' },
              ].map((item) => (
                <div key={item.label} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 backdrop-blur-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-white/40">{item.label}</p>
                  <p className="mt-1 text-xl font-black text-white">{item.value}</p>
                  <p className="mt-1 text-xs text-white/60">{item.hint}</p>
                </div>
              ))}
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col xl:flex-row divide-y xl:divide-y-0 xl:divide-x divide-border">
          <div className="flex-1 min-w-0 p-8 space-y-10 bg-background overflow-y-auto">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 mb-8 border-b border-border pb-4">
                <div className="h-6 w-6 rounded-lg bg-muted flex items-center justify-center">
                  <User className="h-3.5 w-3.5" />
                </div>
                Detailed Student Responses
              </h3>
              
              <div className="space-y-12">
                {(submission?.answers || []).length > 0 ? (
                  submission.answers.map((answer: any, index: number) => (
                    <div key={answer.id} className="space-y-4 group animate-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${index * 100}ms` }}>
                    <Card className="border-border shadow-sm overflow-hidden bg-card hover:shadow-md transition-all duration-300">
                      <CardContent className="p-0">
                        <div className="border-b border-border bg-muted/40 p-5">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="space-y-3">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black text-xs shadow-md shadow-primary/20">
                                  {answer.question_order || index + 1}
                                </span>
                                <Badge variant="outline" className="border-border bg-background text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
                                  {answer.is_attended ? 'Answered' : 'Not attended'}
                                </Badge>
                                <Badge variant="outline" className="border-border bg-background text-muted-foreground font-bold text-[10px] uppercase tracking-wider">
                                  Max {answer.max_marks} marks
                                </Badge>
                              </div>
                              <div>
                                <p className="mb-1 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Question Prompt</p>
                                <div className="text-[15px] text-foreground font-medium leading-relaxed">
                                  {answer.question_text}
                                </div>
                              </div>
                              {answer.is_attended && (
                                <Button 
                                  size="sm" 
                                  variant="ghost" 
                                  className="h-8 w-fit rounded-xl px-3 text-[10px] font-black uppercase tracking-[0.1em] text-primary hover:bg-primary/10 hover:text-primary gap-1.5"
                                  onClick={() => handleTriggerQuestionAI(answer.id)}
                                  disabled={evaluatingQuestionIds.includes(answer.id)}
                                >
                                  {evaluatingQuestionIds.includes(answer.id) ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Zap className="h-3.5 w-3.5 fill-primary" />
                                  )}
                                  Re-evaluate This Answer
                                </Button>
                              )}
                            </div>
                            <div className="shrink-0 rounded-2xl border border-border bg-background p-4 lg:w-36">
                              <Label className="text-[9px] font-black uppercase text-muted-foreground">Awarded Marks</Label>
                              <div className="relative mt-2">
                                <Input 
                                  type="number" 
                                  step="0.5"
                                  max={answer.max_marks}
                                  min="0"
                                  className="h-12 border-border bg-background pr-3 text-right text-2xl font-black rounded-xl"
                                  value={qMarks[answer.id] || '0'}
                                  onChange={(e) => setQMarks({...qMarks, [answer.id]: e.target.value})}
                                />
                                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-muted-foreground pointer-events-none uppercase">
                                  Pts
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="space-y-5 p-6">
                          <div className="flex flex-col gap-2">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70">Student Response</Label>
                            {answer.is_attended ? (
                              answer.answer_text ? (
                                <div className="whitespace-pre-wrap text-[15px] text-foreground leading-relaxed font-medium bg-background p-4 rounded-2xl border border-dashed border-border">
                                  {answer.answer_text}
                                </div>
                              ) : (
                                <div className="text-sm text-muted-foreground italic bg-background p-4 rounded-2xl border border-dashed border-border">No text response provided.</div>
                              )
                            ) : (
                              <div className="rounded-2xl border border-dashed border-red-500/20 bg-red-500/5 p-4">
                                <p className="text-sm font-semibold text-red-600 dark:text-red-400">
                                  This question was not answered by the student.
                                </p>
                              </div>
                            )}
                          </div>
                          {answer.answer_file && (
                            <div className="pt-1">
                              <Label className="text-[10px] font-black uppercase tracking-widest text-primary/70 mb-2 block">Attachment</Label>
                              <a href={answer.answer_file} target="_blank" rel="noreferrer" className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-background border border-border group/file hover:border-primary/50 transition-all shadow-sm">
                                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary transition-transform group-hover/file:scale-110">
                                  <Paperclip className="h-5 w-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-foreground truncate">{shortName(answer.answer_file)}</p>
                                  <p className="text-[10px] text-muted-foreground font-medium">Open submission file</p>
                                </div>
                                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover/file:text-primary transition-colors" />
                              </a>
                            </div>
                          )}
                          {answer.ai_feedback && (
                            <div className="rounded-2xl border border-primary/15 bg-primary/[0.04] p-4">
                              <div className="mb-2 flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-1 text-[9px] font-black uppercase tracking-widest text-primary-foreground">
                                  <Zap className="h-3 w-3 fill-current" />
                                  AI Insight
                                </span>
                                <span className="text-xs font-semibold text-muted-foreground">
                                  {answer.ai_score}/{answer.max_marks}
                                </span>
                              </div>
                              <p className="text-sm leading-relaxed text-foreground/90 italic">"{answer.ai_feedback}"</p>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ))
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
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2 mb-6">
                <div className="h-6 w-6 rounded-lg bg-background border border-border flex items-center justify-center">
                  <Zap className="h-3.5 w-3.5" />
                </div>
                Review Summary
              </h3>
              <div className="space-y-6">
                <div className="rounded-[28px] border border-border bg-background p-6 shadow-sm">
                  <div className="mb-5 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">AI Evaluation</p>
                      <p className="mt-1 text-sm text-foreground font-semibold">Suggested grading support</p>
                    </div>
                    <Button size="sm" variant="outline" className="h-9 rounded-xl text-xs font-bold" onClick={handleTriggerAI} disabled={isEvaluating}>
                      {isEvaluating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" /> : <Zap className="h-3.5 w-3.5 mr-2" />}
                      {submission?.status === 'pending' ? 'Trigger AI' : 'Refresh AI'}
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl bg-muted/40 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">AI Score</p>
                      <p className="mt-2 text-3xl font-black text-foreground">{aiScore}</p>
                      <p className="text-xs text-muted-foreground">Suggested / 100</p>
                    </div>
                    <div className="rounded-2xl bg-muted/40 p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">Review Status</p>
                      <p className="mt-2 text-lg font-black text-foreground capitalize">{submission?.status?.replace('_', ' ')}</p>
                      <p className="text-xs text-muted-foreground">{submission?.ai_feedback ? 'AI notes available' : 'No AI notes yet'}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-2xl border border-border bg-muted/20 p-4 min-h-28">
                    {submission?.ai_feedback ? (
                      submission.ai_feedback.includes('AI Evaluation Error') || submission.ai_feedback.includes('Catastrophic failure') ? (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-destructive">Analysis failed</p>
                          <p className="text-sm italic text-destructive/80">"{submission.ai_feedback}"</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-muted-foreground">AI Insight</p>
                          <p className="text-sm leading-relaxed text-foreground/90 italic">"{submission.ai_feedback}"</p>
                        </div>
                      )
                    ) : (
                      <div className="flex h-full items-center justify-center text-center text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                        AI evaluation not started
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Final Graded Score</Label>
                      <div className="mt-3 flex items-end gap-2">
                        <span className="text-4xl font-black text-foreground">{overallPercentage.toFixed(1)}</span>
                        <span className="pb-1 text-xl font-black text-muted-foreground">%</span>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                        <div className={cn("h-full rounded-full transition-all", isReadyToPass ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${Math.min(overallPercentage, 100)}%` }} />
                      </div>
                      <p className="mt-2 text-xs text-muted-foreground">Based on {gradedPoints.toFixed(1)} / {totalPossible} awarded marks</p>
                    </div>

                    <div className="rounded-2xl border border-border bg-background p-5 shadow-sm">
                      <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em]">Publishing Outcome</Label>
                      <p className="mt-3 text-sm font-semibold text-foreground">
                        {isReadyToPass ? 'This student is currently on track to pass.' : 'This student is currently below the pass threshold.'}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">Pass threshold: {passPercentage}%</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.2em] ml-1">Evaluator Comments</Label>
                    <Textarea placeholder="Summarize the student's strengths, gaps, and what they should improve next." className="min-h-[180px] bg-background border border-border rounded-2xl text-[14px] font-medium resize-none focus:ring-primary/20 focus:border-primary transition-all p-5" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                  </div>
                </div>

                <div className="pt-6 border-t border-border space-y-4">
                   <Button className="w-full h-14 rounded-2xl text-xs font-black uppercase tracking-[0.15em] shadow-lg shadow-primary/20 transition-all active:scale-95" onClick={() => handleUpdateStatus('published')} disabled={isSaving}>
                     {isSaving ? <Loader2 className="h-5 w-5 animate-spin" /> : <CheckIcon className="h-5 w-5 mr-3" />}
                     Confirm & Publish
                   </Button>
                   <Button variant="outline" className="w-full h-14 font-black uppercase tracking-[0.1em] text-[10px] border-2 border-slate-100 dark:border-slate-800 text-slate-500 hover:text-destructive hover:bg-destructive/5 hover:border-destructive/20 rounded-2xl transition-all" onClick={() => handleUpdateStatus('returned')} disabled={isSaving}>
                     Return for Revision
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

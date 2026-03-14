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
      <DialogContent className="sm:max-w-5xl max-h-[95vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl bg-slate-50 dark:bg-slate-950 rounded-3xl">
        <DialogHeader className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 p-8 text-white shrink-0 space-y-0 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl -mr-32 -mt-32" />
          <div className="flex justify-between items-start relative z-10">
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20">
                   <User className="h-6 w-6 text-primary-foreground" />
                </div>
                <div>
                  <DialogTitle className="text-3xl font-black tracking-tight">{submission?.student_name}</DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant="outline" className="border-white/20 text-white/50 bg-white/5 h-5 px-1.5 text-[9px] uppercase font-bold tracking-widest">
                      {submission?.batch_name}
                    </Badge>
                    <span className="text-[10px] text-white/30 font-black uppercase tracking-tighter">•</span>
                    <span className="text-xs text-white/50 font-medium flex items-center gap-1.5">
                      <FileText className="h-3 w-3" />
                      {submission?.test_title}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="text-right space-y-2">
              <Badge className={cn(
                "py-1.5 px-4 font-black uppercase text-[10px] tracking-widest shadow-lg",
                submission?.status === 'published' ? "bg-success text-success-foreground shadow-success/20" : 
                submission?.status === 'pending_review' ? "bg-warning text-warning-foreground shadow-warning/20" :
                "bg-slate-700 text-slate-100 shadow-slate-900/50"
              )}>
                {submission?.status?.replace('_', ' ')}
              </Badge>
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-white/30 font-bold uppercase tracking-widest">Submitted On</span>
                <span className="text-xs text-white/60 font-medium">
                  {submission?.submitted_at && format(new Date(submission.submitted_at), 'MMM d, yyyy • h:mm a')}
                </span>
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200 dark:divide-slate-800">
          <div className="flex-1 p-8 space-y-10 bg-slate-50 dark:bg-slate-950/50 scrollbar-hide overflow-y-auto">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 flex items-center gap-2 mb-8 border-b dark:border-slate-800 pb-4">
                <div className="h-6 w-6 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                  <User className="h-3.5 w-3.5" />
                </div>
                Detailed Student Responses
              </h3>
              
              <div className="space-y-12">
                {(submission?.answers || []).length > 0 ? (
                  submission.answers.map((answer: any, index: number) => (
                    <div key={answer.id} className="space-y-4 group animate-in slide-in-from-left-4 duration-500" style={{ animationDelay: `${index * 100}ms` }}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center h-8 w-8 rounded-full bg-primary text-primary-foreground font-black text-xs shadow-md shadow-primary/20">
                          {answer.question_order || index + 1}
                        </span>
                        <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200 italic">Question Preview</h4>
                      </div>
                      <Badge variant="outline" className="bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider">
                        {answer.max_marks} Points Max
                      </Badge>
                    </div>
                    
                    <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 hover:shadow-md transition-all duration-300">
                      <CardContent className="p-0">
                        <div className="p-5 bg-slate-50 dark:bg-slate-800/30 border-b dark:border-slate-800 flex justify-between items-start gap-6">
                          <div className="flex-1 space-y-2">
                             <div className="text-[14px] text-slate-600 dark:text-slate-400 font-medium leading-relaxed">
                               {answer.question_text}
                             </div>
                             {answer.is_attended && (
                               <Button 
                                 size="sm" 
                                 variant="ghost" 
                                 className="h-7 px-2 rounded-lg text-[9px] font-black uppercase tracking-[0.1em] text-indigo-500 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 gap-1.5"
                                 onClick={() => handleTriggerQuestionAI(answer.id)}
                                 disabled={evaluatingQuestionIds.includes(answer.id)}
                               >
                                 {evaluatingQuestionIds.includes(answer.id) ? (
                                   <Loader2 className="h-3 w-3 animate-spin" />
                                 ) : (
                                   <Zap className="h-3 w-3 fill-indigo-500" />
                                 )}
                                 Evaluate Answer via AI
                               </Button>
                             )}
                          </div>
                          <div className="shrink-0 flex items-center gap-3">
                             <div className="flex flex-col items-end gap-1">
                                <Label className="text-[9px] font-black uppercase text-slate-400 dark:text-slate-500">Awarded</Label>
                                <div className="relative w-24">
                                   <Input 
                                     type="number" 
                                     step="0.5"
                                     max={answer.max_marks}
                                     min="0"
                                     className="h-10 text-right font-black pr-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 focus:ring-primary/20 text-lg rounded-xl"
                                     value={qMarks[answer.id] || '0'}
                                     onChange={(e) => setQMarks({...qMarks, [answer.id]: e.target.value})}
                                   />
                                   <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-300 dark:text-slate-600 pointer-events-none uppercase">
                                     Pts
                                   </div>
                                </div>
                             </div>
                          </div>
                        </div>
                        <div className="p-6 space-y-6">
                          <div className="flex flex-col gap-2">
                             <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60">Response Content</Label>
                             {answer.is_attended ? (
                               answer.answer_text ? (
                                 <div className="whitespace-pre-wrap text-[15px] text-slate-800 dark:text-slate-100 leading-bold font-medium bg-slate-50 dark:bg-slate-950/30 p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                                   {answer.answer_text}
                                 </div>
                               ) : (
                                 <div className="text-sm text-slate-400 italic bg-slate-50 dark:bg-slate-950/30 p-4 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">No text response provided.</div>
                               )
                             ) : (
                               <div className="text-sm text-red-400/80 font-bold uppercase tracking-wider bg-red-500/5 dark:bg-red-500/10 p-4 rounded-2xl border border-dashed border-red-500/20">
                                 Question not attended by student
                               </div>
                             )}
                          </div>
                          {answer.answer_file && (
                            <div className="pt-2">
                               <Label className="text-[10px] font-black uppercase tracking-widest text-primary/60 mb-2 block">Attachment</Label>
                               <a href={answer.answer_file} target="_blank" rel="noreferrer" className="flex items-center gap-4 px-4 py-3 rounded-2xl bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 group/file hover:border-primary/50 transition-all shadow-sm">
                                 <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary transition-transform group-hover/file:scale-110">
                                   <Paperclip className="h-5 w-5" />
                                 </div>
                                 <div className="flex-1 min-w-0">
                                   <p className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{shortName(answer.answer_file)}</p>
                                   <p className="text-[10px] text-slate-400 font-medium">Click to open file in new tab</p>
                                 </div>
                                 <ExternalLink className="h-4 w-4 text-slate-300 group-hover/file:text-primary transition-colors" />
                               </a>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                    {answer.ai_feedback && (
                      <div className="ml-8 p-4 rounded-2xl bg-gradient-to-br from-indigo-50 to-white dark:from-indigo-950/30 dark:to-slate-900 border border-indigo-100/50 dark:border-indigo-900/50 text-sm text-indigo-700 dark:text-indigo-300 leading-relaxed shadow-sm relative group/ai">
                        <div className="absolute -top-3 left-6 px-2 py-0.5 rounded bg-indigo-500 text-white text-[9px] font-black uppercase tracking-widest flex items-center gap-1 shadow-md shadow-indigo-500/20">
                          <Zap className="h-3 w-3 fill-white" /> AI Insight ({answer.ai_score}/{answer.max_marks})
                        </div>
                        <p className="font-medium italic">"{answer.ai_feedback}"</p>
                      </div>
                    )}
                  </div>
                ))
               ) : (
                 <div className="py-20 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="h-16 w-16 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
                       <FileText className="h-8 w-8 text-slate-300" />
                    </div>
                    <div>
                       <p className="text-slate-500 font-bold">No questions found for this test.</p>
                       <p className="text-slate-400 text-xs mt-1">Check if the test configuration has questions assigned.</p>
                    </div>
                 </div>
               )}
              </div>
            </div>
          </div>

          <div className="w-full md:w-96 p-8 space-y-8 shrink-0 bg-white dark:bg-slate-900 overflow-y-auto border-l dark:border-slate-800">
            <div>
              <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500 flex items-center gap-2 mb-6">
                <div className="h-6 w-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <Zap className="h-3.5 w-3.5" />
                </div>
                Evaluation Console
              </h3>
              <div className="space-y-6">
                <div className="group relative overflow-hidden p-6 rounded-[2rem] bg-slate-950 text-white shadow-2xl shadow-indigo-500/10">
                  <div className="absolute top-0 right-0 p-4 opacity-10 transition-transform group-hover:scale-125 duration-500">
                    <Zap className="h-16 w-16 fill-white" />
                  </div>
                   <div className="flex justify-between items-center mb-6 relative z-10">
                     <div className="flex items-center gap-2">
                       <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                       <span className="text-[10px] font-black uppercase text-white/40 tracking-[0.2em]">AI Intelligence</span>
                     </div>
                     <Button size="sm" variant="ghost" className="h-8 px-3 rounded-xl text-primary-foreground/60 hover:text-white hover:bg-white/10 transition-all font-bold text-xs" onClick={handleTriggerAI} disabled={isEvaluating}>
                       {isEvaluating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-2" />}
                       {submission?.status === 'pending' ? 'Trigger AI' : 'Refresh AI'}
                     </Button>
                   </div>
                   <div className="space-y-4 relative z-10">
                     <div className="flex flex-col">
                        <span className="text-4xl font-black text-white">
                          {submission?.ai_score?.toFixed(1) || '0.0'}
                          <span className="text-sm font-bold text-white/20 ml-3">Suggested / 100</span>
                        </span>
                     </div>
                     {submission?.ai_feedback ? (
                       submission.ai_feedback.includes('AI Evaluation Error') || submission.ai_feedback.includes('Catastrophic failure') ? (
                         <div className="bg-destructive/10 backdrop-blur-md rounded-2xl p-4 border border-destructive/20 flex flex-col items-center justify-center text-center py-6 space-y-3">
                            <div className="text-[10px] text-destructive font-black uppercase tracking-widest">Analysis Failed</div>
                            <p className="text-[11px] text-destructive/70 italic line-clamp-2">"{submission.ai_feedback}"</p>
                            <Button size="sm" variant="outline" className="h-7 px-3 rounded-lg border-destructive/20 text-destructive hover:bg-destructive/10 text-[10px] font-black uppercase" onClick={handleTriggerAI} disabled={isEvaluating}>
                              Retry AI Analysis
                            </Button>
                         </div>
                       ) : (
                         <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/5 shadow-inner">
                           <p className="text-[11px] text-white/70 leading-relaxed italic font-medium">"{submission.ai_feedback}"</p>
                         </div>
                       )
                     ) : (
                       <div className="bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-white/5 flex items-center justify-center text-[10px] text-white/30 font-bold uppercase tracking-widest text-center py-6">
                         AI evaluation not started
                       </div>
                     )}
                   </div>
                </div>

                <div className="space-y-6 pt-2">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Final Graded Score</Label>
                    <div className="relative group/input">
                      <div className="absolute inset-0 bg-primary/5 rounded-2xl blur-lg transition-opacity opacity-0 group-hover/input:opacity-100" />
                      <div className="relative flex items-center bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-2xl px-5 h-16 transition-all focus-within:border-primary">
                        <Input 
                          type="number" 
                          placeholder="0-100" 
                          className="border-none bg-transparent p-0 text-3xl font-black focus-visible:ring-0 w-full" 
                          value={((Object.values(qMarks).reduce((acc, m) => acc + (parseFloat(m) || 0), 0) / (submission?.answers?.reduce((acc: number, curr: any) => acc + curr.max_marks, 0) || 1)) * 100).toFixed(1)} 
                          readOnly 
                        />
                        <span className="font-black text-2xl text-slate-300 dark:text-slate-700 ml-2">%</span>
                      </div>
                      <p className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-tight mt-2 ml-1">Weighted average of individual marks</p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.2em] ml-1">Evaluator Comments</Label>
                    <Textarea placeholder="Share your final thoughts and feedback with the student..." className="min-h-[160px] bg-slate-50 dark:bg-slate-950 border-2 border-slate-100 dark:border-slate-800 rounded-2xl text-[14px] font-medium resize-none focus:ring-primary/20 focus:border-primary transition-all p-5" value={remarks} onChange={(e) => setRemarks(e.target.value)} />
                  </div>
                </div>

                <div className="pt-6 border-t dark:border-slate-800 space-y-4">
                   <Button className="w-full h-14 font-black uppercase tracking-[0.15em] text-xs bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 shadow-xl shadow-emerald-500/20 rounded-2xl transition-all active:scale-95" onClick={() => handleUpdateStatus('published')} disabled={isSaving}>
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

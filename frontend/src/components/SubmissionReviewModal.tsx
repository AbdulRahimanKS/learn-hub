import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  MessageSquare,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Trash2,
  Send,
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

  // Editable fields
  const [remarks, setRemarks] = useState('');
  const [qMarks, setQMarks] = useState<Record<number, string>>({}); // Mapping question_id to marks string

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
        
        // Initialize question marks
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
      // Prepare granular marks
      const answersUpdate = Object.entries(qMarks).map(([id, marks]) => ({
        id: parseInt(id),
        marks_obtained: parseFloat(marks) || 0
      }));

      const totalMarksObtained = answersUpdate.reduce((acc, curr) => acc + curr.marks_obtained, 0);
      const totalPossible = submission?.answers?.reduce((acc: number, curr: any) => acc + curr.max_marks, 0) || 100;
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
        fetchSubmission(); // Refresh to show AI feedback
      }
    } catch (err) {
      toast({ title: 'AI Error', description: 'AI evaluation failed.', variant: 'destructive' });
    } finally {
      setIsEvaluating(false);
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
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="bg-slate-900 p-6 text-white shrink-0 space-y-0">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <DialogTitle className="text-2xl font-black">{submission?.student_name}</DialogTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-white/20 text-white/70 h-5 px-1.5 text-[10px] uppercase font-bold">
                  {submission?.batch_name}
                </Badge>
                <div className="flex items-center gap-1.5 text-xs text-white/50 font-medium">
                  <FileText className="h-3 w-3" />
                  {submission?.test_title} • Attempt {submission?.attempt_number}
                </div>
              </div>
            </div>
            <div className="text-right">
              <Badge className={cn(
                "py-1 px-3 font-black uppercase text-[10px]",
                submission?.status === 'published' ? "bg-emerald-500" : "bg-amber-500"
              )}>
                {submission?.status?.replace('_', ' ')}
              </Badge>
              <div className="mt-1 text-[10px] text-white/40 font-bold uppercase tracking-wider">
                Submitted {submission?.submitted_at && format(new Date(submission.submitted_at), 'PPPp')}
              </div>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-0 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-slate-200">
          {/* Left: Student Answers */}
          <div className="flex-1 p-6 space-y-8 bg-slate-50/50 scrollbar-hide overflow-y-auto">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2 mb-4">
              <User className="h-4 w-4" /> Student Responses
            </h3>
            
            {(submission?.answers || []).map((answer: any, index: number) => (
              <div key={answer.id} className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="bg-white border-slate-200 text-slate-500 font-bold">
                    Question {answer.question_order || index + 1}
                  </Badge>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Weight: {answer.max_marks} Marks</span>
                </div>
                
                <Card className="border-slate-200/60 shadow-sm overflow-hidden bg-white">
                  <CardContent className="p-0">
                    <div className="p-4 bg-slate-100/30 border-b border-slate-100 flex justify-between items-start">
                      <div className="italic text-[13px] text-slate-600 flex-1 pr-4">
                        {answer.question_text}
                      </div>
                      <div className="shrink-0 flex items-center gap-2">
                         <div className="relative w-20">
                            <Input 
                              type="number" 
                              step="0.5"
                              max={answer.max_marks}
                              min="0"
                              className="h-9 text-right font-black pr-1 border-slate-200 focus:ring-primary/20"
                              value={qMarks[answer.id] || '0'}
                              onChange={(e) => setQMarks({...qMarks, [answer.id]: e.target.value})}
                            />
                            <div className="absolute right-1 top-1/2 -translate-y-1/2 px-1 bg-white text-[10px] font-bold text-slate-300 pointer-events-none">
                              / {answer.max_marks}
                            </div>
                         </div>
                      </div>
                    </div>
                    <div className="p-4 space-y-4">
                      {answer.answer_text ? (
                        <div className="whitespace-pre-wrap text-sm text-slate-700 leading-relaxed font-medium">
                          {answer.answer_text}
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">No text response provided.</div>
                      )}
                      
                      {answer.answer_file && (
                        <a 
                          href={answer.answer_file} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10 text-xs font-bold text-primary hover:bg-primary/10 transition-colors w-fit"
                        >
                          <Paperclip className="h-4 w-4" />
                          View Attachment: {shortName(answer.answer_file)}
                          <ExternalLink className="h-3 w-3 ml-1 opacity-50" />
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* AI Snippet Per Question */}
                {answer.ai_feedback && (
                  <div className="ml-4 p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 text-[11px] text-indigo-700 leading-relaxed relative">
                    <div className="absolute -left-2 top-3 h-4 w-4 bg-indigo-100 rotate-45 border-l border-b border-indigo-200 rounded-sm -z-10" />
                    <span className="font-black uppercase text-[9px] text-indigo-400 flex items-center gap-1 mb-1">
                      <Zap className="h-3 w-3 fill-indigo-400" /> AI Suggested ({answer.ai_score}/{answer.max_marks})
                    </span>
                    {answer.ai_feedback}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Right: Review Controls */}
          <div className="w-full md:w-80 p-6 space-y-6 shrink-0 bg-white overflow-y-auto">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
              <Zap className="h-4 w-4" /> Evaluation Console
            </h3>

            <div className="space-y-4 p-4 rounded-2xl bg-slate-900 text-white shadow-xl shadow-slate-200">
               <div className="flex justify-between items-center pb-2 border-b border-white/10">
                 <span className="text-[10px] font-black uppercase text-white/40 tracking-widest">AI Assisted</span>
                 <Button 
                   size="sm" 
                   variant="ghost" 
                   className="h-7 px-2 text-primary-foreground/70 hover:text-white"
                   onClick={handleTriggerAI}
                   disabled={isEvaluating}
                 >
                   {isEvaluating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5 mr-1" />}
                   Re-evaluate
                 </Button>
               </div>
               
               <div className="py-2 space-y-1">
                 <p className="text-3xl font-black">
                   {submission?.ai_score?.toFixed(1) || '0.0'}
                   <span className="text-sm font-bold text-white/30 ml-2">Suggested Marks</span>
                 </p>
                 {submission?.ai_feedback && (
                   <p className="text-[10px] text-white/50 leading-tight italic">
                     "{submission.ai_feedback}"
                   </p>
                 )}
               </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Final Marks (%)</Label>
                <div className="relative">
                  <Input 
                    type="number" 
                    placeholder="0-100" 
                    className="h-12 text-lg font-black border-slate-200 bg-slate-50"
                    value={(Object.values(qMarks).reduce((acc, m) => acc + (parseFloat(m) || 0), 0) / (submission?.answers?.reduce((acc: number, curr: any) => acc + curr.max_marks, 0) || 1)).toFixed(1)}
                    readOnly
                  />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 font-black text-xl">%</span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Auto-calculated from per-question marks.</p>
              </div>

              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Instructor Remarks</Label>
                <Textarea 
                  placeholder="Share constructive feedback with the student..."
                  className="min-h-[120px] bg-slate-50 border-slate-200 text-sm font-medium resize-none focus:ring-slate-100"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
               <Button 
                 className="w-full h-11 font-black uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-200"
                 onClick={() => handleUpdateStatus('published')}
                 disabled={isSaving}
               >
                 {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckIcon className="h-4 w-4 mr-2" />}
                 Publish Result
               </Button>
               <Button 
                 variant="outline"
                 className="w-full h-11 font-black uppercase tracking-wider border-slate-200 text-slate-500"
                 onClick={() => handleUpdateStatus('returned')}
                 disabled={isSaving}
               >
                 Return for Revision
               </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

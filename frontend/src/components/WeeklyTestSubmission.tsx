import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  Upload,
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
  Clock,
  HelpCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { WeeklyTest } from './WeeklyTestManager';

interface WeeklyTestSubmissionProps {
  open: boolean;
  onClose: () => void;
  test: WeeklyTest;
  batchId: number;
  weekId: number;
  onSubmitted: () => void;
}

export function WeeklyTestSubmission({
  open,
  onClose,
  test,
  batchId,
  weekId,
  onSubmitted,
}: WeeklyTestSubmissionProps) {
  const { toast } = useToast();
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [files, setFiles] = useState<Record<number, File>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleTextChange = (questionId: number, text: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: text }));
  };

  const handleFileChange = (questionId: number, file: File | null) => {
    if (file) {
      setFiles((prev) => ({ ...prev, [questionId]: file }));
    } else {
      const newFiles = { ...files };
      delete newFiles[questionId];
      setFiles(newFiles);
    }
  };

  const validateAndConfirm = () => {
    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('answers', JSON.stringify(answers));
      Object.entries(files).forEach(([qId, file]) => {
        formData.append(`file_q_${qId}`, file);
      });

      const res = await apiClient.post(
        `/api/courses/v1/batches/${batchId}/weeks/${weekId}/test/submit/`,
        formData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        }
      );

      if (res.data?.success) {
        onSubmitted();
        onClose();
      }
    } catch (err: any) {
      toast({
        title: 'Submission Failed',
        description: err?.response?.data?.message || 'Failed to submit your test. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const shortName = (url: string | null | undefined) => {
    if (!url) return 'File';
    if (typeof url !== 'string') return 'File';
    return url.split('/').pop()?.split('?')[0] || url;
  };

  const uploadedCount = Object.keys(files).length;
  const totalQuestions = test.questions.length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-background">
        {/* Compact Blue Header */}
        <div className="bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab] p-5 text-white shrink-0 relative">
          <DialogTitle className="text-lg font-bold tracking-tight mb-0.5">
            {test.title}
          </DialogTitle>
          <DialogDescription className="text-white/70 text-[11px] font-medium max-w-lg">
            Answer questions by typing or uploading files.
          </DialogDescription>
        </div>

        <div className="flex-1 overflow-y-auto p-4 md:p-5 space-y-5 scrollbar-hide">
          {test.questions.map((question, index) => (
            <Card key={question.id} className="border-none shadow-sm bg-white dark:bg-card dark:border dark:border-slate-800/50 rounded-xl overflow-hidden">
              <CardContent className="p-4">
                {/* Question Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Badge className="bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400 border-none font-bold px-2 py-0.5 rounded text-[10px] leading-none">
                      Q{index + 1}
                    </Badge>
                    <Badge className="bg-slate-100 dark:bg-slate-800/50 text-slate-500 dark:text-slate-400 border-none font-medium px-2 py-0.5 rounded text-[9px] leading-none uppercase tracking-wider">
                      {question.marks} marks
                    </Badge>
                  </div>
                  <span className="text-[10px] uppercase font-bold text-slate-300 dark:text-slate-700">
                    {question.marks} marks
                  </span>
                </div>

                {/* Question Text */}
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-3 leading-snug">
                  {question.text}
                </h3>

                <div className="h-px bg-slate-100 dark:bg-white/5 w-full mb-4" />

                <div className="space-y-4">
                  {/* Upload Attachments Section */}
                  {(question.question_file || question.image || (question.attachments && question.attachments.length > 0) || files[question.id]) && (
                    <div className="space-y-2">
                      <Label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                        Upload Attachments
                      </Label>
                      
                      <div className="flex flex-wrap gap-2">
                        {question.question_file && (
                          <a 
                            href={question.question_file} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
                          >
                            <FileText className="h-3 w-3" />
                            {shortName(question.question_file)}
                          </a>
                        )}
                        {question.image && (
                          <a 
                            href={question.image} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
                          >
                            <ImageIcon className="h-3 w-3" />
                            Img Ref
                          </a>
                        )}
                        {(question.attachments || []).map(att => (
                          <a 
                            key={att.id}
                            href={att.file} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-50/50 dark:bg-indigo-950/10 border border-indigo-100/50 dark:border-indigo-900/30 text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition-colors"
                          >
                            <FileText className="h-3 w-3" />
                            {att.name || 'File'}
                          </a>
                        ))}

                        {files[question.id] && (
                          <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100/50 dark:border-emerald-900/30 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle className="h-3 w-3" />
                            <span className="truncate max-w-[100px]">{files[question.id].name}</span>
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleFileChange(question.id, null); }}
                              className="ml-1 hover:text-rose-500 transition-colors"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Your Answer Section */}
                  <div className="space-y-2">
                    <Label className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                      Your Answer
                    </Label>
                    
                    <div className="grid gap-2">
                      <Textarea 
                        placeholder="Type your answer here..."
                        value={answers[question.id] || ''}
                        onChange={(e) => handleTextChange(question.id, e.target.value)}
                        className="min-h-[70px] rounded-lg bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800/50 p-3 text-sm resize-none focus:ring-1 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium"
                      />
                      
                      {!files[question.id] && (
                        <div 
                          className="border border-dashed border-slate-200 dark:border-slate-800/50 rounded-lg p-4 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800/30 transition-all group"
                          onClick={() => fileInputRefs.current[question.id]?.click()}
                        >
                          <input 
                            type="file"
                            className="hidden"
                            ref={(el) => (fileInputRefs.current[question.id] = el)}
                            onChange={(e) => handleFileChange(question.id, e.target.files?.[0] || null)}
                          />
                          <div className="flex flex-col items-center gap-1.5">
                            <Upload className="h-4 w-4 text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 transition-colors" />
                            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">Upload solution file</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter className="p-4 bg-white dark:bg-background border-t border-slate-100 dark:border-slate-800/50 shrink-0">
          <div className="w-full flex justify-center">
            <Button 
              variant="gradient" 
              size="lg"
              onClick={validateAndConfirm} 
              disabled={isSubmitting} 
              className="px-8 py-3 h-auto rounded-lg font-bold text-xs uppercase tracking-widest shadow-xl shadow-indigo-500/10 group hover:scale-[1.01] transition-all"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                  Submitting
                </>
              ) : (
                <>
                  <Clock className="h-3.5 w-3.5 mr-2 opacity-70 group-hover:rotate-12 transition-transform" />
                  Submit All Answers ({uploadedCount}/{totalQuestions})
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-[360px] rounded-3xl p-8 border-none dark:bg-card shadow-2xl animate-in zoom-in-95 duration-200">
          <div className="flex flex-col items-center text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-inner">
              <HelpCircle className="h-8 w-8 animate-pulse" />
            </div>
            
            <div className="space-y-2">
              <DialogTitle className="text-xl font-black tracking-tight text-slate-900 dark:text-white">
                Ready to Submit?
              </DialogTitle>
              <DialogDescription className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed">
                Once submitted, you won't be able to edit your answers.
              </DialogDescription>
            </div>

            {test.questions.filter(q => !answers[q.id]?.trim() && !files[q.id]).length > 0 && (
              <div className="w-full p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/30 rounded-2xl flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 text-left leading-tight">
                  Warning: You have {test.questions.filter(q => !answers[q.id]?.trim() && !files[q.id]).length} unanswered questions.
                </p>
              </div>
            )}

            <div className="flex flex-col w-full gap-2 pt-2">
              <Button 
                variant="gradient" 
                onClick={handleSubmit} 
                disabled={isSubmitting} 
                className="w-full h-11 rounded-xl font-black uppercase text-[10px] tracking-[0.15em] shadow-lg shadow-indigo-500/20"
              >
                {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : null}
                Confirm & Submit
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setShowConfirm(false)} 
                className="w-full h-10 rounded-xl font-bold text-[10px] text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Go Back
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}


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
  Paperclip,
  Image as ImageIcon,
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
    const unanswered = test.questions.filter(q => !answers[q.id]?.trim() && !files[q.id]);
    
    if (unanswered.length > 0) {
      toast({
        title: "Incomplete Assessment",
        description: `You have ${unanswered.length} unanswered questions. Are you sure you want to submit?`,
        variant: "destructive",
      });
    }
    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    setShowConfirm(false);
    setIsSubmitting(true);
    try {
      const formData = new FormData();
      
      // The backend expects 'answers' as a JSON string
      formData.append('answers', JSON.stringify(answers));

      // Individual files for questions
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
        toast({
          title: 'Success',
          description: 'Your assessment has been submitted successfully.',
          variant: 'success',
        });
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#1a237e] to-[#283593] p-6 text-white shrink-0">
          <DialogTitle className="text-2xl font-bold tracking-tight mb-2">
            {test.title}
          </DialogTitle>
          <DialogDescription className="text-white/70 text-sm">
            Please answer all questions carefully. You can upload files (PDF, .ipynb, images) or type your answers directly.
          </DialogDescription>
          {test.instructions && (
            <div className="mt-4 p-3 bg-white/10 rounded-lg border border-white/10 text-xs">
              <p className="font-bold mb-1 flex items-center gap-1.5 uppercase tracking-wider opacity-70">
                <HelpCircle className="h-3 w-3" /> Instructions
              </p>
              {test.instructions}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 scrollbar-hide">
          {test.questions.map((question, index) => (
            <Card key={question.id} className="border-border/50 shadow-sm overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-border/30">
                  {/* Left: Question Content */}
                  <div className="flex-1 p-5 md:max-w-[50%] bg-muted/5">
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 font-bold h-6 px-2">
                        Question {index + 1}
                      </Badge>
                      <Badge variant="secondary" className="h-6 px-2 text-[10px] font-bold uppercase tracking-wider">
                        {question.marks} Mark{question.marks !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                    
                    {question.text && (
                      <p className="text-sm font-medium text-foreground mb-4 whitespace-pre-wrap leading-relaxed">
                        {question.text}
                      </p>
                    )}

                    {/* Question Media */}
                    <div className="flex flex-wrap gap-2 mt-4">
                      {question.question_file && (
                        <a 
                          href={question.question_file} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-[11px] font-semibold text-primary hover:bg-muted transition-colors"
                        >
                          <Paperclip className="h-3 w-3" />
                          {shortName(question.question_file)}
                        </a>
                      )}
                      {question.image && (
                        <a 
                          href={question.image} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-[11px] font-semibold text-primary hover:bg-muted transition-colors"
                        >
                          <ImageIcon className="h-3 w-3" />
                          Reference Image
                        </a>
                      )}
                      {(question.attachments || []).map(att => (
                        <a 
                          key={att.id}
                          href={att.file} 
                          target="_blank" 
                          rel="noreferrer"
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-[11px] font-semibold text-primary hover:bg-muted transition-colors"
                        >
                          <FileText className="h-3 w-3" />
                          {att.name || shortName(att.file)}
                        </a>
                      ))}
                    </div>
                  </div>

                  {/* Right: Answer Input */}
                  <div className="flex-1 p-5 space-y-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Your Answer</Label>
                      <Textarea 
                        placeholder="Type your answer here..."
                        value={answers[question.id] || ''}
                        onChange={(e) => handleTextChange(question.id, e.target.value)}
                        className="min-h-[120px] text-sm resize-none focus:ring-primary/20"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Attach Solution File</Label>
                      <div 
                        className={cn(
                          "border-2 border-dashed rounded-xl p-3 text-center cursor-pointer transition-all h-24 flex flex-col items-center justify-center",
                          files[question.id] 
                            ? "bg-primary/5 border-primary/40" 
                            : "hover:bg-muted/50 border-border/60"
                        )}
                        onClick={() => fileInputRefs.current[question.id]?.click()}
                      >
                        <input 
                          type="file"
                          className="hidden"
                          ref={(el) => (fileInputRefs.current[question.id] = el)}
                          onChange={(e) => handleFileChange(question.id, e.target.files?.[0] || null)}
                        />
                        {files[question.id] ? (
                          <div className="flex flex-col items-center">
                            <CheckCircle className="h-5 w-5 text-primary mb-1" />
                            <p className="text-[11px] font-bold text-primary truncate max-w-[200px]">
                              {files[question.id].name}
                            </p>
                            <button 
                              className="text-[10px] text-destructive font-black uppercase mt-1 hover:underline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleFileChange(question.id, null);
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        ) : (
                          <>
                            <Upload className="h-5 w-5 text-muted-foreground/50 mb-1" />
                            <p className="text-[11px] font-medium text-muted-foreground">
                              Upload .ipynb, .pdf, or image
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <DialogFooter className="p-4 border-t bg-muted/20 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <AlertCircle className="h-3.5 w-3.5" />
            <span>Ensure all answers are saved before submitting.</span>
          </div>
          <div className="flex gap-3 w-full sm:w-auto">
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting} className="flex-1 sm:flex-none">
              Cancel
            </Button>
            <Button 
              variant="gradient" 
              onClick={validateAndConfirm} 
              disabled={isSubmitting} 
              className="flex-1 sm:flex-none px-12 font-bold shadow-lg shadow-primary/20"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                'Final Submit'
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Submission</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit your assessment? This action cannot be undone.
              {test.questions.filter(q => !answers[q.id]?.trim() && !files[q.id]).length > 0 && (
                <p className="mt-2 text-destructive font-bold">
                  Warning: You have unanswered questions.
                </p>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="ghost" onClick={() => setShowConfirm(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleSubmit} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Confirm & Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

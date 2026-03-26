import React, { useState, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  FileText,
  Upload,
  Loader2,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
  HelpCircle,
  Eye,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { WeeklyTest } from './WeeklyTestManager';

const STUDENT_ANSWER_FILE_ACCEPT = '.ipynb,.pdf,application/pdf,application/x-ipynb+json';

function isAllowedWeeklyTestAnswerFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith('.ipynb') || name.endsWith('.pdf');
}

interface WeeklyTestSubmissionProps {
  open: boolean;
  onClose: () => void;
  test: WeeklyTest;
  batchId: number;
  weekId: number;
  onSubmitted: () => void;
}

/** Safe sum + display for integer or decimal marks (API may send strings). */
function parseMarks(value: unknown): number {
  const n = typeof value === 'number' ? value : parseFloat(String(value ?? ''));
  return Number.isFinite(n) ? n : 0;
}

function formatMarksDisplay(value: unknown): string {
  const n = parseMarks(value);
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  }).format(n);
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
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  const handleTextChange = (questionId: number, text: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: text }));
  };

  const handleFileChange = (questionId: number, file: File | null) => {
    if (file) {
      if (!isAllowedWeeklyTestAnswerFile(file)) {
        toast({
          title: 'Invalid file type',
          description: 'Only .ipynb or .pdf files are accepted.',
          variant: 'destructive',
        });
        const ref = fileInputRefs.current[questionId];
        if (ref) ref.value = '';
        return;
      }
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

  if (!test?.questions || test.questions.length === 0) return null;

  const answeredCount = test.questions.filter(q => 
    (answers[q.id] && answers[q.id].trim() !== '') || files[q.id]
  ).length;
  const totalQuestions = test.questions.length;
  const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
  
  const activeQuestion = test.questions[activeQuestionIndex];
  const unansweredCount = test.questions.filter(q => !answers[q.id]?.trim() && !files[q.id]).length;
  const totalMarksSum = test.questions.reduce((sum, q) => sum + parseMarks(q.marks), 0);
  const passPercentage = parseMarks(test.pass_percentage);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isSubmitting && onClose()}>
      {/* Container is full-width style modal */}
      <DialogContent className="flex h-[90vh] w-[95vw] max-w-[1200px] flex-col overflow-hidden rounded-[28px] border border-primary/25 bg-background p-0 text-foreground shadow-2xl [&>button]:right-4 [&>button]:top-4 [&>button]:z-[60] [&>button]:text-primary-foreground [&>button]:opacity-90 [&>button]:ring-offset-transparent [&>button]:hover:bg-white/10 [&>button]:hover:text-primary-foreground [&>button]:hover:opacity-100 data-[state=open]:[&>button]:bg-transparent data-[state=open]:[&>button]:text-primary-foreground">
        {/* Header — match course hero / MCQ modal */}
        <div className="relative flex-none overflow-hidden border-b border-white/10 gradient-primary px-6 pb-4 pt-7 text-primary-foreground">
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-white/5 blur-3xl" />
            <div className="absolute bottom-0 left-0 h-28 w-28 rounded-full bg-primary/20 blur-2xl" />
          </div>
          <div className="relative mb-6 flex flex-col gap-5">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-primary-foreground backdrop-blur-md">
                <HelpCircle className="h-3.5 w-3.5" />
                Weekly assessment
              </div>
              <DialogTitle className="mb-1.5 text-2xl font-bold tracking-tight text-primary-foreground">{test.title}</DialogTitle>
              <DialogDescription className="text-[15px] text-primary-foreground/80">
                Answer in the text box and/or upload one solution file per question (.ipynb or PDF only).
              </DialogDescription>
              {test.instructions?.trim() && (
                <div className="mt-4 max-w-4xl border-l-2 border-white/25 pl-4">
                  <p className="text-sm font-semibold text-primary-foreground/90">Instructions</p>
                  <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-primary-foreground/85">
                    {test.instructions}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Split — min-h-0 so sidebar list can shrink and scroll */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
           
           {/* Left: Question Area */}
           <div className="relative min-h-0 flex-1 overflow-y-auto bg-background px-10 py-8 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent">
              <div className="max-w-[800px] mb-8">
                {/* Question Text — number & marks live in the Question Navigator */}
                <h2 className="mb-5 whitespace-pre-line text-lg font-semibold leading-relaxed text-foreground md:text-xl">
                  {activeQuestion.text}
                </h2>

                {/* Question Resources (Reference Materials from Admin) */}
                {(activeQuestion.question_file || activeQuestion.image || (activeQuestion.attachments && activeQuestion.attachments.length > 0)) && (
                  <div className="space-y-3 mb-8">
                    <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <HelpCircle className="h-4 w-4" /> Reference files
                    </Label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {activeQuestion.question_file && (
                        <div className="group/file flex items-center justify-between rounded-xl border border-input bg-background p-3 transition-colors hover:bg-muted/40">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                <FileText className="h-5 w-5 text-primary" />
                              </div>
                              <div className="min-w-0">
                                  <p className="truncate text-[13px] font-semibold text-foreground" title={shortName(activeQuestion.question_file)}>
                                    {shortName(activeQuestion.question_file)}
                                  </p>
                                  <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">Question resource</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/file:opacity-100">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" asChild>
                                <a
                                  href={activeQuestion.question_file}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Open in new tab"
                                >
                                  <Eye className="h-4 w-4" />
                                </a>
                              </Button>
                            </div>
                        </div>
                      )}
                      
                      {activeQuestion.image && (
                        <div className="group/file flex items-center justify-between rounded-xl border border-input bg-background p-3 transition-colors hover:bg-muted/40">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                <ImageIcon className="h-5 w-5 text-primary" />
                              </div>
                              <div className="min-w-0">
                                  <p className="text-[13px] font-semibold text-foreground truncate">Image Preview</p>
                                  <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">Visual asset</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/file:opacity-100">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" asChild>
                                <a
                                  href={activeQuestion.image}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  title="Open in new tab"
                                >
                                  <Eye className="h-4 w-4" />
                                </a>
                              </Button>
                            </div>
                        </div>
                      )}
                      
                      {(activeQuestion.attachments || []).map(att => (
                        <div key={att.id} className="group/file flex items-center justify-between rounded-xl border border-input bg-background p-3 transition-colors hover:bg-muted/40">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                <FileText className="h-5 w-5 text-primary" />
                              </div>
                              <div className="min-w-0">
                                  <p className="truncate text-[13px] font-semibold text-foreground" title={att.name || att.file}>
                                    {att.name || shortName(att.file)}
                                  </p>
                                  <p className="mt-0.5 text-[10px] font-medium text-muted-foreground">Additional resource</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover/file:opacity-100">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" asChild>
                                <a href={att.file} target="_blank" rel="noopener noreferrer" title="Open in new tab">
                                  <Eye className="h-4 w-4" />
                                </a>
                              </Button>
                            </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Answer Box */}
                <div className="space-y-4 mb-10">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-muted-foreground">Your answer</h3>
                    {answers[activeQuestion.id] && answers[activeQuestion.id].trim() !== '' && (
                      <div className="flex items-center gap-2 text-[11px] font-medium tracking-wide text-success">
                        <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-success"></div>
                        Draft saved
                      </div>
                    )}
                  </div>
                  
                  <div className="overflow-hidden rounded-md border border-input bg-background transition-all focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
                    <Textarea
                      placeholder="Type your answer here..."
                      value={answers[activeQuestion.id] || ''}
                      onChange={(e) => handleTextChange(activeQuestion.id, e.target.value)}
                      className="min-h-[200px] w-full resize-none rounded-none border-0 bg-transparent p-6 text-[16px] leading-relaxed text-foreground shadow-none placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-0"
                    />
                  </div>
                </div>

                {/* Upload Solution — same pattern as course “Add Class Session” video file area */}
                <div className="grid gap-2">
                  <Label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                    <Upload className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                    Upload solution
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Need a template?{' '}
                    <a
                      href="/samples/student-answer-solution-template.ipynb"
                      download="student-answer-solution-template.ipynb"
                      className="text-primary hover:underline"
                    >
                      Download sample solution format
                    </a>
                    .
                  </p>
                  <input
                    key={activeQuestion.id}
                    type="file"
                    accept={STUDENT_ANSWER_FILE_ACCEPT}
                    className="hidden"
                    ref={(el) => (fileInputRefs.current[activeQuestion.id] = el)}
                    onChange={(e) => {
                      handleFileChange(activeQuestion.id, e.target.files?.[0] || null);
                      // Allow selecting the same file again (same/different question) to re-trigger change events.
                      e.currentTarget.value = '';
                    }}
                  />
                  <div
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        fileInputRefs.current[activeQuestion.id]?.click();
                      }
                    }}
                    onClick={() => fileInputRefs.current[activeQuestion.id]?.click()}
                    className={cn(
                      'rounded-lg border-2 border-dashed p-8 text-center transition-colors',
                      files[activeQuestion.id]
                        ? 'cursor-pointer border-primary bg-primary/5'
                        : 'cursor-pointer border-foreground/20 hover:border-primary/50'
                    )}
                  >
                    <div className="flex flex-col items-center justify-center">
                      {files[activeQuestion.id] ? (
                        <>
                          <CheckCircle className="mb-4 h-10 w-10 text-primary" />
                          <p className="text-sm font-medium text-foreground">{files[activeQuestion.id].name}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {(files[activeQuestion.id].size / (1024 * 1024)).toFixed(2)} MB · Click to replace
                          </p>
                          <button
                            type="button"
                            className="mt-4 text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-destructive hover:underline"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleFileChange(activeQuestion.id, null);
                              const ref = fileInputRefs.current[activeQuestion.id];
                              if (ref) ref.value = '';
                            }}
                          >
                            Remove file
                          </button>
                        </>
                      ) : (
                        <>
                          <Upload className="mb-4 h-10 w-10 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Drag and drop or click to upload</p>
                          <p className="mt-1 text-xs text-muted-foreground">.ipynb or PDF only.</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
           </div>

           {/* Right: Questions Summary List */}
           <div className="flex min-h-0 w-[320px] flex-none flex-col border-l border-border bg-background/40 p-6 lg:w-[380px]">
              <div className="shrink-0 pb-6">
                <div className="mb-4">
                  <span className="text-[16px] font-medium text-foreground">Question Navigator</span>
                  <p className="mt-1 text-sm text-muted-foreground">Jump between questions and see which ones already have an answer.</p>
                </div>
                <div className="flex max-w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <div className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-input bg-background px-3.5 py-1.5 text-[12px] font-medium text-foreground">
                    <span className="shrink-0 text-muted-foreground">Total marks</span>
                    <span className="font-bold tabular-nums text-primary">{formatMarksDisplay(totalMarksSum)}</span>
                  </div>
                  <div className="inline-flex max-w-full flex-wrap items-center gap-x-2 gap-y-1 rounded-full border border-input bg-background px-3.5 py-1.5 text-[12px] font-medium text-foreground">
                    <span className="shrink-0 text-muted-foreground">Pass percentage</span>
                    <span className="font-bold tabular-nums text-primary">{formatMarksDisplay(passPercentage)}%</span>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent">
                {test.questions.map((q, i) => {
                  const isAnswered = answers[q.id]?.trim() || files[q.id];
                  const isActive = activeQuestionIndex === i;
                  return (
                    <button
                      key={q.id}
                      onClick={() => setActiveQuestionIndex(i)}
                      className={`w-full text-left px-5 py-4 flex items-center justify-between rounded-lg border-l-[3px] transition-all ${
                        isActive 
                          ? 'border-primary bg-primary/8 dark:bg-primary/10' 
                          : 'border-transparent hover:bg-accent/50'
                      }`}
                    >
                      <span className={`text-[15px] font-semibold ${isActive ? 'text-foreground' : 'text-muted-foreground'}`}>Question {i+1}</span>
                      <div className="flex items-center gap-4">
                        <span
                          className={`shrink-0 text-[12px] font-medium tabular-nums ${isActive ? 'text-muted-foreground' : 'text-muted-foreground/80'}`}
                        >
                          {formatMarksDisplay(q.marks)} Marks
                        </span>
                        {isAnswered ? (
                           <CheckCircle className={`h-[18px] w-[18px] ${isActive ? 'text-success' : 'text-success/70'}`} />
                        ) : (
                           <div className="w-[18px] h-[18px]" />
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
           </div>

        </div>

        {/* Footer Navigation */}
        <div className="flex-none flex items-center justify-between border-t border-border bg-background px-8 py-5">
          <Button 
            variant="ghost" 
            className="h-12 rounded-xl bg-muted px-5 text-[14px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            onClick={() => setActiveQuestionIndex(p => Math.max(0, p - 1))}
            disabled={activeQuestionIndex === 0}
          >
             <ArrowLeft className="w-4 h-4 mr-2"/> Previous
          </Button>

          <div className="hidden items-center gap-4 md:flex">
             <span className="text-[13px] font-medium text-muted-foreground">Answered <span className="text-foreground">{answeredCount}</span> / {totalQuestions}</span>
             <div className="h-1.5 w-48 overflow-hidden rounded-full bg-muted">
               <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }}></div>
             </div>
             <span className="text-[13px] font-medium text-muted-foreground">{Math.round(progress)}%</span>
          </div>

          <div className="flex h-12 items-stretch gap-2">
            {activeQuestionIndex < totalQuestions - 1 ? (
              <Button
                variant="gradient"
                className="h-full rounded-xl px-8 text-sm font-bold shadow-none hover:shadow-none"
                onClick={() => setActiveQuestionIndex(p => p + 1)}
              >
                Next question <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <>
                <Button
                  variant="gradient"
                  className="h-full rounded-xl px-8 text-sm font-bold shadow-none hover:shadow-none"
                  onClick={validateAndConfirm}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <div className="mr-2.5 h-3.5 w-3.5 rounded-full border-[1.5px] border-white/60" />
                  )}
                  Submit all answers ({answeredCount}/{totalQuestions})
                </Button>
                <Button
                  variant="outline"
                  className="h-full rounded-xl px-4 shadow-none hover:shadow-none"
                  onClick={() => setActiveQuestionIndex(0)}
                  title="Review from start"
                >
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>
        </div>

      </DialogContent>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="overflow-hidden rounded-[2rem] border border-primary/25 bg-background p-0 shadow-2xl sm:max-w-[520px] [&>button]:right-4 [&>button]:top-4 [&>button]:z-[60] [&>button]:text-primary-foreground [&>button]:opacity-90 [&>button]:ring-offset-transparent [&>button]:hover:bg-white/10 [&>button]:hover:text-primary-foreground [&>button]:hover:opacity-100 data-[state=open]:[&>button]:bg-transparent data-[state=open]:[&>button]:text-primary-foreground">
          <div className="relative overflow-hidden border-b border-white/10 gradient-primary px-8 pb-7 pt-8 text-primary-foreground">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-white/5 blur-3xl" />
              <div className="absolute -bottom-4 -left-8 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
            </div>
            <div className="relative flex items-start justify-between gap-4">
              <div className="max-w-sm">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-primary-foreground backdrop-blur-md">
                  <HelpCircle className="h-3.5 w-3.5" />
                  Submission check
                </div>
                <DialogTitle className="mb-2 text-2xl font-bold tracking-tight text-primary-foreground">Ready to Submit?</DialogTitle>
                <DialogDescription className="text-[15px] font-medium leading-relaxed text-primary-foreground/80">
                  This will lock your responses and send them for evaluation. Take one last glance before you continue.
                </DialogDescription>
              </div>
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] border border-white/15 bg-white/10 backdrop-blur-md">
                <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-primary-foreground">
                  <svg className="absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                    <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="8" className="text-primary-foreground/20" fill="none" />
                    <circle
                      cx="50"
                      cy="50"
                      r="42"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeLinecap="round"
                      className="text-primary-foreground"
                      fill="none"
                      strokeDasharray={264}
                      strokeDashoffset={264 - (264 * Math.round(progress)) / 100}
                    />
                  </svg>
                  <span className="relative text-sm font-bold">{Math.round(progress)}%</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="mb-6 grid grid-cols-3 gap-3">
              <div className="rounded-2xl border border-border bg-background px-4 py-3 text-left">
                <p className="text-xs font-medium text-muted-foreground">Answered</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{answeredCount}</p>
              </div>
              <div className="rounded-2xl border border-border bg-background px-4 py-3 text-left">
                <p className="text-xs font-medium text-muted-foreground">Remaining</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{unansweredCount}</p>
              </div>
              <div className="rounded-2xl border border-border bg-background px-4 py-3 text-left">
                <p className="text-xs font-medium text-muted-foreground">Questions</p>
                <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{totalQuestions}</p>
              </div>
            </div>

            <div className={cn(
              "mb-8 flex w-full items-center gap-4 rounded-2xl border p-4",
              unansweredCount > 0
                ? "border-rose-500/20 bg-rose-500/5"
                : "border-emerald-500/20 bg-emerald-500/5"
            )}>
              <div className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
                unansweredCount > 0 ? "bg-rose-500/10" : "bg-emerald-500/10"
              )}>
                {unansweredCount > 0 ? (
                  <AlertCircle className="h-5 w-5 text-rose-500" />
                ) : (
                  <CheckCircle className="h-5 w-5 text-emerald-500" />
                )}
              </div>
              <div className="text-left">
                <p className={cn(
                  "text-[13px] font-semibold leading-tight",
                  unansweredCount > 0 ? "text-rose-500 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                )}>
                  {unansweredCount > 0
                    ? `You still have ${unansweredCount} unanswered questions.`
                    : 'Everything is filled in and ready to go.'}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {unansweredCount > 0
                    ? 'You can still submit now, or go back and complete the remaining questions first.'
                    : 'Once you submit, your answers will be finalized and sent for evaluation.'}
                </p>
              </div>
            </div>

            <div className="flex w-full flex-col gap-3">
              <Button
                variant="gradient"
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="h-14 w-full rounded-2xl text-sm font-bold shadow-none hover:shadow-none"
              >
                {isSubmitting ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                Finalize & submit
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowConfirm(false)}
                className="h-14 w-full rounded-2xl bg-muted px-5 text-sm font-semibold text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
              >
                Wait, I need to check
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

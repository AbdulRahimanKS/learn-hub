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
  X,
  Loader2,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
  HelpCircle,
  Eye,
  Download,
  ArrowLeft,
  ArrowRight,
  Copy,
  MoreHorizontal
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
  const [activeQuestionIndex, setActiveQuestionIndex] = useState(0);
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

  if (!test?.questions || test.questions.length === 0) return null;

  const answeredCount = test.questions.filter(q => 
    (answers[q.id] && answers[q.id].trim() !== '') || files[q.id]
  ).length;
  const totalQuestions = test.questions.length;
  const progress = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
  
  const activeQuestion = test.questions[activeQuestionIndex];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && !isSubmitting && onClose()}>
      {/* Container is full-width style modal */}
      <DialogContent className="max-w-[1200px] w-[95vw] h-[90vh] flex flex-col p-0 overflow-hidden border-[#1A1F36] shadow-[0_0_80px_rgba(0,0,0,0.6)] bg-[#0A0D18] text-slate-300">
        
        {/* Header Section */}
        <div className="flex-none pt-8 px-8 pb-4">
           {/* Top part: Title and global progress */}
           <div className="flex justify-between items-start mb-6">
              <div>
                 <DialogTitle className="text-2xl font-semibold text-white tracking-wide mb-1.5">{test.title}</DialogTitle>
                 <DialogDescription className="text-slate-400 text-[15px]">Answer questions by typing or uploading files.</DialogDescription>
              </div>
              <div className="flex items-center gap-5">
                 <span className="text-[13px] font-medium text-indigo-400/80">Answered {answeredCount} / {totalQuestions}</span>
                 <div className="w-[100px] bg-[#1a1f33] h-1.5 rounded-full overflow-hidden">
                   <div className="bg-[#4a5ee3] h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                 </div>
                 <span className="text-[13px] font-medium text-slate-400">{Math.round(progress)}%</span>
              </div>
           </div>

           {/* Tabs section */}
           <div className="flex items-center gap-6 pb-2 border-b border-[#1A1F36]">
              <div className="bg-[#101423] p-1.5 rounded-[2rem] flex items-center justify-between w-full">
                 <div className="flex items-center gap-2">
                    <div className="bg-transparent px-4 py-1.5 rounded-full flex items-center gap-3">
                       <span className="text-[15px] font-semibold text-white">Questions</span>
                       <div className="bg-[#1a1f33] text-[11px] font-bold px-2.5 py-1 rounded-full text-slate-300">
                          {test.questions.reduce((sum, q) => sum + q.marks, 0)} / {totalQuestions}
                       </div>
                    </div>
                    
                    <div className="w-px h-6 bg-[#1A1F36] mx-1"></div>

                    <div className="flex-1 flex gap-1">
                       {test.questions.map((q, i) => (
                          <button
                            key={q.id}
                            onClick={() => setActiveQuestionIndex(i)}
                            className={`px-5 py-2.5 rounded-full text-[13px] font-medium whitespace-nowrap transition-all duration-300 ${
                              activeQuestionIndex === i 
                                ? 'bg-[#21295c] text-indigo-300 shadow-[0_0_15px_rgba(65,85,225,0.1)]' 
                                : 'bg-transparent text-slate-400 hover:text-white hover:bg-[#1a1f33]'
                            }`}
                          >
                            Question {i + 1}
                          </button>
                       ))}
                    </div>
                 </div>
                 
                 <div className="hidden md:flex items-center gap-2 px-5 py-2.5 bg-[#101423] rounded-full text-[13px] font-medium text-slate-400 border border-[#1A1F36]/50">
                    <CheckCircle className="w-3.5 h-3.5 text-indigo-400/60" /> Test Progress Tracker
                 </div>
              </div>
           </div>
        </div>

        {/* Main Content Split */}
        <div className="flex-1 flex overflow-hidden">
           
           {/* Left: Question Area */}
           <div className="flex-1 overflow-y-auto px-10 py-8 relative [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-[#1A1F36] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
              <div className="max-w-[800px] mb-8">
                
                {/* Question Info Header */}
                <div className="flex items-center gap-4 mb-6">
                  <div className="bg-[#161a33] text-[#6979F8] px-3.5 py-1.5 rounded-md text-[10px] font-bold tracking-widest uppercase">
                    QUESTION {activeQuestionIndex + 1}
                  </div>
                  <div className="text-slate-400 text-[13px] font-medium">
                    {activeQuestion.marks} Marks
                  </div>
                </div>

                {/* Question Text */}
                <h2 className="text-[26px] font-bold text-white leading-snug mb-6 whitespace-pre-line">
                  {activeQuestion.text}
                </h2>

                {/* Question Resources (Reference Materials from Admin) */}
                {(activeQuestion.question_file || activeQuestion.image || (activeQuestion.attachments && activeQuestion.attachments.length > 0)) && (
                  <div className="space-y-3 mb-8">
                    <Label className="text-[11px] font-bold text-slate-400 uppercase tracking-[0.15em] flex items-center gap-2">
                      <HelpCircle className="h-4 w-4" /> Reference Files
                    </Label>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {activeQuestion.question_file && (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-[#0c101d] border border-[#1A1F36] group/file shadow-sm">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-10 w-10 rounded-lg bg-[#1a1f33] flex items-center justify-center shrink-0">
                                <FileText className="h-5 w-5 text-indigo-400" />
                              </div>
                              <div className="min-w-0">
                                  <p className="text-[13px] font-semibold text-slate-200 truncate" title={shortName(activeQuestion.question_file)}>
                                    {shortName(activeQuestion.question_file)}
                                  </p>
                                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mt-0.5">Question Resource</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover/file:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" asChild>
                                  <a href={activeQuestion.question_file} target="_blank" rel="noreferrer">
                                    <Eye className="h-4 w-4" />
                                  </a>
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" asChild>
                                  <a href={activeQuestion.question_file} download>
                                    <Download className="h-4 w-4" />
                                  </a>
                              </Button>
                            </div>
                        </div>
                      )}
                      
                      {activeQuestion.image && (
                        <div className="flex items-center justify-between p-3 rounded-xl bg-[#0c101d] border border-[#1A1F36] group/file shadow-sm">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-10 w-10 rounded-lg bg-[#1a1f33] flex items-center justify-center shrink-0">
                                <ImageIcon className="h-5 w-5 text-indigo-400" />
                              </div>
                              <div className="min-w-0">
                                  <p className="text-[13px] font-semibold text-slate-200 truncate">Image Preview</p>
                                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mt-0.5">Visual Asset</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover/file:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" asChild>
                                  <a href={activeQuestion.image} target="_blank" rel="noreferrer">
                                    <Eye className="h-4 w-4" />
                                  </a>
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" asChild>
                                  <a href={activeQuestion.image} download>
                                    <Download className="h-4 w-4" />
                                  </a>
                              </Button>
                            </div>
                        </div>
                      )}
                      
                      {(activeQuestion.attachments || []).map(att => (
                        <div key={att.id} className="flex items-center justify-between p-3 rounded-xl bg-[#0c101d] border border-[#1A1F36] group/file shadow-sm">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="h-10 w-10 rounded-lg bg-[#1a1f33] flex items-center justify-center shrink-0">
                                <FileText className="h-5 w-5 text-indigo-400" />
                              </div>
                              <div className="min-w-0">
                                  <p className="text-[13px] font-semibold text-slate-200 truncate" title={att.name || att.file}>
                                    {att.name || shortName(att.file)}
                                  </p>
                                  <p className="text-[10px] font-medium text-slate-500 uppercase tracking-widest mt-0.5">Additional Resource</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 opacity-0 group-hover/file:opacity-100 transition-opacity">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" asChild>
                                  <a href={att.file} target="_blank" rel="noreferrer">
                                    <Eye className="h-4 w-4" />
                                  </a>
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-white" asChild>
                                  <a href={att.file} download>
                                    <Download className="h-4 w-4" />
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
                    <h3 className="text-[11px] font-bold text-slate-400 tracking-[0.15em] uppercase">Your Answer</h3>
                    {answers[activeQuestion.id] && answers[activeQuestion.id].trim() !== '' && (
                      <div className="flex items-center gap-2 text-[11px] text-[#22c55e] font-medium tracking-wide">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e] animate-pulse"></div>
                        Draft saved
                      </div>
                    )}
                  </div>
                  
                  <div className="border border-[#1A1F36] bg-[#0c101d] rounded-2xl overflow-hidden focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20 transition-all shadow-inner">
                     <Textarea 
                       placeholder="Type your answer here..."
                       value={answers[activeQuestion.id] || ''}
                       onChange={(e) => handleTextChange(activeQuestion.id, e.target.value)}
                       className="min-h-[200px] w-full bg-transparent border-none text-slate-200 placeholder:text-slate-600 resize-none p-6 focus-visible:ring-0 text-[16px] leading-relaxed focus:outline-none focus-visible:outline-none rounded-none shadow-none"
                     />
                  </div>
                </div>

                {/* Upload Solution */}
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-slate-300">
                    <h3 className="text-[13px] font-semibold flex items-center gap-2">
                       <Upload className="w-4 h-4 opacity-50"/> Upload Solution
                    </h3>
                  </div>

                  {!files[activeQuestion.id] ? (
                    <div 
                      onClick={() => fileInputRefs.current[activeQuestion.id]?.click()}
                      className="border border-dashed border-[#1A1F36] rounded-xl p-10 bg-[#0c101d]/50 hover:bg-[#0c101d] transition-colors cursor-pointer flex flex-col items-center justify-center group"
                    >
                       <input 
                         type="file"
                         className="hidden"
                         ref={(el) => (fileInputRefs.current[activeQuestion.id] = el)}
                         onChange={(e) => handleFileChange(activeQuestion.id, e.target.files?.[0] || null)}
                       />
                       <p className="text-slate-300 text-[15px] mb-2">
                         <span className="font-semibold text-white">Drag & drop your</span> file here or <span className="text-indigo-400 group-hover:text-indigo-300 transition-colors">Browse</span>
                       </p>
                       <p className="text-[11px] text-slate-500 font-medium tracking-wide">Supported: .ipynb, pdf, doc, png</p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-4 rounded-xl border border-[#1A1F36] bg-[#0c101d]">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded bg-[#22c55e]/10 flex items-center justify-center text-[#22c55e]">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-[14px] font-semibold text-slate-200">{files[activeQuestion.id].name}</p>
                            <p className="text-[11px] text-[#22c55e] font-medium flex items-center gap-1.5 mt-0.5">
                               <div className="w-1.5 h-1.5 rounded-full bg-[#22c55e]"></div> Uploaded
                            </p>
                          </div>
                       </div>
                       <div className="flex items-center gap-3">
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white h-8 w-8"><Copy className="w-4 h-4"/></Button>
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white h-8 w-8"><Download className="w-4 h-4"/></Button>
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white h-8 w-8"><MoreHorizontal className="w-4 h-4"/></Button>
                          <Button variant="ghost" size="icon" className="text-slate-400 hover:text-rose-400 h-8 w-8 ml-2" onClick={() => handleFileChange(activeQuestion.id, null)}><X className="w-4 h-4"/></Button>
                       </div>
                    </div>
                  )}
                </div>
              </div>
           </div>

           {/* Right: Questions Summary List */}
           <div className="w-[320px] lg:w-[380px] flex-none border-l border-[#1A1F36] bg-[#0A0D18] flex flex-col p-6">
              <div className="pb-6">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-white font-medium text-[16px]">Answered {answeredCount} / {totalQuestions}</span>
                  <div className="flex items-center gap-3">
                     <div className="w-16 bg-[#1a1f33] h-1.5 rounded-full overflow-hidden">
                       <div className="bg-[#4a5ee3] h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
                     </div>
                     <span className="bg-[#101423] border border-[#1A1F36] text-slate-300 text-[11px] font-bold px-2 py-1 rounded-md">{Math.round(progress)}%</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:bg-[#1A1F36] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                {test.questions.map((q, i) => {
                  const isAnswered = answers[q.id]?.trim() || files[q.id];
                  const isActive = activeQuestionIndex === i;
                  return (
                    <button
                      key={q.id}
                      onClick={() => setActiveQuestionIndex(i)}
                      className={`w-full text-left px-5 py-4 flex items-center justify-between rounded-lg border-l-[3px] transition-all ${
                        isActive 
                          ? 'bg-[#151a30] border-[#4a5ee3]' 
                          : 'border-transparent hover:bg-[#101423]'
                      }`}
                    >
                      <span className={`font-semibold text-[15px] ${isActive ? 'text-white' : 'text-slate-400'}`}>Question {i+1}</span>
                      <div className="flex items-center gap-4">
                        <span className={`text-[12px] font-medium ${isActive ? 'text-slate-400' : 'text-slate-500'}`}>{q.marks} Marks</span>
                        {isAnswered ? (
                           <CheckCircle className={`w-[18px] h-[18px] ${isActive ? 'text-[#22c55e]' : 'text-[#22c55e]/60'}`} />
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
        <div className="flex-none flex items-center justify-between px-8 py-5 border-t border-[#1A1F36] bg-[#0A0D18]">
          <Button 
            variant="ghost" 
            className="text-slate-300 hover:text-white hover:bg-[#1A1F36] px-5 h-12 rounded-xl bg-[#101423] font-medium text-[14px]"
            onClick={() => setActiveQuestionIndex(p => Math.max(0, p - 1))}
            disabled={activeQuestionIndex === 0}
          >
             <ArrowLeft className="w-4 h-4 mr-2"/> Previous
          </Button>

          <div className="flex items-center gap-4 hidden md:flex">
             <span className="text-[13px] text-slate-400 font-medium">Answered <span className="text-white">{answeredCount}</span> / {totalQuestions}</span>
             <div className="w-48 bg-[#1a1f33] h-1.5 rounded-full overflow-hidden">
               <div className="bg-[#4a5ee3] h-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
             </div>
             <span className="text-[13px] text-slate-400 font-medium">{Math.round(progress)}%</span>
          </div>

          <div className="flex h-12 shadow-lg shadow-indigo-500/10 rounded-xl overflow-hidden">
            {activeQuestionIndex < totalQuestions - 1 ? (
               <Button 
                 className="bg-[#242f6d] hover:bg-[#2e3b8a] text-white px-8 h-full uppercase tracking-wider text-[12px] font-bold rounded-none"
                 onClick={() => setActiveQuestionIndex(p => p + 1)}
               >
                 Next Question <ArrowRight className="w-4 h-4 ml-2" />
               </Button>
            ) : (
               <>
                 <Button 
                   className="bg-[#242f6d] hover:bg-[#2e3b8a] text-white px-8 h-full rounded-r-none border-r border-[#1a2357] uppercase tracking-wider text-[12px] font-bold shadow-none"
                   onClick={validateAndConfirm}
                   disabled={isSubmitting}
                 >
                   {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <div className="w-3.5 h-3.5 rounded-full border-[1.5px] border-white/60 mr-2.5" />}
                   Submit All Answers ({answeredCount}/{totalQuestions})
                 </Button>
                 <Button 
                   className="bg-[#242f6d] hover:bg-[#2e3b8a] text-white px-4 h-full rounded-l-none shadow-none text-white/60"
                   onClick={() => setActiveQuestionIndex(0)}
                   title="Review from start"
                 >
                   <ArrowRight className="w-4 h-4" />
                 </Button>
               </>
            )}
          </div>
        </div>

      </DialogContent>

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-[420px] rounded-[2rem] p-0 border-[#1A1F36] bg-[#0A0D18] shadow-[0_0_100px_rgba(0,0,0,0.8)] overflow-hidden">
          <div className="bg-gradient-to-b from-indigo-600/10 to-transparent p-10 flex flex-col items-center text-center">
            <div className="w-24 h-24 rounded-full bg-[#1a2357] flex items-center justify-center text-indigo-400 mb-8 shadow-2xl border border-indigo-500/20">
              <HelpCircle className="h-12 w-12 animate-pulse" />
            </div>
            
            <DialogTitle className="text-2xl font-bold tracking-tight text-white mb-3">
              Ready to Submit?
            </DialogTitle>
            <DialogDescription className="text-[15px] font-medium text-slate-400 leading-relaxed mb-8">
              Once submitted, your answers will be finalized and sent for evaluation. You won't be able to make further changes.
            </DialogDescription>

            {test.questions.filter(q => !answers[q.id]?.trim() && !files[q.id]).length > 0 && (
              <div className="w-full p-4 bg-rose-500/5 border border-rose-500/20 rounded-2xl flex items-center gap-4 mb-8">
                <div className="w-10 h-10 rounded-full bg-rose-500/10 flex items-center justify-center shrink-0">
                   <AlertCircle className="h-5 w-5 text-rose-500" />
                </div>
                <p className="text-[13px] font-semibold text-rose-400 text-left leading-tight">
                  Heads up! You have {test.questions.filter(q => !answers[q.id]?.trim() && !files[q.id]).length} unanswered questions.
                </p>
              </div>
            )}

            <div className="flex flex-col w-full gap-3">
              <Button 
                onClick={handleSubmit} 
                disabled={isSubmitting} 
                className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase tracking-[0.1em] text-[13px] shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
              >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin mr-2" /> : null}
                Finalize & Submit
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setShowConfirm(false)} 
                className="w-full h-14 rounded-2xl font-bold text-[13px] text-slate-400 hover:text-white hover:bg-[#1A1F36] transition-all"
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

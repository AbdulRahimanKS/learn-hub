import React, { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  Plus,
  Trash2,
  Edit,
  Loader2,
  FileText,
  Image as ImageIcon,
  Paperclip,
  CheckCircle,
  BookOpen,
  Save,
  UploadCloud,
  X,
  AlertCircle,
  FilePlus2,
  ExternalLink,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuestionAttachment {
  id: number;
  file: string;
  name: string;
}

export interface TestQuestion {
  id: number;
  test: number;
  text: string;
  question_file: string | null;
  image: string | null;
  order: number;
  marks: number;
  attachments?: QuestionAttachment[];
}

export interface WeeklyTest {
  id: number;
  title: string;
  instructions: string;
  pass_percentage: number;
  answer_key?: string | null;
  questions: TestQuestion[];
}

interface WeeklyTestManagerProps {
  open: boolean;
  onClose: () => void;
  existingTest: WeeklyTest | null;
  weekLabel: string;
  /** e.g. "/api/courses/v1/courses/3/weeks/2/test" — NO trailing slash */
  testApiBase: string;
  onSaved: () => void;
  onDeleted?: () => void;
}

// ─── Question form state ───────────────────────────────────────────────────────

interface QuestionFormState {
  id?: number;
  text: string;
  marks: string;
  question_file: File | null;
  question_file_url: string | null;
  image: File | null;
  image_url: string | null;
  /** PATCH only: user cleared an existing server-side question file */
  remove_question_file: boolean;
  /** PATCH only: user cleared an existing server-side image */
  remove_image: boolean;
  // Existing persisted attachments (loaded from backend)
  existingAttachments: QuestionAttachment[];
  // New files queued to upload (not yet saved)
  newAttachmentFiles: File[];
}

const emptyQuestion = (): QuestionFormState => ({
  text: '',
  marks: '1',
  question_file: null,
  question_file_url: null,
  image: null,
  image_url: null,
  remove_question_file: false,
  remove_image: false,
  existingAttachments: [],
  newAttachmentFiles: [],
});

// ─── Tiny inline error helper ─────────────────────────────────────────────────
function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-destructive mt-1">
      <AlertCircle className="h-3 w-3 flex-shrink-0" />
      {msg}
    </p>
  );
}

/** Trim a long filename to a readable short form */
function shortName(url: string | null | undefined) {
  if (!url) return 'File';
  // If it's a blob/URL from a File object, use name if possible, but here we expect strings
  if (typeof url !== 'string') return 'File';
  return url.split('/').pop()?.split('?')[0] || url;
}

function isAllowedAnswerKeyFile(file: File) {
  const name = file.name.toLowerCase();
  return name.endsWith('.pdf') || name.endsWith('.ipynb');
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WeeklyTestManager({
  open,
  onClose,
  existingTest,
  weekLabel,
  testApiBase,
  onSaved,
  onDeleted,
}: WeeklyTestManagerProps) {
  const { toast } = useToast();

  // ── Header form ──────────────────────────────────────────────────────────
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [passPercentage, setPassPercentage] = useState('70');
  const [answerKeyFile, setAnswerKeyFile] = useState<File | null>(null);
  const [isSavingHeader, setIsSavingHeader] = useState(false);
  const [testId, setTestId] = useState<number | null>(null);

  // Header field errors
  const [headerErrors, setHeaderErrors] = useState<{
    title?: string;
    pass_percentage?: string;
    answer_key?: string;
  }>({});

  // ── Questions ────────────────────────────────────────────────────────────
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionFormState>(emptyQuestion());
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [deleteQuestionId, setDeleteQuestionId] = useState<number | null>(null);
  const [isDeletingQuestion, setIsDeletingQuestion] = useState(false);

  // ── Delete test confirmation ──────────────────────────────────────────────
  const [isDeleteTestOpen, setIsDeleteTestOpen] = useState(false);
  const [isDeletingTest, setIsDeletingTest] = useState(false);

  // Question field errors
  const [questionErrors, setQuestionErrors] = useState<{
    content?: string;
    marks?: string;
  }>({});

  // Attachment upload tracking
  const [uploadingAttachmentIdxs, setUploadingAttachmentIdxs] = useState<Set<number>>(new Set());
  const [deletingAttachmentIds, setDeletingAttachmentIds] = useState<Set<number>>(new Set());

  const answerKeyRef = useRef<HTMLInputElement>(null);
  const questionFileRef = useRef<HTMLInputElement>(null);
  const questionImageRef = useRef<HTMLInputElement>(null);
  const attachmentFileRef = useRef<HTMLInputElement>(null);

  // ── Init on open ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    if (existingTest) {
      setTitle(existingTest.title);
      setInstructions(existingTest.instructions || '');
      setPassPercentage(String(existingTest.pass_percentage ?? 70));
      setTestId(existingTest.id);
      setQuestions(existingTest.questions || []);
    } else {
      setTitle('');
      setInstructions('');
      setPassPercentage('70');
      setTestId(null);
      setQuestions([]);
      setAnswerKeyFile(null);
    }
    setHeaderErrors({});
  }, [open, existingTest]);

  // ── Header validation ─────────────────────────────────────────────────────
  const validateHeader = (): boolean => {
    const errors: typeof headerErrors = {};

    if (!title.trim()) {
      errors.title = 'Test title is required.';
    } else if (title.trim().length > 255) {
      errors.title = 'Title must be 255 characters or fewer.';
    }

    const pct = Number(passPercentage);
    if (passPercentage === '' || isNaN(pct)) {
      errors.pass_percentage = 'Pass percentage is required.';
    } else if (pct < 0 || pct > 100) {
      errors.pass_percentage = 'Must be between 0 and 100.';
    }

    // Answer key is required when creating a new test (no existing one uploaded)
    if (!testId && !answerKeyFile && !existingTest?.answer_key) {
      errors.answer_key = 'Answer key is required.';
    }

    setHeaderErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Save header ───────────────────────────────────────────────────────────
  const handleSaveHeader = async () => {
    if (!validateHeader()) return;

    setIsSavingHeader(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      formData.append('instructions', instructions);
      formData.append('pass_percentage', passPercentage);
      if (answerKeyFile) formData.append('answer_key', answerKeyFile);

      if (testId) {
        await apiClient.patch(`${testApiBase}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        toast({ 
          title: 'Assessment Updated', 
          description: 'The test configuration has been successfully saved.', 
          variant: 'success' 
        });
      } else {
        const res = await apiClient.post(`${testApiBase}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setTestId(res.data?.data?.id ?? null);
        toast({ 
          title: 'Assessment Created', 
          description: 'Configuration saved. You can now add questions.', 
          variant: 'success' 
        });
        onClose();
      }
      onSaved();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.response?.data?.detail || 'Failed to save test.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingHeader(false);
    }
  };

  // ── Delete test ───────────────────────────────────────────────────────────
  const handleDeleteTest = async () => {
    setIsDeletingTest(true);
    try {
      await apiClient.delete(`${testApiBase}/`);
      toast({ 
        title: 'Assessment Deleted', 
        description: 'The weekly assessment has been removed successfully.', 
        variant: 'success' 
      });
      setIsDeleteTestOpen(false);
      onSaved();
      onDeleted?.();
      onClose();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.response?.data?.detail || 'Failed to delete assessment.',
        variant: 'destructive',
      });
    } finally {
      setIsDeletingTest(false);
    }
  };

  // ── Question validation ───────────────────────────────────────────────────
  const validateQuestion = (): boolean => {
    const errors: typeof questionErrors = {};

    const hasQuestionFile =
      editingQuestion.question_file !== null ||
      (editingQuestion.question_file_url !== null && !editingQuestion.remove_question_file);
    const hasImage =
      editingQuestion.image !== null ||
      (editingQuestion.image_url !== null && !editingQuestion.remove_image);

    const hasContent =
      editingQuestion.text.trim().length > 0 ||
      hasQuestionFile ||
      hasImage ||
      editingQuestion.existingAttachments.length > 0 ||
      editingQuestion.newAttachmentFiles.length > 0;

    if (!hasContent) {
      errors.content = 'Provide question text, a file, or an attachment — at least one is required.';
    }

    const marksVal = Number(editingQuestion.marks);
    if (editingQuestion.marks === '' || isNaN(marksVal)) {
      errors.marks = 'Marks value is required.';
    } else if (marksVal <= 0) {
      errors.marks = 'Marks must be greater than 0.';
    }

    setQuestionErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Question helpers ──────────────────────────────────────────────────────
  const openAddQuestion = () => {
    setEditingQuestion(emptyQuestion());
    setEditingQuestionId(null);
    setQuestionErrors({});
    setIsQuestionModalOpen(true);
  };

  const openEditQuestion = (q: TestQuestion) => {
    // Ensure existingAttachments is extracted safely
    const existingAtts = Array.isArray(q.attachments) ? q.attachments : [];
    
    setEditingQuestion({
      id: q.id,
      text: q.text,
      marks: String(q.marks),
      question_file: null,
      question_file_url: q.question_file,
      image: null,
      image_url: q.image,
      remove_question_file: false,
      remove_image: false,
      existingAttachments: existingAtts,
      newAttachmentFiles: [],
    });
    setEditingQuestionId(q.id);
    setQuestionErrors({});
    setIsQuestionModalOpen(true);
  };

  const handleSaveQuestion = async () => {
    if (!testId) {
      toast({ title: 'Save the test first', description: 'Click "Save Test" before adding questions.', variant: 'destructive' });
      return;
    }
    if (!validateQuestion()) return;

    setIsSavingQuestion(true);
    try {
      const fd = new FormData();
      fd.append('text', editingQuestion.text);
      fd.append('marks', editingQuestion.marks || '1');
      if (editingQuestion.question_file) fd.append('question_file', editingQuestion.question_file);
      if (editingQuestion.image) fd.append('image', editingQuestion.image);

      let savedQuestionId = editingQuestionId;

      if (editingQuestionId) {
        if (editingQuestion.remove_question_file && !editingQuestion.question_file) {
          fd.append('remove_question_file', 'true');
        }
        if (editingQuestion.remove_image && !editingQuestion.image) {
          fd.append('remove_image', 'true');
        }
        const res = await apiClient.patch(
          `${testApiBase}/questions/${editingQuestionId}/`,
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        // Ensure we have the latest ID and any server-side updates (though ID shouldn't change)
        savedQuestionId = res.data?.data?.id ?? editingQuestionId;
        toast({ title: 'Success', description: res.data?.message || 'Question updated', variant: 'success' });
      } else {
        const res = await apiClient.post(
          `${testApiBase}/questions/`,
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        savedQuestionId = res.data?.data?.id ?? null;
        toast({ title: 'Success', description: res.data?.message || 'Question added', variant: 'success' });
      }

      // Upload any queued new attachment files
      if (savedQuestionId && editingQuestion.newAttachmentFiles.length > 0) {
        for (const file of editingQuestion.newAttachmentFiles) {
          const afd = new FormData();
          afd.append('file', file);
          afd.append('name', file.name);
          try {
            await apiClient.post(
              `${testApiBase}/questions/${savedQuestionId}/attachments/`,
              afd,
              { headers: { 'Content-Type': 'multipart/form-data' } }
            );
          } catch {
            toast({ title: 'Warning', description: `Failed to upload attachment: ${file.name}`, variant: 'destructive' });
          }
        }
      }

      setIsQuestionModalOpen(false);
      await refreshQuestions();
    } catch (err: any) {
      toast({
        title: 'Error',
        description: err?.response?.data?.detail || 'Failed to save question.',
        variant: 'destructive',
      });
    } finally {
      setIsSavingQuestion(false);
    }
  };

  const refreshQuestions = async () => {
    if (!testId) return;
    try {
      const res = await apiClient.get(`${testApiBase}/questions/`);
      setQuestions(res.data?.data || []);
    } catch {}
    onSaved();
  };

  const handleDeleteQuestion = async () => {
    if (!deleteQuestionId) return;
    setIsDeletingQuestion(true);
    try {
      const res = await apiClient.delete(`${testApiBase}/questions/${deleteQuestionId}/`);
      toast({ title: 'Deleted', description: res.data?.message || 'Question removed', variant: 'success' });
      setDeleteQuestionId(null);
      await refreshQuestions();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete question.', variant: 'destructive' });
    } finally {
      setIsDeletingQuestion(false);
    }
  };

  // ── Attachment helpers (edit modal) ───────────────────────────────────────
  const handleDeleteExistingAttachment = async (attachmentId: number) => {
    if (!editingQuestionId) return;
    setDeletingAttachmentIds(prev => new Set(prev).add(attachmentId));
    try {
      const res = await apiClient.delete(`${testApiBase}/questions/${editingQuestionId}/attachments/${attachmentId}/`);
      setEditingQuestion(prev => ({
        ...prev,
        existingAttachments: prev.existingAttachments.filter(a => a.id !== attachmentId),
      }));
      toast({ title: 'Removed', description: res.data?.message || 'Attachment removed', variant: 'success' });
    } catch {
      toast({ title: 'Error', description: 'Failed to remove attachment.', variant: 'destructive' });
    } finally {
      setDeletingAttachmentIds(prev => {
        const next = new Set(prev);
        next.delete(attachmentId);
        return next;
      });
    }
  };

  const handleAddNewAttachmentFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);
    setEditingQuestion(prev => ({
      ...prev,
      newAttachmentFiles: [...prev.newAttachmentFiles, ...fileArray],
    }));
    if (questionErrors.content) setQuestionErrors(p => ({ ...p, content: undefined }));
  };

  const handleRemoveNewAttachment = (index: number) => {
    setEditingQuestion(prev => ({
      ...prev,
      newAttachmentFiles: prev.newAttachmentFiles.filter((_, i) => i !== index),
    }));
  };

  const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent
          className="sm:max-w-3xl max-h-[92vh] flex flex-col overflow-hidden"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-foreground tracking-tight">
              Weekly Test Configuration
            </DialogTitle>
            <DialogDescription className="text-muted-foreground/80">
              {weekLabel} — Configure the core settings for this week's assessment.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-2 space-y-8 py-4 scrollbar-hide">

            {/* ── Configuration Section (Screenshot Design) ── */}
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="wt-title" className="text-sm font-semibold text-foreground/90">
                  Test Title <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="wt-title"
                  value={title}
                  onChange={e => {
                    setTitle(e.target.value);
                    if (headerErrors.title) setHeaderErrors(p => ({ ...p, title: undefined }));
                  }}
                  placeholder="Weekly Assessment"
                  className={cn(
                    "bg-background/50 border-border focus:border-primary/50 transition-all font-medium",
                    headerErrors.title && "border-destructive focus:ring-destructive"
                  )}
                />
                <FieldError msg={headerErrors.title} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="wt-instructions" className="text-sm font-semibold text-foreground/90">
                  Instructions
                </Label>
                <Textarea
                  id="wt-instructions"
                  value={instructions}
                  onChange={e => setInstructions(e.target.value)}
                  placeholder="Optional instructions for students..."
                  rows={3}
                  className="bg-background/50 border-border focus:border-primary/50 transition-all resize-none"
                />
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="wt-pass" className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
                    Pass Percentage <span className="text-destructive">*</span>
                  </Label>
                  <div className="relative w-full sm:w-1/2">
                    <Input
                      id="wt-pass"
                      type="number"
                      min={0}
                      max={100}
                      value={passPercentage}
                      onChange={e => {
                        setPassPercentage(e.target.value);
                        if (headerErrors.pass_percentage) setHeaderErrors(p => ({ ...p, pass_percentage: undefined }));
                      }}
                      className="bg-background/50 border-border focus:border-primary/50 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">%</span>
                  </div>
                  <FieldError msg={headerErrors.pass_percentage} />
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-foreground/90 flex items-center gap-2">
                    Answer Key <span className="text-xs text-muted-foreground font-normal">(.pdf or .ipynb only)</span>
                  </Label>
                  <div className="flex items-center gap-3 p-1 rounded-lg border border-border bg-background/30 h-10 w-full">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 hover:bg-muted text-xs px-3"
                      onClick={() => answerKeyRef.current?.click()}
                    >
                      Choose File
                    </Button>
                    <span className="text-[11px] text-muted-foreground truncate flex-1 px-1">
                      {answerKeyFile ? answerKeyFile.name : (existingTest?.answer_key ? shortName(existingTest.answer_key) : 'No file chosen')}
                    </span>
                    {answerKeyFile && (
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground" onClick={() => setAnswerKeyFile(null)}>
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <FieldError msg={headerErrors.answer_key} />
                  <p className="text-[11px] text-muted-foreground">
                    Include both questions and solutions in one file. Need a template?{' '}
                    <a
                      href="/samples/answer-key-template.ipynb"
                      download="answer-key-template.ipynb"
                      className="text-primary hover:underline"
                    >
                      Download sample answer key
                    </a>
                    .
                  </p>
                  <input 
                    ref={answerKeyRef} 
                    type="file" 
                    accept=".pdf,.ipynb" 
                    className="hidden" 
                    onChange={e => {
                      const selected = e.target.files?.[0] || null;
                      if (!selected) {
                        setAnswerKeyFile(null);
                        return;
                      }
                      if (!isAllowedAnswerKeyFile(selected)) {
                        toast({
                          title: 'Invalid answer key format',
                          description: 'Only .pdf or .ipynb files are allowed for answer keys.',
                          variant: 'destructive',
                        });
                        e.target.value = '';
                        return;
                      }
                      setAnswerKeyFile(selected);
                      if (headerErrors.answer_key) setHeaderErrors(p => ({ ...p, answer_key: undefined }));
                    }} 
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button id="wt-save-btn" variant="gradient" size="sm" onClick={handleSaveHeader} disabled={isSavingHeader}>
                  {isSavingHeader ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                  {testId ? 'Update Configuration' : 'Save & Add Questions'}
                </Button>
              </div>
            </div>

            {/* ── Questions ────────────────────────────────────────────────── */}
            {testId && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-base">Questions</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {questions.length} question{questions.length !== 1 ? 's' : ''} · {totalMarks} total marks
                    </p>
                  </div>
                  <Button id="wt-add-question" variant="outline" size="sm" onClick={openAddQuestion}>
                    <Plus className="h-4 w-4 mr-1.5" />
                    Add Question
                  </Button>
                </div>

                {questions.length === 0 ? (
                  <div className="border-2 border-dashed border-foreground/15 rounded-xl p-10 text-center bg-muted/10">
                    <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">No questions yet. Click "Add Question" to start.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {[...questions].sort((a, b) => a.order - b.order).map((q, idx) => (
                      <Card key={q.id} className="border-border/60 hover:border-primary/30 transition-colors">
                        <CardContent className="p-4">
                          <div className="flex gap-3 items-start">
                            <div className="flex-shrink-0 mt-0.5">
                              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                                {idx + 1}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              {q.text && (
                                <p className="text-sm text-foreground whitespace-pre-wrap">{q.text}</p>
                              )}
                              <div className="flex flex-wrap gap-2 mt-2">
                                {q.question_file && (
                                  <a
                                    href={q.question_file}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  >
                                    <Paperclip className="h-3 w-3" />
                                    {shortName(q.question_file)}
                                  </a>
                                )}
                                {q.image && (
                                  <a
                                    href={q.image}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  >
                                    <ImageIcon className="h-3 w-3" />
                                    Image
                                  </a>
                                )}
                                {(q.attachments || []).map(att => (
                                  <a
                                    key={att.id}
                                    href={att.file}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                  >
                                    <FilePlus2 className="h-3 w-3" />
                                    {att.name || shortName(att.file)}
                                  </a>
                                ))}
                                <Badge variant="secondary" className="text-xs">
                                  {q.marks} mark{q.marks !== 1 ? 's' : ''}
                                </Badge>
                              </div>
                            </div>
                            <div className="flex-shrink-0 flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => openEditQuestion(q)}
                              >
                                <Edit className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setDeleteQuestionId(q.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!testId && (
              <p className="text-xs text-muted-foreground text-center py-2">
                Save the test settings first, then you can add questions.
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="pt-4 border-t flex justify-between items-center">
            <div className="flex items-center gap-2">
              {testId && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
                  onClick={() => setIsDeleteTestOpen(true)}
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" />
                  Delete Assessment
                </Button>
              )}
              {questions.length > 0 && (
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-success" />
                  {questions.length} question{questions.length !== 1 ? 's' : ''} configured
                </span>
              )}
            </div>
            <Button variant="outline" onClick={onClose}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Add / Edit Question Modal ─────────────────────────────────────── */}
      <Dialog
        open={isQuestionModalOpen}
        onOpenChange={v => { if (!v) { setIsQuestionModalOpen(false); setQuestionErrors({}); } }}
      >
        <DialogContent
          className="sm:max-w-xl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{editingQuestionId ? 'Edit Question' : 'Add Question'}</DialogTitle>
            <DialogDescription>Fill in the question details and optionally attach files.</DialogDescription>
          </DialogHeader>

          {/* Scrollable body — fixed max height so dialog stays compact */}
          <div className="max-h-[62vh] overflow-y-auto space-y-4 px-1 py-1 scrollbar-hide">

            {/* Question text */}
            <div className="space-y-1.5">
              <Label htmlFor="q-text">
                Question Text
                <span className="ml-2 text-xs text-muted-foreground font-normal">(optional if you attach a file)</span>
              </Label>
              <Textarea
                id="q-text"
                value={editingQuestion.text}
                onChange={e => {
                  setEditingQuestion(prev => ({ ...prev, text: e.target.value }));
                  if (questionErrors.content) setQuestionErrors(p => ({ ...p, content: undefined }));
                }}
                placeholder="Type the question here…"
                rows={3}
                className={cn(
                  "bg-background/50 border-border focus:border-primary/50 transition-all resize-none",
                  questionErrors.content && "focus-visible:ring-destructive/40"
                )}
              />
              <FieldError msg={questionErrors.content} />
            </div>

            {/* Marks */}
            <div className="space-y-1.5">
              <Label htmlFor="q-marks">
                Marks <span className="text-destructive">*</span>
              </Label>
              <Input
                id="q-marks"
                type="number"
                min={0.5}
                step={0.5}
                value={editingQuestion.marks}
                onChange={e => {
                  setEditingQuestion(prev => ({ ...prev, marks: e.target.value }));
                  if (questionErrors.marks) setQuestionErrors(p => ({ ...p, marks: undefined }));
                }}
                className={cn(
                  "w-32 bg-background/50 border-border focus:border-primary/50 transition-all",
                  questionErrors.marks && "focus-visible:ring-destructive/40"
                )}
              />
              <FieldError msg={questionErrors.marks} />
            </div>

            <div className="border-t border-border/60 pt-3 space-y-2.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Attachments</p>

              {/* Question file (single, replaces) */}
              <div className="space-y-1">
                <Label className="text-xs">Question File <span className="text-muted-foreground font-normal">(.ipynb / .pdf / .doc / .docx)</span></Label>
                <div className="flex items-center gap-3 p-1 rounded-lg border border-border bg-background/30 h-10 w-full">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 hover:bg-muted text-xs px-3 gap-1.5"
                    onClick={() => questionFileRef.current?.click()}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    Choose File
                  </Button>
                  <span className="text-[11px] text-muted-foreground truncate flex-1 px-1">
                    {editingQuestion.question_file
                      ? editingQuestion.question_file.name
                      : (editingQuestion.question_file_url ? shortName(editingQuestion.question_file_url) : 'No file chosen')}
                  </span>
                  {editingQuestion.question_file && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground"
                      onClick={() => setEditingQuestion(prev => ({ ...prev, question_file: null }))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                  {!editingQuestion.question_file && editingQuestion.question_file_url && (
                    <>
                      <a
                        href={editingQuestion.question_file_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-muted"
                        title="Open existing file"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground shrink-0"
                        title="Remove file from question"
                        onClick={() =>
                          setEditingQuestion(prev => ({
                            ...prev,
                            question_file_url: null,
                            remove_question_file: editingQuestionId != null,
                          }))
                        }
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
                <input ref={questionFileRef} type="file" accept=".ipynb,.pdf,.doc,.docx" className="hidden"
                  onChange={e => {
                    setEditingQuestion(prev => ({
                      ...prev,
                      question_file: e.target.files?.[0] || null,
                      remove_question_file: false,
                    }));
                    if (questionErrors.content) setQuestionErrors(p => ({ ...p, content: undefined }));
                  }} />
              </div>

              {/* Image (single, replaces) */}
              <div className="space-y-1">
                <Label className="text-xs">Image <span className="text-muted-foreground font-normal">(.jpg / .png)</span></Label>
                <div className="flex items-center gap-3 p-1 rounded-lg border border-border bg-background/30 h-10 w-full">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 hover:bg-muted text-xs px-3 gap-1.5"
                    onClick={() => questionImageRef.current?.click()}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Choose Image
                  </Button>
                  <span className="text-[11px] text-muted-foreground truncate flex-1 px-1">
                    {editingQuestion.image
                      ? editingQuestion.image.name
                      : (editingQuestion.image_url ? shortName(editingQuestion.image_url) : 'No image chosen')}
                  </span>
                  {editingQuestion.image && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground"
                      onClick={() => setEditingQuestion(prev => ({ ...prev, image: null }))}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  )}
                  {!editingQuestion.image && editingQuestion.image_url && (
                    <>
                      <a
                        href={editingQuestion.image_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-muted"
                        title="Open existing image"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 text-muted-foreground shrink-0"
                        title="Remove image from question"
                        onClick={() =>
                          setEditingQuestion(prev => ({
                            ...prev,
                            image_url: null,
                            remove_image: editingQuestionId != null,
                          }))
                        }
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  )}
                </div>
                <input ref={questionImageRef} type="file" accept="image/jpeg,image/png" className="hidden"
                  onChange={e => {
                    setEditingQuestion(prev => ({
                      ...prev,
                      image: e.target.files?.[0] || null,
                      remove_image: false,
                    }));
                    if (questionErrors.content) setQuestionErrors(p => ({ ...p, content: undefined }));
                  }} />
              </div>

              {/* Multiple extra attachments */}
              <div className="space-y-1.5">
                <Label className="text-xs">
                  Extra Attachments
                  <span className="ml-1.5 text-muted-foreground font-normal">(.ipynb / .pdf / .xlsx / .csv / .doc…)</span>
                </Label>

                {/* Existing saved attachments */}
                {(editingQuestion.existingAttachments.length > 0 || editingQuestion.newAttachmentFiles.length > 0) && (
                  <div className="grid grid-cols-1 gap-1.5">
                    {editingQuestion.existingAttachments.map(att => (
                      <div key={att.id} className="group relative flex items-center gap-3 bg-background border border-border rounded-xl p-2.5 transition-all hover:border-primary/40">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/5 flex items-center justify-center border border-primary/10">
                          <FilePlus2 className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <a href={att.file} target="_blank" rel="noreferrer"
                            className="text-sm font-semibold text-foreground hover:text-primary transition-colors block truncate">
                            {att.name || shortName(att.file)}
                          </a>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-tight font-medium">Existing Attachment</p>
                        </div>
                        <button
                          type="button"
                          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-50"
                          disabled={deletingAttachmentIds.has(att.id)}
                          onClick={() => handleDeleteExistingAttachment(att.id)}
                        >
                          {deletingAttachmentIds.has(att.id)
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <X className="h-4 w-4" />}
                        </button>
                      </div>
                    ))}

                    {/* New queued attachments */}
                    {editingQuestion.newAttachmentFiles.map((file, idx) => (
                      <div key={idx} className="group relative flex items-center gap-3 bg-primary/[0.02] border border-primary/20 border-dashed rounded-xl p-2.5 transition-all hover:bg-primary/[0.04]">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                          <UploadCloud className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="text-sm font-semibold text-foreground block truncate">{file.name}</span>
                          <div className="flex items-center gap-2">
                             <Badge variant="secondary" className="text-[9px] h-3.5 px-1 font-bold bg-primary/10 text-primary border-none">NEW</Badge>
                             <span className="text-[10px] text-muted-foreground">{(file.size / 1024).toFixed(0)} KB</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors p-0.5"
                          onClick={() => handleRemoveNewAttachment(idx)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Styled Upload Area */}
                <div
                  className="group relative border-2 border-dashed border-muted-foreground/20 rounded-xl p-4 text-center transition-all hover:border-primary/40 hover:bg-primary/[0.02] cursor-pointer"
                  onClick={() => attachmentFileRef.current?.click()}
                >
                  <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-2 group-hover:bg-primary/10 transition-all">
                    <Paperclip className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">Click to add extra materials</p>
                    <p className="text-xs text-muted-foreground">Support for .pdf, .ipynb, .xlsx, etc.</p>
                  </div>
                </div>

                <input
                  ref={attachmentFileRef}
                  type="file"
                  multiple
                  accept=".ipynb,.pdf,.xlsx,.xls,.csv,.doc,.docx,.txt"
                  className="hidden"
                  onChange={e => {
                    handleAddNewAttachmentFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t">
            <Button
              variant="outline"
              onClick={() => { setIsQuestionModalOpen(false); setQuestionErrors({}); }}
            >
              Cancel
            </Button>
            <Button
              id="q-save-btn"
              variant="gradient"
              onClick={handleSaveQuestion}
              disabled={isSavingQuestion}
            >
              {isSavingQuestion && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingQuestionId ? 'Update Question' : 'Add Question'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete question confirm ───────────────────────────────────────── */}
      <AlertDialog open={deleteQuestionId !== null} onOpenChange={v => !v && setDeleteQuestionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this question?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the question and all its attachments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingQuestion}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteQuestion}
              disabled={isDeletingQuestion}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingQuestion && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete Question
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete TEST confirm ───────────────────────────────────────────── */}
      <AlertDialog open={isDeleteTestOpen} onOpenChange={v => !v && setIsDeleteTestOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this assessment?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the entire weekly assessment including all questions and attachments.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingTest}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteTest}
              disabled={isDeletingTest}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeletingTest && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Delete Assessment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

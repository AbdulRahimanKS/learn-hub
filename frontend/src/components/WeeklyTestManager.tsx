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
function shortName(url: string) {
  return url.split('/').pop()?.split('?')[0] || url;
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
        toast({ title: 'Test updated', variant: 'success' });
      } else {
        const res = await apiClient.post(`${testApiBase}/`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        setTestId(res.data?.data?.id ?? null);
        toast({ title: 'Test created', description: 'Now add questions below.', variant: 'success' });
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
      toast({ title: 'Assessment deleted', variant: 'success' });
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

    const hasContent =
      editingQuestion.text.trim().length > 0 ||
      editingQuestion.question_file !== null ||
      editingQuestion.image !== null ||
      editingQuestion.question_file_url !== null ||
      editingQuestion.image_url !== null ||
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
    setEditingQuestion({
      id: q.id,
      text: q.text,
      marks: String(q.marks),
      question_file: null,
      question_file_url: q.question_file,
      image: null,
      image_url: q.image,
      existingAttachments: q.attachments || [],
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
        await apiClient.patch(
          `${testApiBase}/questions/${editingQuestionId}/`,
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        toast({ title: 'Question updated', variant: 'success' });
      } else {
        const res = await apiClient.post(
          `${testApiBase}/questions/`,
          fd,
          { headers: { 'Content-Type': 'multipart/form-data' } }
        );
        savedQuestionId = res.data?.data?.id ?? null;
        toast({ title: 'Question added', variant: 'success' });
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
      await apiClient.delete(`${testApiBase}/questions/${deleteQuestionId}/`);
      toast({ title: 'Question removed', variant: 'success' });
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
      await apiClient.delete(`${testApiBase}/questions/${editingQuestionId}/attachments/${attachmentId}/`);
      setEditingQuestion(prev => ({
        ...prev,
        existingAttachments: prev.existingAttachments.filter(a => a.id !== attachmentId),
      }));
      toast({ title: 'Attachment removed', variant: 'success' });
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
            <DialogTitle className="flex items-center gap-2 text-xl">
              <BookOpen className="h-5 w-5 text-primary" />
              {existingTest ? 'Edit' : 'Create'} Weekly Assessment
            </DialogTitle>
            <DialogDescription>{weekLabel} — Configure the test and questions</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-1 space-y-6 py-2">

            {/* ── Test Settings Card ───────────────────────────────────────── */}
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <p className="text-sm font-semibold text-primary uppercase tracking-wide">Test Settings</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  {/* Title */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="wt-title">
                      Test Title <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="wt-title"
                      value={title}
                      onChange={e => {
                        setTitle(e.target.value);
                        if (headerErrors.title) setHeaderErrors(p => ({ ...p, title: undefined }));
                      }}
                      placeholder="e.g. Week 1 Assessment"
                      className={headerErrors.title ? 'border-destructive focus-visible:ring-destructive' : ''}
                    />
                    <FieldError msg={headerErrors.title} />
                  </div>

                  {/* Pass percentage */}
                  <div className="space-y-1.5">
                    <Label htmlFor="wt-pass">
                      Pass Percentage <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
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
                        className={`pr-8 ${headerErrors.pass_percentage ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                    </div>
                    <FieldError msg={headerErrors.pass_percentage} />
                  </div>

                  {/* Answer key — spans full width */}
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>
                      Answer Key{' '}
                      <span className="text-destructive">*</span>
                      <span className="ml-2 text-xs text-muted-foreground font-normal">(.pdf / .ipynb / .doc / .docx)</span>
                    </Label>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className={`gap-1.5 ${headerErrors.answer_key && !answerKeyFile && !existingTest?.answer_key ? 'border-destructive' : ''}`}
                        onClick={() => {
                          answerKeyRef.current?.click();
                          if (headerErrors.answer_key) setHeaderErrors(p => ({ ...p, answer_key: undefined }));
                        }}
                      >
                        <UploadCloud className="h-4 w-4" />
                        {answerKeyFile ? answerKeyFile.name : 'Upload File'}
                      </Button>
                      {answerKeyFile && (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          onClick={() => setAnswerKeyFile(null)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                      {!answerKeyFile && existingTest?.answer_key && (
                        <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                          Current: {shortName(existingTest.answer_key)}
                        </span>
                      )}
                    </div>
                    <FieldError msg={headerErrors.answer_key} />
                    <input
                      ref={answerKeyRef}
                      type="file"
                      accept=".pdf,.ipynb,.doc,.docx"
                      className="hidden"
                      onChange={e => {
                        setAnswerKeyFile(e.target.files?.[0] || null);
                        if (headerErrors.answer_key) setHeaderErrors(p => ({ ...p, answer_key: undefined }));
                      }}
                    />
                  </div>
                </div>

                {/* Instructions (optional) */}
                <div className="space-y-1.5">
                  <Label htmlFor="wt-instructions">
                    Instructions
                    <span className="ml-2 text-xs text-muted-foreground font-normal">optional</span>
                  </Label>
                  <Textarea
                    id="wt-instructions"
                    value={instructions}
                    onChange={e => setInstructions(e.target.value)}
                    placeholder="Optional instructions for students…"
                    rows={3}
                  />
                </div>

                <div className="flex justify-end">
                  <Button
                    id="wt-save-btn"
                    variant="gradient"
                    onClick={handleSaveHeader}
                    disabled={isSavingHeader}
                  >
                    {isSavingHeader && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    <Save className="h-4 w-4 mr-2" />
                    {testId ? 'Update Test' : 'Save Test & Add Questions'}
                  </Button>
                </div>
              </CardContent>
            </Card>

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
                                className="h-7 w-7 text-destructive hover:bg-destructive/10"
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
          className="sm:max-w-lg"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>{editingQuestionId ? 'Edit Question' : 'Add Question'}</DialogTitle>
            <DialogDescription>Fill in the question details and optionally attach files.</DialogDescription>
          </DialogHeader>

          {/* Scrollable body — fixed max height so dialog stays compact */}
          <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1 py-1">

            {/* Content error banner */}
            {questionErrors.content && (
              <div className="flex items-start gap-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2">
                <AlertCircle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                <p className="text-sm text-destructive">{questionErrors.content}</p>
              </div>
            )}

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
                className={questionErrors.content ? 'border-destructive focus-visible:ring-destructive' : ''}
              />
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
                className={`w-32 ${questionErrors.marks ? 'border-destructive focus-visible:ring-destructive' : ''}`}
              />
              <FieldError msg={questionErrors.marks} />
            </div>

            <div className="border-t border-border/60 pt-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Attachments</p>

              {/* Question file (single, replaces) */}
              <div className="space-y-1">
                <Label className="text-xs">Question File <span className="text-muted-foreground font-normal">(.ipynb / .pdf / .doc / .docx)</span></Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button" variant="outline" size="sm"
                    className={`gap-1.5 h-8 text-xs ${questionErrors.content && !editingQuestion.question_file && !editingQuestion.question_file_url ? 'border-destructive' : ''}`}
                    onClick={() => questionFileRef.current?.click()}
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                    {editingQuestion.question_file ? editingQuestion.question_file.name : 'Choose File'}
                  </Button>
                  {editingQuestion.question_file && (
                    <button type="button" className="text-muted-foreground hover:text-destructive"
                      onClick={() => setEditingQuestion(prev => ({ ...prev, question_file: null }))}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {!editingQuestion.question_file && editingQuestion.question_file_url && (
                    <a href={editingQuestion.question_file_url} target="_blank" rel="noreferrer"
                      className="flex items-center gap-1 text-xs text-primary hover:underline max-w-[180px] truncate">
                      <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      {shortName(editingQuestion.question_file_url)}
                    </a>
                  )}
                </div>
                <input ref={questionFileRef} type="file" accept=".ipynb,.pdf,.doc,.docx" className="hidden"
                  onChange={e => {
                    setEditingQuestion(prev => ({ ...prev, question_file: e.target.files?.[0] || null }));
                    if (questionErrors.content) setQuestionErrors(p => ({ ...p, content: undefined }));
                  }} />
              </div>

              {/* Image (single, replaces) */}
              <div className="space-y-1">
                <Label className="text-xs">Image <span className="text-muted-foreground font-normal">(.jpg / .png)</span></Label>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button" variant="outline" size="sm"
                    className={`gap-1.5 h-8 text-xs ${questionErrors.content && !editingQuestion.image && !editingQuestion.image_url ? 'border-destructive' : ''}`}
                    onClick={() => questionImageRef.current?.click()}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    {editingQuestion.image ? editingQuestion.image.name : 'Choose Image'}
                  </Button>
                  {editingQuestion.image && (
                    <button type="button" className="text-muted-foreground hover:text-destructive"
                      onClick={() => setEditingQuestion(prev => ({ ...prev, image: null }))}>
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                  {!editingQuestion.image && editingQuestion.image_url && (
                    <img src={editingQuestion.image_url} alt="current"
                      className="h-8 w-8 object-cover rounded border border-border" />
                  )}
                </div>
                <input ref={questionImageRef} type="file" accept="image/jpeg,image/png" className="hidden"
                  onChange={e => {
                    setEditingQuestion(prev => ({ ...prev, image: e.target.files?.[0] || null }));
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
                {editingQuestion.existingAttachments.length > 0 && (
                  <ul className="space-y-1">
                    {editingQuestion.existingAttachments.map(att => (
                      <li key={att.id} className="flex items-center gap-2 bg-muted/40 rounded px-2 py-1">
                        <FilePlus2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        <a href={att.file} target="_blank" rel="noreferrer"
                          className="text-xs text-primary hover:underline flex-1 truncate">
                          {att.name || shortName(att.file)}
                        </a>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive flex-shrink-0 disabled:opacity-50"
                          disabled={deletingAttachmentIds.has(att.id)}
                          onClick={() => handleDeleteExistingAttachment(att.id)}
                        >
                          {deletingAttachmentIds.has(att.id)
                            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : <X className="h-3.5 w-3.5" />}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* New queued attachments */}
                {editingQuestion.newAttachmentFiles.length > 0 && (
                  <ul className="space-y-1">
                    {editingQuestion.newAttachmentFiles.map((file, idx) => (
                      <li key={idx} className="flex items-center gap-2 bg-primary/5 border border-primary/20 rounded px-2 py-1">
                        <FilePlus2 className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                        <span className="text-xs flex-1 truncate">{file.name}</span>
                        <Badge variant="secondary" className="text-[10px] py-0 px-1">new</Badge>
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive flex-shrink-0"
                          onClick={() => handleRemoveNewAttachment(idx)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                {/* Upload button */}
                <Button
                  type="button" variant="outline" size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => attachmentFileRef.current?.click()}
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                  Add File(s)
                </Button>
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

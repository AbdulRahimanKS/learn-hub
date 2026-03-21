import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
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
import {
  Plus,
  Trash2,
  Edit,
  Loader2,
  CheckCircle,
  HelpCircle,
  AlertCircle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { PostSessionQuestion, PostSessionChoice, ClassSession } from '@/lib/course-module-api';

interface SessionMcqManagerProps {
  open: boolean;
  onClose: () => void;
  session: ClassSession | null;
  /** e.g. "/api/courses/v1/courses/1/weeks/2/sessions/3/mcq" — NO trailing slash */
  apiBaseUrl: string;
  onSaved: () => void;
  readOnly?: boolean;
}

interface ChoiceFormState {
  id?: number;
  text: string;
  is_correct: boolean;
}

interface QuestionFormState {
  id?: number;
  text: string;
  is_fill_in_the_blank: boolean;
  order: string;
  choices: ChoiceFormState[];
}

const emptyChoice = (): ChoiceFormState => ({ text: '', is_correct: false });

const emptyQuestion = (): QuestionFormState => ({
  text: '',
  is_fill_in_the_blank: false,
  order: '1',
  choices: [emptyChoice(), emptyChoice(), emptyChoice(), emptyChoice()],
});

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return (
    <p className="flex items-center gap-1 text-xs text-destructive mt-1">
      <AlertCircle className="h-3 w-3 flex-shrink-0" />
      {msg}
    </p>
  );
}

export function SessionMcqManager({
  open,
  onClose,
  session,
  apiBaseUrl,
  onSaved,
  readOnly = false,
}: SessionMcqManagerProps) {
  const { toast } = useToast();

  const [questions, setQuestions] = useState<PostSessionQuestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Question Form State
  const [isQuestionModalOpen, setIsQuestionModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<QuestionFormState>(emptyQuestion());
  const [editingQuestionId, setEditingQuestionId] = useState<number | null>(null);
  const [isSavingQuestion, setIsSavingQuestion] = useState(false);
  const [deleteQuestionId, setDeleteQuestionId] = useState<number | null>(null);
  const [isDeletingQuestion, setIsDeletingQuestion] = useState(false);

  const [errors, setErrors] = useState<{ text?: string; order?: string; choices?: string }>({});

  useEffect(() => {
    if (open && session) {
      fetchQuestions();
    }
  }, [open, session]);

  const fetchQuestions = async () => {
    if (!session || !apiBaseUrl) return;
    setIsLoading(true);
    try {
      const res = await apiClient.get(`${apiBaseUrl}/`);
      setQuestions(res.data?.data || []);
    } catch {
      toast({ title: 'Error', description: 'Failed to load questions.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const validateQuestionForm = () => {
    const errs: typeof errors = {};
    if (!editingQuestion.text.trim()) {
      errs.text = 'Question text is required.';
    } else if (editingQuestion.is_fill_in_the_blank && !editingQuestion.text.includes('[blank]')) {
      errs.text = 'Question text must contain \`[blank]\`.';
    }
    const orderNum = Number(editingQuestion.order);
    if (isNaN(orderNum) || orderNum <= 0) {
      errs.order = 'Valid order number required.';
    }

    const validChoices = editingQuestion.choices.filter(c => c.text.trim() !== '');

    if (!editingQuestion.is_fill_in_the_blank) {
      if (validChoices.length < 2) {
        errs.choices = 'Provide at least two valid options.';
      } else {
        const correctCount = validChoices.filter(c => c.is_correct).length;
        if (correctCount !== 1) {
          errs.choices = 'Exactly one option must be marked as correct.';
        }
      }
    } else {
      if (validChoices.length < 1) {
        errs.choices = 'Provide at least one correct acceptable answer.';
      }
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSaveQuestion = async () => {
    if (readOnly) return;
    if (!validateQuestionForm() || !apiBaseUrl) return;
    setIsSavingQuestion(true);

    try {
      // payload
      const payload = {
        text: editingQuestion.text,
        is_fill_in_the_blank: editingQuestion.is_fill_in_the_blank,
        order: Number(editingQuestion.order) || 1,
        choices: editingQuestion.choices.filter(c => c.text.trim() !== '').map(c => ({
            text: c.text,
            is_correct: editingQuestion.is_fill_in_the_blank ? true : c.is_correct
          }))
      };

      if (editingQuestionId) {
        await apiClient.patch(`${apiBaseUrl}/${editingQuestionId}/`, payload);
        toast({ title: 'Success', description: 'Question updated', variant: 'success' });
      } else {
        await apiClient.post(`${apiBaseUrl}/`, payload);
        toast({ title: 'Success', description: 'Question added', variant: 'success' });
      }

      setIsQuestionModalOpen(false);
      fetchQuestions();
      onSaved();
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

  const handleDeleteQuestion = async () => {
    if (readOnly) return;
    if (!deleteQuestionId || !apiBaseUrl) return;
    setIsDeletingQuestion(true);
    try {
      await apiClient.delete(`${apiBaseUrl}/${deleteQuestionId}/`);
      toast({ title: 'Deleted', description: 'Question removed', variant: 'success' });
      setDeleteQuestionId(null);
      fetchQuestions();
      onSaved();
    } catch {
      toast({ title: 'Error', description: 'Failed to delete question.', variant: 'destructive' });
    } finally {
      setIsDeletingQuestion(false);
    }
  };

  const openAddQuestion = () => {
    if (readOnly) return;
    setEditingQuestion({
      ...emptyQuestion(),
      order: String(questions.length + 1)
    });
    setEditingQuestionId(null);
    setErrors({});
    setIsQuestionModalOpen(true);
  };

  const openEditQuestion = (q: PostSessionQuestion) => {
    if (readOnly) return;
    const defaultChoices: ChoiceFormState[] = [...q.choices];
    while (defaultChoices.length < 4) {
      defaultChoices.push(emptyChoice());
    }

    setEditingQuestion({
      id: q.id,
      text: q.text,
      is_fill_in_the_blank: q.is_fill_in_the_blank,
      order: String(q.order),
      choices: defaultChoices,
    });
    setEditingQuestionId(q.id);
    setErrors({});
    setIsQuestionModalOpen(true);
  };

  const updateChoice = (idx: number, updates: Partial<ChoiceFormState>) => {
    const updated = [...editingQuestion.choices];
    if (!editingQuestion.is_fill_in_the_blank && updates.is_correct === true) {
      // MCQ mode supports exactly one correct option.
      for (let i = 0; i < updated.length; i++) {
        updated[i] = { ...updated[i], is_correct: i === idx };
      }
    } else {
      updated[idx] = { ...updated[idx], ...updates };
    }
    setEditingQuestion(p => ({ ...p, choices: updated }));
    if (errors.choices) setErrors(e => ({ ...e, choices: undefined }));
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="sm:max-w-2xl max-h-[92vh] flex flex-col overflow-hidden" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Post-Session MCQs</DialogTitle>
            <DialogDescription>
              {session ? `Manage interactive questions for "${session.title}"` : 'Manage Session Questions'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto px-1 space-y-6 py-2 scrollbar-hide">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base">Questions ({questions.length})</h3>
                <p className="text-xs text-muted-foreground">Optional queries shown after this video snippet</p>
                {readOnly && (
                  <p className="text-xs text-amber-600 mt-1">Week is unlocked. Editing is disabled.</p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={openAddQuestion} disabled={readOnly}>
                <Plus className="h-4 w-4 mr-1.5" />
                Add Question
              </Button>
            </div>

            {isLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="animate-spin h-6 w-6 text-primary" />
              </div>
            ) : questions.length === 0 ? (
              <div className="border border-dashed border-border rounded-xl p-8 text-center bg-muted/10">
                <HelpCircle className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No MCQs added yet. Consider adding a few self-practice questions.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {[...questions].sort((a, b) => a.order - b.order).map((q, idx) => (
                  <Card key={q.id} className="border-border/60">
                    <CardContent className="p-4 flex gap-3">
                      <div className="mt-0.5">
                        <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                          {q.order || idx + 1}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{q.text}</p>
                        <div className="mt-2 space-y-1">
                          {q.is_fill_in_the_blank ? (
                            <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">Fill-in-the-blank format</span>
                          ) : (
                            q.choices.map((c, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                {c.is_correct ? <CheckCircle className="h-3 w-3 text-success" /> : <div className="h-3 w-3 rounded-full border border-muted-foreground/30" />}
                                <span className={c.is_correct ? 'font-semibold text-foreground' : 'text-muted-foreground'}>{c.text}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditQuestion(q)} disabled={readOnly}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteQuestionId(q.id)} disabled={readOnly}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
          <div className="pt-4 border-t flex justify-end">
            <Button variant="outline" onClick={onClose}>Done</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* QUESTION MODAL */}
      <Dialog open={isQuestionModalOpen} onOpenChange={v => { if (!v) setIsQuestionModalOpen(false) }}>
        <DialogContent className="sm:max-w-md" onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editingQuestionId ? 'Edit Question' : 'Add Question'}</DialogTitle>
            <DialogDescription>Define an MCQ or fill-in-the-blank question.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 px-1 py-3">
            <div className="space-y-1.5">
              <Label>Question Text <span className="text-destructive">*</span></Label>
              <Textarea
                placeholder={editingQuestion.is_fill_in_the_blank ? 'e.g., The powerhouse of the cell is [blank].' : 'e.g., What is the powerhouse of the cell?'}
                value={editingQuestion.text}
                onChange={e => {
                  setEditingQuestion(p => ({ ...p, text: e.target.value }));
                  if (errors.text) setErrors(p => ({ ...p, text: undefined }));
                }}
                className={errors.text ? 'border-destructive' : ''}
                disabled={readOnly}
              />
              <FieldError msg={errors.text} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Order</Label>
                <Input
                  type="number"
                  value={editingQuestion.order}
                  onChange={e => {
                    setEditingQuestion(p => ({ ...p, order: e.target.value }));
                    if (errors.order) setErrors(p => ({ ...p, order: undefined }));
                  }}
                  className={errors.order ? 'border-destructive' : ''}
                  disabled={readOnly}
                />
                <FieldError msg={errors.order} />
              </div>
              <div className="space-y-1.5 flex flex-col justify-end">
                <Label className="mb-2">Format</Label>
                <div className="flex items-center space-x-2 h-10 border rounded-md px-3 bg-muted/30">
                  <Switch
                    checked={editingQuestion.is_fill_in_the_blank}
                    onCheckedChange={checked => setEditingQuestion(p => ({ ...p, is_fill_in_the_blank: checked }))}
                    disabled={!!editingQuestionId || readOnly}
                  />
                  <Label className="text-xs font-normal cursor-pointer">Fill-in-the-blank</Label>
                </div>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <Label>
                {editingQuestion.is_fill_in_the_blank ? 'Acceptable Correct Answers' : 'Options'} <span className="text-xs text-muted-foreground font-normal">(Leave empty to omit)</span>
              </Label>
              
              {editingQuestion.choices.map((choice, idx) => (
                <div key={idx} className="flex flex-row items-center gap-2">
                  <Input
                    placeholder={editingQuestion.is_fill_in_the_blank ? `Acceptable Answer ${idx + 1}` : `Option ${idx + 1}`}
                    className="flex-1"
                    value={choice.text}
                    onChange={e => updateChoice(idx, { text: e.target.value })}
                    disabled={readOnly}
                  />
                  {!editingQuestion.is_fill_in_the_blank && (
                    <div className="flex items-center gap-2 px-2">
                      <Switch
                        checked={choice.is_correct}
                        onCheckedChange={checked => updateChoice(idx, { is_correct: checked })}
                        disabled={readOnly}
                      />
                      <span className="text-xs w-12">{choice.is_correct ? 'Correct' : ''}</span>
                    </div>
                  )}
                </div>
              ))}
              
              <div className="flex flex-col items-start mt-2 gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setEditingQuestion(p => ({ ...p, choices: [...p.choices, emptyChoice()] }))}
                  disabled={readOnly}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add {editingQuestion.is_fill_in_the_blank ? 'Answer' : 'Option'}
                </Button>
                <FieldError msg={errors.choices} />
              </div>
            </div>
            
            {editingQuestion.is_fill_in_the_blank && (
               <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm text-muted-foreground">
                 <strong>How it works:</strong> Type <code>[blank]</code> anywhere in your question text. When students take the test, the <code>[blank]</code> will be replaced with a text input field. Compare their input against the acceptable answers you add above.
               </div>
            )}
          </div>
          <div className="pt-3 border-t flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setIsQuestionModalOpen(false)}>Cancel</Button>
            <Button variant="gradient" disabled={isSavingQuestion || readOnly} onClick={handleSaveQuestion}>
              {isSavingQuestion && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {readOnly ? 'Read Only' : 'Save Question'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteQuestionId} onOpenChange={(open) => !open && setDeleteQuestionId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete this question? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteQuestion} disabled={isDeletingQuestion || readOnly}>
              {isDeletingQuestion ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

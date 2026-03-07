import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ChevronLeft,
  Plus,
  Trash2,
  Edit,
  Loader2,
  FileText,
  HelpCircle,
} from 'lucide-react';
import { batchContentApi } from '@/lib/batch-api';
import { useToast } from '@/hooks/use-toast';

export default function BatchTestManagement() {
  const { batchId, weekId } = useParams<{ batchId: string; weekId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [questions, setQuestions] = useState<any[]>([]);
  const [test, setTest] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    question_text: '',
    question_type: 'subjective',
  });

  const fetchData = async () => {
    if (!batchId || !weekId) return;
    setLoading(true);
    try {
      const [testRes, questRes] = await Promise.all([
        batchContentApi.getWeeklyTest(parseInt(batchId), parseInt(weekId)),
        batchContentApi.getTestQuestions(parseInt(batchId), parseInt(weekId))
      ]);
      if (testRes.success) setTest(testRes.data);
      if (questRes.success) setQuestions(questRes.data);
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to load test data', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [batchId, weekId]);

  const handleOpenModal = (question?: any) => {
    if (question) {
      setEditingQuestion(question);
      setFormData({
        question_text: question.question_text,
        question_type: question.question_type,
      });
    } else {
      setEditingQuestion(null);
      setFormData({
        question_text: '',
        question_type: 'subjective',
      });
    }
    setIsModalOpen(true);
  };

  const handleSaveQuestion = async () => {
    if (!batchId || !weekId) return;
    setIsSaving(true);
    try {
      if (editingQuestion) {
        await batchContentApi.updateTestQuestion(parseInt(batchId), parseInt(weekId), editingQuestion.id, formData);
      } else {
        await batchContentApi.addTestQuestion(parseInt(batchId), parseInt(weekId), formData);
      }
      toast({ title: 'Success', description: 'Question saved' });
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to save question', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteQuestion = async (id: number) => {
    if (!batchId || !weekId || !confirm('Delete this question?')) return;
    try {
      await batchContentApi.deleteTestQuestion(parseInt(batchId), parseInt(weekId), id);
      toast({ title: 'Success', description: 'Question removed' });
      fetchData();
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to delete question', variant: 'destructive' });
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => navigate(`/admin/batches/${batchId}/content`)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              {test?.title || 'Manage Test Questions'}
            </h1>
            <p className="text-sm text-muted-foreground">Customize questions for this batch weekly test</p>
          </div>
          <Button className="ml-auto" onClick={() => handleOpenModal()}>
            <Plus className="h-4 w-4 mr-2" />
            Add Question
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-4">
            {questions.length === 0 ? (
              <Card className="border-dashed py-12 text-center">
                <HelpCircle className="h-12 w-12 mx-auto mb-4 opacity-10" />
                <p className="text-muted-foreground">No questions added yet.</p>
                <Button variant="link" onClick={() => handleOpenModal()}>Add your first question</Button>
              </Card>
            ) : (
              questions.map((q, idx) => (
                <Card key={q.id}>
                  <CardHeader className="flex flex-row items-start justify-between p-4 pb-2">
                    <CardTitle className="text-base font-semibold">Question {idx + 1}</CardTitle>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenModal(q)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteQuestion(q.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <p className="text-foreground whitespace-pre-wrap">{q.question_text}</p>
                    <div className="mt-2 text-xs text-muted-foreground uppercase font-bold tracking-wider">
                      Type: {q.question_type}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        )}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent onOpenAutoFocus={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{editingQuestion ? 'Edit Question' : 'Add Question'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Question Text</Label>
              <Textarea 
                value={formData.question_text} 
                onChange={e => setFormData({...formData, question_text: e.target.value})}
                placeholder="Enter the question contents..."
                rows={5}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="gradient" onClick={handleSaveQuestion} disabled={isSaving || !formData.question_text}>
              {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Save Question
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

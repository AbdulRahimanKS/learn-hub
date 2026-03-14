import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import {
  Clock,
  Calendar,
  Search,
  FileText,
  CheckCircle,
  AlertCircle,
  Eye,
  Users,
  LayoutGrid,
  ChevronRight,
  Loader2,
  Filter,
} from 'lucide-react';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { SubmissionReviewModal } from '@/components/SubmissionReviewModal';
import { WeeklyTestResults } from '@/components/WeeklyTestResults';
import { WeeklyTestSubmission } from '@/components/WeeklyTestSubmission';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

const mockAssessments = {
  weekly: [
    { id: 4, title: 'Week 1 Assessment', week: 1, questions: 20, submissions: 48, avgScore: 72, passingScore: 70, dueDate: 'Jan 28, 2026', status: 'completed' },
    { id: 5, title: 'Week 2 Assessment', week: 2, questions: 25, submissions: 32, avgScore: 68, passingScore: 70, dueDate: 'Feb 4, 2026', status: 'active' },
    { id: 6, title: 'Week 3 Assessment', week: 3, questions: 20, submissions: 0, avgScore: 0, passingScore: 70, dueDate: 'Feb 11, 2026', status: 'scheduled' },
  ],
  pendingReview: [
    { id: 1, student: 'Alex Thompson', assessment: 'Week 2 Assessment', submittedAt: '2 hours ago', autoScore: 85 },
    { id: 2, student: 'Maria Garcia', assessment: 'Week 2 Assessment', submittedAt: '3 hours ago', autoScore: 78 },
    { id: 3, student: 'John Smith', assessment: 'Week 2 Assessment', submittedAt: '5 hours ago', autoScore: 92 },
  ],
};

const studentAssessments = [
  { id: 3, title: 'Week 1 Assessment', type: 'weekly', score: 78, maxScore: 100, status: 'completed', feedback: 'Good overall performance. Review file handling concepts.' },
  { id: 5, title: 'Week 2 Assessment', type: 'weekly', score: null, maxScore: 100, status: 'available', dueDate: 'Feb 4, 2026' },
];

export default function Assessments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Review Modal State
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Student Results Modal State
  const [viewingSubmission, setViewingSubmission] = useState<any>(null);
  const [isResultsOpen, setIsResultsOpen] = useState(false);

  // Retake State
  const [isSubmissionOpen, setIsSubmissionOpen] = useState(false);
  const [retakeTest, setRetakeTest] = useState<any>(null);
  const [selectedWeekId, setSelectedWeekId] = useState<number | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);

  useEffect(() => {
    if (user?.role === 'student') {
      fetchStudentSubmissions();
    } else {
      fetchBatches();
    }
  }, [user]);

  useEffect(() => {
    if (selectedBatch) {
      fetchBatchSubmissions(selectedBatch);
    }
  }, [selectedBatch]);

  const fetchBatches = async () => {
    try {
      const res = await apiClient.get('/api/courses/v1/batches/');
      if (res.data?.success) {
        setBatches(res.data.data);
        if (res.data.data.length > 0) {
          setSelectedBatch(res.data.data[0].id.toString());
        }
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch batches.', variant: 'destructive' });
    }
  };

  const fetchBatchSubmissions = async (batchId: string) => {
    setIsLoading(true);
    try {
      const res = await apiClient.get(`/api/courses/v1/batches/${batchId}/test-submissions/`);
      if (res.data?.success) {
        setSubmissions(res.data.data);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch submissions.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStudentSubmissions = async () => {
    setIsLoading(true);
    try {
      // Assuming a generic endpoint for student's own submissions exists or we use filtering
      const res = await apiClient.get('/api/courses/v1/test-submissions/my-submissions/');
      if (res.data?.success) {
        setSubmissions(res.data.data);
      }
    } catch (err) {
      // If endpoint doesn't exist yet, we'll handle gracefully
      console.error("Failed to fetch student submissions");
    } finally {
      setIsLoading(false);
    }
  };

  const pendingCount = submissions.filter(s => s.status === 'pending_review' || s.status === 'evaluating').length;
  const publishedCount = submissions.filter(s => s.status === 'published').length;

  const AdminAssessments = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <div className="space-y-1">
          <h1 className="font-black text-4xl text-slate-900 tracking-tight">Assessments</h1>
          <p className="text-slate-500 font-medium">Evaluate and manage student test submissions across batches.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative group">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-hover:text-primary transition-colors" />
            <select 
              value={selectedBatch}
              onChange={(e) => setSelectedBatch(e.target.value)}
              className="pl-10 pr-10 py-3 bg-slate-50 border-slate-200 rounded-2xl text-sm font-bold text-slate-700 outline-none focus:ring-4 focus:ring-primary/10 transition-all appearance-none min-w-[240px]"
            >
              <option value="" disabled>Select a Batch</option>
              {batches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
            <ChevronRight className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 rotate-90 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 sm:grid-cols-3">
        {[
          { label: 'Total Submissions', value: submissions.length, icon: FileText, color: 'primary' },
          { label: 'Pending Review', value: pendingCount, icon: AlertCircle, color: 'amber' },
          { label: 'Evaluated', value: publishedCount, icon: CheckCircle, color: 'emerald' }
        ].map((stat, i) => (
          <Card key={i} className="border-none shadow-xl shadow-slate-200/50 overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex items-center gap-5">
                <div className={cn(
                  "p-4 rounded-2xl transition-transform group-hover:scale-110 duration-300",
                  stat.color === 'primary' ? "bg-primary/10 text-primary" :
                  stat.color === 'amber' ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"
                )}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-3xl font-black text-slate-900 leading-tight">{stat.value}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="review" className="space-y-8">
        <TabsList className="bg-slate-100/50 p-1.5 rounded-2xl border border-slate-200/60 w-fit h-auto backdrop-blur-sm">
          <TabsTrigger value="review" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md transition-all">
            Pending Review
            {pendingCount > 0 && <Badge className="ml-2 bg-amber-500 hover:bg-amber-600">{pendingCount}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="published" className="rounded-xl px-6 py-2.5 font-bold data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-md transition-all">
            Published Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="mt-0">
          <div className="grid gap-4">
            {isLoading ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="font-bold text-sm uppercase tracking-widest">Loading Submissions...</p>
              </div>
            ) : submissions.filter(s => s.status !== 'published').length === 0 ? (
              <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center space-y-4">
                <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-slate-300">
                  <CheckCircle className="h-10 w-10" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">All caught up!</h3>
                  <p className="text-slate-500 max-w-xs mx-auto mt-1 font-medium">No pending submissions found for the selected batch.</p>
                </div>
              </div>
            ) : (
              submissions.filter(s => s.status !== 'published').map((item) => (
                <Card key={item.id} className="border-none shadow-lg shadow-slate-200/40 group hover:shadow-xl transition-all duration-300 overflow-hidden">
                  <CardContent className="p-0">
                    <div className="flex flex-col md:flex-row md:items-center">
                      <div className="flex-1 p-6 flex items-center gap-5">
                        <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center border border-white shadow-inner group-hover:scale-105 transition-transform">
                          <span className="text-xl font-black text-slate-400">{item.student_name?.charAt(0)}</span>
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-black text-lg text-slate-900 group-hover:text-primary transition-colors">{item.student_name}</h3>
                          <div className="flex items-center gap-3 text-xs font-bold text-slate-400 uppercase tracking-tight">
                            <span>Week {item.week_number} • {item.test_title}</span>
                            <span className="h-1 w-1 rounded-full bg-slate-300" />
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(item.submitted_at), 'MMM d, h:mm a')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="p-6 bg-slate-50/50 flex items-center justify-between md:justify-end gap-10 md:min-w-[300px]">
                        <div className="text-center md:text-right">
                          <p className="text-xs font-black uppercase text-slate-400 tracking-wider mb-1">AI Suggestion</p>
                          <div className="flex items-center justify-end gap-2">
                             {item.status === 'evaluating' ? (
                               <Badge className="bg-primary/10 text-primary border-none animate-pulse">Processing...</Badge>
                             ) : (
                               <p className="text-2xl font-black text-slate-800">{item.marks_obtained?.toFixed(1) || '0.0'}%</p>
                             )}
                          </div>
                        </div>
                        <Button 
                          variant="gradient" 
                          size="lg" 
                          className="font-black uppercase tracking-wider rounded-2xl shadow-lg shadow-primary/20"
                          onClick={() => {
                            setReviewId(item.id);
                            setIsReviewOpen(true);
                          }}
                        >
                          Review Entry
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="published">
           <div className="grid gap-4">
              {submissions.filter(s => s.status === 'published').map((item) => (
                <Card key={item.id} className="border-border/50 shadow-sm opacity-80 hover:opacity-100 transition-opacity">
                   <CardContent className="p-5 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
                           {item.student_name?.charAt(0)}
                        </div>
                        <div>
                           <p className="font-bold text-slate-900">{item.student_name}</p>
                           <p className="text-xs text-slate-500">Score: {item.marks_obtained}% • Week {item.week_number}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => { setReviewId(item.id); setIsReviewOpen(true); }}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                   </CardContent>
                </Card>
              ))}
           </div>
        </TabsContent>
      </Tabs>
    </div>
  );

  const handleRetake = async (submission: any) => {
    setIsLoading(true);
    try {
      const batchId = submission.enrollment_batch_id || submission.batch_id; 
      const weekId = submission.batch_week_id; 
      
      const res = await apiClient.get(`/api/courses/v1/batches/${batchId}/weeks/${weekId}/test/`);
      if (res.data?.success) {
        setRetakeTest(res.data.data);
        setSelectedWeekId(weekId);
        setSelectedBatchId(batchId);
        setIsSubmissionOpen(true);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch test details for retake.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const StudentAssessments = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="bg-white p-8 rounded-3xl border border-slate-100 shadow-sm">
        <h1 className="font-black text-4xl text-slate-900 tracking-tight">My Results</h1>
        <p className="text-slate-500 font-medium">Track your performance and review instructor feedback.</p>
      </div>

      {submissions.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-slate-200 rounded-3xl p-20 text-center space-y-4">
          <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 text-slate-300">
            <LayoutGrid className="h-10 w-10" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-slate-900">No assessments yet</h3>
            <p className="text-slate-500 max-w-xs mx-auto mt-1 font-medium">Start learning and completing lessons to unlock your assessments.</p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {submissions.map((assessment) => (
            <Card key={assessment.id} className="border-none shadow-lg shadow-slate-200/40 group overflow-hidden">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row md:items-center">
                  <div className="flex-1 p-6 flex items-start gap-4">
                    <div className={cn(
                      "p-4 rounded-2xl shrink-0",
                      assessment.status === 'published' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                    )}>
                      {assessment.status === 'published' ? (
                        <CheckCircle className="h-6 w-6" />
                      ) : (
                        <Clock className="h-6 w-6" />
                      )}
                    </div>
                    <div>
                      <h3 className="font-black text-lg text-slate-900">{assessment.test_title}</h3>
                      <div className="flex items-center gap-3 mt-2">
                         <Badge variant="outline" className="border-slate-200 text-slate-400 font-bold text-[10px] uppercase">
                           Week {assessment.week_number}
                         </Badge>
                         <span className="text-xs text-slate-400 font-bold uppercase tracking-tight">
                           Attempt {assessment.attempt_number}
                         </span>
                      </div>
                      {assessment.grader_remarks && assessment.status === 'published' && (
                        <p className="text-sm text-slate-500 mt-4 leading-relaxed font-medium line-clamp-2 italic">
                          "{assessment.grader_remarks}"
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="p-6 bg-slate-50/50 flex items-center justify-between md:justify-end gap-10 md:min-w-[280px]">
                    {assessment.status === 'published' ? (
                      <div className="text-center md:text-right">
                        <p className="text-3xl font-black text-slate-900">{assessment.marks_obtained}%</p>
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Your Score</p>
                      </div>
                    ) : (
                      <div className="text-center md:text-right">
                        <Badge className={cn(
                          "font-black uppercase text-[10px] py-1 px-3",
                          assessment.status === 'returned' ? "bg-rose-500 hover:bg-rose-600 shadow-lg shadow-rose-200" : "bg-amber-500 hover:bg-amber-600"
                        )}>
                          {assessment.status.replace('_', ' ')}
                        </Badge>
                        {assessment.status === 'returned' && (
                          <p className="text-[9px] font-bold text-rose-400 uppercase mt-1">Please retake</p>
                        )}
                      </div>
                    )}
                    <Button 
                      variant={assessment.status === 'published' ? 'outline' : 'gradient'} 
                      size="lg"
                      className="font-black uppercase tracking-wider rounded-2xl"
                      onClick={() => {
                        setViewingSubmission(assessment);
                        setIsResultsOpen(true);
                      }}
                    >
                      {assessment.status === 'published' ? 'View Feedback' : 'Details'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );


  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto py-6 px-4 sm:px-6 lg:px-8 bg-slate-50/30 min-h-screen pb-20">
        {user?.role === 'student' ? <StudentAssessments /> : <AdminAssessments />}
        
        {/* Admin Review Modal */}
        {reviewId && (
          <SubmissionReviewModal 
            open={isReviewOpen}
            onClose={() => { setReviewId(null); setIsReviewOpen(false); }}
            submissionId={reviewId}
            onUpdated={() => {
              if (selectedBatch) fetchBatchSubmissions(selectedBatch);
            }}
          />
        )}

        {/* Student Results Modal (Re-using from student view) */}
        {viewingSubmission && (
          <WeeklyTestResults
            open={isResultsOpen}
            onClose={() => { setViewingSubmission(null); setIsResultsOpen(false); }}
            submission={viewingSubmission}
            testTitle={viewingSubmission.test_title}
            onRetake={() => handleRetake(viewingSubmission)}
          />
        )}

        {/* Retake Submission Modal */}
        {retakeTest && selectedBatchId && selectedWeekId && (
          <WeeklyTestSubmission
            open={isSubmissionOpen}
            onClose={() => { setIsSubmissionOpen(false); setRetakeTest(null); }}
            test={retakeTest}
            batchId={selectedBatchId}
            weekId={selectedWeekId}
            onSubmitted={() => {
              fetchStudentSubmissions();
            }}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

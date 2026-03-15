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
  Award,
  TrendingUp,
  BookOpen,
  Zap,
  Edit3,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { SubmissionReviewModal } from '@/components/SubmissionReviewModal';
import { WeeklyTestResults } from '@/components/WeeklyTestResults';
import { WeeklyTestSubmission } from '@/components/WeeklyTestSubmission';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function Assessments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  // Filters & Pagination
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTab, setActiveTab] = useState('review');
  const [stats, setStats] = useState({ total: 0, pending: 0, published: 0 });
  const [batchWeeks, setBatchWeeks] = useState<any[]>([]);
  
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
  const [evaluatingIds, setEvaluatingIds] = useState<number[]>([]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    fetchBatches();
  }, [user]);

  useEffect(() => {
    if (user?.role === 'student') {
      fetchStudentSubmissions(currentPage, selectedWeek, selectedBatch);
    }
  }, [currentPage, selectedWeek, selectedBatch, user]);

  useEffect(() => {
    if (selectedBatch) {
      if (user?.role !== 'student') {
        fetchBatchSubmissions(selectedBatch, currentPage, selectedWeek);
      }
      fetchBatchWeeks(selectedBatch);
    }
  }, [selectedBatch, currentPage, selectedWeek, user]);

  const fetchBatches = async () => {
    try {
      const res = await apiClient.get('/api/courses/v1/batches/');
      if (res.data?.success) {
        setBatches(res.data.data);
        if (res.data.data.length > 0) {
          setSelectedBatch(res.data.data[0].id.toString());
        } else {
          setIsInitialLoading(false);
        }
      } else {
        setIsInitialLoading(false);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch batches.', variant: 'destructive' });
      setIsInitialLoading(false);
    }
  };

  const fetchBatchWeeks = async (batchId: string) => {
    try {
      const res = await apiClient.get(`/api/courses/v1/batches/${batchId}/weeks/`);
      if (res.data?.success) {
        setBatchWeeks(res.data.data);
      }
    } catch (err) {
      console.error("Failed to fetch batch weeks", err);
    }
  };

  const fetchBatchSubmissions = async (batchId: string, page = 1, week = 'all') => {
    setIsLoading(true);
    try {
      let url = `/api/courses/v1/batches/${batchId}/test-submissions/?page=${page}`;
      if (week !== 'all') url += `&week_number=${week}`;
      
      const res = await apiClient.get(url);
      if (res.data?.success) {
        setSubmissions(res.data.data || []);
        setTotalPages(res.data.total_pages || 1);
        if (res.data.stats) setStats(res.data.stats);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch submissions.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  };

  const fetchStudentSubmissions = async (page = 1, week = 'all', batch_id = 'all') => {
    setIsLoading(true);
    try {
      let url = `/api/courses/v1/test-submissions/my-submissions/?page=${page}`;
      if (week !== 'all') url += `&week_number=${week}`;
      if (batch_id !== 'all') url += `&batch_id=${batch_id}`;

      const res = await apiClient.get(url);
      if (res.data?.success) {
        setSubmissions(res.data.data || []);
        setTotalPages(res.data.total_pages || 1);
        if (res.data.stats) setStats(res.data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch student submissions");
    } finally {
      setIsLoading(false);
      setIsInitialLoading(false);
    }
  };

  const handleTriggerAI = async (id: number) => {
    setEvaluatingIds(prev => [...prev, id]);
    try {
      const res = await apiClient.post(`/api/courses/v1/test-submissions/${id}/trigger-ai/`);
      if (res.data?.success) {
        toast({ title: 'AI Analysis Started', description: 'AI is evaluating the submission.', variant: 'success' });
        // Refresh local data
        if (selectedBatch) fetchBatchSubmissions(selectedBatch, currentPage, selectedWeek);
      }
    } catch (err) {
      toast({ title: 'AI Error', description: 'Failed to trigger AI evaluation.', variant: 'destructive' });
    } finally {
      setEvaluatingIds(prev => prev.filter(eid => eid !== id));
    }
  };

  const pendingCount = stats.pending;
  const publishedCount = stats.published;

  // Render Logic
  const renderAdminView = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">Assessments</h1>
          <p className="mt-1 text-muted-foreground">Manage and evaluate student test submissions</p>
        </div>
      </div>

      {/* Selection Filter Pattern */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-card border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
             <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Course Batch</p>
            <h3 className="font-bold text-foreground">
              {batches.find(b => b.id.toString() === selectedBatch)?.name || 'Select a batch'}
            </h3>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-[180px] shrink-0">
            <Select value={selectedWeek} onValueChange={(val) => { setSelectedWeek(val); setCurrentPage(1); }}>
              <SelectTrigger className="h-11 bg-background rounded-xl font-bold">
                <SelectValue placeholder="All Weeks" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="font-medium cursor-pointer">All Weeks</SelectItem>
                {batchWeeks.map(w => (
                  <SelectItem key={w.id} value={w.week_number.toString()} className="font-medium cursor-pointer">Week {w.week_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[240px] shrink-0">
            <Select value={selectedBatch} onValueChange={(val) => { setSelectedBatch(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-full h-11 bg-background rounded-xl font-bold">
                <SelectValue placeholder="Select a Batch" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                {batches.map(b => (
                  <SelectItem key={b.id} value={b.id.toString()} className="font-medium cursor-pointer">{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Total Submissions', value: stats.total, icon: FileText, color: 'info' },
          { label: 'Pending Review', value: stats.pending, icon: AlertCircle, color: 'warning' },
          { label: 'Evaluated', value: stats.published, icon: CheckCircle, color: 'success' },
          { label: 'Avg Pass Rate', value: '76%', icon: TrendingUp, color: 'primary' }
        ].map((stat, i) => (
          <Card key={i} className="shadow-card border-none overflow-hidden group">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className={cn(
                  "p-3 rounded-xl transition-transform group-hover:scale-110 duration-300",
                  stat.color === 'info' ? "bg-info/10 text-info" :
                  stat.color === 'warning' ? "bg-warning/10 text-warning" :
                  stat.color === 'success' ? "bg-success/10 text-success" : "bg-primary/10 text-primary"
                )}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground leading-tight">{stat.value}</p>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="review" className="space-y-6">
        <TabsList className="bg-background p-1 border border-border/50 rounded-lg w-fit h-10">
          <TabsTrigger value="review" className="gap-2 w-40 h-8 text-xs font-bold">
            Pending Review
          </TabsTrigger>
          <TabsTrigger value="published" className="gap-2 w-40 h-8 text-xs font-bold">
            Published Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="review" className="mt-0 outline-none">
          <div className="grid gap-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : submissions.filter(s => s.status !== 'published').length === 0 ? (
              <div className="text-center py-20 text-muted-foreground border-2 border-dashed border-muted-foreground/30 rounded-2xl bg-card/50">
                 <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-slate-50 dark:bg-slate-900 text-slate-300 mb-6 border shadow-inner">
                   <CheckCircle className="h-10 w-10" />
                 </div>
                 <h3 className="text-xl font-bold text-foreground mb-2">All caught up!</h3>
                 <p className="max-w-xs mx-auto font-medium opacity-70">No pending submissions found for the selected batch. Great job keeping up with reviews!</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {submissions.filter(s => s.status !== 'published').map((item) => (
                  <Card key={item.id} className="shadow-card border-none hover:shadow-md transition-all duration-300 overflow-hidden group">
                    <CardContent className="p-0">
                      <div className="flex flex-col md:flex-row md:items-center">
                        <div className="flex-1 p-5 flex items-center gap-4">
                          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/5 transition-transform group-hover:scale-105">
                            <span className="text-lg font-bold text-primary">{item.student_name?.charAt(0)}</span>
                          </div>
                          <div className="space-y-0.5">
                            <h3 className="font-bold text-base text-foreground group-hover:text-primary transition-colors">{item.student_name}</h3>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
                              <span className="flex items-center gap-1.5"><FileText className="h-3 w-3" /> Week {item.week_number} • {item.test_title}</span>
                              <span className="hidden sm:inline h-1 w-1 rounded-full bg-slate-300 dark:bg-slate-700" />
                              <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" /> {format(new Date(item.submitted_at), 'MMM d, h:mm a')}</span>
                            </div>
                          </div>
                        </div>
                        <div className="p-5 bg-muted/30 flex items-center justify-between md:justify-end gap-8 md:min-w-[340px] border-t md:border-t-0 md:border-l border-border/50">
                          <div className="text-center md:text-right">
                            <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-1">AI Suggestion</p>
                            <div className="flex items-center justify-end gap-2">
                               {item.status === 'evaluating' || evaluatingIds.includes(item.id) ? (
                                 <Badge className="bg-primary/10 text-primary border-none animate-pulse">Evaluating...</Badge>
                               ) : item.status === 'pending' ? (
                                 <Badge variant="outline" className="text-[10px] border-dashed border-muted-foreground/30 text-muted-foreground">Waiting for Trigger</Badge>
                               ) : (
                                 <p className="text-xl font-bold text-foreground">{(item.ai_score || item.marks_obtained || 0).toFixed(1)}%</p>
                               )}
                            </div>
                          </div>
                          
                          {item.status === 'pending' ? (
                            <div className="flex items-center gap-3">
                              <Button 
                                variant="outline"
                                className="font-bold rounded-xl border-primary/20 text-primary hover:bg-primary/5 h-10 px-4"
                                onClick={() => handleTriggerAI(item.id)}
                                disabled={evaluatingIds.includes(item.id)}
                              >
                                {evaluatingIds.includes(item.id) ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Zap className="h-4 w-4 mr-2 fill-primary" />}
                                Evaluate via AI
                              </Button>
                              <Button 
                                variant="gradient"
                                className="font-bold rounded-xl h-10 px-4 shadow-lg shadow-primary/20"
                                onClick={() => {
                                  setReviewId(item.id);
                                  setIsReviewOpen(true);
                                }}
                              >
                                <Edit3 className="h-4 w-4 mr-2" />
                                Review & Grade
                              </Button>
                            </div>
                          ) : (
                            <Button 
                              variant={item.status === 'pending_review' ? 'gradient' : 'outline'} 
                              className={cn(
                                "font-bold rounded-xl h-10 px-6",
                                item.status === 'pending_review' ? "shadow-lg shadow-primary/20" : ""
                              )}
                              onClick={() => {
                                setReviewId(item.id);
                                setIsReviewOpen(true);
                              }}
                              disabled={item.status === 'evaluating' || evaluatingIds.includes(item.id)}
                            >
                              <Edit3 className="h-4 w-4 mr-2" />
                              {item.status === 'pending_review' || item.status === 'evaluating' ? 'Review & Grade' : item.status === 'returned' ? 'Review Correction' : 'View Submission'}
                            </Button>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="published" className="mt-0 outline-none">
          <div className="border rounded-2xl overflow-hidden shadow-sm bg-card">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-bold uppercase text-[10px] tracking-wider py-4">Student</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-wider py-4">Assessment Details</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-wider py-4">Submitted On</TableHead>
                  <TableHead className="font-bold uppercase text-[10px] tracking-wider py-4">Score</TableHead>
                  <TableHead className="text-right font-bold uppercase text-[10px] tracking-wider py-4">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {submissions.filter(s => s.status === 'published').length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                         <FileText className="h-12 w-12 mb-4 opacity-20" />
                         <p className="font-bold text-lg">No published results yet</p>
                         <p className="max-w-xs mx-auto mt-1 opacity-70">Evaluated assessments for this batch will appear in this table.</p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  submissions.filter(s => s.status === 'published').map((item) => (
                    <TableRow key={item.id} className="group hover:bg-muted/10 transition-colors border-b last:border-0">
                      <TableCell className="py-4">
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-success/10 text-success flex items-center justify-center font-bold text-sm border border-success/10">
                            {item.student_name?.charAt(0)}
                          </div>
                          <span className="font-bold text-foreground">{item.student_name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-foreground">Week {item.week_number}</span>
                          <span className="text-xs text-muted-foreground font-medium">{item.test_title}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground font-medium py-4">
                        {format(new Date(item.submitted_at), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className="border-success/30 text-success bg-success/5 font-black text-xs px-2 py-0.5 rounded-lg shadow-sm">
                          {item.marks_obtained}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="hover:bg-primary/10 hover:text-primary font-bold rounded-lg transition-all h-9"
                          onClick={() => { setReviewId(item.id); setIsReviewOpen(true); }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          View Results
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      {/* Pagination Controls */}
      {!isLoading && submissions.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <div className="text-sm font-medium text-muted-foreground px-4">
            Page {currentPage} of {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );

  const renderStudentView = () => (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">My Results</h1>
          <p className="mt-1 text-muted-foreground">Track your performance and review feedback</p>
        </div>
      </div>

      {/* Selection Filter Pattern */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl bg-card border shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
             <BookOpen className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">Course Batch</p>
            <h3 className="font-bold text-foreground">
              {selectedBatch === 'all' ? 'All Batches' : batches.find(b => b.id.toString() === selectedBatch)?.name || 'Select a batch'}
            </h3>
          </div>
        </div>
        
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="w-[180px] shrink-0">
            <Select value={selectedWeek} onValueChange={(val) => { setSelectedWeek(val); setCurrentPage(1); }}>
              <SelectTrigger className="h-11 bg-background rounded-xl font-bold">
                <SelectValue placeholder="All Weeks" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="font-medium cursor-pointer">All Weeks</SelectItem>
                {batchWeeks.map(w => (
                  <SelectItem key={w.id} value={w.week_number.toString()} className="font-medium cursor-pointer">Week {w.week_number}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-[240px] shrink-0">
            <Select value={selectedBatch} onValueChange={(val) => { setSelectedBatch(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-full h-11 bg-background rounded-xl font-bold">
                <SelectValue placeholder="All Batches" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="font-medium cursor-pointer">All Batches</SelectItem>
                {batches.map(b => (
                  <SelectItem key={b.id} value={b.id.toString()} className="font-medium cursor-pointer">{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Student Stats */}
      {(() => {
        const publishedSubs = submissions.filter(s => s.status === 'published');
        const average = publishedSubs.length > 0 
          ? Math.round(publishedSubs.reduce((acc, s) => acc + (s.marks_obtained || 0), 0) / publishedSubs.length) 
          : 0;
        const lastFailed = publishedSubs.find(s => !s.is_passed);

        return (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Completed Tests', value: stats.published, icon: CheckCircle, color: 'success' },
              { label: 'Pending Review', value: stats.pending, icon: Clock, color: 'warning' },
              { label: 'Overall Average', value: `${average}%`, icon: Award, color: 'primary' },
              { label: 'Total Attempts', value: stats.total, icon: FileText, color: 'info' }
            ].map((stat, i) => (
              <Card key={i} className="shadow-card group overflow-hidden">
                <CardContent className="p-6">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "p-3 rounded-xl transition-transform group-hover:scale-110 duration-300",
                      stat.color === 'success' ? "bg-success/10 text-success" :
                      stat.color === 'warning' ? "bg-warning/10 text-warning" :
                      stat.color === 'destructive' ? "bg-destructive/10 text-destructive" :
                      stat.color === 'muted' ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                    )}>
                      <stat.icon className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-foreground leading-tight">{stat.value}</p>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })()}

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : submissions.length === 0 ? (
        <div className="text-center py-20 bg-background border-2 border-dashed border-border rounded-2xl">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-muted text-muted-foreground mb-4">
            <LayoutGrid className="h-8 w-8" />
          </div>
          <h3 className="text-xl font-bold text-foreground">No assessments yet</h3>
          <p className="text-muted-foreground max-w-sm mx-auto mt-2">Start learning and completing lessons to unlock your assessments.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {submissions.map((assessment) => (
            <Card key={assessment.id} className="shadow-card border-none hover:shadow-md transition-all duration-300 overflow-hidden group">
              <CardContent className="p-0">
                <div className="flex flex-col md:flex-row md:items-center">
                  <div className="flex-1 p-5 flex items-start gap-4">
                    <div className={cn(
                      "p-3.5 rounded-xl shrink-0 transition-colors",
                      assessment.status === 'published' 
                        ? "bg-success/10 text-success group-hover:bg-success/20" 
                        : "bg-warning/10 text-warning group-hover:bg-warning/20"
                    )}>
                      {assessment.status === 'published' ? (
                        <CheckCircle className="h-6 w-6" />
                      ) : (
                        <Clock className="h-6 w-6" />
                      )}
                    </div>
                    <div className="space-y-1">
                      <h3 className="font-bold text-lg text-foreground group-hover:text-primary transition-colors">{assessment.test_title}</h3>
                      <div className="flex flex-wrap items-center gap-3">
                         <Badge variant="outline" className="border-border text-muted-foreground font-bold text-[10px] uppercase tracking-wider px-2">
                           Week {assessment.week_number}
                         </Badge>
                         <span className="text-[10px] text-muted-foreground font-black uppercase tracking-widest bg-muted rounded px-2 py-0.5">
                           Attempt {assessment.attempt_number}
                         </span>
                      </div>
                      {assessment.grader_remarks && assessment.status === 'published' && (
                        <p className="text-sm text-muted-foreground mt-3 leading-relaxed font-medium line-clamp-1 italic max-w-2xl">
                          "{assessment.grader_remarks}"
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="p-5 bg-muted/20 flex items-center justify-between md:justify-end gap-10 md:min-w-[300px] border-t md:border-t-0 md:border-l border-border/50">
                    {assessment.status === 'published' ? (
                      <div className="text-center md:text-right flex flex-col items-center md:items-end gap-1">
                        <div className="flex items-center gap-2">
                          <p className="text-2xl font-bold text-foreground">{assessment.marks_obtained}%</p>
                          <Badge className={cn(
                            "font-black uppercase text-[8px] px-2 py-0.5 border-none",
                            assessment.is_passed 
                              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                              : "bg-rose-500/20 text-rose-600 dark:text-rose-400"
                          )}>
                            {assessment.is_passed ? 'Passed' : 'Failed'}
                          </Badge>
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your Score</p>
                      </div>
                    ) : (
                      <div className="text-center md:text-right">
                        <Badge className={cn(
                          "font-bold uppercase text-[10px] py-1 px-3 border-none",
                          assessment.status === 'returned' ? "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/20" : "bg-warning text-warning-foreground"
                        )}>
                          {assessment.status.replace('_', ' ')}
                        </Badge>
                        {assessment.status === 'returned' && (
                          <p className="text-[9px] font-bold text-destructive uppercase mt-1">Please retake</p>
                        )}
                      </div>
                    )}
                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <Button 
                        variant={assessment.status === 'published' ? 'outline' : 'gradient'} 
                        size="sm"
                        className="font-bold h-10 px-6 rounded-xl w-full sm:w-auto"
                        onClick={() => {
                          if (assessment.status === 'returned') {
                            handleRetake(assessment);
                          } else {
                            setViewingSubmission(assessment);
                            setIsResultsOpen(true);
                          }
                        }}
                      >
                        {assessment.status === 'published' ? 'View Feedback' : assessment.status === 'returned' ? 'Retake Test' : 'Details'}
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && submissions.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-12 bg-card p-4 rounded-2xl border shadow-sm w-fit mx-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-4 rounded-xl border-border/50"
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <div className="text-sm font-bold text-foreground px-6 py-1 bg-muted/50 rounded-lg">
            Page {currentPage} of {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-9 px-4 rounded-xl border-border/50"
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
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

   return (
    <DashboardLayout>
      <div className="space-y-6 min-h-screen pb-20 flex flex-col">
        {isInitialLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : user?.role === 'student' ? renderStudentView() : renderAdminView()}
        
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

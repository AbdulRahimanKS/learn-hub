import { useState, useEffect, useCallback, useRef } from 'react';
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
  ChevronRight,
  Loader2,
  Filter,
  BookOpen,
  Zap,
  Edit3,
  ClipboardCheck,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiClient } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';
import { SubmissionReviewModal } from '@/components/SubmissionReviewModal';
import { WeeklyTestResults } from '@/components/WeeklyTestResults';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { BatchFilterCombobox } from '@/components/BatchFilterCombobox';
import type { Batch } from '@/lib/batch-api';
import { getFriendlyAiErrorMessage } from '@/lib/ai-error-message';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

function StudentSubmissionAvatar({
  name,
  photoUrl,
  variant = 'primary',
}: {
  name?: string | null;
  photoUrl?: string | null;
  variant?: 'primary' | 'success';
}) {
  const initial = (name && name.charAt(0)) || '?';
  const fallbackClass =
    variant === 'success'
      ? 'rounded-full border border-success/15 bg-success/10 text-sm font-bold text-success'
      : 'rounded-full bg-primary/10 text-base font-bold text-primary';
  return (
    <Avatar className="h-11 w-11 shrink-0">
      {photoUrl ? <AvatarImage src={photoUrl} alt={name ? `${name} profile` : 'Student profile'} /> : null}
      <AvatarFallback className={fallbackClass}>{initial}</AvatarFallback>
    </Avatar>
  );
}

export default function Assessments() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedBatch, setSelectedBatch] = useState<string>('');
  const [selectedBatchName, setSelectedBatchName] = useState('');
  /** Student list (all scopes combined — no scope param) */
  const [studentSubmissions, setStudentSubmissions] = useState<any[]>([]);
  const [pendingSubmissions, setPendingSubmissions] = useState<any[]>([]);
  const [publishedSubmissions, setPublishedSubmissions] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingReview, setLoadingReview] = useState(false);
  const [loadingPublished, setLoadingPublished] = useState(false);
  // Filters & Pagination
  const [selectedWeek, setSelectedWeek] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [reviewPage, setReviewPage] = useState(1);
  const [reviewTotalPages, setReviewTotalPages] = useState(1);
  const [publishedPage, setPublishedPage] = useState(1);
  const [publishedTotalPages, setPublishedTotalPages] = useState(1);
  const [stats, setStats] = useState({ total: 0, pending: 0, published: 0 });
  const reviewPageRef = useRef(reviewPage);
  const publishedPageRef = useRef(publishedPage);
  reviewPageRef.current = reviewPage;
  publishedPageRef.current = publishedPage;
  const [batchWeeks, setBatchWeeks] = useState<any[]>([]);
  
  // Review Modal State
  const [reviewId, setReviewId] = useState<number | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  // Student Results Modal State
  const [viewingSubmission, setViewingSubmission] = useState<any>(null);
  const [isResultsOpen, setIsResultsOpen] = useState(false);

  const [evaluatingIds, setEvaluatingIds] = useState<number[]>([]);

  const formatStatusLabel = (raw?: string | null) => {
    return String(raw || '')
      .replace(/_/g, ' ')
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  const handleAssessmentBatchChange = useCallback((id: string, batch: Batch) => {
    setSelectedBatch(id);
    setSelectedBatchName(batch.name);
    setSelectedWeek('all');
    setBatchWeeks([]);
    setCurrentPage(1);
    setReviewPage(1);
    setPublishedPage(1);
  }, []);

  useEffect(() => {
    if (user?.role !== 'student' || !selectedBatch) return;
    fetchStudentSubmissions(currentPage, selectedWeek, selectedBatch);
  }, [currentPage, selectedWeek, selectedBatch, user]);

  const loadAdminPending = useCallback(async () => {
    if (!selectedBatch || user?.role === 'student') return;
    setLoadingReview(true);
    try {
      let url = `/api/courses/v1/batches/${selectedBatch}/test-submissions/?page=${reviewPageRef.current}&page_size=5&scope=pending`;
      if (selectedWeek !== 'all') url += `&week_number=${selectedWeek}`;
      const res = await apiClient.get(url);
      if (res.data?.success) {
        setPendingSubmissions(res.data.data || []);
        setReviewTotalPages(res.data.total_pages || 1);
        if (res.data.stats) setStats(res.data.stats);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch pending submissions.', variant: 'destructive' });
    } finally {
      setLoadingReview(false);
    }
  }, [selectedBatch, selectedWeek, user?.role, toast]);

  const loadAdminPublished = useCallback(async () => {
    if (!selectedBatch || user?.role === 'student') return;
    setLoadingPublished(true);
    try {
      let url = `/api/courses/v1/batches/${selectedBatch}/test-submissions/?page=${publishedPageRef.current}&page_size=5&scope=published`;
      if (selectedWeek !== 'all') url += `&week_number=${selectedWeek}`;
      const res = await apiClient.get(url);
      if (res.data?.success) {
        setPublishedSubmissions(res.data.data || []);
        setPublishedTotalPages(res.data.total_pages || 1);
        if (res.data.stats) setStats(res.data.stats);
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch published submissions.', variant: 'destructive' });
    } finally {
      setLoadingPublished(false);
    }
  }, [selectedBatch, selectedWeek, user?.role, toast]);

  useEffect(() => {
    if (!selectedBatch || selectedBatch === 'all') {
      setBatchWeeks([]);
      return;
    }
    void fetchBatchWeeks(selectedBatch);
  }, [selectedBatch]);

  useEffect(() => {
    if (user?.role === 'student' || !selectedBatch || selectedBatch === 'all') {
      setPendingSubmissions([]);
      setReviewTotalPages(1);
      return;
    }
    void loadAdminPending();
  }, [user?.role, selectedBatch, selectedWeek, reviewPage, loadAdminPending]);

  useEffect(() => {
    if (user?.role === 'student') return;
    if (!selectedBatch || selectedBatch === 'all') return;
    const hasRunning = pendingSubmissions.some(
      (s) => s.status === 'evaluating' || s.ai_job_status === 'queued' || s.ai_job_status === 'running'
    );
    if (!hasRunning) return;

    const timer = window.setInterval(() => {
      void loadAdminPending();
    }, 4000);

    return () => window.clearInterval(timer);
  }, [pendingSubmissions, selectedBatch, user?.role, loadAdminPending]);

  useEffect(() => {
    if (user?.role === 'student' || !selectedBatch || selectedBatch === 'all') {
      setPublishedSubmissions([]);
      setPublishedTotalPages(1);
      return;
    }
    void loadAdminPublished();
  }, [user?.role, selectedBatch, selectedWeek, publishedPage, loadAdminPublished]);

  /** If the selected week is not in the current batch’s week list, fall back to “all”. */
  useEffect(() => {
    if (selectedWeek === 'all') return;
    if (batchWeeks.length === 0) return;
    const valid = batchWeeks.some((w) => String(w.week_number) === selectedWeek);
    if (!valid) setSelectedWeek('all');
  }, [batchWeeks, selectedWeek]);

  const fetchBatchWeeks = async (batchId: string) => {
    try {
      const res = await apiClient.get(`/api/courses/v1/batches/${batchId}/weeks/`);
      if (res.data?.success) {
        const rows = Array.isArray(res.data.data) ? res.data.data : [];
        setBatchWeeks(
          [...rows].sort((a, b) => (Number(a.week_number) || 0) - (Number(b.week_number) || 0)),
        );
      } else {
        setBatchWeeks([]);
      }
    } catch (err) {
      console.error('Failed to fetch batch weeks', err);
      setBatchWeeks([]);
    }
  };

  const fetchStudentSubmissions = async (page = 1, week = 'all', batchId?: string) => {
    if (!batchId) {
      setStudentSubmissions([]);
      setTotalPages(1);
      setStats({ total: 0, pending: 0, published: 0 });
      return;
    }
    setIsLoading(true);
    try {
      let url = `/api/courses/v1/batches/${batchId}/test-submissions/my-submissions/?page=${page}&page_size=6`;
      if (week !== 'all') url += `&week_number=${week}`;

      const res = await apiClient.get(url);
      if (res.data?.success) {
        setStudentSubmissions(res.data.data || []);
        setTotalPages(res.data.total_pages || 1);
        if (res.data.stats) setStats(res.data.stats);
      }
    } catch (err) {
      console.error('Failed to fetch student submissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTriggerAI = async (id: number) => {
    setEvaluatingIds(prev => [...prev, id]);
    try {
      const res = await apiClient.post(
        `/api/courses/v1/batches/${selectedBatch}/test-submissions/${id}/trigger-ai/`,
      );
      if (res.data?.success) {
        toast({
          title: 'AI review started',
          description: 'We are preparing AI suggestions now. You can continue reviewing while this updates.',
          variant: 'success',
        });
        // Refresh local data
        if (selectedBatch) void loadAdminPending();
      }
    } catch (err) {
      toast({ title: 'AI Error', description: 'Failed to trigger AI evaluation.', variant: 'destructive' });
    } finally {
      setEvaluatingIds(prev => prev.filter(eid => eid !== id));
    }
  };

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
      <div className="flex min-w-0 flex-col items-center justify-between gap-4 p-5 sm:flex-row sm:items-center rounded-2xl bg-card border shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
             <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">Course Batch</p>
            <h3
              className="truncate font-bold text-foreground"
              title={selectedBatchName || undefined}
            >
              {selectedBatchName || 'Select a batch'}
            </h3>
          </div>
        </div>
        
        <div className="flex min-w-0 w-full flex-1 items-center gap-3 sm:w-auto sm:justify-end">
          <div className="w-[min(180px,100%)] shrink-0">
            <Select
              value={selectedWeek}
              onValueChange={(val) => {
                setSelectedWeek(val);
                setReviewPage(1);
                setPublishedPage(1);
              }}
            >
              <SelectTrigger className="h-11 max-w-full rounded-xl border-primary text-primary">
                <SelectValue placeholder="All Weeks" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="font-medium cursor-pointer">All Weeks</SelectItem>
                {batchWeeks.map((w) => (
                  <SelectItem
                    key={w.id}
                    value={String(w.week_number)}
                    className="font-medium cursor-pointer"
                  >
                    Week {w.week_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full min-w-0 shrink-0 sm:w-[min(280px,100%)] sm:max-w-[280px]">
            <BatchFilterCombobox
              value={selectedBatch}
              selectedLabel={selectedBatchName}
              onValueChange={handleAssessmentBatchChange}
              placeholder="Select a batch"
              className="h-11 border-primary text-primary"
            />
          </div>
        </div>
      </div>

      {/* Stats — Dashboard-style (label + value + icon, separated cards) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            label: 'Total Submissions',
            value: stats.total,
            icon: FileText,
            iconClass: 'text-primary',
            boxClass: 'bg-primary/10',
          },
          {
            label: 'Pending Review',
            value: stats.pending,
            icon: AlertCircle,
            iconClass: 'text-warning',
            boxClass: 'bg-warning/10',
          },
          {
            label: 'Evaluated',
            value: stats.published,
            icon: CheckCircle,
            iconClass: 'text-success',
            boxClass: 'bg-success/10',
          },
        ].map((stat, i) => (
          <Card key={i} className="shadow-card transition-shadow hover:shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-3xl font-bold text-foreground">{stat.value}</p>
                </div>
                <div className={cn('shrink-0 rounded-xl p-3', stat.boxClass)}>
                  <stat.icon className={cn('h-6 w-6', stat.iconClass)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card">
        <CardHeader className="pb-2">
          <CardTitle>Student submissions</CardTitle>
          <CardDescription>Review pending work and published results for the selected batch and week.</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="review" className="space-y-6">
            <TabsList className="h-10 w-fit rounded-lg border border-border/50 bg-background p-1">
              <TabsTrigger value="review" className="h-8 w-40 rounded-md text-xs font-bold">
                Pending Review
              </TabsTrigger>
              <TabsTrigger value="published" className="h-8 w-40 rounded-md text-xs font-bold">
                Published Results
              </TabsTrigger>
            </TabsList>

            <TabsContent value="review" className="mt-0 outline-none">
              {loadingReview ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : pendingSubmissions.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted/40 px-6 py-14 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-success/10">
                    <CheckCircle className="h-6 w-6 text-success" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">All caught up!</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    No pending submissions for this batch. Great job keeping up with reviews.
                  </p>
                </div>
              ) : (
                <>
                <div className="space-y-4">
                  {pendingSubmissions.map((item) => (
                      (() => {
                        const isAiRunning =
                          item.status === 'evaluating' ||
                          item.ai_job_status === 'queued' ||
                          item.ai_job_status === 'running' ||
                          evaluatingIds.includes(item.id);
                        return (
                      <div
                        key={item.id}
                        className="group flex flex-col gap-4 rounded-xl border border-border bg-muted/40 p-4 transition-all hover:bg-accent/20 hover:shadow-sm xl:flex-row xl:items-center xl:justify-between"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <StudentSubmissionAvatar name={item.student_name} photoUrl={item.student_profile_picture} />
                          <div className="min-w-0 space-y-0.5">
                            <p className="font-medium text-foreground">{item.student_name}</p>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-medium text-muted-foreground">
                              <span className="flex items-center gap-1.5">
                                <FileText className="h-3 w-3 shrink-0" />
                                Week {item.week_number} • {item.test_title}
                              </span>
                              <span className="hidden sm:inline h-1 w-1 rounded-full bg-muted-foreground/40" />
                              <span className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3 shrink-0" />
                                {format(new Date(item.submitted_at), 'MMM d, h:mm a')}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex flex-col gap-2 border-t border-border/50 pt-4 sm:border-t-0 sm:pt-0 xl:shrink-0 xl:items-end">
                          <div className="flex items-center gap-2">
                            {item.ai_job_status === 'failed' && (
                              <Badge
                                variant="outline"
                                className="h-7 rounded-full border-rose-500/30 bg-rose-500/10 px-2.5 text-rose-500"
                                title={getFriendlyAiErrorMessage(item.ai_error_message)}
                              >
                                <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
                                AI failed
                              </Badge>
                            )}
                            {item.status === 'evaluating' && item.ai_job_status !== 'failed' && (
                              <Badge className="h-7 rounded-full border-none bg-primary/10 px-2.5 text-primary animate-pulse">
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                AI suggestion: Evaluating
                              </Badge>
                            )}
                            {item.status !== 'pending' && item.status !== 'evaluating' && !evaluatingIds.includes(item.id) && item.ai_job_status !== 'failed' && (
                              <Badge className="pointer-events-none h-7 rounded-full border border-primary/20 bg-primary/[0.08] px-2.5 text-primary/80 shadow-none transition-none">
                                <Zap className="mr-1.5 h-3.5 w-3.5 text-primary/70" />
                                AI suggestion:
                                <span className="ml-1.5 text-sm font-bold tabular-nums text-foreground/95">
                                  {(item.ai_score || item.marks_obtained || 0).toFixed(1)}%
                                </span>
                              </Badge>
                            )}
                            {item.status === 'pending' ? (
                              <>
                                <Button
                                  variant="gradient"
                                  className="h-9 rounded-xl px-3 text-xs font-semibold shadow-none hover:shadow-none"
                                  onClick={() => handleTriggerAI(item.id)}
                                  disabled={evaluatingIds.includes(item.id)}
                                >
                                  {evaluatingIds.includes(item.id) ? (
                                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  ) : (
                                    <Zap className="mr-2 h-4 w-4" />
                                  )}
                                  {evaluatingIds.includes(item.id) ? 'Evaluating...' : 'Evaluate AI'}
                                </Button>
                                <Button
                                  variant="gradient"
                                  className="h-9 rounded-xl px-3 text-xs font-semibold shadow-none hover:shadow-none"
                                  onClick={() => {
                                    setReviewId(item.id);
                                    setIsReviewOpen(true);
                                  }}
                                  disabled={isAiRunning}
                                >
                                  <Edit3 className="mr-2 h-4 w-4" />
                                  Review & Grade
                                </Button>
                              </>
                            ) : (
                              <Button
                                variant={item.status === 'pending_review' ? 'gradient' : 'outline'}
                                className="h-9 rounded-xl px-3 text-xs font-semibold shadow-none hover:shadow-none"
                                onClick={() => {
                                  setReviewId(item.id);
                                  setIsReviewOpen(true);
                                }}
                                disabled={isAiRunning}
                              >
                                <Edit3 className="mr-2 h-4 w-4" />
                                {item.status === 'pending_review' || item.status === 'evaluating'
                                  ? 'Review & Grade'
                                  : 'View submission'}
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                        );
                      })()
                    ))}
                </div>
                {!loadingReview && pendingSubmissions.length > 0 && reviewTotalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReviewPage((p) => Math.max(1, p - 1))}
                      disabled={reviewPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="px-4 text-sm font-medium text-muted-foreground">
                      Page {reviewPage} of {reviewTotalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setReviewPage((p) => Math.min(reviewTotalPages, p + 1))}
                      disabled={reviewPage === reviewTotalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
                </>
              )}
            </TabsContent>

            <TabsContent value="published" className="mt-0 outline-none">
              {loadingPublished ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : publishedSubmissions.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted/40 px-6 py-14 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">No published results yet</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    Graded assessments you publish will appear here as separate cards.
                  </p>
                </div>
              ) : (
                <>
                <div className="space-y-4">
                  {publishedSubmissions.map((item) => {
                      const rawPassPercentage = Number(item.pass_percentage);
                      const passPercentage =
                        Number.isFinite(rawPassPercentage) && rawPassPercentage > 0 && rawPassPercentage <= 100
                          ? rawPassPercentage
                          : 70;
                      return (
                      <div
                        key={item.id}
                        className="group flex flex-col gap-4 rounded-xl border border-border bg-muted/40 p-4 transition-all hover:bg-accent/20 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="flex min-w-0 flex-1 items-center gap-3">
                          <StudentSubmissionAvatar
                            name={item.student_name}
                            photoUrl={item.student_profile_picture}
                            variant="success"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-foreground">{item.student_name}</p>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-lg px-2 py-0.5 text-[10px] font-black shadow-sm",
                                  item.is_passed
                                    ? "border-success/30 bg-success/10 text-success"
                                    : "border-rose-500/30 bg-rose-500/10 text-rose-500",
                                )}
                              >
                                {item.is_passed ? 'Passed' : 'Failed'}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              Week {item.week_number} • {item.test_title}
                            </p>
                            <p className="mt-0.5 text-xs font-medium text-muted-foreground">
                              Submitted {format(new Date(item.submitted_at), 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:gap-4">
                          <div className="flex flex-col gap-1.5 sm:items-end sm:text-right">
                            <p className="text-xs font-semibold text-foreground">
                              Score: {Number(item.marks_obtained ?? 0).toFixed(1)}%
                            </p>
                            <p className="text-[11px] font-medium text-muted-foreground">
                              Pass percentage: {passPercentage.toFixed(0)}%
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-10 rounded-xl font-bold"
                            onClick={() => {
                              setReviewId(item.id);
                              setIsReviewOpen(true);
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            View results
                          </Button>
                        </div>
                      </div>
                    )})}
                </div>
                {!loadingPublished && publishedSubmissions.length > 0 && publishedTotalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPublishedPage((p) => Math.max(1, p - 1))}
                      disabled={publishedPage === 1}
                    >
                      Previous
                    </Button>
                    <div className="px-4 text-sm font-medium text-muted-foreground">
                      Page {publishedPage} of {publishedTotalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPublishedPage((p) => Math.min(publishedTotalPages, p + 1))}
                      disabled={publishedPage === publishedTotalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
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
      <div className="flex min-w-0 flex-col items-center justify-between gap-4 p-5 sm:flex-row sm:items-center rounded-2xl bg-card border shadow-sm">
        <div className="flex min-w-0 items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
             <BookOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-muted-foreground">Course Batch</p>
            <h3
              className="truncate font-bold text-foreground"
              title={selectedBatchName || undefined}
            >
              {selectedBatchName || 'Select a batch'}
            </h3>
          </div>
        </div>
        
        <div className="flex min-w-0 w-full flex-1 items-center gap-3 sm:w-auto sm:justify-end">
          <div className="w-[min(180px,100%)] shrink-0">
            <Select value={selectedWeek} onValueChange={(val) => { setSelectedWeek(val); setCurrentPage(1); }}>
              <SelectTrigger className="h-11 max-w-full bg-background rounded-xl font-bold">
                <SelectValue placeholder="All Weeks" />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="all" className="font-medium cursor-pointer">All Weeks</SelectItem>
                {batchWeeks.map((w) => (
                  <SelectItem
                    key={w.id}
                    value={String(w.week_number)}
                    className="font-medium cursor-pointer"
                  >
                    Week {w.week_number}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="w-full min-w-0 shrink-0 sm:w-[min(280px,100%)] sm:max-w-[280px]">
            <BatchFilterCombobox
              value={selectedBatch}
              selectedLabel={selectedBatchName}
              onValueChange={handleAssessmentBatchChange}
              placeholder="Select a batch"
              className="h-11 border-border bg-background font-bold"
            />
          </div>
        </div>
      </div>

      {/* Student Stats — Dashboard-style: label + value + icon */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[
          {
            label: 'Completed Tests',
            value: stats.published,
            icon: CheckCircle,
            iconClass: 'text-success',
            boxClass: 'bg-success/10',
          },
          {
            label: 'Pending Review',
            value: stats.pending,
            icon: Clock,
            iconClass: 'text-warning',
            boxClass: 'bg-warning/10',
          },
          {
            label: 'Total Attempts',
            value: stats.total,
            icon: FileText,
            iconClass: 'text-primary',
            boxClass: 'bg-primary/10',
          },
        ].map((stat, i) => (
          <Card key={i} className="shadow-card transition-shadow hover:shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="mt-1 text-3xl font-bold text-foreground">{stat.value}</p>
                </div>
                <div className={cn('shrink-0 rounded-xl p-3', stat.boxClass)}>
                  <stat.icon className={cn('h-6 w-6', stat.iconClass)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Main panel — matches Dashboard “Recent Submissions” card + row styling */}
      <Card className="shadow-card">
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Your assessments</CardTitle>
            <CardDescription>Latest submissions and scores for the selected batch and week.</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : studentSubmissions.length === 0 ? (
            <div className="rounded-xl border border-border bg-muted/40 px-6 py-16 text-center transition-colors">
              <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
                <ClipboardCheck className="h-6 w-6 text-warning" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">No assessments yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                Start learning and complete lessons to unlock weekly tests. Your submissions will show up here.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {studentSubmissions.map((assessment) => {
                const rawPassPercentage = Number(assessment.pass_percentage);
                const passPercentage =
                  Number.isFinite(rawPassPercentage) && rawPassPercentage > 0 && rawPassPercentage <= 100
                    ? rawPassPercentage
                    : 70;
                return (
                <div
                  key={assessment.id}
                  className="group flex flex-col gap-4 rounded-xl border border-border bg-muted/40 p-4 transition-all hover:bg-accent/20 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div
                      className={cn(
                        'shrink-0 rounded-lg p-2.5 transition-colors',
                        assessment.status === 'published'
                          ? 'bg-success/10 text-success group-hover:bg-success/15'
                          : 'bg-warning/10 text-warning group-hover:bg-warning/15',
                      )}
                    >
                      {assessment.status === 'published' ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <Clock className="h-5 w-5" />
                      )}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-foreground">{assessment.test_title}</p>
                        {assessment.status === 'published' ? (
                          <Badge
                            variant="outline"
                            className={cn(
                              "rounded-lg px-2 py-0.5 text-[10px] font-black shadow-sm",
                              assessment.is_passed
                                ? "border-success/30 bg-success/10 text-success"
                                : "border-rose-500/30 bg-rose-500/10 text-rose-500",
                            )}
                          >
                            {assessment.is_passed ? 'Passed' : 'Failed'}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="rounded-lg border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary"
                          >
                            {formatStatusLabel(assessment.status)}
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge
                          variant="outline"
                          className="border-border px-2 text-[10px] font-semibold text-muted-foreground"
                        >
                          Week {assessment.week_number}
                        </Badge>
                        <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Attempt {assessment.attempt_number}
                        </span>
                        <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                          Submitted {assessment.submitted_at && format(new Date(assessment.submitted_at), 'MMM d, h:mm a')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                    {assessment.status === 'published' ? (
                      <div className="flex flex-col items-end gap-1 sm:text-right">
                        <p className="text-xs font-semibold text-foreground">
                          Score: {Number(assessment.marks_obtained ?? 0).toFixed(1)}%
                        </p>
                        <p className="text-[11px] font-medium text-muted-foreground">
                          Pass percentage: {passPercentage.toFixed(0)}%
                        </p>
                      </div>
                    ) : null}
                    <Button
                      variant={assessment.status === 'published' ? 'outline' : 'gradient'}
                      size="sm"
                      className={cn(
                        "h-10 rounded-xl px-6 font-bold sm:w-auto",
                        assessment.status !== 'published' ? "shadow-none hover:shadow-none" : ""
                      )}
                      onClick={() => {
                        setViewingSubmission(assessment);
                        setIsResultsOpen(true);
                      }}
                    >
                      {assessment.status === 'published' ? 'View results' : 'View submission'}
                    </Button>
                  </div>
                </div>
              )})}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination Controls */}
      {!isLoading && studentSubmissions.length > 0 && totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <div className="px-4 text-sm font-medium text-muted-foreground">
            Page {currentPage} of {totalPages}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );

   return (
    <DashboardLayout>
      <div className="space-y-6 min-h-screen pb-20 flex flex-col">
        {!user ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : user.role === 'student' ? (
          renderStudentView()
        ) : (
          renderAdminView()
        )}
        
        {/* Admin Review Modal */}
        {reviewId && selectedBatch && (
          <SubmissionReviewModal
            open={isReviewOpen}
            onClose={() => { setReviewId(null); setIsReviewOpen(false); }}
            batchId={selectedBatch}
            submissionId={reviewId}
            onUpdated={() => {
              if (selectedBatch && user?.role !== 'student') {
                void loadAdminPending();
                void loadAdminPublished();
              }
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
          />
        )}

      </div>
    </DashboardLayout>
  );
}

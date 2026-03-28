import { useState, useEffect, useCallback, useRef } from 'react';
import { BatchFilterCombobox } from '@/components/BatchFilterCombobox';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress as ProgressBar } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Search,
  BookOpen,
  Filter,
  TrendingUp,
  Award,
  CheckCircle,
  Clock,
  Lock,
  UserPlus,
  Users,
  UserX,
  Play,
  FileText,
  Download,
  Loader2,
  VideoIcon,
  Mail,
  CalendarDays,
  X,
  User,
  ChevronRight,
} from 'lucide-react';
import { batchApi, batchContentApi, BatchWeek, type Batch } from '@/lib/batch-api';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import * as XLSX from 'xlsx';
import { apiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatTestScorePercent } from '@/lib/format-test-score';
import { format } from 'date-fns';

function formatEnrolledDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatSubmissionStatusLabel(raw?: string | null) {
  return String(raw || '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Progress() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isStudent = user?.role === 'student';

  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [selectedBatchName, setSelectedBatchName] = useState('');
  const [selectedBatchCourseId, setSelectedBatchCourseId] = useState<number | null>(null);
  
  // Shared loading
  const [loading, setLoading] = useState(true);
  const adminSearchAbortRef = useRef<AbortController | null>(null);
  const adminSearchRequestIdRef = useRef(0);

  // --- Admin State ---
  const [students, setStudents] = useState<any[]>([]);
  const [selectedEnrollment, setSelectedEnrollment] = useState<any | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState<any>(null);
  const [isExporting, setIsExporting] = useState(false);

  // --- Student State ---
  const [weeks, setWeeks] = useState<BatchWeek[]>([]);
  const [studentStats, setStudentStats] = useState({
    totalVideos: 0,
    videosWatched: 0,
    totalTests: 0,
    testsPassed: 0,
    overallProgress: 0,
  });
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [isSubmissionsLoading, setIsSubmissionsLoading] = useState(false);

  // Handle Search Debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1); // Reset page on search
    }, 500);
    return () => clearTimeout(timer);
  }, [search]);

  const handleProgressBatchChange = useCallback((id: string, batch: Batch) => {
    setSelectedBatchId(Number(id));
    setSelectedBatchName(batch.name);
    setSelectedBatchCourseId(batch.course ?? null);
    setCurrentPage(1);
    setSearch('');
  }, []);

  // Fetch Students for Admin
  const fetchAdminData = useCallback(async () => {
    if (!selectedBatchId) return;
    // Abort any in-flight request so fast typing doesn't cause UI to "stick" or show stale results.
    adminSearchAbortRef.current?.abort();
    const controller = new AbortController();
    adminSearchAbortRef.current = controller;
    const requestId = ++adminSearchRequestIdRef.current;
    setLoading(true);
    try {
      const res = await batchApi.getBatchStudents(selectedBatchId, { 
        page: currentPage, 
        page_size: 6,
        search: debouncedSearch
      }, { signal: controller.signal });
      if (controller.signal.aborted) return;
      // Ignore stale responses from older requests.
      if (requestId !== adminSearchRequestIdRef.current) return;

      if (res.success) {
        setStudents(res.data || []);
        setTotalPages(res.total_pages || 1);
        setStats(res.stats || null);
      }
    } catch (err) {
      const anyErr = err as any;
      const isCanceled =
        anyErr?.code === 'ERR_CANCELED' ||
        anyErr?.name === 'CanceledError' ||
        anyErr?.message === 'canceled';
      if (isCanceled) return;
      toast({ title: 'Error', description: 'Failed to fetch student progress', variant: 'destructive' });
    } finally {
      // Only the latest request should control loading state.
      if (requestId === adminSearchRequestIdRef.current && !controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [selectedBatchId, currentPage, debouncedSearch, toast]);

  // Fetch Weeks for Student
  const fetchStudentData = useCallback(async () => {
    if (!selectedBatchId) return;
    setLoading(true);
    try {
      const res = await batchContentApi.getWeeks(selectedBatchId);
      if (res.success) {
        const fetchedWeeks = res.data || [];
        setWeeks(fetchedWeeks);
        
        let tVideos = 0;
        let vWatched = 0;
        let tTests = 0;
        let tPassed = 0;

        fetchedWeeks.forEach(w => {
          const sessions = w.class_sessions || [];
          tVideos += sessions.length;
          vWatched += sessions.filter(s => s.is_completed).length;

          if (w.weekly_test) {
            tTests++;
            if (w.weekly_test.is_passed) tPassed++;
          }
        });

        /* Match course detail + admin table: backend week_based_progress_percent (consecutive deliverable weeks). */
        let overallProgress = 0;
        if (selectedBatchCourseId) {
          try {
            const cr = await apiClient.get<{
              success?: boolean;
              data?: { progress_percent?: number };
            }>(`/api/courses/v1/courses/${selectedBatchCourseId}/`, {
              params: { batch_id: selectedBatchId },
            });
            if (cr.data?.success && cr.data.data && typeof cr.data.data.progress_percent === 'number') {
              overallProgress = cr.data.data.progress_percent;
            }
          } catch {
            /* leave 0 */
          }
        }

        setStudentStats({
          totalVideos: tVideos,
          videosWatched: vWatched,
          totalTests: tTests,
          testsPassed: tPassed,
          overallProgress,
        });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch your progress', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId, selectedBatchCourseId, toast]);

  const fetchStudentSubmissions = useCallback(async () => {
    if (!selectedBatchId) return;
    setIsSubmissionsLoading(true);
    try {
      const res = await apiClient.get(
        `/api/courses/v1/batches/${selectedBatchId}/test-submissions/my-submissions/`,
      );
      if (res.data?.success) {
        setSubmissions(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch student submissions", err);
    } finally {
      setIsSubmissionsLoading(false);
    }
  }, [selectedBatchId]);

  useEffect(() => {
    if (selectedBatchId) {
      if (isStudent) {
        fetchStudentData();
        fetchStudentSubmissions();
      } else {
        fetchAdminData();
      }
    }
  }, [selectedBatchId, selectedBatchCourseId, isStudent, fetchAdminData, fetchStudentData, fetchStudentSubmissions]);

  // Export full report
  const handleExportBatchProgress = async (format: 'csv' | 'xlsx') => {
    if (!selectedBatchId) return;
    setIsExporting(true);
    try {
      // Fetch a large page_size to get all students for export
      const res = await batchApi.getBatchStudents(selectedBatchId, { 
        page: 1, 
        page_size: 10000 
      });
      if (res.success && res.data && res.data.length > 0) {
        const allStudents = res.data;
        
        const exportData = allStudents.map((st: any) => ({
          'Student Name': st.student_name,
          'Email': st.student_email,
          'Status': st.status,
          'Overall Progress %': st.overall_progress || 0,
          'Tests Passed': st.weekly_tests_submitted || 0,
          'Total Tests': st.total_weekly_tests || 0,
          'Videos Watched': st.videos_watched || 0,
          'Total Videos': st.total_videos || 0,
          'Enrolled Date': new Date(st.enrolled_at).toLocaleDateString()
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Progress Report");

        if (format === 'csv') {
          XLSX.writeFile(wb, `batch_progress_${selectedBatchId}.csv`);
        } else {
          XLSX.writeFile(wb, `batch_progress_${selectedBatchId}.xlsx`);
        }
        
        toast({ title: 'Success', description: 'Report exported successfully.', variant: 'success' });
      } else {
        toast({ title: 'Info', description: 'No students to export.' });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to export report.', variant: 'destructive' });
    } finally {
      setIsExporting(false);
    }
  };

  const renderAdminProgress = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex-1">
          <h1 className="font-display text-3xl font-bold text-foreground">Student Progress</h1>
          <p className="mt-1 text-muted-foreground">Track student performance across batches</p>
        </div>
        
        {/* Export Button */}
        {students.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={isExporting || loading} className="shrink-0 gap-2">
                {isExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export Report
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleExportBatchProgress('xlsx')}>
                Download as Excel
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExportBatchProgress('csv')}>
                Download as CSV
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {stats && (
        <div className="grid gap-4 sm:grid-cols-4">
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-primary/10">
                  <UserPlus className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.total}</p>
                  <p className="text-sm font-medium text-muted-foreground">Total Enrolled</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-success/10">
                  <CheckCircle className="h-6 w-6 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.completed}</p>
                  <p className="text-sm font-medium text-muted-foreground">Completed Course</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-info/10">
                  <Users className="h-6 w-6 text-info" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.active}</p>
                  <p className="text-sm font-medium text-muted-foreground">Active Learners</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-card">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-destructive/10">
                  <UserX className="h-6 w-6 text-destructive" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{stats.dropped}</p>
                  <p className="text-sm font-medium text-muted-foreground">Dropped / Pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Search Bar & Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search students by name or email..." 
            className="pl-10 h-10"
            value={search}
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
        <div className="w-full min-w-0 shrink-0 sm:w-[min(280px,100%)] sm:max-w-[280px]">
          <BatchFilterCombobox
            value={selectedBatchId?.toString() ?? ''}
            selectedLabel={selectedBatchName}
            onValueChange={handleProgressBatchChange}
            onReady={() => setLoading(false)}
            placeholder="Filter by batch"
            triggerIcon={<Filter className="h-4 w-4 text-primary" />}
            className="h-10 border-primary text-primary"
          />
        </div>
      </div>

      {/* Progress Table */}
      <Card className="shadow-card border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="table-fixed">
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="w-[22%] py-4">Student</TableHead>
                  <TableHead className="w-[12%]">Enrollment Status</TableHead>
                  <TableHead className="w-[11%]">Deliverable weeks</TableHead>
                  <TableHead className="w-[10%]">Videos</TableHead>
                  <TableHead className="w-[10%]">Tests Passed</TableHead>
                  <TableHead className="w-[20%]">Overall Progress</TableHead>
                  <TableHead className="w-[15%] text-right">Enrolled At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow>
                     <TableCell colSpan={7} className="py-12 text-center">
                       <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary opacity-50 mb-2" />
                     </TableCell>
                   </TableRow>
                ) : students.length === 0 ? (
                   <TableRow>
                    <TableCell colSpan={7} className="h-[300px]">
                       <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl mx-2">
                         <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
                         <h3 className="text-lg font-medium mb-1">
                           {debouncedSearch
                             ? `No students matching "${debouncedSearch}"`
                             : 'No students found'}
                         </h3>
                         <p className="max-w-sm mx-auto">
                           {debouncedSearch
                             ? `We couldn't find any students matching "${debouncedSearch}". Try different keywords.`
                             : 'There is no student progress data to display for this batch yet.'}
                         </p>
                       </div>
                     </TableCell>
                   </TableRow>
                ) : students.map((enrollment: any) => {
                  const weeksCompleted = Number(enrollment.weeks_completed || 0);
                  const totalWeeks = Number(enrollment.total_weeks || 0);

                  return (
                    <TableRow
                      key={enrollment.id}
                      className="cursor-pointer hover:bg-muted/30 transition-colors"
                      onClick={() => setSelectedEnrollment(enrollment)}
                    >
                      <TableCell className="min-w-0">
                        <div className="flex min-w-0 items-center gap-3 py-1">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20 overflow-hidden">
                            {enrollment.profile_picture ? (
                              <img
                                src={enrollment.profile_picture}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <span className="text-sm font-bold text-primary">
                                {enrollment.student_name?.charAt(0)}
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-foreground truncate">{enrollment.student_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{enrollment.student_email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] h-5 py-0 px-2 tracking-wide font-bold capitalize",
                            enrollment.status === 'active'
                              ? "bg-success/10 text-success border-success/30"
                              : enrollment.status === 'completed'
                                ? "bg-primary/10 text-primary border-primary/30"
                                : enrollment.status === 'dropped'
                                  ? "bg-destructive/10 text-destructive border-destructive/30"
                                  : "bg-muted text-muted-foreground border-border",
                          )}
                        >
                          {enrollment.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center">
                          <span className="font-medium tabular-nums">
                            {weeksCompleted}
                          </span>
                          <span className="text-muted-foreground text-xs ml-1 tabular-nums">
                            / {totalWeeks}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{enrollment.videos_watched || 0}</span>
                        <span className="text-muted-foreground text-xs ml-1">/ {enrollment.total_videos || 0}</span>
                      </TableCell>
                      <TableCell>
                        <span className="font-medium">{enrollment.weekly_tests_submitted || 0}</span>
                        <span className="text-muted-foreground text-xs ml-1">/ {enrollment.total_weekly_tests || 0}</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="h-2 min-w-0 flex-1 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                enrollment.overall_progress >= 100 ? 'bg-success' : 'bg-primary'
                              }`}
                              style={{ width: `${Math.min(100, enrollment.overall_progress || 0)}%` }}
                            />
                          </div>
                          <span className="text-sm font-bold tabular-nums text-foreground shrink-0">
                            {enrollment.overall_progress || 0}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground text-sm tabular-nums whitespace-nowrap">
                        {formatEnrolledDate(enrollment.enrolled_at)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination - outside the card, matching user management page */}
      {!loading && students.length > 0 && totalPages > 1 && (
        <div className="flex w-full items-center justify-center gap-2 py-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
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
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );

  // --- Student Detail Sheet ---
  const renderStudentDetailSheet = () => {
    const e = selectedEnrollment;
    if (!e) return null;

    const weekDetails: any[] = e.week_details || [];
    const accessByWeekNumber = new Map<number, { is_manually_unlocked?: boolean; is_system_unlocked?: boolean }>(
      (Array.isArray(e.weeks_access_status) ? e.weeks_access_status : []).map((row: any) => [
        Number(row.week_number),
        row,
      ]),
    );
    return (
      <Sheet open={!!selectedEnrollment} onOpenChange={(open) => { if (!open) setSelectedEnrollment(null); }}>
        <SheetContent
          side="right"
          className={cn(
            'w-full sm:max-w-[540px] overflow-y-auto border-l border-border p-0',
            /* Close: neutral on gradient header; kill Radix open/hover bg (light mode gray pill) and hover flash */
            '[&>button]:right-4 [&>button]:top-4 [&>button]:z-10 [&>button]:flex [&>button]:h-9 [&>button]:w-9 [&>button]:items-center [&>button]:justify-center [&>button]:rounded-full',
            '[&>button]:border-0 [&>button]:bg-transparent [&>button]:shadow-none [&>button]:backdrop-blur-0',
            '[&>button]:text-primary-foreground [&>button]:opacity-85',
            '[&>button]:transition-none [&>button]:hover:bg-transparent [&>button]:hover:opacity-85',
            '[&>button]:data-[state=open]:bg-transparent',
            '[&>button]:focus:outline-none [&>button]:focus:ring-2 [&>button]:focus:ring-primary-foreground/35 [&>button]:focus:ring-offset-0',
            '[&>button>svg]:h-4 [&>button>svg]:w-4 [&>button>svg]:stroke-[2.25]',
          )}
        >
          {/* Header — same token as course detail hero (`gradient-primary` in index.css) */}
          <div className="relative overflow-hidden gradient-primary text-primary-foreground shadow-card border-b border-white/10">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
              <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-primary/20 blur-2xl" />
            </div>
            <SheetHeader className="relative space-y-0 p-6 pb-6 pr-14 pt-5 text-left">
              <div className="flex items-start gap-4">
                <Avatar className="h-20 w-20 shrink-0 border-2 border-white/25 shadow-lg ring-4 ring-white/10">
                  <AvatarImage src={e.profile_picture || undefined} alt="" className="object-cover" />
                  <AvatarFallback className="bg-white/20 text-lg font-black text-primary-foreground">
                    {e.student_name?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <SheetTitle className="truncate text-xl font-bold tracking-tight text-primary-foreground">
                    {e.student_name}
                  </SheetTitle>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 shrink-0 opacity-85" />
                    <span className="truncate text-sm text-primary-foreground/85">{e.student_email}</span>
                  </div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <CalendarDays className="h-3.5 w-3.5 shrink-0 opacity-85" />
                    <span className="text-sm text-primary-foreground/85">
                      Joined {formatEnrolledDate(e.enrolled_at)}
                    </span>
                  </div>
                  <div className="mt-3">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold capitalize',
                        e.status === 'active'
                          ? 'bg-emerald-500 text-white border-emerald-600'
                          : e.status === 'completed'
                            ? 'bg-white/25 text-white border-white/50'
                            : 'bg-rose-500 text-white border-rose-600',
                      )}
                    >
                      {e.status}
                    </span>
                  </div>
                </div>
              </div>
            </SheetHeader>
          </div>

          <div className="p-6 space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Card className="shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-xs font-semibold text-muted-foreground">Progress</span>
                  </div>
                  <p className="text-2xl font-black text-foreground">{e.overall_progress || 0}%</p>
                  <ProgressBar value={e.overall_progress || 0} className="h-1.5 mt-2" />
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <VideoIcon className="h-4 w-4 text-info" />
                    <span className="text-xs font-semibold text-muted-foreground">Videos</span>
                  </div>
                  <p className="text-2xl font-black text-foreground">
                    {e.videos_watched || 0}
                    <span className="text-sm font-medium text-muted-foreground"> / {e.total_videos || 0}</span>
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <FileText className="h-4 w-4 text-success" />
                    <span className="text-xs font-semibold text-muted-foreground">Tests passed</span>
                  </div>
                  <p className="text-2xl font-black text-foreground">
                    {e.weekly_tests_submitted || 0}
                    <span className="text-sm font-medium text-muted-foreground"> / {e.total_weekly_tests || 0}</span>
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Weekly Breakdown */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Award className="h-5 w-5 text-primary" />
                <h3 className="font-black font-display text-base">Weekly Breakdown</h3>
              </div>

              {weekDetails.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground border-2 border-dashed border-border/50 rounded-2xl">
                  <p className="text-sm">No week data available yet.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {weekDetails.map((week: any) => {
                    const hasTest = week.test?.exists;
                    const isAttempted = week.test?.attempted;
                    const testPassed = !!week.test?.is_passed;
                    const hasDeliverables =
                      typeof week.has_deliverables === 'boolean'
                        ? week.has_deliverables
                        : week.total_videos > 0 || hasTest;
                    const accessRow = accessByWeekNumber.get(Number(week.week_number));
                    const reachableFallback =
                      accessRow != null &&
                      !!(accessRow.is_manually_unlocked || accessRow.is_system_unlocked);
                    const studentWeekReachable =
                      typeof week.student_week_reachable === 'boolean'
                        ? week.student_week_reachable
                        : reachableFallback;
                    const videosComplete =
                      week.total_videos === 0 || week.videos_watched >= week.total_videos;
                    const testRequirementMet = !hasTest || (isAttempted && testPassed);
                    const weekPassed =
                      hasDeliverables &&
                      studentWeekReachable &&
                      videosComplete &&
                      testRequirementMet;
                    const vidPct = week.total_videos > 0 ? Math.round((week.videos_watched / week.total_videos) * 100) : 0;

                    return (
                      <div key={week.week_number} className="p-4 rounded-xl border bg-card shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={cn(
                            "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-black",
                            weekPassed ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
                          )}>
                            {weekPassed ? <CheckCircle className="h-5 w-5" /> : week.week_number}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm text-foreground truncate">Week {week.week_number}: {week.title}</p>
                              {weekPassed && (
                                <Badge className="h-4 shrink-0 bg-success px-1.5 text-[9px] font-semibold capitalize text-white">
                                  Passed
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-2">
                          {/* Videos */}
                          <div className="flex items-center gap-2">
                            <VideoIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <div className="flex-1">
                              <div className="flex justify-between mb-1">
                                <span className="text-xs text-muted-foreground">Videos watched</span>
                                <span className="text-xs font-bold">{week.videos_watched}/{week.total_videos}</span>
                              </div>
                              <ProgressBar value={vidPct} className="h-1.5" />
                            </div>
                          </div>

                          {/* Test */}
                          {hasTest ? (
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Test</span>
                              </div>
                              {!isAttempted ? (
                                <span className="text-xs text-muted-foreground font-medium">Not attempted</span>
                              ) : (
                                <span className={cn(
                                  "text-xs font-bold",
                                  testPassed ? 'text-success' : 'text-destructive'
                                )}>
                                  {week.test.score !== null && week.test.score !== undefined
                                    ? `${formatTestScorePercent(week.test.score)}%`
                                    : '—'}{' '}
                                  {testPassed ? '✓ Passed' : '✗ Failed'}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5">
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">No test for this week</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2">
              <Button 
                variant="outline" 
                className="flex-1"
                onClick={() => navigate(`/batches/${selectedBatchId}/students`)}
              >
                View in Batch Students
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  };

  const renderStudentProgress = () => (
    <div className="space-y-6">
      {/* Header with Batch Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">My Progress</h1>
          <p className="mt-1 text-muted-foreground">Track your learning journey for this program</p>
        </div>
        <div className="w-full min-w-0 shrink-0 sm:w-[min(280px,100%)] sm:max-w-[280px]">
          <BatchFilterCombobox
            value={selectedBatchId?.toString() ?? ''}
            selectedLabel={selectedBatchName}
            onValueChange={handleProgressBatchChange}
            onReady={() => setLoading(false)}
            placeholder="Select course batch"
            triggerIcon={<BookOpen className="h-4 w-4 text-primary" />}
            className="h-10 border-primary text-primary"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Overall stats — match course detail hero: gradient-primary, border, soft blurs */}
          <Card className="relative overflow-hidden rounded-2xl border border-primary/20 bg-transparent shadow-card gradient-primary text-primary-foreground backdrop-blur-none">
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-white/5 blur-3xl" />
              <div className="absolute bottom-0 left-0 h-32 w-32 rounded-full bg-primary/20 blur-2xl" />
            </div>
            <CardContent className="relative z-10 p-6 md:p-8">
              <div className="grid gap-8 sm:grid-cols-3 sm:gap-6">
                <div className="sm:border-r sm:border-white/20 sm:pr-6">
                  <p className="text-sm font-semibold text-primary-foreground/80">Overall progress</p>
                  <div className="mt-1.5 flex items-end gap-2">
                    <p className="font-display text-4xl font-black md:text-5xl">{studentStats.overallProgress}%</p>
                  </div>
                  <div className="mt-3 h-2 w-full max-w-full overflow-hidden rounded-full border border-white/10 bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-emerald-500 shadow-[0_0_10px_rgba(52,211,153,0.35)] transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(0, studentStats.overallProgress))}%` }}
                    />
                  </div>
                </div>
                <div className="sm:border-r sm:border-white/20 sm:pr-6">
                  <p className="text-sm font-semibold text-primary-foreground/80">Videos watched</p>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <p className="font-display text-3xl font-black md:text-4xl">{studentStats.videosWatched}</p>
                    <p className="text-lg font-bold text-primary-foreground/60">/{studentStats.totalVideos}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold text-primary-foreground/80">Tests passed</p>
                  <div className="mt-1.5 flex items-baseline gap-1">
                    <p className="font-display text-3xl font-black md:text-4xl">{studentStats.testsPassed}</p>
                    <p className="text-lg font-bold text-primary-foreground/60">/{studentStats.totalTests}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Weekly Progress Card */}
          <Card className="shadow-card">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl font-display font-black">
                    <Award className="h-5 w-5 text-primary" />
                    Weekly Progress
                  </CardTitle>
                  <CardDescription className="mt-0.5">Complete each week's content to unlock the next</CardDescription>
                </div>
                {selectedBatchId && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-10 shrink-0 gap-1.5 rounded-xl border-border bg-background font-bold"
                    onClick={() => {
                      if (selectedBatchCourseId) {
                        navigate(`/courses/${selectedBatchCourseId}`);
                      } else {
                        navigate('/courses');
                      }
                    }}
                  >
                    View All
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {weeks.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted/40 px-6 py-12 text-center">
                  <p className="text-muted-foreground">No weeks have been published for this batch yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {weeks.slice(0, 5).map((week) => {
                    const totalWeekVids = week.class_sessions?.length || 0;
                    const completedWeekVids = week.class_sessions?.filter(s => s.is_completed).length || 0;
                    const weekTestScore = week.weekly_test?.latest_submission?.score;
                    const hasWeeklyTest = !!week.weekly_test;
                    const testPassed = !!week.weekly_test?.is_passed;
                    const videosComplete =
                      totalWeekVids === 0 || completedWeekVids >= totalWeekVids;
                    const testRequirementMet = !hasWeeklyTest || testPassed;
                    const weekComplete = videosComplete && testRequirementMet;
                    /* Match course page: use student_lock_status, not calendar-only is_unlocked */
                    const studentLocked =
                      week.student_lock_status != null
                        ? week.student_lock_status.is_locked
                        : !week.is_unlocked;
                    const showWeekPassed = !studentLocked && weekComplete;

                    return (
                      <div
                        key={week.id}
                        className={cn(
                          'group flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 transition-all hover:bg-accent/20 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between',
                          studentLocked && 'opacity-80',
                        )}
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <div
                            className={cn(
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-black transition-colors',
                              showWeekPassed
                                ? 'bg-success/10 text-success group-hover:bg-success/15'
                                : !studentLocked
                                  ? 'bg-primary/10 text-primary group-hover:bg-primary/15'
                                  : 'bg-muted text-muted-foreground',
                            )}
                          >
                            {showWeekPassed ? (
                              <CheckCircle className="h-5 w-5" />
                            ) : !studentLocked ? (
                              <span className="font-black">{week.week_number}</span>
                            ) : (
                              <Lock className="h-4 w-4" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1 space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <p
                                className={cn(
                                  'truncate font-medium text-foreground',
                                  studentLocked && 'text-muted-foreground',
                                )}
                              >
                                Week {week.week_number}: {week.title}
                              </p>
                              {showWeekPassed && (
                                <Badge
                                  variant="outline"
                                  className="rounded-lg border-success/30 bg-success/10 px-2 py-0.5 text-[10px] font-black text-success shadow-sm"
                                >
                                  Passed
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-medium">
                                <VideoIcon className="h-3 w-3 shrink-0" />
                                {completedWeekVids}/{totalWeekVids} videos
                              </span>
                              {week.weekly_test && (
                                <span className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 font-medium">
                                  <FileText className="h-3 w-3 shrink-0" />
                                  {weekTestScore !== undefined && weekTestScore !== null ? (
                                    <span className={testPassed ? 'font-bold text-success' : 'font-bold text-warning'}>
                                      Test: {formatTestScorePercent(weekTestScore)}%
                                    </span>
                                  ) : (
                                    'Test: Not attempted'
                                  )}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {studentLocked ? (
                          <div className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-muted-foreground sm:self-center">
                            <Lock className="h-3.5 w-3.5" />
                            Locked
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assessment list — same row pattern as Assessments page (student view) */}
          <Card className="mt-6 shadow-card">
            <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2 text-xl font-display font-bold">
                  <FileText className="h-5 w-5 text-primary" />
                  Assessments
                </CardTitle>
                <CardDescription className="mt-0.5">
                  Review your test submissions and scores
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="h-10 shrink-0 gap-1.5 rounded-xl border-border bg-background font-bold sm:mt-0"
                onClick={() => navigate('/assessments')}
              >
                View All
                <ChevronRight className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              {isSubmissionsLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : submissions.length === 0 ? (
                <div className="rounded-xl border border-border bg-muted/40 px-6 py-16 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-warning/10">
                    <FileText className="h-6 w-6 text-warning" />
                  </div>
                  <h3 className="text-lg font-semibold text-foreground">No assessments yet</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
                    Complete lessons and weekly tests for this batch. Submissions will appear here and on the Assessments page.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.slice(0, 5).map((assessment) => {
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
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-medium text-foreground">{assessment.test_title}</p>
                              {assessment.status === 'published' ? (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    'rounded-lg px-2 py-0.5 text-[10px] font-black shadow-sm',
                                    assessment.is_passed
                                      ? 'border-success/30 bg-success/10 text-success'
                                      : 'border-rose-500/30 bg-rose-500/10 text-rose-500',
                                  )}
                                >
                                  {assessment.is_passed ? 'Passed' : 'Failed'}
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="rounded-lg border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-black text-primary"
                                >
                                  {formatSubmissionStatusLabel(assessment.status)}
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
                                Submitted{' '}
                                {assessment.submitted_at
                                  ? format(new Date(assessment.submitted_at), 'MMM d, h:mm a')
                                  : '—'}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex shrink-0 flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end sm:gap-4">
                          {assessment.status === 'published' ? (
                            <div className="flex flex-col items-end gap-1 sm:text-right">
                              <p className="text-xs font-semibold tabular-nums text-foreground">
                                Score: {formatTestScorePercent(assessment.marks_obtained)}%
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
                              'h-10 rounded-xl px-6 font-bold sm:w-auto',
                              assessment.status !== 'published' ? 'shadow-none hover:shadow-none' : '',
                            )}
                            onClick={() => navigate('/assessments')}
                          >
                            {assessment.status === 'published' ? 'View results' : 'View submission'}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 pb-10">
         {/* Content Layer based on Role */}
         <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 delay-100">
           {isStudent ? renderStudentProgress() : renderAdminProgress()}
         </div>
      </div>
      {/* Student Detail Slide-out Panel */}
      {!isStudent && renderStudentDetailSheet()}
    </DashboardLayout>
  );
}

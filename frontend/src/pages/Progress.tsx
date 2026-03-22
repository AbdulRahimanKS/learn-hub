import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { batchApi, batchContentApi, BatchWeek } from '@/lib/batch-api';
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

export default function Progress() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isStudent = user?.role === 'student';

  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [selectedBatchName, setSelectedBatchName] = useState('');
  
  // Shared loading
  const [loading, setLoading] = useState(true);

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
    avgScore: 0,
    overallProgress: 0
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

  // Fetch Batches
  const fetchBatches = useCallback(async () => {
    try {
      const res = await batchApi.getBatches({ paginate: false });
      if (res.success && Array.isArray(res.data) && res.data.length > 0) {
        setBatches(res.data);
        setSelectedBatchId(res.data[0].id);
        setSelectedBatchName(res.data[0].name);
      } else {
        setLoading(false);
      }
    } catch (err) {
      setLoading(false);
      toast({ title: 'Error', description: 'Failed to fetch batches', variant: 'destructive' });
    }
  }, [toast]);

  useEffect(() => {
    fetchBatches();
  }, [fetchBatches]);

  // Fetch Students for Admin
  const fetchAdminData = useCallback(async () => {
    if (!selectedBatchId) return;
    setLoading(true);
    try {
      const res = await batchApi.getBatchStudents(selectedBatchId, { 
        page: currentPage, 
        page_size: 10,
        search: debouncedSearch
      });
      if (res.success) {
        setStudents(res.data || []);
        setTotalPages(res.total_pages || 1);
        setStats(res.stats || null);
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch student progress', variant: 'destructive' });
    } finally {
      setLoading(false);
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
        let totalScore = 0;
        let scoredTests = 0;

        fetchedWeeks.forEach(w => {
          const sessions = w.class_sessions || [];
          tVideos += sessions.length;
          vWatched += sessions.filter(s => s.is_completed).length;

          if (w.weekly_test) {
            tTests++;
            if (w.weekly_test.is_passed) tPassed++;
            const score = w.weekly_test.latest_submission?.score;
            if (score !== undefined && score !== null) {
              totalScore += score;
              scoredTests++;
            }
          }
        });

        const overall = (tVideos + tTests) > 0 
          ? Math.round(((vWatched + tPassed) / (tVideos + tTests)) * 100) 
          : 0;

        setStudentStats({
          totalVideos: tVideos,
          videosWatched: vWatched,
          totalTests: tTests,
          testsPassed: tPassed,
          avgScore: scoredTests > 0 ? Math.round(totalScore / scoredTests) : 0,
          overallProgress: overall
        });
      }
    } catch (err) {
      toast({ title: 'Error', description: 'Failed to fetch your progress', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [selectedBatchId, toast]);

  const fetchStudentSubmissions = useCallback(async () => {
    if (!selectedBatchId) return;
    setIsSubmissionsLoading(true);
    try {
      const res = await apiClient.get(`/api/courses/v1/test-submissions/my-submissions/?batch_id=${selectedBatchId}`);
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
  }, [selectedBatchId, isStudent, fetchAdminData, fetchStudentData, fetchStudentSubmissions]);

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

  const AdminProgress = () => (
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
                  <TrendingUp className="h-6 w-6 text-primary" />
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
                  <Award className="h-6 w-6 text-info" />
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
                  <Clock className="h-6 w-6 text-destructive" />
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
        <div className="w-[220px] shrink-0">
          <Select 
            value={selectedBatchId?.toString()} 
            onValueChange={(val) => {
              const bId = Number(val);
              setSelectedBatchId(bId);
              const selectedBatch = batches.find(b => b.id === bId);
              if (selectedBatch) {
                setSelectedBatchName(selectedBatch.name);
              }
              setCurrentPage(1);
              setSearch('');
            }}
            disabled={batches.length === 0}
          >
            <SelectTrigger className="h-10 border-primary text-primary">
              <div className="flex items-center">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by Batch" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {batches.map(batch => (
                <SelectItem key={batch.id} value={batch.id.toString()}>
                  {batch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Progress Table */}
      <Card className="shadow-card border-border/50">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="py-4">Student</TableHead>
                  <TableHead>Enrollment Status</TableHead>
                  <TableHead>Videos</TableHead>
                  <TableHead>Tests Passed</TableHead>
                  <TableHead>Overall Progress</TableHead>
                  <TableHead className="text-right">Enrolled At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                   <TableRow>
                     <TableCell colSpan={6} className="py-12 text-center">
                       <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary opacity-50 mb-2" />
                       <p className="text-sm text-muted-foreground">Loading progress...</p>
                     </TableCell>
                   </TableRow>
                ) : students.length === 0 ? (
                   <TableRow>
                     <TableCell colSpan={6} className="py-12 text-center text-muted-foreground">
                       No students found in this batch matching your criteria.
                     </TableCell>
                   </TableRow>
                ) : students.map((enrollment: any) => (
                  <TableRow 
                    key={enrollment.id} 
                    className="cursor-pointer hover:bg-muted/30 transition-colors" 
                    onClick={() => setSelectedEnrollment(enrollment)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3 py-1">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 border border-primary/20">
                          <span className="text-sm font-bold text-primary">
                            {enrollment.student_name.charAt(0)}
                          </span>
                        </div>
                        <div className="min-w-0">
                           <p className="font-bold text-foreground truncate">{enrollment.student_name}</p>
                           <p className="text-xs text-muted-foreground truncate">{enrollment.student_email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn(
                        "text-[10px] h-5 py-0 px-2 tracking-wide font-bold capitalize",
                        enrollment.status === 'active' ? "bg-success/10 text-success border-success/30" : 
                        enrollment.status === 'completed' ? "bg-primary/10 text-primary border-primary/30" :
                        enrollment.status === 'dropped' ? "bg-destructive/10 text-destructive border-destructive/30" :
                        "bg-muted text-muted-foreground border-border"
                      )}>
                         {enrollment.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                       <span className="font-medium">
                         {enrollment.videos_watched || 0}
                       </span>
                       <span className="text-muted-foreground text-xs ml-1">
                         / {enrollment.total_videos || 0}
                       </span>
                    </TableCell>
                    <TableCell>
                       <span className="font-medium">
                         {enrollment.weekly_tests_submitted || 0}
                       </span>
                       <span className="text-muted-foreground text-xs ml-1">
                         / {enrollment.total_weekly_tests || 0}
                       </span>
                    </TableCell>
                    <TableCell className="w-1/4">
                      <div className="flex items-center gap-3">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden shrink-0">
                          <div
                            className={`h-full rounded-full ${
                              enrollment.overall_progress >= 100 ? 'bg-success' : 'bg-primary'
                            }`}
                            style={{ width: `${Math.min(100, enrollment.overall_progress || 0)}%` }}
                          />
                        </div>
                        <span className="text-sm font-bold w-12 text-foreground">
                          {enrollment.overall_progress || 0}%
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground text-sm">
                       {new Date(enrollment.enrolled_at).toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          
          {/* Pagination */}
          {!loading && students.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 p-4 border-t">
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Previous</Button>
              <span className="text-sm font-medium text-muted-foreground w-20 text-center">Page {currentPage} of {totalPages}</span>
              <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Next</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );

  // --- Student Detail Sheet ---
  const StudentDetailSheet = () => {
    const e = selectedEnrollment;
    if (!e) return null;

    const weekDetails: any[] = e.week_details || [];
    const avgScore = (() => {
      const attempted = weekDetails.filter((w: any) => w.test?.attempted && w.test?.score !== null);
      if (!attempted.length) return null;
      const sum = attempted.reduce((acc: number, w: any) => acc + (w.test.score || 0), 0);
      return Math.round(sum / attempted.length);
    })();

    return (
      <Sheet open={!!selectedEnrollment} onOpenChange={(open) => { if (!open) setSelectedEnrollment(null); }}>
        <SheetContent side="right" className="w-full sm:max-w-[540px] overflow-y-auto p-0">
          {/* Header */}
          <div className="bg-gradient-to-br from-primary/90 to-primary p-6 text-white">
            <SheetHeader>
              <div className="flex items-start gap-4">
                <div className="h-16 w-16 rounded-2xl bg-white/20 border border-white/30 flex items-center justify-center shrink-0 shadow-lg">
                  <span className="text-2xl font-black">{e.student_name?.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-white text-xl font-black truncate">{e.student_name}</SheetTitle>
                  <div className="flex items-center gap-1.5 mt-1">
                    <Mail className="h-3.5 w-3.5 opacity-80" />
                    <span className="text-white/80 text-sm truncate">{e.student_email}</span>
                  </div>
                  <div className="flex items-center gap-1.5 mt-1">
                    <CalendarDays className="h-3.5 w-3.5 opacity-80" />
                    <span className="text-white/80 text-sm">
                      Joined {new Date(e.enrolled_at).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </span>
                  </div>
                  <div className="mt-2">
                    <Badge className={cn(
                      "text-[10px] font-black capitalize border-0",
                      e.status === 'active' ? 'bg-success/30 text-white' :
                      e.status === 'completed' ? 'bg-white/30 text-white' :
                      'bg-destructive/40 text-white'
                    )}>
                      {e.status}
                    </Badge>
                  </div>
                </div>
              </div>
            </SheetHeader>
          </div>

          <div className="p-6 space-y-6">
            {/* Top Stat Cards */}
            <div className="grid grid-cols-2 gap-3">
              <Card className="shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Progress</span>
                  </div>
                  <p className="text-2xl font-black text-foreground">{e.overall_progress || 0}%</p>
                  <ProgressBar value={e.overall_progress || 0} className="h-1.5 mt-2" />
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <VideoIcon className="h-4 w-4 text-info" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Videos</span>
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
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Tests Passed</span>
                  </div>
                  <p className="text-2xl font-black text-foreground">
                    {e.weekly_tests_submitted || 0}
                    <span className="text-sm font-medium text-muted-foreground"> / {e.total_weekly_tests || 0}</span>
                  </p>
                </CardContent>
              </Card>
              <Card className="shadow-card">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <Award className="h-4 w-4 text-warning" />
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Avg Score</span>
                  </div>
                  <p className="text-2xl font-black text-foreground">
                    {avgScore !== null ? `${avgScore}%` : '—'}
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
                    const isPassed = week.test?.is_passed;
                    const hasTest = week.test?.exists;
                    const isAttempted = week.test?.attempted;
                    const vidPct = week.total_videos > 0 ? Math.round((week.videos_watched / week.total_videos) * 100) : 0;

                    return (
                      <div key={week.week_number} className="p-4 rounded-xl border bg-card shadow-sm">
                        <div className="flex items-center gap-3 mb-3">
                          <div className={cn(
                            "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 text-sm font-black",
                            isPassed ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'
                          )}>
                            {isPassed ? <CheckCircle className="h-5 w-5" /> : week.week_number}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm text-foreground truncate">Week {week.week_number}: {week.title}</p>
                              {isPassed && (
                                <Badge className="bg-success text-white text-[9px] h-4 px-1.5 shrink-0">PASSED</Badge>
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
                                  isPassed ? 'text-success' : 'text-destructive'
                                )}>
                                  {week.test.score !== null ? `${week.test.score}%` : '—'} {isPassed ? '✓ Passed' : '✗ Failed'}
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

  const StudentProgress = () => (
    <div className="space-y-6">
      {/* Header with Batch Selector */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold text-foreground">My Progress</h1>
          <p className="mt-1 text-muted-foreground">Track your learning journey for this program</p>
        </div>
        <div className="w-[220px] shrink-0">
          <Select 
            value={selectedBatchId?.toString()} 
            onValueChange={(val) => {
              const bId = Number(val);
              setSelectedBatchId(bId);
              const selectedBatch = batches.find(b => b.id === bId);
              if (selectedBatch) {
                setSelectedBatchName(selectedBatch.name);
              }
            }}
            disabled={batches.length === 0}
          >
            <SelectTrigger className="h-10 border-primary text-primary">
              <div className="flex items-center">
                <BookOpen className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Select course batch" />
              </div>
            </SelectTrigger>
            <SelectContent>
              {batches.map(batch => (
                <SelectItem key={batch.id} value={batch.id.toString()}>
                  {batch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-4 border rounded-2xl bg-card">
           <Loader2 className="h-8 w-8 animate-spin text-primary opacity-50" />
           <p className="text-muted-foreground font-medium">Calculating progress...</p>
        </div>
      ) : (
        <>
          {/* Overall Stats Banner */}
          <Card className="shadow-xl bg-gradient-to-br from-[#1a237e] via-[#283593] to-[#3949ab] text-white overflow-hidden border-none rounded-2xl">
            <CardContent className="p-6 md:p-8 relative">
              <div className="absolute top-0 right-0 p-8 pointer-events-none opacity-5 hidden md:block">
                 <TrendingUp className="h-48 w-48" />
              </div>
              <div className="grid gap-6 sm:grid-cols-4 relative z-10">
                <div className="sm:border-r sm:border-white/20 sm:pr-6">
                  <p className="text-white/70 text-xs font-bold tracking-widest uppercase">Overall Progress</p>
                  <div className="flex items-end gap-2 mt-1.5">
                    <p className="text-4xl md:text-5xl font-black font-display">{studentStats.overallProgress}%</p>
                  </div>
                  <ProgressBar value={studentStats.overallProgress} className="mt-3 h-1.5 bg-white/20" />
                </div>
                <div>
                  <p className="text-white/70 text-xs font-bold tracking-widest uppercase">Videos Watched</p>
                  <div className="flex items-baseline gap-1 mt-1.5">
                     <p className="text-3xl md:text-4xl font-black font-display">{studentStats.videosWatched}</p>
                     <p className="text-white/60 font-bold text-lg">/{studentStats.totalVideos}</p>
                  </div>
                </div>
                <div>
                  <p className="text-white/70 text-xs font-bold tracking-widest uppercase">Tests Passed</p>
                  <div className="flex items-baseline gap-1 mt-1.5">
                     <p className="text-3xl md:text-4xl font-black font-display">{studentStats.testsPassed}</p>
                     <p className="text-white/60 font-bold text-lg">/{studentStats.totalTests}</p>
                  </div>
                </div>
                <div>
                  <p className="text-white/70 text-xs font-bold tracking-widest uppercase">Average Score</p>
                  <div className="flex items-baseline gap-1 mt-1.5">
                     <p className="text-3xl md:text-4xl font-black font-display">
                       {studentStats.avgScore > 0 ? `${studentStats.avgScore}%` : '—'}
                     </p>
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
                    className="shrink-0 gap-1.5 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground dark:border-primary/50"
                    onClick={() => {
                      const batch = batches.find(b => b.id === selectedBatchId);
                      if (batch?.course) {
                        navigate(`/courses/${batch.course}`);
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
                <div className="py-12 border-2 border-dashed border-border/50 text-center rounded-2xl">
                  <p className="text-muted-foreground">No weeks have been published for this batch yet.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {weeks.slice(0, 5).map((week) => {
                    const totalWeekVids = week.class_sessions?.length || 0;
                    const completedWeekVids = week.class_sessions?.filter(s => s.is_completed).length || 0;
                    const weekTestScore = week.weekly_test?.latest_submission?.score;
                    const isWeekPassed = week.weekly_test?.is_passed;
                    const vidPct = totalWeekVids > 0 ? Math.round((completedWeekVids / totalWeekVids) * 100) : 0;

                    return (
                      <div
                        key={week.id}
                        className={cn(
                          "flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all",
                          week.is_unlocked 
                            ? "bg-card border-border hover:border-primary/30 hover:bg-muted/20" 
                            : "bg-muted/20 border-border/30 opacity-60"
                        )}
                      >
                        {/* Week Icon */}
                        <div className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black text-sm transition-colors",
                          isWeekPassed 
                            ? 'bg-success/10 text-success' 
                            : week.is_unlocked 
                              ? 'bg-primary/10 text-primary' 
                              : 'bg-muted text-muted-foreground border border-border'
                        )}>
                          {isWeekPassed ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : week.is_unlocked ? (
                            <span className="font-black">{week.week_number}</span>
                          ) : (
                            <Lock className="h-4 w-4" />
                          )}
                        </div>

                        {/* Week Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={cn("font-bold text-sm truncate", week.is_unlocked ? 'text-foreground' : 'text-muted-foreground')}>
                              Week {week.week_number}: {week.title}
                            </p>
                            {isWeekPassed && (
                              <Badge className="bg-success text-white text-[9px] h-4 px-1.5 shrink-0 font-black">PASSED</Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <VideoIcon className="h-3 w-3" />
                              {completedWeekVids}/{totalWeekVids} videos
                            </span>
                            {week.weekly_test && (
                              <span className="flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {weekTestScore !== undefined && weekTestScore !== null ? (
                                  <span className={isWeekPassed ? 'text-success font-bold' : 'text-warning font-bold'}>
                                    Test: {weekTestScore}%
                                  </span>
                                ) : 'Test: Not Attempted'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Right section: Progress bar OR Locked badge */}
                        <div className="shrink-0 flex items-center gap-3">
                          {week.is_unlocked ? (
                            <div className="w-28 hidden sm:block">
                              <ProgressBar value={vidPct} className="h-1.5" />
                            </div>
                          ) : (
                            <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                              <Lock className="h-3 w-3" />
                              Locked
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assessment List Card */}
          <Card className="shadow-card mt-6">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl font-display font-black">
                    <FileText className="h-5 w-5 text-primary" />
                    Assessments
                  </CardTitle>
                  <CardDescription className="mt-0.5">Review your test submissions and scores</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="shrink-0 gap-1.5 border-primary/40 text-primary hover:bg-primary hover:text-primary-foreground dark:border-primary/50"
                  onClick={() => navigate('/assessments')}
                >
                  View All
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              {isSubmissionsLoading ? (
                <div className="py-12 flex flex-col items-center justify-center gap-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary opacity-50" />
                  <p className="text-muted-foreground text-sm">Loading assessments...</p>
                </div>
              ) : submissions.length === 0 ? (
                <div className="py-12 border-2 border-dashed border-border/50 text-center rounded-2xl">
                  <p className="text-muted-foreground">No assessments found for this batch.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {submissions.slice(0, 5).map((assessment) => (
                    <div
                      key={assessment.id}
                      className="flex flex-col md:flex-row md:items-center justify-between p-4 rounded-xl border bg-card hover:border-primary/30 hover:bg-muted/10 transition-all cursor-pointer"
                      onClick={() => navigate('/assessments')}
                    >
                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "p-2.5 rounded-xl shrink-0 transition-colors",
                          assessment.status === 'published' 
                            ? "bg-success/10 text-success" 
                            : "bg-warning/10 text-warning"
                        )}>
                          {assessment.status === 'published' ? (
                            <CheckCircle className="h-5 w-5" />
                          ) : (
                            <Clock className="h-5 w-5" />
                          )}
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-bold text-sm text-foreground">{assessment.test_title}</h3>
                          <div className="flex items-center gap-2">
                             <Badge variant="outline" className="border-border text-muted-foreground font-bold text-[8px] uppercase tracking-wider px-1.5 h-4">
                               Week {assessment.week_number}
                             </Badge>
                             <span className="text-[10px] text-muted-foreground font-medium uppercase">
                               Attempt {assessment.attempt_number}
                             </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 mt-4 md:mt-0 pt-3 md:pt-0 border-t md:border-t-0 border-border/50">
                        {assessment.status === 'published' ? (
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <p className="text-lg font-black text-foreground">{assessment.marks_obtained}%</p>
                              <p className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Score</p>
                            </div>
                            <Badge className={cn(
                              "font-black uppercase text-[8px] px-1.5 h-4 border-none shrink-0",
                              assessment.is_passed 
                                ? "bg-emerald-500/20 text-emerald-600" 
                                : "bg-rose-500/20 text-rose-600"
                            )}>
                              {assessment.is_passed ? 'Passed' : 'Failed'}
                            </Badge>
                          </div>
                        ) : (
                          <Badge className="bg-warning text-warning-foreground font-bold uppercase text-[9px] h-5 px-2">
                            {assessment.status.replace('_', ' ')}
                          </Badge>
                        )}
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    </div>
                  ))}
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
           {isStudent ? <StudentProgress /> : <AdminProgress />}
         </div>
      </div>
      {/* Student Detail Slide-out Panel */}
      {!isStudent && <StudentDetailSheet />}
    </DashboardLayout>
  );
}
